require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// ─── 自動產生密鑰（首次啟動時） ───
function generateSecret(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length];
  return result;
}

function ensureEnvSecrets() {
  const envPath = process.env.ENV_PATH || path.join(__dirname, '.env');
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
    fs.writeFileSync(envPath, lines.filter(l => l !== '').join('\n') + '\n', 'utf-8');
    console.log(`密鑰已寫入 ${envPath}，請妥善備份此檔案`);
  }
}

ensureEnvSecrets();

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

app.use(cors(ALLOWED_ORIGINS ? {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS 不允許的來源'));
  }
} : {}));

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,   // 因使用外部 CDN + inline handlers，暫不啟用 CSP
  crossOriginEmbedderPolicy: false
}));

// 登入/註冊 API 速率限制（每 IP 每 15 分鐘最多 20 次）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登入嘗試次數過多，請 15 分鐘後再試' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

let db;

// ─── 登入失敗追蹤 ───
const loginAttempts = {};

// ─── 初始化資料庫 ───
async function initDB() {
  const SQL = await initSqlJs();

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
    icon TEXT DEFAULT 'fa-wallet',
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category_id TEXT,
    account_id TEXT,
    note TEXT DEFAULT '',
    linked_id TEXT DEFAULT '',
    created_at INTEGER,
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
    // 將已有帳號但非 Google-only 的使用者設為 has_password=1
    db.run("UPDATE users SET has_password = 1 WHERE password_hash != '' AND (google_id = '' OR google_id IS NULL)");
    // 同時有密碼登入+Google的也算有密碼（透過註冊的帳號後來綁了 Google）
    db.run("UPDATE users SET has_password = 1 WHERE password_hash != '' AND google_id != '' AND has_password = 0");
    saveDB();
  } catch (e) { /* 欄位已存在則忽略 */ }

  // 資料庫升級：為 categories 加入 parent_id 欄位
  try {
    db.run("ALTER TABLE categories ADD COLUMN parent_id TEXT DEFAULT ''");
  } catch (e) { /* 欄位已存在則忽略 */ }

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

  saveDB();
  console.log('資料庫初始化完成');
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
  db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, created_at) VALUES (?,?,?,0,'fa-wallet',?)",
    [uid(), userId, '現金', todayStr()]);
}

function saveDB() {
  const data = db.export();
  const plain = Buffer.from(data);
  if (DB_ENCRYPTION_KEY) {
    const encrypted = encryptBuffer(plain, DB_ENCRYPTION_KEY);
    fs.writeFileSync(DB_PATH, encrypted);
  } else {
    fs.writeFileSync(DB_PATH, plain);
  }
}

function isValidColor(c) { return !c || /^#[0-9a-fA-F]{3,8}$/.test(c); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

// ═══════════════════════════════════════
// Auth Middleware
// ═══════════════════════════════════════

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '請先登入' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: '登入已過期，請重新登入' });
  }
}

// ═══════════════════════════════════════
// Auth API（不需要驗證）
// ═══════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: '請填寫所有欄位' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '電子郵件格式不正確' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '密碼長度至少 8 字元' });
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: '密碼需包含英文字母與數字' });
  }
  const existing = queryOne("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
  if (existing) {
    return res.status(400).json({ error: '此電子郵件已被註冊' });
  }

  const id = uid();
  const passwordHash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (id, email, password_hash, display_name, has_password, created_at) VALUES (?,?,?,?,1,?)",
    [id, email.toLowerCase(), passwordHash, displayName, todayStr()]);

  createDefaultsForUser(id);
  saveDB();

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id, email: email.toLowerCase(), displayName } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '請填寫電子郵件與密碼' });
  }

  const emailLower = email.toLowerCase();

  // 檢查是否鎖定
  const attempt = loginAttempts[emailLower];
  if (attempt && attempt.count >= 5 && Date.now() - attempt.lastAttempt < 30 * 60 * 1000) {
    const remaining = Math.ceil((30 * 60 * 1000 - (Date.now() - attempt.lastAttempt)) / 60000);
    return res.status(429).json({ error: `登入失敗次數過多，請 ${remaining} 分鐘後再試` });
  }

  const user = queryOne("SELECT * FROM users WHERE email = ?", [emailLower]);
  if (!user) {
    trackFailedLogin(emailLower);
    return res.status(401).json({ error: '電子郵件或密碼錯誤' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    trackFailedLogin(emailLower);
    return res.status(401).json({ error: '電子郵件或密碼錯誤' });
  }

  // 登入成功，清除失敗記錄
  delete loginAttempts[emailLower];

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
});

function trackFailedLogin(email) {
  if (!loginAttempts[email]) loginAttempts[email] = { count: 0, lastAttempt: 0 };
  loginAttempts[email].count++;
  loginAttempts[email].lastAttempt = Date.now();
}


// 前端取得公開設定（Google Client ID 等）
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// 版本更新資訊（公開，不需認證）
app.get('/api/changelog', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'changelog.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json({ currentVersion: '0.0', releases: [] });
  }
});

// Google SSO 登入
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: '缺少 Google 憑證' });
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google SSO 未設定' });

  try {
    // 透過 Google tokeninfo 端點驗證 ID Token
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) return res.status(401).json({ error: 'Google 憑證驗證失敗' });
    const payload = await verifyRes.json();

    // 驗證 audience 是否為我們的 Client ID
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google 憑證 audience 不符' });
    }

    const email = payload.email?.toLowerCase();
    const name = payload.name || payload.email?.split('@')[0] || 'Google User';
    const googleId = payload.sub;

    if (!email) return res.status(400).json({ error: '無法取得 Google 帳號 Email' });

    // 查找或建立使用者（優先用 google_id 查找，再用 email）
    let user = queryOne("SELECT * FROM users WHERE google_id = ?", [googleId]);
    if (!user) user = queryOne("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      // 自動註冊：Google 使用者不需要密碼，設一組隨機 hash
      const id = uid();
      const randomHash = await bcrypt.hash(uid() + Date.now(), 10);
      db.run("INSERT INTO users (id, email, password_hash, display_name, google_id, created_at) VALUES (?,?,?,?,?,?)",
        [id, email, randomHash, name, googleId, todayStr()]);
      createDefaultsForUser(id);
      saveDB();
      user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
    } else if (!user.google_id) {
      // 既有帳號首次用 Google 登入，自動綁定
      db.run("UPDATE users SET google_id = ? WHERE id = ?", [googleId, user.id]);
      saveDB();
    }

    // 發行 JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, googleLinked: true } });
  } catch (e) {
    console.error('Google SSO 錯誤:', e.message);
    res.status(500).json({ error: 'Google 登入失敗：' + e.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = queryOne("SELECT id, email, display_name, google_id, has_password FROM users WHERE id = ?", [req.userId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  res.json({ user: { id: user.id, email: user.email, displayName: user.display_name, googleLinked: !!user.google_id, hasPassword: !!user.has_password } });
});

// ═══════════════════════════════════════
// 以下所有 API 路由需要驗證
// ═══════════════════════════════════════
app.use('/api', authMiddleware);

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

    // 檢查此 Google 帳號是否已被其他使用者綁定
    const existing = queryOne("SELECT id FROM users WHERE google_id = ? AND id != ?", [googleId, req.userId]);
    if (existing) return res.status(400).json({ error: '此 Google 帳號已被其他使用者綁定' });

    db.run("UPDATE users SET google_id = ? WHERE id = ?", [googleId, req.userId]);
    saveDB();
    res.json({ success: true, googleEmail });
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

// 刪除帳號（永久刪除所有資料）
app.post('/api/account/delete', async (req, res) => {
  const { password } = req.body;
  const user = queryOne("SELECT * FROM users WHERE id = ?", [req.userId]);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  // 有密碼的帳號需驗證密碼；Google-only 帳號靠前端二次確認
  if (user.has_password) {
    if (!password) return res.status(400).json({ error: '請輸入密碼以確認刪除' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: '密碼錯誤，請重新輸入' });
  }

  // 刪除使用者所有資料
  const tables = [
    'stock_dividends', 'stock_transactions', 'stocks',
    'transactions', 'budgets', 'recurring', 'accounts', 'categories'
  ];
  tables.forEach(t => {
    db.run(`DELETE FROM ${t} WHERE user_id = ?`, [req.userId]);
  });
  db.run("DELETE FROM users WHERE id = ?", [req.userId]);
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
  db.run("DELETE FROM categories WHERE id = ? AND user_id = ? AND is_default = 0", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// ─── 帳戶 ───
app.get('/api/accounts', (req, res) => {
  const accounts = queryAll("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at", [req.userId]);
  const result = accounts.map(a => {
    const balance = calcBalance(a.id, a.initial_balance, req.userId);
    return { ...a, initialBalance: a.initial_balance, balance };
  });
  res.json(result);
});

function calcBalance(accId, initialBalance, userId) {
  let balance = Number(initialBalance) || 0;
  const txs = queryAll("SELECT type, amount FROM transactions WHERE account_id = ? AND user_id = ?", [accId, userId]);
  txs.forEach(t => {
    if (t.type === 'income' || t.type === 'transfer_in') balance += Number(t.amount);
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= Number(t.amount);
  });
  return balance;
}

app.post('/api/accounts', (req, res) => {
  const { name, initialBalance, icon } = req.body;
  const id = uid();
  db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, created_at) VALUES (?,?,?,?,?,?)",
    [id, req.userId, name, initialBalance || 0, icon || 'fa-wallet', todayStr()]);
  saveDB();
  res.json({ id });
});

app.put('/api/accounts/:id', (req, res) => {
  const { name, initialBalance, icon } = req.body;
  db.run("UPDATE accounts SET name = ?, initial_balance = ?, icon = ? WHERE id = ? AND user_id = ?",
    [name, initialBalance || 0, icon || 'fa-wallet', req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  const count = queryOne("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?", [req.userId])?.cnt || 0;
  if (count <= 1) return res.status(400).json({ error: '至少需保留一個帳戶' });
  const hasTx = queryOne("SELECT id FROM transactions WHERE account_id = ? AND user_id = ? LIMIT 1", [req.params.id, req.userId]);
  if (hasTx) return res.status(400).json({ error: '此帳戶下有交易記錄，請先移轉至其他帳戶' });
  db.run("DELETE FROM accounts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});

// ─── 交易記錄 ───
app.get('/api/transactions', (req, res) => {
  const { dateFrom, dateTo, type, categoryId, accountId, keyword, page, limit } = req.query;
  let sql = "SELECT * FROM transactions WHERE user_id = ?";
  const params = [req.userId];

  if (dateFrom) { sql += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { sql += " AND date <= ?"; params.push(dateTo); }
  if (type && type !== 'all') {
    if (type === 'transfer') {
      sql += " AND (type = 'transfer_out' OR type = 'transfer_in')";
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
    data: rows.map(r => ({ ...r, categoryId: r.category_id, accountId: r.account_id, createdAt: r.created_at, updatedAt: r.updated_at })),
    total, page: pageNum, totalPages: Math.ceil(total / pageSize),
  });
});

app.post('/api/transactions', (req, res) => {
  const { type, amount, date, categoryId, accountId, note } = req.body;
  if (amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  if (date > todayStr()) return res.status(400).json({ error: '日期不可為未來日期' });
  const id = uid();
  const now = Date.now();
  db.run("INSERT INTO transactions (id, user_id, type, amount, date, category_id, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, type, amount, date, categoryId, accountId, note || '', now, now]);
  saveDB();
  res.json({ id });
});

app.put('/api/transactions/:id', (req, res) => {
  const { type, amount, date, categoryId, accountId, note } = req.body;
  if (amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  if (date > todayStr()) return res.status(400).json({ error: '日期不可為未來日期' });
  db.run("UPDATE transactions SET type=?, amount=?, date=?, category_id=?, account_id=?, note=?, updated_at=? WHERE id=? AND user_id=?",
    [type, amount, date, categoryId, accountId, note || '', Date.now(), req.params.id, req.userId]);
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
        db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon) VALUES (?,?,?,0,'fa-wallet')",
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
    const { date, type, category, amount, account, note } = row;
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
      db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [txId, req.userId, dbType, amt, date, catId, accId, note || '', '', now, now]);
      pendingTransferOut.push({ id: txId, date, amount: amt, note: note || '' });
      imported++;
    } else if (dbType === 'transfer_in') {
      // 嘗試配對一筆同日期、同金額的轉出
      const matchIdx = pendingTransferOut.findIndex(p => p.date === date && p.amount === amt);
      if (matchIdx !== -1) {
        const matched = pendingTransferOut.splice(matchIdx, 1)[0];
        db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [txId, req.userId, dbType, amt, date, catId, accId, note || '', matched.id, now, now]);
        // 回填轉出的 linked_id
        db.run("UPDATE transactions SET linked_id = ? WHERE id = ?", [txId, matched.id]);
      } else {
        db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [txId, req.userId, dbType, amt, date, catId, accId, note || '', '', now, now]);
      }
      imported++;
    } else {
      db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [txId, req.userId, dbType, amt, date, catId, accId, note || '', now, now]);
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
  const { fromId, toId, amount, date, note } = req.body;
  if (fromId === toId) return res.status(400).json({ error: '轉出與轉入帳戶不可相同' });
  if (amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  const now = Date.now();
  const txDate = date || todayStr();
  const txNote = note || '轉帳';
  const outId = uid();
  const inId = uid();
  db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [outId, req.userId, 'transfer_out', amount, txDate, '', fromId, txNote, inId, now, now]);
  db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [inId, req.userId, 'transfer_in', amount, txDate, '', toId, txNote, outId, now, now]);
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
    let usedSql = "SELECT COALESCE(SUM(amount),0) as used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ?";
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
    startDate: r.start_date, isActive: !!r.is_active, lastGenerated: r.last_generated
  })));
});

app.post('/api/recurring', (req, res) => {
  const { type, amount, categoryId, accountId, frequency, startDate, note } = req.body;
  if (amount <= 0) return res.status(400).json({ error: '金額必須大於 0' });
  const id = uid();
  db.run("INSERT INTO recurring (id,user_id,type,amount,category_id,account_id,frequency,start_date,note,is_active,last_generated) VALUES (?,?,?,?,?,?,?,?,?,1,NULL)",
    [id, req.userId, type, amount, categoryId, accountId, frequency, startDate, note || '']);
  saveDB();
  res.json({ id });
});

app.put('/api/recurring/:id', (req, res) => {
  const { type, amount, categoryId, accountId, frequency, startDate, note } = req.body;
  db.run("UPDATE recurring SET type=?,amount=?,category_id=?,account_id=?,frequency=?,start_date=?,note=? WHERE id=? AND user_id=?",
    [type, amount, categoryId, accountId, frequency, startDate, note || '', req.params.id, req.userId]);
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
    let lastGen = r.last_generated || r.start_date;
    if (lastGen > todayS) return;
    let nextDate = getNextDate(lastGen, r.frequency);
    while (nextDate <= todayS) {
      const now = Date.now();
      db.run("INSERT INTO transactions (id,user_id,type,amount,date,category_id,account_id,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [uid(), req.userId, r.type, r.amount, nextDate, r.category_id, r.account_id, (r.note || '') + ' (自動)', now, now]);
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

// ─── 儀表板 ───
app.get('/api/dashboard', (req, res) => {
  const month = thisMonth();
  const todayS = todayStr();

  const income = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ?", [req.userId, month + '%'])?.total || 0;
  const expense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ?", [req.userId, month + '%'])?.total || 0;
  const todayExpense = queryOne("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ?", [req.userId, todayS])?.total || 0;

  const catBreakdown = queryAll(`
    SELECT c.name, c.color, COALESCE(SUM(t.amount),0) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ?
    GROUP BY t.category_id ORDER BY total DESC
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
    txs = queryAll("SELECT t.*, c.name as cat_name, c.color as cat_color FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ? ORDER BY t.date", [req.userId, txType, from, to]);
  } else {
    txs = queryAll("SELECT t.*, c.name as cat_name, c.color as cat_color FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ? AND t.type = ? ORDER BY t.date", [req.userId, txType]);
  }

  const catMap = {};
  txs.forEach(t => {
    const name = t.cat_name || '未分類';
    const color = t.cat_color || '#94a3b8';
    if (!catMap[name]) catMap[name] = { total: 0, color };
    catMap[name].total += Number(t.amount);
  });

  const dailyMap = {};
  const monthlyMap = {};
  txs.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.amount);
    const m = t.date.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + Number(t.amount);
  });

  res.json({ catMap, dailyMap, monthlyMap, total: txs.reduce((s, t) => s + Number(t.amount), 0) });
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

// 盤後收盤資料（STOCK_DAY_ALL）
async function fetchTwseStockAll() {
  const now = Date.now();
  if (twseCache.data && (now - twseCache.timestamp) < TWSE_CACHE_TTL) {
    return twseCache.data;
  }
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    if (!res.ok) throw new Error('TWSE API 回應錯誤');
    const data = await res.json();
    twseCache = { data, timestamp: now };
    return data;
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
  const symbol = req.params.symbol.trim();
  if (!symbol) return res.status(400).json({ error: '請輸入股票代號' });
  const useRealtime = req.query.realtime === '1';
  const dateParam = (req.query.date || '').replace(/\D/g, ''); // YYYYMMDD

  try {
    // 1. 盤中即時報價
    if (useRealtime) {
      const rt = await fetchTwseRealtime(symbol);
      if (rt && rt.found && rt.closingPrice > 0) return res.json(rt);
    }

    // 2. 指定日期收盤（STOCK_DAY）— 可取得今日最新收盤價
    if (dateParam.length === 8) {
      const sd = await fetchTwseStockDay(symbol, dateParam);
      if (sd && sd.found && sd.closingPrice > 0) return res.json(sd);
    }

    // 3. 備援：STOCK_DAY_ALL
    const allStocks = await fetchTwseStockAll();
    const stock = allStocks.find(s => s.Code === symbol);
    if (!stock) return res.json({ found: false });
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
      priceType: '收盤價',
      dataDate: formatTwseDate(stock.Date || ''),
      dataTime: '',
    });
  } catch (e) {
    res.status(500).json({ error: '查詢失敗：' + e.message });
  }
});

// 搜尋股票（模糊比對代號或名稱，最多回傳 10 筆）— 固定用收盤資料
app.get('/api/twse/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
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

    // 找出所有交易的最早日期
    const allTxs = queryAll(
      "SELECT date FROM stock_transactions WHERE user_id = ? ORDER BY date ASC LIMIT 1",
      [req.userId]
    );
    if (allTxs.length === 0) return res.json({ synced: 0, skipped: 0, errors: [], message: '尚無交易紀錄' });

    const earliestDate = allTxs[0].date; // "2020-01-06"
    const today = todayStr();             // "2026-03-20"

    // 按年分段查詢 TWSE 除權息資料（避免單次查詢資料量過大）
    const startYear = parseInt(earliestDate.slice(0, 4));
    const endYear = parseInt(today.slice(0, 4));
    let allDividends = [];
    for (let y = startYear; y <= endYear; y++) {
      const sd = `${y}0101`;
      const ed = (y === endYear) ? today.replace(/-/g, '') : `${y}1231`;
      const divs = await fetchTwseDividendList(sd, ed);
      allDividends = allDividends.concat(divs);
    }

    // 只保留使用者持有的股票代號
    const symbolSet = new Set(stocks.map(s => s.symbol));
    const relevantDivs = allDividends.filter(d => symbolSet.has(d.symbol));

    let synced = 0, skipped = 0;
    const errors = [];

    for (const div of relevantDivs) {
      const stock = stocks.find(s => s.symbol === div.symbol);
      if (!stock) continue;

      // 檢查是否已有此日期的股利紀錄
      const existing = queryOne(
        "SELECT id FROM stock_dividends WHERE user_id = ? AND stock_id = ? AND date = ?",
        [req.userId, stock.id, div.date]
      );
      if (existing) { skipped++; continue; }

      // 取得此日期的持股數
      const txs = queryAll(
        "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at",
        [stock.id, req.userId]
      );
      const sharesHeld = calcSharesOnDate(txs, div.date);
      if (sharesHeld <= 0) { skipped++; continue; }

      // 取得現金股利 / 股票股利明細
      let cashPerShare = 0, stockPer1000 = 0;

      if (div.type === '息') {
        // 純現金股利：直接使用權值+息值
        cashPerShare = div.valuePerShare;
      } else {
        // 權、權息：需要查詢 Detail API 取得分解
        const dateStr8 = div.date.replace(/-/g, '');
        const detail = await fetchTwseDividendDetail(div.symbol, dateStr8);
        if (detail) {
          cashPerShare = detail.cashDividendPerShare;
          stockPer1000 = detail.stockDividendPer1000;
        } else {
          // Detail 查詢失敗，跳過「權」類型，「權息」使用權值+息值近似
          if (div.type === '權') { skipped++; errors.push(`${div.symbol} ${div.date} 無法取得除權明細`); continue; }
          cashPerShare = div.valuePerShare; // 近似值
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
    }

    if (synced > 0) saveDB();
    res.json({ synced, skipped, errors: errors.slice(0, 10) });
  } catch (e) {
    console.error('股利同步失敗:', e.message);
    res.status(500).json({ error: '同步失敗：' + e.message });
  }
});

// ─── 股票 ───
// 股票清單
app.get('/api/stocks', (req, res) => {
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
    // 預估賣出手續費 = Math.floor(市值 × 0.1425%)，最低 20 元
    const estSellFee = totalShares > 0 ? Math.max(20, Math.floor(marketValue * 0.001425)) : 0;
    // 預估賣出交易稅，依股票類型：一般 0.3%、ETF/權證 0.1%，最低 1 元
    const taxRate = (s.stock_type === 'etf' || s.stock_type === 'warrant') ? 0.001 : 0.003;
    const estSellTax = totalShares > 0 ? Math.max(1, Math.floor(marketValue * taxRate)) : 0;
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
  let imported = 0, skipped = 0;
  const errors = [];
  for (const row of rows) {
    try {
      const { date, symbol, name: stockName, type, shares, price, fee, tax, accountName, note } = row;
      if (!date || !symbol || !type || !shares || !price) { skipped++; errors.push(`略過不完整資料（${symbol || '?'}）`); continue; }
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
        [uid(), req.userId, stock.id, txType, date, parseFloat(shares), parseFloat(price),
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
        [uid(), req.userId, stock.id, date, cash, stock_d, note || '', Date.now()]);
      imported++;
    } catch (e) { skipped++; errors.push('錯誤：' + e.message); }
  }
  saveDB();
  res.json({ imported, skipped, errors });
});

// 股票交易紀錄
app.get('/api/stock-transactions', (req, res) => {
  const { stockId, page, pageSize } = req.query;
  let whereSql = "WHERE st.user_id = ?";
  const params = [req.userId];
  if (stockId) { whereSql += " AND st.stock_id = ?"; params.push(stockId); }
  const orderSql = " ORDER BY st.date DESC, st.created_at DESC";
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
  const { stockId, date, type, shares, price, fee, tax, accountId, note } = req.body;
  if (!stockId || !date || !type || !shares || !price) return res.status(400).json({ error: '必填欄位未填' });
  // 若股票不存在，可能需要先建立
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });
  const id = uid();
  db.run("INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', Date.now()]);
  saveDB();
  res.json({ id });
});

app.put('/api/stock-transactions/:id', (req, res) => {
  const { date, type, shares, price, fee, tax, accountId, note } = req.body;
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
  const { stockId, page, pageSize } = req.query;
  let whereSql = "WHERE sd.user_id = ?";
  const params = [req.userId];
  if (stockId) { whereSql += " AND sd.stock_id = ?"; params.push(stockId); }
  const orderSql = " ORDER BY sd.date DESC";
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
  const { stockId, date, cashDividend, stockDividendShares, accountId, note } = req.body;
  if (!stockId || !date) return res.status(400).json({ error: '必填欄位未填' });
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [stockId, req.userId]);
  if (!stock) return res.status(400).json({ error: '股票不存在' });
  const id = uid();
  db.run("INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, req.userId, stockId, date, cashDividend || 0, stockDividendShares || 0, accountId || '', note || '', Date.now()]);
  saveDB();
  res.json({ id });
});

app.put('/api/stock-dividends/:id', (req, res) => {
  const { date, cashDividend, stockDividendShares, accountId, note } = req.body;
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

// ─── 前端路由 catch-all（所有非 API、非靜態檔案的請求都回傳 index.html）───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── 啟動 ───
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`資產管理伺服器已啟動: http://localhost:${PORT}`);
  });
});
