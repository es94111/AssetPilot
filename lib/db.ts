// lib/db.ts — PostgreSQL runtime 全域單例
// 開發模式：globalThis.__assetPilotDb 防止 HMR 重複初始化
// 生產模式：模組層級 _db（initDB() 負責設值）

import { ensureEnvSecrets } from './envSecrets';

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
  exec(sql: string): Array<{ columns: string[]; values: Array<Array<string | number | null>> }>;
  getRowsModified(): number;
  close(): void;
}

declare global {
  // eslint-disable-next-line no-var
  var __assetPilotDb: DatabaseLike | undefined;
}

let _db: DatabaseLike | null = globalThis.__assetPilotDb ?? null;

export function saveDB(): void {
  // PostgreSQL commits writes in db.run(); kept for existing call sites.
}

export function saveDBSync(): void {
  // PostgreSQL commits writes in db.run(); kept for shutdown hooks.
}

export const flushOnExit = (): void => {};

// ── 初始化（含 migrations）──
export async function initDB(): Promise<void> {
  if (_db) return;

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('未設定 DATABASE_URL 或 POSTGRES_URL，AssetPilot 現在僅支援 PostgreSQL');
  }

  const { PostgresCompatDatabase } = await import('./postgresRuntime');
  _db = new PostgresCompatDatabase() as unknown as DatabaseLike;
  globalThis.__assetPilotDb = _db;
  await _runMigrations();
  console.log('資料庫初始化完成（PostgreSQL）');
}

export function getDB(): DatabaseLike {
  if (!_db) _db = globalThis.__assetPilotDb ?? null;
  if (!_db) throw new Error('DB 尚未初始化，請確認 instrumentation.js 已執行');
  return _db;
}

export function isPostgresRuntime(): boolean {
  return true;
}

// ── 便利查詢工具 ──
export function queryOne(sql: string, params: Array<string | number | null> = []): Record<string, string | number | null> | null {
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

export function queryAll(sql: string, params: Array<string | number | null> = []): Array<Record<string, string | number | null>> {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Array<Record<string, string | number | null>> = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── Migrations ──
async function _runMigrations(): Promise<void> {
  const db = _db!;

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
    is_admin_login INTEGER DEFAULT 0
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_audit_user_time ON login_audit_logs(user_id, login_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_audit_time ON login_audit_logs(login_at DESC)`);

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_data_audit_user_time ON data_operation_audit_log(user_id, timestamp DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_data_audit_time ON data_operation_audit_log(timestamp DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_data_audit_action ON data_operation_audit_log(action)`);

  db.run(`CREATE TABLE IF NOT EXISTS login_attempt_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT '',
    email TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    login_method TEXT DEFAULT 'password',
    is_admin_login INTEGER DEFAULT 0,
    is_success INTEGER DEFAULT 0,
    failure_reason TEXT DEFAULT ''
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_attempt_time ON login_attempt_logs(login_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_attempt_email_time ON login_attempt_logs(email, login_at DESC)`);

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_sessions_user_active ON login_sessions(user_id, revoked_at, login_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token_hash)`);

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user ON passkey_credentials(user_id)`);

  db.run(`CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    public_registration INTEGER DEFAULT 1,
    allowed_registration_emails TEXT DEFAULT '',
    admin_ip_allowlist TEXT DEFAULT '',
    updated_at INTEGER DEFAULT 0,
    updated_by TEXT DEFAULT ''
  )`);

  const alterIgnore = (sql: string): void => { try { db.run(sql); } catch { /* idempotent */ } };
  alterIgnore("ALTER TABLE system_settings ADD COLUMN admin_ip_allowlist TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_freq TEXT DEFAULT 'off'");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_hour INTEGER DEFAULT 9");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_weekday INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_day_of_month INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_last_run INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_last_summary TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN report_schedule_user_ids TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN server_time_offset INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN audit_log_retention_days TEXT DEFAULT '90'");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN line_login_enabled INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN transaction_photo_storage TEXT DEFAULT ''")
  alterIgnore("ALTER TABLE system_settings ADD COLUMN transaction_photo_max_bytes INTEGER DEFAULT 0")
  // 股價自動更新（伺服器排程；台股交易時段內每 N 分鐘抓 TWSE/TPEx 最新價寫回 stocks.current_price）
  alterIgnore("ALTER TABLE system_settings ADD COLUMN stock_auto_update_enabled INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN stock_auto_update_interval_min INTEGER DEFAULT 10");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN stock_auto_update_last_run INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE system_settings ADD COLUMN stock_auto_update_last_summary TEXT DEFAULT ''");

  db.run(`INSERT INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '') ON CONFLICT DO NOTHING`, [Date.now()]);

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
  alterIgnore("ALTER TABLE report_schedules ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1");
  alterIgnore("ALTER TABLE report_schedules ADD COLUMN notify_line INTEGER NOT NULL DEFAULT 0");
  // 分鐘級排程（day_of_month = 0 代表「每月最後一天」）
  alterIgnore("ALTER TABLE report_schedules ADD COLUMN minute INTEGER NOT NULL DEFAULT 0");
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id)");
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq ON report_schedules(enabled, freq)");

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
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order)");
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_cat_user_type ON categories(user_id, type)");

  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    initial_balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'TWD',
    icon TEXT DEFAULT 'fa-wallet',
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TWD',
    original_amount REAL DEFAULT 0,
    fx_rate TEXT DEFAULT '1',
    date TEXT NOT NULL,
    category_id TEXT,
    account_id TEXT,
    note TEXT DEFAULT '',
    linked_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER
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
    amount REAL NOT NULL,
    period TEXT DEFAULT 'monthly',
    year INTEGER,
    month INTEGER,
    created_at INTEGER,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TWD',
    fx_rate TEXT DEFAULT '1',
    category_id TEXT,
    account_id TEXT,
    frequency TEXT NOT NULL,
    start_date TEXT,
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    last_generated TEXT,
    needs_attention INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    shares REAL DEFAULT 0,
    avg_cost REAL DEFAULT 0,
    currency TEXT DEFAULT 'TWD',
    account_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    type TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    fee REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    amount REAL NOT NULL,
    shares REAL DEFAULT 0,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    freq TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL DEFAULT 0,
    next_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    pinned_currencies TEXT DEFAULT '[]',
    default_currency TEXT DEFAULT 'TWD',
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
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_tx_attachments_tx ON transaction_attachments(user_id, transaction_id, created_at)");
  alterIgnore("ALTER TABLE user_settings ADD COLUMN default_currency TEXT DEFAULT 'TWD'");
  // 使用者語言偏好（多語言）。見 lib/i18n/。預設 zh-TW；排程通知（Email/LINE）亦讀此欄。
  alterIgnore("ALTER TABLE user_settings ADD COLUMN language TEXT DEFAULT 'zh-TW'");

  // 交易憑證照片的每使用者資料金鑰（DEK），已被 PHOTO_MASTER_KEY 包覆。見 lib/photoCrypto.ts。
  db.run(`CREATE TABLE IF NOT EXISTS user_photo_keys (
    user_id TEXT PRIMARY KEY,
    wrapped_dek TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS line_bot_states (
    line_user_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    tx_type TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL
  )`);
  alterIgnore("ALTER TABLE line_bot_states ADD COLUMN payload TEXT DEFAULT '{}'");

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
  alterIgnore("ALTER TABLE line_expense_reminders ADD COLUMN minute INTEGER NOT NULL DEFAULT 0");
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_line_expense_reminders_user ON line_expense_reminders(user_id)");
  alterIgnore("CREATE INDEX IF NOT EXISTS idx_line_expense_reminders_enabled_freq ON line_expense_reminders(enabled, freq)");

  db.run(`CREATE TABLE IF NOT EXISTS stock_settings (
    user_id TEXT PRIMARY KEY,
    fee_rate REAL DEFAULT 0.001425,
    fee_discount REAL DEFAULT 1,
    fee_min_lot INTEGER DEFAULT 20,
    fee_min_odd INTEGER DEFAULT 1,
    sell_tax_rate_stock REAL DEFAULT 0.003,
    sell_tax_rate_etf REAL DEFAULT 0.001,
    sell_tax_rate_warrant REAL DEFAULT 0.001,
    sell_tax_min INTEGER DEFAULT 1,
    updated_at INTEGER DEFAULT 0
  )`);

  alterIgnore("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  alterIgnore("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'");
  alterIgnore("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'");
  alterIgnore("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN line_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'");
  alterIgnore("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");

  // 若 DB 有用戶但無管理員（is_admin 欄位以 DEFAULT 0 加入時既有用戶遺失管理員身份），
  // 自動將最早註冊的用戶升為管理員，確保系統可存取。
  try {
    const adminCheck = db.exec("SELECT id FROM users WHERE is_admin = 1 LIMIT 1");
    const hasAdmin = adminCheck.length > 0 && adminCheck[0].values.length > 0;
    if (!hasAdmin) {
      db.run("UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY created_at NULLS LAST, id LIMIT 1)");
    }
  } catch (_) {}

  alterIgnore("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE accounts ADD COLUMN category TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE accounts ADD COLUMN exclude_from_total INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN linked_bank_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE accounts ADD COLUMN overseas_fee_rate REAL DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE accounts ADD COLUMN statement_closing_day INTEGER DEFAULT NULL");

  // 區分手動／自動匯率：手動輸入或「立即同步」回填皆會用到此欄。
  alterIgnore("ALTER TABLE exchange_rates ADD COLUMN is_manual INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'");
  alterIgnore("ALTER TABLE transactions ADD COLUMN fx_fee REAL DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN twd_amount REAL DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN exclude_from_stats INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN is_fx_fee INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE recurring ADD COLUMN fx_fee REAL DEFAULT 0");
  alterIgnore("ALTER TABLE recurring ADD COLUMN exclude_from_stats INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE budgets ADD COLUMN year_month TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE budgets ADD COLUMN created_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE budgets ADD COLUMN updated_at INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE stocks ADD COLUMN current_price REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN stock_type TEXT DEFAULT 'stock'");
  alterIgnore("ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN tax_auto_calculated INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN recurring_plan_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN period_start_date TEXT DEFAULT ''");
  alterIgnore("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_tx_recurring_period ON stock_transactions(user_id, recurring_plan_id, period_start_date) WHERE recurring_plan_id != '' AND period_start_date != ''");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN cash_dividend REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN stock_dividend_shares REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN user_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN email TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN login_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN ip_address TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN login_method TEXT DEFAULT 'password'");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN is_admin_login INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN country TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN user_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN email TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN login_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN ip_address TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN login_method TEXT DEFAULT 'password'");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN is_admin_login INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN is_success INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN failure_reason TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN country TEXT DEFAULT ''");

  saveDB();
}
