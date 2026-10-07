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
const LOOPBACK_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
]);

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
  if (parsed.username || parsed.password) {
    throw new ApiTokenError('Webhook 目標網址不得包含帳號密碼', 400, 'InsecureWebhookUrl');
  }

  // hostname 對 IPv6 會回傳含中括號的形式，且可能為非正規化寫法
  // （如 [0:0:0:0:0:0:0:1]、[::ffff:127.0.0.1]），比對前先正規化。
  const host = normalizeHost(parsed.hostname);
  if (isBlockedHost(host)) {
    throw new ApiTokenError('Webhook 目標網址不得指向本機或內部網路', 400, 'InsecureWebhookUrl');
  }
  return parsed.toString();
}

/** 去除 IPv6 中括號、尾端網域點（FQDN 寫法）並轉小寫，供本機／私網判定使用。 */
function normalizeHost(hostname: string): string {
  // 'localhost.' 與 'localhost' 解析到同一位置，但 URL 解析器會保留尾端的點；
  // 不去除會讓 exact-match 與 suffix 檢查同時失效（SSRF 繞過）。
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  const inRange = (base: string, bits: number): boolean => {
    const baseInt = ipv4ToInt(base);
    if (baseInt == null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (baseInt & mask);
  };
  return (
    inRange('0.0.0.0', 8) || // 0.0.0.0/8（含 0.0.0.0）
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) || // link-local（含雲端 metadata 169.254.169.254）
    inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) || // protocol assignments
    inRange('192.0.2.0', 24) || // documentation TEST-NET-1
    inRange('192.88.99.0', 24) || // deprecated 6to4 relay anycast
    inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // documentation TEST-NET-2
    inRange('203.0.113.0', 24) || // documentation TEST-NET-3
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved（含 255.255.255.255）
  );
}

/** 將 IPv6 字串展開為 8 組 16 位元整數；無法解析時回傳 null。 */
function parseIpv6(input: string): number[] | null {
  let value = input.toLowerCase();
  // 尾端可能帶有 IPv4（如 ::ffff:127.0.0.1），先抽出。
  const v4Tail = /(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(value);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    if (n == null) return null;
    value = value.slice(0, value.length - v4Tail[1].length).replace(/:$/, '');
    const hi = (n >>> 16) & 0xffff;
    const lo = n & 0xffff;
    if (value === '') return [0, 0, 0, 0, 0, 0xffff, hi, lo];
    value += `:${hi.toString(16)}:${lo.toString(16)}`;
  }

  const doubleColon = value.indexOf('::');
  if (doubleColon !== -1 && value.indexOf('::', doubleColon + 1) !== -1) return null; // 只允許一個 ::

  const head = doubleColon === -1 ? value : value.slice(0, doubleColon);
  const tail = doubleColon === -1 ? '' : value.slice(doubleColon + 2);
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = tail === '' ? [] : tail.split(':');
  if (headParts.length + tailParts.length > 8) return null;

  const pad = new Array(8 - headParts.length - tailParts.length).fill('0');
  const groups = [...headParts, ...pad, ...tailParts];
  if (groups.length !== 8) return null;

  const nums: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    nums.push(parseInt(g, 16));
  }
  return nums;
}

/**
 * 抽出 IPv6 位址中嵌入的 IPv4（若無則回傳 null）。
 * 涵蓋 IPv4 對應／相容（::ffff:x.x.x.x、::x.x.x.x、::ffff:0:x.x.x.x）、
 * NAT64 well-known prefix（64:ff9b::/96）與 6to4（2002::/16）。
 * 這些寫法都能把流量導向內網，但不會以點分十進位出現在原始字串中，
 * 因此必須先還原成 IPv4 再用 IPv4 規則判定。
 */
function embeddedIpv4(groups: number[]): string | null {
  const toDotted = (hi: number, lo: number): string =>
    [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
  // 前 5 組為 0：IPv4 對應／相容位址，位址位於最後 32 位元
  if (groups.slice(0, 5).every((g) => g === 0)) return toDotted(groups[6], groups[7]);
  // ::ffff:0:x.x.x.x：IPv4-translated 位址（RFC 2765）
  if (groups.slice(0, 4).every((g) => g === 0) && groups[4] === 0xffff && groups[5] === 0) {
    return toDotted(groups[6], groups[7]);
  }
  // NAT64 well-known prefix 64:ff9b::/96
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return toDotted(groups[6], groups[7]);
  }
  // 6to4：2002:AABB:CCDD::/48，AABBCCDD 即嵌入的 IPv4
  if (groups[0] === 0x2002) return toDotted(groups[1], groups[2]);
  return null;
}

function isPrivateIpv6(ip: string): boolean {
  const groups = parseIpv6(ip);
  if (!groups) return false;

  // 先處理兩個特例，避免它們被下方的「嵌入 IPv4」規則誤判為 0.0.0.x。
  if (groups.every((g) => g === 0)) return true; // ::（未指定）
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1（loopback）

  // 任何可還原成 IPv4 的嵌入形式，一律以 IPv4 規則判定，避免 IPv4-mapped、NAT64
  // 或 6to4 等表示法把私有 IPv4 藏在 IPv6 位址內；若嵌入的是公開 IPv4，維持既有放行行為。
  const embedded = embeddedIpv4(groups);
  if (embedded) return isBlockedHost(embedded);

  const [g0, g1] = groups;
  // 只有 2000::/3 是一般全域單播空間；其餘特殊用途、未指派及保留空間一律拒絕，
  // 包含 link-local、deprecated site-local、ULA、unspecified、multicast 及 discard-only。
  if ((g0 & 0xe000) !== 0x2000) return true;
  if (g0 === 0x2001 && (g1 & 0xff80) === 0) return true; // IETF protocol assignments 2001::/23
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation 2001:db8::/32
  if (g0 === 0x3fff && (g1 & 0xf000) === 0) return true; // documentation 3fff::/20
  return false;
}

function isBlockedHost(hostname: string): boolean {
  if (!hostname) return true;
  if (LOOPBACK_HOSTS.has(hostname)) return true;
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  if (isPrivateIpv4(hostname)) return true;
  if (hostname.includes(':') && isPrivateIpv6(hostname)) return true;
  return false;
}

/**
 * 判定「主機名」是否為不可投遞的目的地（不含 DNS 解析）。
 * 匯出給投遞層重用，讓建立訂閱與實際連線兩個時機使用同一份規則，避免清單漂移。
 */
export function isBlockedWebhookHostname(hostname: string): boolean {
  return isBlockedHost(normalizeHost(String(hostname || '')));
}

/**
 * 判定「已解析的 IP 位址」是否為不可投遞的目的地（issue #285）。
 *
 * Webhook 訂閱在建立時只驗證字面 hostname，實際投遞前必須再檢查 DNS 解析
 * 結果，否則公開網域可解析到內網位址（DNS rebinding／split-horizon）。
 * 這裡刻意重用 `isPrivateIpv4`／`isPrivateIpv6` 的既有範圍清單，讓兩個時機
 * 的判定完全一致；非 IP 字面值（含帶 zone id 的位址）一律視為阻擋。
 */
export function isBlockedIpAddress(address: string): boolean {
  const value = String(address || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  // zone id（如 fe80::1%en0）只在連結本地位址上出現，無法以純位址規則比對 → 直接阻擋。
  if (!value || value.includes('%')) return true;
  if (ipv4ToInt(value) != null) return isPrivateIpv4(value);
  if (parseIpv6(value) != null) return isPrivateIpv6(value);
  return true;
}

// ── 簽章密鑰的加密封裝（AES-256-GCM）──
//
// 格式：base64(iv).base64(tag).base64(ciphertext)
// 主密鑰由環境變數提供，透過 SHA-256 正規化為 32 bytes。

export function deriveEncryptionKey(masterSecret: string): Buffer {
  if (!masterSecret) throw new Error('缺少 Webhook 簽章密鑰的加密主密鑰');
  return crypto.createHash('sha256').update(masterSecret).digest();
}

// GCM 認證標籤長度（bytes）。加解密兩端都必須明確指定，
// 否則 Node 可能接受被截短的標籤，導致密文偽造（見 Semgrep gcm-no-tag-length）。
export const GCM_TAG_LENGTH = 16;

export function encryptSecret(plaintext: string, masterSecret: string): string {
  const key = deriveEncryptionKey(masterSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptSecret(payload: string, masterSecret: string): string {
  const parts = String(payload || '').split('.');
  if (parts.length !== 3) throw new Error('Webhook 簽章密鑰格式無效');
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveEncryptionKey(masterSecret);
  const tag = Buffer.from(tagB64, 'base64');
  // 明確傳入 authTagLength 並驗證長度：若不指定，Node 可能接受較短的 tag，
  // 讓攻擊者偽造密文或還原 GCM 隱式金鑰（Semgrep gcm-no-tag-length）。
  if (tag.length !== GCM_TAG_LENGTH) throw new Error('Webhook 簽章密鑰格式無效');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'), { authTagLength: GCM_TAG_LENGTH });
  decipher.setAuthTag(tag);
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
