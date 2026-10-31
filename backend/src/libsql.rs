//! Hrana-over-HTTP client for the shared `sqlite-shared` libSQL server.
//!
//! Prod sets `DB_TYPE=libsql` plus `LIBSQL_URL` / `LIBSQL_ADMIN_URL`. The
//! namespace is `config.database.db` (`BXFav`), selected with `x-namespace`.
//! Zero-crate: outbound HTTP is [`crate::httpc`].

use std::sync::Mutex;

use crate::db::{Changes, DbError, Row, Value};
use crate::httpc;
use crate::json::{self, Json};

const TIMEOUT_MS: i64 = 30_000;

/// One HTTP-backed libSQL connection (namespace + optional Hrana baton).
pub struct Client {
    url: String,
    namespace: String,
    baton: Mutex<Option<String>>,
}

impl Clone for Client {
    fn clone(&self) -> Self {
        Client {
            url: self.url.clone(),
            namespace: self.namespace.clone(),
            baton: Mutex::new(None),
        }
    }
}

impl Client {
    /// `url` is the sqld HTTP base (`http://sqlite-shared.railway.internal:8080`).
    pub fn new(url: &str, namespace: &str) -> Client {
        Client {
            url: url.trim_end_matches('/').to_string(),
            namespace: namespace.to_string(),
            baton: Mutex::new(None),
        }
    }

    /// Create the namespace via the admin API. "already exists" is success.
    pub fn ensure_namespace(admin_url: &str, namespace: &str) -> Result<(), DbError> {
        let base = admin_url.trim_end_matches('/');
        let url = format!("{base}/v1/namespaces/{namespace}/create");
        let res = httpc::post_json(&url, &[], "{}", TIMEOUT_MS)
            .map_err(|e| DbError::local(format!("libsql admin: {e}")))?;
        if res.ok() {
            return Ok(());
        }
        let detail = res.text();
        if detail.to_ascii_lowercase().contains("exist") {
            return Ok(());
        }
        Err(DbError::local(format!(
            "Failed to create namespace '{namespace}' ({}): {detail}",
            res.status
        )))
    }

    /// Run SQL with no result rows.
    pub fn exec(&self, sql: &str) -> Result<(), DbError> {
        self.pipeline(sql, &[]).map(|_| ())
    }

    /// Run a parameterized query and collect rows.
    pub fn query(&self, sql: &str, params: &[Value]) -> Result<Vec<Row>, DbError> {
        self.pipeline(sql, params).map(|out| out.rows)
    }

    /// Run a parameterized write and report rows touched.
    pub fn run(&self, sql: &str, params: &[Value]) -> Result<Changes, DbError> {
        self.pipeline(sql, params).map(|out| out.changes)
    }

    /// Send one statement over Hrana HTTP.
    ///
    /// Outside a transaction every statement is its own stream (sent with a
    /// `close`). A `BEGIN` keeps the stream open and stores its baton, every
    /// statement after it reuses that baton, and `COMMIT` / `ROLLBACK` closes
    /// it. Without this each of `BEGIN`, the writes and `COMMIT` ran on its own
    /// stream: the writes autocommitted and `COMMIT` failed with "no
    /// transaction is active", so every `Pool::transaction` answered an error
    /// after its writes had landed (signup 500, usage gate 500).
    fn pipeline(&self, sql: &str, params: &[Value]) -> Result<ExecOut, DbError> {
        let mut baton = self.baton.lock().unwrap_or_else(|e| e.into_inner());
        let keep_open = stream_stays_open(sql, baton.is_some());
        let mut requests = vec![execute_request(sql, params)];
        if !keep_open {
            requests.push(json::obj([("type", json::s("close"))]));
        }
        let mut body_map = std::collections::BTreeMap::new();
        if let Some(b) = baton.as_ref() {
            body_map.insert("baton".to_string(), json::s(b.clone()));
        }
        body_map.insert("requests".to_string(), Json::Arr(requests));
        let body = json::stringify(&Json::Obj(body_map));

        let url = format!("{}/v2/pipeline", self.url);
        let headers = [("x-namespace", self.namespace.as_str())];
        // A transport failure leaves the stream unusable: drop the baton so
        // this connection does not keep sending it, and let the next
        // statement start a fresh stream.
        let res = match httpc::post_json(&url, &headers, &body, TIMEOUT_MS) {
            Ok(res) => res,
            Err(e) => {
                *baton = None;
                return Err(DbError::local(format!("libsql: {e}")));
            }
        };
        if !res.ok() {
            *baton = None;
            return Err(DbError::local(format!(
                "libsql HTTP {} {}",
                res.status,
                res.text()
            )));
        }
        let parsed = match json::parse(&res.body) {
            Ok(parsed) => parsed,
            Err(e) => {
                *baton = None;
                return Err(DbError::local(format!("libsql JSON: {e}")));
            }
        };

        if keep_open {
            *baton = parsed.get_str("baton").map(str::to_string);
        } else {
            *baton = None;
        }

        let results = parsed
            .get("results")
            .and_then(Json::as_arr)
            .ok_or_else(|| DbError::local("libsql pipeline missing results"))?;
        let first = results
            .first()
            .ok_or_else(|| DbError::local("libsql pipeline empty results"))?;
        if first.get_str("type") == Some("error") {
            let message = first
                .path("error.message")
                .and_then(Json::as_str)
                .unwrap_or("libsql error")
                .to_string();
            return Err(DbError {
                code: 19,
                message,
            });
        }
        let result = first
            .path("response.result")
            .ok_or_else(|| DbError::local("libsql execute missing result"))?;
        Ok(parse_execute(result)?)
    }
}

/// Whether the Hrana stream stays open after `sql`.
///
/// `in_transaction` is true when a baton from an earlier `BEGIN` is held.
/// `BEGIN` opens the stream, `COMMIT` / `END` / `ROLLBACK` (but not
/// `ROLLBACK TO` a savepoint) closes it, and anything else keeps whatever
/// state it found.
fn stream_stays_open(sql: &str, in_transaction: bool) -> bool {
    let words: Vec<String> = sql
        .split_whitespace()
        .take(2)
        .map(str::to_ascii_uppercase)
        .collect();
    match words.first().map(String::as_str) {
        Some("BEGIN") => true,
        Some("COMMIT") | Some("END") => false,
        Some("ROLLBACK") => in_transaction && words.get(1).map(String::as_str) == Some("TO"),
        _ => in_transaction,
    }
}

struct ExecOut {
    rows: Vec<Row>,
    changes: Changes,
}

fn execute_request(sql: &str, params: &[Value]) -> Json {
    let args: Vec<Json> = params.iter().map(arg_json).collect();
    let stmt = json::obj([("sql", json::s(sql)), ("args", Json::Arr(args))]);
    json::obj([("type", json::s("execute")), ("stmt", stmt)])
}

fn arg_json(v: &Value) -> Json {
    match v {
        Value::Null => json::obj([("type", json::s("null"))]),
        Value::Int(n) => json::obj([
            ("type", json::s("integer")),
            ("value", json::s(n.to_string())),
        ]),
        Value::Real(x) => json::obj([("type", json::s("float")), ("value", Json::Num(*x))]),
        Value::Text(s) => json::obj([("type", json::s("text")), ("value", json::s(s.clone()))]),
    }
}

fn parse_execute(result: &Json) -> Result<ExecOut, DbError> {
    let cols: Vec<String> = result
        .get("cols")
        .and_then(Json::as_arr)
        .unwrap_or(&[])
        .iter()
        .map(|c| c.get_str("name").unwrap_or("").to_string())
        .collect();
    let mut rows = Vec::new();
    if let Some(raw_rows) = result.get("rows").and_then(Json::as_arr) {
        for raw in raw_rows {
            let cells = match raw.as_arr() {
                Some(vals) => cols
                    .iter()
                    .enumerate()
                    .map(|(i, name)| {
                        let v = vals.get(i).map(hrana_value).unwrap_or(Value::Null);
                        (name.clone(), v)
                    })
                    .collect(),
                None => Vec::new(),
            };
            rows.push(Row::from_cells(cells));
        }
    }
    let changes = result.get_i64("affected_row_count").unwrap_or(0);
    let last = match result.get("last_insert_rowid") {
        Some(Json::Str(s)) => s.parse().unwrap_or(0),
        Some(Json::Num(n)) => *n as i64,
        _ => 0,
    };
    Ok(ExecOut {
        rows,
        changes: Changes {
            changes,
            last_insert_rowid: last,
        },
    })
}

fn hrana_value(v: &Json) -> Value {
    match v.get_str("type") {
        Some("null") => Value::Null,
        Some("integer") => {
            if let Some(n) = v.get_i64("value") {
                Value::Int(n)
            } else if let Some(s) = v.get_str("value") {
                Value::Int(s.parse().unwrap_or(0))
            } else {
                Value::Null
            }
        }
        Some("float") => Value::Real(v.get("value").and_then(Json::as_f64).unwrap_or(0.0)),
        Some("text") => Value::Text(v.get_str("value").unwrap_or("").to_string()),
        _ => {
            if v.is_null() {
                Value::Null
            } else if let Some(s) = v.as_str() {
                Value::Text(s.to_string())
            } else if let Some(n) = v.as_i64() {
                Value::Int(n)
            } else {
                Value::Null
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::stream_stays_open;

    #[test]
    fn begin_opens_and_commit_or_rollback_closes_the_stream() {
        assert!(stream_stays_open("BEGIN IMMEDIATE", false));
        assert!(stream_stays_open("  begin", false));
        assert!(stream_stays_open("UPDATE Users SET x = 1", true));
        assert!(!stream_stays_open("COMMIT", true));
        assert!(!stream_stays_open("END", true));
        assert!(!stream_stays_open("ROLLBACK", true));
        assert!(stream_stays_open("ROLLBACK TO sp1", true));
    }

    #[test]
    fn statements_outside_a_transaction_close_their_stream() {
        assert!(!stream_stays_open("SELECT 1", false));
        assert!(!stream_stays_open("INSERT INTO t VALUES (1)", false));
        assert!(!stream_stays_open("ROLLBACK", false));
    }
}
/// Transactions against a local Hrana stub that keeps stream state like sqld.
#[cfg(test)]
mod hrana_stub_tests {
    use super::Client;
    use crate::db::{Pool, Value};
    use crate::json::{self, Json};
    use std::collections::HashMap;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::sync::{Arc, Mutex};

    /// Every statement the stub ran, as (stream id, SQL).
    type Log = Arc<Mutex<Vec<(u64, String)>>>;

    /// Stream state: id and whether a transaction is open on it.
    type Streams = HashMap<String, (u64, bool)>;

    /// Start a minimal Hrana v2 `/v2/pipeline` server modelled on sqld.
    ///
    /// A request without a baton opens a new stream, `close` ends it (an open
    /// transaction dies with it), and `COMMIT` / `ROLLBACK` on a stream with no
    /// open transaction fail with SQLite's message. SQL starting with
    /// `HTTPFAIL` answers HTTP 500 and forgets the stream.
    fn spawn_stub() -> (String, Log) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind stub");
        let url = format!("http://{}", listener.local_addr().expect("stub addr"));
        let log: Log = Arc::default();
        let seen = Arc::clone(&log);
        std::thread::spawn(move || {
            let mut streams = Streams::new();
            let mut next_id = 0u64;
            for conn in listener.incoming() {
                let Ok(mut conn) = conn else { continue };
                let Some(body) = read_body(&mut conn) else {
                    continue;
                };
                let (status, reply) = answer(&body, &mut streams, &mut next_id, &seen);
                let _ = write!(
                    conn,
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply}",
                    reply.len()
                );
            }
        });
        (url, log)
    }

    /// Read one HTTP request and return its body.
    fn read_body(conn: &mut TcpStream) -> Option<Vec<u8>> {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 4096];
        let head_end = loop {
            let n = conn.read(&mut chunk).ok()?;
            if n == 0 {
                return None;
            }
            buf.extend_from_slice(&chunk[..n]);
            if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break i + 4;
            }
        };
        let head = String::from_utf8_lossy(&buf[..head_end]).to_ascii_lowercase();
        let len: usize = head
            .lines()
            .find_map(|l| l.strip_prefix("content-length:"))
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(0);
        while buf.len() < head_end + len {
            let n = conn.read(&mut chunk).ok()?;
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        Some(buf[head_end..].to_vec())
    }

    /// Run one pipeline body against the stub's streams.
    fn answer(body: &[u8], streams: &mut Streams, next_id: &mut u64, log: &Log) -> (u16, String) {
        let req = json::parse(body).expect("pipeline JSON");
        let (id, mut in_tx) = match req.get_str("baton") {
            Some(b) => match streams.remove(b) {
                Some(state) => state,
                None => return (400, r#"{"message":"unknown baton"}"#.to_string()),
            },
            None => {
                *next_id += 1;
                (*next_id, false)
            }
        };
        let mut results = Vec::new();
        let mut closed = false;
        for r in req.get("requests").and_then(Json::as_arr).unwrap_or(&[]) {
            if r.get_str("type") == Some("close") {
                closed = true;
                results.push(r#"{"type":"ok","response":{"type":"close"}}"#.to_string());
                continue;
            }
            let sql = r.path("stmt.sql").and_then(Json::as_str).unwrap_or("");
            log.lock().unwrap().push((id, sql.to_string()));
            let first = sql
                .split_whitespace()
                .next()
                .unwrap_or("")
                .to_ascii_uppercase();
            if first == "HTTPFAIL" {
                return (500, r#"{"message":"stream failed"}"#.to_string());
            }
            let error = match first.as_str() {
                "BEGIN" if in_tx => Some("cannot start a transaction within a transaction"),
                "COMMIT" | "END" if !in_tx => Some("cannot commit - no transaction is active"),
                "ROLLBACK" if !in_tx => Some("cannot rollback - no transaction is active"),
                "BEGIN" => {
                    in_tx = true;
                    None
                }
                "COMMIT" | "END" | "ROLLBACK" => {
                    in_tx = false;
                    None
                }
                _ => None,
            };
            results.push(match error {
                Some(message) => format!(r#"{{"type":"error","error":{{"message":"{message}"}}}}"#),
                None => r#"{"type":"ok","response":{"type":"execute","result":{"cols":[],"rows":[],"affected_row_count":1,"last_insert_rowid":null}}}"#.to_string(),
            });
        }
        let baton = if closed {
            "null".to_string()
        } else {
            let b = format!("baton-{id}-{}", log.lock().unwrap().len());
            streams.insert(b.clone(), (id, in_tx));
            format!("\"{b}\"")
        };
        (
            200,
            format!(r#"{{"baton":{baton},"results":[{}]}}"#, results.join(",")),
        )
    }

    /// Stream ids the stub saw, in order, for statements matching `pred`.
    fn streams_for(log: &Log, pred: impl Fn(&str) -> bool) -> Vec<u64> {
        log.lock()
            .unwrap()
            .iter()
            .filter(|(_, sql)| pred(sql))
            .map(|(id, _)| *id)
            .collect()
    }

    #[test]
    fn begin_writes_and_commit_share_one_stream_and_commit_succeeds() {
        let (url, log) = spawn_stub();
        let client = Client::new(&url, "Test");
        client.exec("BEGIN IMMEDIATE").expect("begin");
        client
            .run("INSERT INTO t VALUES (?)", &[Value::Int(1)])
            .expect("insert");
        client
            .exec("COMMIT")
            .expect("commit must find the open transaction");
        client.query("SELECT 1", &[]).expect("select after commit");

        let ids = streams_for(&log, |_| true);
        assert_eq!(ids.len(), 4);
        assert!(
            ids[..3].iter().all(|id| *id == ids[0]),
            "BEGIN/INSERT/COMMIT split across streams: {ids:?}"
        );
        assert_ne!(ids[3], ids[0], "COMMIT must close the transaction stream");
    }

    #[test]
    fn rollback_closes_the_transaction_stream() {
        let (url, log) = spawn_stub();
        let client = Client::new(&url, "Test");
        client.exec("BEGIN").expect("begin");
        client
            .exec("ROLLBACK")
            .expect("rollback must find the open transaction");
        client
            .query("SELECT 1", &[])
            .expect("select after rollback");
        let ids = streams_for(&log, |_| true);
        assert_eq!(ids[0], ids[1]);
        assert_ne!(ids[2], ids[0]);
    }

    #[test]
    fn an_http_failure_drops_the_baton_so_the_next_statement_starts_fresh() {
        let (url, log) = spawn_stub();
        let client = Client::new(&url, "Test");
        client.exec("BEGIN").expect("begin");
        assert!(client.exec("HTTPFAIL").is_err());
        client
            .query("SELECT 1", &[])
            .expect("fresh stream after failure");
        let ids = streams_for(&log, |_| true);
        assert_ne!(ids[2], ids[0], "a dead baton must not be reused");
    }

    #[test]
    fn pool_transaction_commits_over_libsql() {
        let (url, log) = spawn_stub();
        let pool = Pool::open_libsql(&url, "Test", 1).expect("open pool");
        let out = pool.transaction(|db| {
            db.run(
                "INSERT INTO Users (email) VALUES (?)",
                &[Value::Text("x".into())],
            )?;
            db.run(
                "INSERT INTO Auths (email) VALUES (?)",
                &[Value::Text("x".into())],
            )?;
            Ok(())
        });
        assert!(out.is_ok(), "Pool::transaction failed: {out:?}");
        let tx = streams_for(&log, |sql| {
            sql.starts_with("BEGIN")
                || sql.starts_with("INSERT INTO Users")
                || sql.starts_with("INSERT INTO Auths")
                || sql == "COMMIT"
        });
        assert_eq!(tx.len(), 4);
        assert!(
            tx.iter().all(|id| *id == tx[0]),
            "transaction split across streams: {tx:?}"
        );
    }
}
