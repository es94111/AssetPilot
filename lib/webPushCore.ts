// lib/webPushCore.ts — Web Push 推播通知的純邏輯（issue #257）
//
// 這支刻意「零 DB / 零網路 / 零 next 相依」：金鑰格式驗證、事件鍵推導、去重鍵、
// 通知文案組裝、失效判定全部是純函式，可直接被 tests/lib/webPush.test.ts 單元測試。
// 具副作用的部分（DB 讀寫、web-push 發送）在 lib/webPush.ts。

import crypto from 'crypto';

/** 可逐一開關的通知種類。 */
export const PUSH_CATEGORIES = ['bill_due', 'budget_exceeded', 'dividend'] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

export function isPushCategory(value: unknown): value is PushCategory {
  return typeof value === 'string' && (PUSH_CATEGORIES as readonly string[]).includes(value);
}

/** user_settings 的開關欄位名稱（單一來源，避免各處硬寫字串）。 */
export const PUSH_CATEGORY_COLUMNS: Record<PushCategory, string> = {
  bill_due: 'push_bill_due',
  budget_exceeded: 'push_budget_exceeded',
  dividend: 'push_dividend',
};

/** 全部通知種類的開關狀態。 */
export type PushPreferences = Record<PushCategory, boolean>;

/** 預設全部開啟（與 migration 的 DEFAULT 1 一致）。 */
export function defaultPushPreferences(): PushPreferences {
  return { bill_due: true, budget_exceeded: true, dividend: true };
}

/**
 * 由 user_settings 的一列推導開關狀態。
 * 缺少欄位或非 0 以外的值一律視為開啟，維持與既有部署相同的行為。
 */
export function readPushPreferences(row: Record<string, unknown> | null | undefined): PushPreferences {
  const prefs = defaultPushPreferences();
  if (!row) return prefs;
  for (const category of PUSH_CATEGORIES) {
    const value = row[PUSH_CATEGORY_COLUMNS[category]];
    if (value == null || value === '') continue;
    prefs[category] = Number(value) !== 0;
  }
  return prefs;
}

// ── 訂閱內容驗證 ──

const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

const PUSH_SERVICE_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
]);

function isSupportedPushServiceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return PUSH_SERVICE_HOSTS.has(host)
    || host.endsWith('.push.apple.com')
    || host.endsWith('.notify.windows.com');
}

export function isBase64Url(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && BASE64URL_RE.test(value);
}

/** 瀏覽器 PushSubscription.toJSON() 的鍵名（camelCase 與後端慣用的 snake_case 皆接受）。 */
export interface RawPushSubscription {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
  p256dh?: unknown;
  auth?: unknown;
}

export interface NormalizedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export class PushSubscriptionError extends Error {
  readonly code = 'InvalidPushSubscription';

  constructor(message: string) {
    super(message);
    this.name = 'PushSubscriptionError';
  }
}

/**
 * push service 端點限制：只接受已知瀏覽器 push service 的 HTTPS host，不接受任意 URL。
 * 若允許使用者提供任意 HTTPS host，伺服器會代替它向使用者控制的內網／localhost
 * 位址發請求，形成 SSRF；Push API 的瀏覽器端點只會來自下列標準 push service。
 */
export function validatePushEndpoint(endpoint: unknown): string {
  const value = String(endpoint ?? '').trim();
  if (!value || value.length > 2048) {
    throw new PushSubscriptionError('推播端點格式不正確');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PushSubscriptionError('推播端點格式不正確');
  }
  if (parsed.protocol !== 'https:') {
    throw new PushSubscriptionError('推播端點必須為 HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new PushSubscriptionError('推播端點不得包含帳密');
  }
  if (parsed.port && parsed.port !== '443') {
    throw new PushSubscriptionError('推播端點必須使用 HTTPS 標準連接埠');
  }
  if (!isSupportedPushServiceHost(parsed.hostname)) {
    throw new PushSubscriptionError('不支援此推播服務端點');
  }
  return value;
}

/**
 * 正規化並驗證瀏覽器傳來訂閱內容。
 * p256dh 為 P-256 公鑰（65 bytes → base64url 87 字元），auth 為 16 bytes 共享密鑰。
 * 僅檢查 base64url 形狀與長度，不驗證實際金鑰可用性（加密失敗會由發送端處理）。
 */
export function normalizePushSubscription(raw: RawPushSubscription | null | undefined): NormalizedPushSubscription {
  if (!raw || typeof raw !== 'object') {
    throw new PushSubscriptionError('缺少訂閱內容');
  }
  const endpoint = validatePushEndpoint(raw.endpoint);
  const keys = (raw.keys ?? {}) as { p256dh?: unknown; auth?: unknown };
  const p256dh = String(keys.p256dh ?? raw.p256dh ?? '').trim();
  const auth = String(keys.auth ?? raw.auth ?? '').trim();
  if (!isBase64Url(p256dh) || p256dh.length < 80 || p256dh.length > 128) {
    throw new PushSubscriptionError('p256dh 公鑰格式不正確');
  }
  if (!isBase64Url(auth) || auth.length < 20 || auth.length > 32) {
    throw new PushSubscriptionError('auth 密鑰格式不正確');
  }
  return { endpoint, p256dh, auth };
}

// ── 失效訂閱判定 ──

/**
 * push service 對「已失效訂閱」的標準回應：404 Not Found、410 Gone，以及
 * 部分服務（FCM 舊端點）回 401/403 表示訂閱已不可用。
 * 這些狀態一律直接刪除訂閱列，避免持續對同一個端點重試。
 */
export function isExpiredSubscriptionStatus(statusCode: unknown): boolean {
  const status = Number(statusCode);
  return status === 404 || status === 410;
}

/** 每次成功／失敗對 failure_count 的增減，連續失敗達門檻即停用該訂閱。 */
export const MAX_PUSH_FAILURES = 5;

export function nextFailureCount(current: unknown, delivered: boolean): number {
  if (delivered) return 0;
  return Math.max(0, Number(current) || 0) + 1;
}

export function shouldDisableSubscription(failureCount: unknown): boolean {
  return Number(failureCount) >= MAX_PUSH_FAILURES;
}

// ── 事件鍵（去重鍵）推導 ──

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 帳單到期事件鍵：以「信用卡帳號 + 帳單結帳日」為鍵。
 * 同一張卡同一期帳單只推播一次；下一期結帳日不同 → 新鍵 → 可再次推播。
 */
export function billDueEventKey(accountId: string, cycleEnd: string): string {
  return `bill:${String(accountId)}:${String(cycleEnd)}`;
}

/** 預算超標事件鍵：以「預算列 id + 年月」為鍵（同一預算每個月最多一次）。 */
export function budgetExceededEventKey(budgetId: string, yearMonth: string): string {
  return `budget:${String(budgetId)}:${String(yearMonth)}`;
}

/** 股利發放事件鍵：以股利列 id 為鍵（同一筆股利只推播一次）。 */
export function dividendEventKey(dividendId: string): string {
  return `dividend:${String(dividendId)}`;
}

/**
 * 統一組出送去 web_push_send_log 的 event_key（含種類前綴，方便人工檢視）。
 */
export function pushEventKey(category: PushCategory, eventKey: string): string {
  return `${category}:${String(eventKey)}`;
}

/** 預算年月（使用者當地時區）→ 'YYYY-MM'。 */
export function yearMonthOf(parts: { year: number; month: number }): string {
  return `${parts.year}-${pad2(parts.month)}`;
}

// ── 事件內容（純資料，供文案組裝與測試斷言） ──

export interface BillDueEvent {
  category: 'bill_due';
  accountId: string;
  accountName: string;
  cycleStart: string;
  cycleEnd: string;
  amount: number;
  currency: string;
}

export interface BudgetExceededEvent {
  category: 'budget_exceeded';
  budgetId: string;
  categoryName: string;
  yearMonth: string;
  budgetAmount: number;
  usedAmount: number;
}

export interface DividendEvent {
  category: 'dividend';
  dividendId: string;
  symbol: string;
  stockName: string;
  date: string;
  cashDividend: number;
  stockDividendShares: number;
  currency: string;
}

export type PushEvent = BillDueEvent | BudgetExceededEvent | DividendEvent;

/** 依事件種類取出去重鍵。 */
export function eventKeyOf(event: PushEvent): string {
  switch (event.category) {
    case 'bill_due':
      return billDueEventKey(event.accountId, event.cycleEnd);
    case 'budget_exceeded':
      return budgetExceededEventKey(event.budgetId, event.yearMonth);
    case 'dividend':
      return dividendEventKey(event.dividendId);
  }
}

// ── 通知文案（Push payload） ──

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  category: PushCategory;
}

export type PushMessageVars = Record<string, string | number>;

/** 通知文案的翻譯函式形狀（與 lib/i18n/translate.ts 的 TranslateFn 相容）。 */
export type PushTranslator = (key: string, vars?: PushMessageVars) => string;

export function formatPushAmount(amount: number, currency: string): string {
  const n = Number(amount) || 0;
  return `${currency || 'TWD'} ${Math.round(n).toLocaleString('en-US')}`;
}

/** 通知點擊後的導頁路徑（單一來源，前端與測試共用）。 */
export const PUSH_NOTIFICATION_URLS: Record<PushCategory, string> = {
  bill_due: '/finance/accounts',
  budget_exceeded: '/finance/budget',
  dividend: '/stocks/dividends',
};

/**
 * 組裝單一事件的推播 payload。
 * 文案一律走 i18n 字典（notifications.push.*），與 Email／LINE 通知相同的多語言來源。
 */
export function buildPushPayload(event: PushEvent, t: PushTranslator): PushNotificationPayload {
  const url = PUSH_NOTIFICATION_URLS[event.category];
  switch (event.category) {
    case 'bill_due': {
      const amount = formatPushAmount(event.amount, event.currency);
      return {
        category: event.category,
        title: t('notifications.push.billDue.title'),
        body: t('notifications.push.billDue.body', {
          account: event.accountName,
          date: event.cycleEnd,
          amount,
        }),
        tag: eventKeyOf(event),
        url,
      };
    }
    case 'budget_exceeded': {
      const budgetAmount = formatPushAmount(event.budgetAmount, 'TWD');
      const usedAmount = formatPushAmount(event.usedAmount, 'TWD');
      return {
        category: event.category,
        title: t('notifications.push.budgetExceeded.title', { category: event.categoryName }),
        body: t('notifications.push.budgetExceeded.body', {
          month: event.yearMonth,
          used: usedAmount,
          budget: budgetAmount,
        }),
        tag: eventKeyOf(event),
        url,
      };
    }
    case 'dividend': {
      const cash = formatPushAmount(event.cashDividend, event.currency);
      const shares = String(Math.round((Number(event.stockDividendShares) || 0) * 10000) / 10000);
      return {
        category: event.category,
        title: t('notifications.push.dividend.title'),
        body: t('notifications.push.dividend.body', {
          symbol: event.symbol,
          date: event.date,
          cash,
          shares,
        }),
        tag: eventKeyOf(event),
        url,
      };
    }
  }
}

/**
 * 序列化為送去 push service 的 JSON 字串。
 * 刻意保持精簡（push payload 有 4KB 上限），僅含顯示所需欄位。
 */
export function serializePushPayload(payload: PushNotificationPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: payload.url,
    category: payload.category,
  });
}

// ── VAPID 金鑰 ──

export interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * 產生 VAPID（RFC 8292）金鑰組：prime256v1 曲線，公鑰為未壓縮點（65 bytes）的
 * base64url，私鑰為 32 bytes 的 base64url。
 *
 * 僅在首次啟動且環境變數未設定時呼叫一次（見 lib/webPushConfig.ts），
 * 產生的值一律寫入持久化 .env，避免重啟後金鑰輪替導致既有訂閱全部失效。
 */
export function generateVapidKeys(): VapidKeyPair {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey();
  const privateKey = ecdh.getPrivateKey();
  return {
    publicKey: publicKey.length === 65
      ? publicKey.toString('base64url')
      : Buffer.concat([Buffer.alloc(65 - publicKey.length), publicKey]).toString('base64url'),
    privateKey: privateKey.length === 32
      ? privateKey.toString('base64url')
      : Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey]).toString('base64url'),
  };
}

export function isValidVapidPublicKey(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!isBase64Url(s)) return false;
  try {
    return Buffer.from(s, 'base64url').length === 65;
  } catch {
    return false;
  }
}

export function isValidVapidPrivateKey(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!isBase64Url(s)) return false;
  try {
    return Buffer.from(s, 'base64url').length === 32;
  } catch {
    return false;
  }
}

/** 驗證公私鑰長度與曲線配對一致，避免誤設兩把格式正確但不相配的金鑰。 */
export function isValidVapidKeyPair(publicKey: unknown, privateKey: unknown): boolean {
  const publicValue = String(publicKey ?? '').trim();
  const privateValue = String(privateKey ?? '').trim();
  if (!isValidVapidPublicKey(publicValue) || !isValidVapidPrivateKey(privateValue)) return false;
  try {
    const curve = crypto.createECDH('prime256v1');
    curve.setPrivateKey(Buffer.from(privateValue, 'base64url'));
    return curve.getPublicKey().equals(Buffer.from(publicValue, 'base64url'));
  } catch {
    return false;
  }
}

/**
 * VAPID subject（RFC 8292 的 `sub`）必須是 https URL 或 mailto。
 * 未設定 APP_URL 時回退專案慣用的 APP_HOST 推導值。
 */
export function resolveVapidSubject(
  appUrl: unknown,
  appHost: unknown,
  fallbackEmail: unknown = 'admin@localhost',
): string {
  const url = String(appUrl ?? '').trim() || String(appHost ?? '').trim();
  if (url) {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      const parsed = new URL(withScheme);
      if (parsed.protocol === 'https:') return parsed.origin;
    } catch {
      /* 落入 mailto fallback */
    }
  }
  const email = String(fallbackEmail ?? '').trim();
  return `mailto:${email.includes('@') ? email : 'admin@localhost'}`;
}

// ── 前端可用的訂閱狀態 ──

export interface PushSubscriptionSummary {
  id: string;
  endpointHost: string;
  userAgent: string;
  createdAt: number;
  lastSuccessAt: number | null;
  failureCount: number;
}

/** 對外只暴露端點主機名稱，不回傳完整端點（端點本身即為可用來推播的憑證）。 */
export function endpointHost(endpoint: unknown): string {
  try {
    return new URL(String(endpoint)).host;
  } catch {
    return '';
  }
}

/**
 * base64url 編碼的 VAPID 公鑰 → 瀏覽器 `pushManager.subscribe()` 需要的 Uint8Array。
 * 前端在註冊訂閱時使用（見 components/features/settings/NotificationsSettingsClient.tsx）。
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
