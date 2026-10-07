// lib/einvoiceProvider.ts — 財政部電子發票整合服務平台的查詢用戶端（issue #253）
//
// 設計原則（對應 issue 驗收條件與 §4.3）：
//  1. endpoint 與憑證全部來自環境變數（EINVOICE_API_ENDPOINT / EINVOICE_API_APP_ID /
//     EINVOICE_API_KEY），不寫死任何真實服務網址或密鑰，也不把憑證寫進版控。
//  2. 供應商未設定或不可用時「優雅降級」：回傳結構化結果（configured=false /
//     status='skipped'）而非拋出未處理例外，呼叫端仍能正常回應使用者。
//  3. 逾時與回應大小都有上限；呼叫端可注入 fetch 以便測試以 stub 覆蓋，
//     因此自動化測試永不連線真實財政部 API。
//
// 本模組不碰 DB、不做稽核、不決定重試（重試決策見 lib/einvoiceCore.ts 與
// lib/einvoiceCarrier.ts），只負責「把外部 API 的結果轉成可用的資料或錯誤」。

import {
  isRetryableProviderStatus,
  normalizeInvoiceBatch,
  providerErrorMessage,
  type InvoiceProviderConfig,
  type NormalizedInvoice,
} from './einvoiceCore';

export const EINVOICE_REQUEST_TIMEOUT_MS = 10_000;
export const EINVOICE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
/** 單次查詢最長區間（天）；財政部查詢 API 亦限制區間，避免一次拉整年。 */
export const EINVOICE_MAX_RANGE_DAYS = 90;
export const EINVOICE_DEFAULT_RANGE_DAYS = 30;

export interface FetchInvoicesInput {
  config: InvoiceProviderConfig;
  carrierBarcode: string;
  verifyCode: string;
  /** 查詢起日（含），`YYYY-MM-DD`。 */
  startDate: string;
  /** 查詢迄日（含），`YYYY-MM-DD`。 */
  endDate: string;
  /** 測試注入點；未提供時使用全域 fetch。 */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type FetchInvoicesStatus = 'success' | 'failed' | 'skipped';

export interface FetchInvoicesResult {
  status: FetchInvoicesStatus;
  invoices: NormalizedInvoice[];
  /** 供應商回傳但無法對應欄位的筆數。 */
  skipped: number;
  /** 可顯示給使用者的錯誤訊息（不含憑證）。 */
  errorMessage: string;
  /** HTTP 狀態碼；未連線時為 0。 */
  httpStatus: number;
  /** 供應商是否可重試（暫時性錯誤）。 */
  retryable: boolean;
  provider: string;
}

function providerName(config: InvoiceProviderConfig): string {
  try {
    return new URL(config.endpoint).host;
  } catch {
    return 'einvoice';
  }
}

/** 由回應內容取出發票陣列；支援 `{ data: [...] }`／`{ invoices: [...] }` 外層包裝。 */
function extractInvoiceList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['data', 'invoices', 'details', 'result']) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return null;
}

class ResponseTooLargeError extends Error {}

async function readLimitedResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ResponseTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 呼叫財政部電子發票 API 查詢載具發票。
 *
 * 回傳一律為結構化結果；呼叫端不需要 try/catch 即可安全處理
 * 「未設定」「逾時」「憑證失效」「回應格式異常」等情境。
 */
export async function fetchCarrierInvoices(
  input: FetchInvoicesInput,
): Promise<FetchInvoicesResult> {
  const { config } = input;
  const base: Omit<FetchInvoicesResult, 'status' | 'errorMessage'> = {
    invoices: [],
    skipped: 0,
    httpStatus: 0,
    retryable: false,
    provider: config.endpoint ? providerName(config) : 'einvoice',
  };

  if (!config.configured) {
    // 優雅降級：未設定 endpoint／憑證時功能停用，不視為失敗也不累計退避。
    return {
      ...base,
      status: 'skipped',
      errorMessage: '尚未設定財政部電子發票 API（EINVOICE_API_ENDPOINT／EINVOICE_API_APP_ID／EINVOICE_API_KEY）',
    };
  }

  const doFetch = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? EINVOICE_REQUEST_TIMEOUT_MS);

  let response: Response;
  let text = '';
  try {
    response = await doFetch(config.endpoint, {
      method: 'POST',
      headers: {
        // 憑證只放在請求標頭，永不寫入日誌或回應。
        'Content-Type': 'application/json',
        'X-App-Id': config.appId,
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        carrierBarcode: input.carrierBarcode,
        verifyCode: input.verifyCode,
        startDate: input.startDate,
        endDate: input.endDate,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.ok) {
      // Keep the abort timer alive while reading the body, and enforce the
      // byte limit incrementally instead of buffering an unbounded response.
      text = await readLimitedResponseText(response, EINVOICE_MAX_RESPONSE_BYTES);
    }
  } catch (error) {
    const tooLarge = error instanceof ResponseTooLargeError;
    const aborted = controller.signal.aborted || (error as { name?: string })?.name === 'AbortError';
    return {
      ...base,
      status: 'failed',
      errorMessage: tooLarge
        ? '財政部電子發票服務回應過大，已中止處理'
        : aborted
          ? '財政部電子發票服務回應逾時，請稍後再試'
          : providerErrorMessage(0),
      retryable: !tooLarge,
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    return {
      ...base,
      status: 'failed',
      httpStatus: response.status,
      errorMessage: providerErrorMessage(response.status),
      retryable: isRetryableProviderStatus(response.status),
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return {
      ...base,
      status: 'failed',
      errorMessage: '財政部電子發票服務回應格式無法解析',
      retryable: false,
    };
  }

  const invoiceList = extractInvoiceList(payload);
  if (!invoiceList) {
    return {
      ...base,
      status: 'failed',
      httpStatus: response.status,
      errorMessage: '財政部電子發票服務回應格式無法解析',
      retryable: false,
    };
  }

  const batch = normalizeInvoiceBatch(invoiceList);
  return {
    ...base,
    status: 'success',
    invoices: batch.invoices,
    skipped: batch.skipped,
    errorMessage: batch.skipped > 0
      ? `${batch.skipped} 筆發票欄位不完整，已略過（${batch.skipReasons.join('、')}）`
      : '',
  };
}
