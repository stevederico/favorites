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
        self.pipeline(sql, &[], false).map(|_| ())
    }

    /// Run a parameterized query and collect rows.
    pub fn query(&self, sql: &str, params: &[Value]) -> Result<Vec<Row>, DbError> {
        self.pipeline(sql, params, false).map(|out| out.rows)
    }

    /// Run a parameterized write and report rows touched.
    pub fn run(&self, sql: &str, params: &[Value]) -> Result<Changes, DbError> {
        self.pipeline(sql, params, false).map(|out| out.changes)
    }

    fn pipeline(&self, sql: &str, params: &[Value], keep_open: bool) -> Result<ExecOut, DbError> {
        let mut baton = self.baton.lock().unwrap_or_else(|e| e.into_inner());
        let mut requests = vec![execute_request(sql, params)];
        if !keep_open && baton.is_none() {
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
        let res = httpc::post_json(&url, &headers, &body, TIMEOUT_MS)
            .map_err(|e| DbError::local(format!("libsql: {e}")))?;
        if !res.ok() {
            return Err(DbError::local(format!(
                "libsql HTTP {} {}",
                res.status,
                res.text()
            )));
        }
        let parsed = json::parse(&res.body)
            .map_err(|e| DbError::local(format!("libsql JSON: {e}")))?;

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
