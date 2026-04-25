// ─── 載入環境變數 ───
// 1. 先載入專案根目錄 .env（本機開發用）
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const os = require('os');
const dgram = require('dgram');
const net = require('net');
const dns = require('dns').promises;
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

// 2. 再載入 data/.env（Docker 持久化密鑰用）
//    Docker 環境中密鑰儲存在 /app/data/.env，必須優先載入
const DATA_ENV_PATH = process.env.ENV_PATH || path.join(__dirname, '.env');
if (fs.existsSync(DATA_ENV_PATH)) {
  require('dotenv').config({ path: DATA_ENV_PATH, override: true });
  console.log(`已載入密鑰檔案: ${DATA_ENV_PATH}`);
}

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { server: webauthnServer } = require('@passwordless-id/webauthn');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// ─── 002 feature: 共用工具模組（T019） ───
const moneyDecimal = require('./lib/moneyDecimal');
const taipeiTime = require('./lib/taipeiTime');
const fxCache = require('./lib/exchangeRateCache');

const app = express();
// 信任反向代理（Nginx / Synology / Docker）傳遞的 X-Forwarded-For 標頭
// 確保 express-rate-limit 能正確識別使用者 IP
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// 將 JWT_EXPIRES 字串（如 7d、24h、30m）轉換為毫秒，供 Cookie maxAge 使用
function parseExpiresMs(str) {
  const match = String(str).match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // 預設 7 天
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 86400 * 1000, w: 7 * 86400 * 1000 };
  return n * multipliers[unit];
}
const JWT_EXPIRES_MS = parseExpiresMs(JWT_EXPIRES);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_HOST = process.env.APP_HOST || 'localhost';
const GOOGLE_OAUTH_REDIRECT_URIS = (process.env.GOOGLE_OAUTH_REDIRECT_URIS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';

const AUDIT_RETENTION_DAYS = 90;
const PRUNE_BATCH = 5000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const COOKIE_MAX_AGE = JWT_EXPIRES_MS;
const SERVER_TIME_OFFSET_MAX = 10 * 365 * 86400 * 1000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
// 對外網址（用於信件 CTA 按鈕），未設定則隱藏「前往儀表板」按鈕
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
let resendClient = null;
function getResendClient() {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

function getSmtpSettingsRaw() {
  const row = queryOne("SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from FROM system_settings WHERE id = 1");
  if (!row) return { host: '', port: 587, secure: 0, user: '', password: '', from: '' };
  return {
    host: row.smtp_host || '',
    port: Number(row.smtp_port) || 587,
    secure: row.smtp_secure ? 1 : 0,
    user: row.smtp_user || '',
    password: row.smtp_password || '',
    from: row.smtp_from || '',
  };
}

let smtpTransporter = null;
let smtpTransporterKey = '';
function getSmtpTransporter() {
  const s = getSmtpSettingsRaw();
  if (!s.host || !s.port) return null;
  const key = `${s.host}|${s.port}|${s.secure}|${s.user}|${s.password}`;
  if (smtpTransporter && smtpTransporterKey === key) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: !!s.secure,
    auth: s.user ? { user: s.user, pass: s.password } : undefined,
  });
  smtpTransporterKey = key;
  return smtpTransporter;
}

// 統一寄信入口：SMTP 優先，否則 Resend，皆未設定回 null
async function sendStatsEmail({ to, subject, html }) {
  const smtp = getSmtpSettingsRaw();
  if (smtp.host && smtp.port) {
    const transporter = getSmtpTransporter();
    const from = smtp.from || smtp.user || 'noreply@localhost';
    const info = await transporter.sendMail({ from, to, subject, html });
    return { provider: 'smtp', id: info.messageId };
  }
  const client = getResendClient();
  if (client && RESEND_FROM_EMAIL) {
    const result = await client.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html });
    if (result?.error) {
      const err = new Error(result.error.message || 'Resend 寄送失敗');
      err.provider = 'resend';
      throw err;
    }
    return { provider: 'resend', id: result?.data?.id || '' };
  }
  return null;
}
const GLOBAL_FX_API_BASE = 'https://v6.exchangerate-api.com/v6';
const GLOBAL_FX_API_KEY = process.env.EXCHANGE_RATE_API_KEY || 'free'; // 免費版 key
const FX_AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;
const IP_COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ipCountryCache = new Map();
const ENV_ADMIN_IP_ALLOWLIST = parseIpAllowlist(process.env.ADMIN_IP_ALLOWLIST || '');

// ─── Origin HTTPS 設定 ───
// SSL_CERT / SSL_KEY → Cloudflare Origin Certificate（當伺服器直接提供 HTTPS 時使用）
const SSL_CERT_PATH     = process.env.SSL_CERT     || path.join(__dirname, 'SSL', 'Origin Certificates', 'server.pem');
const SSL_KEY_PATH      = process.env.SSL_KEY      || path.join(__dirname, 'SSL', 'Origin Certificates', 'server.key');

// ─── 自動產生密鑰（僅首次啟動時） ───
function generateSecret(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

function ensureEnvSecrets() {
  const envPath = DATA_ENV_PATH;
  let envContent = '';
  try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch (e) { /* .env 不存在 */ }

  let changed = false;
  const updates = {};

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'please-change-this-secret') {
    const secret = generateSecret(64);
    updates.JWT_SECRET = secret;
    process.env.JWT_SECRET = secret;
    changed = true;
  }

  if (!process.env.DB_ENCRYPTION_KEY) {
    const key = generateSecret(64);
    updates.DB_ENCRYPTION_KEY = key;
    process.env.DB_ENCRYPTION_KEY = key;
    changed = true;
  }

  if (changed) {
    // 確保目錄存在
    const dir = path.dirname(envPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // 更新或建立 .env 檔案
    const lines = envContent ? envContent.split('\n') : [];
    for (const [k, v] of Object.entries(updates)) {
      const idx = lines.findIndex(l => l.startsWith(k + '='));
      if (idx >= 0) {
        lines[idx] = `${k}=${v}`;
      } else {
        lines.push(`${k}=${v}`);
      }
      console.log(`已自動產生 ${k}（64 字元隨機密鑰）`);
    }
    fs.writeFileSync(envPath, lines.filter(l => l !== '').join('\n') + '\n', { encoding: 'utf-8', mode: 0o600 });
    try { fs.chmodSync(envPath, 0o600); } catch { /* Windows/非 POSIX 系統忽略 */ }
    console.log(`密鑰已寫入 ${envPath}，請妥善備份此檔案`);
  } else {
    console.log('密鑰已從檔案載入（JWT_SECRET + DB_ENCRYPTION_KEY）');
  }
}

ensureEnvSecrets();

// ─── .env 單鍵更新 ───
function setEnvVar(key, value) {
  try {
    let content = '';
    try { content = fs.readFileSync(DATA_ENV_PATH, 'utf-8'); } catch (_) {}
    const lines = content ? content.split('\n') : [];
    const idx = lines.findIndex(l => l.startsWith(key + '='));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    const dir = path.dirname(DATA_ENV_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_ENV_PATH, lines.filter(l => l !== '').join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.error('setEnvVar 失敗:', e.message);
  }
}

// ─── 憑證工具 ───
function getCertInfo(certPath) {
  try {
    if (!fs.existsSync(certPath)) return null;
    const pem = fs.readFileSync(certPath, 'utf-8');
    const cert = new crypto.X509Certificate(pem);
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      fingerprint256: cert.fingerprint256,
    };
  } catch (e) {
    return { error: '憑證格式錯誤：' + e.message };
  }
}

function validatePemCert(pem) {
  return typeof pem === 'string'
    && pem.includes('-----BEGIN CERTIFICATE-----')
    && pem.includes('-----END CERTIFICATE-----');
}

function validatePemKey(pem) {
  return typeof pem === 'string'
    && pem.includes('-----BEGIN')
    && (pem.includes('PRIVATE KEY-----'));
}

// SSL 目錄路徑常數（Origin Certificate）
// SSL_BASE_DIR 預設為專案目錄下的 SSL/，可透過環境變數指定其他路徑（如 Docker Volume）
const SSL_BASE_DIR   = process.env.SSL_PATH || path.join(__dirname, 'SSL');
const SSL_ORIGIN_DIR = path.join(SSL_BASE_DIR, 'Origin Certificates');
const SSL_ORIGIN_CERT = path.join(SSL_ORIGIN_DIR, 'server.pem');
const SSL_ORIGIN_KEY  = path.join(SSL_ORIGIN_DIR, 'server.key');
const SSL_ORIGIN_CA   = path.join(SSL_ORIGIN_DIR, 'cloudflare-origin-ca.pem');

const JWT_SECRET = process.env.JWT_SECRET;
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '';

// ─── 資料庫加密（ChaCha20-Poly1305 AEAD） ───
// 加密檔案格式: MAGIC(4) + SALT(16) + NONCE(12) + AUTH_TAG(16) + ENCRYPTED_DATA
const ENC_MAGIC = Buffer.from('EADB');  // Encrypted Asset DB

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

function encryptBuffer(plainBuffer, passphrase) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([ENC_MAGIC, salt, nonce, authTag, encrypted]);
}

function decryptBuffer(encBuffer, passphrase) {
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

function isEncryptedDB(buffer) {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ENC_MAGIC);
}

// ─── 安全性中介軟體 ───
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null; // null = 不限制（開發模式）

// 取得受信任的 Passkey / WebAuthn origin：只接受白名單內的 Origin header
// 開發模式（未設定 ALLOWED_ORIGINS）回退到 req.protocol + host
function getTrustedOrigin(req) {
  const reqOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0) {
    if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
    return ALLOWED_ORIGINS[0];
  }
  return reqOrigin || `${req.protocol}://${req.headers.host}`;
}

app.use(cors(ALLOWED_ORIGINS ? {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS 不允許的來源'));
  }
} : {}));

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
      // 收斂 CSP：移除 inline <script>，僅保留既有 inline 事件屬性（逐步淘汰）
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://accounts.google.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: [
        "'self'",
        'https://openapi.twse.com.tw',
        'https://mis.twse.com.tw',
        'https://v6.exchangerate-api.com',
        'https://oauth2.googleapis.com',
        'https://www.googleapis.com',
        'https://api.github.com',
        'https://raw.githubusercontent.com',
        'https://codeload.github.com',
      ],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      workerSrc: ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// 認證類 API 速率限制（FR-007 auth 桶：每 IP 每 15 分鐘最多 20 次）
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: '登入嘗試次數過多，請 15 分鐘後再試' },
  skip: (req) => isRequestIpWhitelisted(req),
  validate: { xForwardedForHeader: false }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// 靜態頁桶（FR-007 靜態頁桶：/privacy、/terms；與 auth 桶獨立計數）
const staticPageLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
  skip: (req) => isRequestIpWhitelisted(req),
  validate: { xForwardedForHeader: false }
});

// 一般 API 使用較小的 JSON body 上限避免 DoS；CSV 匯入端點單獨放寬
const STANDARD_JSON_LIMIT = '5mb';
const CSV_IMPORT_JSON_LIMIT = '25mb';
const CSV_IMPORT_PATHS = new Set([
  '/api/transactions/import',
  '/api/stock-transactions/import',
  '/api/stock-dividends/import',
]);
const standardJsonParser = express.json({ limit: STANDARD_JSON_LIMIT });
const csvImportJsonParser = express.json({ limit: CSV_IMPORT_JSON_LIMIT });
app.use((req, res, next) => {
  if (CSV_IMPORT_PATHS.has(req.path)) return csvImportJsonParser(req, res, next);
  return standardJsonParser(req, res, next);
});
// 用於 handler 檢查 rows 上限
const CSV_IMPORT_MAX_ROWS = 20000;

// 統一處理 JSON body 過大的錯誤，回 JSON 而非預設 HTML
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: '請求內容過大，請減少資料量或分批上傳' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON 格式錯誤' });
  }
  next(err);
});

app.use(cookieParser());

// 僅開放必要前端靜態檔，避免專案根目錄檔案外洩
const PUBLIC_FILES = ['/app.js', '/style.css', '/logo.svg', '/favicon.svg', '/vendor/webauthn.min.js', '/lib/moneyDecimal.js'];
const PUBLIC_FILE_MAP = Object.freeze({
  '/app.js': path.join(__dirname, 'app.js'),
  '/style.css': path.join(__dirname, 'style.css'),
  '/logo.svg': path.join(__dirname, 'logo.svg'),
  '/favicon.svg': path.join(__dirname, 'favicon.svg'),
  '/vendor/webauthn.min.js': path.join(__dirname, 'node_modules', '@passwordless-id', 'webauthn', 'dist', 'browser', 'webauthn.min.js'),
  '/lib/moneyDecimal.js': path.join(__dirname, 'lib', 'moneyDecimal.js'),
});
app.get(PUBLIC_FILES, (req, res) => {
  const safePath = PUBLIC_FILE_MAP[req.path];
  if (!safePath) return res.status(404).end();
  res.sendFile(safePath);
});

let db;
let SQL; // sql.js module reference

// ─── 登入失敗追蹤 ───
const loginAttempts = new Map();
const googleOAuthStates = new Map();
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function isValidGoogleOAuthState(state) {
  return typeof state === 'string'
    && state.length >= 20
    && state.length <= 200
    && /^[A-Za-z0-9._~-]+$/.test(state);
}

function pruneGoogleOAuthStates() {
  const now = Date.now();
  for (const [state, issuedAt] of googleOAuthStates.entries()) {
    if ((now - issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS) {
      googleOAuthStates.delete(state);
    }
  }
}

function issueGoogleOAuthState() {
  pruneGoogleOAuthStates();
  const state = crypto.randomBytes(24).toString('base64url');
  googleOAuthStates.set(state, Date.now());
  return state;
}

function consumeGoogleOAuthState(state) {
  if (!isValidGoogleOAuthState(state)) return false;
  pruneGoogleOAuthStates();
  const issuedAt = googleOAuthStates.get(state);
  if (!issuedAt) return false;
  googleOAuthStates.delete(state); // 一次性 token，防重放
  return (Date.now() - issuedAt) <= GOOGLE_OAUTH_STATE_TTL_MS;
}

function normalizeAccountIcon(icon) {
  const value = String(icon || '').trim().toLowerCase();
  return /^fa-[a-z0-9-]{1,40}$/.test(value) ? value : 'fa-wallet';
}

function normalizeThemeMode(mode) {
  const v = String(mode || '').trim().toLowerCase();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

// ─── 初始化資料庫 ───
async function initDB() {
  if (!SQL) SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    const encrypted = isEncryptedDB(fileBuffer);

    if (encrypted && !DB_ENCRYPTION_KEY) {
      console.error('錯誤：資料庫已加密但未設定 DB_ENCRYPTION_KEY，無法啟動');
      process.exit(1);
    }

    if (encrypted) {
      // 解密後載入
      try {
        const plain = decryptBuffer(fileBuffer, DB_ENCRYPTION_KEY);
        db = new SQL.Database(plain);
        console.log('已載入加密資料庫（ChaCha20-Poly1305）');
      } catch (e) {
        console.error('資料庫解密失敗（金鑰可能不正確）:', e.message);
        process.exit(1);
      }
    } else if (DB_ENCRYPTION_KEY) {
      // 未加密的舊資料庫 + 有設定金鑰 → 載入後自動加密儲存
      db = new SQL.Database(fileBuffer);
      console.log('偵測到未加密資料庫，自動加密中...');
      saveDB();
      console.log('資料庫已自動加密完成');
    } else {
      // 未加密 + 無金鑰 → 明文模式
      db = new SQL.Database(fileBuffer);
    }
  } else {
    db = new SQL.Database();
    if (DB_ENCRYPTION_KEY) {
      console.log('將使用加密模式儲存新資料庫');
    }
  }

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

  // 資料庫升級：為 system_settings 加入管理員 IP 白名單欄位
  // 必須在 INSERT 使用欄位前執行，避免舊版資料庫啟動失敗
  try {
    db.run("ALTER TABLE system_settings ADD COLUMN admin_ip_allowlist TEXT DEFAULT ''");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }
  // SMTP 寄信設定（與 Resend 並存，SMTP 設了就優先 SMTP）
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_host TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_port INTEGER DEFAULT 587"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_secure INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_user TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_password TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN smtp_from TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  // 自動寄送統計報表排程
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_freq TEXT DEFAULT 'off'"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_hour INTEGER DEFAULT 9"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_weekday INTEGER DEFAULT 1"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_day_of_month INTEGER DEFAULT 1"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_last_run INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_last_summary TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE system_settings ADD COLUMN report_schedule_user_ids TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  // 伺服器時間偏移（毫秒，正值=快於實際時間）。用於測試排程寄送、除權息同步等依賴時間的功能
  try { db.run("ALTER TABLE system_settings ADD COLUMN server_time_offset INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }

  db.run("INSERT OR IGNORE INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '')", [Date.now()]);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    color TEXT DEFAULT '#6366f1',
    is_default INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    parent_id TEXT DEFAULT ''
  )`);

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
    year_month TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT,
    account_id TEXT,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    last_generated TEXT
  )`);

  // 資料庫升級：為 users 加入 google_id 欄位
  try {
    db.run("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''");
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：為 users 加入 has_password 欄位
  try {
    db.run("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 0");
    db.run("UPDATE users SET has_password = 1 WHERE password_hash != '' AND (google_id = '' OR google_id IS NULL)");
    db.run("UPDATE users SET has_password = 1 WHERE password_hash != '' AND google_id != '' AND has_password = 0");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：為 users 加入 avatar_url 欄位（Google 頭像）
  try {
    db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：為 users 加入主題偏好欄位（跨瀏覽器同步）
  try {
    db.run("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'");
    db.run("UPDATE users SET theme_mode = 'system' WHERE theme_mode IS NULL OR theme_mode = ''");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：為 users 加入管理員欄位
  try {
    db.run("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：token_version（用於改密碼/刪帳號後撤銷既有 JWT）
  try {
    db.run("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 若舊資料沒有管理員，將第一位使用者設為管理員
  const hasAdmin = queryOne("SELECT id FROM users WHERE is_admin = 1 LIMIT 1");
  if (!hasAdmin) {
    const firstUser = queryOne("SELECT id FROM users ORDER BY created_at ASC, rowid ASC LIMIT 1");
    if (firstUser?.id) {
      db.run("UPDATE users SET is_admin = 1 WHERE id = ?", [firstUser.id]);
      saveDB();
    }
  }

  // FR-001 / Q8：Email 正規化 migration（M1）
  // 將既有 users.email 全數 trim + lowercase；衝突時保留 created_at 最小者，
  // 其餘帳號之 FK 資料合併至存活者；無衝突者直接 UPDATE
  try {
    const allUsers = db.exec("SELECT id, email, created_at FROM users ORDER BY created_at ASC, rowid ASC");
    const rows = allUsers[0]?.values || [];
    const grouped = new Map();
    for (const [id, email, createdAt] of rows) {
      const norm = normalizeEmail(email);
      if (!norm) continue;
      if (!grouped.has(norm)) grouped.set(norm, []);
      grouped.get(norm).push({ id, email, createdAt });
    }
    let mergeCount = 0;
    let updateCount = 0;
    const FK_TABLES = ['transactions', 'accounts', 'categories', 'budgets', 'recurring', 'stocks', 'stock_transactions', 'stock_dividends', 'stock_settings', 'stock_recurring', 'exchange_rate_settings', 'passkey_credentials', 'login_audit_logs', 'login_attempt_logs'];
    for (const [norm, list] of grouped.entries()) {
      if (list.length > 1) {
        const survivor = list[0];
        for (let i = 1; i < list.length; i++) {
          const victim = list[i];
          for (const table of FK_TABLES) {
            try { db.run(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [survivor.id, victim.id]); } catch (e) { /* table may not exist */ }
          }
          db.run('DELETE FROM users WHERE id = ?', [victim.id]);
          mergeCount++;
        }
        if (survivor.email !== norm) {
          db.run('UPDATE users SET email = ? WHERE id = ?', [norm, survivor.id]);
          updateCount++;
        }
      } else {
        const only = list[0];
        if (only.email !== norm) {
          db.run('UPDATE users SET email = ? WHERE id = ?', [norm, only.id]);
          updateCount++;
        }
      }
    }
    if (updateCount > 0 || mergeCount > 0) {
      saveDB();
      console.log(`[Email Migration] normalized ${updateCount} users, merged ${mergeCount} duplicate accounts`);
    }
  } catch (e) { console.error('[Email Migration] error', e); }

  // 資料庫升級：為 categories 加入 parent_id 欄位
  try {
    db.run("ALTER TABLE categories ADD COLUMN parent_id TEXT DEFAULT ''");
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：多幣別欄位
  try { db.run("ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'TWD'"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT '現金'"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE accounts ADD COLUMN exclude_from_total INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE accounts ADD COLUMN linked_bank_id TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'TWD'"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN original_amount REAL DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN fx_rate REAL DEFAULT 1"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN exclude_from_stats INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN fx_fee REAL DEFAULT 0"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE recurring ADD COLUMN currency TEXT DEFAULT 'TWD'"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE recurring ADD COLUMN fx_rate REAL DEFAULT 1"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE login_audit_logs ADD COLUMN country TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE login_attempt_logs ADD COLUMN country TEXT DEFAULT ''"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE exchange_rates ADD COLUMN is_manual INTEGER DEFAULT 0"); } catch (e) { /* ignore */ }

  // ─── 002 feature: schema migration（T010~T015） ───
  // 對應 plan.md CT-1 + data-model.md §3。執行於既有 ALTER 之後、其他資料表 CREATE 之前。
  migrate002TransactionsAccounts();

  // 為既有使用者補建預設子分類
  migrateDefaultSubcategories();

  // ─── 股票相關資料表 ───
  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    current_price REAL DEFAULT 0,
    updated_at TEXT
  )`);

  // 資料庫升級：為 stocks 加入 stock_type 欄位（stock / etf / warrant）
  try {
    db.run("ALTER TABLE stocks ADD COLUMN stock_type TEXT DEFAULT 'stock'");
  } catch (e) { /* 欄位已存在則忽略 */ }

  db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy','sell')),
    shares INTEGER NOT NULL,
    price REAL NOT NULL,
    fee REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    account_id TEXT,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    date TEXT NOT NULL,
    cash_dividend REAL DEFAULT 0,
    stock_dividend_shares REAL DEFAULT 0,
    account_id TEXT,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`);

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
    updated_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    account_id TEXT,
    note TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    last_generated TEXT,
    created_at INTEGER
  )`);

  // ─── Passkey (WebAuthn) 憑證資料表 ───
  db.run(`CREATE TABLE IF NOT EXISTS passkey_credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    transports TEXT DEFAULT '[]',
    counter INTEGER DEFAULT 0,
    device_name TEXT DEFAULT '',
    created_at TEXT
  )`);

  // ─── 日期格式遷移：統一為 YYYY-MM-DD ───
  const dateTables = [
    { table: 'transactions', col: 'date' },
    { table: 'stock_transactions', col: 'date' },
    { table: 'stock_dividends', col: 'date' },
    { table: 'stock_recurring', col: 'start_date' },
    { table: 'stock_recurring', col: 'last_generated' },
    { table: 'recurring', col: 'start_date' },
    { table: 'recurring', col: 'last_generated' },
  ];
  dateTables.forEach(({ table, col }) => {
    try {
      // 修正 YYYYMMDD（8位純數字）→ YYYY-MM-DD
      const rows = queryAll(`SELECT id, ${col} FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != '' AND ${col} NOT LIKE '____-__-__'`);
      rows.forEach(r => {
        const normalized = normalizeDate(r[col]);
        if (normalized && normalized !== r[col]) {
          db.run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [normalized, r.id]);
        }
      });
      if (rows.length > 0) console.log(`[日期遷移] ${table}.${col}：修正 ${rows.length} 筆`);
    } catch (e) { /* 表不存在，忽略 */ }
  });

  // 安全性資料清理：帳戶 icon 僅允許安全白名單格式
  try {
    const rows = queryAll("SELECT id, icon FROM accounts");
    rows.forEach(r => {
      const safeIcon = normalizeAccountIcon(r.icon);
      if (safeIcon !== r.icon) {
        db.run("UPDATE accounts SET icon = ? WHERE id = ?", [safeIcon, r.id]);
      }
    });
  } catch (e) {
    // ignore
  }

  // ─── 002 feature: 注入 db 至 fxCache 並暖機（T019） ───
  try {
    fxCache.setDb(db);
    fxCache.primeFromDb();
  } catch (e) {
    console.warn('[fxCache] init failed:', e.message);
  }

  saveDB();
  console.log('資料庫初始化完成');
}

// ─── 002 feature: schema migration（T010~T015） ───
// CT-1：accounts/transactions 由 REAL → INTEGER（金額）/ REAL → TEXT（fx_rate）；
//       新增 user_settings；exchange_rates 由 (user_id, currency) PK 改為 currency PK；
//       備份至 database.db.bak.<ts>，任一步失敗 console.error 並 process.exit(1)。
function migrate002TransactionsAccounts() {
  const fs = require('fs');
  const path = require('path');

  // 偵測是否需要 migration（PK = currency 表示已遷移；REAL 型別 amount 表示尚未）
  let needsMigration = false;
  try {
    const txInfo = queryAll("PRAGMA table_info(transactions)");
    const hasToAccountId = txInfo.some(c => c.name === 'to_account_id');
    const hasTwdAmount = txInfo.some(c => c.name === 'twd_amount');
    const amountIsReal = txInfo.some(c => c.name === 'amount' && /REAL/i.test(c.type || ''));
    if (!hasToAccountId || !hasTwdAmount || amountIsReal) needsMigration = true;
  } catch (e) {
    needsMigration = true;
  }
  // 同時檢查 accounts 是否需新增欄位
  try {
    const acctInfo = queryAll("PRAGMA table_info(accounts)");
    const hasCategory = acctInfo.some(c => c.name === 'category');
    const hasOverseasFee = acctInfo.some(c => c.name === 'overseas_fee_rate');
    const hasUpdatedAt = acctInfo.some(c => c.name === 'updated_at');
    if (!hasCategory || !hasOverseasFee || !hasUpdatedAt) needsMigration = true;
  } catch (e) { /* ignore */ }
  // exchange_rates 重構偵測
  try {
    const erInfo = queryAll("PRAGMA table_info(exchange_rates)");
    const hasUserId = erInfo.some(c => c.name === 'user_id');
    if (hasUserId) needsMigration = true;
  } catch (e) { /* ignore */ }
  // user_settings 是否存在
  let userSettingsExists = false;
  try {
    queryAll("SELECT 1 FROM user_settings LIMIT 1");
    userSettingsExists = true;
  } catch (e) {
    needsMigration = true;
  }

  if (!needsMigration && userSettingsExists) {
    console.log('[migration 002] schema 已是最新，略過');
    return;
  }

  // T010：備份 database.db
  const dbPath = path.join(__dirname, 'database.db');
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(__dirname, `database.db.bak.${Date.now()}`);
    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log('[migration 002] backup → ', backupPath);
    } catch (e) {
      console.error('[migration 002] backup FAILED:', e.message);
    }
  }

  try {
    // T011：accounts 補欄位
    try { db.run("ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'cash'"); } catch (e) { /* ignore */ }
    try { db.run("ALTER TABLE accounts ADD COLUMN overseas_fee_rate INTEGER DEFAULT NULL"); } catch (e) { /* ignore */ }
    try { db.run("ALTER TABLE accounts ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* ignore */ }
    // 將既有 account_type 中文值映射至 enum
    db.run(`UPDATE accounts SET category = CASE account_type
              WHEN '銀行' THEN 'bank'
              WHEN '信用卡' THEN 'credit_card'
              WHEN '現金' THEN 'cash'
              WHEN '虛擬' THEN 'virtual_wallet'
              ELSE 'cash'
            END
            WHERE category IS NULL OR category = 'cash'`);
    // updated_at 補預設（用 created_at 字串 → epoch ms 推估）
    db.run(`UPDATE accounts SET updated_at = COALESCE(
              CAST(strftime('%s', created_at) AS INTEGER) * 1000,
              ?
            ) WHERE updated_at = 0 OR updated_at IS NULL`, [Date.now()]);

    // T012：transactions 補欄位
    try { db.run("ALTER TABLE transactions ADD COLUMN to_account_id TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
    try { db.run("ALTER TABLE transactions ADD COLUMN twd_amount INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* ignore */ }
    db.run(`UPDATE transactions SET updated_at = COALESCE(updated_at, created_at, ?)
            WHERE updated_at IS NULL OR updated_at = 0`, [Date.now()]);

    // T013：REAL → INTEGER／REAL → TEXT 型別 migration（重建表）
    // transactions：偵測 amount 型別
    const txAmountInfo = queryOne("SELECT typeof(amount) AS t FROM transactions LIMIT 1");
    const needsTxRebuild = txAmountInfo && String(txAmountInfo.t).toLowerCase() === 'real';
    if (needsTxRebuild) {
      console.log('[migration 002] 重建 transactions 表（REAL → INTEGER）');
      db.run(`CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        to_account_id TEXT DEFAULT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TWD',
        fx_rate TEXT NOT NULL DEFAULT '1',
        fx_fee INTEGER NOT NULL DEFAULT 0,
        twd_amount INTEGER NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        category_id TEXT DEFAULT NULL,
        note TEXT NOT NULL DEFAULT '',
        exclude_from_stats INTEGER NOT NULL DEFAULT 0,
        linked_id TEXT NOT NULL DEFAULT '',
        original_amount REAL DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER NOT NULL
      )`);
      db.run(`INSERT INTO transactions_new
              (id, user_id, account_id, to_account_id, type, amount, currency, fx_rate, fx_fee, twd_amount, date, category_id, note, exclude_from_stats, linked_id, original_amount, created_at, updated_at)
              SELECT id, user_id, account_id, to_account_id, type,
                     CAST(ROUND(amount) AS INTEGER),
                     COALESCE(currency, 'TWD'),
                     CAST(COALESCE(fx_rate, 1) AS TEXT),
                     CAST(ROUND(COALESCE(fx_fee, 0)) AS INTEGER),
                     CAST(ROUND(amount * COALESCE(fx_rate, 1) + COALESCE(fx_fee, 0)) AS INTEGER),
                     date, category_id, COALESCE(note, ''), COALESCE(exclude_from_stats, 0), COALESCE(linked_id, ''),
                     COALESCE(original_amount, 0), created_at, COALESCE(updated_at, ?)
              FROM transactions`, [Date.now()]);
      db.run("DROP TABLE transactions");
      db.run("ALTER TABLE transactions_new RENAME TO transactions");
    }

    // accounts：偵測 initial_balance 型別
    const acctBalInfo = queryOne("SELECT typeof(initial_balance) AS t FROM accounts LIMIT 1");
    const needsAcctRebuild = acctBalInfo && String(acctBalInfo.t).toLowerCase() === 'real';
    if (needsAcctRebuild) {
      console.log('[migration 002] 重建 accounts 表（REAL → INTEGER）');
      db.run(`CREATE TABLE accounts_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'cash',
        initial_balance INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'TWD',
        icon TEXT NOT NULL DEFAULT 'fa-wallet',
        exclude_from_total INTEGER NOT NULL DEFAULT 0,
        linked_bank_id TEXT DEFAULT NULL,
        overseas_fee_rate INTEGER DEFAULT NULL,
        account_type TEXT DEFAULT '現金',
        created_at TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0
      )`);
      db.run(`INSERT INTO accounts_new
              (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at)
              SELECT id, user_id, name,
                     COALESCE(category, 'cash'),
                     CAST(ROUND(COALESCE(initial_balance, 0)) AS INTEGER),
                     COALESCE(currency, 'TWD'),
                     COALESCE(icon, 'fa-wallet'),
                     COALESCE(exclude_from_total, 0),
                     linked_bank_id,
                     overseas_fee_rate,
                     COALESCE(account_type, '現金'),
                     created_at,
                     COALESCE(updated_at, ?)
              FROM accounts`, [Date.now()]);
      db.run("DROP TABLE accounts");
      db.run("ALTER TABLE accounts_new RENAME TO accounts");
    }

    // 重建索引
    db.run("CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC)");
    db.run("CREATE INDEX IF NOT EXISTS idx_tx_user_acct ON transactions(user_id, account_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_tx_user_type ON transactions(user_id, type)");
    db.run("CREATE INDEX IF NOT EXISTS idx_tx_linked    ON transactions(linked_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_tx_user_cat  ON transactions(user_id, category_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_accounts_user_category ON accounts(user_id, category)");

    // T014：新增 exchange_rates_global（跨使用者共用快取；PK = currency）
    // 為保留與既有 per-user `exchange_rates` 表的 backward compat，新增獨立表給 fxCache 用，
    // 不動既有 schema；既有 /api/exchange-rates per-user 端點維持運作不變。
    db.run(`CREATE TABLE IF NOT EXISTS exchange_rates_global (
      currency TEXT PRIMARY KEY,
      rate_to_twd TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'exchangerate-api'
    )`);

    // T015：新增 user_settings 表
    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      pinned_currencies TEXT NOT NULL DEFAULT '["TWD"]',
      updated_at INTEGER NOT NULL
    )`);
    // 為既有使用者補建 user_settings（避免 US5 querie 失敗）
    db.run(`INSERT OR IGNORE INTO user_settings (user_id, pinned_currencies, updated_at)
            SELECT id, '["TWD"]', ? FROM users`, [Date.now()]);

    // Self-test
    const badAmount = queryOne("SELECT COUNT(*) AS c FROM transactions WHERE typeof(amount) != 'integer' OR amount <= 0")?.c || 0;
    if (badAmount > 0) {
      console.warn(`[migration 002] self-test fail: ${badAmount} 筆 transactions.amount 非正整數`);
    }
    const badAcctUpdated = queryOne("SELECT COUNT(*) AS c FROM accounts WHERE updated_at <= 0")?.c || 0;
    if (badAcctUpdated > 0) {
      console.warn(`[migration 002] self-test fail: ${badAcctUpdated} 筆 accounts.updated_at <= 0`);
    }

    console.log('[migration 002] 完成');
  } catch (err) {
    console.error('[migration 002] FAILED:', err);
    console.error('[migration 002] 請從備份檔還原 database.db');
    throw err;
  }
}

function migrateDefaultSubcategories() {
  const users = queryAll("SELECT DISTINCT user_id FROM categories");
  users.forEach(({ user_id }) => {
    // 取得此使用者的頂層支出分類
    const parentCats = queryAll("SELECT * FROM categories WHERE user_id = ? AND type = 'expense' AND (parent_id = '' OR parent_id IS NULL)", [user_id]);
    let maxOrder = queryOne("SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?", [user_id])?.m || 0;

    parentCats.forEach(parent => {
      const subs = defaultSubcategories[parent.name];
      if (!subs) return;
      // 檢查是否已有子分類
      const existingSubs = queryAll("SELECT name FROM categories WHERE user_id = ? AND parent_id = ?", [user_id, parent.id]);
      const existingNames = new Set(existingSubs.map(s => s.name));

      subs.forEach(([subName, subColor]) => {
        if (existingNames.has(subName)) return; // 已存在則跳過
        maxOrder++;
        db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order, parent_id) VALUES (?,?,?,?,?,1,0,?,?)",
          [uid(), user_id, subName, 'expense', subColor, maxOrder, parent.id]);
      });
    });
  });
}

// 預設子分類定義
const defaultSubcategories = {
  '餐飲': [['早餐', '#ef4444'], ['午餐', '#f87171'], ['晚餐', '#dc2626'], ['飲料', '#fb923c'], ['點心', '#fca5a5']],
  '交通': [['公車/捷運', '#f97316'], ['計程車', '#fb923c'], ['加油', '#fdba74'], ['停車費', '#ea580c'], ['高鐵/火車', '#c2410c']],
  '購物': [['日用品', '#eab308'], ['服飾', '#facc15'], ['3C產品', '#ca8a04'], ['家電', '#a16207']],
  '娛樂': [['電影', '#8b5cf6'], ['遊戲', '#a78bfa'], ['旅遊', '#7c3aed'], ['運動', '#6d28d9']],
  '居住': [['房租/房貸', '#06b6d4'], ['水電費', '#22d3ee'], ['網路/電話', '#0891b2'], ['管理費', '#0e7490']],
  '醫療': [['掛號費', '#ec4899'], ['藥品', '#f472b6'], ['保健食品', '#db2777']],
  '教育': [['學費', '#3b82f6'], ['書籍', '#60a5fa'], ['課程/補習', '#2563eb']],
};

// 為新使用者建立預設分類與帳戶
function createDefaultsForUser(userId) {
  const expenseCats = [
    ['餐飲', '#ef4444'], ['交通', '#f97316'], ['購物', '#eab308'], ['娛樂', '#8b5cf6'],
    ['居住', '#06b6d4'], ['醫療', '#ec4899'], ['教育', '#3b82f6'], ['其他', '#64748b'],
  ];
  const incomeCats = [
    ['薪資', '#10b981'], ['獎金', '#14b8a6'], ['投資', '#6366f1'], ['兼職', '#f59e0b'], ['其他', '#64748b'],
  ];
  let order = 0;
  expenseCats.forEach(([name, color]) => {
    const parentId = uid();
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order, parent_id) VALUES (?,?,?,?,?,1,0,?,'')",
      [parentId, userId, name, 'expense', color, order++]);
    // 建立子分類
    const subs = defaultSubcategories[name];
    if (subs) {
      subs.forEach(([subName, subColor]) => {
        db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order, parent_id) VALUES (?,?,?,?,?,1,0,?,?)",
          [uid(), userId, subName, 'expense', subColor, order++, parentId]);
      });
    }
  });
  incomeCats.forEach(([name, color]) => {
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order, parent_id) VALUES (?,?,?,?,?,1,0,?,'')",
      [uid(), userId, name, 'income', color, order++]);
  });
  // ─── 002 feature (T022)：預設「現金」帳戶補新欄位 + user_settings ───
  // FR-002：name='現金' / category='cash' / currency='TWD' / icon='fa-wallet' / 計入總資產
  const nowMs = Date.now();
  db.run(
    "INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [uid(), userId, '現金', 'cash', 0, 'TWD', 'fa-wallet', 0, null, null, '現金', todayStr(), nowMs]
  );

  // FR-020a：預設 pinned_currencies = ["TWD"]
  db.run(
    "INSERT OR IGNORE INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, ?, ?)",
    [userId, '["TWD"]', nowMs]
  );

  // exchange_rates 已改為跨使用者共用快取（PK = currency），不再 per-user 預設；
  // 既有 DEFAULT_EXCHANGE_RATES 保留為冷啟動 fallback（由 fxCache.primeFromDb 載入）。
  db.run("INSERT OR IGNORE INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)",
    [userId, nowMs]);
  db.run(`INSERT OR IGNORE INTO stock_settings (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock, sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      DEFAULT_STOCK_SETTINGS.feeRate,
      DEFAULT_STOCK_SETTINGS.feeDiscount,
      DEFAULT_STOCK_SETTINGS.feeMinLot,
      DEFAULT_STOCK_SETTINGS.feeMinOdd,
      DEFAULT_STOCK_SETTINGS.sellTaxRateStock,
      DEFAULT_STOCK_SETTINGS.sellTaxRateEtf,
      DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant,
      DEFAULT_STOCK_SETTINGS.sellTaxMin,
      Date.now(),
    ]);
}

// 非阻塞式寫檔：避免 saveDB 在每個 API 請求中同步阻塞 event loop
// 使用 in-flight 旗標 + pending 合併，並以 tmp + rename 保證原子性
let saveInFlight = false;
let savePending = false;
function saveDB() {
  if (saveInFlight) {
    savePending = true;
    return;
  }
  saveInFlight = true;
  (async () => {
    try {
      while (true) {
        savePending = false;
        // db.export() 是同步的，於此拍快照；若之後有更多變更，會在下一輪迴圈再寫一次
        const data = db.export();
        const plain = Buffer.from(data);
        const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
        const tmp = DB_PATH + '.tmp';
        await fs.promises.writeFile(tmp, buf);
        await fs.promises.rename(tmp, DB_PATH);
        if (!savePending) break;
      }
    } catch (e) {
      console.error('saveDB failed:', e && e.message ? e.message : e);
    } finally {
      saveInFlight = false;
    }
  })();
}

// 同步備援：僅用於程式關閉前 flush；request 路徑一律用 saveDB()
function saveDBSync() {
  const data = db.export();
  const plain = Buffer.from(data);
  const buf = DB_ENCRYPTION_KEY ? encryptBuffer(plain, DB_ENCRYPTION_KEY) : plain;
  fs.writeFileSync(DB_PATH, buf);
}

// 程序離開前 flush，避免資料遺失
const flushOnExit = () => { try { saveDBSync(); } catch {} };
process.once('SIGINT', () => { flushOnExit(); process.exit(0); });
process.once('SIGTERM', () => { flushOnExit(); process.exit(0); });

function isValidColor(c) { return !c || /^#[0-9a-fA-F]{3,8}$/.test(c); }

function uid() {
  return crypto.randomUUID().replace(/-/g, '');
}

function todayStr() {
  return ymd(new Date());
}

const DEFAULT_EXCHANGE_RATES = {
  TWD: 1,
  USD: 31.5,
  JPY: 0.21,
  EUR: 34.2,
  CNY: 4.35,
  HKD: 4.03,
};

function normalizeCurrency(code) {
  const c = String(code || 'TWD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'TWD';
}

function parseCurrencyCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : '';
}

function getUserExchangeRateMap(userId) {
  const rows = queryAll('SELECT currency, rate_to_twd FROM exchange_rates WHERE user_id = ?', [userId]);
  const map = { TWD: 1 };
  rows.forEach(r => {
    const c = normalizeCurrency(r.currency);
    const rate = Number(r.rate_to_twd);
    if (rate > 0) map[c] = rate;
  });
  map.TWD = 1;
  return map;
}

function getExchangeRateToTwd(userId, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  if (c === 'TWD') return 1;
  const row = queryOne('SELECT rate_to_twd FROM exchange_rates WHERE user_id = ? AND currency = ?', [userId, c]);
  if (row && Number(row.rate_to_twd) > 0) return Number(row.rate_to_twd);
  return Number(DEFAULT_EXCHANGE_RATES[c]) || 1;
}

function getExchangeRateSettings(userId) {
  let row = queryOne('SELECT * FROM exchange_rate_settings WHERE user_id = ?', [userId]);
  if (!row) {
    db.run('INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)', [userId, Date.now()]);
    saveDB();
    row = queryOne('SELECT * FROM exchange_rate_settings WHERE user_id = ?', [userId]);
  }
  return {
    autoUpdate: !!row?.auto_update,
    lastSyncedAt: Number(row?.last_synced_at) || 0,
  };
}

function setExchangeRateAutoUpdate(userId, autoUpdate) {
  db.run(
    `INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at)
     VALUES (?, ?, COALESCE((SELECT last_synced_at FROM exchange_rate_settings WHERE user_id = ?), 0), ?)
     ON CONFLICT(user_id) DO UPDATE SET
       auto_update = excluded.auto_update,
       updated_at = excluded.updated_at`,
    [userId, autoUpdate ? 1 : 0, userId, Date.now()]
  );
  saveDB();
  return getExchangeRateSettings(userId);
}

// ─── 全球匯率 server-level 快取（跨所有使用者共用，避免重複打外部 API）───
const GLOBAL_FX_CACHE_TTL = 5 * 60 * 1000; // 5 分鐘：外部 API 原始回應快取
let globalFxCache = { data: null, timestamp: 0 };
let globalFxInflight = null; // 正在進行中的 fetch Promise，所有人共用同一個

// ─── 已解析匯率跨使用者共用快取（auto-fetch 專用，手動輸入不放這裡）───
const SHARED_AUTO_RATE_TTL = 30 * 60 * 1000; // 30 分鐘
// Map<currencyCode, { rate: number, fetchedAt: number }>
const sharedAutoRateCache = new Map();

async function fetchGlobalRealtimeRates() {
  const now = Date.now();
  // 快取未過期，直接回傳
  if (globalFxCache.data && (now - globalFxCache.timestamp) < GLOBAL_FX_CACHE_TTL) {
    return globalFxCache.data;
  }
  // 已有進行中的請求，等待相同的 Promise（避免同時多個 user 各自打一次 API）
  if (globalFxInflight) return globalFxInflight;

  globalFxInflight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // 嘗試以 TWD 作為基礎幣別
      let url = `${GLOBAL_FX_API_BASE}/${GLOBAL_FX_API_KEY}/latest/TWD`;
      let resp = await fetch(url, { signal: controller.signal });

      // 如果 TWD 不被支援，改用 USD
      if (!resp.ok || resp.status === 404) {
        url = `${GLOBAL_FX_API_BASE}/${GLOBAL_FX_API_KEY}/latest/USD`;
        resp = await fetch(url, { signal: controller.signal });
      }

      if (!resp.ok) throw new Error(`匯率服務回應失敗（HTTP ${resp.status}）`);
      const data = await resp.json();

      if (data.result !== 'success') {
        throw new Error(`API 錯誤：${data.error_type || '未知錯誤'}`);
      }

      globalFxCache = { data, timestamp: Date.now() };
      return data; // { base_code, conversion_rates, ... }
    } finally {
      clearTimeout(timeout);
      globalFxInflight = null;
    }
  })();

  return globalFxInflight;
}

function resolveRateToTwd(globalData, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  if (c === 'TWD') return 1;
  
  const baseCode = globalData?.base_code || 'USD';
  const rates = globalData?.conversion_rates || {};
  
  // 策略 1：直接查詢（若 base_code 是 TWD，rates[c] 表示「1 TWD = rates[c] c」，需取倒數得「1 c = X TWD」）
  if (baseCode === 'TWD') {
    const direct = Number(rates[c]);
    if (direct > 0) return 1 / direct;
  }
  
  // 策略 2：如果 base_code 是 USD，需要透過 TWD 反算
  if (baseCode === 'USD') {
    const usdToTwd = Number(rates['TWD']);
    const baseToTarget = Number(rates[c]);
    
    if (usdToTwd > 0 && baseToTarget > 0) {
      // 1 USD = usdToTwd TWD
      // 1 baseToTarget = baseToTarget USD = baseToTarget * usdToTwd TWD
      // 所以 1 c = 1 baseToTarget / (1 USD) * (usdToTwd TWD)
      // 即 1 c = baseToTarget * usdToTwd TWD
      // 等等，這個不對。讓我重新思考：
      // rates[c] 表示 1 USD = rates[c] c
      // 所以 1 c = 1 / rates[c] USD = 1 / rates[c] * usdToTwd TWD
      return usdToTwd / baseToTarget;
    }
  }
  
  return 0;
}

async function syncExchangeRatesFromGlobalAPI(userId, requestedCurrencies = []) {
  const existingMap = getUserExchangeRateMap(userId);
  const targets = new Set(['TWD']);
  Object.keys(existingMap).forEach(c => targets.add(c));
  requestedCurrencies.forEach(c => {
    const parsed = parseCurrencyCode(c);
    if (parsed) targets.add(parsed);
  });

  const now = Date.now();

  // 只有在共用快取中找不到（或已過期）的幣別，才需要打外部 API
  const needsApi = [...targets].filter(c => {
    if (c === 'TWD') return false;
    const hit = sharedAutoRateCache.get(c);
    return !hit || (now - hit.fetchedAt) >= SHARED_AUTO_RATE_TTL;
  });
  const globalData = needsApi.length > 0 ? await fetchGlobalRealtimeRates() : null;

  const updated = [];
  const unsupported = [];
  for (const currency of targets) {
    const c = normalizeCurrency(currency);
    if (c === 'TWD') {
      db.run(`INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual)
        VALUES (?, 'TWD', 1, ?, 0)
        ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = 1, updated_at = excluded.updated_at, is_manual = 0`,
        [userId, now]);
      continue;
    }

    // 優先使用共用快取
    const hit = sharedAutoRateCache.get(c);
    let rate;
    if (hit && (now - hit.fetchedAt) < SHARED_AUTO_RATE_TTL) {
      rate = hit.rate;
    } else {
      rate = resolveRateToTwd(globalData, c);
      if (rate > 0) sharedAutoRateCache.set(c, { rate, fetchedAt: now });
    }

    if (!(rate > 0)) {
      unsupported.push(c);
      continue;
    }
    db.run(`INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, updated_at = excluded.updated_at, is_manual = 0`,
      [userId, c, rate, now]);
    updated.push({ currency: c, rateToTwd: rate });
  }

  db.run(
    `INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at)
     VALUES (?, COALESCE((SELECT auto_update FROM exchange_rate_settings WHERE user_id = ?), 0), ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at`,
    [userId, userId, now, now]
  );

  saveDB();
  return { updatedAt: now, updatedRates: updated, unsupportedCurrencies: unsupported };
}

function convertToTwd(originalAmount, currencyCode, fxRateInput, userId) {
  const currency = normalizeCurrency(currencyCode);
  const original = Number(originalAmount);
  if (!(original > 0)) throw new Error('金額必須大於 0');
  const fxRate = currency === 'TWD'
    ? 1
    : (Number(fxRateInput) > 0 ? Number(fxRateInput) : getExchangeRateToTwd(userId, currency));
  const twdAmount = Math.round(original * fxRate * 100) / 100;
  return {
    currency,
    originalAmount: original,
    fxRate,
    twdAmount,
  };
}

function convertFromTwd(twdAmount, currencyCode, userId) {
  const currency = normalizeCurrency(currencyCode);
  const twd = Number(twdAmount) || 0;
  if (currency === 'TWD') return twd;
  const rate = getExchangeRateToTwd(userId, currency);
  if (!(rate > 0)) return twd;
  return Math.round((twd / rate) * 100) / 100;
}

const DEFAULT_STOCK_SETTINGS = {
  feeRate: 0.001425,
  feeDiscount: 1,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getStockSettings(userId) {
  const row = queryOne('SELECT * FROM stock_settings WHERE user_id = ?', [userId]);
  if (!row) {
    db.run(`INSERT INTO stock_settings (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock, sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        DEFAULT_STOCK_SETTINGS.feeRate,
        DEFAULT_STOCK_SETTINGS.feeDiscount,
        DEFAULT_STOCK_SETTINGS.feeMinLot,
        DEFAULT_STOCK_SETTINGS.feeMinOdd,
        DEFAULT_STOCK_SETTINGS.sellTaxRateStock,
        DEFAULT_STOCK_SETTINGS.sellTaxRateEtf,
        DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant,
        DEFAULT_STOCK_SETTINGS.sellTaxMin,
        Date.now(),
      ]);
    saveDB();
    return { ...DEFAULT_STOCK_SETTINGS };
  }
  return {
    feeRate: toNum(row.fee_rate, DEFAULT_STOCK_SETTINGS.feeRate),
    feeDiscount: toNum(row.fee_discount, DEFAULT_STOCK_SETTINGS.feeDiscount),
    feeMinLot: Math.round(toNum(row.fee_min_lot, DEFAULT_STOCK_SETTINGS.feeMinLot)),
    feeMinOdd: Math.round(toNum(row.fee_min_odd, DEFAULT_STOCK_SETTINGS.feeMinOdd)),
    sellTaxRateStock: toNum(row.sell_tax_rate_stock, DEFAULT_STOCK_SETTINGS.sellTaxRateStock),
    sellTaxRateEtf: toNum(row.sell_tax_rate_etf, DEFAULT_STOCK_SETTINGS.sellTaxRateEtf),
    sellTaxRateWarrant: toNum(row.sell_tax_rate_warrant, DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant),
    sellTaxMin: Math.round(toNum(row.sell_tax_min, DEFAULT_STOCK_SETTINGS.sellTaxMin)),
  };
}

function getSellTaxRateByType(stockType, settings) {
  if (stockType === 'etf') return settings.sellTaxRateEtf;
  if (stockType === 'warrant') return settings.sellTaxRateWarrant;
  return settings.sellTaxRateStock;
}

function calcStockFee(amount, shares, settings) {
  if (!(amount > 0)) return 0;
  const minFee = Number(shares) < 1000 ? settings.feeMinOdd : settings.feeMinLot;
  const baseFee = Math.floor(amount * settings.feeRate * settings.feeDiscount);
  return Math.max(minFee, baseFee);
}

function calcStockTax(amount, stockType, settings) {
  if (!(amount > 0)) return 0;
  const tax = Math.floor(amount * getSellTaxRateByType(stockType, settings));
  return Math.max(settings.sellTaxMin, tax);
}

function normalizeStockSettingsInput(input = {}, current = DEFAULT_STOCK_SETTINGS) {
  const normalized = {
    feeRate: toNum(input.feeRate, current.feeRate),
    feeDiscount: toNum(input.feeDiscount, current.feeDiscount),
    feeMinLot: Math.round(toNum(input.feeMinLot, current.feeMinLot)),
    feeMinOdd: Math.round(toNum(input.feeMinOdd, current.feeMinOdd)),
    sellTaxRateStock: toNum(input.sellTaxRateStock, current.sellTaxRateStock),
    sellTaxRateEtf: toNum(input.sellTaxRateEtf, current.sellTaxRateEtf),
    sellTaxRateWarrant: toNum(input.sellTaxRateWarrant, current.sellTaxRateWarrant),
    sellTaxMin: Math.round(toNum(input.sellTaxMin, current.sellTaxMin)),
  };

  if (!(normalized.feeRate > 0 && normalized.feeRate <= 0.02)) throw new Error('券商手續費率需介於 0 ~ 0.02');
  if (!(normalized.feeDiscount > 0 && normalized.feeDiscount <= 1)) throw new Error('手續費折扣需介於 0 ~ 1');
  if (!(normalized.feeMinLot >= 0 && normalized.feeMinLot <= 1000)) throw new Error('整股最低手續費需介於 0 ~ 1000');
  if (!(normalized.feeMinOdd >= 0 && normalized.feeMinOdd <= 1000)) throw new Error('零股最低手續費需介於 0 ~ 1000');
  if (!(normalized.sellTaxRateStock >= 0 && normalized.sellTaxRateStock <= 0.02)) throw new Error('一般股票賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxRateEtf >= 0 && normalized.sellTaxRateEtf <= 0.02)) throw new Error('ETF 賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxRateWarrant >= 0 && normalized.sellTaxRateWarrant <= 0.02)) throw new Error('權證賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxMin >= 0 && normalized.sellTaxMin <= 100)) throw new Error('賣出交易稅最低金額需介於 0 ~ 100');

  return normalized;
}

// 統一日期格式為 YYYY-MM-DD（支援 YYYYMMDD、YYYY/MM/DD、YYYY-MM-DD）
// 無法解析的輸入一律回傳空字串，避免 XSS payload 被寫入資料庫
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  let candidate = '';
  // 已經是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    candidate = s;
  } else if (/^\d{8}$/.test(s)) {
    // YYYYMMDD → YYYY-MM-DD
    candidate = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    // YYYY/MM/DD → YYYY-MM-DD
    const [y, m, d] = s.split('/');
    candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    return '';
  }
  // 再次驗證實際有效日期（擋掉 9999-99-99 等）
  const [y, m, d] = candidate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return '';
  return candidate;
}

function thisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// 伺服器時間偏移（毫秒），從 system_settings 載入後快取於記憶體
let SERVER_TIME_OFFSET = 0;
function loadServerTimeOffset() {
  try {
    const row = queryOne("SELECT server_time_offset FROM system_settings WHERE id = 1");
    SERVER_TIME_OFFSET = Number.isFinite(Number(row?.server_time_offset)) ? Number(row.server_time_offset) : 0;
  } catch (e) {
    SERVER_TIME_OFFSET = 0;
  }
}
function serverNow() {
  return Date.now() + SERVER_TIME_OFFSET;
}

// 簡易 SNTP client：對指定 NTP 伺服器發一個 UDP 請求，回傳 { ntpMs, roundTripMs }
// RFC 4330：NTP 時間為 1900-01-01 起算秒數（+小數部分）；需轉為 Unix ms
const NTP_UNIX_EPOCH_DIFF = 2208988800; // NTP 時間起點 → Unix 時間起點的秒數差

// 判斷單個 IPv4（已解析後的字面位址）是否為私有/保留位址
function isPrivateOrReservedIp(ip) {
  const s = String(ip || '').trim();
  if (!s || !net.isIPv4(s)) return true; // 非 IPv4 一律視為不安全（本功能僅接受 IPv4）
  const [a, b] = s.split('.').map(Number);
  if (a === 10) return true;                        // 10.0.0.0/8
  if (a === 127) return true;                       // loopback
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 169 && b === 254) return true;          // link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT 100.64.0.0/10
  if (a >= 224) return true;                        // multicast / reserved
  return false;
}

// 驗證 NTP host：僅接受 IPv4 或 FQDN；IPv6 與內部網域一律拒絕
function validateNtpHost(host) {
  const s = String(host || '').trim();
  if (!s || s.length > 253) return { ok: false, error: 'NTP 主機長度需為 1-253' };
  if (net.isIPv6(s)) return { ok: false, error: '不支援 IPv6 位址（僅允許 IPv4 或網域名稱）' };
  if (net.isIPv4(s)) {
    if (isPrivateOrReservedIp(s)) return { ok: false, error: '不允許 private / loopback / link-local / multicast 位址' };
    return { ok: true, host: s };
  }
  const fqdn = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  if (!fqdn.test(s)) return { ok: false, error: 'NTP 主機格式錯誤（需為 IPv4 或網域名稱）' };
  const lower = s.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return { ok: false, error: '不允許 localhost / .local / .internal 網域' };
  }
  return { ok: true, host: s };
}

// 把 FQDN 解析為 IPv4（family:4），逐一套用 isPrivateOrReservedIp() 防止 DNS rebinding / 內部 DNS
async function resolveHostToPublicIpv4(host) {
  if (net.isIPv4(host)) {
    if (isPrivateOrReservedIp(host)) throw new Error(`${host} 為私有/保留位址`);
    return { ip: host };
  }
  if (net.isIPv6(host)) throw new Error(`不支援 IPv6 位址：${host}`);
  let records;
  try {
    records = await dns.lookup(host, { family: 4, all: true });
  } catch (e) {
    throw new Error(`DNS 解析失敗：${host}（${e.code || e.message}）`);
  }
  if (!records || !records.length) throw new Error(`DNS 無 A 紀錄：${host}`);
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) {
      throw new Error(`${host} 解析到私有/保留位址 ${r.address}，拒絕連線（疑似 DNS rebinding）`);
    }
  }
  return { ip: records[0].address };
}

async function queryNtp(host = 'pool.ntp.org', port = 123, timeoutMs = 3000) {
  const resolved = await resolveHostToPublicIpv4(host);
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const packet = Buffer.alloc(48);
    packet[0] = 0x1b; // LI=0, VN=3, Mode=3 (client)
    const t1 = Date.now();

    const timer = setTimeout(() => {
      try { socket.close(); } catch (e) { /* ignore */ }
      reject(new Error(`NTP 查詢逾時：${host}`));
    }, timeoutMs);

    socket.once('error', (err) => {
      clearTimeout(timer);
      try { socket.close(); } catch (e) { /* ignore */ }
      reject(err);
    });

    socket.once('message', (msg) => {
      clearTimeout(timer);
      try { socket.close(); } catch (e) { /* ignore */ }
      if (!msg || msg.length < 48) { reject(new Error('NTP 回應長度不足')); return; }
      const t4 = Date.now();
      const secs = msg.readUInt32BE(40);
      const frac = msg.readUInt32BE(44);
      if (secs === 0) { reject(new Error('NTP 伺服器回傳無效時間戳（Kiss-o\'-Death 或未同步）')); return; }
      const ntpMs = (secs - NTP_UNIX_EPOCH_DIFF) * 1000 + Math.round((frac / 0x100000000) * 1000);
      resolve({ ntpMs, roundTripMs: t4 - t1, host, resolvedIp: resolved.ip });
    });

    // 傳入已解析的 IP 而非原始 host，避免 dgram 再次 DNS 解析出現 TOCTOU
    socket.send(packet, 0, packet.length, port, resolved.ip, (err) => {
      if (err) {
        clearTimeout(timer);
        try { socket.close(); } catch (e) { /* ignore */ }
        reject(err);
      }
    });
  });
}

const DEFAULT_NTP_SERVERS = ['tw.pool.ntp.org', 'pool.ntp.org', 'time.google.com', 'time.cloudflare.com'];

async function queryNtpWithFallback(candidates) {
  const hosts = Array.isArray(candidates) && candidates.length ? candidates : DEFAULT_NTP_SERVERS;
  const errors = [];
  for (const host of hosts) {
    try {
      const r = await queryNtp(host);
      return r;
    } catch (e) {
      errors.push(`${host}: ${e.message || e}`);
    }
  }
  throw new Error('所有 NTP 伺服器皆失敗：' + errors.join('；'));
}

// 驗證資源屬於當前使用者（防 IDOR）
function assertOwned(table, id, userId) {
  if (id === undefined || id === null || id === '') return true;
  const allowedTables = ['accounts', 'categories', 'stocks'];
  if (!allowedTables.includes(table)) return false;
  const row = queryOne(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  return !!row;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  const s = normalizeEmail(email);
  if (!s || s.length > 254) return false;
  if (s.includes('..')) return false;
  const at = s.indexOf('@');
  if (at <= 0 || at !== s.lastIndexOf('@') || at >= s.length - 1) return false;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!local || !domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  if (!/^[a-z0-9.-]+$/i.test(domain)) return false;
  return domain.split('.').every(part => /^[a-z0-9-]+$/i.test(part) && !part.startsWith('-') && !part.endsWith('-') && part.length > 0);
}

function isValidAllowlistPattern(s) {
  if (!s) return false;
  if (s.startsWith('*@')) {
    const domain = s.slice(2);
    return !!domain && /^[a-z0-9.-]+$/i.test(domain) && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
  }
  return isValidEmail(s);
}

function parseAllowedRegistrationEmails(value) {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return Array.from(new Set(
    source
      .split(/[\n,;\s]+/)
      .map(v => String(v || '').trim().toLowerCase())
      .filter(v => isValidAllowlistPattern(v))
  ));
}

function matchAllowlist(email, rawList) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const list = Array.isArray(rawList) ? rawList : parseAllowedRegistrationEmails(rawList);
  for (const item of list) {
    if (!item) continue;
    if (item.startsWith('*@')) {
      if (normalized.endsWith(item.slice(1))) return true;
      continue;
    }
    if (item.includes('*')) continue;
    if (item === normalized) return true;
  }
  return false;
}

function normalizeIp(ip) {
  return String(ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
}

function parseIpAllowlist(value) {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return Array.from(new Set(
    source
      .split(/[\n,;\s]+/)
      .map(v => normalizeIp(v))
      .filter(Boolean)
  ));
}

function getSystemSettings() {
  const row = queryOne("SELECT public_registration, allowed_registration_emails, admin_ip_allowlist FROM system_settings WHERE id = 1") || {
    public_registration: 1,
    allowed_registration_emails: '',
    admin_ip_allowlist: '',
  };
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(row.allowed_registration_emails);
  const dbAdminIpAllowlist = parseIpAllowlist(row.admin_ip_allowlist);
  const mergedAdminIpAllowlist = Array.from(new Set([...ENV_ADMIN_IP_ALLOWLIST, ...dbAdminIpAllowlist]));
  return {
    publicRegistration: !!row.public_registration,
    allowedRegistrationEmails,
    adminIpAllowlist: mergedAdminIpAllowlist,
  };
}

function getUserCount() {
  const row = queryOne("SELECT COUNT(1) AS count FROM users");
  return Number(row?.count || 0);
}

function canSelfRegister(email) {
  const emailLower = normalizeEmail(email);
  if (!emailLower) {
    return { ok: false, error: '電子郵件格式不正確' };
  }
  if (getUserCount() === 0) {
    return { ok: true };
  }

  const settings = getSystemSettings();
  const allowList = settings.allowedRegistrationEmails;

  if (allowList.length > 0) {
    if (matchAllowlist(emailLower, allowList)) return { ok: true };
    return { ok: false, error: '此 Email 未被管理員允許註冊' };
  }

  if (!settings.publicRegistration) {
    return { ok: false, error: '目前已關閉公開註冊，請聯絡管理員建立帳號' };
  }

  return { ok: true };
}

function isUserAdmin(userId) {
  const row = queryOne("SELECT is_admin FROM users WHERE id = ?", [userId]);
  return !!row?.is_admin;
}

function getRequestIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const rawIp = forwardedFor || req.ip || req.socket?.remoteAddress || '';
  return rawIp ? normalizeIp(rawIp) : 'unknown';
}

function getTrustedRequestIp(req) {
  const rawIp = req.ip || req.socket?.remoteAddress || '';
  return rawIp ? normalizeIp(rawIp) : 'unknown';
}

function isRequestIpWhitelisted(req) {
  const ip = getTrustedRequestIp(req);
  if (!ip || ip === 'unknown') return false;
  const settings = getSystemSettings();
  const allowSet = new Set((settings.adminIpAllowlist || []).map(normalizeIp));
  return allowSet.has(ip);
}

function isPrivateOrLocalIp(ip) {
  const v = String(ip || '').trim().toLowerCase();
  if (!v || v === 'unknown') return true;
  if (v === '::1' || v === 'localhost') return true;
  if (v.startsWith('127.')) return true;
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  if (v.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true; // IPv6 ULA
  if (v.startsWith('fe80:')) return true; // IPv6 link-local
  return false;
}

async function fetchIpCountry(ipAddress) {
  const ip = String(ipAddress || '').trim();
  if (!ip || ip === 'unknown') return '-';
  if (isPrivateOrLocalIp(ip)) return 'LOCAL';

  const cached = ipCountryCache.get(ip);
  const now = Date.now();
  if (cached && (now - cached.at) < IP_COUNTRY_CACHE_TTL_MS) return cached.country;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const tokenQuery = IPINFO_TOKEN ? `?token=${encodeURIComponent(IPINFO_TOKEN)}` : '';
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json${tokenQuery}`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) {
      ipCountryCache.set(ip, { country: '-', at: now });
      return '-';
    }
    const data = await r.json();
    const country = String(data?.country || '').trim().toUpperCase() || '-';
    ipCountryCache.set(ip, { country, at: now });
    return country;
  } catch (e) {
    ipCountryCache.set(ip, { country: '-', at: now });
    return '-';
  } finally {
    clearTimeout(timeoutId);
  }
}

// enrichAndPersistCountry：
// - rows 已含 country 欄位（從 DB SELECT 而來）
// - 只對 country 為空的列查詢 ipinfo.io，並回寫至指定資料表
// - tableName: 'login_audit_logs' | 'login_attempt_logs'
async function enrichAndPersistCountry(rows, tableName) {
  const list = Array.isArray(rows) ? rows : [];
  // 找出還沒有 country 的列（舊紀錄或寫入失敗的）
  const needLookup = list.filter(r => !r.country || r.country === '-');
  if (needLookup.length === 0) return list;

  const uniqueIps = [...new Set(needLookup.map(r => String(r.ip_address || '').trim()).filter(Boolean))];
  const lookup = new Map();
  const workerCount = Math.min(8, uniqueIps.length);
  let cursor = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < uniqueIps.length) {
      const ip = uniqueIps[cursor++];
      const country = await fetchIpCountry(ip);
      lookup.set(ip, country);
    }
  });
  await Promise.all(workers);

  // 將查到的結果回寫 DB（以 ip_address 批次更新，同一 IP 只更新一次）
  let dirty = false;
  for (const [ip, country] of lookup) {
    if (country && country !== '-') {
      db.run(
        `UPDATE ${tableName} SET country = ? WHERE ip_address = ? AND (country IS NULL OR country = '' OR country = '-')`,
        [country, ip]
      );
      dirty = true;
    }
  }
  if (dirty) saveDB();

  return list.map(r => ({
    ...r,
    country: (r.country && r.country !== '-')
      ? r.country
      : (lookup.get(String(r.ip_address || '').trim()) || '-'),
  }));
}

function getCountryFromRequest(req) {
  // 優先使用 Cloudflare 提供的 CF-IPCountry header
  const cfCountry = String(req.headers['cf-ipcountry'] || '').trim().toUpperCase();
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') return cfCountry;
  return '';
}

function recordLoginAudit(user, req, method = 'password') {
  if (!user?.id) return;
  const loginId = uid();
  const loginAt = Date.now();
  const ipAddress = getRequestIp(req);
  const loginMethod = String(method || 'password').trim().toLowerCase();
  const isAdminLogin = user.is_admin ? 1 : 0;
  const cfCountry = getCountryFromRequest(req);
  db.run(
    `INSERT INTO login_audit_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loginId,
      user.id,
      normalizeEmail(user.email),
      loginAt,
      ipAddress,
      loginMethod,
      isAdminLogin,
      cfCountry,
    ]
  );
  saveDB();
  // 若 Cloudflare 未提供國家，非同步查詢 ipinfo.io 並回寫
  if (!cfCountry) {
    fetchIpCountry(ipAddress).then(country => {
      if (country) {
        db.run('UPDATE login_audit_logs SET country = ? WHERE id = ?', [country, loginId]);
        saveDB();
      }
    }).catch(() => {});
  }
  return {
    id: loginId,
    loginAt,
    ipAddress,
    loginMethod,
    isAdminLogin: !!isAdminLogin,
  };
}

function recordLoginAttempt({ user = null, email = '', req, method = 'password', isSuccess = false, failureReason = '' }) {
  const loginAt = Date.now();
  const ipAddress = getRequestIp(req);
  const loginMethod = String(method || 'password').trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email || user?.email || '');
  const userId = user?.id ? String(user.id) : '';
  const isAdminLogin = user?.is_admin ? 1 : 0;
  const attemptId = uid();
  const cfCountry = getCountryFromRequest(req);
  db.run(
    `INSERT INTO login_attempt_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, is_success, failure_reason, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      userId,
      normalizedEmail,
      loginAt,
      ipAddress,
      loginMethod,
      isAdminLogin,
      isSuccess ? 1 : 0,
      isSuccess ? '' : String(failureReason || 'unknown').trim().toLowerCase(),
      cfCountry,
    ]
  );
  saveDB();
  // 若 Cloudflare 未提供國家，非同步查詢 ipinfo.io 並回寫
  if (!cfCountry) {
    fetchIpCountry(ipAddress).then(country => {
      if (country) {
        db.run('UPDATE login_attempt_logs SET country = ? WHERE id = ?', [country, attemptId]);
        saveDB();
      }
    }).catch(() => {});
  }
}

function parseLoginLogTarget(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return null;

  const rowidMatch = id.match(/^rid:(\d+)$/);
  if (rowidMatch) {
    const rowid = Number(rowidMatch[1]);
    if (!Number.isFinite(rowid) || rowid <= 0) return null;
    return { byRowId: true, value: rowid };
  }

  const tsMatch = id.match(/^ts:(\d+)$/);
  if (tsMatch) {
    const ts = Number(tsMatch[1]);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    return { byTimestamp: true, value: ts };
  }

  return { byRowId: false, value: id };
}

// T036：Email SHA-256 雜湊（用於 FR-035 匿名化失敗稽核紀錄）
function createHashedEmail(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

// FR-035 / Q9：混合刪除策略
// - 業務資料表與 passkey_credentials：全部 DELETE WHERE user_id
// - login_audit_logs：硬刪（僅保留成功登入，業務意義上與使用者綁定）
// - login_attempt_logs(is_success=0)：匿名化保留（user_id='', email=SHA-256）
// - login_attempt_logs(is_success=1)：硬刪
// - users：最後刪除
function deleteUserData(userId) {
  const user = queryOne('SELECT email FROM users WHERE id = ?', [userId]);
  const hashedEmail = user ? createHashedEmail(user.email || '') : '';
  const businessTables = [
    'stock_dividends', 'stock_transactions', 'stock_recurring', 'stocks',
    'transactions', 'budgets', 'recurring', 'accounts', 'categories',
    'exchange_rates', 'exchange_rate_settings', 'stock_settings',
    'passkey_credentials',
  ];
  try { db.run('BEGIN'); } catch (e) { /* may already be in transaction */ }
  businessTables.forEach((t) => {
    try { db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]); } catch (e) { /* table may not exist */ }
  });
  db.run('DELETE FROM login_audit_logs WHERE user_id = ?', [userId]);
  db.run(
    "UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0",
    [hashedEmail, userId]
  );
  db.run('DELETE FROM login_attempt_logs WHERE user_id = ? AND is_success = 1', [userId]);
  db.run('DELETE FROM users WHERE id = ?', [userId]);
  try { db.run('COMMIT'); } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════
// Auth Middleware
// ═══════════════════════════════════════

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function setAuthCookie(res, token) {
  res.cookie('authToken', token, { ...AUTH_COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE });
}

function clearAuthCookie(res) {
  res.clearCookie('authToken', AUTH_COOKIE_OPTIONS);
}

// FR-065 / SC-006：登入路徑時序對齊用的 dummy bcrypt hash
const DUMMY_HASH = bcrypt.hashSync('__dummy__', 10);

function authMiddleware(req, res, next) {
  const token = req.cookies?.authToken
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return res.status(401).json({ error: '請先登入' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 比對 token_version（改密碼/刪帳號後所有舊 token 立即失效）
    const user = queryOne("SELECT token_version FROM users WHERE id = ?", [decoded.userId]);
    if (!user) {
      res.clearCookie('authToken');
      return res.status(401).json({ error: '使用者不存在' });
    }
    const dbVersion = Number(user.token_version) || 0;
    const tokenVersion = Number(decoded.tokenVersion) || 0;
    if (tokenVersion !== dbVersion) {
      res.clearCookie('authToken');
      return res.status(401).json({ error: '登入已失效，請重新登入' });
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.clearCookie('authToken');
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

function adminMiddleware(req, res, next) {
  if (!isUserAdmin(req.userId)) {
    return res.status(403).json({ error: '需要管理員權限' });
  }
  next();
}

// ─── 002 feature: IDOR / 樂觀鎖共用 helper（T020 + T021） ───
// FR-060：所有受保護資源以 ownsResource 驗證 user_id；不符回 404 不洩漏存在性。
// FR-014a：PATCH／DELETE 須帶 expected_updated_at；不符回 409 OptimisticLockConflict。

// 通用：以 (table, idColumn, idValue, userId) 驗證並取出 row；無則 null
function ownsResource(table, idColumn, idValue, userId) {
  if (!table || !idColumn || idValue == null || !userId) return null;
  // 白名單檢查（避免 SQL injection 經 table/column 名稱）
  const allowedTables = { accounts: 1, transactions: 1, user_settings: 1 };
  const allowedColumns = { id: 1, user_id: 1 };
  if (!allowedTables[table] || !allowedColumns[idColumn]) return null;
  const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ? AND user_id = ? LIMIT 1`;
  return queryOne(sql, [String(idValue), String(userId)]);
}

// requireOwnedAccount：套於 /api/accounts/:accountId/* 路由
function requireOwnedAccount(req, res, next) {
  const accountId = req.params.accountId;
  const row = ownsResource('accounts', 'id', accountId, req.userId);
  if (!row) return res.status(404).json({ error: 'NotFound' });
  req.account = row;
  next();
}

// requireOwnedTransaction：套於 /api/transactions/:txId/* 路由
function requireOwnedTransaction(req, res, next) {
  const txId = req.params.txId;
  const row = ownsResource('transactions', 'id', txId, req.userId);
  if (!row) return res.status(404).json({ error: 'NotFound' });
  req.tx = row;
  next();
}

// assertOptimisticLock：throw 物件 { status, error, ... }；caller 以 try/catch 處理
function assertOptimisticLock(table, idColumn, idValue, expectedUpdatedAt) {
  const allowedTables = { accounts: 1, transactions: 1, user_settings: 1 };
  const allowedColumns = { id: 1, user_id: 1 };
  if (!allowedTables[table] || !allowedColumns[idColumn]) {
    throw { status: 500, error: 'InvalidLockTarget' };
  }
  const sql = `SELECT updated_at FROM ${table} WHERE ${idColumn} = ? LIMIT 1`;
  const row = queryOne(sql, [String(idValue)]);
  if (!row) {
    throw { status: 404, error: 'NotFound' };
  }
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) {
    throw {
      status: 400,
      error: 'MissingExpectedUpdatedAt',
      message: '請帶 expected_updated_at',
    };
  }
  if (Number(row.updated_at) !== expected) {
    throw {
      status: 409,
      error: 'OptimisticLockConflict',
      serverUpdatedAt: Number(row.updated_at),
      message: '此筆已被其他裝置修改，請重新整理後再操作',
    };
  }
}

// 統一處理 lock/owns 例外
function sendLockError(res, e) {
  if (e && typeof e === 'object' && e.status) {
    const body = { error: e.error || 'Error' };
    if (e.message) body.message = e.message;
    if (e.serverUpdatedAt) body.serverUpdatedAt = e.serverUpdatedAt;
    return res.status(e.status).json(body);
  }
  console.error('[002] unexpected error:', e);
  return res.status(500).json({ error: 'InternalServerError' });
}

// 統一的強密碼驗證（給註冊、管理員建立、改密碼共用）
function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') return '密碼為必填';
  if (password.length < 8) return '密碼長度至少 8 字元';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    return '密碼需包含大寫字母、小寫字母、數字與特殊符號';
  }
  return null;
}

// ═══════════════════════════════════════
// Auth API（不需要驗證）
// ═══════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '');
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '');
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '電子郵件格式不正確' });
  }
  const pwdError = validateStrongPassword(password);
  if (pwdError) {
    return res.status(400).json({ error: pwdError });
  }
  const emailLower = normalizeEmail(email);
  const registerCheck = canSelfRegister(emailLower);
  if (!registerCheck.ok) {
    return res.status(403).json({ error: registerCheck.error });
  }

  const existing = queryOne("SELECT id FROM users WHERE email = ?", [emailLower]);
  if (existing) {
    return res.status(400).json({ error: '此電子郵件已被註冊' });
  }

  const id = uid();
  const firstUser = getUserCount() === 0;
  const isAdmin = firstUser ? 1 : 0;
  const passwordHash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (id, email, password_hash, display_name, has_password, is_admin, created_at) VALUES (?,?,?,?,1,?,?)",
    [id, emailLower, passwordHash, displayName, isAdmin, todayStr()]);

  createDefaultsForUser(id);
  saveDB();

  const token = jwt.sign({ userId: id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  setAuthCookie(res, token);
  res.json({ user: { id, email: emailLower, displayName, themeMode: 'system', isAdmin: !!isAdmin } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '');
  const password = String(req.body.password || '');
  if (!email || !password) {
    recordLoginAttempt({ email, req, method: 'password', isSuccess: false, failureReason: 'missing_credentials' });
    return res.status(400).json({ error: '請填寫電子郵件與密碼' });
  }

  const emailLower = email.toLowerCase();

  // 檢查是否鎖定
  const attempt = loginAttempts.get(emailLower);
  if (attempt && attempt.count >= 5 && Date.now() - attempt.lastAttempt < 30 * 60 * 1000) {
    const remaining = Math.ceil((30 * 60 * 1000 - (Date.now() - attempt.lastAttempt)) / 60000);
    recordLoginAttempt({ email: emailLower, req, method: 'password', isSuccess: false, failureReason: 'account_temporarily_locked' });
    return res.status(429).json({ error: `登入失敗次數過多，請 ${remaining} 分鐘後再試` });
  }

  const user = queryOne("SELECT * FROM users WHERE email = ?", [emailLower]);
  if (!user) {
    // FR-065 / SC-006：即使帳號不存在仍執行一次 bcrypt 比對，消除時序側信道
    await bcrypt.compare(password, DUMMY_HASH);
    trackFailedLogin(emailLower);
    recordLoginAttempt({ email: emailLower, req, method: 'password', isSuccess: false, failureReason: 'user_not_found' });
    return res.status(401).json({ error: '電子郵件或密碼錯誤' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    trackFailedLogin(emailLower);
    recordLoginAttempt({ user, email: emailLower, req, method: 'password', isSuccess: false, failureReason: 'wrong_password' });
    return res.status(401).json({ error: '電子郵件或密碼錯誤' });
  }

  // 登入成功，清除失敗記錄
  loginAttempts.delete(emailLower);
  const currentLogin = recordLoginAudit(user, req, 'password');
  recordLoginAttempt({ user, email: emailLower, req, method: 'password', isSuccess: true });

  const token = jwt.sign({ userId: user.id, tokenVersion: Number(user.token_version) || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  setAuthCookie(res, token);
  res.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url || '', themeMode: normalizeThemeMode(user.theme_mode), isAdmin: !!user.is_admin },
    currentLogin,
  });
});

function trackFailedLogin(email) {
  const current = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  current.count++;
  current.lastAttempt = Date.now();
  loginAttempts.set(email, current);
}


// 前端取得公開設定（Google Client ID 等）
app.get('/api/config', (req, res) => {
  const settings = getSystemSettings();
  const userCount = getUserCount();
  const registrationEnabled = userCount === 0 || settings.publicRegistration || settings.allowedRegistrationEmails.length > 0;
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleCodeFlow: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET), // 有 secret 時使用 code flow
    registrationEnabled,
    publicRegistration: settings.publicRegistration,
    allowlistEnabled: settings.allowedRegistrationEmails.length > 0,
  });
});

app.get('/api/auth/google/state', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ state: issueGoogleOAuthState() });
});

// 版本更新資訊（公開，不需認證）
// 從 GitHub 取得最新 changelog 並與本地合併，讓舊版本也能看到新版更新資訊
// 版本更新資訊來源固定為官方倉庫，避免被環境變數覆蓋。
const CHANGELOG_SOURCE_URL = 'https://github.com/es94111/AssetPilot/blob/main/changelog.json';
const CHANGELOG_GITHUB_URL = CHANGELOG_SOURCE_URL
  .replace('https://github.com/', 'https://raw.githubusercontent.com/')
  .replace('/blob/', '/');
const CHANGELOG_GITHUB_API_URL = 'https://api.github.com/repos/es94111/AssetPilot/contents/changelog.json?ref=main';
const APP_UPDATE_ZIP_URL = 'https://codeload.github.com/es94111/AssetPilot/zip/refs/heads/main';
let remoteChangelogCache = null;
let remoteChangelogCacheTime = 0;
const REMOTE_CHANGELOG_TTL = 30 * 60 * 1000; // 30 分鐘快取

async function fetchRemoteChangelog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && remoteChangelogCache && (now - remoteChangelogCacheTime) < REMOTE_CHANGELOG_TTL) {
    return remoteChangelogCache;
  }

  const saveCache = (data) => {
    remoteChangelogCache = data;
    remoteChangelogCacheTime = now;
    return data;
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(CHANGELOG_GITHUB_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      return saveCache(data);
    }
  } catch (e) {
    // 忽略，改走 GitHub API 備援
  }

  // 備援：某些網路環境可能無法連到 raw.githubusercontent.com
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(CHANGELOG_GITHUB_API_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AssetPilot-Changelog-Fetcher' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.content) return null;
    const jsonText = Buffer.from(String(data.content).replace(/\n/g, ''), 'base64').toString('utf8');
    return saveCache(JSON.parse(jsonText));
  } catch (e) {
    return null;
  }
}

function parseVersion(v) {
  return String(v).split('.').map(n => parseInt(n) || 0);
}

function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function mergeChangelogs(local, remote) {
  if (!remote || !remote.releases) return local;
  // 以版本號為 key 合併，遠端優先（可能有更新的版本）
  const versionMap = new Map();
  (local.releases || []).forEach(r => versionMap.set(r.version, r));
  (remote.releases || []).forEach(r => versionMap.set(r.version, r));
  const merged = Array.from(versionMap.values())
    .sort((a, b) => compareVersions(b.version, a.version));

  let latest = local.currentVersion;
  if (remote.currentVersion && compareVersions(remote.currentVersion, latest) > 0) {
    latest = remote.currentVersion;
  }
  if (merged.length > 0 && compareVersions(merged[0].version, latest) > 0) {
    latest = merged[0].version;
  }

  return {
    currentVersion: local.currentVersion, // 本地安裝的版本
    latestVersion: latest, // 遠端最新版本（以版本號比較後取最大）
    releases: merged
  };
}

function runCommand(cmd, args, cwd, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: false,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (e) { /* ignore */ }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: (stderr + '\n' + err.message).trim(), timedOut: false });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
  });
}

function trimOutput(text, max = 3000) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n...(輸出過長已截斷)';
}

async function downloadFile(url, outPath) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'AssetPilot-Updater' }
  });
  if (!resp.ok) {
    throw new Error(`下載更新檔失敗（HTTP ${resp.status}）`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

function shouldSkipUpdatePath(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (!p) return false;
  if (p === '.git' || p.startsWith('.git/')) return true;
  if (p === 'node_modules' || p.startsWith('node_modules/')) return true;
  if (p === 'data' || p.startsWith('data/')) return true;
  if (p === '.env') return true;
  if (p === 'database.db') return true;
  return false;
}

async function copyDirectoryWithOverwrite(srcDir, dstDir, rootSrcDir = srcDir) {
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = path.relative(rootSrcDir, srcPath);
    if (shouldSkipUpdatePath(relPath)) continue;

    const dstPath = path.join(dstDir, relPath);
    if (entry.isDirectory()) {
      await fs.promises.mkdir(dstPath, { recursive: true });
      await copyDirectoryWithOverwrite(srcPath, dstDir, rootSrcDir);
    } else if (entry.isFile()) {
      await fs.promises.mkdir(path.dirname(dstPath), { recursive: true });
      await fs.promises.copyFile(srcPath, dstPath);
    }
  }
}

async function applyZipUpdate(cwd) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assetpilot-update-'));
  const zipPath = path.join(tempRoot, 'update.zip');
  const extractPath = path.join(tempRoot, 'extract');

  try {
    await downloadFile(APP_UPDATE_ZIP_URL, zipPath);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const dirs = fs.readdirSync(extractPath, { withFileTypes: true }).filter(d => d.isDirectory());
    if (dirs.length === 0) {
      throw new Error('更新檔格式錯誤，找不到專案目錄');
    }

    const sourceRoot = path.join(extractPath, dirs[0].name);
    await copyDirectoryWithOverwrite(sourceRoot, cwd);
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理失敗
    }
  }
}

async function executeInAppUpdate() {
  const cwd = __dirname;
  const steps = [];

  const hasGitRepo = fs.existsSync(path.join(cwd, '.git'));
  let currentBranch = 'main';

  if (hasGitRepo) {
    const gitCheck = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], cwd, 15000);
    if (!gitCheck.ok) {
      throw new Error('找不到 Git 或 Git 專案狀態異常，請確認伺服器已安裝 Git');
    }

    const branchRes = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd, 15000);
    currentBranch = (branchRes.stdout || '').trim() || 'main';

    const gitPull = await runCommand('git', ['pull', '--ff-only', 'origin', currentBranch], cwd, 2 * 60 * 1000);
    steps.push({
      step: `git pull --ff-only origin ${currentBranch}`,
      ok: gitPull.ok,
      output: trimOutput((gitPull.stdout || '') + '\n' + (gitPull.stderr || '')),
    });
    if (!gitPull.ok) {
      throw new Error('更新失敗：無法從遠端取得最新程式碼（git pull 失敗）');
    }
  } else {
    await applyZipUpdate(cwd);
    steps.push({
      step: 'download and apply latest GitHub zip',
      ok: true,
      output: '已套用 GitHub 最新程式碼（Docker / 無 .git 模式）',
    });
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmInstall = await runCommand(npmCmd, ['install', '--omit=dev'], cwd, 5 * 60 * 1000);
  steps.push({
    step: 'npm install --omit=dev',
    ok: npmInstall.ok,
    output: trimOutput((npmInstall.stdout || '') + '\n' + (npmInstall.stderr || '')),
  });
  if (!npmInstall.ok) {
    throw new Error('程式碼已更新，但安裝套件失敗，請檢查伺服器 npm 環境');
  }

  return {
    mode: hasGitRepo ? 'git' : 'zip',
    branch: currentBranch,
    steps,
    restartRequired: true,
    message: '更新完成。若有後端程式異動，請重新啟動服務以套用。',
  };
}

app.get('/api/changelog', async (req, res) => {
  // 避免瀏覽器或中介層快取舊版本資訊
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  let local;
  try {
    local = JSON.parse(fs.readFileSync(path.join(__dirname, 'changelog.json'), 'utf8'));
  } catch (e) {
    local = { currentVersion: '0.0', releases: [] };
  }
  // refresh=1 可強制略過記憶體快取，立即抓取遠端最新內容
  const forceRefresh = req.query.refresh === '1';
  const remote = await fetchRemoteChangelog(forceRefresh);
  const merged = mergeChangelogs(local, remote);
  res.json(merged);
});

function trimTrailingSlashes(value) {
  let output = String(value || '');
  while (output.endsWith('/')) output = output.slice(0, -1);
  return output;
}

// Google SSO 登入（統一使用 Authorization Code Flow）
// T050：Google OAuth redirect_uri 白名單（FR-011 / Q10）
// 啟動時從環境變數解析；空時 fallback 至 APP_HOST + localhost 預設值
function buildGoogleRedirectAllowlist() {
  if (GOOGLE_OAUTH_REDIRECT_URIS.length > 0) return new Set(GOOGLE_OAUTH_REDIRECT_URIS);
  const fallback = [
    `https://${APP_HOST}/api/auth/google`,
    `http://localhost:${PORT}/api/auth/google`,
  ];
  console.log(`[OAuth] redirect_uri whitelist 未設定，採用預設：${fallback.join(', ')}`);
  return new Set(fallback);
}
const googleRedirectUriAllowlist = buildGoogleRedirectAllowlist();

function isAllowedGoogleRedirectUri(uri) {
  if (!uri) return false;
  if (googleRedirectUriAllowlist.has(uri)) return true;
  // 容許末端斜線差異
  const stripped = String(uri).replace(/\/$/, '');
  const withSlash = stripped + '/';
  return googleRedirectUriAllowlist.has(stripped) || googleRedirectUriAllowlist.has(withSlash);
}

app.post('/api/auth/google', async (req, res) => {
  const { code, redirect_uri, state } = req.body;
  if (!code) return res.status(400).json({ error: 'invalid_code' });

  // FR-011 / T051：交換授權碼前先比對白名單，不符立即拒絕（絕不外呼 Google）
  if (!isAllowedGoogleRedirectUri(String(redirect_uri || '').trim())) {
    recordLoginAttempt({ email: '', req, method: 'google', isSuccess: false, failureReason: 'invalid_redirect_uri' });
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }

  if (!consumeGoogleOAuthState(state)) return res.status(400).json({ error: 'state_mismatch' });
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google SSO 未設定' });
  if (!GOOGLE_CLIENT_SECRET) return res.status(400).json({ error: 'Google SSO 需設定 GOOGLE_CLIENT_SECRET' });

  try {
    let email, name, googleId, picture;

    // ─── Authorization Code Flow（使用 Client Secret 交換 token）───
    const redirectCandidates = [];
    const originalRedirect = String(redirect_uri || '').trim();
    if (originalRedirect) {
      redirectCandidates.push(originalRedirect);
      if (originalRedirect.endsWith('/')) redirectCandidates.push(trimTrailingSlashes(originalRedirect));
      else redirectCandidates.push(originalRedirect + '/');
    } else {
      redirectCandidates.push('');
    }

    let tokenRes = null;
    let tokenData = null;
    let lastTokenError = null;

    for (const ru of [...new Set(redirectCandidates)]) {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: ru,
          grant_type: 'authorization_code',
        }),
      });
      tokenData = await tokenRes.json();

      if (tokenRes.ok && tokenData.id_token) break;
      lastTokenError = tokenData;
    }

    if (!tokenRes?.ok || !tokenData?.id_token) {
      console.error('Google token exchange 失敗:', lastTokenError || tokenData);
      return res.status(401).json({ error: 'Google 授權碼交換失敗：' + ((lastTokenError || tokenData)?.error_description || (lastTokenError || tokenData)?.error || '未知錯誤') });
    }

    // 用 access_token 取得使用者資料（包含頭像）
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userinfo = await userinfoRes.json();

    // FR-001 / T053：Google email 一律走 normalizeEmail
    email = normalizeEmail(userinfo.email);
    name = userinfo.name || email?.split('@')[0] || 'Google User';
    googleId = userinfo.sub;
    picture = userinfo.picture || '';

    if (!email) return res.status(400).json({ error: '無法取得 Google 帳號 Email' });

    // 查找或建立使用者
    let user = queryOne("SELECT * FROM users WHERE google_id = ?", [googleId]);
    if (!user) user = queryOne("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      const registerCheck = canSelfRegister(email);
      if (!registerCheck.ok) {
        return res.status(403).json({ error: registerCheck.error });
      }

      const id = uid();
      const firstUser = getUserCount() === 0;
      const isAdmin = firstUser ? 1 : 0;
      const randomHash = await bcrypt.hash(uid() + Date.now(), 10);
      db.run("INSERT INTO users (id, email, password_hash, display_name, google_id, avatar_url, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [id, email, randomHash, name, googleId, picture, isAdmin, todayStr()]);
      createDefaultsForUser(id);
      saveDB();
      user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
    } else {
      // 更新 Google ID、頭像、名稱
      const updates = [];
      const vals = [];
      if (!user.google_id) { updates.push('google_id = ?'); vals.push(googleId); }
      if (picture && picture !== user.avatar_url) { updates.push('avatar_url = ?'); vals.push(picture); }
      if (name && (!user.display_name || user.display_name === user.email?.split('@')[0])) {
        updates.push('display_name = ?'); vals.push(name);
      }
      if (updates.length > 0) {
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...vals, user.id]);
        saveDB();
        user = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
      }
    }

    const currentLogin = recordLoginAudit(user, req, 'google');
    recordLoginAttempt({ user, email: user.email, req, method: 'google', isSuccess: true });
    const token = jwt.sign({ userId: user.id, tokenVersion: Number(user.token_version) || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    setAuthCookie(res, token);
    res.json({
      user: {
        id: user.id, email: user.email, displayName: user.display_name,
        googleLinked: true, avatarUrl: user.avatar_url || '', themeMode: normalizeThemeMode(user.theme_mode), isAdmin: !!user.is_admin,
      },
      currentLogin,
    });
  } catch (e) {
    console.error('Google SSO 錯誤:', e.message);
    res.status(500).json({ error: 'Google 登入失敗：' + e.message });
  }
});

// ─── Passkey (WebAuthn) ───
const passkeyChallenge = new Map(); // key → { challenge, userId?, expiresAt }

function issuePasskeyChallenge(userId) {
  const challenge = webauthnServer.randomChallenge();
  const key = crypto.randomUUID();
  passkeyChallenge.set(key, { challenge, userId: userId || null, expiresAt: Date.now() + 5 * 60 * 1000 });
  // 清理過期
  for (const [k, v] of passkeyChallenge) {
    if (v.expiresAt < Date.now()) passkeyChallenge.delete(k);
  }
  return { key, challenge };
}

function consumePasskeyChallenge(key) {
  const entry = passkeyChallenge.get(key);
  if (!entry) return null;
  passkeyChallenge.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

// 取得 challenge（公開，登入用）
app.get('/api/auth/passkey/challenge', (req, res) => {
  const { key, challenge } = issuePasskeyChallenge(null);
  res.json({ key, challenge });
});

// Passkey 登入
app.post('/api/auth/passkey/login', async (req, res) => {
  const { authentication, challengeKey } = req.body;
  if (!authentication || !challengeKey) return res.status(400).json({ error: '缺少認證資料' });

  const entry = consumePasskeyChallenge(challengeKey);
  if (!entry) return res.status(400).json({ error: 'Challenge 已過期或無效，請重試' });

  // 用 credential id 查找憑證
  const cred = queryOne("SELECT * FROM passkey_credentials WHERE credential_id = ?", [authentication.id]);
  if (!cred) {
    recordLoginAttempt({ email: '', req, method: 'passkey', isSuccess: false, failureReason: 'credential_not_found' });
    return res.status(401).json({ error: '找不到對應的 Passkey 憑證' });
  }

  const user = queryOne("SELECT * FROM users WHERE id = ?", [cred.user_id]);
  if (!user) return res.status(401).json({ error: '使用者不存在' });

  try {
    const credentialKey = {
      id: cred.credential_id,
      publicKey: cred.public_key,
      algorithm: cred.algorithm,
      transports: JSON.parse(cred.transports || '[]'),
    };

    const origin = getTrustedOrigin(req);
    const expected = {
      challenge: entry.challenge,
      origin,
      userVerified: true,
      counter: cred.counter,
    };

    const result = await webauthnServer.verifyAuthentication(authentication, credentialKey, expected);

    // 更新 counter
    db.run("UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?", [result.counter || 0, cred.credential_id]);
    saveDB();

    loginAttempts.delete(user.email);
    const currentLogin = recordLoginAudit(user, req, 'passkey');
    recordLoginAttempt({ user, email: user.email, req, method: 'passkey', isSuccess: true });

    const token = jwt.sign({ userId: user.id, tokenVersion: Number(user.token_version) || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    setAuthCookie(res, token);
    res.json({
      user: {
        id: user.id, email: user.email, displayName: user.display_name,
        googleLinked: !!user.google_id, hasPassword: !!user.has_password,
        avatarUrl: user.avatar_url || '', themeMode: normalizeThemeMode(user.theme_mode), isAdmin: !!user.is_admin,
      },
      currentLogin,
    });
  } catch (e) {
    console.error('Passkey 驗證失敗:', e.message);
    recordLoginAttempt({ user, email: user.email, req, method: 'passkey', isSuccess: false, failureReason: 'verification_failed' });
    return res.status(401).json({ error: 'Passkey 驗證失敗：' + e.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  // FR-005：登出遞增 token_version，使該使用者所有裝置舊 JWT 立即失效
  try {
    const token = req.cookies?.authToken;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      if (decoded?.userId) {
        db.run("UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", [decoded.userId]);
        saveDB();
      }
    }
  } catch (e) { /* token 已失效也無妨，仍清除 Cookie */ }
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = queryOne("SELECT id, email, display_name, google_id, has_password, avatar_url, theme_mode, is_admin FROM users WHERE id = ?", [req.userId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  res.json({ user: { id: user.id, email: user.email, displayName: user.display_name, googleLinked: !!user.google_id, hasPassword: !!user.has_password, avatarUrl: user.avatar_url || '', themeMode: normalizeThemeMode(user.theme_mode), isAdmin: !!user.is_admin } });
});

// ═══════════════════════════════════════
// 以下所有 API 路由需要驗證
// ═══════════════════════════════════════
app.use('/api', authMiddleware);

// CT-1：/api/account/login-logs → /api/user/login-audit（FR-042：使用者最近 100 筆）
app.get('/api/user/login-audit', async (req, res) => {
  const logs = queryAll(
    `SELECT login_at, ip_address, country, login_method, is_admin_login
     FROM login_audit_logs
     WHERE user_id = ?
     ORDER BY login_at DESC
     LIMIT 100`,
    [req.userId]
  );
  const logsWithCountry = await enrichAndPersistCountry(logs, 'login_audit_logs');
  res.json({
    logs: logsWithCountry.map(l => ({
      loginAt: Number(l.login_at) || 0,
      ipAddress: l.ip_address || 'unknown',
      country: l.country || '-',
      loginMethod: l.login_method || 'password',
      isAdminLogin: !!l.is_admin_login,
    })),
  });
});

// CT-1：/api/admin/login-logs* → /api/admin/login-audit（FR-043：scope=admin-self 或 all）
app.get('/api/admin/login-audit', adminMiddleware, async (req, res) => {
  const scope = String(req.query.scope || '').toLowerCase();
  if (scope === 'admin-self' || scope === 'admin_self') {
    const adminLogs = queryAll(
      `SELECT id, rowid AS _rid, login_at, ip_address, country, login_method
       FROM login_audit_logs
       WHERE user_id = ? AND is_admin_login = 1
       ORDER BY login_at DESC
       LIMIT 200`,
      [req.userId]
    );
    const enriched = await enrichAndPersistCountry(adminLogs, 'login_audit_logs');
    return res.json({
      scope: 'admin-self',
      logs: enriched.map(l => ({
        id: l.id || (Number(l._rid) > 0 ? `rid:${Number(l._rid)}` : `ts:${Number(l.login_at) || 0}`),
        loginAt: Number(l.login_at) || 0,
        ipAddress: l.ip_address || 'unknown',
        country: l.country || '-',
        loginMethod: l.login_method || 'password',
      })),
    });
  }
  // default: scope = 'all' — 全站 500 筆（含失敗嘗試）
  const allUserLogs = queryAll(
    `SELECT l.id, l.rowid AS _rid, l.user_id, l.email, l.login_at, l.ip_address, l.country, l.login_method, l.is_admin_login, l.is_success, l.failure_reason, u.display_name
     FROM login_attempt_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.login_at DESC
     LIMIT 500`
  );
  const enriched = await enrichAndPersistCountry(allUserLogs, 'login_attempt_logs');
  res.json({
    scope: 'all',
    logs: enriched.map(l => ({
      id: l.id || (Number(l._rid) > 0 ? `rid:${Number(l._rid)}` : `ts:${Number(l.login_at) || 0}`),
      userId: l.user_id,
      email: l.email || '',
      displayName: l.display_name || '',
      loginAt: Number(l.login_at) || 0,
      ipAddress: l.ip_address || 'unknown',
      country: l.country || '-',
      loginMethod: l.login_method || 'password',
      isAdminLogin: !!l.is_admin_login,
      isSuccess: !!l.is_success,
      failureReason: l.failure_reason || '',
    })),
  });
});

// 刪除單筆：FR-045 備援識別（id / rowid / timestamp）嘗試兩個表
function deleteLoginAuditSingle(target, userId) {
  let deleted = 0;
  // 先試 admin-self 範圍的 login_audit_logs
  if (target.byRowId) {
    db.run("DELETE FROM login_audit_logs WHERE rowid = ?", [target.value]);
  } else if (target.byTimestamp) {
    db.run(
      `DELETE FROM login_audit_logs WHERE rowid IN (
         SELECT rowid FROM login_audit_logs WHERE login_at = ? ORDER BY rowid DESC LIMIT 1
       )`,
      [target.value]
    );
  } else {
    db.run("DELETE FROM login_audit_logs WHERE id = ?", [target.value]);
  }
  deleted += db.getRowsModified();
  if (deleted > 0) return deleted;
  // 再試 login_attempt_logs（all 範圍）
  if (target.byRowId) {
    db.run("DELETE FROM login_attempt_logs WHERE rowid = ?", [target.value]);
  } else if (target.byTimestamp) {
    db.run(
      `DELETE FROM login_attempt_logs WHERE rowid IN (
         SELECT rowid FROM login_attempt_logs WHERE login_at = ? ORDER BY rowid DESC LIMIT 1
       )`,
      [target.value]
    );
  } else {
    db.run("DELETE FROM login_attempt_logs WHERE id = ?", [target.value]);
  }
  deleted += db.getRowsModified();
  return deleted;
}

app.delete('/api/admin/login-audit/:logId', adminMiddleware, (req, res) => {
  const target = parseLoginLogTarget(req.params.logId);
  if (!target) return res.status(400).json({ error: '缺少紀錄 ID' });
  const deleted = deleteLoginAuditSingle(target, req.userId);
  if (!deleted) return res.status(404).json({ error: '登入紀錄不存在' });
  saveDB();
  res.json({ deleted });
});

// 批次刪除：`:batch-delete` 為 RPC 動作式路徑（Express 5 path-to-regexp 支援 `\\:` 逸出冒號）
app.post('/api/admin/login-audit\\:batch-delete', adminMiddleware, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: '請選擇要刪除的紀錄' });
  let deleted = 0;
  ids.forEach((rawId) => {
    const target = parseLoginLogTarget(rawId);
    if (!target) return;
    deleted += deleteLoginAuditSingle(target, req.userId);
  });
  saveDB();
  res.json({ deleted });
});

// CT-1：/api/admin/settings → /api/admin/system-settings（server.js 對齊契約）
app.get('/api/admin/system-settings', adminMiddleware, (req, res) => {
  const settings = getSystemSettings();
  res.json(settings);
});

app.put('/api/admin/system-settings', adminMiddleware, (req, res) => {
  const publicRegistration = !!req.body?.publicRegistration;
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(req.body?.allowedRegistrationEmails);
  const adminIpAllowlist = parseIpAllowlist(req.body?.adminIpAllowlist);
  db.run(
    "UPDATE system_settings SET public_registration = ?, allowed_registration_emails = ?, admin_ip_allowlist = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [publicRegistration ? 1 : 0, allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'), Date.now(), req.userId]
  );
  saveDB();
  res.json({ success: true, publicRegistration, allowedRegistrationEmails, adminIpAllowlist });
});

// ─── 伺服器時間 ───────────────────────────────────────────────────────────
// GET /api/admin/server-time — 取得當前伺服器時間與偏移
app.get('/api/admin/server-time', adminMiddleware, (req, res) => {
  const realNow = Date.now();
  const effectiveNow = realNow + SERVER_TIME_OFFSET;
  res.json({
    realNow,
    realNowIso: new Date(realNow).toISOString(),
    effectiveNow,
    effectiveNowIso: new Date(effectiveNow).toISOString(),
    offsetMs: SERVER_TIME_OFFSET,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// PUT /api/admin/server-time — 設定伺服器時間（以偏移量表示）
// body：{ mode: 'reset' } 直接清 0；{ mode: 'offset', offsetMs } 直接設定偏移；
// { mode: 'target', targetIso } 或 { mode: 'target', targetMs } 依目標時間回推偏移
app.put('/api/admin/server-time', adminMiddleware, (req, res) => {
  const mode = String(req.body?.mode || '').trim();
  let offsetMs = SERVER_TIME_OFFSET;

  if (mode === 'reset') {
    offsetMs = 0;
  } else if (mode === 'offset') {
    const n = Number(req.body?.offsetMs);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'offsetMs 必須為數字（毫秒）' });
    offsetMs = Math.trunc(n);
  } else if (mode === 'target') {
    let target;
    if (req.body?.targetMs !== undefined) {
      target = Number(req.body.targetMs);
    } else if (req.body?.targetIso) {
      target = new Date(String(req.body.targetIso)).getTime();
    }
    if (!Number.isFinite(target)) return res.status(400).json({ error: '目標時間格式錯誤' });
    offsetMs = target - Date.now();
  } else {
    return res.status(400).json({ error: 'mode 必須為 reset / offset / target 其中之一' });
  }

  // 限制偏移量最多 ±10 年，避免誤植導致後續運算溢位
  const MAX_OFFSET = 10 * 365 * 24 * 60 * 60 * 1000;
  if (Math.abs(offsetMs) > MAX_OFFSET) {
    return res.status(400).json({ error: '偏移量超過 ±10 年上限' });
  }

  db.run(
    "UPDATE system_settings SET server_time_offset = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [offsetMs, Date.now(), req.userId]
  );
  saveDB();
  SERVER_TIME_OFFSET = offsetMs;

  const realNow = Date.now();
  const effectiveNow = realNow + SERVER_TIME_OFFSET;
  res.json({
    success: true,
    realNow,
    effectiveNow,
    effectiveNowIso: new Date(effectiveNow).toISOString(),
    offsetMs: SERVER_TIME_OFFSET,
  });
});

// POST /api/admin/server-time/ntp-sync — 以 NTP 時間校正伺服器採用時間
// body：{ host?: string, apply?: boolean }
//   - host：指定 NTP 伺服器（省略則依序嘗試 tw/pool/google/cloudflare）
//   - apply：是否寫入偏移（預設 true）；false 時僅回傳量測結果供預覽
app.post('/api/admin/server-time/ntp-sync', adminMiddleware, async (req, res) => {
  const rawHost = typeof req.body?.host === 'string' ? req.body.host.trim() : '';
  const apply = req.body?.apply === false ? false : true;
  let candidates = DEFAULT_NTP_SERVERS;
  if (rawHost) {
    const v = validateNtpHost(rawHost);
    if (!v.ok) return res.status(400).json({ error: v.error });
    candidates = [v.host];
  }
  try {
    const { ntpMs, roundTripMs, host: usedHost, resolvedIp } = await queryNtpWithFallback(candidates);
    // 扣掉單趟網路延遲（假設對稱），提升精準度
    const correctedNtpMs = ntpMs + Math.round(roundTripMs / 2);
    const realNow = Date.now();
    const newOffset = correctedNtpMs - realNow;

    const MAX_OFFSET = 10 * 365 * 24 * 60 * 60 * 1000;
    if (Math.abs(newOffset) > MAX_OFFSET) {
      return res.status(400).json({ error: 'NTP 計算出的偏移量超過 ±10 年上限，疑似伺服器回應異常' });
    }

    const previousOffsetMs = SERVER_TIME_OFFSET;
    if (apply) {
      db.run(
        "UPDATE system_settings SET server_time_offset = ?, updated_at = ?, updated_by = ? WHERE id = 1",
        [newOffset, Date.now(), req.userId]
      );
      saveDB();
      SERVER_TIME_OFFSET = newOffset;
    }

    res.json({
      success: true,
      applied: apply,
      host: usedHost,
      resolvedIp,
      roundTripMs,
      ntpMs: correctedNtpMs,
      ntpIso: new Date(correctedNtpMs).toISOString(),
      realNow,
      proposedOffsetMs: newOffset,
      offsetMs: SERVER_TIME_OFFSET,
      previousOffsetMs,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || 'NTP 同步失敗' });
  }
});

// ─── 憑證管理 API ───────────────────────────────────────────────────────────

// GET /api/admin/certs — 取得 Origin Certificate 狀態
app.get('/api/admin/certs', adminMiddleware, (req, res) => {
  res.json({
    originCert:      getCertInfo(SSL_ORIGIN_CERT),
    originKeyExists: fs.existsSync(SSL_ORIGIN_KEY),
    originCa:        getCertInfo(SSL_ORIGIN_CA),
  });
});

// POST /api/admin/certs/origin — 上傳 Origin Certificate（需重啟才生效）
app.post('/api/admin/certs/origin', adminMiddleware, (req, res) => {
  const cert = typeof req.body?.cert === 'string' ? req.body.cert : undefined;
  const key = typeof req.body?.key === 'string' ? req.body.key : undefined;
  if (cert !== undefined) {
    if (!validatePemCert(cert)) return res.status(400).json({ error: '憑證格式錯誤' });
    try { new crypto.X509Certificate(cert); } catch (e) {
      return res.status(400).json({ error: '憑證解析失敗：' + e.message });
    }
    if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
    fs.writeFileSync(SSL_ORIGIN_CERT, cert.trim() + '\n', 'utf-8');
  }
  if (key !== undefined) {
    if (!validatePemKey(key)) return res.status(400).json({ error: '私鑰格式錯誤' });
    if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
    fs.writeFileSync(SSL_ORIGIN_KEY, key.trim() + '\n', 'utf-8');
  }
  res.json({ ok: true, cert: getCertInfo(SSL_ORIGIN_CERT), keyExists: fs.existsSync(SSL_ORIGIN_KEY), requiresRestart: true });
});

// POST /api/admin/certs/origin/ca — 上傳 Cloudflare Origin CA 憑證（需重啟才生效）
app.post('/api/admin/certs/origin/ca', adminMiddleware, (req, res) => {
  const cert = typeof req.body?.cert === 'string' ? req.body.cert : '';
  if (!validatePemCert(cert)) return res.status(400).json({ error: 'Origin CA 憑證格式錯誤，需為 PEM 格式' });
  try { new crypto.X509Certificate(cert); } catch (e) {
    return res.status(400).json({ error: 'Origin CA 憑證解析失敗：' + e.message });
  }
  if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
  fs.writeFileSync(SSL_ORIGIN_CA, cert.trim() + '\n', 'utf-8');
  res.json({ ok: true, cert: getCertInfo(SSL_ORIGIN_CA), requiresRestart: true });
});

// DELETE /api/admin/certs/origin/ca — 刪除 Cloudflare Origin CA 憑證（需重啟才生效）
app.delete('/api/admin/certs/origin/ca', adminMiddleware, (req, res) => {
  try { if (fs.existsSync(SSL_ORIGIN_CA)) fs.unlinkSync(SSL_ORIGIN_CA); } catch (_) {}
  res.json({ ok: true, requiresRestart: true });
});

// DELETE /api/admin/certs/origin — 刪除 Origin Certificate（需重啟才生效）
app.delete('/api/admin/certs/origin', adminMiddleware, (req, res) => {
  [SSL_ORIGIN_CERT, SSL_ORIGIN_KEY, SSL_ORIGIN_CA].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} });
  res.json({ ok: true, requiresRestart: true });
});

app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = queryAll("SELECT id, email, display_name, created_at, google_id, has_password, is_admin FROM users ORDER BY created_at DESC, email ASC");
  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    createdAt: u.created_at,
    googleLinked: !!u.google_id,
    hasPassword: !!u.has_password,
    isAdmin: !!u.is_admin,
  })));
});

app.post('/api/admin/users', adminMiddleware, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim();
  const isAdmin = !!req.body?.isAdmin;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '電子郵件格式不正確' });
  }
  const pwdError = validateStrongPassword(password);
  if (pwdError) {
    return res.status(400).json({ error: pwdError });
  }
  const existing = queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    return res.status(400).json({ error: '此電子郵件已被註冊' });
  }

  const id = uid();
  const passwordHash = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (id, email, password_hash, display_name, has_password, is_admin, created_at) VALUES (?,?,?,?,1,?,?)",
    [id, email, passwordHash, displayName, isAdmin ? 1 : 0, todayStr()]
  );
  createDefaultsForUser(id);
  saveDB();

  res.json({ success: true, user: { id, email, displayName, isAdmin } });
});

// PUT /api/admin/users/:id/password — 管理員重設使用者密碼
app.put('/api/admin/users/:id/password', adminMiddleware, async (req, res) => {
  const targetId = req.params.id;
  const newPassword = String(req.body?.newPassword || '');
  if (!targetId) return res.status(400).json({ error: '缺少使用者 ID' });
  const pwdError = validateStrongPassword(newPassword);
  if (pwdError) return res.status(400).json({ error: pwdError });

  const user = queryOne("SELECT id, password_hash FROM users WHERE id = ?", [targetId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  if (user.password_hash) {
    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsOld) return res.status(400).json({ error: 'same_as_current_password' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // 管理員重設密碼也需撤銷目標使用者的所有 JWT
  db.run("UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", [passwordHash, targetId]);
  saveDB();
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const targetId = req.params.id;
  if (!targetId) return res.status(400).json({ error: '缺少使用者 ID' });

  const user = queryOne("SELECT id, is_admin FROM users WHERE id = ?", [targetId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  // FR-036：無法使系統無管理員（涵蓋自刪最後管理員）
  if (user.is_admin) {
    const adminCount = Number(queryOne("SELECT COUNT(1) AS count FROM users WHERE is_admin = 1")?.count || 0);
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'last_admin_protected' });
    }
  }

  // FR-035：混合刪除策略
  deleteUserData(targetId);
  saveDB();
  res.json({ success: true });
});

// ─── 寄送資產統計報表（管理員）───
function escapeEmailHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value, currency = 'TWD') {
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${sign}${currency} ${formatted}`;
}

function prevMonthOf(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 依排程頻率決定信件「交易區塊」的時間範圍
//   daily   → 前一天（個別交易明細）
//   weekly  → 上一個完整週 (Mon-Sun)（每日彙總）
//   monthly → 上個月 (1日 ~ 月底)（每日彙總）
//   off/未知 → 預設 daily 行為（手動觸發場景）
function getReportPeriod(freq, now = new Date()) {
  if (freq === 'weekly') {
    const day = now.getDay(); // 0=Sun
    const daysSinceMon = (day + 6) % 7; // 0 if Mon
    const lastSun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMon - 1);
    const lastMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMon - 7);
    return { kind: 'weekly', start: ymd(lastMon), end: ymd(lastSun), label: `上週（${ymd(lastMon)} ~ ${ymd(lastSun)}）每日收支` };
  }
  if (freq === 'monthly') {
    const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
    return { kind: 'monthly', start: ymd(firstOfPrev), end: ymd(lastOfPrev), label: `上月（${firstOfPrev.getFullYear()}-${String(firstOfPrev.getMonth() + 1).padStart(2, '0')}）每日收支` };
  }
  // daily 或其他
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return { kind: 'daily', start: ymd(yesterday), end: ymd(yesterday), label: `昨日（${ymd(yesterday)}）交易明細` };
}

function pctChange(current, prev) {
  const c = Number(current) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c === 0 ? 0 : null; // 無基準
  return ((c - p) / Math.abs(p)) * 100;
}

function buildUserStatsReport(userId, freq = 'daily') {
  const month = thisMonth();
  const monthLike = month + '%';
  const prevMonth = prevMonthOf(month);
  const prevMonthLike = prevMonth + '%';

  const accounts = queryAll(
    "SELECT id, name, initial_balance, currency, exclude_from_total FROM accounts WHERE user_id = ?",
    [userId]
  );
  const balanceByCurrency = {};
  let includedAccountCount = 0;
  for (const a of accounts) {
    const cur = normalizeCurrency(a.currency);
    const bal = calcBalance(a.id, a.initial_balance, userId, cur);
    if (!a.exclude_from_total) {
      balanceByCurrency[cur] = (balanceByCurrency[cur] || 0) + bal;
      includedAccountCount += 1;
    }
  }

  const sumOf = (type, like) => Number(queryOne(
    `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type = ? AND date LIKE ? AND exclude_from_stats = 0`,
    [userId, type, like]
  )?.total || 0);
  const income = sumOf('income', monthLike);
  const expense = sumOf('expense', monthLike);
  const prevIncome = sumOf('income', prevMonthLike);
  const prevExpense = sumOf('expense', prevMonthLike);

  const topCategories = queryAll(`
    SELECT COALESCE(c.name, '未分類') as name, COALESCE(c.color, '#94a3b8') as color, COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
    GROUP BY c.name, c.color
    ORDER BY total DESC
    LIMIT 5
  `, [userId, monthLike]).map(r => ({ name: r.name, color: r.color, total: Number(r.total) || 0 }));
  const topCategoriesMax = topCategories.reduce((m, c) => Math.max(m, c.total), 0);

  // 依頻率組「交易區塊」：daily=明細、weekly/monthly=每日彙總
  const period = getReportPeriod(freq);
  let transactionsSection;
  if (period.kind === 'daily') {
    const txs = queryAll(`
      SELECT t.date, t.type, t.amount, t.note, COALESCE(c.name, '未分類') as cat_name, COALESCE(c.color, '#94a3b8') as cat_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0
            AND t.date = ?
      ORDER BY t.created_at DESC
    `, [userId, period.start]).map(r => ({
      date: r.date, type: r.type, amount: Number(r.amount) || 0, note: r.note || '',
      categoryName: r.cat_name, categoryColor: r.cat_color,
    }));
    transactionsSection = { kind: 'daily', date: period.start, label: period.label, transactions: txs };
  } else {
    // weekly / monthly：每日彙總
    const rows = queryAll(`
      SELECT t.date, t.type, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0
            AND t.date >= ? AND t.date <= ?
      GROUP BY t.date, t.type
      ORDER BY t.date
    `, [userId, period.start, period.end]);
    // 補齊區間內所有日期（即使該日無交易）
    const map = {}; // date -> { income, expense }
    for (const r of rows) {
      if (!map[r.date]) map[r.date] = { income: 0, expense: 0 };
      map[r.date][r.type] = Number(r.total) || 0;
    }
    const dailyBreakdown = [];
    const startDt = new Date(period.start + 'T00:00:00');
    const endDt = new Date(period.end + 'T00:00:00');
    for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
      const k = ymd(d);
      const v = map[k] || { income: 0, expense: 0 };
      dailyBreakdown.push({ date: k, weekday: d.getDay(), income: v.income, expense: v.expense, net: v.income - v.expense });
    }
    const totalIncome = dailyBreakdown.reduce((s, r) => s + r.income, 0);
    const totalExpense = dailyBreakdown.reduce((s, r) => s + r.expense, 0);
    transactionsSection = {
      kind: period.kind, start: period.start, end: period.end, label: period.label,
      dailyBreakdown, totalIncome, totalExpense, totalNet: totalIncome - totalExpense,
    };
  }

  const stocks = queryAll("SELECT id, symbol, name, current_price FROM stocks WHERE user_id = ?", [userId]);
  let stockHoldings = 0;
  let stockCostTwd = 0;
  let stockMarketValueTwd = 0;
  for (const s of stocks) {
    const txs = queryAll(
      "SELECT type, shares, price, fee FROM stock_transactions WHERE stock_id = ? AND user_id = ?",
      [s.id, userId]
    );
    let shares = 0;
    let cost = 0;
    for (const t of txs) {
      const sh = Number(t.shares) || 0;
      const pr = Number(t.price) || 0;
      const fee = Number(t.fee) || 0;
      if (t.type === 'buy') {
        shares += sh;
        cost += sh * pr + fee;
      } else if (t.type === 'sell') {
        if (shares > 0) {
          const avg = cost / shares;
          cost -= avg * Math.min(sh, shares);
        }
        shares -= sh;
      }
    }
    if (shares > 0) {
      const cp = Number(s.current_price) || 0;
      stockHoldings += 1;
      stockCostTwd += Math.max(0, cost);
      stockMarketValueTwd += shares * cp;
    }
  }
  const stockUnrealizedPL = stockMarketValueTwd - stockCostTwd;
  const stockReturnPct = stockCostTwd > 0 ? (stockUnrealizedPL / stockCostTwd) * 100 : null;

  const net = income - expense;
  const savingsRate = income > 0 ? Math.max(0, Math.min(1, net / income)) : 0;

  return {
    month,
    prevMonth,
    accountCount: includedAccountCount,
    balanceByCurrency,
    income,
    expense,
    net,
    incomeChangePct: pctChange(income, prevIncome),
    expenseChangePct: pctChange(expense, prevExpense),
    netChangePct: pctChange(net, prevIncome - prevExpense),
    savingsRate,
    topCategories,
    topCategoriesMax,
    transactionsSection,
    stockHoldings,
    stockCostTwd: Math.round(stockCostTwd),
    stockMarketValueTwd: Math.round(stockMarketValueTwd),
    stockUnrealizedPL: Math.round(stockUnrealizedPL),
    stockReturnPct,
  };
}

function renderChangePill(pct, kind) {
  // kind: 'good-up' (income up = good) | 'good-down' (expense down = good) | 'neutral'
  if (pct === null || pct === undefined) {
    return '<span style="font-size:11px;color:#888">vs. 上月 —</span>';
  }
  const rounded = Math.round(pct * 10) / 10;
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '→';
  const isPositive = rounded > 0;
  let color = '#888';
  if (kind === 'good-up') color = isPositive ? '#16a34a' : (rounded < 0 ? '#dc2626' : '#888');
  else if (kind === 'good-down') color = isPositive ? '#dc2626' : (rounded < 0 ? '#16a34a' : '#888');
  const sign = rounded > 0 ? '+' : '';
  return `<span style="font-size:11px;color:${color}">vs. 上月 ${arrow} ${sign}${rounded}%</span>`;
}

function renderStatsEmailHtml(displayName, email, stats) {
  const safeName = escapeEmailHtml(displayName || (email ? email.split('@')[0] : '') || '使用者');
  const month = escapeEmailHtml(stats.month);

  // ─── 顏色 / 排版 共用樣式 ───
  const COLOR_PRIMARY = '#4f46e5';
  const COLOR_PRIMARY_LIGHT = '#e0e7ff';
  const COLOR_INK = '#0f172a';
  const COLOR_MUTED = '#64748b';
  const COLOR_BORDER = '#e2e8f0';
  const COLOR_BG_SOFT = '#f8fafc';
  const COLOR_GREEN = '#16a34a';
  const COLOR_RED = '#dc2626';
  const COLOR_AMBER = '#f59e0b';

  // KPI 卡 — 三欄等寬，含 hover-like 邊框
  const kpiCard = (label, value, color, pillHtml) => `
    <td valign="top" width="33%" style="padding:0 5px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:12px;border:1px solid ${COLOR_BORDER};box-shadow:0 1px 2px rgba(15,23,42,0.04)">
        <tr><td style="padding:16px 12px;text-align:center">
          <div style="font-size:11px;color:${COLOR_MUTED};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;font-weight:600">${escapeEmailHtml(label)}</div>
          <div style="font-size:20px;font-weight:700;color:${color};line-height:1.2;letter-spacing:-0.01em">${escapeEmailHtml(value)}</div>
          <div style="margin-top:8px">${pillHtml}</div>
        </td></tr>
      </table>
    </td>`;

  const kpiRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 4px;border-collapse:separate"><tr>
      ${kpiCard('本月收入', formatAmount(stats.income), COLOR_GREEN, renderChangePill(stats.incomeChangePct, 'good-up'))}
      ${kpiCard('本月支出', formatAmount(stats.expense), COLOR_RED, renderChangePill(stats.expenseChangePct, 'good-down'))}
      ${kpiCard('本月淨額', formatAmount(stats.net), stats.net >= 0 ? COLOR_INK : COLOR_RED, renderChangePill(stats.netChangePct, 'good-up'))}
    </tr></table>`;

  // 儲蓄率
  const sr = Math.round(stats.savingsRate * 100);
  const srColor = sr >= 30 ? COLOR_GREEN : sr >= 10 ? COLOR_AMBER : COLOR_RED;
  const srLabel = sr >= 30 ? '健康' : sr >= 10 ? '尚可' : '偏低';
  const srBlock = stats.income > 0 ? `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 4px;background:${COLOR_BG_SOFT};border-radius:10px;border:1px solid ${COLOR_BORDER}"><tr><td style="padding:14px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="font-size:13px;color:${COLOR_MUTED};font-weight:600">本月儲蓄率</td>
        <td style="font-size:13px;text-align:right"><span style="color:${srColor};font-weight:700;font-size:15px">${sr}%</span> <span style="color:${COLOR_MUTED};font-size:11px">· ${srLabel}</span></td>
      </tr></table>
      <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px">
        <div style="height:8px;width:${sr}%;background:linear-gradient(90deg,${srColor},${srColor})"></div>
      </div>
    </td></tr></table>` : '';

  // 帳戶餘額
  const balanceRows = Object.keys(stats.balanceByCurrency).length
    ? Object.entries(stats.balanceByCurrency)
        .map(([cur, total]) => `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER};color:${COLOR_MUTED};font-size:13px;font-weight:600">${escapeEmailHtml(cur)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER};text-align:right;color:${COLOR_INK};font-weight:700;font-size:15px">${escapeEmailHtml(formatAmount(total, cur))}</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:14px;color:#94a3b8;text-align:center;font-size:13px">尚無帳戶</td></tr>`;

  // 前 5 大支出（彩色比例條）
  const catRows = stats.topCategories.length
    ? stats.topCategories.map((c, idx) => {
        const pct = stats.topCategoriesMax > 0 ? Math.round((c.total / stats.topCategoriesMax) * 100) : 0;
        const safeColor = /^#[0-9A-Fa-f]{3,8}$/.test(c.color) ? c.color : '#94a3b8';
        return `<tr><td style="padding:11px 14px;border-bottom:1px solid ${COLOR_BORDER}">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:6px"><tr>
            <td style="font-size:13px;color:${COLOR_INK}">
              <span style="display:inline-block;width:18px;color:${COLOR_MUTED};font-size:11px">${idx + 1}.</span>
              ${escapeEmailHtml(c.name)}
            </td>
            <td style="font-size:13px;color:${COLOR_INK};font-weight:700;text-align:right">${escapeEmailHtml(formatAmount(c.total))}</td>
          </tr></table>
          <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden">
            <div style="height:6px;width:${pct}%;background:${safeColor};border-radius:999px"></div>
          </div>
        </td></tr>`;
      }).join('')
    : `<tr><td style="padding:14px;color:#94a3b8;text-align:center;font-size:13px">本月尚無支出紀錄</td></tr>`;

  // 交易區塊（依排程 freq 切換）
  const txSection = stats.transactionsSection || { kind: 'daily', transactions: [], label: '近期交易' };
  const txSectionTitle = txSection.label || '交易紀錄';
  const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  let txContent;
  if (txSection.kind === 'daily') {
    const items = txSection.transactions || [];
    txContent = items.length
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:14px"><tbody>${
          items.map(t => {
            const isIncome = t.type === 'income';
            const sign = isIncome ? '+' : '−';
            const color = isIncome ? COLOR_GREEN : COLOR_RED;
            const safeColor = /^#[0-9A-Fa-f]{3,8}$/.test(t.categoryColor) ? t.categoryColor : '#94a3b8';
            const note = t.note ? `<div style="color:#94a3b8;font-size:12px;margin-top:2px">${escapeEmailHtml(t.note)}</div>` : '';
            return `<tr>
              <td style="padding:11px 14px;border-bottom:1px solid ${COLOR_BORDER}">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
                  <td>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor};margin-right:8px;vertical-align:middle"></span>
                    <span style="color:${COLOR_INK};font-weight:600">${escapeEmailHtml(t.categoryName)}</span>
                    ${note}
                  </td>
                  <td style="text-align:right;color:${color};font-weight:700;white-space:nowrap;vertical-align:top">${sign}${escapeEmailHtml(formatAmount(t.amount))}</td>
                </tr></table>
              </td>
            </tr>`;
          }).join('')
        }</tbody></table>`
      : `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:13px;background:${COLOR_BG_SOFT};border-radius:10px">這天沒有任何收入或支出紀錄</div>`;
  } else {
    // weekly / monthly：每日彙總表
    const rows = txSection.dailyBreakdown || [];
    const totalIncome = txSection.totalIncome || 0;
    const totalExpense = txSection.totalExpense || 0;
    const totalNet = txSection.totalNet || 0;
    const summaryColor = totalNet >= 0 ? COLOR_GREEN : COLOR_RED;
    const summaryHeader = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;background:${COLOR_BG_SOFT};border-radius:10px;border:1px solid ${COLOR_BORDER}"><tr>
        <td style="padding:12px 14px;text-align:center;border-right:1px solid ${COLOR_BORDER}">
          <div style="font-size:11px;color:${COLOR_MUTED};letter-spacing:0.06em;text-transform:uppercase;font-weight:600">區間收入</div>
          <div style="font-size:15px;color:${COLOR_GREEN};font-weight:700;margin-top:2px">${escapeEmailHtml(formatAmount(totalIncome))}</div>
        </td>
        <td style="padding:12px 14px;text-align:center;border-right:1px solid ${COLOR_BORDER}">
          <div style="font-size:11px;color:${COLOR_MUTED};letter-spacing:0.06em;text-transform:uppercase;font-weight:600">區間支出</div>
          <div style="font-size:15px;color:${COLOR_RED};font-weight:700;margin-top:2px">${escapeEmailHtml(formatAmount(totalExpense))}</div>
        </td>
        <td style="padding:12px 14px;text-align:center">
          <div style="font-size:11px;color:${COLOR_MUTED};letter-spacing:0.06em;text-transform:uppercase;font-weight:600">區間淨額</div>
          <div style="font-size:15px;color:${summaryColor};font-weight:700;margin-top:2px">${totalNet >= 0 ? '+' : ''}${escapeEmailHtml(formatAmount(totalNet))}</div>
        </td>
      </tr></table>`;

    if (rows.length === 0) {
      txContent = summaryHeader + `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:13px;background:${COLOR_BG_SOFT};border-radius:10px">區間內沒有任何收入或支出紀錄</div>`;
    } else {
      const dailyRows = rows.map(r => {
        const isWeekend = r.weekday === 0 || r.weekday === 6;
        const dateColor = isWeekend ? COLOR_PRIMARY : COLOR_INK;
        const md = r.date.slice(5).replace('-', '/');
        return `<tr>
          <td style="padding:9px 12px;border-bottom:1px solid ${COLOR_BORDER};font-size:13px;color:${dateColor};white-space:nowrap;font-weight:600">
            ${escapeEmailHtml(md)} <span style="color:${COLOR_MUTED};font-size:11px;font-weight:400">(${WEEKDAY_LABELS[r.weekday]})</span>
          </td>
          <td style="padding:9px 12px;border-bottom:1px solid ${COLOR_BORDER};font-size:13px;text-align:right;color:${r.income > 0 ? COLOR_GREEN : '#cbd5e1'};white-space:nowrap">
            ${r.income > 0 ? '+' + escapeEmailHtml(formatAmount(r.income)) : '—'}
          </td>
          <td style="padding:9px 12px;border-bottom:1px solid ${COLOR_BORDER};font-size:13px;text-align:right;color:${r.expense > 0 ? COLOR_RED : '#cbd5e1'};white-space:nowrap">
            ${r.expense > 0 ? '−' + escapeEmailHtml(formatAmount(r.expense)) : '—'}
          </td>
          <td style="padding:9px 12px;border-bottom:1px solid ${COLOR_BORDER};font-size:13px;text-align:right;font-weight:600;white-space:nowrap;color:${r.net > 0 ? COLOR_GREEN : r.net < 0 ? COLOR_RED : '#cbd5e1'}">
            ${r.net === 0 ? '—' : (r.net > 0 ? '+' : '') + escapeEmailHtml(formatAmount(r.net))}
          </td>
        </tr>`;
      }).join('');
      txContent = summaryHeader + `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;border:1px solid ${COLOR_BORDER};border-radius:10px;overflow:hidden">
          <thead>
            <tr style="background:${COLOR_BG_SOFT}">
              <th style="padding:9px 12px;text-align:left;color:${COLOR_MUTED};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;border-bottom:1px solid ${COLOR_BORDER}">日期</th>
              <th style="padding:9px 12px;text-align:right;color:${COLOR_MUTED};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;border-bottom:1px solid ${COLOR_BORDER}">收入</th>
              <th style="padding:9px 12px;text-align:right;color:${COLOR_MUTED};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;border-bottom:1px solid ${COLOR_BORDER}">支出</th>
              <th style="padding:9px 12px;text-align:right;color:${COLOR_MUTED};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;border-bottom:1px solid ${COLOR_BORDER}">淨額</th>
            </tr>
          </thead>
          <tbody>${dailyRows}</tbody>
        </table>`;
    }
  }

  // 股票區塊
  let stockBlock;
  if (stats.stockHoldings > 0) {
    const plColor = stats.stockUnrealizedPL >= 0 ? COLOR_GREEN : COLOR_RED;
    const plSign = stats.stockUnrealizedPL >= 0 ? '+' : '';
    const returnPctStr = stats.stockReturnPct === null
      ? '—'
      : `${stats.stockReturnPct >= 0 ? '+' : ''}${(Math.round(stats.stockReturnPct * 100) / 100).toFixed(2)}%`;
    const returnColor = stats.stockReturnPct === null ? COLOR_MUTED : (stats.stockReturnPct >= 0 ? COLOR_GREEN : COLOR_RED);
    stockBlock = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLOR_BG_SOFT};border-radius:12px;border:1px solid ${COLOR_BORDER}"><tr><td style="padding:16px 18px">
        <div style="font-size:12px;color:${COLOR_MUTED};letter-spacing:0.06em;text-transform:uppercase;font-weight:600;margin-bottom:10px">目前持有 <span style="color:${COLOR_INK};font-weight:700">${stats.stockHoldings}</span> 檔</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;border-collapse:collapse"><tbody>
          <tr>
            <td style="padding:8px 0;color:${COLOR_MUTED};border-bottom:1px solid ${COLOR_BORDER}">總成本</td>
            <td style="padding:8px 0;text-align:right;color:${COLOR_INK};border-bottom:1px solid ${COLOR_BORDER}">${escapeEmailHtml(formatAmount(stats.stockCostTwd))}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${COLOR_MUTED};border-bottom:1px solid ${COLOR_BORDER}">總市值</td>
            <td style="padding:8px 0;text-align:right;color:${COLOR_INK};font-weight:700;border-bottom:1px solid ${COLOR_BORDER}">${escapeEmailHtml(formatAmount(stats.stockMarketValueTwd))}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${COLOR_MUTED};border-bottom:1px solid ${COLOR_BORDER}">未實現損益</td>
            <td style="padding:8px 0;text-align:right;color:${plColor};font-weight:700;border-bottom:1px solid ${COLOR_BORDER}">${plSign}${escapeEmailHtml(formatAmount(stats.stockUnrealizedPL))}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${COLOR_MUTED}">報酬率</td>
            <td style="padding:8px 0;text-align:right;color:${returnColor};font-weight:700;font-size:15px">${returnPctStr}</td>
          </tr>
        </tbody></table>
      </td></tr></table>`;
  } else {
    stockBlock = `<div style="padding:18px;background:${COLOR_BG_SOFT};border-radius:12px;border:1px solid ${COLOR_BORDER};color:#94a3b8;font-size:13px;text-align:center">目前無持股</div>`;
  }

  // CTA
  const ctaBlock = APP_URL
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 4px"><tr><td style="border-radius:10px;background:${COLOR_PRIMARY};box-shadow:0 4px 14px rgba(79,70,229,0.25)">
        <a href="${escapeEmailHtml(APP_URL)}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.02em;border-radius:10px">前往儀表板查看完整報表  →</a>
      </td></tr></table>`
    : '';

  // 區塊標題（含色塊指示）
  const sectionTitle = (text) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
    <tr>
      <td style="padding:26px 0 10px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <tr>
            <td style="width:3px;vertical-align:middle">
              <span style="display:block;width:3px;height:14px;background:${COLOR_PRIMARY};border-radius:2px"></span>
            </td>
            <td style="padding-left:8px;vertical-align:middle;font-size:13px;font-weight:700;color:${COLOR_INK};letter-spacing:0.02em">
              ${escapeEmailHtml(text)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

  // table 包覆樣式
  const tableShell = (inner) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid ${COLOR_BORDER};border-radius:10px;overflow:hidden;background:#ffffff"><tbody>${inner}</tbody></table>`;

  return `<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>個人資產統計報表</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue','Noto Sans TC','Microsoft JhengHei',sans-serif;color:${COLOR_INK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" width="100%" style="max-width:600px;margin:0 auto"><tr><td>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08)">
      <tr><td style="padding:32px 28px 22px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%);color:#ffffff;position:relative">
        <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;font-weight:600">AssetPilot · ${month} 月度摘要</div>
        <div style="font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-0.02em">${safeName}，您好 👋</div>
        <div style="font-size:14px;line-height:1.5;margin-top:8px;opacity:0.95">這是您本月的資產與收支快照<br>資產 <strong>${stats.accountCount}</strong> 個帳戶 · 持股 <strong>${stats.stockHoldings}</strong> 檔</div>
      </td></tr>
      <tr><td style="padding:24px 24px 28px;background:#ffffff">

        ${sectionTitle('本月收支總覽')}
        ${kpiRow}
        ${srBlock}

        ${sectionTitle('資產餘額')}
        ${tableShell(balanceRows)}

        ${sectionTitle('本月前 5 大支出')}
        ${tableShell(catRows)}

        ${sectionTitle(txSectionTitle)}
        ${txContent}

        ${sectionTitle('股票投資')}
        ${stockBlock}

        ${ctaBlock}

        <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${COLOR_BORDER};font-size:11px;color:#94a3b8;text-align:center;line-height:1.7">
          此信件由 <strong style="color:${COLOR_MUTED}">AssetPilot</strong> 系統自動寄送，請勿回覆。<br>
          資料以您於系統內登錄之記錄為準，僅作為參考。
        </div>
      </td></tr>
    </table>
    <div style="text-align:center;margin-top:14px;font-size:11px;color:#94a3b8">
      ©  AssetPilot · 個人資產管理
    </div>
  </td></tr></table>
</body></html>`;
}

// 註：POST /api/admin/send-stats-report 已於 v4.17.0 移除，請改用
// PUT /api/admin/report-schedule（更新 userIds）+ POST /api/admin/report-schedule/run-now

// ─── SMTP 設定（管理員）───
app.get('/api/admin/smtp-settings', adminMiddleware, (req, res) => {
  const s = getSmtpSettingsRaw();
  res.json({
    host: s.host,
    port: s.port,
    secure: !!s.secure,
    user: s.user,
    from: s.from,
    hasPassword: !!s.password,
  });
});

app.put('/api/admin/smtp-settings', adminMiddleware, (req, res) => {
  const host = String(req.body?.host || '').trim();
  const portRaw = req.body?.port;
  const port = Number.parseInt(portRaw, 10);
  const secure = !!req.body?.secure;
  const user = String(req.body?.user || '').trim();
  const password = req.body?.password;
  const from = String(req.body?.from || '').trim();

  if (host && (!Number.isFinite(port) || port < 1 || port > 65535)) {
    return res.status(400).json({ error: 'Port 必須為 1-65535 的整數' });
  }
  if (host.length > 255 || user.length > 320 || from.length > 320) {
    return res.status(400).json({ error: '欄位長度過長' });
  }

  const current = getSmtpSettingsRaw();
  // 若 password 為 undefined 或空字串，視為「保留現有密碼」
  const nextPassword = (typeof password === 'string' && password !== '') ? password : current.password;

  db.run(
    "UPDATE system_settings SET smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?, smtp_password = ?, smtp_from = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [host, host ? (port || 587) : 587, secure ? 1 : 0, user, nextPassword, from, Date.now(), req.userId]
  );
  saveDB();
  // 強制重建 transporter
  smtpTransporter = null;
  smtpTransporterKey = '';
  res.json({ success: true });
});

// 寄送測試信給目前登入管理員，驗證 SMTP / Resend 設定
app.post('/api/admin/test-email', adminMiddleware, async (req, res) => {
  const me = queryOne("SELECT email, display_name FROM users WHERE id = ?", [req.userId]);
  if (!me?.email) return res.status(400).json({ error: '目前管理員未設定 Email，無法寄送測試信' });
  try {
    const result = await sendStatsEmail({
      to: me.email,
      subject: 'AssetPilot 寄信設定測試',
      html: `<p>這是一封測試信，用來驗證 ${getSmtpSettingsRaw().host ? 'SMTP' : 'Resend'} 寄信設定正確。</p><p>若您能收到此信，代表「寄送資產統計報表」功能已可正常使用。</p>`,
    });
    if (!result) return res.status(503).json({ error: '寄信服務未設定' });
    res.json({ success: true, provider: result.provider, to: me.email });
  } catch (e) {
    res.status(500).json({ error: e.message || '測試信寄送失敗' });
  }
});

// ─── 排程自動寄送統計報表 ───
const SCHEDULE_FREQ_VALUES = ['off', 'daily', 'weekly', 'monthly'];

function parseUserIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (e) { /* fall through */ }
  return [];
}

function getReportSchedule() {
  const row = queryOne(
    "SELECT report_schedule_freq, report_schedule_hour, report_schedule_weekday, report_schedule_day_of_month, report_schedule_last_run, report_schedule_last_summary, report_schedule_user_ids FROM system_settings WHERE id = 1"
  );
  // ⚠️ 不要用 `|| fallback`，否則 hour=0（午夜）/ weekday=0（週日）會被當 falsy 還原為 default
  const safe = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    freq: SCHEDULE_FREQ_VALUES.includes(row?.report_schedule_freq) ? row.report_schedule_freq : 'off',
    hour: safe(row?.report_schedule_hour, 0, 23, 9),
    weekday: safe(row?.report_schedule_weekday, 0, 6, 1),
    dayOfMonth: safe(row?.report_schedule_day_of_month, 1, 28, 1),
    lastRun: Number(row?.report_schedule_last_run) || 0,
    lastSummary: row?.report_schedule_last_summary || '',
    userIds: parseUserIdList(row?.report_schedule_user_ids),
  };
}

// 寄信前自動更新使用者所有持股的最新價格（盤中即時價優先，盤後 STOCK_DAY 收盤；失敗則跳過該檔）
async function updateUserStockPrices(userId) {
  const stocks = queryAll("SELECT id, symbol FROM stocks WHERE user_id = ?", [userId]);
  let updated = 0, skipped = 0;
  const today = new Date();
  const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  for (const s of stocks) {
    const symbol = String(s.symbol || '').trim();
    if (!symbol || !/^[A-Z0-9]{2,10}$/i.test(symbol)) { skipped += 1; continue; }
    try {
      // 1. 盤中即時
      let info = await fetchTwseRealtime(symbol);
      // 2. 盤後 STOCK_DAY（上市優先，再上櫃）
      if (!info || !info.found || !(info.closingPrice > 0)) {
        info = await fetchTwseStockDay(symbol, todayYmd);
      }
      if (!info || !info.found || !(info.closingPrice > 0)) {
        info = await fetchTpexStockDay(symbol, todayYmd);
      }
      if (info && info.found && info.closingPrice > 0) {
        db.run(
          "UPDATE stocks SET current_price = ?, updated_at = ? WHERE id = ? AND user_id = ?",
          [info.closingPrice, todayStr(), s.id, userId]
        );
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (e) {
      skipped += 1;
    }
  }
  if (updated > 0) saveDB();
  return { updated, skipped };
}

// 取得指定時間戳在台灣時區（UTC+8，無 DST）的各欄位 — 排程與顯示一律以台灣時區為準，
// 避免伺服器跑在 UTC 等其他時區時「0 時寄送」被當成 UTC 0 點（台灣 08:00）觸發
function twParts(ts) {
  const d = new Date(ts + 8 * 3600 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    day: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

// 台灣時區當日 00:00 對應的 Unix ms（UTC 時間軸）
function twStartOfDayMs(ts) {
  const p = twParts(ts);
  return Date.UTC(p.year, p.month, p.date) - 8 * 3600 * 1000;
}

// 判斷現在是否該觸發寄送：到了當期排程時間，且本期尚未執行（一律以台灣時區比對）
function shouldRunSchedule(schedule, nowTs = serverNow()) {
  if (schedule.freq === 'off') return false;
  const tw = twParts(nowTs);
  if (tw.hours < schedule.hour) return false;

  const periodStart = twStartOfDayMs(nowTs);

  if (schedule.freq === 'daily') {
    // nothing extra
  } else if (schedule.freq === 'weekly') {
    if (tw.day !== schedule.weekday) return false;
  } else if (schedule.freq === 'monthly') {
    if (tw.date !== schedule.dayOfMonth) return false;
  } else {
    return false;
  }
  return schedule.lastRun < periodStart;
}

const REPORT_SCHEDULE_MAX_TARGETS = 100;

let isRunningSchedule = false;
async function runScheduledReportNow(triggeredBy = 'scheduler', overrideUserIds = null) {
  if (isRunningSchedule) {
    return { sent: 0, failed: 0, skipped: 0, status: 'already_running', reason: '已有寄送任務進行中' };
  }
  isRunningSchedule = true;
  // startedAt / finishedAt 一律採用 serverNow()，與 shouldRunSchedule() 的 periodStart 同一時間基準，
  // 避免 SERVER_TIME_OFFSET ≠ 0 時 lastRun < periodStart 永遠成立導致每 5 分鐘重複觸發
  const startedAt = serverNow();
  try {
    const schedule = getReportSchedule();
    const rawIds = Array.isArray(overrideUserIds) && overrideUserIds.length
      ? overrideUserIds
      : schedule.userIds;
    const targetIds = Array.from(new Set((rawIds || []).map(String).filter(Boolean))).slice(0, REPORT_SCHEDULE_MAX_TARGETS);

    if (targetIds.length === 0) {
      const summary = `${formatTwTime(startedAt)} ${triggeredBy} 觸發但未指定寄送對象，已略過`;
      db.run(
        "UPDATE system_settings SET report_schedule_last_run = ?, report_schedule_last_summary = ? WHERE id = 1",
        [startedAt, summary]
      );
      saveDB();
      return { sent: 0, failed: 0, skipped: 0, status: 'no_targets', reason: '未指定寄送對象' };
    }

    const users = [];
    for (const id of targetIds) {
      const u = queryOne("SELECT id, email, display_name FROM users WHERE id = ?", [id]);
      if (u) users.push(u);
    }

    const smtp = getSmtpSettingsRaw();
    const hasSmtp = !!(smtp.host && smtp.port);
    const hasResend = !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
    if (!hasSmtp && !hasResend) {
      const summary = `${formatTwTime(startedAt)} ${triggeredBy} 觸發但寄信服務未設定，已略過`;
      db.run(
        "UPDATE system_settings SET report_schedule_last_run = ?, report_schedule_last_summary = ? WHERE id = 1",
        [startedAt, summary]
      );
      saveDB();
      return { sent: 0, failed: 0, skipped: users.length, status: 'no_email_service', reason: '寄信服務未設定' };
    }

    let sent = 0, failed = 0, skipped = 0;
    let priceUpdates = 0;
    const failures = [];
    for (const u of users) {
      if (!isValidEmail(u.email)) {
        skipped += 1;
        failures.push(`${u.email || u.id}: Email 無效或未設定`);
        continue;
      }
      try {
        // 寄送前先更新該使用者所有持股最新報價，確保信件內市值正確
        const priceResult = await updateUserStockPrices(u.id).catch(() => ({ updated: 0, skipped: 0 }));
        priceUpdates += priceResult.updated;

        const stats = buildUserStatsReport(u.id, schedule.freq);
        const html = renderStatsEmailHtml(u.display_name, u.email, stats);
        const subject = `${stats.month} 個人資產統計報表`;
        const r = await sendStatsEmail({ to: u.email, subject, html });
        if (r) sent += 1;
        else { failed += 1; failures.push(`${u.email}: 寄信服務未設定`); }
      } catch (e) {
        failed += 1;
        failures.push(`${u.email}: ${e.message || '未知錯誤'}`);
      }
      if (!hasSmtp) await new Promise(r => setTimeout(r, 600));
    }

    const finishedAt = serverNow();
    const summaryParts = [`${formatTwTime(startedAt)} ${triggeredBy}：寄送 ${sent} / 失敗 ${failed} / 略過 ${skipped}（更新股價 ${priceUpdates} 檔，完成於 ${formatTwTime(finishedAt)}）`];
    if (failures.length) summaryParts.push('失敗明細：' + failures.slice(0, 3).join('；') + (failures.length > 3 ? `…（共 ${failures.length} 筆）` : ''));
    const summary = summaryParts.join(' | ');
    // last_run 寫入 startedAt（本期觸發時間），避免長時間執行跨過下個 periodStart 時，
    // shouldRunSchedule() 將下一期誤判為「已執行」而跳過
    db.run(
      "UPDATE system_settings SET report_schedule_last_run = ?, report_schedule_last_summary = ? WHERE id = 1",
      [startedAt, summary]
    );
    saveDB();
    return { sent, failed, skipped, priceUpdates, status: 'completed' };
  } finally {
    isRunningSchedule = false;
  }
}

function formatTwTime(ts) {
  if (!ts) return '從未';
  const p = twParts(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month + 1)}-${pad(p.date)} ${pad(p.hours)}:${pad(p.minutes)}`;
}

function checkAndRunSchedule() {
  try {
    const schedule = getReportSchedule();
    if (!shouldRunSchedule(schedule, serverNow())) return;
    runScheduledReportNow('排程').catch(err => console.error('[scheduled-report]', err));
  } catch (e) {
    console.error('[scheduled-report] check error', e);
  }
}

// 啟動時延遲 30 秒、之後每 5 分鐘檢查一次
setTimeout(() => {
  checkAndRunSchedule();
  setInterval(checkAndRunSchedule, 5 * 60 * 1000);
}, 30 * 1000);

// FR-046：90 天稽核清除排程（啟動立即執行 + 每 24h 循環）
function pruneAuditLogs() {
  const threshold = serverNow() - AUDIT_RETENTION_DAYS * 86400 * 1000;
  let totalAudit = 0;
  let totalAttempt = 0;
  while (true) {
    const auditIds = db.exec(
      `SELECT id FROM login_audit_logs WHERE login_at < ${threshold} LIMIT ${PRUNE_BATCH}`
    );
    const auditRows = auditIds[0]?.values || [];
    if (auditRows.length > 0) {
      const placeholders = auditRows.map(() => '?').join(',');
      db.run(`DELETE FROM login_audit_logs WHERE id IN (${placeholders})`, auditRows.map(r => r[0]));
      totalAudit += auditRows.length;
    }
    const attemptIds = db.exec(
      `SELECT id FROM login_attempt_logs WHERE login_at < ${threshold} LIMIT ${PRUNE_BATCH}`
    );
    const attemptRows = attemptIds[0]?.values || [];
    if (attemptRows.length > 0) {
      const placeholders = attemptRows.map(() => '?').join(',');
      db.run(`DELETE FROM login_attempt_logs WHERE id IN (${placeholders})`, attemptRows.map(r => r[0]));
      totalAttempt += attemptRows.length;
    }
    if (auditRows.length === 0 && attemptRows.length === 0) break;
  }
  const total = totalAudit + totalAttempt;
  if (total > 0) {
    saveDB();
    console.log(`[Audit Prune] removed ${total} rows (audit=${totalAudit}, attempt=${totalAttempt})`);
  }
  return total;
}

function registerAuditPruneJob() {
  try { pruneAuditLogs(); } catch (e) { console.error('[Audit Prune] initial run error', e); }
  setInterval(() => {
    try { pruneAuditLogs(); } catch (e) { console.error('[Audit Prune] scheduled run error', e); }
  }, 24 * 3600 * 1000);
  console.log('[Audit Prune] registered; next run in 24h');
}

app.get('/api/admin/report-schedule', adminMiddleware, (req, res) => {
  const s = getReportSchedule();
  res.json({
    freq: s.freq,
    hour: s.hour,
    weekday: s.weekday,
    dayOfMonth: s.dayOfMonth,
    userIds: s.userIds,
    lastRun: s.lastRun,
    lastRunText: s.lastRun ? formatTwTime(s.lastRun) : '',
    lastSummary: s.lastSummary,
  });
});

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

app.put('/api/admin/report-schedule', adminMiddleware, (req, res) => {
  const freq = SCHEDULE_FREQ_VALUES.includes(req.body?.freq) ? req.body.freq : 'off';
  // ⚠️ 不要用 `|| fallback`，否則 hour=0（午夜）/ weekday=0（週日）會被當 falsy 吃掉
  const hour = clampInt(req.body?.hour, 0, 23, 9);
  const weekday = clampInt(req.body?.weekday, 0, 6, 1);
  const dayOfMonth = clampInt(req.body?.dayOfMonth, 1, 28, 1);

  const rawIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const cleanIds = [...new Set(rawIds.map(String).map(s => s.trim()).filter(Boolean))];
  if (cleanIds.length > REPORT_SCHEDULE_MAX_TARGETS) {
    return res.status(400).json({ error: `單次最多指定 ${REPORT_SCHEDULE_MAX_TARGETS} 位使用者` });
  }
  // 過濾不存在的 user id（避免存進髒資料）
  const validIds = cleanIds.filter(id => !!queryOne("SELECT id FROM users WHERE id = ?", [id]));

  db.run(
    "UPDATE system_settings SET report_schedule_freq = ?, report_schedule_hour = ?, report_schedule_weekday = ?, report_schedule_day_of_month = ?, report_schedule_user_ids = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [freq, hour, weekday, dayOfMonth, JSON.stringify(validIds), Date.now(), req.userId]
  );
  saveDB();
  res.json({ success: true, freq, hour, weekday, dayOfMonth, userIds: validIds });
});

// 立即執行一次排程（不等到下個觸發時間）；可選 body { userIds } 覆寫寄送對象
app.post('/api/admin/report-schedule/run-now', adminMiddleware, async (req, res) => {
  try {
    const overrideIds = Array.isArray(req.body?.userIds) ? req.body.userIds : null;
    const result = await runScheduledReportNow('手動', overrideIds);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message || '手動執行失敗' });
  }
});

let isUpdatingApp = false;

app.post('/api/system/update-app', adminMiddleware, async (req, res) => {
  if (isUpdatingApp) {
    return res.status(409).json({ error: '系統正在更新中，請稍後再試' });
  }

  isUpdatingApp = true;
  try {
    const result = await executeInAppUpdate();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message || '更新失敗' });
  } finally {
    isUpdatingApp = false;
  }
});

// ─── 帳號設定 ───
// 綁定 Google 帳號
app.post('/api/account/link-google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: '缺少 Google 憑證' });
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google SSO 未設定' });

  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) return res.status(401).json({ error: 'Google 憑證驗證失敗' });
    const payload = await verifyRes.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: 'Google 憑證 audience 不符' });

    const googleId = payload.sub;
    const googleEmail = payload.email?.toLowerCase();
    const picture = payload.picture || '';

    // 檢查此 Google 帳號是否已被其他使用者綁定
    const existing = queryOne("SELECT id FROM users WHERE google_id = ? AND id != ?", [googleId, req.userId]);
    if (existing) return res.status(400).json({ error: '此 Google 帳號已被其他使用者綁定' });

    db.run("UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?", [googleId, picture, req.userId]);
    saveDB();
    res.json({ success: true, googleEmail, avatarUrl: picture });
  } catch (e) {
    console.error('綁定 Google 錯誤:', e.message);
    res.status(500).json({ error: '綁定失敗：' + e.message });
  }
});

// 解除綁定 Google 帳號
app.post('/api/account/unlink-google', (req, res) => {
  const user = queryOne("SELECT google_id FROM users WHERE id = ?", [req.userId]);
  if (!user || !user.google_id) return res.status(400).json({ error: '尚未綁定 Google 帳號' });

  db.run("UPDATE users SET google_id = '' WHERE id = ?", [req.userId]);
  saveDB();
  res.json({ success: true });
});

// ─── Passkey 管理（需登入）───

// 取得 challenge（已登入，註冊用）
app.get('/api/account/passkey/challenge', (req, res) => {
  const { key, challenge } = issuePasskeyChallenge(req.userId);
  res.json({ key, challenge });
});

// 列出已註冊的 Passkeys
app.get('/api/account/passkeys', (req, res) => {
  const rows = queryAll("SELECT credential_id, device_name, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC", [req.userId]);
  res.json({ passkeys: rows.map(r => ({ id: r.credential_id, deviceName: r.device_name, createdAt: r.created_at })) });
});

// 註冊新 Passkey
app.post('/api/account/passkey/register', async (req, res) => {
  const { registration, challengeKey, deviceName } = req.body;
  if (!registration || !challengeKey) return res.status(400).json({ error: '缺少註冊資料' });

  const entry = consumePasskeyChallenge(challengeKey);
  if (!entry) return res.status(400).json({ error: 'Challenge 已過期或無效，請重試' });
  if (entry.userId !== req.userId) return res.status(400).json({ error: 'Challenge 不匹配' });

  try {
    const origin = getTrustedOrigin(req);
    const expected = {
      challenge: entry.challenge,
      origin,
      userVerified: true,
    };

    const result = await webauthnServer.verifyRegistration(registration, expected);

    const existing = queryOne("SELECT credential_id FROM passkey_credentials WHERE credential_id = ?", [result.credential.id]);
    if (existing) return res.status(400).json({ error: '此 Passkey 已註冊過' });

    db.run(
      "INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, transports, counter, device_name, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [result.credential.id, req.userId, result.credential.publicKey, result.credential.algorithm, JSON.stringify(result.credential.transports || []), 0, String(deviceName || '').trim() || 'Passkey', todayStr()]
    );
    saveDB();
    res.json({ success: true, id: result.credential.id });
  } catch (e) {
    console.error('Passkey 註冊驗證失敗:', e.message);
    return res.status(400).json({ error: 'Passkey 註冊驗證失敗：' + e.message });
  }
});

// 刪除 Passkey
app.delete('/api/account/passkey/:id', (req, res) => {
  const credId = req.params.id;
  const cred = queryOne("SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?", [credId, req.userId]);
  if (!cred) return res.status(404).json({ error: '找不到此 Passkey' });

  db.run("DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?", [credId, req.userId]);
  saveDB();
  res.json({ success: true });
});

// 重新命名 Passkey
app.put('/api/account/passkey/:id', (req, res) => {
  const credId = req.params.id;
  const deviceName = String(req.body?.deviceName || '').trim();
  if (!deviceName) return res.status(400).json({ error: '請輸入名稱' });

  const cred = queryOne("SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?", [credId, req.userId]);
  if (!cred) return res.status(404).json({ error: '找不到此 Passkey' });

  db.run("UPDATE passkey_credentials SET device_name = ? WHERE credential_id = ? AND user_id = ?", [deviceName, credId, req.userId]);
  saveDB();
  res.json({ success: true });
});

// 儲存主題偏好（跨瀏覽器同步）
app.put('/api/account/theme', (req, res) => {
  const mode = normalizeThemeMode(req.body?.themeMode);
  db.run("UPDATE users SET theme_mode = ? WHERE id = ?", [mode, req.userId]);
  saveDB();
  res.json({ success: true, themeMode: mode });
});

// 更新顯示名稱
app.put('/api/account/display-name', (req, res) => {
  const displayName = String(req.body?.displayName || '').trim();
  if (!displayName) return res.status(400).json({ error: '顯示名稱不可空白' });
  if (displayName.length > 50) return res.status(400).json({ error: '顯示名稱最多 50 字' });

  db.run("UPDATE users SET display_name = ? WHERE id = ?", [displayName, req.userId]);
  saveDB();
  res.json({ success: true, displayName });
});

// 修改密碼（已有密碼者需驗證舊密碼；Google-only 帳號可新增本機密碼）
app.put('/api/account/password', async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  const pwdError = validateStrongPassword(newPassword);
  if (pwdError) return res.status(400).json({ error: pwdError });

  const user = queryOne("SELECT id, password_hash, has_password FROM users WHERE id = ?", [req.userId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  if (user.has_password) {
    if (!currentPassword) return res.status(400).json({ error: '請輸入目前密碼' });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: '目前密碼錯誤' });
    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsOld) return res.status(400).json({ error: '新密碼不可與目前密碼相同' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // 改密碼後將 token_version +1，使所有舊 JWT 立即失效
  db.run("UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", [passwordHash, req.userId]);
  saveDB();
  // 重新簽發當前 session token
  const updatedUser = queryOne("SELECT token_version FROM users WHERE id = ?", [req.userId]);
  const newToken = jwt.sign({ userId: req.userId, tokenVersion: Number(updatedUser.token_version) || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  setAuthCookie(res, newToken);
  res.json({ success: true });
});

// 刪除帳號（永久刪除所有資料）
app.post('/api/account/delete', async (req, res) => {
  const { password, googleCredential } = req.body;
  const user = queryOne("SELECT * FROM users WHERE id = ?", [req.userId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  if (user.is_admin) {
    const adminCount = Number(queryOne("SELECT COUNT(1) AS count FROM users WHERE is_admin = 1")?.count || 0);
    if (adminCount <= 1) {
      return res.status(400).json({ error: '系統至少需保留一位管理員，請先指定其他管理員' });
    }
  }

  // 有密碼 → 驗密碼
  if (user.has_password) {
    if (!password) return res.status(400).json({ error: '請輸入密碼以確認刪除' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: '密碼錯誤，請重新輸入' });
  } else if (user.google_id) {
    // Google-only → 要求提供一次 fresh Google id_token，並驗證 sub 與 audience
    if (!googleCredential) return res.status(400).json({ error: '請完成 Google 驗證以確認刪除帳號' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google SSO 未設定，無法刪除帳號' });
    try {
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleCredential)}`);
      if (!verifyRes.ok) return res.status(401).json({ error: 'Google 憑證驗證失敗' });
      const payload = await verifyRes.json();
      if (payload.aud !== GOOGLE_CLIENT_ID) return res.status(401).json({ error: 'Google 憑證 audience 不符' });
      if (payload.sub !== user.google_id) return res.status(401).json({ error: 'Google 帳號與目前登入帳號不符' });
      // 檢查 token 是否在有效期內（tokeninfo 回傳 exp 為 Unix seconds）
      if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
        return res.status(401).json({ error: 'Google 憑證已過期，請重新驗證' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Google 驗證失敗' });
    }
  } else {
    // 既無密碼也無 Google 綁定（例如 Passkey-only）— 目前暫不支援自助刪除
    return res.status(400).json({ error: '此帳號無可用的二次驗證方式，請聯絡管理員刪除' });
  }

  deleteUserData(req.userId);
  saveDB();
  res.json({ success: true });
});

// ─── 分類 ───
app.get('/api/categories', (req, res) => {
  const rows = queryAll("SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order", [req.userId]);
  res.json(rows.map(r => ({ ...r, isDefault: !!r.is_default, isHidden: !!r.is_hidden, sortOrder: r.sort_order, parentId: r.parent_id || '' })));
});

app.post('/api/categories', (req, res) => {
  const { name, type, color, parentId } = req.body;
  if (!isValidColor(color)) return res.status(400).json({ error: '顏色格式不正確' });
  const pId = parentId || '';
  // 同父分類下名稱不可重複
  const dup = queryOne("SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ? AND parent_id = ?", [req.userId, name, type, pId]);
  if (dup) return res.status(400).json({ error: '同分類下名稱不可重複' });
  // 若指定父分類，驗證父分類存在且為同類型的頂層分類
  if (pId) {
    const parent = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ? AND parent_id = ''", [pId, req.userId]);
    if (!parent) return res.status(400).json({ error: '父分類不存在' });
    if (parent.type !== type) return res.status(400).json({ error: '子分類類型必須與父分類相同' });
  }
  const id = uid();
  const maxOrder = queryOne("SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?", [req.userId])?.m || 0;
  db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order, parent_id) VALUES (?,?,?,?,?,0,0,?,?)",
    [id, req.userId, name, type, color || '#6366f1', maxOrder + 1, pId]);
  saveDB();
  res.json({ id });
});

app.put('/api/categories/:id', (req, res) => {
  const { name, color } = req.body;
  if (!isValidColor(color)) return res.status(400).json({ error: '顏色格式不正確' });
  const cat = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  const pId = cat.parent_id || '';
  const dup = queryOne("SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ? AND parent_id = ? AND id != ?", [req.userId, name, cat.type, pId, req.params.id]);
  if (dup) return res.status(400).json({ error: '同分類下名稱不可重複' });
  db.run("UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?", [name, color, req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/categories/:id', (req, res) => {
  const cat = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  // 檢查此分類及其子分類是否有交易
  const hasTx = queryOne("SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1", [req.params.id, req.userId]);
  if (hasTx) return res.status(400).json({ error: '此分類下有交易記錄，請先移轉至其他分類' });
  // 若為父分類，也檢查子分類是否有交易
  if (!cat.parent_id) {
    const childIds = queryAll("SELECT id FROM categories WHERE parent_id = ? AND user_id = ?", [req.params.id, req.userId]).map(c => c.id);
    for (const cid of childIds) {
      const childTx = queryOne("SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1", [cid, req.userId]);
      if (childTx) return res.status(400).json({ error: '此分類的子分類下有交易記錄，請先移轉至其他分類' });
    }
    // 刪除所有子分類
    db.run("DELETE FROM categories WHERE parent_id = ? AND user_id = ?", [req.params.id, req.userId]);
  }
  db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// ─── 匯率設定 ───
app.get('/api/exchange-rates', async (req, res) => {
  const respond = () => {
    const map = getUserExchangeRateMap(req.userId);
    const rows = Object.keys(map).sort().map(currency => ({
      currency,
      rateToTwd: map[currency],
    }));
    const settings = getExchangeRateSettings(req.userId);
    res.json({ rates: rows, settings });
  };

  const settings = getExchangeRateSettings(req.userId);
  const shouldAutoSync = settings.autoUpdate
    && (!settings.lastSyncedAt || (Date.now() - settings.lastSyncedAt) >= FX_AUTO_SYNC_MIN_INTERVAL_MS);

  if (!shouldAutoSync) return respond();

  try {
    await syncExchangeRatesFromGlobalAPI(req.userId, []);
  } catch (e) {
    console.warn('[匯率] 自動更新失敗:', e.message);
  }
  respond();
});

app.put('/api/exchange-rates', (req, res) => {
  const rates = Array.isArray(req.body?.rates) ? req.body.rates : null;
  if (!rates || rates.length === 0) return res.status(400).json({ error: '請提供匯率資料' });

  const upserts = [{ currency: 'TWD', rateToTwd: 1 }];
  const seen = new Set(['TWD']);

  for (const r of rates) {
    const currency = parseCurrencyCode(r.currency);
    if (!currency) return res.status(400).json({ error: '幣別格式不正確（需為 3 碼英文字母）' });
    const rate = Number(r.rateToTwd);
    if (seen.has(currency)) return res.status(400).json({ error: `幣別重複：${currency}` });
    seen.add(currency);
    if (currency !== 'TWD' && !(rate > 0 && rate < 1000000)) {
      return res.status(400).json({ error: `${currency} 匯率格式不正確` });
    }

    upserts.push({ currency, rateToTwd: currency === 'TWD' ? 1 : rate });
  }

  const now = Date.now();
  // 手動輸入：寫入使用者自己的 DB（is_manual = 1），不更新跨使用者共用快取
  upserts.forEach(item => {
    db.run(`INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, updated_at = excluded.updated_at, is_manual = 1`,
      [req.userId, item.currency, item.rateToTwd, now]);
  });

  const keepCurrencies = upserts.map(item => item.currency);
  const placeholders = keepCurrencies.map(() => '?').join(', ');
  db.run(`DELETE FROM exchange_rates WHERE user_id = ? AND currency NOT IN (${placeholders})`, [req.userId, ...keepCurrencies]);

  saveDB();
  const map = getUserExchangeRateMap(req.userId);
  const rows = Object.keys(map).sort().map(currency => ({ currency, rateToTwd: map[currency] }));
  const settings = getExchangeRateSettings(req.userId);
  res.json({ rates: rows, settings });
});

app.put('/api/exchange-rates/settings', (req, res) => {
  const autoUpdate = !!req.body?.autoUpdate;
  const settings = setExchangeRateAutoUpdate(req.userId, autoUpdate);
  res.json({ success: true, settings });
});

app.post('/api/exchange-rates/refresh', async (req, res) => {
  try {
    const requestedCurrencies = Array.isArray(req.body?.currencies) ? req.body.currencies : [];
    const result = await syncExchangeRatesFromGlobalAPI(req.userId, requestedCurrencies);
    const map = getUserExchangeRateMap(req.userId);
    const rows = Object.keys(map).sort().map(currency => ({
      currency,
      rateToTwd: map[currency],
    }));
    const settings = getExchangeRateSettings(req.userId);
    let message = `已更新 ${result.updatedRates.length} 筆匯率`;
    if (result.unsupportedCurrencies.length > 0) {
      message += `；${result.unsupportedCurrencies.join('、')} 因不被全球 API 支援而無法自動更新，可手動輸入匯率`;
    }
    res.json({ rates: rows, settings, updatedAt: result.updatedAt, message });
  } catch (e) {
    res.status(500).json({ error: e.message || '更新即時匯率失敗' });
  }
});

// ─── 帳戶 ───
app.get('/api/accounts', (req, res) => {
  const accounts = queryAll("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at", [req.userId]);
  const result = accounts.map(a => {
    const accountCurrency = normalizeCurrency(a.currency);
    const balance = calcBalance(a.id, a.initial_balance, req.userId, accountCurrency);
    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
      linkedBankId: a.linked_bank_id || null,
    };
  });
  res.json(result);
});

function calcBalance(accId, initialBalance, userId, accountCurrency = 'TWD') {
  let balance = Number(initialBalance) || 0;
  const txs = queryAll("SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?", [accId, userId]);
  txs.forEach(t => {
    const txCurrency = normalizeCurrency(t.currency);
    const value = txCurrency === accountCurrency
      ? (Number(t.original_amount) > 0 ? Number(t.original_amount) : Number(t.amount) || 0)
      : convertFromTwd(t.amount, accountCurrency, userId);
    if (t.type === 'income' || t.type === 'transfer_in') balance += value;
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= value;
  });
  return Math.round(balance * 100) / 100;
}

app.post('/api/accounts', (req, res) => {
  const { name, initialBalance, icon, accountType, excludeFromTotal, linkedBankId } = req.body;
  const currency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const VALID_TYPES = ['銀行', '信用卡', '現金', '虛擬錢包'];
  const safeType = VALID_TYPES.includes(accountType) ? accountType : '現金';
  const safeExclude = excludeFromTotal ? 1 : 0;
  let safeLinkedBankId = null;
  if (safeType === '信用卡' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND account_type = '銀行'", [linkedBankId, req.userId]);
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }
  const id = uid();
  db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency, account_type, exclude_from_total, linked_bank_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, name, initialBalance || 0, safeIcon, currency, safeType, safeExclude, safeLinkedBankId, todayStr()]);
  saveDB();
  res.json({ id });
});

app.put('/api/accounts/:id', (req, res) => {
  const { name, initialBalance, icon, accountType, excludeFromTotal, linkedBankId } = req.body;
  const currency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const VALID_TYPES = ['銀行', '信用卡', '現金', '虛擬錢包'];
  const safeType = VALID_TYPES.includes(accountType) ? accountType : '現金';
  const safeExclude = excludeFromTotal ? 1 : 0;
  let safeLinkedBankId = null;
  if (safeType === '信用卡' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND account_type = '銀行'", [linkedBankId, req.userId]);
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }
  db.run("UPDATE accounts SET name = ?, initial_balance = ?, icon = ?, currency = ?, account_type = ?, exclude_from_total = ?, linked_bank_id = ? WHERE id = ? AND user_id = ?",
    [name, initialBalance || 0, safeIcon, currency, safeType, safeExclude, safeLinkedBankId, req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  const count = queryOne("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?", [req.userId])?.cnt || 0;
  if (count <= 1) return res.status(400).json({ error: '至少需保留一個帳戶' });
  const hasTx = queryOne("SELECT id FROM transactions WHERE account_id = ? AND user_id = ? LIMIT 1", [req.params.id, req.userId]);
  if (hasTx) return res.status(400).json({ error: '此帳戶下有交易記錄，請先移轉至其他帳戶' });
  db.run("UPDATE accounts SET linked_bank_id = NULL WHERE linked_bank_id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM accounts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.post('/api/accounts/credit-card-repayment', (req, res) => {
  const { fromAccountId, date: rawDate, repayments } = req.body;
  if (!fromAccountId || !Array.isArray(repayments) || repayments.length === 0) {
    return res.status(400).json({ error: '缺少必要參數' });
  }
  const fromAccount = queryOne("SELECT currency, account_type FROM accounts WHERE id = ? AND user_id = ?", [fromAccountId, req.userId]);
  if (!fromAccount) return res.status(400).json({ error: '付款帳戶不存在' });
  if (fromAccount.account_type === '信用卡') return res.status(400).json({ error: '付款帳戶不可為信用卡' });

  const txDate = normalizeDate(rawDate) || todayStr();
  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const now = Date.now();

  // Pre-validate all entries and build converted amounts before any DB writes
  const validRepayments = [];
  for (const { cardId, amount } of repayments) {
    if (!cardId || Number(amount) <= 0) continue;
    const cardAccount = queryOne("SELECT currency, account_type FROM accounts WHERE id = ? AND user_id = ?", [cardId, req.userId]);
    if (!cardAccount || cardAccount.account_type !== '信用卡') continue;

    const toCurrency = normalizeCurrency(cardAccount.currency);
    const transferAmount = Number(amount);
    let outConverted;
    try {
      outConverted = convertToTwd(transferAmount, fromCurrency, null, req.userId);
    } catch (e) {
      return res.status(400).json({ error: e.message || '金額格式錯誤' });
    }
    const inOriginal = toCurrency === fromCurrency
      ? transferAmount
      : convertFromTwd(outConverted.twdAmount, toCurrency, req.userId);
    const inConverted = convertToTwd(inOriginal, toCurrency, null, req.userId);
    validRepayments.push({ cardId, toCurrency, outConverted, inConverted });
  }

  if (validRepayments.length === 0) {
    return res.status(400).json({ error: '沒有有效的還款項目' });
  }

  for (const { cardId, toCurrency, outConverted, inConverted } of validRepayments) {
    const outId = uid();
    const inId = uid();
    db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [outId, req.userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, txDate, '', fromAccountId, '信用卡還款', inId, now, now]);
    db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [inId, req.userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, txDate, '', cardId, '信用卡還款', outId, now, now]);
  }

  saveDB();
  res.json({ ok: true });
});

// ─── 交易記錄 ───
app.get('/api/transactions', (req, res) => {
  const { dateFrom, dateTo, type, categoryId, accountId, keyword, page, limit } = req.query;
  let sql = "SELECT * FROM transactions WHERE user_id = ?";
  const params = [req.userId];
  const today = todayStr();

  if (dateFrom) { sql += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { sql += " AND date <= ?"; params.push(dateTo); }
  if (type && type !== 'all') {
    if (type === 'transfer') {
      sql += " AND (type = 'transfer_out' OR type = 'transfer_in')";
    } else if (type === 'future') {
      sql += " AND date > ?";
      params.push(today);
    } else {
      sql += " AND type = ?"; params.push(type);
    }
  }
  if (categoryId && categoryId !== 'all') { sql += " AND category_id = ?"; params.push(categoryId); }
  if (accountId && accountId !== 'all') { sql += " AND account_id = ?"; params.push(accountId); }
  if (keyword) { sql += " AND note LIKE ?"; params.push(`%${keyword}%`); }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as cnt");
  const total = queryOne(countSql, params)?.cnt || 0;

  sql += " ORDER BY date DESC, created_at DESC";

  const pageNum = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 20;
  sql += ` LIMIT ${pageSize} OFFSET ${(pageNum - 1) * pageSize}`;

  const rows = queryAll(sql, params);
  res.json({
    data: rows.map(r => ({
      ...r,
      categoryId: r.category_id,
      accountId: r.account_id,
      currency: normalizeCurrency(r.currency),
      originalAmount: Number(r.original_amount) > 0 ? Number(r.original_amount) : Number(r.amount) || 0,
      fxRate: Number(r.fx_rate) > 0 ? Number(r.fx_rate) : 1,
      fxFee: Number(r.fx_fee) || 0,
      excludeFromStats: r.exclude_from_stats === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total, page: pageNum, totalPages: Math.ceil(total / pageSize),
  });
});

app.post('/api/transactions', (req, res) => {
  const { type, amount, date: rawDate, categoryId, accountId, note, excludeFromStats } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  let converted;
  try {
    converted = convertToTwd(req.body.originalAmount ?? amount, req.body.currency, req.body.fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '金額格式錯誤' });
  }
  const fxFee = Math.max(0, Number(req.body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  const id = uid();
  const now = Date.now();
  db.run("INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, now, now]);
  saveDB();
  res.json({ id });
});

app.put('/api/transactions/:id', (req, res) => {
  const { type, amount, date: rawDate, categoryId, accountId, note, excludeFromStats } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  let converted;
  try {
    converted = convertToTwd(req.body.originalAmount ?? amount, req.body.currency, req.body.fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '金額格式錯誤' });
  }
  const fxFee = Math.max(0, Number(req.body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  db.run("UPDATE transactions SET type=?, amount=?, currency=?, original_amount=?, fx_rate=?, fx_fee=?, date=?, category_id=?, account_id=?, note=?, exclude_from_stats=?, updated_at=? WHERE id=? AND user_id=?",
    [type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, Date.now(), req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', (req, res) => {
  // 若為轉帳交易，同時刪除對應的 linked 交易
  const tx = queryOne("SELECT linked_id FROM transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (tx && tx.linked_id) {
    db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [tx.linked_id, req.userId]);
  }
  saveDB();
  res.json({ ok: true });
});

// ─── 批次操作 ───
app.post('/api/transactions/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '未選擇任何交易' });
  let deleted = 0;
  ids.forEach(id => {
    const tx = queryOne("SELECT linked_id FROM transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (!tx) return;
    db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (tx.linked_id) {
      db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [tx.linked_id, req.userId]);
    }
    deleted++;
  });
  saveDB();
  res.json({ deleted });
});

app.post('/api/transactions/batch-update', (req, res) => {
  const { ids, fields } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '未選擇任何交易' });
  if (!fields || Object.keys(fields).length === 0) return res.status(400).json({ error: '未指定更新欄位' });

  // 防 IDOR：批次更新時驗證所有 id/fields 屬於當前使用者
  if (fields.categoryId && !assertOwned('categories', fields.categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  if (fields.accountId && !assertOwned('accounts', fields.accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  if (fields.date !== undefined) {
    const normalizedDate = normalizeDate(fields.date);
    if (!normalizedDate) return res.status(400).json({ error: '日期格式無效' });
    fields.date = normalizedDate;
  }

  const allowedFields = { categoryId: 'category_id', accountId: 'account_id', date: 'date' };
  const setClauses = [];
  const values = [];
  for (const [key, col] of Object.entries(allowedFields)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(fields[key]);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: '無有效更新欄位' });
  setClauses.push('updated_at = ?');
  values.push(Date.now());

  let updated = 0;
  ids.forEach(id => {
    const tx = queryOne("SELECT id FROM transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (!tx) return;
    db.run(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`, [...values, id, req.userId]);
    updated++;
  });
  saveDB();
  res.json({ updated });
});

// ─── 匯入 CSV ───
app.post('/api/transactions/import', (req, res) => {
  const { rows, autoCreate } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '無有效資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });

  // 取得使用者的分類與帳戶，用名稱比對
  const categories = queryAll("SELECT * FROM categories WHERE user_id = ?", [req.userId]);
  const accounts = queryAll("SELECT * FROM accounts WHERE user_id = ?", [req.userId]);
  // 建立分類對照：支援 "父分類 > 子分類" 格式，也支援直接名稱
  const catMap = {};
  categories.forEach(c => {
    if (c.parent_id) {
      const parent = categories.find(p => p.id === c.parent_id);
      if (parent) catMap[parent.name + ' > ' + c.name] = c;
    }
    // 也用純名稱建立對照（子分類也可以直接用名稱匹配）
    if (!catMap[c.name]) catMap[c.name] = c;
  });
  const accMap = {};
  accounts.forEach(a => { accMap[a.name] = a; });

  const now = Date.now();
  const createdCats = [];
  const createdAccs = [];

  // 若 autoCreate，先掃描並建立缺少的分類與帳戶
  if (autoCreate) {
    const maxOrder = queryOne("SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?", [req.userId])?.m || 0;
    let orderCounter = maxOrder;
    const defaultColors = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
    let colorIdx = 0;

    rows.forEach(row => {
      const { type, category, account } = row;
      let dbType = 'expense';
      if (type === '收入') dbType = 'income';
      else if (type === '轉出' || type === '轉入') dbType = null;
      else if (type === '支出') dbType = 'expense';

      // 自動新增分類
      if (dbType && category && !catMap[category]) {
        const catId = uid();
        orderCounter++;
        const color = defaultColors[colorIdx % defaultColors.length];
        colorIdx++;
        db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, is_hidden, sort_order) VALUES (?,?,?,?,?,0,0,?)",
          [catId, req.userId, category, dbType, color, orderCounter]);
        catMap[category] = { id: catId, name: category, type: dbType };
        createdCats.push(category);
      }

      // 自動新增帳戶
      if (account && !accMap[account]) {
        const accId = uid();
        db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency) VALUES (?,?,?,0,'fa-wallet','TWD')",
          [accId, req.userId, account]);
        accMap[account] = { id: accId, name: account };
        createdAccs.push(account);
      }
    });
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  // 第一輪：收集待配對的轉帳（轉出找轉入配對，依日期+金額+備註）
  const pendingTransferOut = []; // { idx, id, date, amount, note, accId }

  rows.forEach((row, idx) => {
    const { date: rawDate, type, category, amount, account, note } = row;
    const date = normalizeDate(rawDate);
    const amt = parseFloat(amount);
    if (!date || !amt || amt <= 0) { skipped++; errors.push(`第 ${idx + 2} 行：日期或金額無效`); return; }

    // 類型對應
    let dbType = 'expense';
    if (type === '收入') dbType = 'income';
    else if (type === '轉出') dbType = 'transfer_out';
    else if (type === '轉入') dbType = 'transfer_in';
    else if (type === '支出') dbType = 'expense';
    else { skipped++; errors.push(`第 ${idx + 2} 行：未知類型「${type}」`); return; }

    // 分類比對（轉帳可無分類）
    let catId = '';
    if (dbType !== 'transfer_out' && dbType !== 'transfer_in') {
      const cat = catMap[category];
      if (cat) catId = cat.id;
    }

    // 帳戶比對
    let accId = '';
    const acc = accMap[account];
    if (acc) accId = acc.id;

    const txId = uid();

    if (dbType === 'transfer_out') {
      // 先插入轉出，稍後配對轉入時回填 linked_id
      db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [txId, req.userId, dbType, amt, 'TWD', amt, 1, date, catId, accId, note || '', '', now, now]);
      pendingTransferOut.push({ id: txId, date, amount: amt, note: note || '' });
      imported++;
    } else if (dbType === 'transfer_in') {
      // 嘗試配對一筆同日期、同金額的轉出
      const matchIdx = pendingTransferOut.findIndex(p => p.date === date && p.amount === amt);
      if (matchIdx !== -1) {
        const matched = pendingTransferOut.splice(matchIdx, 1)[0];
        db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [txId, req.userId, dbType, amt, 'TWD', amt, 1, date, catId, accId, note || '', matched.id, now, now]);
        // 回填轉出的 linked_id
        db.run("UPDATE transactions SET linked_id = ? WHERE id = ?", [txId, matched.id]);
      } else {
        db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [txId, req.userId, dbType, amt, 'TWD', amt, 1, date, catId, accId, note || '', '', now, now]);
      }
      imported++;
    } else {
      db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [txId, req.userId, dbType, amt, 'TWD', amt, 1, date, catId, accId, note || '', now, now]);
      imported++;
    }
  });

  saveDB();
  res.json({
    imported, skipped,
    errors: errors.slice(0, 10),
    created: { categories: createdCats, accounts: createdAccs }
  });
});

app.post('/api/transactions/transfer', (req, res) => {
  const { fromId, toId, amount, date: rawDate, note } = req.body;
  if (fromId === toId) return res.status(400).json({ error: '轉出與轉入帳戶不可相同' });
  if (amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });

  const fromAccount = queryOne('SELECT currency FROM accounts WHERE id = ? AND user_id = ?', [fromId, req.userId]);
  const toAccount = queryOne('SELECT currency FROM accounts WHERE id = ? AND user_id = ?', [toId, req.userId]);
  if (!fromAccount || !toAccount) return res.status(400).json({ error: '帳戶不存在' });

  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const toCurrency = normalizeCurrency(toAccount.currency);
  const transferAmount = Number(amount);
  let outConverted;
  try {
    outConverted = convertToTwd(transferAmount, fromCurrency, null, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '轉帳金額格式錯誤' });
  }
  const inOriginal = toCurrency === fromCurrency
    ? transferAmount
    : convertFromTwd(outConverted.twdAmount, toCurrency, req.userId);
  const inConverted = convertToTwd(inOriginal, toCurrency, null, req.userId);

  const now = Date.now();
  const txDate = normalizeDate(rawDate) || todayStr();
  const txNote = note || '轉帳';
  const outId = uid();
  const inId = uid();
  db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [outId, req.userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, txDate, '', fromId, txNote, inId, now, now]);
  db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [inId, req.userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, txDate, '', toId, txNote, outId, now, now]);
  saveDB();
  res.json({ ok: true });
});

// ─── 預算 ───
app.get('/api/budgets', (req, res) => {
  const { yearMonth } = req.query;
  let sql = "SELECT * FROM budgets WHERE user_id = ?";
  const params = [req.userId];
  if (yearMonth) { sql += " AND year_month = ?"; params.push(yearMonth); }
  const rows = queryAll(sql, params);
  const result = rows.map(b => {
    const month = b.year_month;
    let usedSql = "SELECT COALESCE(SUM(amount),0) as used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0";
    const usedParams = [req.userId, month + '%'];
    if (b.category_id) { usedSql += " AND category_id = ?"; usedParams.push(b.category_id); }
    const used = queryOne(usedSql, usedParams)?.used || 0;
    return { ...b, categoryId: b.category_id, yearMonth: b.year_month, used };
  });
  res.json(result);
});

app.post('/api/budgets', (req, res) => {
  const { categoryId, amount, yearMonth } = req.body;
  if (amount <= 0) return res.status(400).json({ error: '預算金額必須大於 0' });
  const catId = categoryId || null;
  const existing = queryOne("SELECT id FROM budgets WHERE user_id = ? AND year_month = ? AND category_id IS ?", [req.userId, yearMonth, catId]);
  if (existing) {
    db.run("UPDATE budgets SET amount = ? WHERE id = ?", [amount, existing.id]);
  } else {
    db.run("INSERT INTO budgets (id, user_id, category_id, amount, year_month) VALUES (?,?,?,?,?)",
      [uid(), req.userId, catId, amount, yearMonth]);
  }
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/budgets/:id', (req, res) => {
  db.run("DELETE FROM budgets WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// ─── 固定收支 ───
app.get('/api/recurring', (req, res) => {
  const rows = queryAll("SELECT * FROM recurring WHERE user_id = ? ORDER BY start_date DESC", [req.userId]);
  res.json(rows.map(r => ({
    ...r, categoryId: r.category_id, accountId: r.account_id,
    startDate: r.start_date, isActive: !!r.is_active, lastGenerated: r.last_generated,
    currency: r.currency || 'TWD', fxRate: Number(r.fx_rate) || 1,
  })));
});

app.post('/api/recurring', (req, res) => {
  const { type, categoryId, accountId, frequency, startDate, note } = req.body;
  let { amount, currency, fxRate } = req.body;
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart) return res.status(400).json({ error: '起始日期格式無效' });
  currency = normalizeCurrency(currency || 'TWD');
  const converted = convertToTwd(amount, currency, fxRate, req.userId);
  const id = uid();
  db.run("INSERT INTO recurring (id,user_id,type,amount,category_id,account_id,frequency,start_date,note,currency,fx_rate,is_active,last_generated) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,NULL)",
    [id, req.userId, type, converted.twdAmount, categoryId, accountId, frequency, normalizedStart, note || '', converted.currency, converted.fxRate]);
  saveDB();
  res.json({ id });
});

app.put('/api/recurring/:id', (req, res) => {
  const { type, categoryId, accountId, frequency, startDate, note } = req.body;
  let { amount, currency, fxRate } = req.body;
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart) return res.status(400).json({ error: '起始日期格式無效' });
  currency = normalizeCurrency(currency || 'TWD');
  const converted = convertToTwd(amount, currency, fxRate, req.userId);
  db.run("UPDATE recurring SET type=?,amount=?,category_id=?,account_id=?,frequency=?,start_date=?,note=?,currency=?,fx_rate=? WHERE id=? AND user_id=?",
    [type, converted.twdAmount, categoryId, accountId, frequency, normalizedStart, note || '', converted.currency, converted.fxRate, req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/recurring/:id', (req, res) => {
  db.run("DELETE FROM recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.patch('/api/recurring/:id/toggle', (req, res) => {
  const r = queryOne("SELECT is_active FROM recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!r) return res.status(404).json({ error: '不存在' });
  db.run("UPDATE recurring SET is_active = ? WHERE id = ? AND user_id = ?", [r.is_active ? 0 : 1, req.params.id, req.userId]);
  saveDB();
  res.json({ isActive: !r.is_active });
});

app.post('/api/recurring/process', (req, res) => {
  const recs = queryAll("SELECT * FROM recurring WHERE user_id = ? AND is_active = 1", [req.userId]);
  const todayS = todayStr();
  let count = 0;

  recs.forEach(r => {
    let nextDate;
    if (r.last_generated) {
      nextDate = getNextDate(r.last_generated, r.frequency);
    } else {
      nextDate = r.start_date;
    }
    while (nextDate && nextDate <= todayS) {
      const now = Date.now();
      const rCurrency = normalizeCurrency(r.currency || 'TWD');
      const rFxRate = Number(r.fx_rate) > 0 ? Number(r.fx_rate) : 1;
      const rOriginalAmount = rCurrency === 'TWD' ? r.amount : Math.round(r.amount / rFxRate * 10000) / 10000;
      db.run("INSERT INTO transactions (id,user_id,type,amount,original_amount,currency,fx_rate,date,category_id,account_id,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), req.userId, r.type, r.amount, rOriginalAmount, rCurrency, rFxRate, nextDate, r.category_id, r.account_id, (r.note || '') + ' (自動)', now, now]);
      db.run("UPDATE recurring SET last_generated = ? WHERE id = ?", [nextDate, r.id]);
      count++;
      nextDate = getNextDate(nextDate, r.frequency);
    }
  });

  if (count > 0) saveDB();
  res.json({ generated: count });
});

function getNextDate(dateStr, freq) {
  const d = new Date(dateStr);
  switch (freq) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

// ─── TWSE 休市日（有價證券集中交易市場開（休）市日期）───
// 來源：https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule
const TWSE_HOLIDAY_CACHE_TTL = 24 * 60 * 60 * 1000;
const TWSE_HOLIDAY_FAILURE_BACKOFF = 5 * 60 * 1000;
const twseHolidayCache = { set: null, timestamp: 0, lastFailedAt: 0 };
let twseHolidayInflight = null; // 進行中的 fetch Promise，共用避免同時多次外呼

async function fetchTwseHolidaySet() {
  const now = Date.now();
  if (twseHolidayCache.set && (now - twseHolidayCache.timestamp) < TWSE_HOLIDAY_CACHE_TTL) {
    return twseHolidayCache.set;
  }
  // 近期失敗：在 backoff 視窗內不再外呼，避免 API 故障時每次呼叫都卡 ~8s timeout
  if ((now - twseHolidayCache.lastFailedAt) < TWSE_HOLIDAY_FAILURE_BACKOFF) {
    return twseHolidayCache.set || new Set();
  }
  if (twseHolidayInflight) return twseHolidayInflight;

  twseHolidayInflight = (async () => {
    try {
      const res = await fetch('https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        twseHolidayCache.lastFailedAt = Date.now();
        return twseHolidayCache.set || new Set();
      }
      const list = await res.json();
      const set = new Set();
      list.forEach(item => {
        const name = item.Name || '';
        // API 同時包含休市日與特別交易日；「開始交易」/「最後交易」是開市日，要排除
        if (/開始交易|最後交易/.test(name)) return;
        const rocDate = String(item.Date || '');
        if (!/^\d{7}$/.test(rocDate)) return;
        const y = parseInt(rocDate.slice(0, 3), 10) + 1911;
        const m = rocDate.slice(3, 5);
        const d = rocDate.slice(5, 7);
        set.add(`${y}-${m}-${d}`);
      });
      twseHolidayCache.set = set;
      twseHolidayCache.timestamp = Date.now();
      twseHolidayCache.lastFailedAt = 0;
      return set;
    } catch (e) {
      twseHolidayCache.lastFailedAt = Date.now();
      console.error('TWSE holidaySchedule 錯誤:', e.message);
      return twseHolidayCache.set || new Set();
    } finally {
      twseHolidayInflight = null;
    }
  })();

  return twseHolidayInflight;
}

function isTwseWeekend(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

function nextTwseTradingDay(dateStr, holidaySet) {
  let cur = dateStr;
  let safety = 60;
  while (safety-- > 0 && (isTwseWeekend(cur) || (holidaySet && holidaySet.has(cur)))) {
    const [y, m, d] = cur.split('-').map(Number);
    const nx = new Date(Date.UTC(y, m - 1, d + 1));
    cur = nx.toISOString().slice(0, 10);
  }
  return cur;
}

// ─── 儀表板 ───
app.get('/api/dashboard', (req, res) => {
  const month = thisMonth();
  const todayS = todayStr();

  const income = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0", [req.userId, month + '%'])?.total || 0;
  const expense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0", [req.userId, month + '%'])?.total || 0;
  const todayExpense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0", [req.userId, todayS])?.total || 0;

  const catBreakdown = queryAll(`
    SELECT t.category_id as categoryId,
           c.name,
           c.color,
           c.parent_id as parentId,
           p.name as parentName,
           p.color as parentColor,
           COALESCE(SUM(t.amount),0) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
    GROUP BY t.category_id, c.name, c.color, c.parent_id, p.name, p.color
    ORDER BY total DESC
  `, [req.userId, month + '%']);

  const recent = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense')
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `, [req.userId]);

  res.json({ income, expense, net: income - expense, todayExpense, catBreakdown, recent });
});

// ─── 報表 ───
app.get('/api/reports', (req, res) => {
  const { type, from, to } = req.query;
  const txType = type || 'expense';

  let txs;
  if (from && to) {
    txs = queryAll(`
      SELECT t.*, c.name as cat_name, c.color as cat_color, c.parent_id as cat_parent_id,
             p.name as cat_parent_name, p.color as cat_parent_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ? AND t.exclude_from_stats = 0
      ORDER BY t.date
    `, [req.userId, txType, from, to]);
  } else {
    txs = queryAll(`
      SELECT t.*, c.name as cat_name, c.color as cat_color, c.parent_id as cat_parent_id,
             p.name as cat_parent_name, p.color as cat_parent_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE t.user_id = ? AND t.type = ? AND t.exclude_from_stats = 0
      ORDER BY t.date
    `, [req.userId, txType]);
  }

  const catMap = {};
  const categoryMap = {};
  txs.forEach(t => {
    const amount = Number(t.amount) || 0;
    const name = t.cat_name || '未分類';
    const color = t.cat_color || '#94a3b8';
    if (!catMap[name]) catMap[name] = { total: 0, color };
    catMap[name].total += amount;

    const categoryId = t.category_id || '';
    const parentId = t.cat_parent_id || '';
    const parentName = parentId ? (t.cat_parent_name || '未分類') : name;
    const parentColor = parentId ? (t.cat_parent_color || color) : color;
    const key = categoryId || `name:${name}`;

    if (!categoryMap[key]) {
      categoryMap[key] = {
        categoryId,
        name,
        color,
        parentId,
        parentName,
        parentColor,
        total: 0,
      };
    }
    categoryMap[key].total += amount;
  });

  const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.total - a.total);

  const dailyMap = {};
  const monthlyMap = {};
  txs.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.amount);
    const m = t.date.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + Number(t.amount);
  });

  res.json({
    catMap,
    categoryBreakdown,
    dailyMap,
    monthlyMap,
    total: txs.reduce((s, t) => s + Number(t.amount), 0),
  });
});

// ─── TWSE 股票查詢（代理 + 快取）───
let twseCache = { data: null, timestamp: 0 };
const TWSE_CACHE_TTL = 10 * 60 * 1000; // 10 分鐘快取（盤後收盤資料）
const TWSE_REALTIME_CACHE_TTL = 60 * 1000; // 1 分鐘快取（即時報價）
const realtimeCache = {}; // { [symbol]: { ...data, timestamp } }

// 台灣時間輔助
function getTaiwanTime() {
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = twTime.getUTCDay();
  const minutes = twTime.getUTCHours() * 60 + twTime.getUTCMinutes();
  return { twTime, day, minutes };
}

// 判斷目前是否為台股交易時間（週一~週五 09:00-13:30 台灣時間 UTC+8）
function isTwseTrading() {
  const { day, minutes } = getTaiwanTime();
  if (day === 0 || day === 6) return false;
  return minutes >= 9 * 60 && minutes < 13 * 60 + 30;
}

// 判斷目前是否為台股盤後可取今日收盤價時段（09:00-16:00，涵蓋盤中及盤後收盤資料更新）
function isTwseWeekdaySession() {
  const { day, minutes } = getTaiwanTime();
  if (day === 0 || day === 6) return false;
  return minutes >= 9 * 60 && minutes < 16 * 60; // 09:00 ~ 16:00
}

// 將 TWSE 日期格式轉為 YYYY/MM/DD（支援民國曆 YYYMMDD 7碼與西元 YYYYMMDD 8碼）
function formatTwseDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(/\//g, ''); // 移除可能的斜線
  if (s.length === 7) {
    // 民國曆 YYYMMDD → 西元
    const year = parseInt(s.slice(0, 3)) + 1911;
    return `${year}/${s.slice(3, 5)}/${s.slice(5, 7)}`;
  }
  if (s.length === 8) {
    return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`;
  }
  return dateStr;
}

// 即時報價（盤中）— 先試上市(tse)再試上櫃(otc)
async function fetchTwseRealtime(symbol) {
  const now = Date.now();
  const cached = realtimeCache[symbol];
  if (cached && (now - cached.timestamp) < TWSE_REALTIME_CACHE_TTL) {
    return cached;
  }
  for (const ex of ['tse', 'otc']) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${symbol}.tw&json=1&delay=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.twse.com.tw/' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.msgArray || data.msgArray.length === 0) continue;
      const info = data.msgArray[0];
      if (!info.c || info.c !== symbol) continue;
      // z = 即時成交價（無成交時為 '-'），y = 昨收價，d = 日期，t = 時間
      const isRealtime = info.z && info.z !== '-';
      const price = isRealtime ? parseFloat(info.z) : parseFloat(info.y || '0');
      const rawDate = info.d || '';  // YYYYMMDD
      const dataDate = formatTwseDate(rawDate);
      const dataTime = (isRealtime && info.t) ? info.t.slice(0, 5) : ''; // HH:MM
      const result = {
        found: true,
        symbol: info.c,
        name: info.n,
        closingPrice: price || 0,
        isRealtime,
        priceType: isRealtime ? '即時成交價' : '昨收價',
        dataDate,
        dataTime,
        timestamp: now,
      };
      realtimeCache[symbol] = result;
      return result;
    } catch (e) {
      // 繼續嘗試下一個交易所
    }
  }
  return null;
}

// 單股當日/月份收盤資料（STOCK_DAY）— 能取得指定日期的收盤價，比 STOCK_DAY_ALL 更即時
const stockDayCache = {}; // { [symbol_YYYYMMDD]: { data, timestamp } }
const STOCK_DAY_CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

async function fetchTwseStockDay(symbol, dateStr) {
  // dateStr: YYYYMMDD (西元)
  const cacheKey = `${symbol}_${dateStr}`;
  const now = Date.now();
  const cached = stockDayCache[cacheKey];
  if (cached && (now - cached.timestamp) < STOCK_DAY_CACHE_TTL) return cached.data;

  try {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${symbol}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.twse.com.tw/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK' || !json.data || json.data.length === 0) return null;

    // 欄位順序: [日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
    // 日期格式為民國 YYY/MM/DD，轉換目標日期進行比對
    const rocYear = parseInt(dateStr.slice(0, 4)) - 1911;
    const rocMonth = dateStr.slice(4, 6);
    const rocDay = dateStr.slice(6, 8);
    const targetRoc = `${rocYear}/${rocMonth}/${rocDay}`;

    // 找當日資料，找不到就取最後一筆（最近交易日）
    let row = json.data.find(r => r[0] === targetRoc);
    if (!row) row = json.data[json.data.length - 1];

    // 解析該筆資料的日期（民國轉西元）
    const parts = row[0].split('/');
    const adYear = parseInt(parts[0]) + 1911;
    const rowDate = `${adYear}/${parts[1]}/${parts[2]}`;

    // 去除千分位逗號後轉數字
    const toNum = s => parseFloat((s || '0').replace(/,/g, '')) || 0;

    // 取股票名稱：先從 STOCK_DAY_ALL 快取找，再嘗試解析 title
    // title 格式可能為 "115年03月 台積電 月份成交資訊" 或 "台積電 月份成交資訊"
    let stockName = symbol;
    const allCached = twseCache.data;
    if (allCached) {
      const found = allCached.find(s => s.Code === symbol);
      if (found) stockName = found.Name;
    }
    if (stockName === symbol && json.title) {
      const m = json.title.match(/\d{3}年\d{2}月\s+(.+?)\s+月份/) ||
                json.title.match(/^(.+?)\s+月份/);
      if (m) stockName = m[1];
    }

    const result = {
      found: true,
      symbol,
      name: stockName,
      closingPrice: toNum(row[6]),
      openingPrice: toNum(row[3]),
      highestPrice: toNum(row[4]),
      lowestPrice: toNum(row[5]),
      isRealtime: false,
      priceType: '收盤價',
      dataDate: rowDate,
      dataTime: '',
    };
    stockDayCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('STOCK_DAY API 錯誤:', e.message);
    return null;
  }
}

// 上櫃 STOCK_DAY（TPEx 個股日成交資訊）
const tpexDayCache = {};
async function fetchTpexStockDay(symbol, dateStr) {
  const cacheKey = `${symbol}_${dateStr}`;
  const now = Date.now();
  const cached = tpexDayCache[cacheKey];
  if (cached && (now - cached.timestamp) < STOCK_DAY_CACHE_TTL) return cached.data;

  try {
    // TPEx 日期格式為民國 YYY/MM/DD
    const rocYear = parseInt(dateStr.slice(0, 4)) - 1911;
    const rocDate = `${rocYear}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${encodeURIComponent(rocDate)}&stkno=${symbol}&_=${now}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tpex.org.tw/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.aaData || json.aaData.length === 0) return null;

    // 取最後一筆（最近交易日）
    const row = json.aaData[json.aaData.length - 1];
    // 欄位: [日期, 成交股數, 成交金額, 開盤, 最高, 最低, 收盤, 漲跌價差, 成交筆數]
    const toNum = s => parseFloat((s || '0').replace(/,/g, '')) || 0;
    const parts = row[0].split('/');
    const adYear = parseInt(parts[0]) + 1911;
    const rowDate = `${adYear}/${parts[1]}/${parts[2]}`;

    const result = {
      found: true,
      symbol,
      name: json.stkName || symbol,
      closingPrice: toNum(row[6]),
      openingPrice: toNum(row[3]),
      highestPrice: toNum(row[4]),
      lowestPrice: toNum(row[5]),
      isRealtime: false,
      priceType: '收盤價（櫃買）',
      dataDate: rowDate,
      dataTime: '',
    };
    tpexDayCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('TPEx STOCK_DAY API 錯誤:', e.message);
    return null;
  }
}

// 盤後收盤資料（STOCK_DAY_ALL + TPEX）
let tpexCache = { data: null, timestamp: 0 };
const TPEX_CACHE_TTL = 10 * 60 * 1000; // 10 分鐘

async function fetchTpexStockAll() {
  const now = Date.now();
  if (tpexCache.data && (now - tpexCache.timestamp) < TPEX_CACHE_TTL) {
    return tpexCache.data;
  }
  try {
    const res = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return tpexCache.data || [];
    const raw = await res.json();
    // 轉換為與 TWSE 相同的格式
    const data = raw.map(r => ({
      Code: r.SecuritiesCompanyCode,
      Name: r.CompanyName,
      ClosingPrice: r.Close,
      OpeningPrice: r.Open,
      HighestPrice: r.High,
      LowestPrice: r.Low,
      Change: r.Change,
      TradeVolume: r.TradeVolume,
      Date: r.Date,
      _source: 'tpex',
    }));
    tpexCache = { data, timestamp: now };
    return data;
  } catch (e) {
    console.error('TPEx ALL API 錯誤:', e.message);
    return tpexCache.data || [];
  }
}

async function fetchTwseStockAll() {
  const now = Date.now();
  if (twseCache.data && (now - twseCache.timestamp) < TWSE_CACHE_TTL) {
    return twseCache.data;
  }
  try {
    // 同時取得上市 + 上櫃資料
    const [twseRes, tpexData] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetchTpexStockAll(),
    ]);
    if (!twseRes.ok) throw new Error('TWSE API 回應錯誤');
    const twseData = await twseRes.json();
    const merged = [...twseData, ...tpexData];
    twseCache = { data: merged, timestamp: now };
    return merged;
  } catch (e) {
    console.error('TWSE API 錯誤:', e.message);
    return twseCache.data || [];
  }
}

// 查詢單一股票（依代號）
// 前端依台灣時間判斷，傳入不同參數：
//   ?realtime=1           → 盤中即時報價（mis.twse.com.tw）
//   ?date=YYYYMMDD        → 指定日期收盤價（STOCK_DAY，盤後最即時）
//   （無參數）            → STOCK_DAY_ALL（盤後備援）
app.get('/api/twse/stock/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: '請輸入股票代號' });
  if (!/^[A-Z0-9]{2,10}$/i.test(symbol)) return res.status(400).json({ error: '股票代號格式不正確' });
  const useRealtime = req.query.realtime === '1';
  const dateParam = String(req.query.date || '').replace(/\D/g, ''); // YYYYMMDD

  try {
    // 1. 盤中即時報價
    if (useRealtime) {
      const rt = await fetchTwseRealtime(symbol);
      if (rt && rt.found && rt.closingPrice > 0) return res.json(rt);
    }

    // 2. 指定日期收盤 — 先試上市（TWSE），再試上櫃（TPEx）
    if (dateParam.length === 8) {
      const sd = await fetchTwseStockDay(symbol, dateParam);
      if (sd && sd.found && sd.closingPrice > 0) return res.json(sd);
      // 上市查無資料，嘗試上櫃
      const tpex = await fetchTpexStockDay(symbol, dateParam);
      if (tpex && tpex.found && tpex.closingPrice > 0) return res.json(tpex);
    }

    // 3. 備援：STOCK_DAY_ALL（已合併上市 + 上櫃）
    const allStocks = await fetchTwseStockAll();
    const stock = allStocks.find(s => s.Code === symbol);
    if (!stock) return res.json({ found: false });
    const isTpex = stock._source === 'tpex';
    res.json({
      found: true,
      symbol: stock.Code,
      name: stock.Name,
      closingPrice: parseFloat(stock.ClosingPrice) || 0,
      openingPrice: parseFloat(stock.OpeningPrice) || 0,
      highestPrice: parseFloat(stock.HighestPrice) || 0,
      lowestPrice: parseFloat(stock.LowestPrice) || 0,
      change: parseFloat(stock.Change) || 0,
      volume: parseInt(stock.TradeVolume) || 0,
      isRealtime: false,
      priceType: isTpex ? '收盤價（櫃買）' : '收盤價',
      dataDate: formatTwseDate(stock.Date || ''),
      dataTime: '',
    });
  } catch (e) {
    res.status(500).json({ error: '查詢失敗：' + e.message });
  }
});

// 搜尋股票（模糊比對代號或名稱，最多回傳 10 筆）— 固定用收盤資料
app.get('/api/twse/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  // 限制查詢字串長度避免濫用與快取污染
  if (q.length > 20) return res.status(400).json({ error: '查詢字串過長' });
  try {
    const allStocks = await fetchTwseStockAll();
    const results = allStocks
      .filter(s => s.Code.includes(q) || s.Name.includes(q))
      .slice(0, 10)
      .map(s => ({
        symbol: s.Code,
        name: s.Name,
        closingPrice: parseFloat(s.ClosingPrice) || 0,
      }));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: '搜尋失敗：' + e.message });
  }
});

// ─── TWSE 除權息查詢（自動同步股利）───
const dividendCache = {}; // { [key]: { data, timestamp } }
const DIVIDEND_CACHE_TTL = 30 * 60 * 1000; // 30 分鐘快取

// 查詢 TWT49U 除權息列表（指定日期範圍）
async function fetchTwseDividendList(startDate, endDate) {
  const key = `${startDate}_${endDate}`;
  const now = Date.now();
  if (dividendCache[key] && (now - dividendCache[key].timestamp) < DIVIDEND_CACHE_TTL) {
    return dividendCache[key].data;
  }
  try {
    const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.stat !== 'OK' || !json.data) return [];
    // data: [["113年07月01日","1101","台泥",...,"息",...], ...]
    // fields[0]=資料日期, [1]=股票代號, [2]=股票名稱, [5]=權值+息值, [6]=權/息
    const records = json.data.map(row => ({
      dateRoc: row[0],         // "113年07月01日"
      date: convertRocDate(row[0]),  // "2024-07-01"
      symbol: row[1],
      name: row[2],
      valuePerShare: parseFloat(String(row[5]).replace(/,/g, '')) || 0,
      type: row[6],            // "息"、"權"、"權息"
      detailKey: row[11],      // "1101,20240701"
    }));
    dividendCache[key] = { data: records, timestamp: now };
    return records;
  } catch (e) {
    console.error('TWSE TWT49U 查詢失敗:', e.message);
    return [];
  }
}

// 查詢 TWT49UDetail 取得個股除權息明細（現金股利/股票股利分解）
async function fetchTwseDividendDetail(symbol, dateStr8) {
  const key = `detail_${symbol}_${dateStr8}`;
  const now = Date.now();
  if (dividendCache[key] && (now - dividendCache[key].timestamp) < DIVIDEND_CACHE_TTL) {
    return dividendCache[key].data;
  }
  try {
    const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49UDetail?response=json&STK_NO=${symbol}&T1=${dateStr8}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.stat !== 'ok' || !json.data || json.data.length === 0) return null;
    // fields: ["股票代號","股票名稱","(每股配發現金股利)除息","(增資配股) 除權",
    //          "A. 按普通股股東持股比例每千股無償配股", ...]
    const row = json.data[0];
    // row[2] = "(每股配發現金股利)除息" e.g. "2 元／股" or ""
    // row[4] = "A. 每千股無償配股" e.g. "100 股" or "0 股"
    const cashMatch = String(row[2]).match(/([\d.]+)/);
    const stockMatch = String(row[4]).match(/([\d.]+)/);
    const result = {
      symbol: row[0],
      name: row[1],
      cashDividendPerShare: cashMatch ? parseFloat(cashMatch[1]) : 0,
      stockDividendPer1000: stockMatch ? parseFloat(stockMatch[1]) : 0,
    };
    dividendCache[key] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('TWSE TWT49UDetail 查詢失敗:', e.message);
    return null;
  }
}

// ROC 日期轉西元："113年07月01日" → "2024-07-01"
function convertRocDate(rocStr) {
  const m = rocStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return '';
  const year = parseInt(m[1]) + 1911;
  return `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

// 計算指定日期的持股數（依交易紀錄累計）
function calcSharesOnDate(txs, targetDate) {
  let shares = 0;
  for (const t of txs) {
    if (t.date > targetDate) break; // 交易日期已超過目標日期
    if (t.type === 'buy') shares += t.shares;
    else shares -= t.shares;
  }
  return shares;
}

// 自動同步除權息 API
app.post('/api/stock-dividends/sync', async (req, res) => {
  try {
    const stocks = queryAll("SELECT * FROM stocks WHERE user_id = ?", [req.userId]);
    if (stocks.length === 0) return res.json({ synced: 0, skipped: 0, errors: [] });

    // 為每檔股票找出持股期間（首次買入 ~ 最後賣出清零 or 至今）
    const symbolSet = new Set(stocks.map(s => s.symbol));
    const stockHoldingPeriods = {};
    stocks.forEach(s => {
      const txs = queryAll(
        "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at",
        [s.id, req.userId]
      );
      if (txs.length === 0) return;
      // 找出所有持股區間 [buyDate, sellDate]
      const periods = [];
      let shares = 0, periodStart = null;
      txs.forEach(t => {
        if (t.type === 'buy') {
          if (shares === 0) periodStart = t.date;
          shares += t.shares;
        } else {
          shares -= t.shares;
          if (shares <= 0) {
            if (periodStart) periods.push({ start: periodStart, end: t.date });
            shares = 0;
            periodStart = null;
          }
        }
      });
      // 目前仍持有中
      if (shares > 0 && periodStart) {
        periods.push({ start: periodStart, end: null }); // null = 至今
      }
      if (periods.length > 0) {
        stockHoldingPeriods[s.symbol] = { stock: s, txs, periods };
      }
    });

    if (Object.keys(stockHoldingPeriods).length === 0) {
      return res.json({ synced: 0, skipped: 0, errors: [], message: '尚無交易紀錄' });
    }

    // 收集所有需要查詢的年度範圍
    const today = todayStr();
    let minYear = parseInt(today.slice(0, 4)), maxYear = minYear;
    Object.values(stockHoldingPeriods).forEach(({ periods }) => {
      periods.forEach(p => {
        const sy = parseInt(p.start.slice(0, 4));
        if (sy < minYear) minYear = sy;
        if (p.end) {
          const ey = parseInt(p.end.slice(0, 4));
          if (ey > maxYear) maxYear = ey;
        }
      });
    });
    maxYear = Math.min(maxYear, parseInt(today.slice(0, 4)));

    // 按年分段查詢 TWSE 除權息資料，每次間隔 2 秒避免被限流
    const delay = ms => new Promise(r => setTimeout(r, ms));
    let allDividends = [];
    for (let y = minYear; y <= maxYear; y++) {
      const sd = `${y}0101`;
      const ed = (y === maxYear) ? today.replace(/-/g, '') : `${y}1231`;
      console.log(`[股利同步] 查詢 TWSE 除權息 ${y} 年 (${sd}~${ed})...`);
      const divs = await fetchTwseDividendList(sd, ed);
      console.log(`[股利同步] ${y} 年取得 ${divs.length} 筆除權息資料`);
      allDividends = allDividends.concat(divs);
      // 避免 TWSE 限流，間隔 2 秒
      if (y < maxYear) await delay(2000);
    }

    // 只保留使用者持有的股票代號
    const relevantDivs = allDividends.filter(d => symbolSet.has(d.symbol));

    // 去除 API 回傳的重複項目（同一 detailKey 或同股票同日期只保留一筆）
    const seenKeys = new Set();
    const uniqueDivs = relevantDivs.filter(d => {
      const key = d.detailKey || `${d.symbol},${d.date}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    let synced = 0, skipped = 0;
    const errors = [];

    for (const div of uniqueDivs) {
      const holding = stockHoldingPeriods[div.symbol];
      if (!holding) { skipped++; continue; }

      const stock = holding.stock;

      // 檢查除息日是否落在任一持股區間內
      const inHoldingPeriod = holding.periods.some(p => {
        const afterStart = div.date >= p.start;
        const beforeEnd = p.end === null || div.date <= p.end;
        return afterStart && beforeEnd;
      });
      if (!inHoldingPeriod) { skipped++; continue; }

      // 檢查是否已有此日期（或同月份 TWSE 同步）的股利紀錄
      // 避免月配息 ETF（如 00929）在同月產生多筆重複記錄
      const divMonth = div.date.slice(0, 7); // "2026-03"
      const existing = queryOne(
        "SELECT id FROM stock_dividends WHERE user_id = ? AND stock_id = ? AND (date = ? OR (date LIKE ? AND note LIKE '%TWSE自動同步%'))",
        [req.userId, stock.id, div.date, divMonth + '%']
      );
      if (existing) { skipped++; continue; }

      // 取得此日期的持股數（根據交易紀錄累計）
      const sharesHeld = calcSharesOnDate(holding.txs, div.date);
      if (sharesHeld <= 0) { skipped++; continue; }

      // 取得現金股利 / 股票股利明細
      let cashPerShare = 0, stockPer1000 = 0;

      if (div.type === '息') {
        cashPerShare = div.valuePerShare;
      } else {
        const dateStr8 = div.date.replace(/-/g, '');
        // Detail 查詢前也加延遲避免限流
        await delay(500);
        const detail = await fetchTwseDividendDetail(div.symbol, dateStr8);
        if (detail) {
          cashPerShare = detail.cashDividendPerShare;
          stockPer1000 = detail.stockDividendPer1000;
        } else {
          if (div.type === '權') { skipped++; errors.push(`${div.symbol} ${div.date} 無法取得除權明細`); continue; }
          cashPerShare = div.valuePerShare;
        }
      }

      // 計算實際股利金額
      const cashDividend = Math.round(sharesHeld * cashPerShare);
      const stockDividendShares = stockPer1000 > 0 ? Math.round(sharesHeld * stockPer1000 / 1000 * 100) / 100 : 0;

      if (cashDividend === 0 && stockDividendShares === 0) { skipped++; continue; }

      // 新增股利紀錄
      db.run(
        "INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), req.userId, stock.id, div.date, cashDividend, stockDividendShares,
         `TWSE自動同步（每股$${cashPerShare}${stockPer1000 > 0 ? `, 每千股配${stockPer1000}股` : ''}）`, Date.now()]
      );
      synced++;
      console.log(`[股利同步] ${div.symbol} ${div.date} → 現金$${cashDividend}${stockDividendShares > 0 ? `, 配股${stockDividendShares}` : ''}`);
    }

    if (synced > 0) saveDB();
    console.log(`[股利同步] 完成：同步 ${synced} 筆，跳過 ${skipped} 筆，錯誤 ${errors.length} 筆`);
    res.json({ synced, skipped, errors: errors.slice(0, 10) });
  } catch (e) {
    console.error('股利同步失敗:', e.message);
    res.status(500).json({ error: '同步失敗：' + e.message });
  }
});

// ─── 股票 ───
app.get('/api/stock-settings', (req, res) => {
  const settings = getStockSettings(req.userId);
  res.json(settings);
});

app.put('/api/stock-settings', (req, res) => {
  try {
    const current = getStockSettings(req.userId);
    const normalized = normalizeStockSettingsInput(req.body || {}, current);
    db.run(`UPDATE stock_settings
      SET fee_rate = ?, fee_discount = ?, fee_min_lot = ?, fee_min_odd = ?,
          sell_tax_rate_stock = ?, sell_tax_rate_etf = ?, sell_tax_rate_warrant = ?, sell_tax_min = ?, updated_at = ?
      WHERE user_id = ?`,
      [
        normalized.feeRate,
        normalized.feeDiscount,
        normalized.feeMinLot,
        normalized.feeMinOdd,
        normalized.sellTaxRateStock,
        normalized.sellTaxRateEtf,
        normalized.sellTaxRateWarrant,
        normalized.sellTaxMin,
        Date.now(),
        req.userId,
      ]);
    saveDB();
    res.json(normalized);
  } catch (e) {
    res.status(400).json({ error: e.message || '股票設定更新失敗' });
  }
});

// 股票定期定額
app.get('/api/stock-recurring', (req, res) => {
  const rows = queryAll(
    `SELECT sr.*, s.symbol, s.name as stock_name
     FROM stock_recurring sr
     LEFT JOIN stocks s ON sr.stock_id = s.id
     WHERE sr.user_id = ?
     ORDER BY sr.start_date DESC, sr.created_at DESC`,
    [req.userId]
  );
  res.json(rows.map(r => ({
    ...r,
    stockId: r.stock_id,
    accountId: r.account_id,
    startDate: r.start_date,
    isActive: !!r.is_active,
    lastGenerated: r.last_generated,
    stockName: r.stock_name,
  })));
});

app.post('/api/stock-recurring', (req, res) => {
  const { stockId, amount, frequency, startDate: rawStartDate, accountId, note } = req.body || {};
  const startDate = normalizeDate(rawStartDate);
  const nAmount = Number(amount);
  const validFreq = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!stockId || !(nAmount > 0) || !startDate || !validFreq.includes(frequency)) {
    return res.status(400).json({ error: '欄位格式不正確' });
  }
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });

  const id = uid();
  db.run(
    "INSERT INTO stock_recurring (id, user_id, stock_id, amount, frequency, start_date, account_id, note, is_active, last_generated, created_at) VALUES (?,?,?,?,?,?,?,?,1,NULL,?)",
    [id, req.userId, stockId, nAmount, frequency, startDate, accountId || '', note || '', Date.now()]
  );
  saveDB();
  res.json({ id });
});

app.put('/api/stock-recurring/:id', (req, res) => {
  const current = queryOne("SELECT id FROM stock_recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!current) return res.status(404).json({ error: '定期定額不存在' });

  const { stockId, amount, frequency, startDate: rawStartDate, accountId, note } = req.body || {};
  const startDate = normalizeDate(rawStartDate);
  const nAmount = Number(amount);
  const validFreq = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!stockId || !(nAmount > 0) || !startDate || !validFreq.includes(frequency)) {
    return res.status(400).json({ error: '欄位格式不正確' });
  }
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });

  db.run(
    "UPDATE stock_recurring SET stock_id = ?, amount = ?, frequency = ?, start_date = ?, account_id = ?, note = ? WHERE id = ? AND user_id = ?",
    [stockId, nAmount, frequency, startDate, accountId || '', note || '', req.params.id, req.userId]
  );
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/stock-recurring/:id', (req, res) => {
  db.run("DELETE FROM stock_recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.patch('/api/stock-recurring/:id/toggle', (req, res) => {
  const r = queryOne("SELECT is_active FROM stock_recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!r) return res.status(404).json({ error: '定期定額不存在' });
  db.run("UPDATE stock_recurring SET is_active = ? WHERE id = ? AND user_id = ?", [r.is_active ? 0 : 1, req.params.id, req.userId]);
  saveDB();
  res.json({ isActive: !r.is_active });
});

app.post('/api/stock-recurring/process', async (req, res) => {
  const recs = queryAll("SELECT * FROM stock_recurring WHERE user_id = ? AND is_active = 1", [req.userId]);
  if (recs.length === 0) return res.json({ generated: 0, skipped: 0, postponed: 0 });
  const settings = getStockSettings(req.userId);
  const todayS = todayStr();
  const holidaySet = await fetchTwseHolidaySet();
  let generated = 0;
  let skipped = 0;
  let postponed = 0;
  let touched = false;

  for (const r of recs) {
    let scheduledDate;
    if (r.last_generated) {
      scheduledDate = getNextDate(r.last_generated, r.frequency);
    } else {
      scheduledDate = r.start_date;
    }
    while (scheduledDate && scheduledDate <= todayS) {
      // 遇到假日或週末延後到下一個交易日
      const actualDate = nextTwseTradingDay(scheduledDate, holidaySet);
      if (actualDate > todayS) break; // 下一個交易日還沒到，下次再處理
      if (actualDate !== scheduledDate) postponed++;

      const stock = queryOne("SELECT id, current_price FROM stocks WHERE id = ? AND user_id = ?", [r.stock_id, req.userId]);
      const price = Number(stock?.current_price || 0);

      if (!(price > 0)) {
        db.run("UPDATE stock_recurring SET last_generated = ? WHERE id = ?", [scheduledDate, r.id]);
        touched = true;
        skipped++;
        scheduledDate = getNextDate(scheduledDate, r.frequency);
        continue;
      }

      const shares = Math.floor(Number(r.amount) / price);
      if (!(shares >= 1)) {
        db.run("UPDATE stock_recurring SET last_generated = ? WHERE id = ?", [scheduledDate, r.id]);
        touched = true;
        skipped++;
        scheduledDate = getNextDate(scheduledDate, r.frequency);
        continue;
      }

      const amount = shares * price;
      const fee = calcStockFee(amount, shares, settings);
      const noteParts = [r.note || '', '定期定額自動'];
      if (actualDate !== scheduledDate) noteParts.push(`原排程 ${scheduledDate} 順延`);
      const finalNote = noteParts.filter(Boolean).join(' | ');
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), req.userId, r.stock_id, actualDate, 'buy', shares, price, fee, 0, r.account_id || '', finalNote, Date.now()]
      );
      // last_generated 以排程日記錄，下一期從排程日推算，維持原本週期節奏
      db.run("UPDATE stock_recurring SET last_generated = ? WHERE id = ?", [scheduledDate, r.id]);
      touched = true;
      generated++;
      scheduledDate = getNextDate(scheduledDate, r.frequency);
    }
  }

  if (touched) saveDB();
  res.json({ generated, skipped, postponed });
});

// 股票清單
app.get('/api/stocks', (req, res) => {
  const stockSettings = getStockSettings(req.userId);
  const stocks = queryAll("SELECT * FROM stocks WHERE user_id = ? ORDER BY symbol", [req.userId]);
  const result = stocks.map(s => {
    const txs = queryAll("SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at", [s.id, req.userId]);
    const divs = queryAll("SELECT * FROM stock_dividends WHERE stock_id = ? AND user_id = ? ORDER BY date DESC", [s.id, req.userId]);
    // FIFO 計算持股與成本
    let lots = []; // { shares, price, fee }
    let totalShares = 0;
    let realizedPL = 0;
    txs.forEach(t => {
      if (t.type === 'buy') {
        lots.push({ shares: t.shares, price: t.price, fee: t.fee || 0 });
        totalShares += t.shares;
      } else {
        let remaining = t.shares;
        const sellRevenue = t.shares * t.price - t.fee - t.tax;
        let sellCost = 0;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const used = Math.min(remaining, lot.shares);
          const feeUsed = lot.shares === used ? lot.fee : Math.round(lot.fee * used / lot.shares);
          sellCost += used * lot.price + feeUsed;
          lot.fee -= feeUsed;
          lot.shares -= used;
          remaining -= used;
          if (lot.shares <= 0) lots.shift();
        }
        realizedPL += sellRevenue - sellCost;
        totalShares -= t.shares;
      }
    });
    // 加上股票股利的股數
    divs.forEach(d => { totalShares += (d.stock_dividend_shares || 0); });
    // 現買公式
    // 成本金額 = 買進價金 + 手續費
    const totalCost = lots.reduce((sum, l) => sum + l.shares * l.price + l.fee, 0);
    // 均價（成本均價）= 成本金額 / 股數
    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    // 市值 = 現價 × 股數
    const marketValue = totalShares * (s.current_price || 0);
    const estSellFee = calcStockFee(marketValue, totalShares, stockSettings);
    const estSellTax = calcStockTax(marketValue, s.stock_type, stockSettings);
    // 預估淨收付 = 市值 – 手續費 – 交易稅
    const estimatedNet = marketValue - estSellFee - estSellTax;
    // 預估損益 = 預估淨收付 – 成本金額
    const estimatedProfit = estimatedNet - totalCost;
    // 報酬率 = 預估損益 / 成本金額 × 100%
    const returnRate = totalCost > 0 ? (estimatedProfit / totalCost * 100) : 0;
    const totalDividend = divs.reduce((sum, d) => sum + d.cash_dividend, 0);
    return {
      ...s, totalShares, avgCost: Math.round(avgCost * 100) / 100,
      totalCost: Math.round(totalCost), marketValue: Math.round(marketValue),
      estSellFee, estSellTax,
      estimatedNet: Math.round(estimatedNet),
      estimatedProfit: Math.round(estimatedProfit),
      returnRate: Math.round(returnRate * 100) / 100,
      realizedPL: Math.round(realizedPL * 100) / 100,
      totalDividend: Math.round(totalDividend),
      currentPrice: s.current_price, updatedAt: s.updated_at,
      stockType: s.stock_type
    };
  });
  res.json(result);
});

app.post('/api/stocks', (req, res) => {
  const { symbol, name, stockType } = req.body;
  if (!symbol || !name) return res.status(400).json({ error: '股票代號和名稱為必填' });
  const dup = queryOne("SELECT id FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
  if (dup) return res.status(400).json({ error: '此股票代號已存在' });
  const id = uid();
  const validTypes = ['stock', 'etf', 'warrant'];
  const type = validTypes.includes(stockType) ? stockType : 'stock';
  db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?,?,?,?,0,?,?)",
    [id, req.userId, symbol, name, type, todayStr()]);
  saveDB();
  res.json({ id });
});

app.put('/api/stocks/:id', (req, res) => {
  const { name, currentPrice, stockType } = req.body;
  const s = queryOne("SELECT * FROM stocks WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!s) return res.status(404).json({ error: '股票不存在' });
  const validTypes = ['stock', 'etf', 'warrant'];
  const type = validTypes.includes(stockType) ? stockType : (s.stock_type || 'stock');
  db.run("UPDATE stocks SET name = ?, current_price = ?, stock_type = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [name || s.name, currentPrice != null ? currentPrice : s.current_price, type, todayStr(), req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 批次更新股價
app.post('/api/stocks/batch-price', (req, res) => {
  const { prices } = req.body; // [{ id, currentPrice }]
  if (!Array.isArray(prices)) return res.status(400).json({ error: '無效資料' });
  prices.forEach(p => {
    db.run("UPDATE stocks SET current_price = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [p.currentPrice, todayStr(), p.id, req.userId]);
  });
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/stocks/:id', (req, res) => {
  const s = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!s) return res.status(404).json({ error: '股票不存在' });
  // 連帶刪除所有相關紀錄（交易紀錄、股利紀錄）
  db.run("DELETE FROM stock_transactions WHERE stock_id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM stock_dividends WHERE stock_id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM stocks WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 清理無持股且無紀錄的股票
app.post('/api/stocks/cleanup', (req, res) => {
  const stocks = queryAll("SELECT * FROM stocks WHERE user_id = ?", [req.userId]);
  let deleted = 0;
  stocks.forEach(s => {
    const hasTx = queryOne("SELECT id FROM stock_transactions WHERE stock_id = ? AND user_id = ? LIMIT 1", [s.id, req.userId]);
    const hasDiv = queryOne("SELECT id FROM stock_dividends WHERE stock_id = ? AND user_id = ? LIMIT 1", [s.id, req.userId]);
    if (!hasTx && !hasDiv) {
      db.run("DELETE FROM stocks WHERE id = ? AND user_id = ?", [s.id, req.userId]);
      deleted++;
    }
  });
  if (deleted > 0) saveDB();
  res.json({ deleted });
});

// ─── 實現損益紀錄 ───
app.get('/api/stock-realized', (req, res) => {
  const { stockId } = req.query;
  let stocks = queryAll("SELECT * FROM stocks WHERE user_id = ?", [req.userId]);
  if (stockId) stocks = stocks.filter(s => s.id === stockId);

  const realized = [];
  stocks.forEach(s => {
    const txs = queryAll(
      "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at",
      [s.id, req.userId]
    );
    let lots = []; // { shares, price, fee }
    txs.forEach(t => {
      if (t.type === 'buy') {
        lots.push({ shares: t.shares, price: t.price, fee: t.fee || 0 });
      } else {
        // FIFO 計算本次賣出的成本
        let remaining = t.shares;
        let totalCost = 0;
        const lotsSnapshot = lots.map(l => ({ ...l }));
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const used = Math.min(remaining, lot.shares);
          // 按比例分攤手續費到成本
          totalCost += used * lot.price + (lot.fee * used / lot.shares);
          lot.shares -= used;
          lot.fee = lot.fee * (lot.shares / (lot.shares + used)); // 剩餘批次的費用
          remaining -= used;
          if (lot.shares <= 0) lots.shift();
        }
        const sellRevenue = t.shares * t.price - (t.fee || 0) - (t.tax || 0);
        const realizedPL = sellRevenue - totalCost;
        const costPerShare = t.shares > 0 ? totalCost / t.shares : 0;
        const returnRate = totalCost > 0 ? (realizedPL / totalCost * 100) : 0;
        realized.push({
          id: t.id,
          date: t.date,
          stockId: s.id,
          symbol: s.symbol,
          name: s.name,
          shares: t.shares,
          sellPrice: t.price,
          fee: t.fee || 0,
          tax: t.tax || 0,
          sellRevenue: Math.round(sellRevenue),
          costPerShare: Math.round(costPerShare * 100) / 100,
          totalCost: Math.round(totalCost),
          realizedPL: Math.round(realizedPL),
          returnRate: Math.round(returnRate * 100) / 100,
        });
      }
    });
  });

  // 依日期由新到舊排序
  realized.sort((a, b) => b.date.localeCompare(a.date));
  res.json(realized);
});

// ─── 股票交易紀錄 匯入 ───
app.post('/api/stock-transactions/import', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '沒有資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });
  let imported = 0, skipped = 0;
  const errors = [];
  for (const row of rows) {
    try {
      const { date, symbol, name: stockName, type, shares, price, fee, tax, accountName, note } = row;
      if (!date || !symbol || !type || !shares || !price) { skipped++; errors.push(`略過不完整資料（${symbol || '?'}）`); continue; }
      const shareNum = parseFloat(shares);
      if (!(shareNum > 0) || !Number.isInteger(shareNum)) { skipped++; errors.push(`股數必須為正整數（${symbol}）`); continue; }
      // 找或建立股票
      let stock = queryOne("SELECT * FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
      if (!stock) {
        const sid = uid();
        db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?, ?, ?, ?, ?, 'stock', ?)",
          [sid, req.userId, symbol, stockName || symbol, parseFloat(price) || 0, todayStr()]);
        stock = queryOne("SELECT * FROM stocks WHERE id = ?", [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        // 股票名稱不正確（等於代號），用 CSV 提供的名稱更新
        db.run("UPDATE stocks SET name = ? WHERE id = ?", [stockName, stock.id]);
      }
      // 找帳戶
      let accountId = null;
      if (accountName) {
        const acc = queryOne("SELECT id FROM accounts WHERE user_id = ? AND name = ?", [req.userId, accountName]);
        if (acc) accountId = acc.id;
      }
      const txType = (type === '買進' || type === 'buy') ? 'buy' : 'sell';
      db.run("INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), req.userId, stock.id, txType, normalizeDate(date), shareNum, parseFloat(price),
         parseFloat(fee || 0), parseFloat(tax || 0), accountId, note || '', Date.now()]);
      imported++;
    } catch (e) { skipped++; errors.push('錯誤：' + e.message); }
  }
  saveDB();
  res.json({ imported, skipped, errors });
});

// ─── 股票股利 匯入 ───
app.post('/api/stock-dividends/import', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '沒有資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });
  let imported = 0, skipped = 0;
  const errors = [];
  for (const row of rows) {
    try {
      const { date, symbol, name: stockName, cashDividend, stockDividend, note } = row;
      if (!date || !symbol) { skipped++; errors.push(`略過不完整資料（${symbol || '?'}）`); continue; }
      const cash = parseFloat(cashDividend || 0);
      const stock_d = parseFloat(stockDividend || 0);
      if (!cash && !stock_d) { skipped++; errors.push(`現金股利與股票股利至少填一項（${symbol} ${date}）`); continue; }
      // 找或建立股票
      let stock = queryOne("SELECT * FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
      if (!stock) {
        const sid = uid();
        db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?, ?, ?, ?, ?, 'stock', ?)",
          [sid, req.userId, symbol, stockName || symbol, 0, todayStr()]);
        stock = queryOne("SELECT * FROM stocks WHERE id = ?", [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        // 股票名稱不正確（等於代號），用 CSV 提供的名稱更新
        db.run("UPDATE stocks SET name = ? WHERE id = ?", [stockName, stock.id]);
      }
      db.run("INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), req.userId, stock.id, normalizeDate(date), cash, stock_d, note || '', Date.now()]);
      imported++;
    } catch (e) { skipped++; errors.push('錯誤：' + e.message); }
  }
  saveDB();
  res.json({ imported, skipped, errors });
});

// 股票交易紀錄
app.get('/api/stock-transactions', (req, res) => {
  const { stockId, page, pageSize, dateFrom, dateTo, sortBy, sortDir } = req.query;
  let whereSql = "WHERE st.user_id = ?";
  const params = [req.userId];
  if (stockId) { whereSql += " AND st.stock_id = ?"; params.push(stockId); }
  if (dateFrom) { whereSql += " AND st.date >= ?"; params.push(normalizeDate(dateFrom)); }
  if (dateTo) { whereSql += " AND st.date <= ?"; params.push(normalizeDate(dateTo)); }
  // 排序（白名單驗證避免 SQL injection）
  const validSortCols = { date: 'st.date', type: 'st.type', symbol: 's.symbol', shares: 'st.shares', price: 'st.price', fee: 'st.fee', tax: 'st.tax', subtotal: '(st.shares * st.price)' };
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortCol = validSortCols[sortBy] || 'st.date';
  const orderSql = ` ORDER BY ${sortCol} ${dir}, st.created_at DESC`;
  // 分頁
  if (page && pageSize) {
    const p = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(9999, parseInt(pageSize)));
    const countRow = queryOne(`SELECT COUNT(*) as cnt FROM stock_transactions st ${whereSql}`, params);
    const total = countRow ? countRow.cnt : 0;
    const totalPages = Math.ceil(total / ps);
    const dataSql = `SELECT st.*, s.symbol, s.name as stock_name FROM stock_transactions st LEFT JOIN stocks s ON st.stock_id = s.id ${whereSql}${orderSql} LIMIT ? OFFSET ?`;
    const data = queryAll(dataSql, [...params, ps, (p - 1) * ps]);
    res.json({ data, total, page: p, totalPages });
  } else {
    const sql = `SELECT st.*, s.symbol, s.name as stock_name FROM stock_transactions st LEFT JOIN stocks s ON st.stock_id = s.id ${whereSql}${orderSql}`;
    res.json(queryAll(sql, params));
  }
});

app.post('/api/stock-transactions', (req, res) => {
  const { stockId, date: rawDate, type, shares, price, fee, tax, accountId, note } = req.body;
  const date = normalizeDate(rawDate);
  if (!stockId || !date || !type || !shares || !price) return res.status(400).json({ error: '必填欄位未填' });
  if (!['buy', 'sell'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (!(Number(shares) > 0)) return res.status(400).json({ error: '股數必須為正數' });
  if (!Number.isInteger(Number(shares))) return res.status(400).json({ error: '股數必須為整數' });
  if (!(Number(price) > 0)) return res.status(400).json({ error: '價格必須為正數' });
  if (Number(fee) < 0 || Number(tax) < 0) return res.status(400).json({ error: '手續費/稅費不可為負' });
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const id = uid();
  db.run("INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', Date.now()]);
  saveDB();
  res.json({ id });
});

app.put('/api/stock-transactions/:id', (req, res) => {
  const { date: rawDate, type, shares, price, fee, tax, accountId, note } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (!['buy', 'sell'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (!(Number(shares) > 0)) return res.status(400).json({ error: '股數必須為正數' });
  if (!Number.isInteger(Number(shares))) return res.status(400).json({ error: '股數必須為整數' });
  if (!(Number(price) > 0)) return res.status(400).json({ error: '價格必須為正數' });
  if (Number(fee) < 0 || Number(tax) < 0) return res.status(400).json({ error: '手續費/稅費不可為負' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const t = queryOne("SELECT * FROM stock_transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!t) return res.status(404).json({ error: '交易紀錄不存在' });
  db.run("UPDATE stock_transactions SET date=?, type=?, shares=?, price=?, fee=?, tax=?, account_id=?, note=? WHERE id=? AND user_id=?",
    [date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/stock-transactions/:id', (req, res) => {
  db.run("DELETE FROM stock_transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 股票交易批次刪除
app.post('/api/stock-transactions/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '請選擇要刪除的紀錄' });
  let deleted = 0;
  ids.forEach(id => {
    const r = db.run("DELETE FROM stock_transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
    deleted += db.getRowsModified();
  });
  saveDB();
  res.json({ deleted });
});

// 股利紀錄
app.get('/api/stock-dividends', (req, res) => {
  const { stockId, page, pageSize, dateFrom, dateTo, sortBy, sortDir } = req.query;
  let whereSql = "WHERE sd.user_id = ?";
  const params = [req.userId];
  if (stockId) { whereSql += " AND sd.stock_id = ?"; params.push(stockId); }
  if (dateFrom) { whereSql += " AND sd.date >= ?"; params.push(normalizeDate(dateFrom)); }
  if (dateTo) { whereSql += " AND sd.date <= ?"; params.push(normalizeDate(dateTo)); }
  // 排序（白名單驗證）
  const validSortCols = { date: 'sd.date', symbol: 's.symbol', cash_dividend: 'sd.cash_dividend' };
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortCol = validSortCols[sortBy] || 'sd.date';
  const orderSql = ` ORDER BY ${sortCol} ${dir}`;
  // 分頁
  if (page && pageSize) {
    const p = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(9999, parseInt(pageSize)));
    const countRow = queryOne(`SELECT COUNT(*) as cnt FROM stock_dividends sd ${whereSql}`, params);
    const total = countRow ? countRow.cnt : 0;
    const totalPages = Math.ceil(total / ps);
    const dataSql = `SELECT sd.*, s.symbol, s.name as stock_name FROM stock_dividends sd LEFT JOIN stocks s ON sd.stock_id = s.id ${whereSql}${orderSql} LIMIT ? OFFSET ?`;
    const data = queryAll(dataSql, [...params, ps, (p - 1) * ps]);
    res.json({ data, total, page: p, totalPages });
  } else {
    const sql = `SELECT sd.*, s.symbol, s.name as stock_name FROM stock_dividends sd LEFT JOIN stocks s ON sd.stock_id = s.id ${whereSql}${orderSql}`;
    res.json(queryAll(sql, params));
  }
});

app.post('/api/stock-dividends', (req, res) => {
  const { stockId, date: rawDate, cashDividend, stockDividendShares, accountId, note } = req.body;
  const date = normalizeDate(rawDate);
  if (!stockId || !date) return res.status(400).json({ error: '必填欄位未填' });
  if (Number(cashDividend) < 0 || Number(stockDividendShares) < 0) return res.status(400).json({ error: '股利不可為負' });
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const id = uid();
  db.run("INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, cashDividend || 0, stockDividendShares || 0, accountId || '', note || '', Date.now()]);
  saveDB();
  res.json({ id });
});

app.put('/api/stock-dividends/:id', (req, res) => {
  const { date: rawDate, cashDividend, stockDividendShares, accountId, note } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (Number(cashDividend) < 0 || Number(stockDividendShares) < 0) return res.status(400).json({ error: '股利不可為負' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const d = queryOne("SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!d) return res.status(404).json({ error: '股利紀錄不存在' });
  db.run("UPDATE stock_dividends SET date=?, cash_dividend=?, stock_dividend_shares=?, account_id=?, note=? WHERE id=? AND user_id=?",
    [date, cashDividend || 0, stockDividendShares || 0, accountId || '', note || '', req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/stock-dividends/:id', (req, res) => {
  db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 股利批次刪除
app.post('/api/stock-dividends/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '請選擇要刪除的紀錄' });
  let deleted = 0;
  ids.forEach(id => {
    db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [id, req.userId]);
    deleted += db.getRowsModified();
  });
  saveDB();
  res.json({ deleted });
});

// ─── 資料庫匯出匯入（僅管理員） ───
app.get('/api/database/export', (req, res) => {
  if (!isUserAdmin(req.userId)) return res.status(403).json({ error: '僅管理員可執行此操作' });
  try {
    const data = db.export();
    const plain = Buffer.from(data);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="asset_backup_${ts}.db"`);
    res.send(plain);
  } catch (e) {
    console.error('資料庫匯出失敗:', e);
    res.status(500).json({ error: '資料庫匯出失敗' });
  }
});

app.post('/api/database/import', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  if (!isUserAdmin(req.userId)) return res.status(403).json({ error: '僅管理員可執行此操作' });
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: '無效的資料庫檔案' });
    }
    let dbBuffer = req.body;
    if (dbBuffer.length < 16) {
      return res.status(400).json({ error: '無效的資料庫檔案' });
    }
    // 若上傳的是加密檔案，拒絕匯入
    if (isEncryptedDB(dbBuffer)) {
      return res.status(400).json({ error: '請上傳未加密的資料庫檔案（.db）' });
    }
    // 驗證是否為有效的 SQLite 檔案（magic header: "SQLite format 3\000"）
    const sqliteMagic = dbBuffer.subarray(0, 16).toString('ascii');
    if (!sqliteMagic.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: '檔案不是有效的 SQLite 資料庫' });
    }
    // 嘗試載入以驗證完整性
    const testDb = new SQL.Database(new Uint8Array(dbBuffer));
    // 驗證基本資料表結構
    const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.map(r => r[0]) : [];
    const requiredTables = ['users', 'transactions', 'accounts', 'categories'];
    const missing = requiredTables.filter(t => !tableNames.includes(t));
    if (missing.length > 0) {
      testDb.close();
      return res.status(400).json({ error: `資料庫缺少必要資料表：${missing.join(', ')}` });
    }
    testDb.close();
    // 備份目前資料庫
    const backupTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = DB_PATH + `.backup_${backupTs}`;
    try {
      const currentData = db.export();
      const currentPlain = Buffer.from(currentData);
      fs.writeFileSync(backupPath, currentPlain);
    } catch (e) {
      console.error('備份目前資料庫失敗:', e);
    }
    // 替換資料庫
    db.close();
    db = new SQL.Database(new Uint8Array(dbBuffer));
    saveDB();
    // 重新初始化（確保升級邏輯執行）
    initDB();
    res.json({ ok: true, message: '資料庫匯入成功，已自動備份原始資料庫' });
  } catch (e) {
    console.error('資料庫匯入失敗:', e);
    res.status(500).json({ error: '資料庫匯入失敗：' + (e.message || '未知錯誤') });
  }
});

// API 路由未命中時統一回傳 JSON，避免前端拿到 HTML 導致解析錯誤。
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API 路由不存在' });
});

// API 例外統一回傳 JSON，避免 Express 預設 HTML 錯誤頁造成前端顯示「回應格式異常」。
app.use((err, req, res, next) => {
  if (!req.path.startsWith('/api')) return next(err);
  console.error('API 錯誤:', err?.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '伺服器發生錯誤，請稍後再試' });
});

// ─── 公開頁面路由（FR-007 靜態頁桶）───
app.get('/privacy', staticPageLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});
app.get('/terms', staticPageLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.html'));
});

// ─── 前端路由 catch-all（所有非 API、非靜態檔案的請求都回傳 index.html）───
app.get('{*path}', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
  validate: { xForwardedForHeader: false }
}), (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── 啟動 ───
initDB().then(() => {
  loadServerTimeOffset();
  registerAuditPruneJob();
  app.listen(PORT, () => {
    console.log(`AssetPilot 伺服器已啟動: http://localhost:${PORT}`);
    console.log(`[OAuth] redirect_uri whitelist: ${GOOGLE_OAUTH_REDIRECT_URIS.length} entries`);
  });
});
