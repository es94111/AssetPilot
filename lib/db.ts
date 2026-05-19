// lib/db.ts — sql.js 全域單例 + 持久化工具
// 開發模式：globalThis.__sqlDb 防止 HMR 重複初始化
// 生產模式：模組層級 _db（initDB() 負責設值）

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ensureEnvSecrets } from './envSecrets';

ensureEnvSecrets();

// ── sql.js 最小型別宣告（套件本身無 .d.ts）──
interface SqlJsStatement {
  bind(params?: Array<string | number | null | Uint8Array>): void;
  step(): boolean;
  getAsObject(): Record<string, string | number | null>;
  free(): void;
}

export interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  run(sql: string, params?: Array<string | number | null>): void;
  exec(sql: string): Array<{ columns: string[]; values: Array<Array<string | number | null>> }>;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatic {
  Database: new (data?: Uint8Array | number[] | Buffer) => SqlJsDatabase;
}

declare global {
  // eslint-disable-next-line no-var
  var __sqlDb: SqlJsDatabase | undefined;
}

const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY as string;

function getDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'database.db');
}

// ── 加密工具（ChaCha20-Poly1305 AEAD）──
// 格式：MAGIC(4) + SALT(16) + NONCE(12) + AUTH_TAG(16) + ENCRYPTED_DATA
const ENC_MAGIC = Buffer.from('EADB');

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

export function encryptBuffer(plainBuffer: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([ENC_MAGIC, salt, nonce, authTag, encrypted]);
}

export function decryptBuffer(encBuffer: Buffer, passphrase: string): Buffer {
  if (encBuffer.length < 48) throw new Error('加密檔案格式錯誤：檔案太小');
  const magic = encBuffer.subarray(0, 4);
  if (!magic.equals(ENC_MAGIC)) throw new Error('非加密資料庫檔案');
  const salt = encBuffer.subarray(4, 20);
  const nonce = encBuffer.subarray(20, 32);
  const authTag = encBuffer.subarray(32, 48);
  const encrypted = encBuffer.subarray(48);
  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isEncryptedDB(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer)) return false;
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ENC_MAGIC);
}

// ── 非阻塞寫檔（in-flight + pending 合併，tmp+rename 保證原子性）──
let _db: SqlJsDatabase | null = globalThis.__sqlDb ?? null;
let saveInFlight = false;
let savePending = false;

export function saveDB(): void {
  const dbPath = getDbPath();
  if (saveInFlight) { savePending = true; return; }
  saveInFlight = true;
  (async () => {
    try {
      while (true) {
        savePending = false;
        const data = _db!.export();
        const plain = Buffer.from(data);
        const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
        const tmp = dbPath + '.tmp';
        await fs.promises.writeFile(tmp, buf);
        await fs.promises.rename(tmp, dbPath);
        if (!savePending) break;
      }
    } catch (e) {
      console.error('saveDB failed:', (e as Error)?.message ?? e);
    } finally {
      saveInFlight = false;
    }
  })();
}

export function saveDBSync(): void {
  const dbPath = getDbPath();
  const data = _db!.export();
  const plain = Buffer.from(data);
  const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
  fs.writeFileSync(dbPath, buf);
}

export const flushOnExit = (): void => { try { saveDBSync(); } catch { /* noop */ } };

// ── 初始化（含 migrations）──
export async function initDB(): Promise<void> {
  if (_db) return;

  const dbPath = getDbPath();
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    try {
      const { migrateSqliteToPostgresIfNeeded } = await import('./postgresMigration');
      const stats = await migrateSqliteToPostgresIfNeeded({
        dbPath,
        encryptionKey: DB_ENCRYPTION_KEY,
        decryptBuffer,
        isEncryptedDB,
      });
      if (stats?.skipped) {
        console.log('[postgres-migration] PostgreSQL already has this SQLite source hash; skipped');
      } else if (stats) {
        const importedRows = stats.tables.reduce((sum, table) => sum + table.rows, 0);
        console.log(`[postgres-migration] migrated SQLite .db to PostgreSQL: ${stats.tables.length} tables, ${importedRows} rows`);
      }
    } catch (e) {
      console.error('[postgres-migration] SQLite .db to PostgreSQL migration failed:', (e as Error)?.message ?? e);
      if (process.env.POSTGRES_MIGRATION_REQUIRED === '1') process.exit(1);
    }
  }

  const { default: initSqlJs } = await import('sql.js') as unknown as { default: (opts: { locateFile: (f: string) => string }) => Promise<SqlJsStatic> };
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    const encrypted = isEncryptedDB(fileBuffer);

    if (encrypted && !DB_ENCRYPTION_KEY) {
      console.error('錯誤：資料庫已加密但未設定 DB_ENCRYPTION_KEY，無法啟動');
      process.exit(1);
    }

    if (encrypted) {
      try {
        const plain = decryptBuffer(fileBuffer, DB_ENCRYPTION_KEY);
        _db = new SQL.Database(plain);
        console.log('已載入加密資料庫（ChaCha20-Poly1305）');
      } catch (e) {
        console.error('資料庫解密失敗（金鑰可能不正確）:', (e as Error).message);
        process.exit(1);
      }
    } else if (DB_ENCRYPTION_KEY) {
      _db = new SQL.Database(fileBuffer);
      console.log('偵測到未加密資料庫，自動加密中...');
      saveDB();
      console.log('資料庫已自動加密完成');
    } else {
      _db = new SQL.Database(fileBuffer);
    }
  } else {
    _db = new SQL.Database();
    if (DB_ENCRYPTION_KEY) console.log('將使用加密模式儲存新資料庫');
  }

  globalThis.__sqlDb = _db;
  await _runMigrations();
  console.log('資料庫初始化完成');
}

export function getDB(): SqlJsDatabase {
  if (!_db) _db = globalThis.__sqlDb ?? null;
  if (!_db) throw new Error('DB 尚未初始化，請確認 instrumentation.js 已執行');
  return _db;
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

  db.run(`INSERT OR IGNORE INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '')`, [Date.now()]);

  db.run(`CREATE TABLE IF NOT EXISTS report_schedules (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    freq            TEXT    NOT NULL,
    hour            INTEGER NOT NULL DEFAULT 9,
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
    weekday         INTEGER NOT NULL DEFAULT 0,
    day_of_month    INTEGER NOT NULL DEFAULT 1,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        INTEGER NOT NULL DEFAULT 0,
    last_summary    TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )`);
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
      db.run("UPDATE users SET is_admin = 1 WHERE rowid = (SELECT MIN(rowid) FROM users)");
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

  alterIgnore("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'");
  alterIgnore("ALTER TABLE transactions ADD COLUMN fx_fee REAL DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN twd_amount REAL DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN exclude_from_stats INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT ''");

  alterIgnore("ALTER TABLE budgets ADD COLUMN year_month TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE budgets ADD COLUMN created_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE budgets ADD COLUMN updated_at INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE stocks ADD COLUMN current_price REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stocks ADD COLUMN stock_type TEXT DEFAULT 'stock'");

  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN tax_auto_calculated INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN cash_dividend REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN stock_dividend_shares REAL DEFAULT 0");
  alterIgnore("ALTER TABLE stock_dividends ADD COLUMN account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_audit_logs ADD COLUMN country TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE login_attempt_logs ADD COLUMN country TEXT DEFAULT ''");

  // 檢測並進行 fx_rate 類型 migration（REAL → TEXT）
  try {
    const checkTxFxRate = db.exec("SELECT typeof(fx_rate) as type FROM transactions LIMIT 1");
    if (checkTxFxRate.length > 0 && checkTxFxRate[0].values.length > 0 && checkTxFxRate[0].values[0][0] === 'real') {
      console.log('[migration] detected transactions.fx_rate as REAL, starting migration to TEXT...');
      db.run('BEGIN');
      db.run(`CREATE TABLE IF NOT EXISTS transactions_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'TWD',
        original_amount REAL DEFAULT 0,
        fx_rate TEXT DEFAULT '1',
        fx_fee REAL DEFAULT 0,
        twd_amount REAL DEFAULT 0,
        date TEXT NOT NULL,
        category_id TEXT,
        account_id TEXT,
        to_account_id TEXT,
        note TEXT DEFAULT '',
        linked_id TEXT DEFAULT '',
        exclude_from_stats INTEGER DEFAULT 0,
        source_recurring_id TEXT DEFAULT '',
        scheduled_date TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        transfer_to_account_id TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER
      )`);
      db.run(`INSERT INTO transactions_new 
        SELECT id, user_id, type, amount, currency, original_amount, 
               CAST(fx_rate AS TEXT), fx_fee, twd_amount,
               date, category_id, account_id, to_account_id, note, linked_id,
               exclude_from_stats, source_recurring_id, scheduled_date, tags, 
               transfer_to_account_id, created_at, updated_at
        FROM transactions`);
      db.run('DROP TABLE transactions');
      db.run('ALTER TABLE transactions_new RENAME TO transactions');
      db.run(`CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(source_recurring_id) WHERE source_recurring_id IS NOT NULL`);
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_source_scheduled ON transactions(source_recurring_id, scheduled_date) WHERE source_recurring_id IS NOT NULL`);
      db.run('COMMIT');
      console.log('[migration] transactions.fx_rate migration completed');
    }
  } catch (e) {
    console.warn('[migration] transactions.fx_rate migration failed:', e);
  }

  // 檢測並進行 recurring.fx_rate 類型 migration
  try {
    const checkRecurringFxRate = db.exec("SELECT typeof(fx_rate) as type FROM recurring LIMIT 1");
    if (checkRecurringFxRate.length > 0 && checkRecurringFxRate[0].values.length > 0 && checkRecurringFxRate[0].values[0][0] === 'real') {
      console.log('[migration] detected recurring.fx_rate as REAL, starting migration to TEXT...');
      db.run('BEGIN');
      db.run(`CREATE TABLE IF NOT EXISTS recurring_new (
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
      db.run(`INSERT INTO recurring_new 
        SELECT id, user_id, type, amount, currency, CAST(fx_rate AS TEXT),
               category_id, account_id, frequency, start_date, note, is_active,
               last_generated, needs_attention, updated_at, created_at
        FROM recurring`);
      db.run('DROP TABLE recurring');
      db.run('ALTER TABLE recurring_new RENAME TO recurring');
      db.run('COMMIT');
      console.log('[migration] recurring.fx_rate migration completed');
    }
  } catch (e) {
    console.warn('[migration] recurring.fx_rate migration failed:', e);
  }

  // 檢測並進行 exchange_rates.rate_to_twd 類型 migration
  try {
    const checkExchangeRateToTwd = db.exec("SELECT typeof(rate_to_twd) as type FROM exchange_rates LIMIT 1");
    if (checkExchangeRateToTwd.length > 0 && checkExchangeRateToTwd[0].values.length > 0 && checkExchangeRateToTwd[0].values[0][0] === 'real') {
      console.log('[migration] detected exchange_rates.rate_to_twd as REAL, starting migration to TEXT...');
      db.run('BEGIN');
      db.run(`CREATE TABLE IF NOT EXISTS exchange_rates_new (
        user_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        rate_to_twd TEXT NOT NULL,
        updated_at INTEGER,
        PRIMARY KEY (user_id, currency)
      )`);
      db.run(`INSERT INTO exchange_rates_new 
        SELECT user_id, currency, CAST(rate_to_twd AS TEXT), updated_at
        FROM exchange_rates`);
      db.run('DROP TABLE exchange_rates');
      db.run('ALTER TABLE exchange_rates_new RENAME TO exchange_rates');
      db.run('COMMIT');
      console.log('[migration] exchange_rates.rate_to_twd migration completed');
    }
  } catch (e) {
    console.warn('[migration] exchange_rates.rate_to_twd migration failed:', e);
  }

  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  saveDB();
}

export async function replaceDB(uint8Array: Uint8Array): Promise<void> {
  const DatabaseConstructor = (getDB() as unknown as { constructor: SqlJsStatic['Database'] }).constructor;
  if (_db) { try { _db.close(); } catch { /* noop */ } }
  _db = new DatabaseConstructor(uint8Array);
  if (process.env.NODE_ENV !== 'production') globalThis.__sqlDb = _db;
  saveDB();
  await _runMigrations();
}
