// lib/reportCurrency.ts — 報表基準幣別（issue #255）零相依共用邏輯。
//
// 刻意不 import decimal.js／lib/db 等伺服器依賴：這個模組同時被
// server（app/api/reports）與 client（components/features/reports）使用，
// 比照 lib/apiIntegrationUi.ts 的作法，避免把重量級依賴帶進 client bundle。
// decimal.js 換算集中在 lib/reportCurrencyConversion.ts。

import { isValidCurrency } from './iso4217';

/** 未指定基準幣別時的預設值（既有報表行為：一律以 TWD 等值呈現）。 */
export const REPORT_BASE_CURRENCY_DEFAULT = 'TWD';

/**
 * 匯率來源（與 lib/exchangeRateCache.ts 的 source 字串、exchange_rates.is_manual 對應）。
 * - identity：基準幣別即 TWD，無須換算
 * - manual：使用者於匯率設定手動輸入
 * - exchangerate-api：全球即時匯率 API（含沿用既有快取的案例）
 * - default：系統預設匯率（使用者尚未設定該幣別）
 */
export const REPORT_RATE_SOURCES = ['identity', 'manual', 'exchangerate-api', 'default'] as const;

export type ReportRateSource = (typeof REPORT_RATE_SOURCES)[number];

/** 匯率來源 → i18n 鍵（identity 僅用於 TWD 基準，UI 不顯示來源說明）。 */
export const REPORT_RATE_SOURCE_LABEL_KEYS: Record<ReportRateSource, string> = {
  identity: 'features.reports.rateSourceIdentity',
  manual: 'features.reports.rateSourceManual',
  'exchangerate-api': 'features.reports.rateSourceApi',
  default: 'features.reports.rateSourceDefault',
};

export function isReportRateSource(value: unknown): value is ReportRateSource {
  return typeof value === 'string' && (REPORT_RATE_SOURCES as readonly string[]).includes(value);
}

/** 匯率來源的 i18n 鍵；未知來源回傳 null（呼叫端改顯示原始字串）。 */
export function reportRateSourceLabelKey(source: unknown): string | null {
  return isReportRateSource(source) ? REPORT_RATE_SOURCE_LABEL_KEYS[source] : null;
}

export function isReportRateSourceLabelKeyKnown(source: unknown): boolean {
  return reportRateSourceLabelKey(source) !== null;
}

/**
 * 匯率來源的「來源語言（zh-TW）」文字。
 *
 * CSV 匯出沿用既有匯出端點的慣例（表頭與型別皆為固定中文字串，見
 * app/api/transactions/export/route.ts），因此需要一份不經 i18n 執行期的
 * 對照表；此表與 REPORT_RATE_SOURCE_LABEL_KEYS 指向的字典值必須一致，
 * 由 tests/lib/reportCurrency.test.ts 斷言兩者同步，避免 CSV 與畫面文案漂移。
 */
export const REPORT_RATE_SOURCE_SOURCE_LABELS: Record<ReportRateSource, string> = {
  identity: '基準幣別為 TWD，無須換算',
  manual: '手動輸入匯率',
  'exchangerate-api': '全球即時匯率 API（沿用既有快取）',
  default: '系統預設匯率（尚未設定該幣別）',
};

/** 匯率來源的固定中文字串（供 CSV 匯出等非 i18n 執行期情境使用）。 */
export function reportRateSourceLabel(source: unknown): string {
  return isReportRateSource(source) ? REPORT_RATE_SOURCE_SOURCE_LABELS[source] : String(source ?? '');
}

/**
 * 解析基準幣別參數：未指定／空白 → 預設 TWD；非 ISO 4217 白名單 → null（呼叫端回 400）。
 */
export function resolveReportBaseCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined) return REPORT_BASE_CURRENCY_DEFAULT;
  const code = String(raw).trim().toUpperCase();
  if (!code) return REPORT_BASE_CURRENCY_DEFAULT;
  return isValidCurrency(code) ? code : null;
}

/**
 * 基準幣別選項：只保留 ISO 4217 白名單內的幣別，TWD（預設）置頂、其餘依字母排序。
 * 傳入的 current 一律保留（深層連結帶入的幣別即使不在可用清單內也要能顯示），
 * 但同樣須通過白名單驗證。
 */
export function reportBaseCurrencyOptions(available: unknown, current?: unknown): string[] {
  const codes = new Set<string>([REPORT_BASE_CURRENCY_DEFAULT]);
  const add = (value: unknown) => {
    const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (code && isValidCurrency(code)) codes.add(code);
  };
  if (Array.isArray(available)) available.forEach(add);
  add(current);
  return [...codes].sort((a, b) => (
    a === REPORT_BASE_CURRENCY_DEFAULT ? -1
      : b === REPORT_BASE_CURRENCY_DEFAULT ? 1
        : a.localeCompare(b)
  ));
}

/**
 * 基準幣別的顯示小數位數。
 *
 * 以 Intl 的最小單位為準，但 TWD 例外固定為 0：既有報表一律以整數呈現台幣
 * （`NT$ 3,000`），預設行為必須維持不變。實測此函式與 server 端
 * `lib/moneyDecimal.ts` 的 getSmallestUnit() 在全部 169 個 ISO 4217 代碼上
 * 完全一致（僅 TWD 為刻意例外），該等價性由 tests/lib/reportCurrency.test.ts
 * 逐一代碼斷言，避免兩處漂移。
 */
export function reportCurrencyFractionDigits(currency: string): number {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!code || code === REPORT_BASE_CURRENCY_DEFAULT) return 0;
  try {
    const resolved = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions();
    const digits = resolved.maximumFractionDigits;
    return typeof digits === 'number' && digits >= 0 ? digits : 2;
  } catch {
    return 2;
  }
}

/**
 * 基準幣別金額格式化（client／server 皆可用，零相依）。
 * 預設 TWD 輸出與既有報表完全一致（`NT$ 3,000`，整數、無小數）。
 */
export function formatReportMoney(
  amount: number | string,
  baseCurrency: string = REPORT_BASE_CURRENCY_DEFAULT,
  localeTag = 'zh-TW',
): string {
  const code = typeof baseCurrency === 'string' && baseCurrency.trim() ? baseCurrency.trim().toUpperCase() : REPORT_BASE_CURRENCY_DEFAULT;
  const num = Number(amount) || 0;
  const digits = reportCurrencyFractionDigits(code);
  if (code === REPORT_BASE_CURRENCY_DEFAULT) {
    const rounded = Math.round(num);
    const text = localeTag ? rounded.toLocaleString(localeTag) : String(rounded);
    return `NT$ ${text}`;
  }
  const text = localeTag
    ? num.toLocaleString(localeTag, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : num.toFixed(digits);
  return `${text} ${code}`;
}
