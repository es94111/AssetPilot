// lib/db.ts — sql.js 全域單例 + 持久化工具
// 開發模式：globalThis.__sqlDb 防止 HMR 重複初始化
// 生產模式：模組層級 _db（initDB() 負責設值）

// Next.js 會靜態分析 instrumentation 依賴鏈；用 runtime require 避開 webpack 對 Node 內建模組的解析。
const runtimeRequire = Function('return require')() as NodeRequire;
const path = runtimeRequire('path') as typeof import('path');
const fs = runtimeRequire('fs') as typeof import('fs');
const crypto = runtimeRequire('crypto') as typeof import('crypto');

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

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'database.db');
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '';

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
  if (saveInFlight) { savePending = true; return; }
  saveInFlight = true;
  (async () => {
    try {
      while (true) {
        savePending = false;
        const data = _db!.export();
        const plain = Buffer.from(data);
        const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
        const tmp = DB_PATH + '.tmp';
        await fs.promises.writeFile(tmp, buf);
        await fs.promises.rename(tmp, DB_PATH);
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
  const data = _db!.export();
  const plain = Buffer.from(data);
  const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
  fs.writeFileSync(DB_PATH, buf);
}

export const flushOnExit = (): void => { try { saveDBSync(); } catch { /* noop */ } };

// ── 初始化（含 migrations）──
export async function initDB(): Promise<void> {
  if (_db) return;

  const initSqlJs = runtimeRequire('sql.js') as (opts: { locateFile: (f: string) => string }) => Promise<SqlJsStatic>;
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
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

  db.run(`INSERT OR IGNORE INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '')`, [Date.now()]);

  db.run(`CREATE TABLE IF NOT EXISTS report_schedules (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    freq            TEXT    NOT NULL,
    hour            INTEGER NOT NULL DEFAULT 9,
    weekday         INTEGER NOT NULL DEFAULT 1,
    day_of_month    INTEGER NOT NULL DEFAULT 1,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        INTEGER NOT NULL DEFAULT 0,
    last_summary    TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )`);
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
    fx_rate REAL DEFAULT 1,
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
    rate_to_twd REAL NOT NULL,
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
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TWD',
    category_id TEXT,
    account_id TEXT,
    freq TEXT NOT NULL,
    next_date TEXT,
    is_active INTEGER DEFAULT 1,
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
    updated_at INTEGER
  )`);

  alterIgnore("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  alterIgnore("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'");
  alterIgnore("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'");
  alterIgnore("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'");
  alterIgnore("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0");

  alterIgnore("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'");
  alterIgnore("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1");
  alterIgnore("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0");
  alterIgnore("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''");

  alterIgnore("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''");
  alterIgnore("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'");

  alterIgnore("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");

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
