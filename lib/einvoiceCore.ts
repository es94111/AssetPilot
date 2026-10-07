// lib/einvoiceCore.ts — 雲端發票（手機條碼載具）整合的「純邏輯」核心
// （issue #253，SRS §2.7 雲端發票載具匯入）
//
// 與 lib/einvoiceCarrier.ts（DB／稽核／排程）的分工：
// 本檔不依賴 DB、Next.js 或任何相對模組，只負責
//   1. 手機條碼載具驗證與遮罩
//   2. 財政部電子發票 API 回應正規化與驗證
//   3. 以發票號碼為唯一鍵的去重鍵組裝
//   4. 供應商（provider）狀態與重試退避決策
// 因此可用純 Node 測試（node tests/lib/einvoiceCore.test.ts），且供應商
// 不存在時也能完整驗證降級行為，測試永不依賴真實財政部 API。

// ───────────────────────── 手機條碼載具 ─────────────────────────

/**
 * 手機條碼載具格式：`/` + 7 碼大寫英數字（共 8 字元）。
 * 財政部電子發票整合服務平台的共通性載具規範。
 */
const CARRIER_BARCODE_REGEX = /^\/[0-9A-Z]{7}$/;

export function normalizeCarrierBarcode(raw: unknown): string {
  // 使用者常從發票或 App 複製到空白／全形字元，先正規化再驗證。
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/[\u2000-\u200b\u3000]/g, '')
    .toUpperCase();
  return trimmed;
}

export function isValidCarrierBarcode(raw: unknown): boolean {
  return CARRIER_BARCODE_REGEX.test(normalizeCarrierBarcode(raw));
}

/**
 * 遮罩載具條碼以便顯示：保留前 4 碼，其餘以 `•` 取代。
 * 完整條碼可作為查詢憑證，不應在列表 API 或稽核日誌中以明文回傳。
 */
export function maskCarrierBarcode(raw: unknown): string {
  const value = normalizeCarrierBarcode(raw);
  if (!value) return '';
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(value.length - 4)}`;
}

/**
 * 手機條碼載具的驗證碼（`verify_code`）規則。
 * 財政部要求為 6~20 碼英數字，用來呼叫查詢 API；空字串代表未設定。
 * 只去除前後空白（不允許中間有空白，避免把複製到的錯誤內容當成有效憑證）。
 */
export function normalizeVerifyCode(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function isValidVerifyCode(raw: unknown): boolean {
  return /^[A-Za-z0-9]{6,20}$/.test(normalizeVerifyCode(raw));
}

// ───────────────────────── 發票欄位對應 ─────────────────────────

/** 從財政部 API 正規化後的一張發票（尚未落庫）。 */
export interface NormalizedInvoice {
  invoiceNumber: string;
  /** 發票開立日期，ISO `YYYY-MM-DD`（使用者時區下的當地日期）。 */
  invoiceDate: string;
  /** 發票開立時間，`HH:MM:SS`；供應商未提供時為空字串。 */
  invoiceTime: string;
  sellerName: string;
  /** 含稅總金額（新台幣整數，發票金額為整數元）。 */
  amount: number;
}

export interface NormalizeInvoiceResult {
  invoice?: NormalizedInvoice;
  /** 被丟棄的原因；成功時為空字串。 */
  reason: string;
}

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_DATE_REGEX = /^(\d{4})(\d{2})(\d{2})$/;
const TIME_REGEX = /^(\d{2}):?(\d{2})(?::?(\d{2}))?$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** 接受 `YYYY-MM-DD` 與財政部慣用的 `YYYYMMDD`／`民國年月` 以外的西元格式。 */
export function normalizeInvoiceDate(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const dashed = DATE_REGEX.exec(value);
  if (dashed) {
    const [year, month, day] = [Number(dashed[1]), Number(dashed[2]), Number(dashed[3])];
    return isRealCalendarDate(year, month, day) ? `${dashed[1]}-${dashed[2]}-${dashed[3]}` : '';
  }
  const compact = COMPACT_DATE_REGEX.exec(value);
  if (compact) {
    const [year, month, day] = [Number(compact[1]), Number(compact[2]), Number(compact[3])];
    return isRealCalendarDate(year, month, day)
      ? `${compact[1]}-${compact[2]}-${compact[3]}`
      : '';
  }
  return '';
}

/** 正規化 `HH:MM:SS`；無法解析時回空字串（時間為選填欄位）。 */
export function normalizeInvoiceTime(raw: unknown): string {
  const match = TIME_REGEX.exec(String(raw ?? '').trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return '';
  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

/** 發票號碼：2 碼英文大寫 + 8 碼數字（財政部電子發票格式）。 */
export function normalizeInvoiceNumber(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function isValidInvoiceNumber(raw: unknown): boolean {
  return /^[A-Z]{2}\d{8}$/.test(normalizeInvoiceNumber(raw));
}

/**
 * 把單筆供應商回應轉為可落庫的發票；任何必要欄位缺失即丟棄並附上原因，
 * 呼叫端據此把該筆計入 `skipped` 而非讓整個同步失敗。
 */
export function normalizeInvoice(raw: unknown): NormalizeInvoiceResult {
  const source = (raw ?? {}) as Record<string, unknown>;
  const invoiceNumber = normalizeInvoiceNumber(
    source.invoiceNumber ?? source.invoice_number ?? source.invoicenumber,
  );
  if (!isValidInvoiceNumber(invoiceNumber)) {
    return { reason: '發票號碼格式無效' };
  }

  const invoiceDate = normalizeInvoiceDate(
    source.invoiceDate ?? source.invoice_date ?? source.date,
  );
  if (!invoiceDate) return { reason: '發票日期格式無效' };

  const rawAmount =
    source.amount ?? source.totalAmount ?? source.total_amount ?? source.total;
  const amount = Number(rawAmount);
  // 發票金額為新台幣整數元；0 元發票（例如全額折抵）不產生交易草稿。
  if (!Number.isFinite(amount) || amount <= 0) {
    return { reason: '發票金額無效' };
  }

  const sellerName = String(
    source.sellerName ?? source.seller_name ?? source.storeName ?? source.store_name ?? '',
  )
    .trim()
    .slice(0, 100);

  return {
    invoice: {
      invoiceNumber,
      invoiceDate,
      invoiceTime: normalizeInvoiceTime(
        source.invoiceTime ?? source.invoice_time ?? source.time,
      ),
      sellerName,
      amount: Math.round(amount),
    },
    reason: '',
  };
}

/** 批次正規化；回傳可落庫的發票與被丟棄筆數（含最多 20 筆原因）。 */
export function normalizeInvoiceBatch(raw: unknown): {
  invoices: NormalizedInvoice[];
  skipped: number;
  skipReasons: string[];
} {
  const list = Array.isArray(raw) ? raw : [];
  const invoices: NormalizedInvoice[] = [];
  const skipReasons: string[] = [];
  let skipped = 0;
  for (const item of list) {
    const result = normalizeInvoice(item);
    if (result.invoice) {
      invoices.push(result.invoice);
    } else {
      skipped += 1;
      if (skipReasons.length < 20) skipReasons.push(result.reason);
    }
  }
  return { invoices, skipped, skipReasons };
}

/**
 * 以發票號碼為唯一鍵的去重鍵。
 *
 * 發票號碼在財政部體系內全國唯一，但不同載具／不同帳本可能同時匯入同一號碼，
 * 故仍以 `(user_id, invoice_number)` 為 DB 唯一鍵；本函式只負責產生「同一使用者
 * 底下唯一」的鍵值，供 DB 的 `ON CONFLICT DO NOTHING` 與測試使用。
 */
export function invoiceDedupeKey(userId: string, invoiceNumber: unknown): string {
  return `${String(userId)}:${normalizeInvoiceNumber(invoiceNumber)}`;
}

// ───────────────────────── 同步狀態與重試決策 ─────────────────────────

export type SyncStatus = 'success' | 'partial' | 'failed' | 'skipped';

export interface SyncStateInput {
  status: string | null | undefined;
  /** 上一次同步失敗次數（`consecutive_failures`）。 */
  consecutiveFailures: number | string | null | undefined;
  /** 下一次允許重試的毫秒時間戳（0 表示不限制）。 */
  nextRetryAt: number | string | null | undefined;
  now?: number;
}

/** 手動同步是否被退避鎖擋住（避免失敗風暴）。 */
export function isSyncBackedOff(input: SyncStateInput): boolean {
  const now = Number(input.now ?? Date.now());
  const nextRetryAt = Number(input.nextRetryAt) || 0;
  if (nextRetryAt <= 0) return false;
  return nextRetryAt > now;
}

/** 退避剩餘秒數（無退避時回 0）；供 UI 顯示「請於 N 秒後再試」。 */
export function syncRetryAfterSeconds(input: SyncStateInput): number {
  const now = Number(input.now ?? Date.now());
  const nextRetryAt = Number(input.nextRetryAt) || 0;
  return Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
}

/**
 * 重試退避（比照 webhook 指數退避）：連續失敗 N 次後等待 `30 * 2^(N-1)` 秒，
 * 上限 1 小時。刻意「不自動重試」，只在手動同步的入口擋下過於頻繁的請求，
 * 避免供應商故障時使用者連點造成重試風暴。
 */
export const SYNC_BACKOFF_BASE_MS = 30 * 1000;
export const SYNC_BACKOFF_MAX_MS = 60 * 60 * 1000;

export function syncBackoffMs(consecutiveFailures: number): number {
  const failures = Math.max(0, Math.floor(Number(consecutiveFailures) || 0));
  if (failures <= 0) return 0;
  return Math.min(SYNC_BACKOFF_BASE_MS * 2 ** (failures - 1), SYNC_BACKOFF_MAX_MS);
}

/** 依本次結果更新 `consecutive_failures` 與 `next_retry_at`。 */
export function nextSyncState(
  previousFailures: number | string | null | undefined,
  status: SyncStatus,
  now: number = Date.now(),
): { consecutiveFailures: number; nextRetryAt: number } {
  if (status === 'failed') {
    const failures = (Number(previousFailures) || 0) + 1;
    return { consecutiveFailures: failures, nextRetryAt: now + syncBackoffMs(failures) };
  }
  // 成功或部分成功都視為「本次有進展」，重置退避；
  // partial 的失敗筆數已記錄於 last_error，不需要退避阻擋使用者繼續同步。
  return { consecutiveFailures: 0, nextRetryAt: 0 };
}

// ───────────────────────── 供應商設定 ─────────────────────────

/** 供應商未設定／不可用時，同步優雅降級為 `skipped`，不以例外中斷請求。 */
export interface InvoiceProviderConfig {
  endpoint: string;
  appId: string;
  apiKey: string;
  /** 是否已具備呼叫外部 API 的必要設定。 */
  configured: boolean;
}

/**
 * 解析環境變數設定。三個變數缺一即視為未設定（功能停用），
 * 讓自架部署不必接觸任何真實憑證也能安全地跑完整應用程式。
 */
export function readInvoiceProviderConfig(env: Record<string, string | undefined>): InvoiceProviderConfig {
  const endpoint = String(env.EINVOICE_API_ENDPOINT || '').trim();
  const appId = String(env.EINVOICE_API_APP_ID || '').trim();
  const apiKey = String(env.EINVOICE_API_KEY || '').trim();
  const configured =
    !!endpoint && !!appId && !!apiKey && /^https:\/\//i.test(endpoint);
  return { endpoint, appId, apiKey, configured };
}

// ───────────────────────── 供應商錯誤分類 ─────────────────────────

/**
 * 供應商回應錯誤的可重試性判斷（僅標記狀態；排程策略由 einvoiceSync 負責）。
 * 408／429／5xx 為暫時性；其餘 4xx（含憑證失效）視為不可排程重試。
 */
export function isRetryableProviderStatus(status: number): boolean {
  const code = Number(status) || 0;
  if (code === 408 || code === 429) return true;
  return code >= 500 && code <= 599;
}

/**
 * 依 HTTP 狀態產生使用者可讀的錯誤訊息；訊息不含憑證內容。
 */
export function providerErrorMessage(status: number): string {
  const code = Number(status) || 0;
  if (code === 401 || code === 403) return '發票載具憑證已失效，請重新綁定手機條碼載具';
  if (code === 408) return '財政部電子發票服務逾時，請稍後再試';
  if (code === 429) return '財政部電子發票服務暫時限制查詢，請稍後再試';
  if (code >= 500 && code <= 599) return '財政部電子發票服務暫時無法使用，請稍後再試';
  if (code > 0) return `財政部電子發票服務回應異常（HTTP ${code}）`;
  return '無法連線財政部電子發票服務';
}
