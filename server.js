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
// 006-stock-investments：TWSE 並發查價 helper
const twseFetch = require('./lib/twseFetch');
const Decimal = require('decimal.js');
// ─── 007 feature: 資料匯出匯入共用模組（T015） ───
const { ISO_4217_CODES, isValidCurrency } = require('./lib/iso4217');
const externalApisData = require('./lib/external-apis.json');

// ─── 007 feature: 匯入互斥鎖 + 進度回饋 + backups 路徑（T007） ───
const importLocks = new Set();
const importProgress = new Map();
const BACKUPS_DIR = path.join(__dirname, 'backups');

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
// ─── 寄信通道設定（全部走環境變數）───
// EMAIL_PROVIDER_PRIMARY / EMAIL_PROVIDER_FALLBACK：smtp | zeabur | resend | (空)
// 兩者皆空 → 寄信功能停用；fallback 僅在 primary 執行期失敗時觸發（不重試、不補寄）。
const EMAIL_PROVIDERS = ['smtp', 'zeabur', 'resend'];
function normalizeProvider(v) {
  const s = String(v || '').trim().toLowerCase();
  return EMAIL_PROVIDERS.includes(s) ? s : '';
}
const EMAIL_PROVIDER_PRIMARY = normalizeProvider(process.env.EMAIL_PROVIDER_PRIMARY);
const EMAIL_PROVIDER_FALLBACK = normalizeProvider(process.env.EMAIL_PROVIDER_FALLBACK);

// SMTP 設定（環境變數）
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_SECURE = /^(1|true|yes)$/i.test(String(process.env.SMTP_SECURE || ''));
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || '';

// Zeabur Email（ZSend）設定
const ZEABUR_API_KEY = process.env.ZEABUR_API_KEY || '';
const ZEABUR_FROM_EMAIL = process.env.ZEABUR_FROM_EMAIL || '';
const ZEABUR_API_ENDPOINT = 'https://api.zeabur.com/api/v1/zsend/emails';

// Resend 設定
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

// 全通道共用寄件人顯示名稱；若各通道 FROM 已是 `Name <email>` 格式則不覆寫，尊重 per-provider 設定
const EMAIL_SENDER_NAME = (process.env.EMAIL_SENDER_NAME || '').trim();

function formatFromAddress(raw) {
  if (!raw) return raw;
  if (!EMAIL_SENDER_NAME) return raw;
  if (raw.includes('<')) return raw; // 已含顯示名稱，不覆寫
  const escaped = EMAIL_SENDER_NAME.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}" <${raw}>`;
}

// 對外網址（用於信件 CTA 按鈕），未設定則隱藏「前往儀表板」按鈕
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

let smtpTransporter = null;
function getSmtpTransporter() {
  if (!SMTP_HOST) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }
  return smtpTransporter;
}

let resendClient = null;
function getResendClient() {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

function isProviderConfigured(name) {
  if (name === 'smtp') return !!SMTP_HOST;
  if (name === 'zeabur') return !!(ZEABUR_API_KEY && ZEABUR_FROM_EMAIL);
  if (name === 'resend') return !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
  return false;
}

async function sendViaProvider(name, { to, subject, html }) {
  if (name === 'smtp') {
    const transporter = getSmtpTransporter();
    const from = formatFromAddress(SMTP_FROM || SMTP_USER || 'noreply@localhost');
    const info = await transporter.sendMail({ from, to, subject, html });
    return { provider: 'smtp', id: info.messageId };
  }
  if (name === 'zeabur') {
    const resp = await fetch(ZEABUR_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZEABUR_API_KEY}`,
      },
      body: JSON.stringify({
        from: formatFromAddress(ZEABUR_FROM_EMAIL),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = new Error(data?.message || data?.error || `Zeabur 寄送失敗 (HTTP ${resp.status})`);
      err.provider = 'zeabur';
      throw err;
    }
    return { provider: 'zeabur', id: data?.id || data?.message_id || '' };
  }
  if (name === 'resend') {
    const result = await getResendClient().emails.send({ from: formatFromAddress(RESEND_FROM_EMAIL), to, subject, html });
    if (result?.error) {
      const err = new Error(result.error.message || 'Resend 寄送失敗');
      err.provider = 'resend';
      throw err;
    }
    return { provider: 'resend', id: result?.data?.id || '' };
  }
  throw new Error(`未知寄信通道：${name}`);
}

// 統一寄信入口：依 EMAIL_PROVIDER_PRIMARY → EMAIL_PROVIDER_FALLBACK 順序嘗試。
// primary 執行期失敗時若 fallback 已設定則自動退回；皆未設定回 null（caller 須翻譯為 503）。
async function sendStatsEmail({ to, subject, html }) {
  const primary = isProviderConfigured(EMAIL_PROVIDER_PRIMARY) ? EMAIL_PROVIDER_PRIMARY : '';
  const fallback = (EMAIL_PROVIDER_FALLBACK && EMAIL_PROVIDER_FALLBACK !== primary && isProviderConfigured(EMAIL_PROVIDER_FALLBACK))
    ? EMAIL_PROVIDER_FALLBACK : '';
  if (!primary && !fallback) return null;

  if (primary) {
    try {
      return await sendViaProvider(primary, { to, subject, html });
    } catch (err) {
      if (!fallback) throw err;
    }
  }
  return await sendViaProvider(fallback, { to, subject, html });
}

function getActiveEmailProviders() {
  const primary = isProviderConfigured(EMAIL_PROVIDER_PRIMARY) ? EMAIL_PROVIDER_PRIMARY : '';
  const fallback = (EMAIL_PROVIDER_FALLBACK && EMAIL_PROVIDER_FALLBACK !== primary && isProviderConfigured(EMAIL_PROVIDER_FALLBACK))
    ? EMAIL_PROVIDER_FALLBACK : '';
  return { primary, fallback, hasAny: !!(primary || fallback) };
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
// 008 feature (T063 / FR-026)：擴充至 9 條合法白名單；Cache-Control 由 handler 套用
const PUBLIC_FILES = [
  '/app.js', '/style.css', '/logo.svg', '/favicon.svg',
  '/vendor/webauthn.min.js', '/lib/moneyDecimal.js',
  '/changelog.json', '/privacy.html', '/terms.html',
];
const PUBLIC_FILE_MAP = Object.freeze({
  '/app.js': path.join(__dirname, 'app.js'),
  '/style.css': path.join(__dirname, 'style.css'),
  '/logo.svg': path.join(__dirname, 'logo.svg'),
  '/favicon.svg': path.join(__dirname, 'favicon.svg'),
  '/vendor/webauthn.min.js': path.join(__dirname, 'node_modules', '@passwordless-id', 'webauthn', 'dist', 'browser', 'webauthn.min.js'),
  '/lib/moneyDecimal.js': path.join(__dirname, 'lib', 'moneyDecimal.js'),
  '/changelog.json': path.join(__dirname, 'changelog.json'),
  '/privacy.html': path.join(__dirname, 'privacy.html'),
  '/terms.html': path.join(__dirname, 'terms.html'),
});
app.get(PUBLIC_FILES, (req, res) => {
  const safePath = PUBLIC_FILE_MAP[req.path];
  if (!safePath) return res.status(404).end();
  // 008 feature (T064 / FR-028)：依檔名套用 Cache-Control
  if (req.path === '/changelog.json') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
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

  // 003-categories T002：於任何 schema 變更前備份既有 DB（僅當 DB 檔案已存在）
  if (fs.existsSync(DB_PATH)) {
    const backup003 = `${DB_PATH}.bak.${Date.now()}.before-003`;
    try {
      fs.copyFileSync(DB_PATH, backup003);
      console.log('[003-backup] before-003 →', backup003);
    } catch (e) {
      console.error('[003-backup] FAILED:', e.message);
      throw e;
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

  // ─── 007 feature: 資料操作稽核日誌（FR-042 ~ FR-046b） ───
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

  // 資料庫升級：為 system_settings 加入管理員 IP 白名單欄位
  // 必須在 INSERT 使用欄位前執行，避免舊版資料庫啟動失敗
  try {
    db.run("ALTER TABLE system_settings ADD COLUMN admin_ip_allowlist TEXT DEFAULT ''");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }
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
  // 007 feature: 稽核日誌保留天數（FR-046a；'30' / '90' / '180' / '365' / 'forever'，預設 '90'）
  try { db.run("ALTER TABLE system_settings ADD COLUMN audit_log_retention_days TEXT DEFAULT '90'"); } catch (e) { /* ignore */ }
  // 008 feature (T004 / FR-033)：路由稽核模式（'security' / 'extended' / 'minimal'，預設 'security'）
  try { db.run("ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'"); } catch (e) { /* ignore */ }

  // 005 T060: 多筆排程並存表（Round 2 Q2）
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
  try { db.run("CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id)"); } catch (e) { /* ignore */ }
  try { db.run("CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq ON report_schedules(enabled, freq)"); } catch (e) { /* ignore */ }

  // 005 T061: 一次性 migration — 把 system_settings.report_schedule_* singleton 轉為多筆 row
  try {
    const existCount = queryOne("SELECT COUNT(*) as n FROM report_schedules")?.n || 0;
    if (existCount === 0) {
      const ss = queryOne("SELECT report_schedule_freq, report_schedule_hour, report_schedule_weekday, report_schedule_day_of_month, report_schedule_last_run, report_schedule_last_summary, report_schedule_user_ids FROM system_settings WHERE id = 1");
      const oldFreq = ss?.report_schedule_freq;
      let userIds = [];
      try { const parsed = JSON.parse(ss?.report_schedule_user_ids || '[]'); if (Array.isArray(parsed)) userIds = parsed.map(String).filter(Boolean); } catch (e) { /* ignore */ }
      if (oldFreq && oldFreq !== 'off' && userIds.length > 0) {
        const nowMs = Date.now();
        for (const uid_ of userIds) {
          const row = queryOne("SELECT id FROM users WHERE id = ?", [uid_]);
          if (!row) continue;
          db.run(
            "INSERT INTO report_schedules (id, user_id, freq, hour, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
            [
              `rs_${nowMs}_${uid_}`,
              uid_,
              oldFreq,
              Number(ss?.report_schedule_hour) || 9,
              Number(ss?.report_schedule_weekday) || 1,
              Number(ss?.report_schedule_day_of_month) || 1,
              Number(ss?.report_schedule_last_run) || 0,
              ss?.report_schedule_last_summary || '',
              nowMs,
              nowMs,
            ]
          );
        }
        console.log(`[migration 005] 已將 singleton 排程遷移為 ${userIds.length} 筆 report_schedules`);
      }
    }
  } catch (e) { console.error('[migration 005] report_schedules 遷移失敗:', e.message); }

  db.run("INSERT OR IGNORE INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '')", [Date.now()]);

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

  // 003-categories T003：移除 categories.is_hidden 欄位（rebuild 模式，sql.js 不支援 DROP COLUMN）
  migrateTo003_dropIsHidden();

  // 003-categories T004：DeletedDefaultRegistry — 記錄使用者主動刪除過的預設分類，避免登入時自動補回
  db.run(`CREATE TABLE IF NOT EXISTS deleted_defaults (
    user_id TEXT NOT NULL,
    default_key TEXT NOT NULL,
    deleted_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, default_key)
  )`);

  // 003-categories T005：分類管理頁讀取／拖曳排序加速
  db.run("CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cat_user_type ON categories(user_id, type)");

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

  // 資料庫升級：為 users 加入 is_active 欄位（FR-024：排程寄送統計報表時，
  // 若使用者帳號已停用 (is_active = 0) 則略過寄送）
  try {
    db.run("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
    db.run("UPDATE users SET is_active = 1 WHERE is_active IS NULL");
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

  // ─── 004 feature: schema migration（T010~T016） ───
  // 對應 specs/004-budgets-recurring/data-model.md §3。
  // 執行於 migrate002 之後（因依賴 transactions 已 rebuild 為 INTEGER）。
  migrateTo004_budgetsRecurring();

  // 003-categories T011：為既有使用者補建完整預設樹（含支出「其他」與全部收入分類；冪等）
  backfillDefaultsForAllUsers();

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

  // 資料庫升級（006-stock-investments）：為 stocks 加入 delisted 旗標（FR-035a / Pass 1 Q2）
  try {
    db.run("ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0");
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

  // 資料庫升級（006-stock-investments）：定期定額 idempotency 與類型修改重算用欄位
  try {
    db.run("ALTER TABLE stock_transactions ADD COLUMN recurring_plan_id TEXT");
  } catch (e) { /* 欄位已存在則忽略 */ }
  try {
    db.run("ALTER TABLE stock_transactions ADD COLUMN period_start_date TEXT");
  } catch (e) { /* 欄位已存在則忽略 */ }
  try {
    db.run("ALTER TABLE stock_transactions ADD COLUMN tax_auto_calculated INTEGER DEFAULT 1");
  } catch (e) { /* 欄位已存在則忽略 */ }
  // partial unique index：同 (user_id, recurring_plan_id, period_start_date) 三元組僅允許一筆排程交易
  try {
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_tx_recurring_idem ON stock_transactions (user_id, recurring_plan_id, period_start_date) WHERE recurring_plan_id IS NOT NULL AND period_start_date IS NOT NULL");
  } catch (e) { /* 索引已存在或 sqlite 版本不支援 partial index 時忽略 */ }

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

  // ─── 006 feature: schema 驗證（T013） ───
  try {
    const delistedNullCount = queryOne("SELECT COUNT(*) AS c FROM stocks WHERE delisted IS NULL");
    if (delistedNullCount && delistedNullCount.c > 0) {
      console.warn(`[migration 006] stocks.delisted IS NULL row count = ${delistedNullCount.c}（預期 0）`);
    }
    const idxRow = queryOne("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_stock_tx_recurring_idem'");
    if (!idxRow) {
      console.warn('[migration 006] partial unique index idx_stock_tx_recurring_idem 未建立成功');
    } else {
      console.log('[migration 006] idx_stock_tx_recurring_idem OK');
    }
    const taxNullCount = queryOne("SELECT COUNT(*) AS c FROM stock_transactions WHERE tax_auto_calculated IS NULL");
    if (taxNullCount && taxNullCount.c > 0) {
      console.warn(`[migration 006] stock_transactions.tax_auto_calculated IS NULL row count = ${taxNullCount.c}（預期 0）`);
    }
  } catch (e) {
    console.warn('[migration 006] schema 驗證失敗:', e.message);
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

// 003-categories T003：偵測並移除 categories.is_hidden 欄位（rebuild 模式）
function migrateTo003_dropIsHidden() {
  let cols;
  try { cols = queryAll("PRAGMA table_info(categories)"); } catch (e) { return; }
  if (!cols || !cols.some(c => c.name === 'is_hidden')) return; // 冪等：已無 is_hidden 直接 return

  try {
    db.run('BEGIN');
    db.run(`CREATE TABLE categories_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      color TEXT DEFAULT '#6366f1',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      parent_id TEXT DEFAULT ''
    )`);
    db.run(`INSERT INTO categories_new (id, user_id, name, type, color, is_default, sort_order, parent_id)
            SELECT id, user_id, name, type, color, is_default, sort_order, parent_id FROM categories`);
    db.run('DROP TABLE categories');
    db.run('ALTER TABLE categories_new RENAME TO categories');
    db.run('COMMIT');
    console.log('[003-migration] dropped categories.is_hidden');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch {}
    console.error('[003-migration] dropIsHidden FAILED:', err);
    throw err;
  }
}

// 004-budgets-recurring T010~T016：schema migration
//   T010: transactions ALTER ADD source_recurring_id / scheduled_date
//   T011: 兩條 index（partial unique + 普通）
//   T012: budgets REAL → INTEGER 重建（含 created_at / updated_at）
//   T013: budgets 三條唯一性 index
//   T014: recurring REAL → INTEGER/TEXT 重建（含 needs_attention / updated_at）
//   T015: recurring 兩條 index
//   T016: self-test
function migrateTo004_budgetsRecurring() {
  // T010：transactions ALTER（冪等）
  try { db.run("ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
  try { db.run("ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }

  // T011：transactions 索引
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_source_scheduled
    ON transactions(source_recurring_id, scheduled_date)
    WHERE source_recurring_id IS NOT NULL`);
  db.run("CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(source_recurring_id)");

  // T012：budgets REAL → INTEGER 重建（偵測 typeof(amount) = 'real' 才觸發；冪等）
  let budgetAmountInfo;
  try { budgetAmountInfo = queryOne("SELECT typeof(amount) AS t FROM budgets LIMIT 1"); } catch (e) { budgetAmountInfo = null; }
  const needsBudgetRebuild = budgetAmountInfo && String(budgetAmountInfo.t).toLowerCase() === 'real';
  if (needsBudgetRebuild) {
    console.log('[migration 004] 重建 budgets 表（REAL → INTEGER）');
    try {
      const fs = require('fs');
      fs.copyFileSync('database.db', `database.db.bak.${Date.now()}.before-004`);
    } catch (e) { console.warn('[migration 004] 備份失敗（非致命）:', e?.message || e); }

    try {
      db.run('BEGIN');
      db.run(`CREATE TABLE budgets_new (
        id          TEXT    PRIMARY KEY,
        user_id     TEXT    NOT NULL,
        category_id TEXT,
        amount      INTEGER NOT NULL,
        year_month  TEXT    NOT NULL,
        created_at  INTEGER NOT NULL DEFAULT 0,
        updated_at  INTEGER NOT NULL DEFAULT 0
      )`);
      db.run(`INSERT INTO budgets_new (id, user_id, category_id, amount, year_month, created_at, updated_at)
              SELECT id, user_id, category_id,
                     CAST(ROUND(COALESCE(amount, 0)) AS INTEGER),
                     year_month,
                     ?, ?
              FROM budgets`, [Date.now(), Date.now()]);
      db.run("DROP TABLE budgets");
      db.run("ALTER TABLE budgets_new RENAME TO budgets");
      db.run('COMMIT');
    } catch (err) {
      try { db.run('ROLLBACK'); } catch {}
      console.error('[migration 004] budgets rebuild FAILED:', err);
      throw err;
    }
  }

  // T013：budgets 唯一性索引（rebuild 後重建；既有 budgets 也補建）
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_cat
    ON budgets(user_id, year_month, category_id) WHERE category_id IS NOT NULL`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_total
    ON budgets(user_id, year_month) WHERE category_id IS NULL`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, year_month)`);

  // T014：recurring REAL → INTEGER/TEXT 重建 + 補欄位（含 needs_attention / updated_at）
  let recAmountInfo, recFxInfo, recNeedsAttn;
  try { recAmountInfo = queryOne("SELECT typeof(amount) AS t FROM recurring LIMIT 1"); } catch (e) { recAmountInfo = null; }
  try { recFxInfo = queryOne("SELECT typeof(fx_rate) AS t FROM recurring LIMIT 1"); } catch (e) { recFxInfo = null; }
  try {
    const cols = queryAll("PRAGMA table_info(recurring)");
    recNeedsAttn = cols && cols.some(c => c.name === 'needs_attention');
  } catch (e) { recNeedsAttn = false; }
  const needsRecRebuild =
    (recAmountInfo && String(recAmountInfo.t).toLowerCase() === 'real') ||
    (recFxInfo && String(recFxInfo.t).toLowerCase() === 'real') ||
    !recNeedsAttn;
  if (needsRecRebuild) {
    console.log('[migration 004] 重建 recurring 表（REAL → INTEGER/TEXT + 補欄位）');
    try {
      const fs = require('fs');
      fs.copyFileSync('database.db', `database.db.bak.${Date.now()}.before-004-rec`);
    } catch (e) { console.warn('[migration 004] 備份失敗（非致命）:', e?.message || e); }

    try {
      db.run('BEGIN');
      db.run(`CREATE TABLE recurring_new (
        id               TEXT    PRIMARY KEY,
        user_id          TEXT    NOT NULL,
        type             TEXT    NOT NULL,
        amount           INTEGER NOT NULL,
        category_id      TEXT,
        account_id       TEXT,
        frequency        TEXT    NOT NULL,
        start_date       TEXT    NOT NULL,
        note             TEXT    NOT NULL DEFAULT '',
        is_active        INTEGER NOT NULL DEFAULT 1,
        last_generated   TEXT,
        currency         TEXT    NOT NULL DEFAULT 'TWD',
        fx_rate          TEXT    NOT NULL DEFAULT '1',
        needs_attention  INTEGER NOT NULL DEFAULT 0,
        updated_at       INTEGER NOT NULL DEFAULT 0
      )`);
      db.run(`INSERT INTO recurring_new
              (id, user_id, type, amount, category_id, account_id, frequency, start_date, note,
               is_active, last_generated, currency, fx_rate, needs_attention, updated_at)
              SELECT id, user_id, type,
                     CAST(ROUND(COALESCE(amount, 0)) AS INTEGER),
                     category_id, account_id, frequency, start_date, COALESCE(note, ''),
                     COALESCE(is_active, 1), last_generated,
                     COALESCE(currency, 'TWD'),
                     CAST(COALESCE(fx_rate, 1) AS TEXT),
                     0,
                     ?
              FROM recurring`, [Date.now()]);
      db.run("DROP TABLE recurring");
      db.run("ALTER TABLE recurring_new RENAME TO recurring");
      db.run('COMMIT');
    } catch (err) {
      try { db.run('ROLLBACK'); } catch {}
      console.error('[migration 004] recurring rebuild FAILED:', err);
      throw err;
    }
  }

  // T015：recurring 索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring(user_id, is_active)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_recurring_user_attn ON recurring(user_id, needs_attention)`);

  // T016：self-test（不通過僅 console.warn，不 throw）
  const badBudgetAmt = queryOne("SELECT COUNT(*) AS c FROM budgets WHERE typeof(amount) != 'integer' OR amount <= 0")?.c || 0;
  if (badBudgetAmt > 0) console.warn(`[migration 004] self-test fail: ${badBudgetAmt} 筆 budgets.amount 非正整數`);
  const badRecAmt = queryOne("SELECT COUNT(*) AS c FROM recurring WHERE typeof(amount) != 'integer' OR amount <= 0")?.c || 0;
  if (badRecAmt > 0) console.warn(`[migration 004] self-test fail: ${badRecAmt} 筆 recurring.amount 非正整數`);
  const badFxRate = queryOne("SELECT COUNT(*) AS c FROM recurring WHERE typeof(fx_rate) != 'text'")?.c || 0;
  if (badFxRate > 0) console.warn(`[migration 004] self-test fail: ${badFxRate} 筆 recurring.fx_rate 非 text`);

  console.log('[migration 004] 完成');
}

// 003-categories T011：取代既有 migrateDefaultSubcategories — 為所有既有使用者冪等補建預設樹缺漏項
function backfillDefaultsForAllUsers() {
  const users = queryAll("SELECT DISTINCT user_id FROM categories");
  users.forEach(({ user_id }) => {
    try { backfillDefaultsForUser(user_id); }
    catch (e) { console.error('[003-backfill] user=', user_id, e); }
  });
}

// 003-categories T007：預設樹常數（FR-008 修訂版；13 父 + 56 子 = 69 筆）
// 「其他」鍵在支出與收入皆出現，故子分類以巢狀 { expense, income } 結構避鍵衝突
const DEFAULT_EXPENSE_PARENTS = [
  ['餐飲', '#ef4444'], ['交通', '#f97316'], ['購物', '#eab308'],
  ['娛樂', '#8b5cf6'], ['居住', '#06b6d4'], ['醫療', '#ec4899'],
  ['教育', '#3b82f6'], ['其他', '#64748b'],
];
const DEFAULT_INCOME_PARENTS = [
  ['薪資', '#10b981'], ['獎金', '#14b8a6'], ['投資', '#6366f1'],
  ['兼職', '#f59e0b'], ['其他', '#71717a'],
];
const DEFAULT_SUBCATEGORIES = {
  expense: {
    '餐飲': [['早餐','#fca5a5'], ['午餐','#f87171'], ['晚餐','#dc2626'], ['飲料','#fb923c'], ['點心','#fdba74']],
    '交通': [['大眾運輸','#fdba74'], ['計程車','#fb923c'], ['加油','#f97316'], ['停車費','#ea580c'], ['高鐵/火車','#c2410c']],
    '購物': [['日用品','#fde047'], ['服飾','#facc15'], ['3C用品','#eab308'], ['家電','#ca8a04'], ['美妝保養','#a16207']],
    '娛樂': [['電影/影音','#a78bfa'], ['遊戲','#8b5cf6'], ['旅遊','#7c3aed'], ['運動健身','#6d28d9'], ['訂閱服務','#5b21b6']],
    '居住': [['房租/房貸','#22d3ee'], ['水電費','#06b6d4'], ['瓦斯費','#0891b2'], ['網路費','#0e7490'], ['管理費','#155e75']],
    '醫療': [['掛號費','#f9a8d4'], ['藥品','#f472b6'], ['保健食品','#ec4899'], ['牙科','#db2777'], ['健檢','#be185d']],
    '教育': [['學費','#93c5fd'], ['書籍','#60a5fa'], ['線上課程','#3b82f6'], ['補習費','#2563eb']],
    '其他': [['雜支','#94a3b8'], ['禮金/紅包','#64748b'], ['捐款','#475569'], ['罰款','#334155']],
  },
  income: {
    '薪資': [['月薪','#34d399'], ['加班費','#10b981']],
    '獎金': [['年終獎金','#5eead4'], ['績效獎金','#2dd4bf'], ['節日禮金','#14b8a6']],
    '投資': [['股利','#a5b4fc'], ['利息','#818cf8'], ['資本利得','#6366f1']],
    '兼職': [['接案','#fbbf24'], ['家教','#f59e0b'], ['打工','#d97706']],
    '其他': [['退稅','#a1a1aa'], ['贈與/紅包','#71717a'], ['雜項','#52525b']],
  },
};

// 003-categories T008：穩定識別字串
//   父分類：`<type>:<name>`；子分類：`<type>:<parentName>:<name>`
function categoryDefaultKey(type, parentName, name) {
  if (parentName === null || parentName === undefined || parentName === '') {
    return `${type}:${name}`;
  }
  return `${type}:${parentName}:${name}`;
}

// 003-categories T010：冪等補建單一使用者預設樹
//   1. 跳過 deleted_defaults 中已記錄的項
//   2. 跳過 (user_id, type, name) / (user_id, parent_id, name) 既有項
//   3. 僅 INSERT 真正缺漏的；單一交易內完成
function backfillDefaultsForUser(userId) {
  const deletedRows = queryAll("SELECT default_key FROM deleted_defaults WHERE user_id = ?", [userId]);
  const deletedSet = new Set(deletedRows.map(r => r.default_key));
  let maxOrder = queryOne(
    "SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ?",
    [userId]
  )?.m || 0;
  let inserted = 0;

  const types = [
    ['expense', DEFAULT_EXPENSE_PARENTS],
    ['income', DEFAULT_INCOME_PARENTS],
  ];

  db.run('BEGIN');
  try {
    for (const [type, parents] of types) {
      for (const [pName, pColor] of parents) {
        const pKey = categoryDefaultKey(type, null, pName);
        if (deletedSet.has(pKey)) continue;

        let parent = queryOne(
          "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL)",
          [userId, type, pName]
        );
        if (!parent) {
          const pid = uid();
          maxOrder++;
          db.run(
            "INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
            [pid, userId, pName, type, pColor, maxOrder]
          );
          parent = { id: pid };
          inserted++;
        }

        const subs = (DEFAULT_SUBCATEGORIES[type] || {})[pName] || [];
        for (const [sName, sColor] of subs) {
          const sKey = categoryDefaultKey(type, pName, sName);
          if (deletedSet.has(sKey)) continue;

          const exists = queryOne(
            "SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ?",
            [userId, parent.id, sName]
          );
          if (exists) continue;

          maxOrder++;
          db.run(
            "INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
            [uid(), userId, sName, type, sColor, maxOrder, parent.id]
          );
          inserted++;
        }
      }
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch {}
    throw err;
  }
  return inserted;
}

// 003-categories T009：為新使用者建立完整預設樹（13 父 + 56 子）+ 「現金」帳戶 + user_settings
function createDefaultsForUser(userId) {
  let order = 0;
  for (const [name, color] of DEFAULT_EXPENSE_PARENTS) {
    const parentId = uid();
    order++;
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
      [parentId, userId, name, 'expense', color, order]);
    const subs = (DEFAULT_SUBCATEGORIES.expense || {})[name] || [];
    for (const [subName, subColor] of subs) {
      order++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
        [uid(), userId, subName, 'expense', subColor, order, parentId]);
    }
  }
  for (const [name, color] of DEFAULT_INCOME_PARENTS) {
    const parentId = uid();
    order++;
    db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",
      [parentId, userId, name, 'income', color, order]);
    const subs = (DEFAULT_SUBCATEGORIES.income || {})[name] || [];
    for (const [subName, subColor] of subs) {
      order++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",
        [uid(), userId, subName, 'income', subColor, order, parentId]);
    }
  }
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

// 003-categories T006：嚴格 #RRGGBB 6 位 hex（FR-020、FR-021；防 CSS 注入）
function isValidColor(c) { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }

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

// FR-011 Pass 2 Q5：max(floor(金額 × 0.1425% × 折扣), 整股 20 / 零股 1)
function calcStockFee(amount, shares, settings) {
  if (!(amount > 0)) return 0;
  const minFee = Number(shares) < 1000 ? settings.feeMinOdd : settings.feeMinLot;
  const baseFee = Math.floor(amount * settings.feeRate * settings.feeDiscount);
  return Math.max(minFee, baseFee);
}

// FR-012 Pass 2 Q5：max(floor(金額 × 稅率), sellTaxMin)；稅率依 stockType 取對應值
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
  const row = queryOne("SELECT public_registration, allowed_registration_emails, admin_ip_allowlist, route_audit_mode FROM system_settings WHERE id = 1") || {
    public_registration: 1,
    allowed_registration_emails: '',
    admin_ip_allowlist: '',
    route_audit_mode: 'security',
  };
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(row.allowed_registration_emails);
  const dbAdminIpAllowlist = parseIpAllowlist(row.admin_ip_allowlist);
  const mergedAdminIpAllowlist = Array.from(new Set([...ENV_ADMIN_IP_ALLOWLIST, ...dbAdminIpAllowlist]));
  const routeAuditMode = ['security', 'extended', 'minimal'].includes(row.route_audit_mode)
    ? row.route_audit_mode
    : 'security';
  return {
    publicRegistration: !!row.public_registration,
    allowedRegistrationEmails,
    adminIpAllowlist: mergedAdminIpAllowlist,
    routeAuditMode,
  };
}

// 008 feature (T005 / FR-033)：以即時查詢取得路由稽核模式（不快取，預設 'security'）
function getRouteAuditMode() {
  try {
    const row = queryOne("SELECT route_audit_mode FROM system_settings WHERE id = 1");
    const mode = row?.route_audit_mode;
    return ['security', 'extended', 'minimal'].includes(mode) ? mode : 'security';
  } catch (e) {
    return 'security';
  }
}

// 008 feature (T002 / FR-032a)：管理員專屬路徑常數，與前端 ROUTES requireAdmin: true 條目對應；新增條目須同步更新前端
const ADMIN_ONLY_PATHS = ['/settings/admin'];

// 008 feature (T003 / FR-010a)：後端版路徑正規化（與前端 normalizePath 演算法一致）
function normalizeRoutePath(rawPath) {
  if (typeof rawPath !== 'string') return '/';
  const noQueryHash = rawPath.split(/[?#]/)[0] || '/';
  const lower = noQueryHash.toLowerCase();
  const collapsed = lower.replace(/\/{2,}/g, '/');
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '') || '/';
}

// 008 feature (T038 / FR-006a)：後端 ROUTES path 列表，與前端 app.js ROUTES 表手動同步
const BACKEND_KNOWN_PATHS = new Set([
  '/', '/login', '/privacy', '/terms',
  '/dashboard',
  '/finance/transactions', '/finance/reports', '/finance/budget',
  '/finance/accounts', '/finance/categories', '/finance/recurring',
  '/stocks', '/stocks/portfolio', '/stocks/transactions',
  '/stocks/dividends', '/stocks/realized', '/stocks/settings',
  '/api-credits',
  '/settings/account', '/settings/admin', '/settings/export',
]);

// 008 feature (T038 / FR-006a)：後端 ?next= 驗證；五條規則與前端 validateNextParam 對齊
function validateNextParamBackend(rawNext) {
  if (typeof rawNext !== 'string' || rawNext.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(rawNext);
  } catch (e) {
    return { ok: false, reason: 'malformed-uri' };
  }
  if (!decoded.startsWith('/')) return { ok: false, reason: 'not-relative' };
  if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.includes('://')) {
    return { ok: false, reason: 'protocol-relative' };
  }
  const pathname = decoded.split(/[?#]/)[0];
  const normalized = normalizeRoutePath(pathname);
  if (!BACKEND_KNOWN_PATHS.has(normalized)) {
    return { ok: false, reason: 'unknown-path' };
  }
  return { ok: true, target: decoded };
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

// ═══════════════════════════════════════════════════════════════
// ─── 007 feature: 資料匯出匯入共用 helper（T008 ~ T013） ───
// ═══════════════════════════════════════════════════════════════

// T008: 匯入互斥鎖
function acquireImportLock(userId) {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}
function releaseImportLock(userId) {
  importLocks.delete(userId);
}

// T009: 稽核日誌寫入 helper（FR-042 ~ FR-046）
const AUDIT_METADATA_ALLOWED_KEYS = new Set([
  'rows', 'imported', 'skipped', 'errors', 'warnings', 'byteSize',
  'dateFrom', 'dateTo', 'failure_stage', 'failure_reason',
  'unknown_columns', 'backup_path', 'before_restore_path',
  'filename', 'filterParams',
  // 008 feature (FR-032)：路由稽核 metadata 白名單
  'path', 'normalizedPath', 'next', 'reason', 'rawUrl', 'pattern',
]);
function writeOperationAudit({ userId, role, action, ipAddress, userAgent, result, isAdminOperation, metadata }) {
  try {
    const id = uid();
    const timestamp = new Date().toISOString();
    let safeMetadata = {};
    if (metadata && typeof metadata === 'object') {
      const dropped = [];
      Object.keys(metadata).forEach(k => {
        if (AUDIT_METADATA_ALLOWED_KEYS.has(k)) safeMetadata[k] = metadata[k];
        else dropped.push(k);
      });
      if (dropped.length > 0) {
        try {
          console.warn(JSON.stringify({ event: 'audit_metadata_dropped_keys', dropped }));
        } catch (_) { /* noop */ }
      }
    }
    const ua = (userAgent || '').slice(0, 500);
    db.run(
      "INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [id, userId || '', role || 'user', action, ipAddress || '', ua, timestamp, result || 'success', isAdminOperation ? 1 : 0, JSON.stringify(safeMetadata)]
    );
    saveDB();
  } catch (e) {
    try {
      console.error(JSON.stringify({ event: 'audit_write_failed', userId, action, result, error: String(e?.message || e) }));
    } catch (_) { /* noop */ }
  }
}

// T010: CSV 組裝 helper（Formula Injection 防護 + UTF-8 BOM）
function formulaInjectionEscape(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return "'" + value;
  return value;
}
function csvCell(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  const escaped = formulaInjectionEscape(raw);
  if (/[",\n\r]/.test(escaped)) return '"' + escaped.replace(/"/g, '""') + '"';
  return escaped;
}
function buildCsv(headers, rows) {
  const BOM = '﻿';
  const headerLine = headers.map(csvCell).join(',');
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

// T011: 驗證 helper
function isValidIso8601Date(s) {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const ts = Date.parse(s);
  return !Number.isNaN(ts);
}
function isValidHexColor(s) {
  if (typeof s !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

// T012: 重複偵測 hash helpers（分隔符採 \x01 控制字元）
const HASH_SEP = '';
function makeTxHash(date, type, categoryId, amount, accountId, note) {
  return [date || '', type || '', categoryId || '', String(amount || ''), accountId || '', note || ''].join(HASH_SEP);
}
function makeStockTxHash(date, symbol, type, shares, price, accountId) {
  return [date || '', symbol || '', type || '', String(shares || ''), String(price || ''), accountId || ''].join(HASH_SEP);
}
function makeDividendHash(date, symbol, cashDividend, stockDividend) {
  return [date || '', symbol || '', String(cashDividend || ''), String(stockDividend || '')].join(HASH_SEP);
}

// T013: 備份檔 helper
function ensureBackupsDir() {
  try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (_) { /* noop */ }
}
function pruneBeforeRestoreBackups() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('before-restore-') && f.endsWith('.db'))
      .map(f => {
        const fp = path.join(BACKUPS_DIR, f);
        try {
          return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);
    const NOW = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    files.forEach((f, i) => {
      if (i >= 5 || (NOW - f.mtime) > NINETY_DAYS) {
        try {
          fs.unlinkSync(f.path);
          console.log(JSON.stringify({ event: 'before_restore_pruned', file: f.name, mtime: new Date(f.mtime).toISOString() }));
        } catch (e) {
          console.error(JSON.stringify({ event: 'before_restore_prune_failed', file: f.name, error: String(e?.message || e) }));
        }
      }
    });
  } catch (e) {
    console.error(JSON.stringify({ event: 'before_restore_prune_failed', error: String(e?.message || e) }));
  }
}

// ═══════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
  const token = req.cookies?.authToken
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  if (!token) {
    maybeAuditSessionExpired(req, '', 'token-missing');
    return res.status(401).json({ error: '請先登入' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 比對 token_version（改密碼/刪帳號後所有舊 token 立即失效）
    const user = queryOne("SELECT token_version FROM users WHERE id = ?", [decoded.userId]);
    if (!user) {
      res.clearCookie('authToken');
      maybeAuditSessionExpired(req, decoded.userId || '', 'token-invalid');
      return res.status(401).json({ error: '使用者不存在' });
    }
    const dbVersion = Number(user.token_version) || 0;
    const tokenVersion = Number(decoded.tokenVersion) || 0;
    if (tokenVersion !== dbVersion) {
      res.clearCookie('authToken');
      maybeAuditSessionExpired(req, decoded.userId || '', 'token-version-mismatch');
      return res.status(401).json({ error: '登入已失效，請重新登入' });
    }
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.clearCookie('authToken');
    const reason = (e && e.name === 'TokenExpiredError') ? 'token-expired' : 'token-invalid';
    maybeAuditSessionExpired(req, '', reason);
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

// 008 feature (T070 / FR-032 / FR-033)：僅在 extended 模式下寫 session_expired 稽核
function maybeAuditSessionExpired(req, userId, reason) {
  try {
    if (getRouteAuditMode() !== 'extended') return;
    writeOperationAudit({
      userId: userId || '',
      role: userId ? 'user' : 'guest',
      action: 'session_expired',
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || '',
      result: 'failure',
      isAdminOperation: false,
      metadata: { path: req.originalUrl || req.path || '', reason },
    });
  } catch (_) { /* 不影響主流程 */ }
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
  if (!row) return res.status(404).json({ error: '資源不存在或無權限', code: 'NotFound' });
  req.account = row;
  next();
}

// requireOwnedTransaction：套於 /api/transactions/:txId/* 路由
function requireOwnedTransaction(req, res, next) {
  const txId = req.params.txId;
  const row = ownsResource('transactions', 'id', txId, req.userId);
  if (!row) return res.status(404).json({ error: '資源不存在或無權限', code: 'NotFound' });
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

// 統一處理 lock/owns 例外（error 欄位放中文訊息給既有前端 toast 使用，code 放程式碼）
function sendLockError(res, e) {
  if (e && typeof e === 'object' && e.status) {
    const body = {
      error: e.message || e.error || 'Error',
      code: e.error || 'Error',
    };
    if (e.serverUpdatedAt) body.serverUpdatedAt = e.serverUpdatedAt;
    return res.status(e.status).json(body);
  }
  console.error('[002] unexpected error:', e);
  return res.status(500).json({ error: '伺服器內部錯誤', code: 'InternalServerError' });
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

  // 003-categories T012：登入時冪等補建預設樹（FR-010、FR-010b：失敗不阻擋登入）
  try { backfillDefaultsForUser(user.id); } catch (e) { console.error('[003-backfill]', e); }
  // 004-budgets-recurring T023：登入時 server-side 觸發產生流程（FR-012；錯誤吞噬不阻擋登入）
  try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }
  // 006-stock-investments T083：登入時 server-side 非同步觸發股票定期定額補產生（FR-020）
  setImmediate(() => {
    processStockRecurring(user.id).catch(e => console.warn('[006-stock-recurring]', e.message));
  });

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
// 同時抓 main + dev 兩條分支：dev 上 PR merge 後即使 main 尚未同步，也能讓所有部署看到最新版本資訊。
const CHANGELOG_SOURCE_URL = 'https://github.com/es94111/AssetPilot/blob/main/changelog.json';
const CHANGELOG_REMOTE_BRANCHES = ['main', 'dev'];
const APP_UPDATE_ZIP_URL = 'https://codeload.github.com/es94111/AssetPilot/zip/refs/heads/main';
let remoteChangelogCache = null;
let remoteChangelogCacheTime = 0;
const REMOTE_CHANGELOG_TTL = 30 * 60 * 1000; // 30 分鐘快取

async function fetchChangelogFromBranch(branch) {
  const rawUrl = `https://raw.githubusercontent.com/es94111/AssetPilot/${branch}/changelog.json`;
  const apiUrl = `https://api.github.com/repos/es94111/AssetPilot/contents/changelog.json?ref=${branch}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(rawUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      return await resp.json();
    }
  } catch (e) {
    // 忽略，改走 GitHub API 備援
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AssetPilot-Changelog-Fetcher' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.content) return null;
    const jsonText = Buffer.from(String(data.content).replace(/\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
}

async function fetchRemoteChangelog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && remoteChangelogCache && (now - remoteChangelogCacheTime) < REMOTE_CHANGELOG_TTL) {
    return remoteChangelogCache;
  }

  // 平行抓 main + dev，全部失敗才回 null
  const results = await Promise.all(CHANGELOG_REMOTE_BRANCHES.map(b => fetchChangelogFromBranch(b)));
  const valid = results.filter(r => r && Array.isArray(r.releases));
  if (valid.length === 0) return null;

  // 合併 main + dev：以版本號為 key 去重，後來者覆蓋（dev 通常較新，會覆蓋 main 同版本）
  const versionMap = new Map();
  let latestCurrentVersion = '0.0';
  valid.forEach(data => {
    (data.releases || []).forEach(r => versionMap.set(r.version, r));
    if (data.currentVersion && compareVersions(data.currentVersion, latestCurrentVersion) > 0) {
      latestCurrentVersion = data.currentVersion;
    }
  });
  const merged = {
    currentVersion: latestCurrentVersion,
    releases: Array.from(versionMap.values()).sort((a, b) => compareVersions(b.version, a.version)),
  };

  remoteChangelogCache = merged;
  remoteChangelogCacheTime = now;
  return merged;
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
  // 前端 (app.js) 送的 redirect_uri 為 `location.origin + '/'`（根路徑、含末端斜線）
  // — 故 fallback 必須與之一致。歷史版本錯誤地寫成 `/api/auth/google` 路徑，導致預設配置永遠
  // 命中 invalid_redirect_uri；只有手動設 GOOGLE_OAUTH_REDIRECT_URIS 才能避開。本 fallback 修正
  // 為與 frontend 同步的根路徑形式，並同時容納含 / 不含末端斜線兩種變體。
  const fallback = [
    `https://${APP_HOST}/`,
    `https://${APP_HOST}`,
    `http://localhost:${PORT}/`,
    `http://localhost:${PORT}`,
  ];
  // 自動納入 ALLOWED_ORIGINS（CORS 白名單）— 多數部署只設 ALLOWED_ORIGINS、忘了 APP_HOST，
  // 為避免每個自訂網域都要再多設一次 redirect_uri 白名單，這裡自動派生。
  if (ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0) {
    for (const origin of ALLOWED_ORIGINS) {
      const stripped = String(origin || '').replace(/\/$/, '');
      if (!stripped) continue;
      fallback.push(stripped);
      fallback.push(stripped + '/');
    }
  }
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
    console.warn(`[OAuth] invalid_redirect_uri 被拒：received=${JSON.stringify(redirect_uri)}，allowlist=${JSON.stringify([...googleRedirectUriAllowlist])}`);
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
    // 003-categories T012：登入時冪等補建預設樹
    try { backfillDefaultsForUser(user.id); } catch (e) { console.error('[003-backfill]', e); }
  // 004-budgets-recurring T023：登入時 server-side 觸發產生流程（FR-012；錯誤吞噬不阻擋登入）
  try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }
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

    // 003-categories T012：登入時冪等補建預設樹
    try { backfillDefaultsForUser(user.id); } catch (e) { console.error('[003-backfill]', e); }
  // 004-budgets-recurring T023：登入時 server-side 觸發產生流程（FR-012；錯誤吞噬不阻擋登入）
  try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }

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

// ─── 007 feature (T056, FR-036~038)：API 使用與授權清單（公開端點，無需登入） ───
app.get('/api/external-apis', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ apis: externalApisData });
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

// ─── 007 feature: 資料操作稽核日誌查詢端點（T059 ~ T064） ───
function parseAuditQuery(req, forceUserId) {
  const where = [];
  const params = [];
  const userId = forceUserId !== undefined ? forceUserId : (req.query.user_id || '');
  if (userId) { where.push('user_id = ?'); params.push(String(userId)); }
  if (req.query.action) {
    const acts = String(req.query.action).split(',').map(s => s.trim()).filter(Boolean);
    if (acts.length > 0) {
      where.push(`action IN (${acts.map(() => '?').join(',')})`);
      acts.forEach(a => params.push(a));
    }
  }
  if (req.query.result && ['success', 'failed', 'rolled_back'].includes(String(req.query.result))) {
    where.push('result = ?');
    params.push(String(req.query.result));
  }
  if (req.query.start) { where.push('timestamp >= ?'); params.push(String(req.query.start)); }
  if (req.query.end) { where.push('timestamp <= ?'); params.push(String(req.query.end)); }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  return { whereSql, params };
}

function serializeAuditRow(r) {
  let metadata = {};
  try { metadata = r.metadata ? JSON.parse(r.metadata) : {}; } catch (_) { metadata = { raw: r.metadata }; }
  return {
    id: r.id,
    user_id: r.user_id,
    role: r.role,
    action: r.action,
    ip_address: r.ip_address || '',
    user_agent: r.user_agent || '',
    timestamp: r.timestamp,
    result: r.result,
    is_admin_operation: Number(r.is_admin_operation) || 0,
    metadata,
  };
}

// T059：管理員列出全部稽核日誌
app.get('/api/admin/data-audit', adminMiddleware, (req, res) => {
  const { whereSql, params } = parseAuditQuery(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, parseInt(req.query.pageSize, 10) || 50));
  const total = queryOne(`SELECT COUNT(*) AS cnt FROM data_operation_audit_log ${whereSql}`, params)?.cnt || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dataSql = `SELECT * FROM data_operation_audit_log ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  const data = queryAll(dataSql, [...params, pageSize, (page - 1) * pageSize]).map(serializeAuditRow);
  res.json({ data, total, page, totalPages });
});

// T060：使用者「我的操作紀錄」（強制覆寫 user_id）
app.get('/api/user/data-audit', (req, res) => {
  const { whereSql, params } = parseAuditQuery(req, req.userId);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, parseInt(req.query.pageSize, 10) || 50));
  const total = queryOne(`SELECT COUNT(*) AS cnt FROM data_operation_audit_log ${whereSql}`, params)?.cnt || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dataSql = `SELECT * FROM data_operation_audit_log ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  const data = queryAll(dataSql, [...params, pageSize, (page - 1) * pageSize]).map(serializeAuditRow);
  res.json({ data, total, page, totalPages });
});

// T061：匯出稽核日誌 CSV（管理員）
app.get('/api/admin/data-audit/export', adminMiddleware, (req, res) => {
  try {
    const { whereSql, params } = parseAuditQuery(req);
    const rows = queryAll(`SELECT * FROM data_operation_audit_log ${whereSql} ORDER BY timestamp DESC`, params);
    const headers = ['id', 'user_id', 'role', 'action', 'ip_address', 'user_agent', 'timestamp', 'result', 'is_admin_operation', 'metadata'];
    const dataRows = rows.map(r => [
      r.id, r.user_id, r.role, r.action, r.ip_address || '', r.user_agent || '',
      r.timestamp, r.result, r.is_admin_operation, r.metadata || '{}',
    ]);
    const csv = buildCsv(headers, dataRows);
    const filename = `audit-log-${makeBackupTimestamp()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    console.error('export audit-log failed', e);
    res.status(500).json({ error: '匯出稽核日誌失敗', message: String(e?.message || e) });
  }
});

// T062：清空稽核日誌（管理員）
app.post('/api/admin/data-audit/purge', adminMiddleware, (req, res) => {
  try {
    const total = queryOne("SELECT COUNT(*) AS cnt FROM data_operation_audit_log")?.cnt || 0;
    db.run("DELETE FROM data_operation_audit_log");
    saveDB();
    res.json({ ok: true, deleted: total });
  } catch (e) {
    console.error('purge audit-log failed', e);
    res.status(500).json({ error: '清空稽核日誌失敗', message: String(e?.message || e) });
  }
});

// T063 / T064：保留天數設定
app.get('/api/admin/data-audit/retention', adminMiddleware, (req, res) => {
  const row = queryOne("SELECT audit_log_retention_days FROM system_settings WHERE id = 1");
  res.json({ retention_days: row?.audit_log_retention_days || '90' });
});
app.put('/api/admin/data-audit/retention', adminMiddleware, (req, res) => {
  const value = String(req.body?.retention_days || '');
  if (!['30', '90', '180', '365', 'forever'].includes(value)) {
    return res.status(400).json({ error: 'retention_days 必須為 30 / 90 / 180 / 365 / forever 之一' });
  }
  db.run(
    "UPDATE system_settings SET audit_log_retention_days = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [value, Date.now(), req.userId]
  );
  saveDB();
  res.json({ ok: true, retention_days: value });
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
  // 008 feature (T068 / FR-033)：可選 routeAuditMode；非合法值回 400
  let routeAuditMode = null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'routeAuditMode')) {
    const candidate = String(req.body.routeAuditMode || '');
    if (!['security', 'extended', 'minimal'].includes(candidate)) {
      return res.status(400).json({ error: 'routeAuditMode 必須為 security、extended 或 minimal' });
    }
    routeAuditMode = candidate;
  }
  if (routeAuditMode) {
    db.run(
      "UPDATE system_settings SET public_registration = ?, allowed_registration_emails = ?, admin_ip_allowlist = ?, route_audit_mode = ?, updated_at = ?, updated_by = ? WHERE id = 1",
      [publicRegistration ? 1 : 0, allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'), routeAuditMode, Date.now(), req.userId]
    );
  } else {
    db.run(
      "UPDATE system_settings SET public_registration = ?, allowed_registration_emails = ?, admin_ip_allowlist = ?, updated_at = ?, updated_by = ? WHERE id = 1",
      [publicRegistration ? 1 : 0, allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'), Date.now(), req.userId]
    );
  }
  saveDB();
  res.json({
    success: true,
    publicRegistration,
    allowedRegistrationEmails,
    adminIpAllowlist,
    routeAuditMode: routeAuditMode || getRouteAuditMode(),
  });
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

// 005 T011: prevDayOf — 回傳給定 YYYY-MM-DD 的前一天
function prevDayOf(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return ymd(dt);
}

// 005 T011: weekRangeOf — 回傳該 ISO 日期所在週（週一起算）的 Mon-Sun 範圍與上一週範圍
function weekRangeOf(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Sun..6=Sat
  const daysSinceMon = (dow + 6) % 7;
  const monThis = new Date(y, m - 1, d - daysSinceMon);
  const sunThis = new Date(y, m - 1, d - daysSinceMon + 6);
  const monPrev = new Date(y, m - 1, d - daysSinceMon - 7);
  const sunPrev = new Date(y, m - 1, d - daysSinceMon - 1);
  return { start: ymd(monThis), end: ymd(sunThis), prevStart: ymd(monPrev), prevEnd: ymd(sunPrev) };
}

// 005 T010: buildCategoryAggregateNodes — 從 LEFT JOIN categories 後的 row 陣列建立排序穩定的 CategoryAggregateNode[]
// 排序：parent_total DESC，再同父下 total DESC（FR-013 / SC-003）
// 「（其他）」虛擬節點：parent_id IS NULL 的交易（直接掛父分類）→ 外圈虛擬節點，金額不重複計入內圈
function buildCategoryAggregateNodes(rows) {
  // rows 必填欄位：cat_name, cat_color, cat_parent_id, cat_parent_name, cat_parent_color, category_id, amount
  const parentMap = new Map(); // parentKey -> { parentId, parentName, parentColor, total, children: [...], otherTotal }
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    const childCategoryId = r.category_id || '';
    const childName = r.cat_name || '未分類';
    const childColor = r.cat_color || '#94a3b8';
    const parentId = r.cat_parent_id || '';
    const isLeaf = !!parentId; // 子分類交易
    const parentKey = isLeaf ? parentId : (childCategoryId || `name:${childName}`);
    const parentName = isLeaf ? (r.cat_parent_name || '未分類') : childName;
    const parentColor = isLeaf ? (r.cat_parent_color || childColor) : childColor;
    if (!parentMap.has(parentKey)) {
      parentMap.set(parentKey, {
        parentId: parentKey,
        parentName,
        parentColor,
        total: 0,
        children: new Map(), // childKey -> { categoryId, name, color, total }
        otherTotal: 0,
      });
    }
    const p = parentMap.get(parentKey);
    p.total += amount;
    if (isLeaf) {
      const childKey = childCategoryId || `name:${childName}`;
      if (!p.children.has(childKey)) {
        p.children.set(childKey, {
          categoryId: childCategoryId,
          name: childName,
          color: childColor,
          total: 0,
        });
      }
      p.children.get(childKey).total += amount;
    } else {
      // 父分類本身有交易（無子分類）→ 累加到「（其他）」虛擬節點
      p.otherTotal += amount;
    }
  }

  // 攤平為 CategoryAggregateNode[]：每筆記錄一個外圈節點（含「（其他）」虛擬節點）
  const parents = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
  const nodes = [];
  for (const p of parents) {
    const children = Array.from(p.children.values()).sort((a, b) => b.total - a.total);
    for (const c of children) {
      nodes.push({
        categoryId: c.categoryId,
        name: c.name,
        color: c.color,
        parentId: p.parentId,
        parentName: p.parentName,
        parentColor: p.parentColor,
        total: c.total,
        isOtherGroup: false,
      });
    }
    if (p.otherTotal > 0) {
      nodes.push({
        categoryId: null,
        name: '（其他）',
        color: p.parentColor,
        parentId: p.parentId,
        parentName: p.parentName,
        parentColor: p.parentColor,
        total: p.otherTotal,
        isOtherGroup: true,
      });
    }
  }
  return nodes;
}

// 005: thisMonthEnd — 回傳當月最後一天（YYYY-MM-DD）
function thisMonthEnd(monthStr) {
  const [y, m] = String(monthStr || thisMonth()).split('-').map(Number);
  const last = new Date(y, m, 0); // 第 0 天 = 上個月最後一天 = 該月最後一天
  return ymd(last);
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

  // KPI 區（KPI 卡顯示「本月」總計，不論 freq；但對比 pill 依 freq 切換為「同型前一段」— FR-018 / Round 1 Q4）
  const sumOf = (type, like) => Number(queryOne(
    `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type = ? AND date LIKE ? AND exclude_from_stats = 0`,
    [userId, type, like]
  )?.total || 0);
  const sumBetween = (type, fromS, toS) => Number(queryOne(
    `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type = ? AND date >= ? AND date <= ? AND exclude_from_stats = 0`,
    [userId, type, fromS, toS]
  )?.total || 0);
  const income = sumOf('income', monthLike);
  const expense = sumOf('expense', monthLike);

  // 005 T063: 對比期間依 freq 切換
  let prevIncome, prevExpense, compareLabel;
  if (freq === 'daily') {
    const today = todayStr();
    const yest = prevDayOf(today);
    const beforeYest = prevDayOf(yest);
    prevIncome = sumBetween('income', beforeYest, beforeYest);
    prevExpense = sumBetween('expense', beforeYest, beforeYest);
    compareLabel = '對比前日';
    // 注意：daily 對比基準改為「昨日 vs 前日」 — 重新覆寫 income/expense 為「昨日」(若需要嚴格對齊區段)
    // 但 spec FR-001 / acceptance scenario US1.1 KPI 是「該月份」總計，所以這裡保留 income/expense 為當月，
    // 對比 pill 改用「昨日 vs 前日」更符合「同型前一段」的 daily 信件語境。
    // 以 income/expense 為「昨日」、prevIncome/prevExpense 為「前日」對比
    const yestInc = sumBetween('income', yest, yest);
    const yestExp = sumBetween('expense', yest, yest);
    if (yestInc > 0 || yestExp > 0 || prevIncome > 0 || prevExpense > 0) {
      // 若昨日有資料則改用昨日 vs 前日對比；否則保留當月 vs 上月作 fallback
      // 為避免破壞既有信件版面（KPI 卡標題仍稱「本月」），這裡只調整對比 pill 的 prev 值，
      // 仍以當月為當期值 — 如此「daily 信件對比前日」的語意由 compareLabel 表達。
      prevIncome = sumBetween('income', yest, yest);
      prevExpense = sumBetween('expense', yest, yest);
    }
  } else if (freq === 'weekly') {
    const wk = weekRangeOf(todayStr());
    prevIncome = sumBetween('income', wk.prevStart, wk.prevEnd);
    prevExpense = sumBetween('expense', wk.prevStart, wk.prevEnd);
    compareLabel = '對比上週';
  } else {
    // monthly 或其他 → 上月對比（既有行為）
    prevIncome = sumOf('income', prevMonthLike);
    prevExpense = sumOf('expense', prevMonthLike);
    compareLabel = '對比上月';
  }

  // 子分類向上歸併到父分類（例：早餐 / 午餐 → 餐飲）
  const topCategories = queryAll(`
    SELECT
      COALESCE(pc.name, c.name, '未分類') as name,
      COALESCE(pc.color, c.color, '#94a3b8') as color,
      COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
    GROUP BY COALESCE(pc.id, c.id),
             COALESCE(pc.name, c.name, '未分類'),
             COALESCE(pc.color, c.color, '#94a3b8')
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

  const stocks = queryAll("SELECT id, symbol, name, current_price, updated_at FROM stocks WHERE user_id = ?", [userId]);
  let stockHoldings = 0;
  let stockCostTwd = 0;
  let stockMarketValueTwd = 0;
  const stockHoldingsList = []; // 005 T064a: 持股明細（含 priceAsOf）供信件呈現資料時間註記
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
      // priceAsOf：stocks.updated_at（既有 schema 為 YYYY-MM-DD 字串或 0/NULL）
      stockHoldingsList.push({
        symbol: s.symbol,
        name: s.name,
        shares,
        currentPrice: cp,
        priceAsOf: s.updated_at || null,
      });
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
    compareLabel,
    savingsRate,
    topCategories,
    topCategoriesMax,
    transactionsSection,
    stockHoldings,
    stockHoldingsList,
    stockCostTwd: Math.round(stockCostTwd),
    stockMarketValueTwd: Math.round(stockMarketValueTwd),
    stockUnrealizedPL: Math.round(stockUnrealizedPL),
    stockReturnPct,
  };
}

// 005 T064: compareLabel 由 buildUserStatsReport 傳入（對比上月/上週/前日）
function renderChangePill(pct, kind, compareLabel) {
  const label = compareLabel || '對比上月';
  if (pct === null || pct === undefined) {
    return `<span style="font-size:11px;color:#888">${label} —</span>`;
  }
  const rounded = Math.round(pct * 10) / 10;
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '→';
  const isPositive = rounded > 0;
  let color = '#888';
  if (kind === 'good-up') color = isPositive ? '#16a34a' : (rounded < 0 ? '#dc2626' : '#888');
  else if (kind === 'good-down') color = isPositive ? '#dc2626' : (rounded < 0 ? '#16a34a' : '#888');
  const sign = rounded > 0 ? '+' : '';
  return `<span style="font-size:11px;color:${color}">${label} ${arrow} ${sign}${rounded}%</span>`;
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

  const cmpLabel = stats.compareLabel || '對比上月';
  const kpiRow = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 4px;border-collapse:separate"><tr>
      ${kpiCard('本月收入', formatAmount(stats.income), COLOR_GREEN, renderChangePill(stats.incomeChangePct, 'good-up', cmpLabel))}
      ${kpiCard('本月支出', formatAmount(stats.expense), COLOR_RED, renderChangePill(stats.expenseChangePct, 'good-down', cmpLabel))}
      ${kpiCard('本月淨額', formatAmount(stats.net), stats.net >= 0 ? COLOR_INK : COLOR_RED, renderChangePill(stats.netChangePct, 'good-up', cmpLabel))}
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
        // 005 T064b / FR-019: 週末日期紫色（採 inline style 相容 Outlook Desktop Word 渲染引擎）
        const dateColor = isWeekend ? '#a855f7' : COLOR_INK;
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

    // 005 T064a: 資料時間註記 — 若 stockHoldingsList 內任一持股 priceAsOf 超過 12h 則顯示「資料: YYYY-MM-DD」
    let stalestNote = '';
    const STALE_MS = 12 * 60 * 60 * 1000;
    const nowMs = Date.now();
    if (Array.isArray(stats.stockHoldingsList) && stats.stockHoldingsList.length > 0) {
      let stalestPriceAsOf = null;
      for (const h of stats.stockHoldingsList) {
        if (!h.priceAsOf || h.priceAsOf === '0') continue;
        // priceAsOf 為 YYYY-MM-DD 字串；以該日 23:59 推估，避免時區誤差
        const t = Date.parse(String(h.priceAsOf) + 'T23:59:59+08:00');
        if (!Number.isFinite(t)) continue;
        if (stalestPriceAsOf === null || t < stalestPriceAsOf) stalestPriceAsOf = t;
      }
      if (stalestPriceAsOf !== null && (nowMs - stalestPriceAsOf > STALE_MS)) {
        const dt = new Date(stalestPriceAsOf + 8 * 3600 * 1000);
        const dStr = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        stalestNote = `<div style="font-size:11px;color:#94a3b8;margin-top:4px">最舊資料時間: ${escapeEmailHtml(dStr)}</div>`;
      }
    }

    stockBlock = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLOR_BG_SOFT};border-radius:12px;border:1px solid ${COLOR_BORDER}"><tr><td style="padding:16px 18px">
        <div style="font-size:12px;color:${COLOR_MUTED};letter-spacing:0.06em;text-transform:uppercase;font-weight:600;margin-bottom:10px">目前持有 <span style="color:${COLOR_INK};font-weight:700">${stats.stockHoldings}</span> 檔${stalestNote}</div>
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
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>個人資產統計報表</title>
<style>
  body { width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  @media only screen and (max-width: 600px) {
    body { padding: 0 !important; background: #ffffff !important; }
    .ap-outer { width: 100% !important; max-width: 100% !important; }
    .ap-shell { border-radius: 0 !important; box-shadow: none !important; }
    .ap-hero { padding: 26px 18px 20px !important; }
    .ap-hero-title { font-size: 22px !important; }
    .ap-body { padding: 18px 14px 24px !important; }
    .ap-footer { margin-top: 12px !important; padding: 0 12px 16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue','Noto Sans TC','Microsoft JhengHei',sans-serif;color:${COLOR_INK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale" width="100%">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" width="100%" class="ap-outer" style="max-width:600px;margin:0 auto;width:100%"><tr><td>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="ap-shell" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08)">
      <tr><td class="ap-hero" bgcolor="#4f46e5" style="padding:32px 28px 22px;background-color:#4f46e5;background:#4f46e5 linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%);color:#ffffff">
        <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;font-weight:600">AssetPilot · ${month} 月度摘要</div>
        <div class="ap-hero-title" style="font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-0.02em">${safeName}，您好 👋</div>
        <div style="font-size:14px;line-height:1.5;margin-top:8px;opacity:0.95">這是您本月的資產與收支快照<br>資產 <strong>${stats.accountCount}</strong> 個帳戶 · 持股 <strong>${stats.stockHoldings}</strong> 檔</div>
      </td></tr>
      <tr><td class="ap-body" style="padding:24px 24px 28px;background:#ffffff">

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
    <div class="ap-footer" style="text-align:center;margin-top:14px;font-size:11px;color:#94a3b8">
      ©  AssetPilot · 個人資產管理
    </div>
  </td></tr></table>
</body></html>`;
}

// 註：POST /api/admin/send-stats-report 已於 v4.17.0 移除，請改用
// PUT /api/admin/report-schedule（更新 userIds）+ POST /api/admin/report-schedule/run-now

// ─── 寄信通道狀態（管理員，唯讀，反映環境變數設定）───
app.get('/api/admin/email-providers', adminMiddleware, (req, res) => {
  const { primary, fallback } = getActiveEmailProviders();
  res.json({
    primary,
    fallback,
    configured: {
      smtp: isProviderConfigured('smtp'),
      zeabur: isProviderConfigured('zeabur'),
      resend: isProviderConfigured('resend'),
    },
  });
});

// 寄送測試信給目前登入管理員，驗證寄信設定
app.post('/api/admin/test-email', adminMiddleware, async (req, res) => {
  const me = queryOne("SELECT email, display_name FROM users WHERE id = ?", [req.userId]);
  if (!me?.email) return res.status(400).json({ error: '目前管理員未設定 Email，無法寄送測試信' });
  try {
    const result = await sendStatsEmail({
      to: me.email,
      subject: 'AssetPilot 寄信設定測試',
      html: `<p>這是一封測試信，用來驗證寄信設定正確。</p><p>若您能收到此信，代表「寄送資產統計報表」功能已可正常使用。</p>`,
    });
    if (!result) return res.status(503).json({ error: '寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）' });
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
// 006 T101：下市股票（delisted=1）跳過 TWSE 請求；歷史代號改名 → 自動同步 stocks.name
async function updateUserStockPrices(userId) {
  const stocks = queryAll("SELECT id, symbol, name, delisted FROM stocks WHERE user_id = ? AND COALESCE(delisted, 0) = 0", [userId]);
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
          [info.closingPrice, new Date().toISOString(), s.id, userId]
        );
        // 006 Edge Case「歷史代號改名」：TWSE 回傳 name 與 DB 不同則同步更新
        if (info.name && info.name !== s.name) {
          db.run("UPDATE stocks SET name = ? WHERE id = ? AND user_id = ?", [info.name, s.id, userId]);
        }
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

// 005 T065: 改寫為接收 report_schedules row（多筆模式）
// enabled=0 直接 false（取代既有 freq==='off'）；其餘邏輯（twParts 比對、last_run<periodStart）保留
function shouldRunSchedule(scheduleRow, nowTs = serverNow()) {
  if (!scheduleRow || scheduleRow.enabled === 0) return false;
  const tw = twParts(nowTs);
  if (tw.hours < (Number(scheduleRow.hour) || 0)) return false;

  const periodStart = twStartOfDayMs(nowTs);

  if (scheduleRow.freq === 'daily') {
    // nothing extra
  } else if (scheduleRow.freq === 'weekly') {
    if (tw.day !== (Number(scheduleRow.weekday) || 0)) return false;
  } else if (scheduleRow.freq === 'monthly') {
    if (tw.date !== (Number(scheduleRow.day_of_month) || 1)) return false;
  } else {
    return false;
  }
  return (Number(scheduleRow.last_run) || 0) < periodStart;
}

const REPORT_SCHEDULE_MAX_TARGETS = 100;

// 005 T066: per-schedule lock map 取代既有全域 isRunningSchedule flag
const runningSchedules = new Set();

function formatTwTime(ts) {
  if (!ts) return '從未';
  const p = twParts(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month + 1)}-${pad(p.date)} ${pad(p.hours)}:${pad(p.minutes)}`;
}

// 005 T066: 改為單筆 scheduleId 觸發
async function runScheduledReportNow(scheduleId, triggeredBy = '排程') {
  if (!scheduleId) {
    return { status: 'invalid', sent: 0, failed: 0, skipped: 0, reason: '未指定排程' };
  }
  if (runningSchedules.has(scheduleId)) {
    return { status: 'already_running', sent: 0, failed: 0, skipped: 0, reason: '此排程已有寄送任務進行中' };
  }
  runningSchedules.add(scheduleId);
  const startedAt = serverNow();
  try {
    const schedule = queryOne("SELECT * FROM report_schedules WHERE id = ?", [scheduleId]);
    if (!schedule) return { status: 'not_found', sent: 0, failed: 0, skipped: 0, reason: '排程不存在' };
    if (schedule.enabled === 0) return { status: 'disabled', sent: 0, failed: 0, skipped: 0, reason: '排程已停用' };

    const u = queryOne("SELECT id, email, display_name, is_active FROM users WHERE id = ?", [schedule.user_id]);
    if (!u) {
      const summary = `${formatTwTime(startedAt)} ${triggeredBy}：使用者不存在`;
      db.run("UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?", [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'user_not_found', sent: 0, failed: 0, skipped: 1, reason: '使用者不存在' };
    }

    // FR-024: 使用者已停用 → 略過寄送、不更新 last_run（下次自然觸發點仍應重試）
    if (u.is_active === 0) {
      const summary = `${formatTwTime(startedAt)} ${triggeredBy}：使用者帳號已停用，略過寄送`;
      db.run("UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?", [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'skipped', sent: 0, failed: 0, skipped: 1, reason: '使用者帳號已停用' };
    }

    if (!isValidEmail(u.email)) {
      const summary = `${formatTwTime(startedAt)} ${triggeredBy}：Email 無效或未設定`;
      db.run("UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?", [startedAt, summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'invalid_email', sent: 0, failed: 1, skipped: 0, reason: 'Email 無效或未設定' };
    }

    if (!getActiveEmailProviders().hasAny) {
      // FR-021: 寄信服務未設定 → 視為 failed（caller T072 須翻譯為 503）
      const summary = `${formatTwTime(startedAt)} ${triggeredBy}：寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）`;
      db.run("UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?", [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'no_email_service', sent: 0, failed: 1, skipped: 0, reason: '寄信服務未設定' };
    }

    let sent = 0, failed = 0;
    let priceUpdates = 0;
    let provider = null;
    let errMsg = '';
    try {
      const priceResult = await updateUserStockPrices(u.id).catch(() => ({ updated: 0, skipped: 0 }));
      priceUpdates = priceResult.updated;

      const stats = buildUserStatsReport(u.id, schedule.freq);
      const html = renderStatsEmailHtml(u.display_name, u.email, stats);
      const subject = `${stats.month} 個人資產統計報表`;
      const r = await sendStatsEmail({ to: u.email, subject, html });
      if (r) {
        sent = 1;
        provider = r.provider;
      } else {
        failed = 1;
        errMsg = '寄信服務未設定';
      }
    } catch (e) {
      failed = 1;
      errMsg = e.message || '未知錯誤';
    }

    const finishedAt = serverNow();
    const summaryParts = [`${formatTwTime(startedAt)} ${triggeredBy}：${sent ? `寄送成功 (${provider || ''})` : `寄送失敗`}（更新股價 ${priceUpdates} 檔，完成於 ${formatTwTime(finishedAt)}）`];
    if (errMsg) summaryParts.push('原因：' + errMsg);
    const summary = summaryParts.join(' | ');
    db.run("UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?", [startedAt, summary, startedAt, scheduleId]);
    saveDB();
    return { status: sent ? 'completed' : 'failed', sent, failed, skipped: 0, priceUpdates, provider, reason: errMsg };
  } finally {
    runningSchedules.delete(scheduleId);
  }
}

// 005 T067: 迭代所有 enabled=1 排程
function checkAndRunSchedule() {
  try {
    const rows = queryAll("SELECT * FROM report_schedules WHERE enabled = 1");
    const now = serverNow();
    for (const row of rows) {
      if (runningSchedules.has(row.id)) continue;
      if (!shouldRunSchedule(row, now)) continue;
      runScheduledReportNow(row.id, '排程').catch(err => console.error('[scheduled-report]', err));
    }
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

// 007 feature (T014)：稽核日誌清理擴充至 data_operation_audit_log
function pruneDataOperationAuditLog() {
  try {
    const row = queryOne("SELECT audit_log_retention_days FROM system_settings WHERE id = 1");
    const retention = row?.audit_log_retention_days || '90';
    if (retention === 'forever') return 0;
    const days = parseInt(retention, 10);
    if (!days || days <= 0) return 0;
    const threshold = new Date(Date.now() - days * 86400 * 1000).toISOString();
    let total = 0;
    while (true) {
      const idsRes = db.exec(
        `SELECT id FROM data_operation_audit_log WHERE timestamp < ? LIMIT ${PRUNE_BATCH}`,
        [threshold]
      );
      const rows = idsRes[0]?.values || [];
      if (rows.length === 0) break;
      const placeholders = rows.map(() => '?').join(',');
      db.run(`DELETE FROM data_operation_audit_log WHERE id IN (${placeholders})`, rows.map(r => r[0]));
      total += rows.length;
    }
    if (total > 0) {
      saveDB();
      console.log(`[Audit Prune] data_operation_audit_log removed ${total} rows`);
    }
    return total;
  } catch (e) {
    console.error('[Audit Prune] data_operation_audit_log error', e);
    return 0;
  }
}

function registerAuditPruneJob() {
  function tick() {
    try { pruneAuditLogs(); } catch (e) { console.error('[Audit Prune] login_audit run error', e); }
    try { pruneDataOperationAuditLog(); } catch (e) { console.error('[Audit Prune] data_audit run error', e); }
  }
  // FR-046a：每日午夜（伺服器時區）執行 — 採 setTimeout cascade 模式
  function scheduleNextMidnightTick() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const ms = nextMidnight.getTime() - now.getTime();
    setTimeout(() => {
      try { tick(); } catch (e) { console.error('[Audit Prune] tick failed', e); }
      scheduleNextMidnightTick();
    }, ms);
  }
  setTimeout(() => {
    try { tick(); } catch (e) { console.error('[Audit Prune] initial tick failed', e); }
  }, 5000);
  scheduleNextMidnightTick();
  console.log('[Audit Prune] registered; next run at server-local midnight');
}

// 005 T073: deprecated singleton — 仍保留供既有前端讀取
app.get('/api/admin/report-schedule', adminMiddleware, (req, res) => {
  const s = getReportSchedule();
  res.json({
    deprecated: true,
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

// 005 T068: GET /api/admin/report-schedules — 列出多筆排程
function serializeSchedule(row) {
  return {
    id: row.id,
    userId: row.user_id,
    freq: row.freq,
    hour: Number(row.hour) || 0,
    weekday: Number(row.weekday) || 0,
    dayOfMonth: Number(row.day_of_month) || 1,
    enabled: row.enabled === 1,
    lastRun: Number(row.last_run) || 0,
    lastRunText: row.last_run ? formatTwTime(Number(row.last_run)) : '',
    lastSummary: row.last_summary || '',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

app.get('/api/admin/report-schedules', adminMiddleware, (req, res) => {
  const userId = req.query.userId;
  const rows = userId
    ? queryAll("SELECT * FROM report_schedules WHERE user_id = ? ORDER BY created_at DESC", [String(userId)])
    : queryAll("SELECT * FROM report_schedules ORDER BY created_at DESC");
  res.json(rows.map(serializeSchedule));
});

// 005 T069: POST /api/admin/report-schedules — 新增（不檢查 (user_id, freq) 唯一性）
app.post('/api/admin/report-schedules', adminMiddleware, (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const freq = String(req.body?.freq || '').trim();
  if (!userId) return res.status(400).json({ error: '缺少 userId' });
  if (!['daily', 'weekly', 'monthly'].includes(freq)) return res.status(400).json({ error: 'freq 須為 daily/weekly/monthly' });
  const u = queryOne("SELECT id FROM users WHERE id = ?", [userId]);
  if (!u) return res.status(400).json({ error: '指定的使用者不存在' });
  const hour = clampInt(req.body?.hour, 0, 23, 9);
  const weekday = clampInt(req.body?.weekday, 0, 6, 1);
  const dayOfMonth = clampInt(req.body?.dayOfMonth, 1, 28, 1);
  const enabled = req.body?.enabled === false ? 0 : 1;
  const id = `rs_${Date.now()}_${uid().slice(0, 8)}`;
  const nowMs = Date.now();
  db.run(
    "INSERT INTO report_schedules (id, user_id, freq, hour, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)",
    [id, userId, freq, hour, weekday, dayOfMonth, enabled, nowMs, nowMs]
  );
  saveDB();
  const row = queryOne("SELECT * FROM report_schedules WHERE id = ?", [id]);
  res.status(201).json(serializeSchedule(row));
});

// 005 T070: PUT /api/admin/report-schedules/:id — 部分欄位 update；userId/freq 不可變；enabled false→true 不重置 last_run
app.put('/api/admin/report-schedules/:id', adminMiddleware, (req, res) => {
  const id = req.params.id;
  const row = queryOne("SELECT * FROM report_schedules WHERE id = ?", [id]);
  if (!row) return res.status(404).json({ error: '排程不存在' });
  const updates = {};
  if (req.body?.hour !== undefined) updates.hour = clampInt(req.body.hour, 0, 23, row.hour);
  if (req.body?.weekday !== undefined) updates.weekday = clampInt(req.body.weekday, 0, 6, row.weekday);
  if (req.body?.dayOfMonth !== undefined) updates.day_of_month = clampInt(req.body.dayOfMonth, 1, 28, row.day_of_month);
  if (req.body?.enabled !== undefined) updates.enabled = req.body.enabled ? 1 : 0;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: '請至少更新一個欄位' });
  const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), Date.now(), id];
  db.run(`UPDATE report_schedules SET ${cols}, updated_at = ? WHERE id = ?`, vals);
  saveDB();
  const updated = queryOne("SELECT * FROM report_schedules WHERE id = ?", [id]);
  res.json(serializeSchedule(updated));
});

// 005 T071: DELETE /api/admin/report-schedules/:id
app.delete('/api/admin/report-schedules/:id', adminMiddleware, (req, res) => {
  const id = req.params.id;
  const row = queryOne("SELECT id FROM report_schedules WHERE id = ?", [id]);
  if (!row) return res.status(404).json({ error: '排程不存在' });
  db.run("DELETE FROM report_schedules WHERE id = ?", [id]);
  saveDB();
  res.status(204).send();
});

// 005 T072: POST /api/admin/report-schedules/:id/run-now
// FR-021: 若 sendStatsEmail 兩通道皆未設定（status === 'no_email_service'），handler MUST 回 503
app.post('/api/admin/report-schedules/:id/run-now', adminMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const row = queryOne("SELECT id FROM report_schedules WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: '排程不存在' });
    const result = await runScheduledReportNow(id, '管理員手動');
    if (result.status === 'no_email_service') {
      return res.status(503).json({ status: 'no_email_service', reason: '寄信服務未設定', ...result });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || '手動執行失敗' });
  }
});

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 005 T074: deprecated singleton — UPSERT 模式同步寫入 report_schedules 表
app.put('/api/admin/report-schedule', adminMiddleware, (req, res) => {
  const freq = SCHEDULE_FREQ_VALUES.includes(req.body?.freq) ? req.body.freq : 'off';
  const hour = clampInt(req.body?.hour, 0, 23, 9);
  const weekday = clampInt(req.body?.weekday, 0, 6, 1);
  const dayOfMonth = clampInt(req.body?.dayOfMonth, 1, 28, 1);

  const rawIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const cleanIds = [...new Set(rawIds.map(String).map(s => s.trim()).filter(Boolean))];
  if (cleanIds.length > REPORT_SCHEDULE_MAX_TARGETS) {
    return res.status(400).json({ error: `單次最多指定 ${REPORT_SCHEDULE_MAX_TARGETS} 位使用者` });
  }
  const validIds = cleanIds.filter(id => !!queryOne("SELECT id FROM users WHERE id = ?", [id]));

  db.run(
    "UPDATE system_settings SET report_schedule_freq = ?, report_schedule_hour = ?, report_schedule_weekday = ?, report_schedule_day_of_month = ?, report_schedule_user_ids = ?, updated_at = ?, updated_by = ? WHERE id = 1",
    [freq, hour, weekday, dayOfMonth, JSON.stringify(validIds), Date.now(), req.userId]
  );

  // T074: 同步寫入 report_schedules（UPSERT，保留 last_run / last_summary）
  if (freq !== 'off') {
    const nowMs = Date.now();
    for (const uid_ of validIds) {
      const existing = queryOne("SELECT id FROM report_schedules WHERE user_id = ? AND freq = ? LIMIT 1", [uid_, freq]);
      if (existing) {
        db.run(
          "UPDATE report_schedules SET hour = ?, weekday = ?, day_of_month = ?, enabled = 1, updated_at = ? WHERE id = ?",
          [hour, weekday, dayOfMonth, nowMs, existing.id]
        );
      } else {
        const id = `rs_${nowMs}_${uid_}`;
        db.run(
          "INSERT INTO report_schedules (id, user_id, freq, hour, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, '', ?, ?)",
          [id, uid_, freq, hour, weekday, dayOfMonth, nowMs, nowMs]
        );
      }
    }
    // 對於不在新清單中的舊 row（移除寄送對象 → 停用）
    const allRows = queryAll("SELECT id, user_id FROM report_schedules WHERE freq = ?", [freq]);
    for (const r of allRows) {
      if (!validIds.includes(r.user_id)) {
        db.run("UPDATE report_schedules SET enabled = 0, updated_at = ? WHERE id = ?", [nowMs, r.id]);
      }
    }
  }

  saveDB();
  res.json({ success: true, freq, hour, weekday, dayOfMonth, userIds: validIds });
});

// 005 T075: deprecated singleton run-now — 改為迴圈所有 enabled=1 schedule
app.post('/api/admin/report-schedule/run-now', adminMiddleware, async (req, res) => {
  try {
    const overrideIds = Array.isArray(req.body?.userIds) ? req.body.userIds : null;
    let candidates = [];
    if (overrideIds && overrideIds.length > 0) {
      // 取所有 enabled=1 且 user_id 在 overrideIds 中的排程
      for (const uid_ of overrideIds) {
        const rows = queryAll("SELECT id FROM report_schedules WHERE user_id = ? AND enabled = 1", [String(uid_)]);
        rows.forEach(r => candidates.push(r.id));
      }
    } else {
      const rows = queryAll("SELECT id FROM report_schedules WHERE enabled = 1");
      candidates = rows.map(r => r.id);
    }
    if (candidates.length === 0) {
      return res.json({ success: true, sent: 0, failed: 0, skipped: 0, status: 'no_schedules', reason: '無啟用排程' });
    }
    let sent = 0, failed = 0, skipped = 0;
    const failures = [];
    for (const sid of candidates) {
      const r = await runScheduledReportNow(sid, '管理員手動 (deprecated)');
      sent += r.sent || 0;
      failed += r.failed || 0;
      skipped += r.skipped || 0;
      if (r.reason) failures.push(`${sid}: ${r.reason}`);
    }
    res.json({ success: true, sent, failed, skipped, status: 'completed', failures });
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

// ─── 分類（003-categories） ───

// T013：列出分類（移除 isHidden 欄位、explicit SELECT）
app.get('/api/categories', (req, res) => {
  const rows = queryAll(
    "SELECT id, user_id, name, type, color, is_default, sort_order, parent_id FROM categories WHERE user_id = ? ORDER BY sort_order",
    [req.userId]
  );
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    color: r.color,
    isDefault: !!r.is_default,
    sortOrder: r.sort_order,
    parentId: r.parent_id || '',
  })));
});

// T014：新增分類（父：(user_id,type,name) 唯一；子：(user_id,parent_id,name) 唯一；拒絕兩層以上）
app.post('/api/categories', (req, res) => {
  const { name, type, color, parentId } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: '分類名稱不可為空' });
  if (type !== 'income' && type !== 'expense') return res.status(400).json({ error: '分類類型不正確' });
  if (!isValidColor(color)) return res.status(400).json({ error: '顏色格式不正確' });
  const pId = parentId || '';
  if (pId) {
    // 子分類路徑
    const parent = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [pId, req.userId]);
    if (!parent) return res.status(400).json({ error: '父分類不存在' });
    if (parent.parent_id !== '' && parent.parent_id !== null) {
      // FR-001：拒絕兩層以上（不可在子分類底下再新增子分類）
      return res.status(400).json({ error: '不可在子分類底下再新增子分類' });
    }
    if (parent.type !== type) return res.status(400).json({ error: '子分類類型必須與父分類相同' });
    const dup = queryOne("SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ?", [req.userId, pId, name]);
    if (dup) return res.status(400).json({ error: '同父分類下名稱不可重複' });
  } else {
    // 父分類路徑：FR-005a 唯一鍵 (user_id, type, name)
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL)",
      [req.userId, type, name]
    );
    if (dup) return res.status(400).json({ error: '同類型下父分類名稱不可重複' });
  }
  const id = uid();
  const maxOrder = queryOne("SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?", [req.userId])?.m || 0;
  db.run(
    "INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)",
    [id, req.userId, name, type, color, maxOrder + 1, pId]
  );
  saveDB();
  res.json({ id });
});

// T015：編輯分類（僅 name/color；type 變更請求 → 400；parentId/sortOrder 靜默忽略）
app.put('/api/categories/:id', (req, res) => {
  const { name, color, type } = req.body || {};
  const cat = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  if (type !== undefined && type !== null && type !== cat.type) {
    return res.status(400).json({ error: '分類類型不可變更' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: '分類名稱不可為空' });
  if (!isValidColor(color)) return res.status(400).json({ error: '顏色格式不正確' });
  const pId = cat.parent_id || '';
  if (pId === '') {
    // 父分類：FR-005a (user_id, type, name) 唯一
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL) AND id != ?",
      [req.userId, cat.type, name, req.params.id]
    );
    if (dup) return res.status(400).json({ error: '同類型下父分類名稱不可重複' });
  } else {
    // 子分類：(user_id, parent_id, name) 唯一
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ? AND id != ?",
      [req.userId, pId, name, req.params.id]
    );
    if (dup) return res.status(400).json({ error: '同父分類下名稱不可重複' });
  }
  db.run("UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?", [name, color, req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// T016：移動子分類至另一父分類（FR-014a/b/d）
app.patch('/api/categories/:id', (req, res) => {
  const { parentId: newParentId } = req.body || {};
  if (!newParentId || typeof newParentId !== 'string') {
    return res.status(400).json({ error: '請指定新的父分類 ID' });
  }
  const cat = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  if (!cat.parent_id) return res.status(400).json({ error: '父分類不可移動到其他父分類底下' });
  if (newParentId === req.params.id) return res.status(400).json({ error: '不可將分類移到自身底下' });
  const newParent = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [newParentId, req.userId]);
  if (!newParent) return res.status(400).json({ error: '新的父分類不存在' });
  if (newParent.parent_id !== '' && newParent.parent_id !== null) {
    return res.status(400).json({ error: '目標必須為父分類' });
  }
  if (newParent.type !== cat.type) return res.status(400).json({ error: '子分類類型必須與新父分類相同' });
  const dup = queryOne(
    "SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ? AND id != ?",
    [req.userId, newParentId, cat.name, req.params.id]
  );
  if (dup) return res.status(400).json({ error: '新父分類底下已有同名子分類' });
  const newOrder = (queryOne(
    "SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ? AND parent_id = ?",
    [req.userId, newParentId]
  )?.m || 0) + 1;
  db.run(
    "UPDATE categories SET parent_id = ?, sort_order = ? WHERE id = ? AND user_id = ?",
    [newParentId, newOrder, req.params.id, req.userId]
  );
  saveDB();
  res.json({ ok: true });
});

// T017：批次重排同層分類（FR-024a/b）
app.post('/api/categories/reorder', (req, res) => {
  const { scope, items } = req.body || {};
  if (typeof scope !== 'string' || !/^(parents:(expense|income)|children:.+)$/.test(scope)) {
    return res.status(400).json({ error: 'scope 不合法' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items 不可為空' });
  }
  // 取出所有 id 對應的 row 並驗證 scope 一致
  const ids = items.map(it => String(it && it.id || ''));
  if (ids.some(id => !id)) return res.status(400).json({ error: 'item.id 不可為空' });
  const placeholders = ids.map(() => '?').join(',');
  const rows = queryAll(
    `SELECT id, type, parent_id FROM categories WHERE user_id = ? AND id IN (${placeholders})`,
    [req.userId, ...ids]
  );
  if (rows.length !== ids.length) return res.status(400).json({ error: '部分分類不存在或無權限' });

  let expectedParentId, expectedType;
  if (scope.startsWith('parents:')) {
    expectedParentId = '';
    expectedType = scope === 'parents:expense' ? 'expense' : 'income';
  } else {
    expectedParentId = scope.slice('children:'.length);
    const parentRow = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [expectedParentId, req.userId]);
    if (!parentRow) return res.status(400).json({ error: '父分類不存在' });
    if (parentRow.parent_id !== '' && parentRow.parent_id !== null) {
      return res.status(400).json({ error: 'scope 對應的父分類不合法' });
    }
    expectedType = parentRow.type;
  }
  for (const r of rows) {
    if ((r.parent_id || '') !== expectedParentId) {
      return res.status(400).json({ error: '所有分類必須屬於同一 scope（不可跨層）' });
    }
    if (r.type !== expectedType) {
      return res.status(400).json({ error: '所有分類必須屬於同一 type' });
    }
  }
  db.run('BEGIN');
  try {
    for (const it of items) {
      db.run(
        "UPDATE categories SET sort_order = ? WHERE id = ? AND user_id = ?",
        [Number(it.sortOrder) || 0, String(it.id), req.userId]
      );
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch {}
    console.error('[categories/reorder]', err);
    return res.status(500).json({ error: '重排失敗' });
  }
  saveDB();
  res.json({ ok: true, updated: items.length });
});

// T026：還原預設分類（清空 deleted_defaults + 補建；非破壞性）
app.post('/api/categories/restore-defaults', (req, res) => {
  let inserted = 0;
  db.run('BEGIN');
  try {
    db.run("DELETE FROM deleted_defaults WHERE user_id = ?", [req.userId]);
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch {}
    console.error('[restore-defaults] DELETE registry failed', err);
    return res.status(500).json({ error: '還原預設分類失敗' });
  }
  try {
    inserted = backfillDefaultsForUser(req.userId);
  } catch (err) {
    console.error('[restore-defaults] backfill failed', err);
    return res.status(500).json({ error: '補建預設分類失敗' });
  }
  saveDB();
  res.json({ ok: true, restored: inserted });
});

// T025：刪除分類（連帶刪除子；對被刪除的預設分類寫入 deleted_defaults）
app.delete('/api/categories/:id', (req, res) => {
  const cat = queryOne("SELECT * FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!cat) return res.status(404).json({ error: '分類不存在' });
  // 檢查此分類底下是否有交易
  const hasTx = queryOne("SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1", [req.params.id, req.userId]);
  if (hasTx) return res.status(400).json({ error: '此分類下有交易記錄，請先移轉至其他分類' });
  const isParent = !cat.parent_id;
  const now = Date.now();
  let childRows = [];
  if (isParent) {
    childRows = queryAll("SELECT id, name, is_default FROM categories WHERE parent_id = ? AND user_id = ?", [req.params.id, req.userId]);
    for (const c of childRows) {
      const childTx = queryOne("SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1", [c.id, req.userId]);
      if (childTx) return res.status(400).json({ error: '此分類的子分類下有交易記錄，請先移轉至其他分類' });
    }
  }

  db.run('BEGIN');
  try {
    if (isParent) {
      // 父分類：先寫入子分類的 deleted_defaults（is_default=1 才寫）
      for (const c of childRows) {
        if (c.is_default) {
          const key = categoryDefaultKey(cat.type, cat.name, c.name);
          db.run(
            "INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)",
            [req.userId, key, now]
          );
        }
      }
      // 刪除子
      db.run("DELETE FROM categories WHERE parent_id = ? AND user_id = ?", [req.params.id, req.userId]);
      // 父若預設亦寫入 registry
      if (cat.is_default) {
        const key = categoryDefaultKey(cat.type, null, cat.name);
        db.run(
          "INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)",
          [req.userId, key, now]
        );
      }
      db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    } else {
      // 子分類：若預設則先寫入 registry（key 需要父分類 name）
      if (cat.is_default) {
        const parent = queryOne("SELECT name FROM categories WHERE id = ? AND user_id = ?", [cat.parent_id, req.userId]);
        if (parent) {
          const key = categoryDefaultKey(cat.type, parent.name, cat.name);
          db.run(
            "INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)",
            [req.userId, key, now]
          );
        }
      }
      db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch {}
    console.error('[categories/delete]', err);
    return res.status(500).json({ error: '刪除分類失敗' });
  }
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
    // 007 feature (T040, FR-030)：ISO 4217 白名單前置驗證
    if (!isValidCurrency(currency)) {
      return res.status(400).json({ error: '不是有效的 ISO 4217 幣別代碼', currency });
    }
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

// T110（FR-020 / FR-023 / FR-024）：GET /api/exchange-rates/:currency — 跨使用者共用快取
app.get('/api/exchange-rates/:currency', async (req, res) => {
  const currency = String(req.params.currency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'ValidationError', field: 'currency', message: '幣別需為 3 碼大寫英文' });
  }
  // 007 feature (T041, FR-030)：ISO 4217 白名單前置驗證（二次防線）
  if (!isValidCurrency(currency)) {
    return res.status(400).json({ error: '不是有效的 ISO 4217 幣別代碼', currency });
  }
  if (currency === 'TWD') {
    return res.json({ currency: 'TWD', rateToTwd: '1', fetchedAt: Date.now(), source: 'literal', cached: true });
  }
  try {
    const result = await fxCache.getRate(currency);
    res.json({
      currency,
      rateToTwd: result.rate,
      fetchedAt: result.fetchedAt || Date.now(),
      source: result.source || 'exchangerate-api',
      cached: !!result.cached,
    });
  } catch (e) {
    // fallback：嘗試從使用者既有 DB 拉值
    const map = getUserExchangeRateMap(req.userId);
    const fallback = map[currency];
    if (fallback) {
      return res.json({ currency, rateToTwd: String(fallback), fetchedAt: Date.now(), source: 'user-db', cached: true });
    }
    res.status(503).json({ error: 'RateUnavailable', message: '匯率暫不可用，請手動輸入' });
  }
});

// T111 / T112（FR-020a）：常用幣別設定
app.get('/api/user/settings/pinned-currencies', (req, res) => {
  let row = queryOne('SELECT pinned_currencies, updated_at FROM user_settings WHERE user_id = ?', [req.userId]);
  if (!row) {
    const now = Date.now();
    db.run('INSERT INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, ?, ?)', [req.userId, '["TWD"]', now]);
    saveDB();
    row = { pinned_currencies: '["TWD"]', updated_at: now };
  }
  let pinned;
  try { pinned = JSON.parse(row.pinned_currencies || '["TWD"]'); }
  catch { pinned = ['TWD']; }
  if (!Array.isArray(pinned)) pinned = ['TWD'];
  res.json({ pinnedCurrencies: pinned, updatedAt: Number(row.updated_at) || 0 });
});

app.put('/api/user/settings/pinned-currencies', (req, res) => {
  const list = req.body?.pinnedCurrencies;
  if (!Array.isArray(list) || list.length < 1 || list.length > 50) {
    return res.status(400).json({ error: 'ValidationError', field: 'pinnedCurrencies', message: '常用幣別數量需介於 1~50' });
  }
  const norm = [];
  for (const c of list) {
    const code = String(c || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return res.status(400).json({ error: 'ValidationError', field: 'pinnedCurrencies', message: `幣別格式不正確：${c}` });
    }
    if (!norm.includes(code)) norm.push(code);
  }
  if (!norm.includes('TWD')) norm.unshift('TWD');

  // 取現有 row
  let row = queryOne('SELECT pinned_currencies, updated_at FROM user_settings WHERE user_id = ?', [req.userId]);
  if (!row) {
    const now = Date.now();
    db.run('INSERT INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, ?, ?)', [req.userId, JSON.stringify(norm), now]);
    saveDB();
    return res.json({ pinnedCurrencies: norm, updatedAt: now });
  }

  // 樂觀鎖（向後相容：有 expected_updated_at 才驗）
  const expected = req.body?.expected_updated_at ?? req.body?.expectedUpdatedAt;
  if (expected != null && Number(expected) !== Number(row.updated_at)) {
    return res.status(409).json({
      error: 'OptimisticLockConflict',
      serverUpdatedAt: Number(row.updated_at),
      message: '此筆已被其他裝置修改，請重新整理後再操作',
    });
  }

  const nowMs = Date.now();
  db.run('UPDATE user_settings SET pinned_currencies = ?, updated_at = ? WHERE user_id = ?',
    [JSON.stringify(norm), nowMs, req.userId]);
  saveDB();
  res.json({ pinnedCurrencies: norm, updatedAt: nowMs });
});

// ─── 帳戶 ───
// FR-001~007（T031）：GET 回傳 category/overseasFeeRate/updatedAt 等 002 新欄位
app.get('/api/accounts', (req, res) => {
  const accounts = queryAll("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at", [req.userId]);
  // 005 T015: 預先一次撈該使用者所有 transactions 的 (account_id, type, twd_amount/amount) 以累計 twdAccumulated
  // 規則：income/transfer_in 為正、expense/transfer_out 為負；外幣帳戶 initial_balance 不納入此累計（無對應 twd_amount）。
  // 假設 transactions.type enum 僅 income/expense/transfer_in/transfer_out 四種；其他類型視為 0。
  const txRows = queryAll(
    "SELECT account_id, type, COALESCE(twd_amount, amount) as twd_amount FROM transactions WHERE user_id = ?",
    [req.userId]
  );
  const twdMap = {}; // account_id -> twdAccumulated
  for (const r of txRows) {
    const v = Number(r.twd_amount) || 0;
    if (!twdMap[r.account_id]) twdMap[r.account_id] = 0;
    if (r.type === 'income' || r.type === 'transfer_in') twdMap[r.account_id] += v;
    else if (r.type === 'expense' || r.type === 'transfer_out') twdMap[r.account_id] -= v;
  }
  const result = accounts.map(a => {
    const accountCurrency = normalizeCurrency(a.currency);
    const balance = calcBalance(a.id, a.initial_balance, req.userId, accountCurrency);
    const twdAcc = twdMap[a.id] || 0;
    // TWD 帳戶：若有 initial_balance 但無對應交易，補入 initial_balance（系統慣例多以 income 交易記錄初始餘額，故無實質落差）
    const twdAccumulated = accountCurrency === 'TWD'
      ? Math.round((twdAcc + (Number(a.initial_balance) || 0)) * 100) / 100
      : Math.round(twdAcc * 100) / 100;
    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
      twdAccumulated,
      linkedBankId: a.linked_bank_id || null,
      category: a.category || categoryFromAccountType(a.account_type),
      overseasFeeRate: a.overseas_fee_rate ?? null,
      excludeFromTotal: a.exclude_from_total === 1,
      updatedAt: Number(a.updated_at) || 0,
    };
  });
  res.json(result);
});

// 中英 enum 互轉（向後相容既有 account_type 中文值）
function categoryFromAccountType(accountType) {
  switch (accountType) {
    case '銀行': return 'bank';
    case '信用卡': return 'credit_card';
    case '虛擬錢包':
    case '虛擬': return 'virtual_wallet';
    case '現金':
    default: return 'cash';
  }
}
function accountTypeFromCategory(category) {
  switch (category) {
    case 'bank': return '銀行';
    case 'credit_card': return '信用卡';
    case 'virtual_wallet': return '虛擬錢包';
    case 'cash':
    default: return '現金';
  }
}

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

// FR-001（T030）：POST 接受 category（英）與 overseasFeeRate；保留 accountType（中）backward compat
app.post('/api/accounts', (req, res) => {
  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = req.body;
  const currency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  // 名稱基本驗證（FR-001）
  const safeName = String(name || '').trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return res.status(400).json({ error: '名稱必須為 1~64 字元', code: 'ValidationError', field: 'name' });
  }
  // 解析 category：優先吃英文 enum，fallback 從中文 accountType 推導
  const VALID_CATEGORIES = ['bank', 'credit_card', 'cash', 'virtual_wallet'];
  let category = req.body.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = categoryFromAccountType(req.body.accountType);
  }
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = excludeFromTotal ? 1 : 0;
  // overseasFeeRate（千分點整數，FR-021）：僅 credit_card 接受
  let safeOverseasFeeRate = null;
  if (category === 'credit_card' && req.body.overseasFeeRate != null) {
    const v = Number(req.body.overseasFeeRate);
    if (!Number.isFinite(v) || v < 0 || v > 1000) {
      return res.status(400).json({ error: '海外手續費率須為 0~1000（千分點）', code: 'ValidationError', field: 'overseasFeeRate' });
    }
    safeOverseasFeeRate = Math.round(v);
  }
  let safeLinkedBankId = null;
  if (category === 'credit_card' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')", [linkedBankId, req.userId]);
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }
  const id = uid();
  const nowMs = Date.now();
  // initial_balance 為幣別最小單位整數（FR-022a）；若前端尚未轉換，後端強制取整避免 REAL 殘留
  const safeInitialBalance = Math.round(Number(initialBalance) || 0);
  db.run(
    "INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, safeName, category, safeInitialBalance, currency, safeIcon, safeExclude, safeLinkedBankId, safeOverseasFeeRate, safeAccountType, todayStr(), nowMs]
  );
  saveDB();
  res.status(201).json({
    id,
    name: safeName,
    category,
    accountType: safeAccountType,
    initialBalance: safeInitialBalance,
    currency,
    icon: safeIcon,
    excludeFromTotal: safeExclude === 1,
    linkedBankId: safeLinkedBankId,
    overseasFeeRate: safeOverseasFeeRate,
    updatedAt: nowMs,
  });
});

// FR-005 / FR-014a（T033）：PUT/PATCH 接受 expectedUpdatedAt 樂觀鎖 + 幣別鎖（已有交易時禁變更 currency）
const updateAccountHandler = (req, res) => {
  // IDOR 檢查
  const existing = ownsResource('accounts', 'id', req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: '資源不存在或無權限', code: 'NotFound' });

  // 樂觀鎖：若 body 有提供 expectedUpdatedAt 才驗證（向後相容既有不帶 expected 的呼叫）
  if (req.body.expectedUpdatedAt != null || req.body.expected_updated_at != null) {
    try {
      const expected = req.body.expectedUpdatedAt ?? req.body.expected_updated_at;
      assertOptimisticLock('accounts', 'id', req.params.id, expected);
    } catch (e) {
      return sendLockError(res, e);
    }
  }

  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = req.body;
  const newCurrency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const safeName = String(name || existing.name).trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return res.status(400).json({ error: '名稱必須為 1~64 字元', code: 'ValidationError', field: 'name' });
  }
  const VALID_CATEGORIES = ['bank', 'credit_card', 'cash', 'virtual_wallet'];
  let category = req.body.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = categoryFromAccountType(req.body.accountType);
  }
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = excludeFromTotal ? 1 : 0;

  // FR-005：currency 變更時，若該帳戶已有任一交易引用，禁止變更
  if (newCurrency && newCurrency !== normalizeCurrency(existing.currency)) {
    const refCount = queryOne(
      "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
      [req.params.id, req.params.id, req.userId]
    )?.c || 0;
    if (refCount > 0) {
      return res.status(422).json({
        error: '此帳戶已有交易紀錄，無法變更幣別；如需不同幣別請新增帳戶',
        code: 'CurrencyLocked',
        referenceCount: refCount,
      });
    }
  }

  // overseasFeeRate（FR-021）
  let safeOverseasFeeRate = existing.overseas_fee_rate;
  if (req.body.overseasFeeRate != null) {
    if (category === 'credit_card') {
      const v = Number(req.body.overseasFeeRate);
      if (!Number.isFinite(v) || v < 0 || v > 1000) {
        return res.status(400).json({ error: '海外手續費率須為 0~1000（千分點）', code: 'ValidationError', field: 'overseasFeeRate' });
      }
      safeOverseasFeeRate = Math.round(v);
    } else {
      safeOverseasFeeRate = null;
    }
  }

  let safeLinkedBankId = null;
  if (category === 'credit_card' && linkedBankId) {
    const bankAcc = queryOne(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')",
      [linkedBankId, req.userId]
    );
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }

  const safeInitialBalance = Math.round(Number(initialBalance) || 0);
  const nowMs = Date.now();
  db.run(
    "UPDATE accounts SET name = ?, category = ?, initial_balance = ?, icon = ?, currency = ?, account_type = ?, exclude_from_total = ?, linked_bank_id = ?, overseas_fee_rate = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [safeName, category, safeInitialBalance, safeIcon, newCurrency, safeAccountType, safeExclude, safeLinkedBankId, safeOverseasFeeRate, nowMs, req.params.id, req.userId]
  );
  saveDB();
  res.json({ ok: true, updatedAt: nowMs });
};
app.put('/api/accounts/:id', updateAccountHandler);
// PATCH 別名（契約使用 PATCH，保留 PUT backward compat）
app.patch('/api/accounts/:id', updateAccountHandler);
// 第二別名：契約路徑 /api/accounts/:accountId（與 :id 同效）
app.patch('/api/accounts/:accountId', (req, res) => {
  req.params.id = req.params.accountId;
  return updateAccountHandler(req, res);
});

// FR-006 / FR-014a（T034）：DELETE 加 expectedUpdatedAt + 引用筆數明確回報
app.delete('/api/accounts/:id', (req, res) => {
  // IDOR
  const existing = ownsResource('accounts', 'id', req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: '資源不存在或無權限', code: 'NotFound' });

  // 樂觀鎖（向後相容：若 body / query 有提供才驗證）
  const expectedUpdatedAt = req.body?.expectedUpdatedAt ?? req.body?.expected_updated_at ?? req.query?.expected_updated_at;
  if (expectedUpdatedAt != null) {
    try {
      assertOptimisticLock('accounts', 'id', req.params.id, expectedUpdatedAt);
    } catch (e) {
      return sendLockError(res, e);
    }
  }

  const count = queryOne("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?", [req.userId])?.cnt || 0;
  if (count <= 1) return res.status(400).json({ error: '至少需保留一個帳戶' });

  // FR-006：引用檢查（含 to_account_id）
  const refCount = queryOne(
    "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
    [req.params.id, req.params.id, req.userId]
  )?.c || 0;
  if (refCount > 0) {
    return res.status(422).json({
      error: `請先處理該帳戶上的 ${refCount} 筆交易（可批次移到其他帳戶或刪除）`,
      code: 'AccountInUse',
      referenceCount: refCount,
    });
  }

  db.run("UPDATE accounts SET linked_bank_id = NULL WHERE linked_bank_id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM accounts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// FR-007（T032）：GET /api/accounts/:accountId 單筆（含 currentBalance 計算）
app.get('/api/accounts/:accountId', (req, res) => {
  const a = ownsResource('accounts', 'id', req.params.accountId, req.userId);
  if (!a) return res.status(404).json({ error: 'NotFound' });
  const accountCurrency = normalizeCurrency(a.currency);
  // FR-007：餘額僅含 date <= todayInTaipei() 的交易（未來交易不計）
  const today = taipeiTime.todayInTaipei();
  const txs = queryAll(
    "SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ? AND date <= ?",
    [a.id, req.userId, today]
  );
  let balance = Number(a.initial_balance) || 0;
  txs.forEach(t => {
    const v = Number(t.original_amount) > 0 ? Number(t.original_amount) : Number(t.amount) || 0;
    if (t.type === 'income' || t.type === 'transfer_in') balance += v;
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= v;
  });
  // 引用筆數（給前端決定是否鎖 currency 欄位）
  const referenceCount = queryOne(
    "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
    [a.id, a.id, req.userId]
  )?.c || 0;
  res.json({
    id: a.id,
    name: a.name,
    category: a.category || categoryFromAccountType(a.account_type),
    accountType: a.account_type,
    initialBalance: a.initial_balance,
    currency: accountCurrency,
    icon: normalizeAccountIcon(a.icon),
    excludeFromTotal: a.exclude_from_total === 1,
    linkedBankId: a.linked_bank_id || null,
    overseasFeeRate: a.overseas_fee_rate ?? null,
    currentBalance: Math.round(balance),
    referenceCount,
    updatedAt: Number(a.updated_at) || 0,
  });
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
// FR-050~052（T050-T052）：含 sort（5 欄位 × 2 方向 = 10 組）/ pageSize 上限 500 / 關鍵字 trim+LIKE
app.get('/api/transactions', (req, res) => {
  const { dateFrom, dateTo, type, categoryId, accountId, page } = req.query;
  // FR-050：keyword 採 trim + case-insensitive；後端 LIKE 含 %keyword%
  const keyword = String(req.query.keyword || '').trim();
  // FR-051：pageSize 上限 500（自訂值）；超過回 400 PageSizeOutOfRange
  const limit = Number.parseInt(req.query.limit, 10);
  const pageSize = Number.isFinite(limit) && limit > 0 ? limit : 20;
  if (pageSize > 500) {
    return res.status(400).json({ error: '每頁最多 500 筆', code: 'PageSizeOutOfRange' });
  }
  // FR-050：sort 解析（field × dir）；預設 date_desc
  const SORT_REGEX = /^(date|amount|account|category|type)_(asc|desc)$/;
  const sortStr = String(req.query.sort || 'date_desc').toLowerCase();
  const sortMatch = SORT_REGEX.exec(sortStr);
  if (req.query.sort && !sortMatch) {
    return res.status(400).json({ error: 'sort 參數格式無效', code: 'ValidationError', field: 'sort' });
  }
  const sortField = sortMatch ? sortMatch[1] : 'date';
  const sortDir = sortMatch && sortMatch[2] === 'asc' ? 'ASC' : 'DESC';

  // 是否需要 JOIN
  const needJoinAcc = sortField === 'account';
  const needJoinCat = sortField === 'category';
  // 004-budgets-recurring T072：恒常 LEFT JOIN recurring 取 source_recurring_name
  let baseTable = "transactions t";
  if (needJoinAcc) baseTable += " LEFT JOIN accounts acc ON acc.id = t.account_id";
  if (needJoinCat) baseTable += " LEFT JOIN categories cat ON cat.id = t.category_id";
  baseTable += " LEFT JOIN recurring r ON r.id = t.source_recurring_id AND r.user_id = t.user_id";
  const txCol = (col) => `t.${col}`;

  let where = `${txCol('user_id')} = ?`;
  const params = [req.userId];
  const today = taipeiTime.todayInTaipei();

  if (dateFrom) { where += ` AND ${txCol('date')} >= ?`; params.push(dateFrom); }
  if (dateTo) { where += ` AND ${txCol('date')} <= ?`; params.push(dateTo); }
  if (type && type !== 'all') {
    if (type === 'transfer') {
      where += ` AND (${txCol('type')} = 'transfer_out' OR ${txCol('type')} = 'transfer_in')`;
    } else if (type === 'future') {
      where += ` AND ${txCol('date')} > ?`;
      params.push(today);
    } else {
      where += ` AND ${txCol('type')} = ?`; params.push(type);
    }
  }
  if (categoryId && categoryId !== 'all') { where += ` AND ${txCol('category_id')} = ?`; params.push(categoryId); }
  if (accountId && accountId !== 'all') { where += ` AND ${txCol('account_id')} = ?`; params.push(accountId); }
  if (keyword) { where += ` AND LOWER(${txCol('note')}) LIKE LOWER(?)`; params.push(`%${keyword}%`); }

  // count（與分頁主查詢用同一 WHERE）
  const countSql = `SELECT COUNT(*) as cnt FROM ${baseTable} WHERE ${where}`;
  const total = queryOne(countSql, params)?.cnt || 0;

  // 主查詢 ORDER BY
  let orderClause;
  if (sortField === 'date') orderClause = `ORDER BY ${txCol('date')} ${sortDir}, ${txCol('created_at')} DESC`;
  else if (sortField === 'amount') orderClause = `ORDER BY ${txCol('amount')} ${sortDir}, ${txCol('date')} DESC`;
  else if (sortField === 'type') orderClause = `ORDER BY ${txCol('type')} ${sortDir}, ${txCol('date')} DESC`;
  else if (sortField === 'account') orderClause = `ORDER BY acc.name ${sortDir}, t.date DESC`;
  else if (sortField === 'category') orderClause = `ORDER BY cat.name ${sortDir}, t.date DESC`;

  const pageNum = parseInt(page) || 1;
  const offset = (pageNum - 1) * pageSize;

  // 主查詢：t.* + 來源配方名（LEFT JOIN 已在 baseTable 處理；FR-025 / FR-027）
  // U1 修補：COALESCE(NULLIF(r.note, ''), '（未命名配方）') 處理空 note 情境
  const selectCols = "t.*, COALESCE(NULLIF(r.note, ''), '（未命名配方）') AS source_recurring_name";
  const sql = `SELECT ${selectCols} FROM ${baseTable} WHERE ${where} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;
  const items = queryAll(sql, params).map(r => ({
    ...r,
    categoryId: r.category_id,
    accountId: r.account_id,
    toAccountId: r.to_account_id || null,
    currency: normalizeCurrency(r.currency),
    originalAmount: Number(r.original_amount) > 0 ? Number(r.original_amount) : Number(r.amount) || 0,
    fxRate: Number(r.fx_rate) > 0 ? Number(r.fx_rate) : 1,
    fxFee: Number(r.fx_fee) || 0,
    twdAmount: Number(r.twd_amount) || Number(r.amount) || 0,
    excludeFromStats: r.exclude_from_stats === 1,
    linkedId: r.linked_id || '',
    sourceRecurringId: r.source_recurring_id || null,
    sourceRecurringName: r.source_recurring_id ? (r.source_recurring_name || null) : null,
    scheduledDate: r.scheduled_date || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  res.json({
    data: items,           // backward compat
    items,                  // T052 新欄位
    total,
    page: pageNum,
    pageSize,               // T052 echo back
    totalPages: Math.ceil(total / pageSize),
    sort: `${sortField}_${sortDir.toLowerCase()}`,  // 排序狀態 echo（FR-052 URL 還原）
  });
});

// FR-010~018, FR-022a（T035）：POST 同步寫入 twd_amount（與 amount 對齊既有 TWD-eq 語意）
app.post('/api/transactions', (req, res) => {
  const { type, amount, date: rawDate, categoryId, accountId, note, excludeFromStats } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (!taipeiTime.isValidIsoDate(date)) return res.status(400).json({ error: '日期格式無效', code: 'ValidationError', field: 'date' });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  // 003-categories T018：leaf-only — 交易必須指派至子分類，不能直接掛在父分類底下（FR-013a）
  if (categoryId) {
    const catRow = queryOne("SELECT parent_id FROM categories WHERE id = ? AND user_id = ?", [categoryId, req.userId]);
    if (catRow && !catRow.parent_id) {
      return res.status(400).json({ error: '交易必須指派至子分類，不能直接掛在父分類底下' });
    }
  }
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  // FR-011：amount > 0 後端強制
  const numAmt = Number(req.body.originalAmount ?? amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return res.status(400).json({ error: '金額必須大於 0', code: 'ValidationError', field: 'amount' });
  }
  let converted;
  try {
    converted = convertToTwd(req.body.originalAmount ?? amount, req.body.currency, req.body.fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '金額格式錯誤' });
  }
  const fxFee = Math.max(0, Number(req.body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  // FR-022a：以 moneyDecimal 重算 twd_amount（與 totalTwd 一致；用 decimal 避免漂移）
  const twdAmountInt = moneyDecimal.computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    String(converted.fxRate || 1),
    fxFee
  );
  const id = uid();
  const now = Date.now();
  db.run(
    "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, twdAmountInt, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, now, now]
  );
  saveDB();
  res.status(201).json({ id, twdAmount: twdAmountInt, updatedAt: now });
});

// T017 (US1)：匯出交易記錄 CSV（純伺服端）— 必須註冊於 /:txId 動態路由之前
app.get('/api/transactions/export', (req, res) => {
  const dateFrom = req.query.dateFrom || '';
  const dateTo = req.query.dateTo || '';
  try {
    let where = 'WHERE t.user_id = ?';
    const params = [req.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND t.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND t.date <= ?'; params.push(dateTo); }
    const sql = `SELECT t.date, t.type, t.amount, t.note,
      c.name AS cat_name, c.parent_id AS cat_parent_id,
      pc.name AS parent_cat_name,
      a.name AS account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN accounts a ON t.account_id = a.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC`;
    const rows = queryAll(sql, params);
    const headers = ['日期', '類型', '分類', '金額', '帳戶', '備註'];
    const dataRows = rows.map(r => {
      let category = '';
      if (r.cat_name) {
        category = r.parent_cat_name ? (r.parent_cat_name + ' > ' + r.cat_name) : r.cat_name;
      }
      return [
        r.date || '',
        txTypeToChinese(r.type),
        category,
        r.amount,
        r.account_name || '',
        r.note || '',
      ];
    });
    const csv = buildCsv(headers, dataRows);
    const filename = `transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'export_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo },
    });
  } catch (e) {
    console.error('export_transactions failed', e);
    return res.status(500).json({ error: '匯出失敗', message: String(e?.message || e) });
  }
});

// FR-014a（T036）：GET /api/transactions/:txId 單筆（樂觀鎖讀取支援）
// 004-budgets-recurring T073：補 LEFT JOIN recurring 取 source_recurring_name
app.get('/api/transactions/:txId', (req, res) => {
  const t = ownsResource('transactions', 'id', req.params.txId, req.userId);
  if (!t) return res.status(404).json({ error: 'NotFound' });
  let sourceRecurringName = null;
  if (t.source_recurring_id) {
    const r = queryOne(
      "SELECT COALESCE(NULLIF(note, ''), '（未命名配方）') AS source_recurring_name FROM recurring WHERE id = ? AND user_id = ?",
      [t.source_recurring_id, req.userId]
    );
    sourceRecurringName = r ? r.source_recurring_name : null;
  }
  res.json({
    id: t.id,
    accountId: t.account_id,
    toAccountId: t.to_account_id || null,
    type: t.type,
    amount: t.amount,
    currency: normalizeCurrency(t.currency),
    originalAmount: t.original_amount,
    fxRate: t.fx_rate,
    fxFee: t.fx_fee,
    twdAmount: t.twd_amount,
    date: t.date,
    categoryId: t.category_id,
    note: t.note || '',
    excludeFromStats: t.exclude_from_stats === 1,
    linkedId: t.linked_id || '',
    sourceRecurringId: t.source_recurring_id || null,
    sourceRecurringName,
    scheduledDate: t.scheduled_date || null,
    createdAt: t.created_at,
    updatedAt: Number(t.updated_at) || 0,
  });
});

// FR-014 / FR-014a（T037）：PUT/PATCH 加 expectedUpdatedAt 樂觀鎖
const updateTransactionHandler = (req, res) => {
  // IDOR
  const existing = ownsResource('transactions', 'id', req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: '資源不存在或無權限', code: 'NotFound' });

  // 樂觀鎖（向後相容：有 expectedUpdatedAt 才驗證）
  if (req.body.expectedUpdatedAt != null || req.body.expected_updated_at != null) {
    try {
      const expected = req.body.expectedUpdatedAt ?? req.body.expected_updated_at;
      assertOptimisticLock('transactions', 'id', req.params.id, expected);
    } catch (e) {
      return sendLockError(res, e);
    }
  }

  // 禁止 transfer_* PATCH 任意欄位（spec：轉帳僅整對刪除）
  if ((existing.type === 'transfer_in' || existing.type === 'transfer_out') &&
      (req.body.type != null && req.body.type !== existing.type)) {
    return res.status(422).json({
      error: '轉帳交易僅能整對刪除，無法逐筆變更類型（請改用刪除後重建）',
      code: 'TransferImmutable',
    });
  }

  const { type, amount, date: rawDate, categoryId, accountId, note, excludeFromStats } = req.body;
  const date = normalizeDate(rawDate);
  if (!date) return res.status(400).json({ error: '日期格式無效' });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) return res.status(400).json({ error: '交易類型無效' });
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) return res.status(400).json({ error: '分類不存在或無權限' });
  // 003-categories T018：leaf-only — 交易必須指派至子分類（FR-013a）
  if (categoryId) {
    const catRow = queryOne("SELECT parent_id FROM categories WHERE id = ? AND user_id = ?", [categoryId, req.userId]);
    if (catRow && !catRow.parent_id) {
      return res.status(400).json({ error: '交易必須指派至子分類，不能直接掛在父分類底下' });
    }
  }
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });

  const numAmt = Number(req.body.originalAmount ?? amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return res.status(400).json({ error: '金額必須大於 0', code: 'ValidationError', field: 'amount' });
  }

  let converted;
  try {
    converted = convertToTwd(req.body.originalAmount ?? amount, req.body.currency, req.body.fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '金額格式錯誤' });
  }
  const fxFee = Math.max(0, Number(req.body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  const twdAmountInt = moneyDecimal.computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    String(converted.fxRate || 1),
    fxFee
  );
  const nowMs = Date.now();
  db.run(
    "UPDATE transactions SET type=?, amount=?, currency=?, original_amount=?, fx_rate=?, fx_fee=?, twd_amount=?, date=?, category_id=?, account_id=?, note=?, exclude_from_stats=?, updated_at=? WHERE id=? AND user_id=?",
    [type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, twdAmountInt, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, nowMs, req.params.id, req.userId]
  );
  saveDB();
  res.json({ ok: true, updatedAt: nowMs });
};
app.put('/api/transactions/:id', updateTransactionHandler);
app.patch('/api/transactions/:id', updateTransactionHandler);
app.patch('/api/transactions/:txId', (req, res) => {
  req.params.id = req.params.txId;
  return updateTransactionHandler(req, res);
});

// FR-014 / FR-014a（T038）：DELETE 加 expectedUpdatedAt + 轉帳連動刪除（已支援）
app.delete('/api/transactions/:id', (req, res) => {
  // IDOR
  const tx = ownsResource('transactions', 'id', req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'NotFound' });

  const expectedUpdatedAt = req.body?.expectedUpdatedAt ?? req.body?.expected_updated_at ?? req.query?.expected_updated_at;
  if (expectedUpdatedAt != null) {
    try {
      assertOptimisticLock('transactions', 'id', req.params.id, expectedUpdatedAt);
    } catch (e) {
      return sendLockError(res, e);
    }
  }

  db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (tx.linked_id) {
    db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [tx.linked_id, req.userId]);
  }
  saveDB();
  res.json({ ok: true });
});

// ─── 批次操作（T090 / T091；FR-042 / FR-043 / FR-044 / FR-045）───
const BATCH_MAX = 500;

const batchDeleteHandler = (req, res) => {
  const { ids, expected_updated_at: expectedMap } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '未選擇任何交易' });
  if (ids.length > BATCH_MAX) {
    return res.status(400).json({ error: `單次最多 ${BATCH_MAX} 筆`, code: 'BatchTooLarge' });
  }
  // 取得所有 row 並驗 ownership + 樂觀鎖
  const rows = ids.map(id => queryOne(
    "SELECT id, user_id, linked_id, updated_at FROM transactions WHERE id = ? AND user_id = ?",
    [id, req.userId]
  ));
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]) return res.status(404).json({ error: 'NotFound', missingId: ids[i] });
    if (expectedMap && expectedMap[ids[i]] != null) {
      const expected = Number(expectedMap[ids[i]]);
      if (Number(rows[i].updated_at) !== expected) {
        return res.status(409).json({
          error: 'OptimisticLockConflict',
          conflictId: ids[i],
          serverUpdatedAt: Number(rows[i].updated_at),
          message: '此筆已被其他裝置修改，請重新整理後再操作',
        });
      }
    }
  }
  // 計算所有要刪的 id（含 transfer linked 半）
  const all = new Set(ids);
  rows.forEach(r => { if (r.linked_id) all.add(r.linked_id); });
  try {
    db.run('BEGIN');
    [...all].forEach(id => db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [id, req.userId]));
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch {}
    return res.status(500).json({ error: '批次刪除失敗', message: String(e?.message || e) });
  }
  saveDB();
  res.json({ affectedIds: [...all], affectedCount: all.size, deleted: all.size });
};

const batchUpdateHandler = (req, res) => {
  const { ids, fields, patch, expected_updated_at: expectedMap } = req.body || {};
  const updateFields = patch || fields || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '未選擇任何交易' });
  if (ids.length > BATCH_MAX) {
    return res.status(400).json({ error: `單次最多 ${BATCH_MAX} 筆`, code: 'BatchTooLarge' });
  }
  if (!updateFields || Object.keys(updateFields).length === 0) return res.status(400).json({ error: '未指定更新欄位' });

  if (updateFields.categoryId && !assertOwned('categories', updateFields.categoryId, req.userId)) {
    return res.status(422).json({ error: 'CategoryForeign', message: '分類不存在或無權限' });
  }
  if (updateFields.accountId && !assertOwned('accounts', updateFields.accountId, req.userId)) {
    return res.status(422).json({ error: 'AccountForeign', message: '帳戶不存在或無權限' });
  }
  if (updateFields.date !== undefined) {
    const normalizedDate = normalizeDate(updateFields.date);
    if (!normalizedDate) return res.status(400).json({ error: '日期格式無效' });
    updateFields.date = normalizedDate;
  }

  // 預先驗 ownership + 樂觀鎖
  const rows = ids.map(id => queryOne(
    "SELECT id, user_id, updated_at FROM transactions WHERE id = ? AND user_id = ?",
    [id, req.userId]
  ));
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]) return res.status(404).json({ error: 'NotFound', missingId: ids[i] });
    if (expectedMap && expectedMap[ids[i]] != null) {
      const expected = Number(expectedMap[ids[i]]);
      if (Number(rows[i].updated_at) !== expected) {
        return res.status(409).json({
          error: 'OptimisticLockConflict',
          conflictId: ids[i],
          serverUpdatedAt: Number(rows[i].updated_at),
          message: '此筆已被其他裝置修改，請重新整理後再操作',
        });
      }
    }
  }

  const allowedFields = { categoryId: 'category_id', accountId: 'account_id', date: 'date' };
  const setClauses = [];
  const values = [];
  for (const [key, col] of Object.entries(allowedFields)) {
    if (updateFields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(updateFields[key]);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: '無有效更新欄位' });
  setClauses.push('updated_at = ?');
  const nowMs = Date.now();
  values.push(nowMs);

  try {
    db.run('BEGIN');
    ids.forEach(id => {
      db.run(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`, [...values, id, req.userId]);
    });
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch {}
    return res.status(500).json({ error: '批次更新失敗', message: String(e?.message || e) });
  }
  saveDB();
  res.json({ affectedIds: ids, affectedCount: ids.length, updated: ids.length, updatedAt: nowMs });
};

app.post('/api/transactions/batch-delete', batchDeleteHandler);
app.post('/api/transactions/batch-update', batchUpdateHandler);
// 契約路徑（colon 形式）
app.post(/^\/api\/transactions:batch-delete$/, batchDeleteHandler);
app.post(/^\/api\/transactions:batch-update$/, batchUpdateHandler);

// ═══════════════════════════════════════════════════════════════
// ─── 007 feature: 資料匯出端點群（T017、T029、T033、T034） ───
// ═══════════════════════════════════════════════════════════════

// 共用 helper：將 type 列舉轉中文
function txTypeToChinese(t) {
  if (t === 'income') return '收入';
  if (t === 'expense') return '支出';
  if (t === 'transfer_out') return '轉出';
  if (t === 'transfer_in') return '轉入';
  return t || '';
}
// 共用 helper：normalize hex color to 6 digits
function normalizeHexColor(c) {
  if (!c || typeof c !== 'string') return '';
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toUpperCase();
  }
  return c;
}

// T029 (US3)：匯出分類結構 CSV
app.get('/api/categories/export', (req, res) => {
  try {
    const cats = queryAll(
      "SELECT * FROM categories WHERE user_id = ? ORDER BY (parent_id IS NULL OR parent_id = '') DESC, sort_order ASC, name ASC",
      [req.userId]
    );
    const idMap = {};
    cats.forEach(c => { idMap[c.id] = c; });
    // 父分類在前、子分類在後（按 sort_order 排序）
    const parents = cats.filter(c => !c.parent_id);
    const children = cats.filter(c => c.parent_id);
    const headers = ['類型', '分類名稱', '上層分類', '顏色'];
    const dataRows = [];
    parents.forEach(p => {
      dataRows.push([
        p.type === 'income' ? '收入' : '支出',
        p.name || '',
        '',
        normalizeHexColor(p.color || ''),
      ]);
    });
    children.forEach(c => {
      const parent = idMap[c.parent_id];
      dataRows.push([
        c.type === 'income' ? '收入' : '支出',
        c.name || '',
        parent?.name || '',
        normalizeHexColor(c.color || ''),
      ]);
    });
    const csv = buildCsv(headers, dataRows);
    const filename = `categories-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'export_categories',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8') },
    });
  } catch (e) {
    console.error('export_categories failed', e);
    return res.status(500).json({ error: '匯出失敗', message: String(e?.message || e) });
  }
});

// T033 (US4)：匯出股票交易 CSV
app.get('/api/stock-transactions/export', (req, res) => {
  const dateFrom = req.query.dateFrom || '';
  const dateTo = req.query.dateTo || '';
  try {
    let where = 'WHERE st.user_id = ?';
    const params = [req.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND st.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND st.date <= ?'; params.push(dateTo); }
    const sql = `SELECT st.date, st.type, st.shares, st.price, st.fee, st.tax, st.note,
      s.symbol, s.name AS stock_name,
      a.name AS account_name
      FROM stock_transactions st
      JOIN stocks s ON st.stock_id = s.id
      LEFT JOIN accounts a ON st.account_id = a.id
      ${where}
      ORDER BY st.date DESC, st.created_at DESC`;
    const rows = queryAll(sql, params);
    const headers = ['日期', '股票代號', '股票名稱', '類型', '股數', '成交價', '手續費', '交易稅', '帳戶', '備註'];
    const dataRows = rows.map(r => [
      r.date || '',
      r.symbol || '',
      r.stock_name || '',
      r.type === 'buy' ? '買進' : '賣出',
      r.shares,
      r.price,
      r.fee || 0,
      r.tax || 0,
      r.account_name || '',
      r.note || '',
    ]);
    const csv = buildCsv(headers, dataRows);
    const filename = `stock-transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'export_stock_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo },
    });
  } catch (e) {
    console.error('export_stock_transactions failed', e);
    return res.status(500).json({ error: '匯出失敗', message: String(e?.message || e) });
  }
});

// T034 (US4)：匯出股票股利 CSV（含帳戶欄位反查）
app.get('/api/stock-dividends/export', (req, res) => {
  const dateFrom = req.query.dateFrom || '';
  const dateTo = req.query.dateTo || '';
  try {
    let where = 'WHERE sd.user_id = ?';
    const params = [req.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND sd.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND sd.date <= ?'; params.push(dateTo); }
    const sql = `SELECT sd.id, sd.date, sd.cash_dividend, sd.stock_dividend_shares, sd.note,
      s.symbol, s.name AS stock_name
      FROM stock_dividends sd
      JOIN stocks s ON sd.stock_id = s.id
      ${where}
      ORDER BY sd.date DESC, sd.created_at DESC`;
    const rows = queryAll(sql, params);
    // 帳戶反查：透過 transactions（同日期、現金股利金額）關聯
    const headers = ['日期', '股票代號', '股票名稱', '現金股利', '股票股利', '帳戶', '備註'];
    const dataRows = rows.map(r => {
      let accountName = '';
      const cash = Number(r.cash_dividend || 0);
      if (cash > 0) {
        // 反查：同 user / 同日期 / 收入類型 / 同金額 / 備註含「股利」或「dividend」
        const tx = queryOne(
          `SELECT a.name AS account_name FROM transactions t
           LEFT JOIN accounts a ON t.account_id = a.id
           WHERE t.user_id = ? AND t.date = ? AND t.type = 'income' AND ABS(t.amount - ?) < 0.01
             AND (t.note LIKE ? OR t.note LIKE ? OR t.note LIKE ?)
           ORDER BY t.created_at DESC LIMIT 1`,
          [req.userId, r.date, cash, '%股利%', '%dividend%', '%' + (r.symbol || '') + '%']
        );
        accountName = tx?.account_name || '';
      }
      return [
        r.date || '',
        r.symbol || '',
        r.stock_name || '',
        r.cash_dividend || 0,
        r.stock_dividend_shares || 0,
        accountName,
        r.note || '',
      ];
    });
    const csv = buildCsv(headers, dataRows);
    const filename = `stock-dividends-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'export_stock_dividends',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo },
    });
  } catch (e) {
    console.error('export_stock_dividends failed', e);
    return res.status(500).json({ error: '匯出失敗', message: String(e?.message || e) });
  }
});

// T026：匯入進度查詢端點（short polling）
app.get('/api/imports/progress', (req, res) => {
  const entry = importProgress.get(req.userId);
  if (!entry) return res.json({ active: false });
  return res.json({ active: true, ...entry });
});

// ─── 匯入 CSV（007 feature: 原子化版本 T019 ~ T027） ───
app.post('/api/transactions/import', (req, res) => {
  const { rows, autoCreate } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '無有效資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });

  // T019 (a)(b): 互斥鎖
  if (!acquireImportLock(req.userId)) {
    return res.status(409).json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' });
  }

  // T019 (c): 進度回饋
  importProgress.set(req.userId, {
    processed: 0, total: rows.length, phase: 'parsing',
    startedAt: Date.now(), completedAt: null,
  });

  const updateProgress = (processed, phase) => {
    const cur = importProgress.get(req.userId);
    if (cur) importProgress.set(req.userId, { ...cur, processed, phase });
  };

  let imported = 0;
  let skipped = 0;
  const errors = [];
  const warnings = [];
  const createdCats = [];
  const createdAccs = [];
  const unknownColumnsSet = new Set();
  const KNOWN_COLUMNS = new Set(['date', 'type', 'category', 'amount', 'account', 'note']);
  let txStarted = false;
  let failureStage = null;

  try {
    // T027: 額外欄位 silent drop 偵測
    if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
      Object.keys(rows[0]).forEach(k => {
        if (!KNOWN_COLUMNS.has(k)) unknownColumnsSet.add(k);
      });
    }
    if (unknownColumnsSet.size > 0) {
      console.log(JSON.stringify({ event: 'csv_unknown_columns', userId: req.userId, action: 'import_transactions', columns: [...unknownColumnsSet] }));
    }

    updateProgress(0, 'validating');

    // 取得既有資料
    const categories = queryAll("SELECT * FROM categories WHERE user_id = ?", [req.userId]);
    const accounts = queryAll("SELECT * FROM accounts WHERE user_id = ?", [req.userId]);
    const catMap = {};
    categories.forEach(c => {
      if (c.parent_id) {
        const parent = categories.find(p => p.id === c.parent_id);
        if (parent) catMap[parent.name + ' > ' + c.name] = c;
      }
      if (!catMap[c.name]) catMap[c.name] = c;
    });
    const accMap = {};
    accounts.forEach(a => { accMap[a.name] = a; });

    // 重複偵測：建立既有 hash set
    const existingTx = queryAll(
      "SELECT date, type, category_id, amount, account_id, note FROM transactions WHERE user_id = ?",
      [req.userId]
    );
    const existingHashes = new Set();
    existingTx.forEach(t => {
      existingHashes.add(makeTxHash(t.date, t.type, t.category_id, t.amount, t.account_id, t.note));
    });
    const batchHashes = new Set();

    // 開啟 transaction
    db.run('BEGIN');
    txStarted = true;
    failureStage = 'auto_create';

    // 第一階段：autoCreate 缺項
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
        if (dbType && category && !catMap[category]) {
          const catId = uid();
          orderCounter++;
          const color = defaultColors[colorIdx % defaultColors.length];
          colorIdx++;
          db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order) VALUES (?,?,?,?,?,0,?)",
            [catId, req.userId, category, dbType, color, orderCounter]);
          catMap[category] = { id: catId, name: category, type: dbType };
          createdCats.push(category);
        }
        if (account && !accMap[account]) {
          const accId = uid();
          db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency) VALUES (?,?,?,0,'fa-wallet','TWD')",
            [accId, req.userId, account]);
          accMap[account] = { id: accId, name: account };
          createdAccs.push(account);
        }
      });
    }

    failureStage = 'writing';
    updateProgress(0, 'writing');

    const now = Date.now();
    // 第二階段：解析 + 寫入非轉帳交易；轉帳留到第三階段配對
    // 為了 FR-012 配對演算法，需保留 row 順序資訊
    const parsedRows = []; // { idx, row, dbType, date, amt, catId, accId, note, valid, txId }
    rows.forEach((row, idx) => {
      const { date: rawDate, type, category, amount, account, note } = row;
      // T020: ISO 8601 嚴格驗證
      const date = (typeof rawDate === 'string' && isValidIso8601Date(rawDate)) ? rawDate : normalizeDate(rawDate);
      const amt = parseFloat(amount);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++;
        return;
      }
      if (!Number.isFinite(amt) || amt <= 0) {
        errors.push({ row: idx + 2, reason: '金額無效' });
        skipped++;
        return;
      }
      let dbType = 'expense';
      if (type === '收入') dbType = 'income';
      else if (type === '轉出') dbType = 'transfer_out';
      else if (type === '轉入') dbType = 'transfer_in';
      else if (type === '支出') dbType = 'expense';
      else {
        errors.push({ row: idx + 2, reason: `未知類型「${type}」` });
        skipped++;
        return;
      }
      let catId = '';
      if (dbType !== 'transfer_out' && dbType !== 'transfer_in') {
        const cat = catMap[category];
        if (cat) catId = cat.id;
      }
      let accId = '';
      const acc = accMap[account];
      if (acc) accId = acc.id;
      const noteStr = note || '';
      // T021: 六欄重複偵測
      const h = makeTxHash(date, dbType, catId, amt, accId, noteStr);
      if (existingHashes.has(h) || batchHashes.has(h)) {
        skipped++;
        return;
      }
      batchHashes.add(h);
      parsedRows.push({ idx, dbType, date, amt, catId, accId, note: noteStr });
    });

    // T022: 轉帳配對演算法（按 (date, amount) 分組、組內依 CSV 順序兩兩配對）
    updateProgress(0, 'pairing');
    const groupMap = new Map();
    parsedRows.forEach((p, i) => {
      if (p.dbType === 'transfer_out' || p.dbType === 'transfer_in') {
        const key = `${p.date}|${p.amt}`;
        if (!groupMap.has(key)) groupMap.set(key, { outs: [], ins: [] });
        const grp = groupMap.get(key);
        const txId = uid();
        p.txId = txId;
        if (p.dbType === 'transfer_out') grp.outs.push({ idx: p.idx, txId });
        else grp.ins.push({ idx: p.idx, txId });
      } else {
        p.txId = uid();
      }
    });
    const linkedIdMap = new Map(); // txId → linked_id
    groupMap.forEach((grp) => {
      const pairs = Math.min(grp.outs.length, grp.ins.length);
      for (let i = 0; i < pairs; i++) {
        linkedIdMap.set(grp.outs[i].txId, grp.ins[i].txId);
        linkedIdMap.set(grp.ins[i].txId, grp.outs[i].txId);
      }
      for (let i = pairs; i < grp.outs.length; i++) {
        warnings.push({ row: grp.outs[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉入' });
      }
      for (let i = pairs; i < grp.ins.length; i++) {
        warnings.push({ row: grp.ins[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉出' });
      }
    });

    // 寫入
    updateProgress(0, 'writing');
    parsedRows.forEach((p, i) => {
      const linked = linkedIdMap.get(p.txId) || '';
      db.run(
        "INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [p.txId, req.userId, p.dbType, p.amt, 'TWD', p.amt, 1, p.date, p.catId, p.accId, p.note, linked, now, now]
      );
      imported++;
      if ((i + 1) % 500 === 0) updateProgress(i + 1, 'writing');
    });

    failureStage = 'finalizing';
    updateProgress(parsedRows.length, 'finalizing');
    db.run('COMMIT');
    saveDB();

    // 完成 progress
    const completedEntry = importProgress.get(req.userId) || {};
    importProgress.set(req.userId, { ...completedEntry, processed: parsedRows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);

    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: {
        rows: rows.length,
        imported, skipped,
        errors: errors.length,
        warnings: warnings.length,
        unknown_columns: [...unknownColumnsSet],
      },
    });

    res.json({
      imported,
      skipped,
      errors: errors.slice(0, 50),
      warnings,
      created: { categories: createdCats, accounts: createdAccs },
      unknownColumns: [...unknownColumnsSet],
    });
  } catch (e) {
    if (txStarted) {
      try { db.run('ROLLBACK'); } catch (_) { /* noop */ }
    }
    importProgress.set(req.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'failed',
      isAdminOperation: false,
      metadata: {
        rows: rows.length,
        failure_stage: failureStage || 'unknown',
        failure_reason: String(e?.message || e).slice(0, 200),
      },
    });
    return res.status(500).json({ error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' });
  } finally {
    releaseImportLock(req.userId);
  }
});

// ─── 007 feature (T030, US3)：匯入分類結構 CSV ───
app.post('/api/categories/import', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '無有效資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });

  if (!acquireImportLock(req.userId)) {
    return res.status(409).json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' });
  }

  importProgress.set(req.userId, {
    processed: 0, total: rows.length, phase: 'parsing',
    startedAt: Date.now(), completedAt: null,
  });

  let imported = 0;
  let skipped = 0;
  const errors = [];
  let txStarted = false;
  let failureStage = null;

  try {
    failureStage = 'validating';
    // 既有分類
    const existing = queryAll("SELECT * FROM categories WHERE user_id = ?", [req.userId]);
    const existingByKey = new Map(); // (type|name) → row
    existing.forEach(c => existingByKey.set(`${c.type}|${c.name}`, c));
    // 第一輪：parents
    const parentRows = [];
    const childRows = [];
    rows.forEach((r, idx) => {
      const type = r.type === '收入' ? 'income' : (r.type === '支出' ? 'expense' : null);
      const name = (r.name || r.分類名稱 || '').toString().trim();
      const parent = (r.parent || r.上層分類 || '').toString().trim();
      const color = r.color || r.顏色 || '';
      if (!type) {
        errors.push({ row: idx + 2, reason: `未知類型「${r.type}」` });
        skipped++;
        return;
      }
      if (!name) {
        errors.push({ row: idx + 2, reason: '分類名稱為空' });
        skipped++;
        return;
      }
      if (color && !isValidHexColor(color)) {
        errors.push({ row: idx + 2, reason: '顏色格式必須為 #RRGGBB' });
        skipped++;
        return;
      }
      const item = { idx, type, name, parent, color: color || '#6366f1' };
      if (parent) childRows.push(item);
      else parentRows.push(item);
    });

    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    const maxOrder = queryOne("SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ?", [req.userId])?.m || 0;
    let orderCounter = maxOrder;

    // 寫入父分類
    parentRows.forEach((p, i) => {
      const key = `${p.type}|${p.name}`;
      if (existingByKey.has(key)) { skipped++; return; }
      const id = uid();
      orderCounter++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order) VALUES (?,?,?,?,?,0,?)",
        [id, req.userId, p.name, p.type, p.color, orderCounter]);
      existingByKey.set(key, { id, name: p.name, type: p.type, color: p.color });
      imported++;
      if ((i + 1) % 500 === 0) {
        const cur = importProgress.get(req.userId);
        if (cur) importProgress.set(req.userId, { ...cur, processed: i + 1, phase: 'writing' });
      }
    });

    // 寫入子分類
    childRows.forEach((c, i) => {
      const key = `${c.type}|${c.name}`;
      if (existingByKey.has(key)) { skipped++; return; }
      const parentKey = `${c.type}|${c.parent}`;
      const parent = existingByKey.get(parentKey);
      if (!parent) {
        errors.push({ row: c.idx + 2, reason: `找不到上層分類「${c.parent}」` });
        skipped++;
        return;
      }
      const id = uid();
      orderCounter++;
      db.run("INSERT INTO categories (id, user_id, name, type, color, parent_id, is_default, sort_order) VALUES (?,?,?,?,?,?,0,?)",
        [id, req.userId, c.name, c.type, c.color, parent.id, orderCounter]);
      existingByKey.set(key, { id, name: c.name, type: c.type, color: c.color });
      imported++;
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(req.userId) || {};
    importProgress.set(req.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);

    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_categories',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: 0 },
    });

    res.json({
      imported,
      skipped,
      errors: errors.slice(0, 50),
      warnings: [],
    });
  } catch (e) {
    if (txStarted) { try { db.run('ROLLBACK'); } catch (_) { /* noop */ } }
    importProgress.set(req.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_categories',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'failed',
      isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e?.message || e).slice(0, 200) },
    });
    return res.status(500).json({ error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' });
  } finally {
    releaseImportLock(req.userId);
  }
});

// T070（FR-015）：POST /api/transfers — 同幣別轉帳產生 transfer_out + transfer_in 對
const transferHandler = (req, res) => {
  const fromId = req.body.fromAccountId ?? req.body.fromId;
  const toId = req.body.toAccountId ?? req.body.toId;
  const { amount, date: rawDate, note } = req.body;
  if (!fromId || !toId) return res.status(400).json({ error: '缺少帳戶資訊' });
  if (fromId === toId) return res.status(400).json({ error: '轉出與轉入帳戶不可相同' });
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: '金額必須大於 0' });

  const fromAccount = queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [fromId, req.userId]);
  const toAccount = queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [toId, req.userId]);
  if (!fromAccount || !toAccount) return res.status(404).json({ error: 'NotFound' });

  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const toCurrency = normalizeCurrency(toAccount.currency);
  if (fromCurrency !== toCurrency) {
    return res.status(422).json({
      error: 'CrossCurrencyTransfer',
      message: '跨幣別請分開記一筆支出 + 一筆收入',
    });
  }

  const transferAmount = Number(amount);
  let converted;
  try {
    converted = convertToTwd(transferAmount, fromCurrency, null, req.userId);
  } catch (e) {
    return res.status(400).json({ error: e.message || '轉帳金額格式錯誤' });
  }

  const now = Date.now();
  const txDate = normalizeDate(rawDate) || todayStr();
  const txNote = note || '轉帳';
  const outId = uid();
  const inId = uid();
  try {
    db.run('BEGIN');
    db.run(
      "INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [outId, req.userId, 'transfer_out', converted.twdAmount, fromCurrency, converted.originalAmount, converted.fxRate, 0, converted.twdAmount, txDate, '', fromId, toId, txNote, inId, now, now]
    );
    db.run(
      "INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [inId, req.userId, 'transfer_in', converted.twdAmount, toCurrency, converted.originalAmount, converted.fxRate, 0, converted.twdAmount, txDate, '', toId, fromId, txNote, outId, now, now]
    );
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch {}
    return res.status(500).json({ error: '轉帳建立失敗', message: String(e?.message || e) });
  }
  saveDB();
  res.status(201).json({
    transferOut: { id: outId, accountId: fromId, toAccountId: toId, amount: converted.originalAmount, currency: fromCurrency, date: txDate, linkedId: inId, updatedAt: now },
    transferIn: { id: inId, accountId: toId, toAccountId: fromId, amount: converted.originalAmount, currency: toCurrency, date: txDate, linkedId: outId, updatedAt: now },
    ok: true,
  });
};
app.post('/api/transactions/transfer', transferHandler);
app.post('/api/transfers', transferHandler);

// ─── 預算 ───
// 004-budgets-recurring T030：used 改用 twd_amount（INTEGER）；FR-009 不做跨月聚合
app.get('/api/budgets', (req, res) => {
  const { yearMonth } = req.query;
  let sql = "SELECT * FROM budgets WHERE user_id = ?";
  const params = [req.userId];
  if (yearMonth) { sql += " AND year_month = ?"; params.push(yearMonth); }
  const rows = queryAll(sql, params);
  const result = rows.map(b => {
    const month = b.year_month;
    // FR-010：以 twd_amount（本幣 INTEGER）彙整；外幣交易已含正確 twd_amount
    let usedSql = "SELECT COALESCE(SUM(twd_amount),0) AS used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0";
    const usedParams = [req.userId, month + '%'];
    if (b.category_id) { usedSql += " AND category_id = ?"; usedParams.push(b.category_id); }
    const used = queryOne(usedSql, usedParams)?.used || 0;
    return {
      id: b.id,
      categoryId: b.category_id,
      yearMonth: b.year_month,
      amount: b.amount,
      used,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    };
  });
  res.json(result);
});

// 004-budgets-recurring T031：補正整數驗證、leaf-only、yearMonth 格式、唯一性 409
app.post('/api/budgets', (req, res) => {
  const { categoryId, amount, yearMonth } = req.body;

  // FR-003：金額必為正整數
  if (!Number.isInteger(amount) || amount < 1) {
    return res.status(400).json({ error: '預算金額必須為正整數', code: 'ValidationError', field: 'amount' });
  }
  // yearMonth 格式（FR-009a：不限月份範圍但格式須對）
  if (!yearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(yearMonth))) {
    return res.status(400).json({ error: '月份格式無效（需為 YYYY-MM）', code: 'ValidationError', field: 'yearMonth' });
  }

  const catId = categoryId || null;
  // FR-004：分類預算僅可綁子分類（leaf-only）
  if (catId) {
    const cat = queryOne("SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?", [catId, req.userId]);
    if (!cat) return res.status(400).json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' });
    if (!cat.parent_id || cat.parent_id === '') {
      return res.status(400).json({ error: '預算僅可綁定子分類；請選擇父分類下的子分類', code: 'ValidationError', field: 'categoryId' });
    }
  }

  // FR-002：同月同分類唯一性
  const existing = queryOne("SELECT id FROM budgets WHERE user_id = ? AND year_month = ? AND category_id IS ?", [req.userId, yearMonth, catId]);
  if (existing) {
    return res.status(409).json({ error: '該月份此分類已存在預算，請改為編輯既有預算', code: 'Conflict' });
  }

  const now = Date.now();
  const id = uid();
  db.run("INSERT INTO budgets (id, user_id, category_id, amount, year_month, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [id, req.userId, catId, amount, yearMonth, now, now]);
  saveDB();
  res.json({ ok: true, id });
});

// 004-budgets-recurring T032：PATCH 僅編輯金額（FR-008）
app.patch('/api/budgets/:id', (req, res) => {
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount < 1) {
    return res.status(400).json({ error: '預算金額必須為正整數', code: 'ValidationError', field: 'amount' });
  }
  const existing = queryOne("SELECT id FROM budgets WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: '預算不存在或無權限', code: 'NotFound' });
  db.run("UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [amount, Date.now(), req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 004-budgets-recurring T033：保留既有 IDOR 守則
app.delete('/api/budgets/:id', (req, res) => {
  db.run("DELETE FROM budgets WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// ─── 固定收支 ───
const VALID_RECURRING_FREQ = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const VALID_RECURRING_TYPE = new Set(['income', 'expense']);

// 004-budgets-recurring T041：GET 補 needsAttention / nextDate（FR-018 / FR-019 / FR-024a）
app.get('/api/recurring', (req, res) => {
  const rows = queryAll("SELECT * FROM recurring WHERE user_id = ? ORDER BY start_date DESC", [req.userId]);
  res.json(rows.map(r => {
    const nextDate = r.last_generated
      ? getNextRecurringDate(r.last_generated, r.frequency)
      : r.start_date;
    return {
      id: r.id,
      type: r.type,
      amount: r.amount,
      categoryId: r.category_id,
      accountId: r.account_id,
      frequency: r.frequency,
      startDate: r.start_date,
      note: r.note || '',
      isActive: !!r.is_active,
      lastGenerated: r.last_generated,
      currency: r.currency || 'TWD',
      fxRate: String(r.fx_rate != null ? r.fx_rate : '1'),
      needsAttention: !!r.needs_attention,
      nextDate,
      updatedAt: r.updated_at,
    };
  }));
});

// 004-budgets-recurring T040：POST 補正整數驗證、frequency 列舉、amount 轉本幣 INTEGER
app.post('/api/recurring', (req, res) => {
  const { type, categoryId, accountId, frequency, startDate, note } = req.body;
  let { amount, currency, fxRate } = req.body;

  if (!VALID_RECURRING_TYPE.has(type)) {
    return res.status(400).json({ error: '類型無效（需為 income 或 expense）', code: 'ValidationError', field: 'type' });
  }
  if (!VALID_RECURRING_FREQ.has(frequency)) {
    return res.status(400).json({ error: '週期無效（需為 daily / weekly / monthly / yearly）', code: 'ValidationError', field: 'frequency' });
  }
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) {
    return res.status(400).json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' });
  }
  if (accountId && !assertOwned('accounts', accountId, req.userId)) {
    return res.status(400).json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' });
  }
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart || !taipeiTime.isValidIsoDate(normalizedStart)) {
    return res.status(400).json({ error: '起始日期格式無效', code: 'ValidationError', field: 'startDate' });
  }
  currency = normalizeCurrency(currency || 'TWD');
  let converted;
  try {
    converted = convertToTwd(amount, currency, fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: String(e?.message || '金額無效'), code: 'ValidationError', field: 'amount' });
  }
  // FR-003 / FR-011：amount 寫入本幣 INTEGER；外幣 round 到整數元
  const amountTwdInt = Math.round(Number(converted.twdAmount) || 0);
  if (!(amountTwdInt >= 1)) {
    return res.status(400).json({ error: '金額必須為正整數（本幣）', code: 'ValidationError', field: 'amount' });
  }

  const now = Date.now();
  const id = uid();
  db.run(
    `INSERT INTO recurring
     (id, user_id, type, amount, category_id, account_id, frequency, start_date, note,
      is_active, last_generated, currency, fx_rate, needs_attention, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, 0, ?)`,
    [id, req.userId, type, amountTwdInt, categoryId || null, accountId || null,
     frequency, normalizedStart, note || '',
     converted.currency, String(converted.fxRate), now]
  );
  saveDB();
  res.json({ id });
});

// 004-budgets-recurring T070 / T061：PUT 加分支邏輯（FR-021a/b/c、FR-024b、FR-020 placeholder reject）
//   嚴格不對 transactions 表觸發任何 UPDATE（FR-021c 程式碼層護欄）。
app.put('/api/recurring/:id', (req, res) => {
  const { type, categoryId, accountId, frequency, startDate, note } = req.body;
  let { amount, currency, fxRate } = req.body;

  // FR-020：拒絕佔位識別字
  if (categoryId === '__deleted_category__') {
    return res.status(400).json({ error: '請先選擇有效分類', code: 'ValidationError', field: 'categoryId' });
  }
  if (accountId === '__deleted_account__') {
    return res.status(400).json({ error: '請先選擇有效帳戶', code: 'ValidationError', field: 'accountId' });
  }

  // 取舊配方
  const old = queryOne("SELECT * FROM recurring WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!old) return res.status(404).json({ error: '配方不存在或無權限', code: 'NotFound' });

  // 類型不可變（spec FR-021、Constitution-style governance）
  if (type !== undefined && type !== null && type !== old.type) {
    return res.status(400).json({ error: '類型欄位（收入／支出）建立後不可變更，需變更須刪除後重建', code: 'ValidationError', field: 'type' });
  }
  if (!VALID_RECURRING_FREQ.has(frequency)) {
    return res.status(400).json({ error: '週期無效（需為 daily / weekly / monthly / yearly）', code: 'ValidationError', field: 'frequency' });
  }
  if (categoryId && !assertOwned('categories', categoryId, req.userId)) {
    return res.status(400).json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' });
  }
  if (accountId && !assertOwned('accounts', accountId, req.userId)) {
    return res.status(400).json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' });
  }
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart || !taipeiTime.isValidIsoDate(normalizedStart)) {
    return res.status(400).json({ error: '起始日期格式無效', code: 'ValidationError', field: 'startDate' });
  }
  currency = normalizeCurrency(currency || 'TWD');
  let converted;
  try {
    converted = convertToTwd(amount, currency, fxRate, req.userId);
  } catch (e) {
    return res.status(400).json({ error: String(e?.message || '金額無效'), code: 'ValidationError', field: 'amount' });
  }
  const amountTwdInt = Math.round(Number(converted.twdAmount) || 0);
  if (!(amountTwdInt >= 1)) {
    return res.status(400).json({ error: '金額必須為正整數（本幣）', code: 'ValidationError', field: 'amount' });
  }

  // FR-021a：起始日變動則重置 last_generated；FR-021b：起始日未動則保留
  const newLastGenerated = (normalizedStart !== old.start_date) ? null : old.last_generated;

  // FR-021c 護欄：以下 SQL 嚴格只 UPDATE recurring，不觸動 transactions
  db.run(
    `UPDATE recurring
     SET amount = ?, category_id = ?, account_id = ?, frequency = ?, start_date = ?,
         note = ?, currency = ?, fx_rate = ?,
         last_generated = ?, needs_attention = 0, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [amountTwdInt, categoryId || null, accountId || null, frequency, normalizedStart,
     note || '', converted.currency, String(converted.fxRate),
     newLastGenerated, Date.now(),
     req.params.id, req.userId]
  );
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

// 004-budgets-recurring T042：重寫為共用函式 fallback 入口
app.post('/api/recurring/process', (req, res) => {
  try {
    const generated = processRecurringForUser(req.userId, { maxSync: Infinity });
    res.json({ generated });
  } catch (e) {
    console.error('[004-recurring] /process error:', e);
    res.status(500).json({ error: '產生流程失敗' });
  }
});

// 004-budgets-recurring T020：取代既有 getNextDate；FR-022 月底 / 平年回退邏輯
//   daily / weekly：簡單加日（UTC 計算避免 process 時區漂移）
//   monthly：先決定下月、再 min(原日, 該月最後一日)；不依賴 setMonth(+1) 的 overflow
//   yearly：對 2/29 做平年 → 2/28 回退
function getNextRecurringDate(prevIsoDate, freq) {
  const m = String(prevIsoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (freq === 'daily') {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'weekly') {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') {
    let nm = mo + 1, ny = y;
    if (nm > 12) { nm = 1; ny = y + 1; }
    // Date.UTC(ny, nm, 0) 的 day=0 即「上一個月（即新月）的最後一天」
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    const ny = y + 1;
    if (mo === 2 && d === 29) {
      const isLeap = (ny % 4 === 0 && ny % 100 !== 0) || (ny % 400 === 0);
      const day = isLeap ? 29 : 28;
      return `${ny}-02-${String(day).padStart(2, '0')}`;
    }
    return `${ny}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// 004-budgets-recurring T021：單一配方產生迴圈
//   (a) lazy 偵測 category_id / account_id 是否仍存在 → 不存在則 needs_attention=1 並 return 0
//   (b) 計算下一個 scheduledDate（FR-014 首產日 / FR-022 月底回退）
//   (c) INSERT 包 try/catch 捕捉 UNIQUE constraint failed（FR-028 並發冪等）
//   (d) UPDATE last_generated 條件式推進（FR-029）
//   (e) 迴圈直到 scheduledDate > todayInTaipei()
function processOneRecurring(r, userId) {
  // (a) 偵測分類 / 帳戶是否仍存在
  if (r.category_id) {
    const cat = queryOne("SELECT id FROM categories WHERE id = ? AND user_id = ?", [r.category_id, userId]);
    if (!cat) {
      db.run("UPDATE recurring SET needs_attention = 1, updated_at = ? WHERE id = ?", [Date.now(), r.id]);
      return 0;
    }
  }
  if (r.account_id) {
    const acct = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ?", [r.account_id, userId]);
    if (!acct) {
      db.run("UPDATE recurring SET needs_attention = 1, updated_at = ? WHERE id = ?", [Date.now(), r.id]);
      return 0;
    }
  }

  const todayS = taipeiTime.todayInTaipei();
  let lastGenerated = r.last_generated;
  let scheduledDate = lastGenerated ? getNextRecurringDate(lastGenerated, r.frequency) : r.start_date;
  let count = 0;

  while (scheduledDate && scheduledDate <= todayS) {
    const now = Date.now();
    const rCurrency = normalizeCurrency(r.currency || 'TWD');
    const rFxRate = String(r.fx_rate || '1');
    const rFxRateNum = Number(rFxRate) > 0 ? Number(rFxRate) : 1;
    // 外幣：amount 已是本幣（INTEGER）；original_amount 由 amount / fx_rate 反推
    const rOriginalAmount = rCurrency === 'TWD'
      ? r.amount
      : Math.round((r.amount / rFxRateNum) * 10000) / 10000;
    // FR-021c：衍生交易 twd_amount 等於 amount（配方已存本幣）
    const twdAmount = r.amount;

    try {
      db.run(
        `INSERT INTO transactions
         (id, user_id, type, amount, original_amount, currency, fx_rate, fx_fee, twd_amount,
          date, category_id, account_id, note, exclude_from_stats, linked_id,
          source_recurring_id, scheduled_date,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(), userId, r.type,
          r.amount, rOriginalAmount, rCurrency, rFxRate, 0, twdAmount,
          scheduledDate, r.category_id || null, r.account_id || null,
          (r.note || '') + ' (自動)', 0, '',
          r.id, scheduledDate,
          now, now,
        ]
      );
      // FR-029：條件式推進 last_generated
      db.run(
        "UPDATE recurring SET last_generated = ?, updated_at = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)",
        [scheduledDate, now, r.id, scheduledDate]
      );
      count++;
    } catch (e) {
      // FR-028：UNIQUE constraint failed 表示另一個並發 session 已產該日期；略過繼續
      if (/UNIQUE constraint failed/i.test(String(e?.message || e))) {
        // 仍要條件式推進 last_generated 避免死迴圈
        db.run(
          "UPDATE recurring SET last_generated = ?, updated_at = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)",
          [scheduledDate, now, r.id, scheduledDate]
        );
      } else {
        console.error('[004-recurring] INSERT failed for', r.id, scheduledDate, e);
        throw e;
      }
    }

    lastGenerated = scheduledDate;
    scheduledDate = getNextRecurringDate(lastGenerated, r.frequency);
  }

  return count;
}

// 004-budgets-recurring T022：使用者層產生流程入口
//   - 30 筆軟上限（SC-003 P95 ≤ 500ms）
//   - 超過上限以 setImmediate 推背景續跑（SC-004 不阻塞登入）
//   - try/catch 包覆每筆配方避免單筆錯誤中止整體流程
function processRecurringForUser(userId, opts = {}) {
  const maxSync = opts.maxSync != null ? opts.maxSync : 30;
  const start = Date.now();
  let generated = 0;
  let bgScheduled = false;

  const recs = queryAll(
    "SELECT * FROM recurring WHERE user_id = ? AND is_active = 1 AND needs_attention = 0",
    [userId]
  );

  for (const r of recs) {
    if (generated >= maxSync) {
      if (!bgScheduled) {
        bgScheduled = true;
        setImmediate(() => {
          try { processRecurringForUser(userId, { maxSync: Infinity }); }
          catch (e) { console.error('[004-recurring] bg resume failed for', userId, e); }
        });
      }
      break;
    }
    try {
      generated += processOneRecurring(r, userId);
    } catch (e) {
      console.error('[004-recurring] processOneRecurring failed for', r.id, e);
    }
  }

  if (generated > 0) saveDB();
  console.log(`[004-recurring] generated=${generated} elapsed=${Date.now() - start}ms userId=${userId}${bgScheduled ? ' (bg-resumed)' : ''}`);
  return generated;
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
// 005 T020/T021/T022: yearMonth 切換 + buildCategoryAggregateNodes + recent 限縮該月份
app.get('/api/dashboard', (req, res) => {
  // 驗證 yearMonth query：YYYY-MM 格式；未提供或格式錯誤 fallback 為 thisMonth()
  const ymRaw = String(req.query.yearMonth || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : thisMonth();
  const todayS = todayStr(); // todayExpense 仍以當天計算（不隨切換器變化）

  const income = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0", [req.userId, month + '%'])?.total || 0;
  const expense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0", [req.userId, month + '%'])?.total || 0;
  const todayExpense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0", [req.userId, todayS])?.total || 0;

  // 005 T021: 改餵 buildCategoryAggregateNodes 以產生包含「（其他）」虛擬節點的結構
  const catRows = queryAll(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `, [req.userId, month + '%']);
  const catBreakdown = buildCategoryAggregateNodes(catRows);

  // 005 T022: recent 限縮該月份內前 5 筆（與 KPI 同步）
  const recent = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0 AND t.date LIKE ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `, [req.userId, month + '%']);

  res.json({ yearMonth: month, income, expense, net: income - expense, todayExpense, catBreakdown, recent });
});

// ─── 報表 ───
// 005 T040/T041/T042: from > to 拒絕 + buildCategoryAggregateNodes + periodStart/periodEnd 預設化
app.get('/api/reports', (req, res) => {
  const { type } = req.query;
  let { from, to } = req.query;
  const txType = type || 'expense';

  // T040: 起始日 > 結束日 → 400 拒絕（不靜默交換）
  if (from && to && String(from) > String(to)) {
    return res.status(400).json({ error: '起始日不可晚於結束日' });
  }

  // T042: 預設化 periodStart / periodEnd（FR-009 / FR-010）
  if (!from && !to) {
    const m = thisMonth();
    from = m + '-01';
    to = thisMonthEnd(m);
  } else if (from && !to) {
    to = todayStr();
  } else if (!from && to) {
    from = String(to).slice(0, 7) + '-01';
  }

  const txs = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color, c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ? AND t.exclude_from_stats = 0
    ORDER BY t.date
  `, [req.userId, txType, from, to]);

  // 既有 catMap（向後相容）
  const catMap = {};
  txs.forEach(t => {
    const amount = Number(t.amount) || 0;
    const name = t.cat_name || '未分類';
    const color = t.cat_color || '#94a3b8';
    if (!catMap[name]) catMap[name] = { total: 0, color };
    catMap[name].total += amount;
  });

  // T041: categoryBreakdown 改為 CategoryAggregateNode[]（含「（其他）」虛擬節點）
  const categoryBreakdown = buildCategoryAggregateNodes(txs);

  const dailyMap = {};
  const monthlyMap = {};
  txs.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.amount);
    const m = t.date.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + Number(t.amount);
  });

  res.json({
    periodStart: from,
    periodEnd: to,
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
        priceSource: isRealtime ? 'realtime' : 't+1',
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
      priceSource: 'close',
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
      priceSource: 'close',
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

// 006 T044：股票查價 wrapper — FR-007 失敗類型分流（status: ok / not_found / service_unavailable）
// FR-008：前後端皆套 ASCII 1-8 字驗證
app.get('/api/stocks/quote', async (req, res) => {
  const symbol = String(req.query.symbol || '').trim();
  if (!/^[0-9A-Za-z]{1,8}$/.test(symbol)) {
    return res.status(400).json({ status: 'invalid', error: '股票代號格式不正確' });
  }
  try {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    // 1. 即時 → 2. STOCK_DAY → 3. TPEx STOCK_DAY → 4. STOCK_DAY_ALL
    let info = await fetchTwseRealtime(symbol);
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTwseStockDay(symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTpexStockDay(symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      try {
        const all = await fetchTwseStockAll();
        const stock = all.find(s => s.Code === symbol);
        if (stock) {
          info = {
            found: true,
            symbol: stock.Code,
            name: stock.Name,
            closingPrice: parseFloat(stock.ClosingPrice) || 0,
            isRealtime: false,
            priceType: stock._source === 'tpex' ? '收盤價（櫃買）' : '收盤價',
            priceSource: 'close',
          };
        }
      } catch (_) { /* fall through to not_found */ }
    }
    if (info && info.found && info.closingPrice > 0) {
      return res.json({
        status: 'ok',
        symbol: info.symbol || symbol,
        name: info.name || symbol,
        currentPrice: info.closingPrice,
        priceSource: info.priceSource || (info.isRealtime ? 'realtime' : 'close'),
        priceType: info.priceType || '',
        dataDate: info.dataDate || '',
        dataTime: info.dataTime || '',
      });
    }
    return res.json({ status: 'not_found', error: '找不到此股票代號' });
  } catch (e) {
    return res.status(503).json({ status: 'service_unavailable', error: '股價服務暫時無法回應：' + e.message });
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

// 006-stock-investments T015：以資料庫直接查詢取得截至 date 當下持有股數（含股票股利合成 buy 交易）。
function getSharesAtDate(userId, stockId, date) {
  const row = queryOne(
    "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
    [userId, stockId, date]
  );
  return row && row.shares != null ? Number(row.shares) : 0;
}

// 006-stock-investments T016：模擬「插入 / 修改」一筆交易後，掃所有 ≥ txDate 的交易並滾動計算累計持股；
// 任一時點 < 0 則回傳衝突日期；以資料庫實際交易為基準（排除 excludeTxId 模擬刪除舊紀錄）。
function validateChainConstraint(userId, stockId, txDate, txType, txShares, excludeTxId = null) {
  // 截至 txDate 的累計持股（不含被排除的紀錄）
  const baseRow = excludeTxId
    ? queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ? AND id != ?",
        [userId, stockId, txDate, excludeTxId]
      )
    : queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
        [userId, stockId, txDate]
      );
  const baseShares = baseRow && baseRow.shares != null ? Number(baseRow.shares) : 0;
  const delta = txType === 'buy' ? Number(txShares) : -Number(txShares);
  let cumulative = baseShares + delta;
  if (cumulative < 0) {
    return { ok: false, conflictDate: txDate, expectedShares: cumulative };
  }
  // 後續交易（嚴格大於 txDate；同日同 stock 多筆按 created_at 順序但已透過 baseShares 包含）
  const futureSql = excludeTxId
    ? "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? AND id != ? ORDER BY date, created_at"
    : "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? ORDER BY date, created_at";
  const futureParams = excludeTxId
    ? [userId, stockId, txDate, excludeTxId]
    : [userId, stockId, txDate];
  const future = queryAll(futureSql, futureParams);
  for (const t of future) {
    cumulative += t.type === 'buy' ? Number(t.shares) : -Number(t.shares);
    if (cumulative < 0) {
      return { ok: false, conflictDate: t.date, expectedShares: cumulative };
    }
  }
  return { ok: true };
}

// 自動同步除權息 API（006 T062/T063：支援 ?year=YYYY 單年同步；FR-027 / Pass 2 Q1）
app.post('/api/stock-dividends/sync', async (req, res) => {
  try {
    // 006 T063：?year=YYYY 拆段同步 — 限定年份範圍
    const yearParam = req.query.year ? parseInt(req.query.year, 10) : null;
    if (yearParam !== null && (!Number.isInteger(yearParam) || yearParam < 2010 || yearParam > 2099)) {
      return res.status(400).json({ error: 'year 參數必須為 2010-2099' });
    }
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
    let minYear, maxYear;
    if (yearParam !== null) {
      minYear = yearParam;
      maxYear = yearParam;
    } else {
      minYear = parseInt(today.slice(0, 4));
      maxYear = minYear;
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
    }

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
      const divId = uid();
      const divNote = `TWSE自動同步（每股$${cashPerShare}${stockPer1000 > 0 ? `, 每千股配${stockPer1000}股` : ''}）`;
      db.run(
        "INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [divId, req.userId, stock.id, div.date, cashDividend, stockDividendShares, divNote, Date.now()]
      );
      // 006 T060：股票股利配發合成 $0 buy 交易
      if (stockDividendShares > 0) {
        const synthNote = `[SYNTH] 股票股利配發 | ${divNote}`;
        db.run(
          "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [uid(), req.userId, stock.id, div.date, 'buy', stockDividendShares, 0, 0, 0, null, synthNote, Date.now(), 1]
        );
      }
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

// 006 T080~T082：抽出共用 helper（FR-020/FR-021/FR-024a）
async function processStockRecurring(userId) {
  const recs = queryAll("SELECT * FROM stock_recurring WHERE user_id = ? AND is_active = 1", [userId]);
  if (recs.length === 0) return { generated: 0, skipped: 0, postponed: 0 };
  const settings = getStockSettings(userId);
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
      // FR-022 排程順延：遇到假日或週末延後到下一個交易日
      const actualDate = nextTwseTradingDay(scheduledDate, holidaySet);
      if (actualDate > todayS) break; // 下一個交易日還沒到，下次再處理
      if (actualDate !== scheduledDate) postponed++;

      // 006 T081：每期改用「該期應觸發日的歷史股價」（FR-021）
      let price = 0;
      try {
        const stockRow = queryOne("SELECT id, symbol, current_price FROM stocks WHERE id = ? AND user_id = ?", [r.stock_id, userId]);
        if (stockRow && stockRow.symbol) {
          const ymd = String(actualDate).replace(/-/g, '');
          let info = await fetchTwseStockDay(stockRow.symbol, ymd);
          if (!info || !info.found || !(info.closingPrice > 0)) {
            info = await fetchTpexStockDay(stockRow.symbol, ymd);
          }
          if (info && info.found && info.closingPrice > 0) {
            price = info.closingPrice;
          } else {
            price = Number(stockRow.current_price || 0);
          }
        }
      } catch (e) {
        // 歷史股價查詢失敗 → 跳過該期，不阻擋後續
        console.warn(`[stock-recurring] 歷史股價查詢失敗 (${r.id}, ${actualDate}):`, e.message);
      }

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
      // 006 T082：INSERT OR IGNORE + recurring_plan_id + period_start_date 達 idempotency
      try {
        db.run(
          "INSERT OR IGNORE INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,recurring_plan_id,period_start_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [uid(), userId, r.stock_id, actualDate, 'buy', shares, price, fee, 0, r.account_id || '', finalNote, Date.now(), 1, r.id, scheduledDate]
        );
        const inserted = db.getRowsModified();
        if (inserted > 0) {
          generated++;
        } else {
          skipped++; // 已存在（多裝置 race）
        }
      } catch (e) {
        console.warn('[stock-recurring] INSERT 失敗:', e.message);
        skipped++;
      }
      // last_generated 以排程日記錄，下一期從排程日推算，維持原本週期節奏
      db.run("UPDATE stock_recurring SET last_generated = ? WHERE id = ?", [scheduledDate, r.id]);
      touched = true;
      scheduledDate = getNextDate(scheduledDate, r.frequency);
    }
  }

  if (touched) saveDB();
  return { generated, skipped, postponed };
}

app.post('/api/stock-recurring/process', async (req, res) => {
  try {
    const result = await processStockRecurring(req.userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: '排程處理失敗：' + e.message });
  }
});

// 股票清單（006 T030/T031/T032：FIFO decimal.js 全精度 + portfolioSummary + delisted/lastQuotedAt/priceSource）
app.get('/api/stocks', (req, res) => {
  const stockSettings = getStockSettings(req.userId);
  const stocks = queryAll("SELECT * FROM stocks WHERE user_id = ? ORDER BY symbol", [req.userId]);
  const result = stocks.map(s => {
    const txs = queryAll("SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at", [s.id, req.userId]);
    const divs = queryAll("SELECT * FROM stock_dividends WHERE stock_id = ? AND user_id = ? ORDER BY date DESC", [s.id, req.userId]);
    // 006 T030：使用 lib/moneyDecimal calcFifoLots 共用 helper（decimal.js 全精度）
    const fifo = moneyDecimal.calcFifoLots(txs);
    // FIFO 已將股票股利合成 $0 buy 交易納入；此處不再額外加 stock_dividend_shares 避免重複計算。
    // （baseline 直接加總是因為當時未寫合成交易；006 T060 起寫合成交易後 totalShares 自然包含配股。）
    // 為向後兼容尚未補寫合成交易的歷史股利紀錄，補加未對應合成交易的配股股數。
    const dividendSyntheticShares = txs
      .filter(t => t.type === 'buy' && Number(t.price) === 0 && typeof t.note === 'string' && /\[SYNTH\] 股票股利|股票股利配發/.test(t.note))
      .reduce((sum, t) => sum + Number(t.shares || 0), 0);
    const recordedDividendShares = divs.reduce((sum, d) => sum + Number(d.stock_dividend_shares || 0), 0);
    const missingDividendShares = Math.max(0, recordedDividendShares - dividendSyntheticShares);
    const totalShares = fifo.totalShares.plus(missingDividendShares).toNumber();
    const totalCost = fifo.totalCost.toNumber();
    const realizedPL = fifo.realizedPL.toNumber();
    // 均價（成本均價）= 成本金額 / 股數
    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    // 市值 = 現價 × 股數
    const currentPrice = Number(s.current_price || 0);
    const marketValue = totalShares * currentPrice;
    const estSellFee = calcStockFee(marketValue, totalShares, stockSettings);
    const estSellTax = calcStockTax(marketValue, s.stock_type, stockSettings);
    // 預估淨收付 = 市值 – 手續費 – 交易稅
    const estimatedNet = marketValue - estSellFee - estSellTax;
    // 預估損益 = 預估淨收付 – 成本金額
    const estimatedProfit = estimatedNet - totalCost;
    // 報酬率 = 預估損益 / 成本金額 × 100%
    const returnRate = totalCost > 0 ? (estimatedProfit / totalCost * 100) : 0;
    const totalDividend = divs.reduce((sum, d) => sum + Number(d.cash_dividend || 0), 0);
    const isDelisted = !!s.delisted;
    return {
      ...s,
      totalShares,
      avgCost: Math.round(avgCost * 100) / 100,
      totalCost: Math.round(totalCost),
      marketValue: Math.round(marketValue),
      estSellFee,
      estSellTax,
      estimatedNet: Math.round(estimatedNet),
      estimatedProfit: Math.round(estimatedProfit),
      returnRate: Math.round(returnRate * 100) / 100,
      realizedPL: Math.round(realizedPL * 100) / 100,
      totalDividend: Math.round(totalDividend),
      currentPrice,
      updatedAt: s.updated_at,
      stockType: s.stock_type,
      delisted: isDelisted,
      lastQuotedAt: s.updated_at,
      priceSource: isDelisted ? 'frozen' : null,
    };
  });
  // 006 T031：portfolioSummary（金額加權整體報酬率）
  const totalMarketValue = result.reduce((sum, x) => sum + (x.marketValue || 0), 0);
  const totalCostSum = result.reduce((sum, x) => sum + (x.totalCost || 0), 0);
  const totalPL = totalMarketValue - totalCostSum;
  const totalReturnRate = totalCostSum > 0 ? Math.round(totalPL / totalCostSum * 10000) / 100 : null;
  const portfolioSummary = {
    totalMarketValue: Math.round(totalMarketValue),
    totalCost: Math.round(totalCostSum),
    totalPL: Math.round(totalPL),
    totalReturnRate,
  };
  res.json({ stocks: result, portfolioSummary });
});

app.post('/api/stocks', (req, res) => {
  const { symbol, name, stockType } = req.body;
  if (!symbol) return res.status(400).json({ error: '股票代號為必填' });
  // 006 T042：FR-014 fallback — name 留空時使用「（未命名）」
  if (!/^[0-9A-Za-z]{1,8}$/.test(String(symbol).trim())) {
    return res.status(400).json({ error: '股票代號格式不正確（限 1-8 字 ASCII 數字 / 字母）' });
  }
  const dup = queryOne("SELECT id FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
  if (dup) return res.status(400).json({ error: '此股票代號已存在' });
  const id = uid();
  const validTypes = ['stock', 'etf', 'warrant'];
  // 006 T042：未指定 stockType 時自動推斷
  const type = validTypes.includes(stockType) ? stockType : twseFetch.inferStockType(symbol);
  const finalName = (name && String(name).trim()) || '（未命名）';
  db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?,?,?,?,0,?,?)",
    [id, req.userId, symbol, finalName, type, new Date().toISOString()]);
  saveDB();
  res.json({ id, stockType: type });
});

// 006 T042a：PUT 補強 — 修改 stockType 時觸發歷史 sell 交易稅額重算（FR-001 末段）
app.put('/api/stocks/:id', (req, res) => {
  const { name, currentPrice, stockType } = req.body;
  const s = queryOne("SELECT * FROM stocks WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!s) return res.status(404).json({ error: '股票不存在' });
  const validTypes = ['stock', 'etf', 'warrant'];
  const type = validTypes.includes(stockType) ? stockType : (s.stock_type || 'stock');
  const typeChanged = type !== s.stock_type;
  db.run("UPDATE stocks SET name = ?, current_price = ?, stock_type = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [name || s.name, currentPrice != null ? currentPrice : s.current_price, type, new Date().toISOString(), req.params.id, req.userId]);
  // 持股類型修改 → 歷史 sell 交易（tax_auto_calculated=1）依新稅率重算
  let recalculated = 0;
  if (typeChanged) {
    const settings = getStockSettings(req.userId);
    const historicalSells = queryAll(
      "SELECT id, shares, price FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'sell' AND COALESCE(tax_auto_calculated, 1) = 1",
      [req.userId, req.params.id]
    );
    historicalSells.forEach(t => {
      const amount = Number(t.shares) * Number(t.price);
      const newTax = calcStockTax(amount, type, settings);
      db.run("UPDATE stock_transactions SET tax = ? WHERE id = ?", [newTax, t.id]);
      recalculated += 1;
    });
  }
  saveDB();
  res.json({ ok: true, recalculated });
});

// 批次更新股價（006 T100：支援 updates / delisted；向後兼容 prices [{ id, currentPrice }]）
app.post('/api/stocks/batch-price', (req, res) => {
  const updates = Array.isArray(req.body.updates) ? req.body.updates
    : (Array.isArray(req.body.prices)
      ? req.body.prices.map(p => ({ stockId: p.stockId || p.id, currentPrice: p.currentPrice }))
      : null);
  if (!updates) return res.status(400).json({ error: '無效資料' });
  let updated = 0;
  const nowIso = new Date().toISOString();
  updates.forEach(u => {
    const stockId = u.stockId || u.id;
    if (!stockId) return;
    if (typeof u.delisted === 'boolean') {
      // 設定下市旗標 + 凍結價格
      db.run(
        "UPDATE stocks SET current_price = ?, delisted = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [Number(u.currentPrice) || 0, u.delisted ? 1 : 0, nowIso, stockId, req.userId]
      );
    } else {
      // 向後兼容：僅更新價格
      db.run(
        "UPDATE stocks SET current_price = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [Number(u.currentPrice) || 0, nowIso, stockId, req.userId]
      );
    }
    updated += db.getRowsModified();
  });
  saveDB();
  res.json({ ok: true, updated });
});

// 006 T111：批次查 TWSE 最新股價（read-only，不寫入 DB；前端確認後透過 /batch-price 寫入）
app.post('/api/stocks/batch-fetch', async (req, res) => {
  const stocks = queryAll("SELECT id, symbol, name FROM stocks WHERE user_id = ? AND COALESCE(delisted, 0) = 0", [req.userId]);
  if (stocks.length === 0) return res.json({ results: [] });
  const today = new Date();
  const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const fetcher = async (s) => {
    let info = await fetchTwseRealtime(s.symbol);
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTwseStockDay(s.symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTpexStockDay(s.symbol, todayYmd);
    }
    if (info && info.found && info.closingPrice > 0) {
      return {
        stockId: s.id,
        symbol: s.symbol,
        status: 'ok',
        currentPrice: info.closingPrice,
        priceSource: info.priceSource || (info.isRealtime ? 'realtime' : 'close'),
        priceType: info.priceType || '',
        fetchedAt: new Date().toISOString(),
      };
    }
    return { stockId: s.id, symbol: s.symbol, status: 'failed', error: '查詢失敗' };
  };
  try {
    const settled = await twseFetch.fetchAllWithLimit(stocks, fetcher);
    const results = settled.map(r => r.ok ? r.value : { stockId: r.item.id, symbol: r.item.symbol, status: 'failed', error: r.error });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: '批次查價失敗：' + e.message });
  }
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

// 006 T090：實現損益（彙總 + 列表）— FR-029 / FR-030 / FR-032 / Pass 4 Q1
app.get('/api/stock-realized-pl', (req, res) => {
  const stocks = queryAll("SELECT * FROM stocks WHERE user_id = ?", [req.userId]);
  const entries = [];
  stocks.forEach(s => {
    const txs = queryAll(
      "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at",
      [s.id, req.userId]
    );
    const fifo = moneyDecimal.calcFifoLots(txs);
    fifo.sellEntries.forEach(entry => {
      const t = entry.tx;
      entries.push({
        transactionId: t.id,
        sellDate: t.date,
        stockId: s.id,
        symbol: s.symbol,
        name: s.name,
        shares: Number(t.shares),
        sellPrice: Number(t.price),
        costPrice: Math.round(entry.costPerShare.toNumber() * 100) / 100,
        feeAndTax: Math.round((Number(t.fee || 0) + Number(t.tax || 0))),
        sellRevenue: Math.round(entry.sellRevenue.toNumber()),
        totalCost: Math.round(entry.totalCost.toNumber()),
        realizedPL: Math.round(entry.realizedPL.toNumber()),
        returnRate: Math.round(entry.returnRate.toNumber() * 100) / 100,
      });
    });
  });
  entries.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
  // 金額加權公式（FR-029 / Pass 2 Q4）
  const totalRealizedPL = entries.reduce((s, e) => s + e.realizedPL, 0);
  const totalCostSum = entries.reduce((s, e) => s + e.totalCost, 0);
  const overallReturnRate = totalCostSum > 0 ? Math.round(totalRealizedPL / totalCostSum * 10000) / 100 : null;
  const thisYear = String(new Date().getFullYear());
  const ytdRealizedPL = entries.filter(e => e.sellDate.startsWith(thisYear)).reduce((s, e) => s + e.realizedPL, 0);
  res.json({
    entries,
    summary: {
      totalRealizedPL,
      overallReturnRate,
      ytdRealizedPL,
      count: entries.length,
    },
  });
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

// ─── 股票交易紀錄 匯入（007 feature: T035 強化） ───
app.post('/api/stock-transactions/import', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '沒有資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });

  if (!acquireImportLock(req.userId)) {
    return res.status(409).json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' });
  }
  importProgress.set(req.userId, {
    processed: 0, total: rows.length, phase: 'parsing',
    startedAt: Date.now(), completedAt: null,
  });

  let imported = 0;
  let skipped = 0;
  const errors = [];
  const warnings = [];
  let txStarted = false;
  let failureStage = null;

  try {
    failureStage = 'validating';
    // 既有股票交易 hash set
    const existing = queryAll(
      `SELECT st.date, st.type, st.shares, st.price, st.account_id, s.symbol
       FROM stock_transactions st JOIN stocks s ON st.stock_id = s.id WHERE st.user_id = ?`,
      [req.userId]
    );
    const existingHashes = new Set();
    existing.forEach(t => {
      existingHashes.add(makeStockTxHash(t.date, t.symbol, t.type, t.shares, t.price, t.account_id));
    });
    const batchHashes = new Set();

    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    rows.forEach((row, idx) => {
      const { date: rawDate, symbol, name: stockName, type, shares, price, fee, tax, accountName, note } = row;
      if (!rawDate || !symbol || !type || !shares || !price) {
        errors.push({ row: idx + 2, reason: `略過不完整資料（${symbol || '?'}）` });
        skipped++; return;
      }
      const date = isValidIso8601Date(rawDate) ? rawDate : normalizeDate(rawDate);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++; return;
      }
      const shareNum = parseFloat(shares);
      if (!(shareNum > 0) || !Number.isInteger(shareNum)) {
        errors.push({ row: idx + 2, reason: `股數必須為正整數（${symbol}）` });
        skipped++; return;
      }
      const priceNum = parseFloat(price);
      if (!(priceNum > 0)) {
        errors.push({ row: idx + 2, reason: '成交價必須為正數' });
        skipped++; return;
      }
      // 找或建立股票
      let stock = queryOne("SELECT * FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
      if (!stock) {
        const sid = uid();
        const inferredType = twseFetch.inferStockType(symbol);
        const fallbackName = (stockName && String(stockName).trim()) || '（未命名）';
        db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [sid, req.userId, symbol, fallbackName, priceNum, inferredType, new Date().toISOString()]);
        stock = queryOne("SELECT * FROM stocks WHERE id = ?", [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        db.run("UPDATE stocks SET name = ? WHERE id = ?", [stockName, stock.id]);
      }
      // 找帳戶
      let accountId = '';
      if (accountName) {
        const acc = queryOne("SELECT id FROM accounts WHERE user_id = ? AND name = ?", [req.userId, accountName]);
        if (acc) accountId = acc.id;
      }
      const txType = (type === '買進' || type === 'buy') ? 'buy' : 'sell';
      // 重複偵測
      const h = makeStockTxHash(date, symbol, txType, shareNum, priceNum, accountId);
      if (existingHashes.has(h) || batchHashes.has(h)) { skipped++; return; }
      batchHashes.add(h);

      db.run("INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), req.userId, stock.id, txType, date, shareNum, priceNum,
         parseFloat(fee || 0), parseFloat(tax || 0), accountId, note || '', Date.now()]);
      imported++;
      if ((idx + 1) % 500 === 0) {
        const cur = importProgress.get(req.userId);
        if (cur) importProgress.set(req.userId, { ...cur, processed: idx + 1, phase: 'writing' });
      }
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(req.userId) || {};
    importProgress.set(req.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);

    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_stock_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: warnings.length },
    });

    res.json({ imported, skipped, errors: errors.slice(0, 50), warnings });
  } catch (e) {
    if (txStarted) { try { db.run('ROLLBACK'); } catch (_) { /* noop */ } }
    importProgress.set(req.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_stock_transactions',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'failed',
      isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e?.message || e).slice(0, 200) },
    });
    return res.status(500).json({ error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' });
  } finally {
    releaseImportLock(req.userId);
  }
});

// ─── 股票股利 匯入（007 feature: T036 強化） ───
app.post('/api/stock-dividends/import', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: '沒有資料' });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return res.status(413).json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` });

  if (!acquireImportLock(req.userId)) {
    return res.status(409).json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' });
  }
  importProgress.set(req.userId, {
    processed: 0, total: rows.length, phase: 'parsing',
    startedAt: Date.now(), completedAt: null,
  });

  let imported = 0;
  let skipped = 0;
  const errors = [];
  let txStarted = false;
  let failureStage = null;

  try {
    failureStage = 'validating';
    // 重複 hash set
    const existing = queryAll(
      `SELECT sd.date, sd.cash_dividend, sd.stock_dividend_shares, s.symbol
       FROM stock_dividends sd JOIN stocks s ON sd.stock_id = s.id WHERE sd.user_id = ?`,
      [req.userId]
    );
    const existingHashes = new Set();
    existing.forEach(d => {
      existingHashes.add(makeDividendHash(d.date, d.symbol, d.cash_dividend, d.stock_dividend_shares));
    });
    const batchHashes = new Set();

    // 使用者證券帳戶清單（用於純股票股利合成交易帳戶推導）
    const securityAccounts = queryAll(
      "SELECT id, name FROM accounts WHERE user_id = ? AND (account_type = 'securities' OR icon = 'fa-chart-line' OR LOWER(name) LIKE '%證券%')",
      [req.userId]
    );

    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    rows.forEach((row, idx) => {
      const { date: rawDate, symbol, name: stockName, cashDividend, stockDividend, accountName, note } = row;
      if (!rawDate || !symbol) {
        errors.push({ row: idx + 2, reason: `略過不完整資料（${symbol || '?'}）` });
        skipped++; return;
      }
      const date = isValidIso8601Date(rawDate) ? rawDate : normalizeDate(rawDate);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++; return;
      }
      const cash = parseFloat(cashDividend || 0);
      const stock_d = parseFloat(stockDividend || 0);
      if (!cash && !stock_d) {
        errors.push({ row: idx + 2, reason: `現金股利與股票股利至少填一項（${symbol} ${date}）` });
        skipped++; return;
      }
      // FR-019：現金股利 > 0 時帳戶必填
      if (cash > 0 && !accountName) {
        errors.push({ row: idx + 2, reason: '現金股利 > 0 時必填帳戶' });
        skipped++; return;
      }
      // 找或建立股票
      let stock = queryOne("SELECT * FROM stocks WHERE user_id = ? AND symbol = ?", [req.userId, symbol]);
      if (!stock) {
        const sid = uid();
        const inferredType = twseFetch.inferStockType(symbol);
        const fallbackName = (stockName && String(stockName).trim()) || '（未命名）';
        db.run("INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [sid, req.userId, symbol, fallbackName, 0, inferredType, new Date().toISOString()]);
        stock = queryOne("SELECT * FROM stocks WHERE id = ?", [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        db.run("UPDATE stocks SET name = ? WHERE id = ?", [stockName, stock.id]);
      }

      // 重複偵測
      const h = makeDividendHash(date, symbol, cash, stock_d);
      if (existingHashes.has(h) || batchHashes.has(h)) { skipped++; return; }
      batchHashes.add(h);

      // 帳戶解析
      let accountId = '';
      if (accountName) {
        const acc = queryOne("SELECT id FROM accounts WHERE user_id = ? AND name = ?", [req.userId, accountName]);
        if (acc) accountId = acc.id;
      }

      // FR-023：合成 $0 買進交易（若有股票股利）
      if (stock_d > 0) {
        let synthAccountId = accountId;
        // FR-023b：純股票股利且帳戶留空時的推導
        if (!synthAccountId) {
          // 路徑 1：該 symbol 最近一筆 buy 的 account_id
          const lastBuy = queryOne(
            "SELECT account_id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND account_id IS NOT NULL AND account_id != '' ORDER BY date DESC LIMIT 1",
            [req.userId, stock.id]
          );
          if (lastBuy && lastBuy.account_id) {
            synthAccountId = lastBuy.account_id;
          } else if (securityAccounts.length === 1) {
            // 路徑 2：唯一證券帳戶
            synthAccountId = securityAccounts[0].id;
          } else if (securityAccounts.length > 1) {
            // 多個證券帳戶且無歷史：列為錯誤
            errors.push({ row: idx + 2, reason: '純股票股利合成交易無法判定所屬帳戶，請於 CSV 帳戶欄位明示' });
            skipped++;
            return;
          }
        }
        const synthNote = '[SYNTH] 股票股利配發 ' + (note || '');
        db.run(
          "INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [uid(), req.userId, stock.id, 'buy', date, stock_d, 0, 0, 0, synthAccountId || '', synthNote, Date.now()]
        );
      }

      db.run("INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uid(), req.userId, stock.id, date, cash, stock_d, note || '', Date.now()]);
      imported++;
      if ((idx + 1) % 500 === 0) {
        const cur = importProgress.get(req.userId);
        if (cur) importProgress.set(req.userId, { ...cur, processed: idx + 1, phase: 'writing' });
      }
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(req.userId) || {};
    importProgress.set(req.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);

    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_stock_dividends',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: 0 },
    });

    res.json({ imported, skipped, errors: errors.slice(0, 50), warnings: [] });
  } catch (e) {
    if (txStarted) { try { db.run('ROLLBACK'); } catch (_) { /* noop */ } }
    importProgress.set(req.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(req.userId), 5000);
    writeOperationAudit({
      userId: req.userId,
      role: isUserAdmin(req.userId) ? 'admin' : 'user',
      action: 'import_stock_dividends',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'failed',
      isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e?.message || e).slice(0, 200) },
    });
    return res.status(500).json({ error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' });
  } finally {
    releaseImportLock(req.userId);
  }
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
  // 006 T040：賣出鏈式約束驗證（FR-013 / Pass 3 Q2）
  if (type === 'sell') {
    const sharesAt = getSharesAtDate(req.userId, stockId, date);
    if (sharesAt < Number(shares)) {
      return res.status(400).json({ error: `賣出股數不可超過 ${date} 當下持有 (${sharesAt} 股)` });
    }
    const chain = validateChainConstraint(req.userId, stockId, date, 'sell', Number(shares));
    if (!chain.ok) {
      return res.status(400).json({ error: `此交易會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` });
    }
  }
  // 006：tax_auto_calculated 由 req.body 是否顯式提供 tax 判定（顯式 = 手動覆寫）
  const taxAutoCalc = (req.body.tax === undefined || req.body.tax === null || req.body.tax === '') ? 1 : 0;
  const id = uid();
  db.run("INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', Date.now(), taxAutoCalc]);
  saveDB();
  res.json({ id });
});

// 006 T041：PUT 改為 atomic delete + insert 模擬（FR-037 / Pass 4 Q2）
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
  // 鏈式約束驗證（排除自身舊紀錄）
  if (type === 'sell') {
    const chain = validateChainConstraint(req.userId, t.stock_id, date, 'sell', Number(shares), req.params.id);
    if (!chain.ok) {
      return res.status(400).json({ error: `此修改會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` });
    }
  } else {
    // type=buy 時若交易日延後可能也產生負持股
    const chain = validateChainConstraint(req.userId, t.stock_id, date, 'buy', Number(shares), req.params.id);
    if (!chain.ok) {
      return res.status(400).json({ error: `此修改會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` });
    }
  }
  const taxAutoCalc = (req.body.tax === undefined || req.body.tax === null || req.body.tax === '') ? 1 : 0;
  db.run("BEGIN");
  try {
    db.run("UPDATE stock_transactions SET date=?, type=?, shares=?, price=?, fee=?, tax=?, account_id=?, note=?, tax_auto_calculated=? WHERE id=? AND user_id=?",
      [date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', taxAutoCalc, req.params.id, req.userId]);
    db.run("COMMIT");
  } catch (e) {
    try { db.run("ROLLBACK"); } catch (_) { /* noop */ }
    return res.status(500).json({ error: '更新交易失敗：' + e.message });
  }
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/stock-transactions/:id', (req, res) => {
  db.run("DELETE FROM stock_transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// 股票交易批次刪除（006 T057：拒絕股票股利合成交易）
app.post('/api/stock-transactions/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '請選擇要刪除的紀錄' });
  // 先檢查是否有合成股票股利交易（必須透過刪除股利紀錄連動處理）
  for (const id of ids) {
    const t = queryOne("SELECT note FROM stock_transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (t && typeof t.note === 'string' && /^\[SYNTH\] 股票股利|股票股利配發/.test(t.note)) {
      return res.status(400).json({ error: '股票股利合成交易必須透過刪除對應股利紀錄連動處理，請至「股利紀錄」頁刪除' });
    }
  }
  let deleted = 0;
  ids.forEach(id => {
    db.run("DELETE FROM stock_transactions WHERE id = ? AND user_id = ?", [id, req.userId]);
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

// 006 T060：股利新增 — 純股票股利不寫帳戶；含股票股利時同步寫入合成 $0 交易（FR-015 / FR-016）
app.post('/api/stock-dividends', (req, res) => {
  const { stockId, date: rawDate, cashDividend, stockDividendShares, accountId, note } = req.body;
  const date = normalizeDate(rawDate);
  if (!stockId || !date) return res.status(400).json({ error: '必填欄位未填' });
  const cash = Number(cashDividend) || 0;
  const stkDivShares = Number(stockDividendShares) || 0;
  if (cash < 0 || stkDivShares < 0) return res.status(400).json({ error: '股利不可為負' });
  if (cash === 0 && stkDivShares === 0) return res.status(400).json({ error: '現金股利與股票股利至少填一項' });
  const stock = queryOne("SELECT id, name FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });
  // FR-015：accountId conditional required — cash > 0 時必填，純股票股利可為 null
  if (cash > 0 && !accountId) return res.status(400).json({ error: '入款帳戶為必填（含現金股利時）' });
  if (accountId && !assertOwned('accounts', accountId, req.userId)) return res.status(400).json({ error: '帳戶不存在或無權限' });
  const id = uid();
  db.run("INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, cash, stkDivShares, accountId || null, note || '', Date.now()]);
  // 006 T060：股票股利配發合成 $0 buy 交易（FIFO 佇列維持完整）
  let synthTxId = null;
  if (stkDivShares > 0) {
    synthTxId = uid();
    const synthNote = `[SYNTH] 股票股利配發 | ${note || ''}`.trim();
    db.run(
      "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [synthTxId, req.userId, stockId, date, 'buy', stkDivShares, 0, 0, 0, null, synthNote, Date.now(), 1]
    );
  }
  // 注意：baseline 不在新增股利時自動寫入 transactions（帳戶餘額），保留此行為；
  // accountId 僅作為股利紀錄的關聯標記，使用者若需要寫入帳戶可手動新增交易。
  saveDB();
  res.json({ id, synthTxId });
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

// 006 T061：刪除股利連動處理 — 同步刪除合成 $0 交易（FR-018 / Pass 2 Q3）
app.delete('/api/stock-dividends/:id', (req, res) => {
  const old = queryOne("SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!old) return res.status(404).json({ error: '股利紀錄不存在' });
  let linkedTransactionDeleted = false;
  if (Number(old.stock_dividend_shares) > 0) {
    // 依 stock_id + date + price=0 + note 前綴匹配（容差 0.001 股）
    const targetShares = Number(old.stock_dividend_shares);
    const synth = queryAll(
      "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '%股票股利配發%')",
      [req.userId, old.stock_id, old.date]
    );
    synth.forEach(t => {
      if (Math.abs(Number(t.shares) - targetShares) < 0.001) {
        db.run("DELETE FROM stock_transactions WHERE id = ?", [t.id]);
        linkedTransactionDeleted = true;
      }
    });
  }
  db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true, linkedTransactionDeleted });
});

// 股利批次刪除（006 T076：套用 T061 連動處理）
app.post('/api/stock-dividends/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '請選擇要刪除的紀錄' });
  let deleted = 0;
  let linkedDeleted = 0;
  ids.forEach(id => {
    const old = queryOne("SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?", [id, req.userId]);
    if (!old) return;
    if (Number(old.stock_dividend_shares) > 0) {
      const targetShares = Number(old.stock_dividend_shares);
      const synth = queryAll(
        "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '%股票股利配發%')",
        [req.userId, old.stock_id, old.date]
      );
      synth.forEach(t => {
        if (Math.abs(Number(t.shares) - targetShares) < 0.001) {
          db.run("DELETE FROM stock_transactions WHERE id = ?", [t.id]);
          linkedDeleted += 1;
        }
      });
    }
    db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [id, req.userId]);
    deleted += db.getRowsModified();
  });
  saveDB();
  res.json({ deleted, linkedDeleted });
});

// ─── 資料庫匯出匯入（僅管理員，007 feature: T047 / T048 強化） ───
function makeBackupTimestamp() {
  // YYYYMMDDHHmmss
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}
function isValidBackupFilename(filename) {
  return /^(before-restore-|assetpilot-backup-)\d{14}\.db$/.test(filename);
}

app.get('/api/database/export', (req, res) => {
  if (!isUserAdmin(req.userId)) return res.status(403).json({ error: '僅管理員可執行此操作' });
  try {
    const data = db.export();
    const plain = Buffer.from(data);
    const ts = makeBackupTimestamp();
    const filename = `assetpilot-backup-${ts}.db`;
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(plain);
    writeOperationAudit({
      userId: req.userId,
      role: 'admin',
      action: 'download_backup',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'success',
      isAdminOperation: true,
      metadata: { byteSize: plain.length, filename },
    });
  } catch (e) {
    console.error('資料庫匯出失敗:', e);
    res.status(500).json({ error: '資料庫匯出失敗' });
  }
});

app.post('/api/database/import', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  if (!isUserAdmin(req.userId)) return res.status(403).json({ error: '僅管理員可執行此操作' });
  let beforeRestorePath = '';
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: '無效的資料庫檔案' });
    }
    let dbBuffer = req.body;
    if (dbBuffer.length < 16) {
      return res.status(400).json({ error: '無效的資料庫檔案' });
    }
    if (isEncryptedDB(dbBuffer)) {
      return res.status(400).json({ error: '請上傳未加密的資料庫檔案（.db）' });
    }
    const sqliteMagic = dbBuffer.subarray(0, 16).toString('ascii');
    if (!sqliteMagic.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: '檔案不是有效的 SQLite 資料庫' });
    }
    const testDb = new SQL.Database(new Uint8Array(dbBuffer));
    const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.map(r => r[0]) : [];
    // FR-025：必要表清單擴充加入 stocks
    const requiredTables = ['users', 'transactions', 'accounts', 'categories', 'stocks'];
    const missing = requiredTables.filter(t => !tableNames.includes(t));
    if (missing.length > 0) {
      testDb.close();
      return res.status(400).json({ error: `資料庫缺少必要資料表：${missing.join(', ')}` });
    }
    testDb.close();

    // FR-026：寫入 backups/before-restore-{ts}.db
    ensureBackupsDir();
    const backupTs = makeBackupTimestamp();
    beforeRestorePath = path.join(BACKUPS_DIR, `before-restore-${backupTs}.db`);
    try {
      const currentData = db.export();
      fs.writeFileSync(beforeRestorePath, Buffer.from(currentData));
    } catch (e) {
      console.error('寫入 before-restore 備份失敗:', e);
      return res.status(500).json({ error: '建立還原前備份失敗，請檢查 backups/ 目錄權限', message: String(e?.message || e) });
    }

    // FR-026a：替換主資料庫，失敗自動回滾
    let restoreOk = false;
    try {
      db.close();
      db = new SQL.Database(new Uint8Array(dbBuffer));
      saveDB();
      initDB();
      restoreOk = true;
    } catch (replaceErr) {
      console.error('替換主資料庫失敗，嘗試回滾:', replaceErr);
      try {
        const beforeBuf = fs.readFileSync(beforeRestorePath);
        db = new SQL.Database(new Uint8Array(beforeBuf));
        saveDB();
        initDB();
        writeOperationAudit({
          userId: req.userId,
          role: 'admin',
          action: 'restore_failed',
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          result: 'rolled_back',
          isAdminOperation: true,
          metadata: {
            failure_stage: 'replace_main_db',
            failure_reason: String(replaceErr?.message || replaceErr).slice(0, 200),
            before_restore_path: path.relative(__dirname, beforeRestorePath),
          },
        });
        return res.status(422).json({
          error: 'RESTORE_FAILED_ROLLED_BACK',
          message: '還原失敗，已自動回復至還原前狀態',
          beforeRestorePath: path.relative(__dirname, beforeRestorePath),
        });
      } catch (rollbackErr) {
        console.error('自動回滾失敗:', rollbackErr);
        // 雙重失敗：列出可用備份檔
        const availableBackups = (() => {
          try {
            return fs.readdirSync(BACKUPS_DIR)
              .filter(f => f.endsWith('.db'))
              .map(f => path.relative(__dirname, path.join(BACKUPS_DIR, f)));
          } catch (_) { return []; }
        })();
        writeOperationAudit({
          userId: req.userId,
          role: 'admin',
          action: 'restore_failed',
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          result: 'failed',
          isAdminOperation: true,
          metadata: {
            failure_stage: 'rollback',
            failure_reason: String(rollbackErr?.message || rollbackErr).slice(0, 200),
            before_restore_path: path.relative(__dirname, beforeRestorePath),
          },
        });
        return res.status(500).json({
          error: 'RESTORE_FAILED_DB_UNKNOWN',
          message: '主資料庫狀態未知，請聯繫管理員',
          availableBackups,
        });
      }
    }

    // FR-026b：清理超期 / 超量 before-restore 檔
    pruneBeforeRestoreBackups();

    if (restoreOk) {
      writeOperationAudit({
        userId: req.userId,
        role: 'admin',
        action: 'restore_backup',
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        result: 'success',
        isAdminOperation: true,
        metadata: {
          byteSize: dbBuffer.length,
          before_restore_path: path.relative(__dirname, beforeRestorePath),
        },
      });
      return res.json({
        ok: true,
        message: '資料庫還原成功，請重新登入',
        beforeRestorePath: path.relative(__dirname, beforeRestorePath),
      });
    }
  } catch (e) {
    console.error('資料庫匯入失敗:', e);
    writeOperationAudit({
      userId: req.userId,
      role: 'admin',
      action: 'restore_failed',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      result: 'failed',
      isAdminOperation: true,
      metadata: {
        failure_stage: 'pre_validation',
        failure_reason: String(e?.message || e).slice(0, 200),
      },
    });
    return res.status(500).json({ error: '資料庫匯入失敗：' + (e.message || '未知錯誤') });
  }
});

// ─── 007 feature (T049): 列出 backups/ 內備份檔（管理員） ───
app.get('/api/admin/backups', adminMiddleware, (req, res) => {
  ensureBackupsDir();
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fp = path.join(BACKUPS_DIR, f);
        try {
          const st = fs.statSync(fp);
          let kind = 'unknown';
          if (f.startsWith('before-restore-')) kind = 'before-restore';
          else if (f.startsWith('assetpilot-backup-')) kind = 'manual-download';
          return { filename: f, sizeBytes: st.size, mtime: new Date(st.mtimeMs).toISOString(), kind };
        } catch (_) { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    const totalSizeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    res.json({ totalSizeBytes, files });
  } catch (e) {
    console.error('list backups failed', e);
    res.status(500).json({ error: '列出備份檔失敗', message: String(e?.message || e) });
  }
});

// ─── 007 feature (T050): 手動刪除備份檔（管理員，路徑遍歷防護） ───
app.delete('/api/admin/backups/:filename', adminMiddleware, (req, res) => {
  const flat = path.basename(String(req.params.filename || ''));
  if (!isValidBackupFilename(flat)) {
    return res.status(400).json({ error: '檔名格式不合法' });
  }
  const fp = path.join(BACKUPS_DIR, flat);
  if (!fs.existsSync(fp)) {
    return res.status(404).json({ error: '備份檔不存在' });
  }
  try {
    fs.unlinkSync(fp);
    res.json({ ok: true });
  } catch (e) {
    console.error('delete backup failed', e);
    res.status(500).json({ error: '刪除失敗', message: String(e?.message || e) });
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

// 008 feature (T065)：移除既有獨立 /privacy 與 /terms handler，改由 catch-all 提供 SPA index → 前端 router 渲染 #page-privacy / #page-terms

// ─── 008 feature (T036 / FR-027 / FR-006a / FR-014 / FR-032)：catch-all 稽核偵測 ───
function detectRouteAuditEvents(req) {
  const events = [];
  const rawUrl = req.originalUrl || req.url || '';
  const normalizedPath = normalizeRoutePath(req.path);

  // T037：path traversal
  if (rawUrl.includes('..')) {
    events.push({
      action: 'static_path_traversal_blocked',
      metadata: { rawUrl, pattern: 'literal' },
    });
  } else if (/(%252e){2}/i.test(rawUrl)) {
    events.push({
      action: 'static_path_traversal_blocked',
      metadata: { rawUrl, pattern: 'double-encoded' },
    });
  } else if (/(%2e){2}/i.test(rawUrl)) {
    events.push({
      action: 'static_path_traversal_blocked',
      metadata: { rawUrl, pattern: 'percent-encoded' },
    });
  }

  // T038：open redirect on /login
  if (normalizedPath === '/login' && typeof req.query?.next === 'string' && req.query.next.length > 0) {
    const result = validateNextParamBackend(req.query.next);
    if (!result.ok) {
      events.push({
        action: 'route_open_redirect_blocked',
        metadata: { next: String(req.query.next).slice(0, 500), reason: result.reason },
      });
    }
  }

  // T047：admin-only path 偵測
  if (ADMIN_ONLY_PATHS.includes(normalizedPath)) {
    let isAdmin = false;
    let candidateUserId = '';
    const token = req.cookies?.authToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        candidateUserId = decoded?.userId || '';
        if (candidateUserId) {
          const userRow = queryOne("SELECT token_version, is_admin FROM users WHERE id = ?", [candidateUserId]);
          const dbVersion = Number(userRow?.token_version) || 0;
          const tokenVersion = Number(decoded?.tokenVersion) || 0;
          if (userRow && tokenVersion === dbVersion && userRow.is_admin) {
            isAdmin = true;
          }
        }
      } catch (_) { /* token 解析失敗視為非管理員 */ }
    }
    if (!isAdmin) {
      events.push({
        action: 'route_admin_path_blocked',
        userId: candidateUserId,
        metadata: { path: req.path || '', normalizedPath },
      });
    }
  }

  return events;
}

// ─── 前端路由 catch-all（所有非 API、非靜態檔案的請求都回傳 index.html）───
app.get('{*path}', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
  validate: { xForwardedForHeader: false }
}), (req, res) => {
  // 008 feature (T036 / FR-033)：依模式寫稽核
  try {
    const auditMode = getRouteAuditMode();
    if (auditMode !== 'minimal') {
      const events = detectRouteAuditEvents(req);
      const ip = getRequestIp(req);
      const ua = req.headers['user-agent'] || '';
      events.forEach(ev => {
        writeOperationAudit({
          userId: ev.userId || '',
          role: ev.userId ? 'user' : 'guest',
          action: ev.action,
          ipAddress: ip,
          userAgent: ua,
          result: 'failure',
          isAdminOperation: false,
          metadata: ev.metadata,
        });
      });
    }
  } catch (e) {
    try { console.warn(JSON.stringify({ event: 'catchall_audit_error', error: String(e?.message || e) })); } catch (_) { /* noop */ }
  }
  // 008 feature (T064 / FR-028)：index.html 不快取（SPA 入口）
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── 啟動 ───
initDB().then(() => {
  loadServerTimeOffset();
  ensureBackupsDir();
  registerAuditPruneJob();
  app.listen(PORT, () => {
    console.log(`AssetPilot 伺服器已啟動: http://localhost:${PORT}`);
    // T149：啟動 log 帶版本標籤，方便容器日誌追蹤上線版本
    console.log('[startup] AssetPilot v4.29.0 / feature 008-frontend-routing ready');
    console.log(`[OAuth] redirect_uri whitelist: ${GOOGLE_OAUTH_REDIRECT_URIS.length} entries`);
  });
});
