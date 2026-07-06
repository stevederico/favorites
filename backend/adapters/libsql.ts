import { createClient } from "@libsql/client/web";
import type { Client, ResultSet, Row, Value } from "@libsql/client";
import type {
  AuthQuery,
  AuthRecord,
  AuthUpdate,
  DatabaseProvider,
  DeleteResult,
  ExecuteResult,
  InsertResult,
  SqlParam,
  SqlQueryObject,
  SqlStatement,
  Subscription,
  UpdateResult,
  Usage,
  User,
  UserQuery,
  UserUpdate,
  WebhookEventRecord
} from '../types.ts';

/**
 * Raw Users row shape with flat subscription and usage columns. findUser mutates
 * this in place — nesting the flat columns into `subscription`/`usage` and
 * deleting them — so the flat columns are optional and the nested fields declared.
 */
type UserRow = {
  _id: string;
  email: string;
  name: string;
  created_at: number;
  subscription_stripeID?: string | null;
  subscription_expires?: number | null;
  subscription_status?: string | null;
  usage_count?: number | null;
  usage_reset_at?: number | null;
  subscription?: Subscription;
  usage?: Usage;
};

/** Per-statement result collected by executeTransaction. */
type TransactionStatementResult = {
  query: string;
  changes: number;
  lastInsertRowid: bigint | null;
};

/** Narrow an unknown row to a non-null object so its keys can be probed. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for a raw Users row. Checks the required, non-nullable columns;
 * optional subscription/usage columns are validated by findUser's transform.
 */
function isUserRow(value: unknown): value is UserRow {
  return (
    isRecord(value) &&
    typeof value._id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.name === 'string' &&
    typeof value.created_at === 'number'
  );
}

/** Type guard for an Auths row. */
function isAuthRecord(value: unknown): value is AuthRecord {
  return (
    isRecord(value) &&
    typeof value.email === 'string' &&
    typeof value.password === 'string' &&
    typeof value.userID === 'string'
  );
}

/** Type guard for a WebhookEvents row. */
function isWebhookEventRecord(value: unknown): value is WebhookEventRecord {
  return (
    isRecord(value) &&
    typeof value.event_id === 'string' &&
    typeof value.event_type === 'string' &&
    typeof value.processed_at === 'number'
  );
}

/**
 * Convert a libSQL Row (column-indexed, non-plain) into a plain, mutable
 * string-keyed record so type guards can probe it and findUser can mutate it.
 *
 * @param columns - Result column names, in order
 * @param row - Row returned by the client
 * @returns Plain object keyed by column name
 */
function rowToRecord(columns: readonly string[], row: Row): Record<string, Value> {
  const record: Record<string, Value> = {};
  columns.forEach((col, index) => {
    record[col] = row[index];
  });
  return record;
}

/**
 * libSQL (Turso / `sqld`) database provider talking to the shared server over HTTP.
 *
 * Each app maps to an isolated server-side *namespace* (keyed by `dbName`), selected
 * per-request via an `x-namespace` header so one internal hostname serves every app
 * without per-namespace DNS. Schema is created on first connection, mirroring the
 * SQLite adapter (same tables, same SQL) since libSQL is SQLite wire-compatible.
 *
 * Config via env:
 * - `LIBSQL_URL` — base HTTP URL of the shared server (e.g. http://sqlite-shared.railway.internal:8080)
 * - `LIBSQL_ADMIN_URL` — optional admin API URL (…:8081); when set, namespaces are auto-created
 *
 * @class
 */
export class LibSQLProvider implements DatabaseProvider<Client> {
  databases: Map<string, Client>;

  /** Create provider with empty connection cache. */
  constructor() {
    this.databases = new Map();
  }

  /** No global setup required — namespaces/schema are ensured lazily per database. */
  async initialize(): Promise<void> {
    // no-op
  }

  /**
   * Resolve the shared server base URL from env (falling back to the config
   * connectionString when it looks like an http(s) URL).
   *
   * @param connectionString - Optional connectionString from config
   * @returns Base URL of the libSQL server
   * @throws {Error} When no URL is configured
   */
  private resolveUrl(connectionString?: string | null): string {
    const fromEnv = process.env.LIBSQL_URL;
    if (fromEnv) return fromEnv;
    if (connectionString && /^https?:\/\//.test(connectionString)) return connectionString;
    throw new Error('LIBSQL_URL is required for the libsql adapter');
  }

  /**
   * Ensure the server-side namespace exists. No-op unless `LIBSQL_ADMIN_URL`
   * is set; treats an "already exists" response as success.
   *
   * @param namespace - Namespace name (the database name)
   * @throws {Error} On an admin API failure other than "already exists"
   */
  private async ensureNamespace(namespace: string): Promise<void> {
    const adminUrl = process.env.LIBSQL_ADMIN_URL;
    if (!adminUrl) return;
    const res = await fetch(`${adminUrl}/v1/namespaces/${namespace}/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) {
      const detail = await res.text();
      if (!/exist/i.test(detail)) {
        throw new Error(`Failed to create namespace '${namespace}' (${res.status}): ${detail}`);
      }
    }
  }

  /**
   * Create schema if tables don't exist. Mirrors the SQLite adapter's schema
   * exactly (Users, Auths, WebhookEvents + indexes).
   *
   * @param db - libSQL client bound to a namespace
   */
  private async ensureSchema(db: Client): Promise<void> {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS Users (
        _id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        subscription_stripeID TEXT,
        subscription_expires INTEGER,
        subscription_status TEXT,
        usage_count INTEGER DEFAULT 0,
        usage_reset_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS Auths (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        userID TEXT NOT NULL,
        FOREIGN KEY (userID) REFERENCES Users(_id)
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON Users(email)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_auths_email ON Auths(email)`,
      `CREATE TABLE IF NOT EXISTS WebhookEvents (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at INTEGER NOT NULL
      )`
    ], 'write');
  }

  /**
   * Get or create a namespace-bound libSQL client, cached by database name.
   *
   * The namespace is selected by injecting an `x-namespace` header on every
   * request via a wrapped fetch, so all namespaces share one base URL.
   *
   * @param dbName - Database name, used as the namespace
   * @param connectionString - Optional base URL override
   * @returns Connected libSQL client
   */
  async getDatabase(dbName: string, connectionString: string | null = null): Promise<Client> {
    const cached = this.databases.get(dbName);
    if (cached) return cached;

    const url = this.resolveUrl(connectionString);
    await this.ensureNamespace(dbName);

    const db = createClient({
      url,
      fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const headers = new Headers(init?.headers);
        headers.set('x-namespace', dbName);
        return fetch(input, { ...init, headers });
      }
    });

    await this.ensureSchema(db);
    this.databases.set(dbName, db);
    return db;
  }

  /**
   * Find a user by _id or email, rebuilding nested subscription/usage objects.
   *
   * @param db - libSQL client
   * @param query - Query with _id or email
   * @returns User with nested subscription/usage, or null
   */
  async findUser(db: Client, query: UserQuery, _projection: Record<string, unknown> = {}): Promise<User | null> {
    const { _id, email } = query;
    let sql = "SELECT * FROM Users WHERE ";
    const params: SqlParam[] = [];

    if (_id) {
      sql += "_id = ?";
      params.push(_id);
    } else if (email) {
      sql += "email = ?";
      params.push(email);
    } else {
      return null;
    }

    const rs = await db.execute({ sql, args: params });
    const first = rs.rows[0];
    const row = first ? rowToRecord(rs.columns, first) : null;
    const result = isUserRow(row) ? row : null;
    if (result) {
      if (result.subscription_stripeID) {
        result.subscription = {
          stripeID: result.subscription_stripeID,
          expires: result.subscription_expires ?? null,
          status: result.subscription_status ?? ''
        };
        delete result.subscription_stripeID;
        delete result.subscription_expires;
        delete result.subscription_status;
      }
      if (result.usage_count !== undefined) {
        result.usage = {
          count: result.usage_count || 0,
          reset_at: result.usage_reset_at || null
        };
        delete result.usage_count;
        delete result.usage_reset_at;
      }
    }
    return result;
  }

  /**
   * Insert a new user record.
   *
   * @param db - libSQL client
   * @param userData - User to insert
   * @returns Inserted user ID
   */
  async insertUser(db: Client, userData: User): Promise<InsertResult> {
    const { _id, email, name, created_at } = userData;
    const sql = "INSERT INTO Users (_id, email, name, created_at) VALUES (?, ?, ?, ?)";
    await db.execute({ sql, args: [_id, email, name, created_at] });
    return { insertedId: _id };
  }

  /**
   * Update user fields by ID. Supports $inc (atomic increment), $set with a
   * subscription/usage object (mapped to flat columns), or $set with flat fields.
   * Whitelists columns to prevent injection.
   *
   * @param db - libSQL client
   * @param query - Query with _id
   * @param update - Update with $inc or $set
   * @returns Number of modified rows
   */
  async updateUser(db: Client, query: UserQuery, update: UserUpdate): Promise<UpdateResult> {
    const { _id } = query;
    if (!_id) throw new Error('updateUser requires _id');
    const ALLOWED_FIELDS = ['name', 'email', 'created_at', 'subscription_stripeID', 'subscription_expires', 'subscription_status', 'usage_count', 'usage_reset_at'];

    if (update.$inc) {
      const incField = Object.keys(update.$inc)[0];
      const incValue = update.$inc[incField];
      const columnMap: Record<string, string> = { 'usage.count': 'usage_count' };
      const column = columnMap[incField] || incField;
      if (!ALLOWED_FIELDS.includes(column)) return { modifiedCount: 0 };
      const sql = `UPDATE Users SET ${column} = COALESCE(${column}, 0) + ? WHERE _id = ?`;
      const rs = await db.execute({ sql, args: [incValue, _id] });
      return { modifiedCount: rs.rowsAffected };
    }

    const updateData = update.$set;
    if (!updateData) return { modifiedCount: 0 };

    if (updateData.subscription) {
      const { stripeID, expires, status } = updateData.subscription;
      const sql = `UPDATE Users SET
        subscription_stripeID = ?,
        subscription_expires = ?,
        subscription_status = ?
        WHERE _id = ?`;
      const rs = await db.execute({ sql, args: [stripeID, expires, status, _id] });
      return { modifiedCount: rs.rowsAffected };
    } else if (updateData.usage) {
      const { count, reset_at } = updateData.usage;
      const sql = `UPDATE Users SET
        usage_count = ?,
        usage_reset_at = ?
        WHERE _id = ?`;
      const rs = await db.execute({ sql, args: [count, reset_at, _id] });
      return { modifiedCount: rs.rowsAffected };
    } else {
      const fields = Object.keys(updateData).filter(field => ALLOWED_FIELDS.includes(field));
      if (fields.length === 0) return { modifiedCount: 0 };
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => updateData[field]) as SqlParam[];
      values.push(_id);
      const sql = `UPDATE Users SET ${setClause} WHERE _id = ?`;
      const rs = await db.execute({ sql, args: values });
      return { modifiedCount: rs.rowsAffected };
    }
  }

  /**
   * Delete a user by _id or email (matches findUser's selector convention).
   *
   * @param db - libSQL client
   * @param query - Query with _id or email
   * @returns Number of deleted rows
   */
  async deleteUser(db: Client, query: UserQuery): Promise<DeleteResult> {
    const { _id, email } = query;
    let sql = "DELETE FROM Users WHERE ";
    const params: SqlParam[] = [];

    if (_id) {
      sql += "_id = ?";
      params.push(_id);
    } else if (email) {
      sql += "email = ?";
      params.push(email);
    } else {
      return { deletedCount: 0 };
    }

    const rs = await db.execute({ sql, args: params });
    return { deletedCount: rs.rowsAffected };
  }

  /**
   * Find an authentication record by email.
   *
   * @param db - libSQL client
   * @param query - Query with email
   * @returns Auth record or null
   */
  async findAuth(db: Client, query: AuthQuery): Promise<AuthRecord | null> {
    const { email } = query;
    const rs = await db.execute({ sql: "SELECT * FROM Auths WHERE email = ?", args: [email] });
    const first = rs.rows[0];
    const row = first ? rowToRecord(rs.columns, first) : null;
    return isAuthRecord(row) ? row : null;
  }

  /**
   * Insert an authentication record.
   *
   * @param db - libSQL client
   * @param authData - Auth record to insert
   * @returns Inserted email
   */
  async insertAuth(db: Client, authData: AuthRecord): Promise<InsertResult> {
    const { email, password, userID } = authData;
    const sql = "INSERT INTO Auths (email, password, userID) VALUES (?, ?, ?)";
    await db.execute({ sql, args: [email, password, userID] });
    return { insertedId: email };
  }

  /**
   * Update an authentication record's password.
   *
   * @param db - libSQL client
   * @param query - Query with email
   * @param update - Fields to update (password)
   * @returns Number of modified rows
   */
  async updateAuth(db: Client, query: AuthQuery, update: AuthUpdate): Promise<UpdateResult> {
    const { email } = query;
    const { password } = update;
    if (typeof password !== 'string') return { modifiedCount: 0 };
    const rs = await db.execute({ sql: "UPDATE Auths SET password = ? WHERE email = ?", args: [password, email] });
    return { modifiedCount: rs.rowsAffected };
  }

  /**
   * Find a webhook event by ID for idempotency.
   *
   * @param db - libSQL client
   * @param eventId - Stripe event ID
   * @returns Webhook event record or null
   */
  async findWebhookEvent(db: Client, eventId: string): Promise<WebhookEventRecord | null> {
    const rs = await db.execute({ sql: "SELECT * FROM WebhookEvents WHERE event_id = ?", args: [eventId] });
    const first = rs.rows[0];
    const row = first ? rowToRecord(rs.columns, first) : null;
    return isWebhookEventRecord(row) ? row : null;
  }

  /**
   * Record a processed webhook event for idempotency tracking.
   *
   * @param db - libSQL client
   * @param eventId - Stripe event ID (unique)
   * @param eventType - Stripe event type
   * @param processedAt - Unix timestamp
   * @returns Inserted event ID
   */
  async insertWebhookEvent(db: Client, eventId: string, eventType: string, processedAt: number): Promise<InsertResult> {
    const sql = "INSERT INTO WebhookEvents (event_id, event_type, processed_at) VALUES (?, ?, ?)";
    await db.execute({ sql, args: [eventId, eventType, processedAt] });
    return { insertedId: eventId };
  }

  /**
   * Execute a custom SQL query (or transaction) with the unified result envelope.
   * SELECTs return mapped rows; writes return affected counts / last insert id.
   *
   * @param db - libSQL client
   * @param queryObject - Query configuration
   * @returns Query result
   */
  async execute(db: Client, queryObject: SqlQueryObject): Promise<ExecuteResult> {
    const startTime = Date.now();

    try {
      const { query, params = [], transaction } = queryObject;
      if (transaction && Array.isArray(transaction)) {
        return await this.executeTransaction(db, transaction, startTime);
      }

      if (!query) {
        throw new Error('Query string is required');
      }

      const isSelect = query.trim().toUpperCase().startsWith('SELECT');
      const rs = await db.execute({ sql: query, args: params });

      if (isSelect) {
        const data = rs.rows.map(row => rowToRecord(rs.columns, row));
        return {
          success: true,
          data,
          rowCount: data.length,
          metadata: { executionTime: Date.now() - startTime, dbType: 'libsql' }
        };
      }

      const data: { insertedId?: bigint; modifiedCount?: number; deletedCount?: number } = {};
      if (rs.lastInsertRowid !== undefined) {
        data.insertedId = rs.lastInsertRowid;
      }
      data.modifiedCount = rs.rowsAffected;
      data.deletedCount = rs.rowsAffected;

      return {
        success: true,
        data,
        rowCount: rs.rowsAffected,
        metadata: { executionTime: Date.now() - startTime, dbType: 'libsql' }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const code = isRecord(error) && (typeof error.code === 'string' || typeof error.code === 'number')
        ? error.code
        : undefined;
      return {
        success: false,
        error: err.message,
        code,
        metadata: { executionTime: Date.now() - startTime, dbType: 'libsql' }
      };
    }
  }

  /**
   * Execute multiple statements atomically via a write batch (all-or-nothing).
   *
   * @param db - libSQL client
   * @param operations - Statements to run
   * @param startTime - Start timestamp for metadata
   * @returns Transaction results
   */
  async executeTransaction(db: Client, operations: SqlStatement[], startTime: number): Promise<ExecuteResult> {
    const resultSets: ResultSet[] = await db.batch(
      operations.map(op => ({ sql: op.query, args: op.params ?? [] })),
      'write'
    );

    const results: TransactionStatementResult[] = resultSets.map((rs, index) => ({
      query: operations[index].query,
      changes: rs.rowsAffected,
      lastInsertRowid: rs.lastInsertRowid ?? null
    }));

    return {
      success: true,
      data: results,
      rowCount: results.reduce((sum, r) => sum + r.changes, 0),
      metadata: { executionTime: Date.now() - startTime, dbType: 'libsql' }
    };
  }

  /** Close all connections and clear the cache. */
  closeAll(): void {
    for (const [, db] of this.databases) {
      db.close();
    }
    this.databases.clear();
  }
}
