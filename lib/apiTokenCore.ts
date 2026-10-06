// lib/apiTokenCore.ts — API Token 與 Webhook 的零相依核心（純函式，可直接單元測試）
//
// 設計取捨（見 issue #258）：
// 1. Token 明文僅在建立時回傳一次；儲存時只留 SHA-256 雜湊。Token 為
//    crypto.randomBytes(32) 的高熵亂數，不需 bcrypt 慢雜湊（比照 lib/mcpAuth.ts）。
// 2. Webhook 簽章密鑰需在每次投遞時取回明文以計算 HMAC，無法只存雜湊，
//    因此以 AES-256-GCM 加密後儲存（比照 lib/photoCryptoCore.ts 的加密封裝）。
//    簽章密鑰與 API Token 明文皆不得寫入日誌或稽核 metadata。
// 3. 雜湊／加密以外的所有邏輯（scope 驗證、HMAC 計算、重試排程）都是純函式，
//    不碰資料庫，讓 `npm test` 在無 PostgreSQL 的環境也能驗證。
import crypto from 'node:crypto';

export const API_TOKEN_PREFIX = 'ap_api_';
export const WEBHOOK_SECRET_PREFIX = 'whsec_';
export const MAX_ACTIVE_API_TOKENS = 20;
export const MAX_WEBHOOK_SUBSCRIPTIONS = 10;

// 逐 Token 的權限範圍。刻意分成讀／寫／Webhook 管理三種，
// 讓第三方整合可取得最小權限（issue #258 驗收條件 1）。
export const API_TOKEN_SCOPES = [
  'transactions:read',
  'transactions:write',
  'webhooks:manage',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

const SCOPE_SET = new Set<string>(API_TOKEN_SCOPES);

// Webhook 訂閱可選的事件類型，對應交易的建立／修改／刪除。
export const WEBHOOK_EVENTS = [
  'transaction.created',
  'transaction.updated',
  'transaction.deleted',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const EVENT_SET = new Set<string>(WEBHOOK_EVENTS);

export class ApiTokenError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'ValidationError',
  ) {
    super(message);
    this.name = 'ApiTokenError';
  }
}

// ── Token 產生與雜湊 ──

export function generateApiToken(): string {
  return API_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
}

export function hashApiToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

export function generateWebhookSecret(): string {
  return WEBHOOK_SECRET_PREFIX + crypto.randomBytes(32).toString('base64url');
}

// ── Scope 驗證 ──

export function parseApiTokenScopes(raw: unknown): ApiTokenScope[] {
  if (raw == null) return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[\s,]+/).filter(Boolean);
  const scopes = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  if (scopes.length === 0) {
    throw new ApiTokenError('至少需要一個權限範圍（scope）');
  }
  for (const scope of scopes) {
    if (!SCOPE_SET.has(scope)) {
      throw new ApiTokenError(`不支援的權限範圍：${scope}`, 400, 'InvalidScope');
    }
  }
  return scopes as ApiTokenScope[];
}

export function hasScope(granted: readonly string[], required: ApiTokenScope): boolean {
  return granted.includes(required);
}

export function parseWebhookEvents(raw: unknown): WebhookEvent[] {
  if (raw == null) return [...WEBHOOK_EVENTS];
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[\s,]+/).filter(Boolean);
  const events = [...new Set(list.map((e) => String(e).trim()).filter(Boolean))];
  if (events.length === 0) {
    throw new ApiTokenError('至少需要訂閱一個事件類型');
  }
  for (const event of events) {
    if (!EVENT_SET.has(event)) {
      throw new ApiTokenError(`不支援的事件類型：${event}`, 400, 'InvalidEvent');
    }
  }
  return events as WebhookEvent[];
}

// ── Webhook 目標網址驗證 ──

const WEBHOOK_URL_MAX_LENGTH = 2048;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Webhook 目標必須為 HTTPS 公開網址，避免 SSRF 指向內網或本機服務。
 * 不支援 http://（避免簽章內容在傳輸中遭竄改）與私網位址。
 */
export function validateWebhookUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ApiTokenError('必須提供 Webhook 目標網址（url）');
  }
  const value = raw.trim();
  if (value.length > WEBHOOK_URL_MAX_LENGTH) {
    throw new ApiTokenError('Webhook 目標網址過長');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiTokenError('Webhook 目標網址格式無效');
  }
  if (parsed.protocol !== 'https:') {
    throw new ApiTokenError('Webhook 目標網址必須使用 HTTPS', 400, 'InsecureWebhookUrl');
  }
  const host = parsed.hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host) || isPrivateIpv4(host)) {
    throw new ApiTokenError('Webhook 目標網址不得指向本機或內部網路', 400, 'InsecureWebhookUrl');
  }
  return parsed.toString();
}

// ── 簽章密鑰的加密封裝（AES-256-GCM）──
//
// 格式：base64(iv).base64(tag).base64(ciphertext)
// 主密鑰由環境變數提供，透過 SHA-256 正規化為 32 bytes。

export function deriveEncryptionKey(masterSecret: string): Buffer {
  if (!masterSecret) throw new Error('缺少 Webhook 簽章密鑰的加密主密鑰');
  return crypto.createHash('sha256').update(masterSecret).digest();
}

export function encryptSecret(plaintext: string, masterSecret: string): string {
  const key = deriveEncryptionKey(masterSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptSecret(payload: string, masterSecret: string): string {
  const parts = String(payload || '').split('.');
  if (parts.length !== 3) throw new Error('Webhook 簽章密鑰格式無效');
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveEncryptionKey(masterSecret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// ── HMAC 簽章 ──
//
// 簽章內容為 `${timestamp}.${rawBody}`，接收端可比對時間戳以抵抗重放攻擊。
// 標頭格式沿用業界慣例：`t=<unix 秒>,v1=<hex hmac>`。

export const WEBHOOK_SIGNATURE_HEADER = 'X-AssetPilot-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-AssetPilot-Timestamp';
export const WEBHOOK_EVENT_HEADER = 'X-AssetPilot-Event';
export const WEBHOOK_DELIVERY_HEADER = 'X-AssetPilot-Delivery';
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export function buildSignaturePayload(timestampSeconds: number, rawBody: string): string {
  return `${timestampSeconds}.${rawBody}`;
}

export function signWebhookPayload(
  secret: string,
  rawBody: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const mac = crypto
    .createHmac('sha256', secret)
    .update(buildSignaturePayload(timestampSeconds, rawBody), 'utf8')
    .digest('hex');
  return `t=${timestampSeconds},v1=${mac}`;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  header: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  const tolerance = options.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const parts = String(header || '').split(',');
  let timestamp: number | null = null;
  let provided: string | null = null;
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1') provided = value;
  }
  if (timestamp == null || !Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(buildSignaturePayload(timestamp, rawBody), 'utf8')
    .digest('hex');
  return timingSafeEqualHex(expected, provided);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── 投遞重試策略 ──
//
// 指數退避：第 n 次失敗後等待 RETRY_BASE_MS * 4^(n-1)，上限 RETRY_MAX_MS。
// 最多嘗試 MAX_DELIVERY_ATTEMPTS 次（含首次），逾期未成功的投遞標記為 failed。

export const MAX_DELIVERY_ATTEMPTS = 5;
export const RETRY_BASE_MS = 30_000;
export const RETRY_MAX_MS = 60 * 60 * 1000;
export const DELIVERY_TIMEOUT_MS = 10_000;

export function retryDelayMs(attempt: number): number {
  if (attempt <= 1) return RETRY_BASE_MS;
  const delay = RETRY_BASE_MS * 4 ** (attempt - 1);
  return Math.min(delay, RETRY_MAX_MS);
}

/** 第 attempt 次嘗試失敗後的排程時間；已達上限時回傳 null（不再重試）。 */
export function nextRetryAt(attempt: number, now: number = Date.now()): number | null {
  if (attempt >= MAX_DELIVERY_ATTEMPTS) return null;
  return now + retryDelayMs(attempt);
}

/** 依 HTTP 狀態碼判斷是否值得重試：5xx 與 429 重試，其餘 4xx 視為永久失敗。 */
export function isRetryableStatus(status: number): boolean {
  // 狀態碼 0（或非數值）代表連線／DNS／逾時錯誤，沒有伺服器回應，值得重試。
  if (!Number.isFinite(status) || status <= 0) return true;
  if (status === 429) return true;
  return status >= 500;
}
