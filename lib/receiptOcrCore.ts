// lib/receiptOcrCore.ts — 收據 OCR 的「純邏輯」核心（issue #250）。
//
// 本檔刻意不碰 DB、不碰檔案系統、不呼叫任何真實外部服務，因此可用純 Node 單元測試
// （見 tests/lib/receiptOcrCore.test.ts）。伺服器端整合（附件解密、環境變數、
// 稽核）見 lib/receiptOcr.ts。
//
// 供應商為可插拔介面：
//   - none ：未設定供應商，直接回報「未設定」讓前端優雅降級為手動輸入。
//   - http ：以環境變數指定的自架／第三方端點（僅送圖片，不送任何憑證內容）。
//
// 安全與正確性原則：
//   - 金額一律以 decimal.js 解析並驗證格式，不接受 NaN／Infinity／負數／超長小數。
//   - 日期一律經 lib/userTime 的時區工具解析，輸出嚴格 ISO `YYYY-MM-DD`。
//   - OCR 結果只是「草稿預填」，呼叫端不得直接寫入 DB。

import Decimal from 'decimal.js';
import { isValidIsoDate, todayInUserTz } from './userTime';

export type ReceiptOcrProviderName = 'none' | 'http';

/** 從圖片辨識出的原始文字（供應商只需回傳文字，解析留在本檔以確保一致性）。 */
export interface ReceiptOcrRawResult {
  text: string;
  /** 供應商自行解析出的欄位（可選）；仍會經過本檔的驗證與正規化。 */
  fields?: ReceiptOcrFields;
}

export interface ReceiptOcrFields {
  amount?: unknown;
  date?: unknown;
  merchant?: unknown;
  currency?: unknown;
}

export interface ReceiptOcrProvider {
  name: ReceiptOcrProviderName;
  /** 是否已具備執行所需設定（例如端點 URL、API 金鑰）。 */
  isConfigured(): boolean;
  recognize(input: { image: Buffer; mimeType: string }): Promise<ReceiptOcrRawResult>;
}

export interface ReceiptOcrDraft {
  amount: number | null;
  currency: string | null;
  date: string | null;
  merchant: string | null;
}

export interface ReceiptOcrParseResult {
  draft: ReceiptOcrDraft;
  /** 解析後的警示（例如金額格式不合法被忽略），供前端提示使用者。 */
  warnings: string[];
  /** 是否至少預填了一個欄位。 */
  hasFields: boolean;
}

export const RECEIPT_OCR_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const RECEIPT_OCR_DEFAULT_TIMEOUT_MS = 15_000;
const MERCHANT_MAX_LENGTH = 80;
const AMOUNT_MAX_LENGTH = 24;
/** 金額上限（1 兆）：超過此值幾乎必為 OCR 雜訊，直接視為無法辨識。 */
const AMOUNT_MAX_VALUE = new Decimal(1e12);
const CURRENCY_CODES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD'] as const;

/** 常見的收據關鍵字 → 欄位權重（越前面越優先作為金額候選）。 */
// Final payable-total labels precede subtotal labels so mixed-language receipts prefer the final amount.
const AMOUNT_LABELS = ['應付', '實付', '總計', '合計', '總額', 'total due', 'amount due', 'total', 'amount', '小計', 'subtotal'];
const DATE_LABELS = ['日期', '交易時間', '時間', 'date'];
const MERCHANT_LABELS = ['店家', '商店', '店名', '商家', 'merchant', 'store'];

function clampText(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * 以 decimal.js 驗證並正規化金額字串。
 * 僅接受「可選符號 + 數字（含千分位逗號）+ 可選小數」的形狀，拒絕 NaN／Infinity。
 * @returns 正規化後的數字字串，或 null（格式不合法）。
 */
export function normalizeReceiptAmount(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text || text.length > AMOUNT_MAX_LENGTH) return null;
  // 允許前後雜訊（貨幣符號、全形字）但不接受夾雜文字，避免把日期誤判為金額。
  // 負號必須緊貼數字（`-5` 為負，但 `折 - 5` 這類雜訊不視為負數輸入）。
  const match = text.match(/^[^\d+-]{0,4}(-?\d[\d,]*(?:\.\d{1,3})?)[^\d]{0,4}$/);
  if (!match) return null;
  const numeric = match[1].replace(/,/g, '');
  // 千分位必須成組，否則 "1,23" 這類雜訊會被當成 123。
  const grouped = match[1].split('.')[0];
  if (grouped.includes(',') && !/^-?\d{1,3}(,\d{3})+$/.test(grouped)) return null;
  let value: Decimal;
  try {
    value = new Decimal(numeric);
  } catch {
    return null;
  }
  if (!value.isFinite() || value.isNaN()) return null;
  if (value.lte(0)) return null;
  if (value.gt(AMOUNT_MAX_VALUE)) return null;
  // 正規化：最多兩位小數（收據最小單位），整數不加小數點，非零小數不補尾端 0。
  const fixed = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

/**
 * 解析日期字串為嚴格 ISO `YYYY-MM-DD`；支援 `YYYY-MM-DD`、`YYYY/M/D`、`YYYYMMDD`、
 * 民國年（`103/01/02`）與「今天／昨天」等相對詞，一律以使用者時區換算。
 * @returns ISO 日期或 null（無效日期如 2026-02-30 亦回 null）。
 */
export function normalizeReceiptDate(raw: unknown, timezone: string): string | null {
  if (raw === null || raw === undefined) return null;
  const text = clampText(raw, 40);
  if (!text) return null;
  const tz = timezone || 'Asia/Taipei';

  const relative = parseRelativeDate(text, tz);
  if (relative) return relative;

  const absolute = parseAbsoluteDate(text);
  if (absolute) return absolute;

  // 純 7 位數字（民國年 MMDD，例如 1030102）或「3碼年 + 月日」形式。
  return null;
}

function parseRelativeDate(text: string, tz: string): string | null {
  const base = todayInUserTz(tz || 'Asia/Taipei');
  if (/昨天|昨日/.test(text)) {
    const d = new Date(`${base}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (/今天|今日/.test(text)) return base;
  return null;
}

// 日期／時間樣式：金額候選掃描前必須先行移除，避免把 `2026-10-07` 的年份當成金額。
const DATE_LIKE_PATTERNS = [
  /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g,
  /\b\d{3}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
  /\b\d{8}\b/g,
  /\d{1,2}:\d{2}(?::\d{2})?/g,
];

/** 移除日期／時間片段，讓後續的數字掃描只看到金額候選。 */
export function stripDateLikeTokens(text: string): string {
  let result = String(text || '');
  for (const pattern of DATE_LIKE_PATTERNS) result = result.replace(pattern, ' ');
  return result;
}

function stripCompactRocTokensWithoutDateContext(text: string): string {
  return String(text || '').replace(/\b1\d{6}\b/g, (token) => isCompactRocDateToken(token) ? ' ' : token);
}

function parseAbsoluteDate(text: string): string | null {
  const iso = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return buildIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const compact = text.match(/(?:^|\D)(\d{8})(?:\D|$)/);
  if (compact) {
    const raw = compact[1];
    return buildIsoDate(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)), Number(raw.slice(6, 8)));
  }

  // 民國年緊湊格式：3 碼年 + MMDD（例如 1130102 = 2024-01-02）。
  const compactRoc = text.match(/(?:^|\D)(1\d{2})(\d{2})(\d{2})(?:\D|$)/);
  if (compactRoc) {
    return buildIsoDate(Number(compactRoc[1]) + 1911, Number(compactRoc[2]), Number(compactRoc[3]));
  }

  // 民國年：3 碼年（100~199 對應 2011~2099）
  const roc = text.match(/(?:^|\D)(\d{3})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  if (roc) {
    const year = Number(roc[1]) + 1911;
    if (year >= 1912 && year <= 2999) return buildIsoDate(year, Number(roc[2]), Number(roc[3]));
  }
  return null;
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  const candidate = `${year}-${monthText}-${dayText}`;
  return isValidIsoDate(candidate) ? candidate : null;
}

/** 從文字擷取幣別代碼；找不到時回 null（由呼叫端決定是否套用預設幣別）。 */
/** A direct upload must declare its MIME type; attachment requests use stored metadata instead. */
export function normalizeReceiptOcrMimeType(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const mimeType = raw.trim().toLowerCase();
  return mimeType || null;
}

export function normalizeReceiptCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).toUpperCase();
  for (const code of CURRENCY_CODES) {
    if (new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`).test(text)) return code;
  }
  if (/NT\$|\$NT/.test(text)) return 'TWD';
  if (/¥|JPY|円/.test(text)) return 'JPY';
  if (/\$|USD/.test(text)) return 'USD';
  return null;
}

/** 正規化店家名稱；過濾過短的雜訊並截斷過長內容。 */
export function normalizeReceiptMerchant(raw: unknown): string | null {
  const text = clampText(raw, MERCHANT_MAX_LENGTH);
  if (text.length < 2) return null;
  // 純數字（多為日期／金額誤判）不視為店家名稱。
  if (/^[\d\s.,:/\\-]+$/.test(text)) return null;
  return text;
}

function lineValue(text: string, labels: string[]): string | null {
  const lines = text.split(/\r?\n/);
  for (const label of labels) {
    const isEnglishLabel = /^[a-z ]+$/i.test(label);
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // label 僅來自內部固定常數（AMOUNT_LABELS/DATE_LABELS/MERCHANT_LABELS），且所有正規表示式
    // 特殊字元已逐一跳脫，不會受使用者輸入影響，無 ReDoS 風險。
    const labelPattern = isEnglishLabel
      ? new RegExp(`(^|[^a-z])${escapedLabel}(?=$|[^a-z])`, 'i') // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      : null;
    for (const line of lines) {
      const idx = labelPattern
        ? (() => {
            const match = labelPattern.exec(line);
            return match ? match.index + match[1].length : -1;
          })()
        : line.indexOf(label);
      if (idx < 0) continue;
      const tail = line.slice(idx + label.length).replace(/^[\s:：=]+/, '').trim();
      if (tail) return tail;
    }
  }
  return null;
}

function isCompactRocDateToken(value: string): boolean {
  return /^1\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(value);
}

function stripCompactRocDatesFromLabeledLines(text: string): string {
  return String(text || '').split(/\r?\n/).map((line) => {
    const hasDateLabel = DATE_LABELS.some((label) => {
      // label 來自內部固定常數 DATE_LABELS，且已驗證僅含 a-z 字元，不含正規表示式特殊字元，無 ReDoS 風險。
      if (/^[a-z]+$/i.test(label)) return new RegExp(`(^|[^a-z])${label}(?=$|[^a-z])`, 'i').test(line); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      return line.includes(label);
    });
    return hasDateLabel ? line.replace(/\b1\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b/g, ' ') : line;
  }).join('\n');
}

function allAmountCandidates(text: string): string | null {
  const matches = stripDateLikeTokens(stripCompactRocDatesFromLabeledLines(text)).match(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,3})?/g);
  if (!matches) return null;
  let best: string | null = null;
  let bestValue: Decimal | null = null;
  for (const candidate of matches) {
    const normalized = normalizeReceiptAmount(candidate);
    if (!normalized) continue;
    const value = new Decimal(normalized);
    if (bestValue === null || value.gt(bestValue)) {
      best = normalized;
      bestValue = value;
    }
  }
  return best;
}

/**
 * 從未標註的文字中猜測店家名稱：取第一個「不含數字、且含至少兩個字母」的行。
 * 找不到時回 null；寧可留空讓使用者自行輸入，也不要填入錯誤的猜測值。
 */
function guessMerchantFromText(text: string): string | null {
  for (const rawLine of stripDateLikeTokens(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line.length < 2 || line.length > MERCHANT_MAX_LENGTH) continue;
    if (/\d/.test(line)) continue;
    if (!/\p{L}{2,}/u.test(line)) continue;
    return line;
  }
  return null;
}

/**
 * 由供應商回傳的文字／欄位解析出草稿。供應商提供的 fields 優先，缺漏時才以文字啟發式補齊。
 * 任何欄位解析失敗只會加入 warnings，不會拋錯（OCR 失敗必須優雅降級）。
 */
export function parseReceiptOcrResult(
  raw: ReceiptOcrRawResult | null | undefined,
  options: { timezone: string; defaultCurrency?: string | null },
): ReceiptOcrParseResult {
  const warnings: string[] = [];
  const draft: ReceiptOcrDraft = { amount: null, currency: null, date: null, merchant: null };
  if (!raw) return { draft, warnings: ['ocr_empty_result'], hasFields: false };

  const text = String(raw.text || '');
  const fields = raw.fields || {};
  const labelledAmount = lineValue(text, AMOUNT_LABELS);

  const hasAuthoritativeAmount = fields.amount !== undefined || labelledAmount !== null;
  const authoritativeAmount = fields.amount !== undefined ? fields.amount : labelledAmount;
  const amountRaw = hasAuthoritativeAmount
    ? normalizeReceiptAmount(authoritativeAmount)
    : allAmountCandidates(text);
  if (amountRaw !== null) {
    const parsedAmount = Number(amountRaw);
    if (Number.isFinite(parsedAmount)) draft.amount = parsedAmount;
    else warnings.push('amount_invalid');
  } else if (hasAuthoritativeAmount) {
    warnings.push('amount_invalid');
  } else if (text.trim() !== '') {
    warnings.push('amount_not_found');
  }

  const currencySrc = fields.currency !== undefined
    ? fields.currency
    : `${labelledAmount || ''} ${text}`;
  draft.currency = normalizeReceiptCurrency(currencySrc) || normalizeReceiptCurrency(options.defaultCurrency) || null;

  const labelledDate = lineValue(text, DATE_LABELS);
  const dateSrc = fields.date !== undefined
    ? fields.date
    : labelledDate ?? stripCompactRocTokensWithoutDateContext(text);
  const resolvedDate = normalizeReceiptDate(dateSrc, options.timezone);
  if (resolvedDate) draft.date = resolvedDate;
  else if (fields.date !== undefined) warnings.push('date_invalid');

  if (fields.merchant !== undefined) {
    draft.merchant = normalizeReceiptMerchant(fields.merchant);
  }
  if (!draft.merchant) {
    draft.merchant = normalizeReceiptMerchant(lineValue(text, MERCHANT_LABELS))
      || normalizeReceiptMerchant(guessMerchantFromText(text));
  }

  const hasFields = draft.amount !== null || draft.date !== null || draft.merchant !== null;
  return { draft, warnings, hasFields };
}

// ─── 供應商 ───────────────────────────────────────────────────

/**
 * 無供應商：未設定 OCR 供應商時的降級路徑。不呼叫任何外部服務，
 * 由前端提示使用者改為手動輸入。
 */
export function createNoneProvider(): ReceiptOcrProvider {
  return {
    name: 'none',
    isConfigured: () => false,
    async recognize() {
      throw new Error('OCR 供應商未設定');
    },
  };
}

export interface HttpProviderOptions {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
}

/**
 * HTTP 供應商：把圖片 POST 到環境變數指定的端點。
 * 端點必須為 http(s) 絕對網址；回應可為純文字或 JSON（{ text | amount | date | merchant }）。
 * 憑證一律來自環境變數，不會寫入版控，也不隨回應外洩。
 */
export function createHttpProvider(options: HttpProviderOptions): ReceiptOcrProvider {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : RECEIPT_OCR_DEFAULT_TIMEOUT_MS;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : RECEIPT_OCR_MAX_IMAGE_BYTES;

  return {
    name: 'http',
    isConfigured: () => isValidEndpoint(options.endpoint, !!options.apiKey),
    async recognize({ image, mimeType }) {
      if (!isValidEndpoint(options.endpoint, !!options.apiKey)) {
        throw new Error(options.apiKey ? '設定 API 金鑰時 OCR 端點必須使用 HTTPS' : 'OCR 端點設定無效');
      }
      if (image.length === 0) throw new Error('影像內容為空');
      if (image.length > maxBytes) throw new Error('影像超過 OCR 上限');
      const doFetch = options.fetchImpl || fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(options.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Image-Mime-Type': mimeType || 'application/octet-stream',
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: new Uint8Array(image),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`OCR 供應商回應 ${response.status}`);
        const contentType = String(response.headers?.get?.('content-type') || '');
        if (contentType.includes('application/json')) {
          const payload = (await response.json()) as Record<string, unknown> | null;
          if (!payload || typeof payload !== 'object') return { text: '' };
          const fields = normalizeProviderFields(payload);
          const text = typeof payload.text === 'string'
            ? payload.text
            : [fields.amount, fields.date, fields.merchant]
              .filter((v) => v !== undefined && v !== null && v !== '')
              .join('\n');
          return { text, fields };
        }
        const text = await response.text();
        return { text: safeJsonText(text) ?? text };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * 只挑出已知欄位，避免把供應商回應中的其他內容（可能含憑證或個資）帶進流程。
 * 同時接受 `total` 作為 `amount` 的別名。
 */
function normalizeProviderFields(payload: Record<string, unknown>): ReceiptOcrFields {
  const pick = (a: string, b?: string) => payload[a] ?? (b ? payload[b] : undefined);
  const fields: ReceiptOcrFields = {};
  const amount = pick('amount', 'total');
  if (amount !== undefined) fields.amount = amount;
  const date = pick('date');
  if (date !== undefined) fields.date = date;
  const merchant = pick('merchant', 'store');
  if (merchant !== undefined) fields.merchant = merchant;
  const currency = pick('currency');
  if (currency !== undefined) fields.currency = currency;
  return fields;
}

function safeJsonText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') return parsed.text;
  } catch {
    return null;
  }
  return null;
}

function isValidEndpoint(endpoint: string, requiresHttps = false): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    if (!url.host) return false;
    return requiresHttps ? url.protocol === 'https:' : url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}


/**
 * 依設定的供應商名稱取得實作；未知名稱一律降級為 none（不拋錯，避免拖垮新增交易流程）。
 */
export function resolveReceiptOcrProvider(input: {
  provider?: string | null;
  endpoint?: string | null;
  apiKey?: string | null;
  timeoutMs?: number | null;
  maxBytes?: number | null;
  fetchImpl?: typeof fetch;
}): ReceiptOcrProvider {
  const name = String(input.provider || '').trim().toLowerCase();
  if (name === 'http') {
    const endpoint = String(input.endpoint || '').trim();
    return createHttpProvider({
      endpoint,
      apiKey: input.apiKey ? String(input.apiKey) : undefined,
      timeoutMs: Number(input.timeoutMs) || undefined,
      maxBytes: Number(input.maxBytes) || undefined,
      fetchImpl: input.fetchImpl,
    });
  }
  return createNoneProvider();
}
