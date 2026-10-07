// lib/reportCurrencyContext.ts — 報表基準幣別匯率的資料庫包裝（issue #255，server-only）。
//
// `exchange_rates` 使用者匯率列優先遵守手動／自動設定；另外合併既有
// `lib/exchangeRateCache.ts` process-wide cache 與 `exchangeRateHelpers.ts` 活躍的
// sharedAutoRateCache，並按原 fetchedAt、source 顯示依據，不額外發出 HTTP 請求；
// 最後才回退系統預設匯率。純換算規則維持於 lib/reportCurrencyRate.ts 以供測試。

import { queryAll } from './db';
import { DEFAULT_EXCHANGE_RATES } from './exchangeRateDefaults';
import { _cache } from './exchangeRateCache';
import { getSharedAutoRateCacheSnapshot } from './exchangeRateHelpers';
import {
  buildReportCurrencyContext,
  type ExchangeRateRow,
  type ReportCurrencyContext,
} from './reportCurrencyRate';

/** 讀取使用者匯率列（既有快取落地層），並組出報表所需的基準幣別匯率資訊。 */
export function getReportCurrencyContext(
  userId: string,
  baseCurrency: string,
  nowMs: number = Date.now(),
): ReportCurrencyContext | null {
  const rows = queryAll(
    'SELECT currency, rate_to_twd, updated_at, is_manual FROM exchange_rates WHERE user_id = ?',
    [userId],
  ) as unknown as ExchangeRateRow[];

  const cachedRates = new Map(_cache);
  for (const [currency, entry] of getSharedAutoRateCacheSnapshot()) {
    const existing = cachedRates.get(currency);
    if (!existing || entry.fetchedAt > existing.fetchedAt) {
      cachedRates.set(currency, { ...entry, source: 'exchangerate-api' });
    }
  }

  return buildReportCurrencyContext(rows, baseCurrency, DEFAULT_EXCHANGE_RATES, nowMs, cachedRates);
}
