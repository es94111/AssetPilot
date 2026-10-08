// lib/db.ts — PostgreSQL runtime 全域單例
// 開發模式：globalThis.__assetPilotDb 防止 HMR 重複初始化
// 生產模式：模組層級 _db（initDB() 負責設值）

import { ensureEnvSecrets } from "./envSecrets";

ensureEnvSecrets();

type DbParam = string | number | null | Uint8Array;

interface DbStatement {
  bind(params?: DbParam[]): void;
  step(): boolean;
  getAsObject(): Record<string, string | number | null>;
  free(): void;
}

export interface DatabaseLike {
  prepare(sql: string): DbStatement;
  run(sql: string, params?: DbParam[]): void;
  exec(
    sql: string,
  ): Array<{ columns: string[]; values: Array<Array<string | number | null>> }>;
  getRowsModified(): number;
  close(): void;
}

declare global {
  // eslint-disable-next-line no-var
  var __assetPilotDb: DatabaseLike | undefined;
}

let _db: DatabaseLike | null = globalThis.__assetPilotDb ?? null;
let initializationPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 1_000;

const DB_RETRY_MAX_DELAY_MS = 30_000;

export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor() {
    super("資料庫目前無法連線，請稍後再試");
    this.name = "DatabaseUnavailableError";
  }
}

export function saveDB(): void {
  // PostgreSQL commits writes in db.run(); kept for existing call sites.
}

export function saveDBSync(): void {
  // PostgreSQL commits writes in db.run(); kept for shutdown hooks.
}

export const flushOnExit = (): void => {};

function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryDelayMs = 1_000;
}

function scheduleInitializationRetry(): void {
  if (_db || retryTimer || !hasDatabaseConfig()) return;

  const delay = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, DB_RETRY_MAX_DELAY_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void initDB().catch((error: unknown) => {
      // initDB() schedules the next attempt. Keep this catch attached so a
      // transient database outage never becomes an unhandled rejection.
      console.warn("[db] PostgreSQL reconnect failed:", errorMessage(error));
    });
  }, delay);

  // A reconnect attempt must not keep an otherwise idle Railway service
  // alive. The HTTP server remains the only ref'ed handle.
  (retryTimer as unknown as { unref?: () => void }).unref?.();
}

function requestInitialization(): void {
  if (_db || initializationPromise || retryTimer || !hasDatabaseConfig()) return;
  void initDB().catch(() => {});
}

async function initializeDB(): Promise<void> {
  if (!hasDatabaseConfig()) {
    throw new Error(
      "未設定 DATABASE_URL 或 POSTGRES_URL，AssetPilot 現在僅支援 PostgreSQL",
    );
  }

  const { PostgresCompatDatabase } = await import("./postgresRuntime");
  // Do not publish the adapter until every migration succeeds. Publishing a
  // half-initialized adapter would make later initDB() calls return early and
  // permanently strand the process after a transient startup outage.
  // SAFETY: PostgresCompatDatabase implements the narrow DatabaseLike adapter used by this module; the cast only bridges its structural worker-backed type.
  const candidate = new PostgresCompatDatabase() as unknown as DatabaseLike;
  try {
    await _runMigrations(candidate);
    _db = candidate;
    globalThis.__assetPilotDb = candidate;
    clearRetryTimer();
    console.log("資料庫初始化完成（PostgreSQL）");
  } catch (error) {
    try {
      candidate.close();
    } catch (closeError) {
      console.error(
        "[db] failed to close PostgreSQL adapter after initialization error:",
        errorMessage(closeError),
      );
    }
    throw error;
  }
}

// ── 初始化（含 migrations）──
export async function initDB(): Promise<void> {
  if (_db) return;
  if (initializationPromise) return initializationPromise;
  // An explicit initDB() call is allowed to bring a recovery attempt forward;
  // getDB() itself leaves the scheduled backoff untouched.
  if (retryTimer) clearRetryTimer();

  const currentPromise = initializeDB();
  initializationPromise = currentPromise;
  try {
    await currentPromise;
  } catch (error) {
    scheduleInitializationRetry();
    throw error;
  } finally {
    if (initializationPromise === currentPromise) initializationPromise = null;
  }
}

export function getDB(): DatabaseLike {
  if (!_db) _db = globalThis.__assetPilotDb ?? null;
  if (!_db) {
    // Requests can arrive while instrumentation is waiting for a database
    // that is temporarily offline. Start/reuse the async retry without
    // making this synchronous compatibility API pretend it can await it.
    requestInitialization();
    throw new DatabaseUnavailableError();
  }
  return _db;
}

export function isPostgresRuntime(): boolean {
  return true;
}

// ── 便利查詢工具 ──
export function queryOne(
  sql: string,
  params: Array<string | number | null> = [],
): Record<string, string | number | null> | null {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function queryAll(
  sql: string,
  params: Array<string | number | null> = [],
): Array<Record<string, string | number | null>> {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Array<Record<string, string | number | null>> = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/**
 * Fetch a large, ordered result in bounded pages rather than retaining all result rows.
 * The supplied SQL must include a deterministic ORDER BY and must not contain LIMIT/OFFSET.
 */
export interface KeysetPageOptions<T extends Record<string, string | number | null>> {
  /** SQL expressions used in the ORDER BY and seek tuple; keep their order aligned. */
  cursorColumns: string[];
  orderBy: string[];
  direction: 'ASC' | 'DESC';
  cursorFromRow: (row: T) => Array<string | number | null>;
  pageSize?: number;
}

/**
 * Fetch a large result in bounded keyset pages. The base query must end at its WHERE clause
 * (or the end of FROM for an unfiltered query); ordering must be deterministic and include a
 * unique tie-breaker. Keyset paging avoids OFFSET rescans and does not shift when new rows are
 * inserted before the current cursor. All cursor/order columns use the same direction.
 */
export async function* queryAllInKeysetPages<T extends Record<string, string | number | null>>(
  baseSql: string,
  params: Array<string | number | null> = [],
  options: KeysetPageOptions<T>,
): AsyncGenerator<T> {
  const pageSize = options.pageSize ?? 1000;
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('pageSize must be a positive safe integer');
  }
  if (options.cursorColumns.length === 0 || options.orderBy.length !== options.cursorColumns.length) {
    throw new RangeError('cursorColumns and orderBy must contain the same non-zero number of expressions');
  }

  let cursor: Array<string | number | null> | null = null;
  for (;;) {
    const seek = cursor
      ? ` AND (${options.cursorColumns.join(', ')}) ${options.direction === 'ASC' ? '>' : '<'} (${options.cursorColumns.map(() => '?').join(', ')})`
      : '';
    const page = queryAll(
      `${baseSql}${seek} ORDER BY ${options.orderBy.map((expression) => `${expression} ${options.direction}`).join(', ')} LIMIT ?`,
      [...params, ...(cursor ?? []), pageSize],
    ) as T[];
    if (page.length === 0) return;
    cursor = options.cursorFromRow(page[page.length - 1]);
    for (const row of page) yield row;
    if (page.length < pageSize) return;
  }
}

// ── Migrations ──
async function _runMigrations(db: DatabaseLike): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS login_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    login_method TEXT DEFAULT 'password',
    is_admin_login INTEGER DEFAULT 0,
    user_agent TEXT DEFAULT ''
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_audit_user_time ON login_audit_logs(user_id, login_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_audit_time ON login_audit_logs(login_at DESC)`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS data_operation_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    result TEXT NOT NULL,
    is_admin_operation INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}'
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_data_audit_user_time ON data_operation_audit_log(user_id, timestamp DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_data_audit_time ON data_operation_audit_log(timestamp DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_data_audit_action ON data_operation_audit_log(action)`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS login_attempt_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT '',
    email TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    login_method TEXT DEFAULT 'password',
    is_admin_login INTEGER DEFAULT 0,
    is_success INTEGER DEFAULT 0,
    failure_reason TEXT DEFAULT '',
    user_agent TEXT DEFAULT ''
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_attempt_time ON login_attempt_logs(login_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_attempt_email_time ON login_attempt_logs(email, login_at DESC)`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS login_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    device_name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    login_at INTEGER NOT NULL,
    last_seen_at INTEGER DEFAULT 0,
    expires_at INTEGER DEFAULT 0,
    revoked_at INTEGER DEFAULT 0
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_sessions_user_active ON login_sessions(user_id, revoked_at, login_at DESC)`,
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token_hash)`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS passkey_credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    transports TEXT DEFAULT '[]',
    counter INTEGER DEFAULT 0,
    device_name TEXT DEFAULT 'Passkey',
    created_at TEXT
  )`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user ON passkey_credentials(user_id)`,
  );

  db.run(`CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    public_registration INTEGER DEFAULT 1,
    allowed_registration_emails TEXT DEFAULT '',
    admin_ip_allowlist TEXT DEFAULT '',
    updated_at INTEGER DEFAULT 0,
    updated_by TEXT DEFAULT ''
  )`);

  const alterIgnore = (sql: string): void => {
    try {
      db.run(sql);
    } catch {
      /* idempotent */
    }
  };
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN admin_ip_allowlist TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_freq TEXT DEFAULT 'off'",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_hour INTEGER DEFAULT 9",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_weekday INTEGER DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_day_of_month INTEGER DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_last_run INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_last_summary TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN report_schedule_user_ids TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN server_time_offset INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN audit_log_retention_days TEXT DEFAULT '90'",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN line_login_enabled INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN transaction_photo_storage TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN transaction_photo_max_bytes INTEGER DEFAULT 0",
  );
  // 股價自動更新（伺服器排程；台股交易時段內每 N 分鐘抓 TWSE/TPEx 最新價寫回 stocks.current_price）
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN stock_auto_update_enabled INTEGER DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN stock_auto_update_interval_min INTEGER DEFAULT 10",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN stock_auto_update_last_run INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE system_settings ADD COLUMN stock_auto_update_last_summary TEXT DEFAULT ''",
  );

  db.run(
    `INSERT INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '') ON CONFLICT DO NOTHING`,
    [Date.now()],
  );

  db.run(`CREATE TABLE IF NOT EXISTS report_schedules (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    freq            TEXT    NOT NULL,
    hour            INTEGER NOT NULL DEFAULT 9,
    minute          INTEGER NOT NULL DEFAULT 0,
    weekday         INTEGER NOT NULL DEFAULT 1,
    day_of_month    INTEGER NOT NULL DEFAULT 1,
    notify_email    INTEGER NOT NULL DEFAULT 1,
    notify_line     INTEGER NOT NULL DEFAULT 0,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        INTEGER NOT NULL DEFAULT 0,
    last_summary    TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )`);
  alterIgnore(
    "ALTER TABLE report_schedules ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE report_schedules ADD COLUMN notify_line INTEGER NOT NULL DEFAULT 0",
  );
  // 分鐘級排程（day_of_month = 0 代表「每月最後一天」）
  alterIgnore(
    "ALTER TABLE report_schedules ADD COLUMN minute INTEGER NOT NULL DEFAULT 0",
  );
  // issue #281：排程綁定帳本；既有列一律回填為個人帳本，寄送時再重新授權。
  alterIgnore(
    "ALTER TABLE report_schedules ADD COLUMN ledger_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "UPDATE report_schedules SET ledger_id = 'personal:' || user_id WHERE ledger_id = ''",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq ON report_schedules(enabled, freq)",
  );

  // 009 多時區月報表：以 user + 月份去重，寄送失敗保留紀錄且不自動重試。
  db.run(`CREATE TABLE IF NOT EXISTS monthly_report_send_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year_month TEXT NOT NULL,
    schedule_id TEXT NOT NULL DEFAULT '',
    sent_at_utc TEXT NOT NULL,
    send_status TEXT NOT NULL DEFAULT 'success' CHECK(send_status IN ('success','failed')),
    error_message TEXT NOT NULL DEFAULT '',
    UNIQUE(user_id, year_month),
    CONSTRAINT monthly_report_send_log_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  alterIgnore(
    "ALTER TABLE monthly_report_send_log ADD COLUMN schedule_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE monthly_report_send_log ADD COLUMN send_status TEXT NOT NULL DEFAULT 'success'",
  );
  alterIgnore(
    "ALTER TABLE monthly_report_send_log ADD COLUMN error_message TEXT NOT NULL DEFAULT ''",
  );
  // issue #281：月報去重範圍必須包含帳本；否則同一收件者的個人與共享帳本排程
  // 會互相抑制。舊列都回填為個人帳本，以保留既有 dedup 行為。
  alterIgnore(
    "ALTER TABLE monthly_report_send_log ADD COLUMN ledger_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "UPDATE monthly_report_send_log SET ledger_id = 'personal:' || user_id WHERE ledger_id = ''",
  );
  alterIgnore(
    "ALTER TABLE monthly_report_send_log DROP CONSTRAINT IF EXISTS monthly_report_send_log_user_id_year_month_key",
  );
  alterIgnore(
    "DROP INDEX IF EXISTS idx_monthly_report_send_log_user",
  );
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_report_send_log_user_ledger_month ON monthly_report_send_log(user_id, ledger_id, year_month)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_monthly_report_send_log_schedule ON monthly_report_send_log(schedule_id, year_month DESC)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    color TEXT DEFAULT '#6366f1',
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    parent_id TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deleted_defaults (
    user_id TEXT NOT NULL,
    default_key TEXT NOT NULL,
    deleted_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, default_key)
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_cat_user_type ON categories(user_id, type)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    initial_balance NUMERIC DEFAULT 0 CHECK (initial_balance::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    currency TEXT DEFAULT 'TWD',
    icon TEXT DEFAULT 'fa-wallet',
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'TWD',
    original_amount NUMERIC DEFAULT 0,
    fx_rate TEXT DEFAULT '1',
    date TEXT NOT NULL,
    category_id TEXT,
    account_id TEXT,
    note TEXT DEFAULT '',
    linked_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER,
    CHECK (amount >= 0 AND amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    CHECK (original_amount >= 0 AND original_amount::text NOT IN ('NaN', 'Infinity', '-Infinity'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exchange_rates (
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL,
    rate_to_twd TEXT NOT NULL,
    updated_at INTEGER,
    PRIMARY KEY (user_id, currency)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exchange_rate_settings (
    user_id TEXT PRIMARY KEY,
    auto_update INTEGER DEFAULT 0,
    last_synced_at INTEGER DEFAULT 0,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0 AND amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    period TEXT DEFAULT 'monthly',
    year INTEGER,
    month INTEGER,
    created_at INTEGER,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount NUMERIC NOT NULL CHECK (amount > 0 AND amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    currency TEXT DEFAULT 'TWD',
    fx_rate TEXT DEFAULT '1',
    category_id TEXT,
    account_id TEXT,
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    start_date TEXT,
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0,1)),
    last_generated TEXT,
    needs_attention INTEGER DEFAULT 0 CHECK(needs_attention IN (0,1)),
    updated_at INTEGER DEFAULT 0,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    market TEXT DEFAULT 'TW',
    name TEXT NOT NULL,
    shares NUMERIC DEFAULT 0 CHECK (shares >= 0 AND shares::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    avg_cost NUMERIC DEFAULT 0 CHECK (avg_cost >= 0 AND avg_cost::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    currency TEXT DEFAULT 'TWD',
    account_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy','sell')),
    shares NUMERIC NOT NULL CHECK (shares > 0 AND shares::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    price NUMERIC NOT NULL CHECK (price >= 0 AND price::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    fee NUMERIC DEFAULT 0 CHECK (fee >= 0 AND fee::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    tax NUMERIC DEFAULT 0 CHECK (tax >= 0 AND tax::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    date TEXT NOT NULL,
    CONSTRAINT stock_transactions_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
    note TEXT DEFAULT '',
    created_at INTEGER,
    -- 現股當沖標記（issue #263）：1 = 同一帳戶同一營業日現款買進與現券賣出，
    -- 賣出證交稅適用證券交易稅條例第 2 條之 2 的千分之一點五稅率。
    day_trade INTEGER DEFAULT 0 CHECK (day_trade IN (0,1)),
    linked_dividend_id TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0 AND amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    shares NUMERIC DEFAULT 0 CHECK (shares >= 0 AND shares::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    CONSTRAINT stock_dividends_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
    created_at INTEGER,
    -- 股利再投資（DRIP，issue #263）：1 = 以現金股利再買入同一標的，
    -- 系統會同步寫入一筆合成買進交易（price = reinvest_price）調整 FIFO 成本基礎。
    reinvest INTEGER DEFAULT 0 CHECK (reinvest IN (0,1)),
    reinvest_shares NUMERIC DEFAULT 0 CHECK (reinvest_shares >= 0 AND reinvest_shares::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    reinvest_price NUMERIC DEFAULT 0 CHECK (reinvest_price >= 0 AND reinvest_price::text NOT IN ('NaN', 'Infinity', '-Infinity'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    amount NUMERIC DEFAULT 0 CHECK (amount >= 0 AND amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    start_date TEXT,
    account_id TEXT DEFAULT '',
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0,1)),
    last_generated TEXT,
    created_at INTEGER,
    updated_at INTEGER DEFAULT 0,
    freq TEXT DEFAULT '',
    shares NUMERIC DEFAULT 0 CHECK (shares >= 0 AND shares::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    price NUMERIC DEFAULT 0 CHECK (price >= 0 AND price::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    next_date TEXT,
    CONSTRAINT stock_recurring_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
  )`);

  // 股票月結收盤價快取（滿月資訊版用；依代號跨使用者共用，鎖定已結束月份最後交易日收盤價）
  db.run(`CREATE TABLE IF NOT EXISTS stock_month_close_prices (
    symbol TEXT NOT NULL,
    year_month TEXT NOT NULL,
    close_price NUMERIC NOT NULL CHECK (close_price >= 0 AND close_price::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    close_date TEXT DEFAULT '',
    updated_at INTEGER DEFAULT 0,
    PRIMARY KEY (symbol, year_month)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    pinned_currencies TEXT DEFAULT '[]',
    default_currency TEXT DEFAULT 'TWD',
    dashboard_layout TEXT DEFAULT '{}',
    dashboard_layout_updated_at INTEGER DEFAULT 0,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transaction_attachments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    storage TEXT NOT NULL,
    local_path TEXT DEFAULT '',
    object_key TEXT DEFAULT '',
    bucket TEXT DEFAULT '',
    endpoint TEXT DEFAULT '',
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_tx_attachments_tx ON transaction_attachments(user_id, transaction_id, created_at)",
  );
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN default_currency TEXT DEFAULT 'TWD'",
  );
  // 使用者語言偏好（多語言）。見 lib/i18n/。預設 zh-TW；排程通知（Email/LINE）亦讀此欄。
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN language TEXT DEFAULT 'zh-TW'",
  );
  // Dashboard 模組排序與顯示偏好。JSON 僅接受 lib/dashboardPreferences.ts 的固定 allowlist。
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN dashboard_layout TEXT DEFAULT '{}'",
  );
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN dashboard_layout_updated_at INTEGER DEFAULT 0",
  );

  // 交易憑證照片的每使用者資料金鑰（DEK），已被 PHOTO_MASTER_KEY 包覆。見 lib/photoCrypto.ts。
  db.run(`CREATE TABLE IF NOT EXISTS user_photo_keys (
    user_id TEXT PRIMARY KEY,
    wrapped_dek TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // issue #281：LINE 對話狀態以「LINE 使用者＋帳本」為範圍。舊版只有
  // line_user_id 主鍵，無法在同一個 LINE 帳號下維護不同帳本的草稿（切換帳本會
  // 覆蓋既有草稿）；新建的資料表改以複合主鍵，並保留 line_user_id 唯一索引給
  // 尚未遷移的舊列（該索引在回填完成後移除）。
  db.run(`CREATE TABLE IF NOT EXISTS line_bot_states (
    line_user_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    tx_type TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    ledger_id TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (line_user_id, ledger_id)
  )`);
  alterIgnore(
    "ALTER TABLE line_bot_states ADD COLUMN payload TEXT DEFAULT '{}'",
  );
  alterIgnore(
    "ALTER TABLE line_bot_states ADD COLUMN ledger_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "UPDATE line_bot_states SET ledger_id = 'personal:' || user_id WHERE ledger_id = ''",
  );
  // 既有部署的主鍵只有 line_user_id；改為複合主鍵前必須先換掉，否則同一 LINE 帳號
  // 在第二個帳本建立草稿時會撞上舊主鍵。以 pg_constraint 檢查單欄主鍵再換，重跑安全。
  alterIgnore(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'line_bot_states' AND c.contype = 'p' AND array_length(c.conkey, 1) = 1
  ) THEN
    ALTER TABLE line_bot_states DROP CONSTRAINT line_bot_states_pkey;
    ALTER TABLE line_bot_states ADD CONSTRAINT line_bot_states_pkey PRIMARY KEY (line_user_id, ledger_id);
  END IF;
END $$`);

  db.run(`CREATE TABLE IF NOT EXISTS line_expense_reminders (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    freq            TEXT    NOT NULL,
    hour            INTEGER NOT NULL DEFAULT 21,
    minute          INTEGER NOT NULL DEFAULT 0,
    weekday         INTEGER NOT NULL DEFAULT 0,
    day_of_month    INTEGER NOT NULL DEFAULT 1,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        INTEGER NOT NULL DEFAULT 0,
    last_summary    TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )`);
  alterIgnore(
    "ALTER TABLE line_expense_reminders ADD COLUMN minute INTEGER NOT NULL DEFAULT 0",
  );
  // issue #281：LINE 支出提醒同樣綁定帳本，寄送前重新確認成員身分。
  alterIgnore(
    "ALTER TABLE line_expense_reminders ADD COLUMN ledger_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "UPDATE line_expense_reminders SET ledger_id = 'personal:' || user_id WHERE ledger_id = ''",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_line_expense_reminders_user ON line_expense_reminders(user_id)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_line_expense_reminders_enabled_freq ON line_expense_reminders(enabled, freq)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS stock_settings (
    user_id TEXT PRIMARY KEY,
    fee_rate NUMERIC DEFAULT 0.001425,
    fee_discount NUMERIC DEFAULT 1,
    fee_min_lot INTEGER DEFAULT 20,
    fee_min_odd INTEGER DEFAULT 1,
    sell_tax_rate_stock NUMERIC DEFAULT 0.003,
    sell_tax_rate_etf NUMERIC DEFAULT 0.001,
    sell_tax_rate_warrant NUMERIC DEFAULT 0.001,
    sell_tax_min INTEGER DEFAULT 1,
    updated_at INTEGER DEFAULT 0
  )`);

  alterIgnore("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  alterIgnore("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  alterIgnore(
    "ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'",
  );
  alterIgnore("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'");
  alterIgnore("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN line_id TEXT DEFAULT ''");
  // Local password authentication is retired. Keep the legacy column for
  // schema compatibility, but disable it for every existing account.
  alterIgnore("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 0");
  alterIgnore(
    "UPDATE users SET has_password = 0 WHERE COALESCE(has_password, 0) <> 0",
  );
  alterIgnore("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0");
  alterIgnore(
    "ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'",
  );
  alterIgnore("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
  // 管理員層級：'super' = 超級管理員（完整權限）、'readonly' = 一般管理員（僅讀取）。
  // 預設 'super'，使既有管理員升級後仍保有完整權限，不需資料遷移。僅在 is_admin=1 時有意義。
  alterIgnore("ALTER TABLE users ADD COLUMN admin_role TEXT DEFAULT 'super'");

  // 若 DB 有用戶但無管理員（is_admin 欄位以 DEFAULT 0 加入時既有用戶遺失管理員身份），
  // 自動將最早註冊的用戶升為管理員，確保系統可存取。
  try {
    const adminCheck = db.exec(
      "SELECT id FROM users WHERE is_admin = 1 LIMIT 1",
    );
    const hasAdmin = adminCheck.length > 0 && adminCheck[0].values.length > 0;
    if (!hasAdmin) {
      db.run(
        "UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY created_at NULLS LAST, id LIMIT 1)",
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[db] admin backfill skipped:", (error as Error).message);
    }
  }

  alterIgnore("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN balance NUMERIC DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE accounts ADD COLUMN category TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE accounts ADD COLUMN exclude_from_total INTEGER DEFAULT 0",
  );
  alterIgnore("ALTER TABLE accounts ADD COLUMN linked_bank_id TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE accounts ADD COLUMN overseas_fee_rate NUMERIC DEFAULT 0",
  );
  alterIgnore("ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE accounts ADD COLUMN statement_closing_day INTEGER DEFAULT NULL",
  );
  alterIgnore("ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'TWD'");

  // 區分手動／自動匯率：手動輸入或「立即同步」回填皆會用到此欄。
  alterIgnore(
    "ALTER TABLE exchange_rates ADD COLUMN is_manual INTEGER DEFAULT 0",
  );

  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''",
  );
  // 既有 SQLite / PostgreSQL schema 曾使用 `to_account_id`，目前唯一欄位為
  // `transfer_to_account_id`。若舊欄存在，將既有轉帳目的帳戶回填至 canonical 欄位；
  // 新 PostgreSQL schema 沒有舊欄時略過。所有新寫入與讀取統一使用 transfer_to_account_id。
  const transactionColumnRows = db.exec(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'transactions'",
  );
  const transactionColumns = new Set(
    (transactionColumnRows[0]?.values ?? []).map((row) => String(row[0])),
  );
  if (transactionColumns.has('to_account_id')) {
    db.run(
      "UPDATE transactions SET transfer_to_account_id = to_account_id WHERE COALESCE(transfer_to_account_id, '') = '' AND COALESCE(to_account_id, '') != ''",
    );
  }
  alterIgnore("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'");
  alterIgnore("ALTER TABLE transactions ADD COLUMN fx_fee NUMERIC DEFAULT 0");
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN twd_amount NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN exclude_from_stats INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN is_fx_fee INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'TWD'",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN ai_created INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN note_ai_modified INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN pre_ai_note TEXT NOT NULL DEFAULT ''",
  );
  // 006-credit-card-total-repayment：還款摘要外鍵（非還款交易恆為 ''）
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN repayment_summary_id TEXT DEFAULT ''",
  );
  // 007-pwa-offline-entry：離線記帳的 idempotency key（線上建立恆為 ''）。
  // 伺服器以 (user_id, client_ref) 唯一索引去重，離線佇列恢復連線後重送不會產生重複交易。
  alterIgnore(
    "ALTER TABLE transactions ADD COLUMN client_ref TEXT NOT NULL DEFAULT ''",
  );
  // 唯一索引不能透過 alterIgnore 建立：alterIgnore 會吞掉所有錯誤（假設是「已存在」），
  // 但這個索引是離線重送去重的唯一後盾。若它因故建立失敗，就必須讓啟動失敗而非靜默略過，
  // 否則重送會悄悄產生重複交易。改為先嘗試建立，失敗時以 pg_indexes 確認索引確實存在，
  // 「已存在」才視為成功，其餘一律往外拋。
  try {
    db.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_client_ref ON transactions(user_id, client_ref) WHERE client_ref != ''",
    );
  } catch (indexError) {
    const indexRows = db.exec(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_client_ref'",
    );
    const indexDef = String(indexRows[0]?.values?.[0]?.[0] ?? '');
    const validIndex =
      /CREATE UNIQUE INDEX/i.test(indexDef) &&
      /\(user_id, client_ref\)/i.test(indexDef) &&
      /WHERE.*client_ref/i.test(indexDef);
    if (!validIndex) throw indexError;
  }
  alterIgnore(`UPDATE transactions SET ai_created = 1
    WHERE ai_created = 0 AND id IN (
      SELECT (metadata::jsonb->>'transaction_id')
      FROM data_operation_audit_log
      WHERE action = 'mcp_create_transaction'
    )`);
  alterIgnore(`UPDATE transactions SET ai_created = 1
    WHERE ai_created = 0 AND id IN (
      SELECT linked_id FROM transactions WHERE ai_created = 1 AND linked_id != ''
    )`);

  alterIgnore("ALTER TABLE recurring ADD COLUMN fx_fee NUMERIC DEFAULT 0");
  alterIgnore(
    "ALTER TABLE recurring ADD COLUMN exclude_from_stats INTEGER DEFAULT 0",
  );
  alterIgnore("ALTER TABLE recurring ADD COLUMN currency TEXT DEFAULT 'TWD'");

  alterIgnore("ALTER TABLE budgets ADD COLUMN year_month TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE budgets ADD COLUMN created_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE budgets ADD COLUMN updated_at INTEGER DEFAULT 0");

  // Some legacy PostgreSQL deployments were created from an incomplete stock
  // schema. Ensure the columns used by the numeric-type migration exist before
  // attempting ALTER COLUMN ... TYPE below; CREATE TABLE IF NOT EXISTS does not
  // add missing columns to an already-existing table.
  alterIgnore("ALTER TABLE stocks ADD COLUMN shares NUMERIC DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN market TEXT DEFAULT 'TW'");
  alterIgnore(
    "UPDATE stocks SET market = 'TW' WHERE market IS NULL OR market = ''",
  );
  alterIgnore("ALTER TABLE stocks ADD COLUMN current_price NUMERIC DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN avg_cost NUMERIC DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN stock_type TEXT DEFAULT 'stock'");
  alterIgnore("ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN currency TEXT DEFAULT 'TWD'");

  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN shares NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN account_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN realized_pl NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN tax_auto_calculated INTEGER DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN recurring_plan_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN period_start_date TEXT DEFAULT ''",
  );
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_tx_recurring_period ON stock_transactions(user_id, recurring_plan_id, period_start_date) WHERE recurring_plan_id != '' AND period_start_date != ''",
  );
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN amount NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN frequency TEXT DEFAULT 'monthly'",
  );
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN start_date TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN account_id TEXT DEFAULT ''",
  );
  alterIgnore("ALTER TABLE stock_recurring ADD COLUMN note TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN last_generated TEXT DEFAULT NULL",
  );
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN updated_at INTEGER DEFAULT 0",
  );
  alterIgnore("ALTER TABLE stock_recurring ADD COLUMN freq TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN shares NUMERIC DEFAULT 0",
  );
  alterIgnore("ALTER TABLE stock_recurring ADD COLUMN price NUMERIC DEFAULT 0");
  alterIgnore(
    "ALTER TABLE stock_recurring ADD COLUMN next_date TEXT DEFAULT ''",
  );
  alterIgnore("ALTER TABLE stock_recurring ALTER COLUMN freq DROP NOT NULL");
  alterIgnore("ALTER TABLE stock_recurring ALTER COLUMN shares DROP NOT NULL");
  alterIgnore(
    "ALTER TABLE stock_recurring ALTER COLUMN frequency SET DEFAULT 'monthly'",
  );
  alterIgnore(
    "UPDATE stock_recurring SET frequency = COALESCE(NULLIF(frequency, ''), NULLIF(freq, ''), 'monthly') WHERE frequency IS NULL OR frequency = ''",
  );
  alterIgnore(
    "UPDATE stock_recurring SET start_date = COALESCE(NULLIF(start_date, ''), NULLIF(next_date, ''), '') WHERE start_date IS NULL OR start_date = ''",
  );
  alterIgnore(
    "UPDATE stock_recurring SET amount = COALESCE(NULLIF(amount, 0), COALESCE(shares, 0) * COALESCE(price, 0), 0) WHERE amount IS NULL OR amount <= 0",
  );
  alterIgnore(
    "UPDATE stock_recurring SET updated_at = COALESCE(NULLIF(updated_at, 0), created_at, 0) WHERE updated_at IS NULL OR updated_at = 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN shares NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN cash_dividend NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN stock_dividend_shares NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN account_id TEXT DEFAULT ''",
  );
  // issue #263：現股當沖標記（證券交易稅條例第 2 條之 2）與股利再投資（DRIP）欄位。
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN day_trade INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_transactions ADD COLUMN linked_dividend_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN reinvest INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN reinvest_shares NUMERIC DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE stock_dividends ADD COLUMN reinvest_price NUMERIC DEFAULT 0",
  );
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN id TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN user_id TEXT DEFAULT ''",
  );
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN email TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN login_at INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN ip_address TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN login_method TEXT DEFAULT 'password'",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN is_admin_login INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN country TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN user_agent TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_audit_logs ADD COLUMN device_id TEXT DEFAULT ''",
  );
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN id TEXT DEFAULT ''");
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN user_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN email TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN login_at INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN ip_address TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN login_method TEXT DEFAULT 'password'",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN is_admin_login INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN is_success INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN failure_reason TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN country TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN user_agent TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_attempt_logs ADD COLUMN device_id TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE login_sessions ADD COLUMN device_id TEXT DEFAULT ''",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER DEFAULT 0,
    expires_at INTEGER DEFAULT 0,
    revoked_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_credentials_user ON mcp_credentials(user_id, revoked_at)",
  );
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_credentials_hash ON mcp_credentials(token_hash)",
  );
  alterIgnore(
    "ALTER TABLE mcp_credentials ADD COLUMN allow_create INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE mcp_credentials ADD COLUMN allow_update_note INTEGER NOT NULL DEFAULT 0",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_id_issued_at INTEGER NOT NULL,
    redirect_uris TEXT NOT NULL,
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    client_secret_hash TEXT DEFAULT '',
    client_secret_expires_at INTEGER DEFAULT 0,
    jwks_uri TEXT DEFAULT '',
    token_endpoint_auth_signing_alg TEXT DEFAULT '',
    grant_types TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    response_types TEXT NOT NULL DEFAULT '["code"]',
    client_name TEXT NOT NULL,
    client_uri TEXT DEFAULT '',
    logo_uri TEXT DEFAULT '',
    scope TEXT NOT NULL DEFAULT 'mcp:read',
    created_at INTEGER NOT NULL
  )`);
  alterIgnore(
    "ALTER TABLE mcp_oauth_clients ADD COLUMN client_secret_hash TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE mcp_oauth_clients ADD COLUMN client_secret_expires_at INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE mcp_oauth_clients ADD COLUMN jwks_uri TEXT DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE mcp_oauth_clients ADD COLUMN token_endpoint_auth_signing_alg TEXT DEFAULT ''",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_created ON mcp_oauth_clients(created_at)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_oauth_client_assertions (
    client_id TEXT NOT NULL,
    jti TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (client_id, jti)
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_assertions_expires ON mcp_oauth_client_assertions(expires_at)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_oauth_authorization_codes (
    code_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    resource TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_user ON mcp_oauth_authorization_codes(user_id, expires_at)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_client ON mcp_oauth_authorization_codes(client_id, expires_at)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    token_type TEXT NOT NULL,
    family_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    resource TEXT NOT NULL,
    scope TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER DEFAULT 0,
    replaced_by_hash TEXT DEFAULT '',
    last_used_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(user_id, revoked_at, expires_at)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_family ON mcp_oauth_tokens(family_id, revoked_at)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_client ON mcp_oauth_tokens(client_id, expires_at)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS mcp_oauth_connections (
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    allow_create INTEGER NOT NULL DEFAULT 0,
    allow_update_note INTEGER NOT NULL DEFAULT 0,
    first_connected_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, client_id)
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_oauth_connections_user ON mcp_oauth_connections(user_id)",
  );
  alterIgnore(
    "ALTER TABLE mcp_oauth_connections ADD COLUMN allow_update_note INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(`INSERT INTO mcp_oauth_connections (user_id, client_id, client_name, allow_create, first_connected_at, last_used_at)
    SELECT user_id, client_id, MIN(client_name), 0, MIN(issued_at), MAX(issued_at)
    FROM mcp_oauth_tokens
    WHERE revoked_at = 0
    GROUP BY user_id, client_id
    ON CONFLICT (user_id, client_id) DO NOTHING`);

  db.run(`CREATE TABLE IF NOT EXISTS mcp_transaction_idempotency (
    id TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL,
    ledger_id TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    linked_transaction_id TEXT DEFAULT '',
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  // issue #281：冪等鍵改以「憑證＋帳本」為範圍，同一憑證在不同帳本可用相同鍵。
  // 既有資料列全部來自個人帳本，先回填 ledger_id 再換掉舊的唯一索引，否則部署後
  // 重送同一個冪等鍵會因比對不到而重複建立交易。
  alterIgnore(
    "ALTER TABLE mcp_transaction_idempotency ADD COLUMN ledger_id TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "UPDATE mcp_transaction_idempotency SET ledger_id = 'personal:' || user_id WHERE ledger_id = ''",
  );
  alterIgnore(
    "DROP INDEX IF EXISTS idx_mcp_idempotency_key",
  );
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_idempotency_key ON mcp_transaction_idempotency(credential_id, ledger_id, idempotency_key)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_mcp_idempotency_expires ON mcp_transaction_idempotency(expires_at)",
  );

  // 006-credit-card-total-repayment：信用卡總金額還款的分配快照（FR-020a、FR-020b）。
  // 無任何資料回填或歷史重算（FR-019c）；部署啟動自動套用。
  db.run(`CREATE TABLE IF NOT EXISTS credit_card_repayment_summaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    from_account_id TEXT NOT NULL,
    from_account_name TEXT NOT NULL,
    from_currency TEXT NOT NULL,
    total_amount NUMERIC NOT NULL CHECK (total_amount > 0 AND total_amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    input_mode TEXT NOT NULL DEFAULT 'total',
    allocations TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_ccr_summaries_user ON credit_card_repayment_summaries(user_id)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_transactions_repayment_summary ON transactions(repayment_summary_id) WHERE repayment_summary_id != ''",
  );

  // 目標儲蓄與還款計畫（issue #260）：追蹤「為某個目標存錢」與「負債攤還」進度。
  // 綁定來源二選一（帳戶餘額／分類支出累計）或皆不綁定；目標金額與攤還欄位一律
  // 以使用者基準幣別（TWD）為單位，故不需額外幣別欄位。
  db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL CHECK (target_amount > 0 AND target_amount::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    target_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    account_id TEXT DEFAULT '',
    category_id TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id, created_at)",
  );

  db.run(`CREATE TABLE IF NOT EXISTS repayment_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    principal NUMERIC NOT NULL CHECK (principal > 0 AND principal::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    annual_rate NUMERIC NOT NULL DEFAULT 0 CHECK (annual_rate >= 0 AND annual_rate::text NOT IN ('NaN', 'Infinity', '-Infinity')),
    periods INTEGER NOT NULL CHECK (periods > 0),
    start_date TEXT NOT NULL,
    account_id TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_repayment_plans_user ON repayment_plans(user_id, start_date)",
  );

  // 008-api-token-webhook：第三方自動化整合用的 API Token 與 Webhook 訂閱（issue #258）。
  // Token 只存雜湊（token_hash，不可逆）；Webhook 簽章密鑰需於投遞時取回明文計算 HMAC，
  // 故以 AES-256-GCM 加密後存於 secret_encrypted（見 lib/apiTokenCore.ts 的設計取捨）。
  db.run(`CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL DEFAULT '',
    scopes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_used_at INTEGER DEFAULT 0,
    expires_at INTEGER DEFAULT 0,
    revoked_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id, revoked_at)",
  );
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash)",
  );
  // 既有部署（早於本功能）不會有 token_prefix 欄位，於啟動時冪等補上。
  alterIgnore(
    "ALTER TABLE api_tokens ADD COLUMN token_prefix TEXT NOT NULL DEFAULT ''",
  );

  db.run(`CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    secret_prefix TEXT NOT NULL DEFAULT '',
    events TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_success_at INTEGER DEFAULT 0,
    last_failure_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON webhook_subscriptions(user_id, active)",
  );
  alterIgnore(
    "ALTER TABLE webhook_subscriptions ADD COLUMN secret_prefix TEXT NOT NULL DEFAULT ''",
  );

  // 投遞紀錄：保留每次嘗試的結果供使用者查詢（issue #258 驗收條件 4）。
  // request_body／response_body 皆截斷儲存，避免無界成長。
  db.run(`CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_status_code INTEGER DEFAULT 0,
    last_error TEXT DEFAULT '',
    response_body TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    next_retry_at INTEGER DEFAULT 0,
    delivered_at INTEGER DEFAULT 0
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id, created_at)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user ON webhook_deliveries(user_id, created_at)",
  );
  // 重試掃描只找待重試且已到排程時間的列。
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(status, next_retry_at)",
  );

  // 009-web-push：Web Push（VAPID）推播通知（issue #257）。
  // 訂閱端點由瀏覽器 push service 簽發，同一裝置重新訂閱會換新端點，故以 endpoint 為
  // 唯一鍵（UNIQUE）讓重複訂閱直接覆蓋；失效端點（push service 回 404/410）由發送端刪除。
  db.run(`CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_success_at INTEGER DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    disabled_at INTEGER DEFAULT 0,
    CONSTRAINT web_push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  alterIgnore(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_web_push_subscriptions_endpoint ON web_push_subscriptions(endpoint)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user ON web_push_subscriptions(user_id, disabled_at)",
  );
  alterIgnore(
    "ALTER TABLE web_push_subscriptions ADD COLUMN user_agent TEXT NOT NULL DEFAULT ''",
  );
  alterIgnore(
    "ALTER TABLE web_push_subscriptions ADD COLUMN last_success_at INTEGER DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE web_push_subscriptions ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE web_push_subscriptions ADD COLUMN disabled_at INTEGER DEFAULT 0",
  );

  // 推播去重紀錄（比照 monthly_report_send_log 的「先 INSERT、UNIQUE 衝突即跳過」設計）。
  // 同一使用者 + 同一通知種類 + 同一事件鍵只會成功寫入一次，event_key 由事件本身決定
  // （帳單週期、預算年月、股利列 id），因此不會因重複觸發而重複推播。
  db.run(`CREATE TABLE IF NOT EXISTS web_push_send_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('bill_due','budget_exceeded','dividend')),
    event_key TEXT NOT NULL,
    sent_at_utc TEXT NOT NULL,
    send_status TEXT NOT NULL DEFAULT 'success' CHECK(send_status IN ('success','failed')),
    delivered INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    UNIQUE(user_id, category, event_key),
    CONSTRAINT web_push_send_log_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_web_push_send_log_user ON web_push_send_log(user_id, category, sent_at_utc DESC)",
  );
  alterIgnore(
    "ALTER TABLE web_push_send_log ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0",
  );
  alterIgnore(
    "ALTER TABLE web_push_send_log ADD COLUMN error_message TEXT NOT NULL DEFAULT ''",
  );

  // 各通知種類的開關（預設全開；關閉後該種類不再推播，Email／LINE 管道不受影響）。
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN push_bill_due INTEGER NOT NULL DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN push_budget_exceeded INTEGER NOT NULL DEFAULT 1",
  );
  alterIgnore(
    "ALTER TABLE user_settings ADD COLUMN push_dividend INTEGER NOT NULL DEFAULT 1",
  );

  // Single-owner lease for the Node-runtime Web Push sweep (issue #257). The row-level
  // conditional UPDATE lets multiple app instances coordinate without holding a DB
  // transaction open across network requests; stale leases expire after process crashes.
  db.run(`CREATE TABLE IF NOT EXISTS web_push_scheduler_locks (
    lock_name TEXT PRIMARY KEY,
    lock_owner TEXT NOT NULL DEFAULT '',
    lock_until INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(
    "INSERT INTO web_push_scheduler_locks (lock_name, lock_owner, lock_until) VALUES ('event-scan', '', 0) ON CONFLICT (lock_name) DO NOTHING",
  );

  // Store only the public VAPID key as a cluster consistency marker. Multi-replica
  // deployments that accidentally generate different per-volume keys fail closed on the
  // non-canonical replica instead of accepting subscriptions that another replica cannot send.
  db.run(`CREATE TABLE IF NOT EXISTS web_push_vapid_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    public_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // ── 雲端發票／載具自動匯入整合（issue #253）──
  //
  // 手機條碼載具綁定：與本功能相關的憑證（驗證碼）以 AES-256-GCM 加密後
  // 存放，主金鑰取自環境變數（見 lib/einvoiceSecret.ts）。發票號碼同時是查詢
  // 條件與去重鍵，故只保存遮罩後的前 4 碼（carrier_barcode_masked）供顯示。
  db.run(`CREATE TABLE IF NOT EXISTS invoice_carriers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    carrier_barcode TEXT NOT NULL,
    carrier_barcode_masked TEXT NOT NULL DEFAULT '',
    verify_code_encrypted TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
    auto_sync INTEGER NOT NULL DEFAULT 1,
    last_sync_at INTEGER DEFAULT 0,
    last_sync_status TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT '',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER DEFAULT 0,
    last_sync_retryable INTEGER NOT NULL DEFAULT 1,
    sync_lock_until INTEGER NOT NULL DEFAULT 0,
    last_invoice_date TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, carrier_barcode),
    CONSTRAINT invoice_carriers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_invoice_carriers_user ON invoice_carriers(user_id, status)",
  );
  // `sync_lock_until` 是原子同步租約，避免同一載具被手動／排程併發查詢；
  // 過期租約可於程序中止後回收，退避期間的請求也會被條件更新擋下。
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_invoice_carriers_pending ON invoice_carriers(status, next_retry_at)",
  );
  // 既有部署（早於排程同步）不會有 auto_sync 欄位，於啟動時冪等補上。
  alterIgnore(
    "ALTER TABLE invoice_carriers ADD COLUMN auto_sync INTEGER NOT NULL DEFAULT 1",
  );
  // 非重試錯誤（如 401/403）不再由排程自動觸發；手動同步仍可明確重試。
  alterIgnore(
    "ALTER TABLE invoice_carriers ADD COLUMN last_sync_retryable INTEGER NOT NULL DEFAULT 1",
  );
  // 單一載具只允許一個同步請求；短租約於程序中止時自動到期。
  alterIgnore(
    "ALTER TABLE invoice_carriers ADD COLUMN sync_lock_until INTEGER NOT NULL DEFAULT 0",
  );

  // 匯入的雲端發票：以 (user_id, invoice_number) 為唯一鍵去重，
  // 重複匯入（同一張發票再次被拉取）不會產生第二列。
  // `status` 保留草稿／已匯入／已略過，`transaction_id` 指向確認入帳後產生的交易。
  db.run(`CREATE TABLE IF NOT EXISTS invoice_imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    carrier_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    invoice_time TEXT NOT NULL DEFAULT '',
    seller_name TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','imported','dismissed')),
    transaction_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    imported_at INTEGER DEFAULT 0,
    UNIQUE(user_id, invoice_number),
    CONSTRAINT invoice_imports_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_invoice_imports_user_date ON invoice_imports(user_id, invoice_date DESC, invoice_time DESC)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_invoice_imports_status ON invoice_imports(user_id, status)",
  );
  alterIgnore(
    "CREATE INDEX IF NOT EXISTS idx_invoice_imports_carrier ON invoice_imports(carrier_id, invoice_date DESC)",
  );

  // REAL/DOUBLE PRECISION 會在 PostgreSQL 以 float4/float8 儲存金額，
  // 大額或多次換算可能產生不可逆的四捨五入。新表使用 NUMERIC；
  // 既有部署在此冪等轉型，保留資料值但避免後續再以二進位浮點儲存。
  const numericTypeMigrations = [
    "ALTER TABLE accounts ALTER COLUMN initial_balance TYPE NUMERIC USING initial_balance::numeric",
    "ALTER TABLE accounts ALTER COLUMN balance TYPE NUMERIC USING balance::numeric",
    "ALTER TABLE accounts ALTER COLUMN overseas_fee_rate TYPE NUMERIC USING overseas_fee_rate::numeric",
    "ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC USING amount::numeric",
    "ALTER TABLE transactions ALTER COLUMN original_amount TYPE NUMERIC USING original_amount::numeric",
    "ALTER TABLE transactions ALTER COLUMN fx_fee TYPE NUMERIC USING fx_fee::numeric",
    "ALTER TABLE transactions ALTER COLUMN twd_amount TYPE NUMERIC USING twd_amount::numeric",
    "ALTER TABLE budgets ALTER COLUMN amount TYPE NUMERIC USING amount::numeric",
    "ALTER TABLE recurring ALTER COLUMN amount TYPE NUMERIC USING amount::numeric",
    "ALTER TABLE recurring ALTER COLUMN fx_fee TYPE NUMERIC USING fx_fee::numeric",
    "ALTER TABLE stocks ALTER COLUMN shares TYPE NUMERIC USING shares::numeric",
    "ALTER TABLE stocks ALTER COLUMN avg_cost TYPE NUMERIC USING avg_cost::numeric",
    "ALTER TABLE stocks ALTER COLUMN current_price TYPE NUMERIC USING current_price::numeric",
    "ALTER TABLE stock_transactions ALTER COLUMN shares TYPE NUMERIC USING shares::numeric",
    "ALTER TABLE stock_transactions ALTER COLUMN price TYPE NUMERIC USING price::numeric",
    "ALTER TABLE stock_transactions ALTER COLUMN fee TYPE NUMERIC USING fee::numeric",
    "ALTER TABLE stock_transactions ALTER COLUMN tax TYPE NUMERIC USING tax::numeric",
    "ALTER TABLE stock_transactions ALTER COLUMN realized_pl TYPE NUMERIC USING realized_pl::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN amount TYPE NUMERIC USING amount::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN shares TYPE NUMERIC USING shares::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN cash_dividend TYPE NUMERIC USING cash_dividend::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN stock_dividend_shares TYPE NUMERIC USING stock_dividend_shares::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN reinvest_shares TYPE NUMERIC USING reinvest_shares::numeric",
    "ALTER TABLE stock_dividends ALTER COLUMN reinvest_price TYPE NUMERIC USING reinvest_price::numeric",
    "ALTER TABLE stock_recurring ALTER COLUMN amount TYPE NUMERIC USING amount::numeric",
    "ALTER TABLE stock_recurring ALTER COLUMN shares TYPE NUMERIC USING shares::numeric",
    "ALTER TABLE stock_recurring ALTER COLUMN price TYPE NUMERIC USING price::numeric",
    "ALTER TABLE stock_month_close_prices ALTER COLUMN close_price TYPE NUMERIC USING close_price::numeric",
    "ALTER TABLE stock_settings ALTER COLUMN fee_rate TYPE NUMERIC USING fee_rate::numeric",
    "ALTER TABLE stock_settings ALTER COLUMN fee_discount TYPE NUMERIC USING fee_discount::numeric",
    "ALTER TABLE stock_settings ALTER COLUMN sell_tax_rate_stock TYPE NUMERIC USING sell_tax_rate_stock::numeric",
    "ALTER TABLE stock_settings ALTER COLUMN sell_tax_rate_etf TYPE NUMERIC USING sell_tax_rate_etf::numeric",
    "ALTER TABLE stock_settings ALTER COLUMN sell_tax_rate_warrant TYPE NUMERIC USING sell_tax_rate_warrant::numeric",
    "ALTER TABLE credit_card_repayment_summaries ALTER COLUMN total_amount TYPE NUMERIC USING total_amount::numeric",
  ];
  for (const sql of numericTypeMigrations) db.run(sql);

  // Existing databases may already contain historical invalid rows. NOT VALID
  // lets PostgreSQL enforce these rules for every new INSERT/UPDATE immediately;
  // a later maintenance migration can validate old rows after remediation.
  const addCheck = (sql: string): void => {
    try {
      db.run(sql);
    } catch {
      /* idempotent */
    }
  };
  addCheck(
    "ALTER TABLE transactions ADD CONSTRAINT transactions_amount_nonnegative CHECK (amount >= 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE transactions ADD CONSTRAINT transactions_original_amount_nonnegative CHECK (original_amount >= 0 AND original_amount::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE transactions ADD CONSTRAINT transactions_fx_fee_nonnegative CHECK (fx_fee >= 0 AND fx_fee::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE transactions ADD CONSTRAINT transactions_twd_amount_nonnegative CHECK (twd_amount >= 0 AND twd_amount::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE accounts ADD CONSTRAINT accounts_initial_balance_finite CHECK (initial_balance::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE accounts ADD CONSTRAINT accounts_overseas_fee_rate_valid CHECK (overseas_fee_rate IS NULL OR (overseas_fee_rate >= 0 AND overseas_fee_rate <= 100 AND overseas_fee_rate::text NOT IN ('NaN','Infinity','-Infinity'))) NOT VALID",
  );
  addCheck(
    "ALTER TABLE transactions ADD CONSTRAINT transactions_type_valid CHECK (type IN ('income','expense','transfer_in','transfer_out')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_values_nonnegative CHECK (shares > 0 AND price >= 0 AND fee >= 0 AND tax >= 0 AND shares::text NOT IN ('NaN','Infinity','-Infinity') AND price::text NOT IN ('NaN','Infinity','-Infinity') AND fee::text NOT IN ('NaN','Infinity','-Infinity') AND tax::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_dividends ADD CONSTRAINT stock_dividends_values_nonnegative CHECK (amount >= 0 AND shares >= 0 AND cash_dividend >= 0 AND stock_dividend_shares >= 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity') AND shares::text NOT IN ('NaN','Infinity','-Infinity') AND cash_dividend::text NOT IN ('NaN','Infinity','-Infinity') AND stock_dividend_shares::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_recurring ADD CONSTRAINT stock_recurring_values_nonnegative CHECK (amount >= 0 AND shares >= 0 AND price >= 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity') AND shares::text NOT IN ('NaN','Infinity','-Infinity') AND price::text NOT IN ('NaN','Infinity','-Infinity')) NOT VALID",
  );
  addCheck(
    "ALTER TABLE monthly_report_send_log ADD CONSTRAINT monthly_report_send_log_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE web_push_subscriptions ADD CONSTRAINT web_push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE web_push_send_log ADD CONSTRAINT web_push_send_log_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE invoice_carriers ADD CONSTRAINT invoice_carriers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE invoice_imports ADD CONSTRAINT invoice_imports_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_dividends ADD CONSTRAINT stock_dividends_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE NOT VALID",
  );
  addCheck(
    "ALTER TABLE stock_recurring ADD CONSTRAINT stock_recurring_stock_fk FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE NOT VALID",
  );

  db.run(`CREATE TABLE IF NOT EXISTS financial_ledgers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_owner_id TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
    is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0,1)),
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  db.run("ALTER TABLE financial_ledgers ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'");
  db.run(`CREATE OR REPLACE FUNCTION protect_shared_ledger_owner() RETURNS trigger AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM financial_ledgers WHERE owner_user_id = OLD.id AND is_shared = 1) THEN
        RAISE EXCEPTION 'LEDGER_OWNERSHIP_TRANSFER_REQUIRED';
      END IF;
      RETURN OLD;
    END;
  $$ LANGUAGE plpgsql`);
  db.run("CREATE OR REPLACE TRIGGER protect_shared_ledger_owner BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION protect_shared_ledger_owner()");
  db.run(`CREATE TABLE IF NOT EXISTS ledger_members (
    ledger_id TEXT NOT NULL REFERENCES financial_ledgers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
    joined_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ledger_id, user_id)
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_ledger_members_user ON ledger_members(user_id, ledger_id)",
  );
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_members_owner ON ledger_members(ledger_id) WHERE role = 'owner'");
  db.run(`CREATE TABLE IF NOT EXISTS ledger_invitations (
    id TEXT PRIMARY KEY,
    ledger_id TEXT NOT NULL REFERENCES financial_ledgers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted_at INTEGER NOT NULL DEFAULT 0,
    revoked_at INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_ledger_invitations_pending ON ledger_invitations(ledger_id, expires_at) WHERE accepted_at = 0 AND revoked_at = 0",
  );
  db.run(`CREATE TABLE IF NOT EXISTS ledger_audit_log (
    id TEXT PRIMARY KEY,
    ledger_id TEXT NOT NULL REFERENCES financial_ledgers(id) ON DELETE CASCADE,
    actor_user_id TEXT NOT NULL,
    actor_email TEXT NOT NULL DEFAULT '',
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT '',
    resource_id TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`);
  db.run("ALTER TABLE ledger_audit_log ADD COLUMN IF NOT EXISTS actor_email TEXT NOT NULL DEFAULT ''");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_ledger_audit_log_ledger_time ON ledger_audit_log(ledger_id, created_at DESC)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_ledger_audit_log_actor_time ON ledger_audit_log(actor_user_id, created_at DESC)",
  );

  db.run(`INSERT INTO financial_ledgers
    (id, name, owner_user_id, data_owner_id, is_shared, created_at, updated_at)
    SELECT 'personal:' || id, 'Personal ledger', id, id, 0, 0, 0
    FROM users
    ON CONFLICT (id) DO NOTHING`);
  db.run(`INSERT INTO ledger_members (ledger_id, user_id, role, joined_at)
    SELECT id, owner_user_id, 'owner', created_at
    FROM financial_ledgers
    WHERE is_shared = 0
    ON CONFLICT (ledger_id, user_id) DO NOTHING`);

  // 010-bank-broker-reconciliation（issue #251）：銀行／券商對帳匯入與差異比對。
  // 三張表皆為使用者資料，一律以 user_id 隔離（比照 transactions）；
  // profile 為可重用的欄位對應設定，session 為一次匯入／比對，items 為其差異明細。
  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_import_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'csv',
    config TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_reconciliation_profiles_user ON reconciliation_import_profiles(user_id, updated_at DESC)",
  );
  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ledger_id TEXT NOT NULL DEFAULT '',
    account_id TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL,
    source_format TEXT NOT NULL,
    filename TEXT NOT NULL DEFAULT '',
    profile_id TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'TWD',
    period_start TEXT NOT NULL DEFAULT '',
    period_end TEXT NOT NULL DEFAULT '',
    statement_total INTEGER NOT NULL DEFAULT 0,
    ledger_total INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    ledger_only_count INTEGER NOT NULL DEFAULT 0,
    statement_only_count INTEGER NOT NULL DEFAULT 0,
    amount_mismatch_count INTEGER NOT NULL DEFAULT 0,
    skipped_types TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_user ON reconciliation_sessions(user_id, created_at DESC)",
  );
  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'exact',
    ledger_id TEXT NOT NULL DEFAULT '',
    statement_line INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL DEFAULT 'debit',
    ledger_amount NUMERIC NOT NULL DEFAULT 0,
    statement_amount NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    ledger_description TEXT NOT NULL DEFAULT '',
    statement_description TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_reconciliation_items_session ON reconciliation_items(session_id, kind, date)",
  );
  alterIgnore(
    "ALTER TABLE reconciliation_items ADD COLUMN confidence TEXT NOT NULL DEFAULT 'exact'",
  );

  saveDB();
}
