// lib/reportCurrencyRate.ts — 報表基準幣別匯率解析（issue #255）。
//
// 刻意重用既有匯率快取，不新增任何外部呼叫：`exchange_rates` 表即既有快取鏈的
// 落地層——`app/api/exchange-rates` 的自動更新與 `lib/exchangeRateHelpers.ts`
// 的 syncExchangeRatesFromGlobalAPI()（含 sharedAutoRateCache 30 分鐘 TTL）都會
// 寫入此表，並以 `is_manual` 區分手動輸入與 API 來源。報表端只讀此表，因此
// 端點維持零網路相依與固定回應時間（既有 10 秒輪詢不受影響），來源與時間戳
// 也直接取自同一列，不會與匯率設定頁顯示的數字不一致。
//
// 換算語意：報表彙總項（transactions.amount）本身即 TWD 等值，因此基準幣別
// 換算只有一步——除以該基準幣別對 TWD 的匯率（rate_to_twd）。匯率優先沿用
// 使用者匯率列與既有 exchangeRateCache 30 分鐘快取；快取未命中／過期才用
// 系統預設值，不在報表輪詢中另行發出外部 HTTP 請求。
//
// 本檔為零相依純邏輯（僅 decimal.js 與其他純模組），刻意不 import lib/db，
// 讓換算與來源判定可在無 PostgreSQL 環境下完整測試；實際讀取 exchange_rates
// 的包裝見 lib/reportCurrencyContext.ts。

import Decimal from 'decimal.js';
import { EXCHANGE_RATE_CACHE_TTL_MS } from './exchangeRateCache';
import { isValidCurrency } from './iso4217';
import { toIsoUtc } from './userTime';
import { REPORT_BASE_CURRENCY_DEFAULT, type ReportRateSource } from './reportCurrency';
import { isUsableReportRate } from './reportCurrencyConversion';

export interface ReportRateInfo {
  baseCurrency: string;
  /** 1 單位基準幣別值多少 TWD；基準幣別為 TWD 時固定為 1。 */
  rateToBase: string;
  source: ReportRateSource;
  /** 匯率來源的更新時間（ISO 8601 UTC，毫秒精度）；系統預設值／identity 無來源時間戳時為 null。 */
  fetchedAt: string | null;
}

export interface ReportCurrencyContext {
  rate: ReportRateInfo;
  /** 可換算的幣別（ISO 4217 白名單內且有可用匯率），供 UI 選擇器使用。 */
  availableCurrencies: string[];
}

export interface ExchangeRateRow {
  currency: string | null;
  rate_to_twd: string | number | null;
  updated_at: string | number | null;
  is_manual: string | number | null;
}

export interface ResolvedRate {
  rateToTwd: string;
  source: ReportRateSource;
  /** 匯率所屬列的更新時間（ms）；0 表示非來自使用者設定（identity／系統預設）。 */
  updatedAt: number;
}

export interface SharedCachedRate {
  rate: string;
  fetchedAt: number;
  source: string;
}

/** 正規化幣別代碼（與 lib/accountHelpers.ts normalizeCurrency 同語意，但零相依）。 */
export function normalizeReportCurrency(code: unknown): string {
  const c = String(code ?? REPORT_BASE_CURRENCY_DEFAULT).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : REPORT_BASE_CURRENCY_DEFAULT;
}

/**
 * 解析單一幣別對 TWD 的匯率。
 * 優先序：使用者手動匯率 → 較新的既有共用快取（30 分鐘 TTL）→ 使用者同步匯率 → 系統預設匯率。
 * 所有時間戳沿用原始匯率來源；無有效來源時回傳 null，代表無法安全換算。
 */
export function resolveRateToTwdFromRows(
  currency: string,
  rows: ExchangeRateRow[],
  defaults: Record<string, number>,
  cachedRates: ReadonlyMap<string, SharedCachedRate> = new Map(),
  nowMs: number = Date.now(),
): ResolvedRate | null {
  const target = normalizeReportCurrency(currency);
  if (target === REPORT_BASE_CURRENCY_DEFAULT) {
    return { rateToTwd: '1', source: 'identity', updatedAt: 0 };
  }
  // 白名單外的代碼一律視為無法換算，與 availableCurrenciesFromRows() 的過濾一致
  // （呼叫端已先驗證，此處為第二道防線，避免以非 ISO 4217 代碼產出匯率資訊）。
  if (!isValidCurrency(target)) return null;

  const row = (Array.isArray(rows) ? rows : []).find(r => normalizeReportCurrency(r?.currency) === target);
  const rowUsable = !!row && isUsableReportRate(row.rate_to_twd);
  const rowUpdatedAt = Number(row?.updated_at) || 0;
  if (rowUsable && Number(row?.is_manual)) {
    return {
      rateToTwd: new Decimal(String(row!.rate_to_twd)).toString(),
      source: 'manual',
      updatedAt: rowUpdatedAt,
    };
  }

  const cached = cachedRates.get(target);
  const cacheAge = nowMs - Number(cached?.fetchedAt);
  const cacheUsable = !!cached
    && cached.source === 'exchangerate-api'
    && Number.isFinite(Number(cached.fetchedAt))
    && cacheAge >= 0
    && cacheAge < EXCHANGE_RATE_CACHE_TTL_MS
    && isUsableReportRate(cached.rate);
  if (cacheUsable && (!rowUsable || Number(cached!.fetchedAt) > rowUpdatedAt)) {
    return {
      rateToTwd: new Decimal(String(cached!.rate)).toString(),
      source: 'exchangerate-api',
      updatedAt: Number(cached!.fetchedAt),
    };
  }

  if (rowUsable) {
    return {
      rateToTwd: new Decimal(String(row!.rate_to_twd)).toString(),
      source: 'exchangerate-api',
      updatedAt: rowUpdatedAt,
    };
  }

  const fallback = defaults?.[target];
  if (isUsableReportRate(fallback)) {
    return {
      rateToTwd: new Decimal(String(fallback)).toString(),
      // 系統預設匯率非使用者設定值（使用者尚未設定該幣別）。
      source: 'default',
      updatedAt: 0,
    };
  }

  return null;
}

/** 可換算幣別清單：使用者匯率列、30 分鐘內共用快取與系統預設值，皆須通過 ISO 4217 白名單。 */
export function availableCurrenciesFromRows(
  rows: ExchangeRateRow[],
  defaults: Record<string, number>,
  cachedRates: ReadonlyMap<string, SharedCachedRate> = new Map(),
  nowMs: number = Date.now(),
): string[] {
  const codes = new Set<string>();
  const add = (value: unknown) => {
    const code = normalizeReportCurrency(value);
    if (isValidCurrency(code)) codes.add(code);
  };

  add(REPORT_BASE_CURRENCY_DEFAULT);
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && isUsableReportRate(row.rate_to_twd)) add(row.currency);
  }
  for (const [code, rate] of Object.entries(defaults || {})) {
    if (isUsableReportRate(rate)) add(code);
  }
  for (const [code, cached] of cachedRates) {
    const age = nowMs - Number(cached?.fetchedAt);
    if (cached?.source === 'exchangerate-api' && age >= 0 && age < EXCHANGE_RATE_CACHE_TTL_MS && isUsableReportRate(cached.rate)) add(code);
  }

  return [...codes].sort();
}

/**
 * 由已讀出的 exchange_rates 列組出報表所需的匯率資訊。
 * baseCurrency 須為已驗證的 ISO 4217 代碼；無可用匯率時回傳 null（呼叫端回 400）。
 * 無實際取得時間者（identity／系統預設）回傳 null，避免把報表請求時間冒充匯率更新時間。
 */
export function buildReportCurrencyContext(
  rows: ExchangeRateRow[],
  baseCurrency: string,
  defaults: Record<string, number>,
  nowMs: number = Date.now(),
  cachedRates: ReadonlyMap<string, SharedCachedRate> = new Map(),
): ReportCurrencyContext | null {
  const base = normalizeReportCurrency(baseCurrency);
  const resolved = resolveRateToTwdFromRows(base, rows, defaults, cachedRates, nowMs);
  if (!resolved) return null;

  const rateToBase = new Decimal(resolved.rateToTwd);
  if (!rateToBase.gt(0)) return null;

  return {
    rate: {
      baseCurrency: resolved.source === 'identity' ? REPORT_BASE_CURRENCY_DEFAULT : base,
      rateToBase: rateToBase.toString(),
      source: resolved.source,
      fetchedAt: resolved.updatedAt > 0 ? toIsoUtc(resolved.updatedAt) : null,
    },
    availableCurrencies: availableCurrenciesFromRows(rows, defaults, cachedRates, nowMs),
  };
}
