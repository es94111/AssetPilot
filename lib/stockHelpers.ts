import { queryAll, queryOne } from "./db";
import { getExchangeRateToTwd } from "./accountHelpers";
import { calcFifoLots } from "./moneyDecimal";
import {
  normalizeStockMarket,
  stockCurrency,
  isValidStockShareQuantity,
  type StockMarket,
} from "./stockMarket";
import {
  TW_DAY_TRADE_SELL_TAX_RATE,
  isDayTradeTaxEffective,
  isDayTradeEligibleStockType,
  resolveSellTaxRate,
} from "./twStockTaxRules";
import Decimal from "decimal.js";

export { normalizeStockMarket, stockCurrency } from "./stockMarket";
export type { StockMarket } from "./stockMarket";
export {
  TW_DAY_TRADE_SELL_TAX_RATE,
  TW_STOCK_SELL_TAX_RATE,
  TW_DAY_TRADE_ELIGIBLE_STOCK_TYPES,
  TW_DAY_TRADE_TAX_EFFECTIVE_FROM,
  TW_DAY_TRADE_TAX_EFFECTIVE_UNTIL,
  isDayTradeTaxEffective,
  isDayTradeEligibleStockType,
  resolveSellTaxRate,
} from "./twStockTaxRules";

export interface StockSettings {
  feeRate: number;
  feeDiscount: number;
  feeMinLot: number;
  feeMinOdd: number;
  sellTaxRateStock: number;
  sellTaxRateEtf: number;
  sellTaxRateWarrant: number;
  sellTaxMin: number;
}

export const DEFAULT_STOCK_SETTINGS: StockSettings = {
  feeRate: 0.001425,
  feeDiscount: 1,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};

function toNum(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundStockMoney(value: number, currency: string): number {
  const precision = currency === "TWD" ? 1 : 100;
  return Math.round(value * precision) / precision;
}

export function getStockSettings(userId: string): StockSettings {
  const row = queryOne("SELECT * FROM stock_settings WHERE user_id = ?", [
    userId,
  ]);
  if (!row) return { ...DEFAULT_STOCK_SETTINGS };
  return {
    feeRate: toNum(row.fee_rate, DEFAULT_STOCK_SETTINGS.feeRate),
    feeDiscount: toNum(row.fee_discount, DEFAULT_STOCK_SETTINGS.feeDiscount),
    feeMinLot: Math.round(
      toNum(row.fee_min_lot, DEFAULT_STOCK_SETTINGS.feeMinLot),
    ),
    feeMinOdd: Math.round(
      toNum(row.fee_min_odd, DEFAULT_STOCK_SETTINGS.feeMinOdd),
    ),
    sellTaxRateStock: toNum(
      row.sell_tax_rate_stock,
      DEFAULT_STOCK_SETTINGS.sellTaxRateStock,
    ),
    sellTaxRateEtf: toNum(
      row.sell_tax_rate_etf,
      DEFAULT_STOCK_SETTINGS.sellTaxRateEtf,
    ),
    sellTaxRateWarrant: toNum(
      row.sell_tax_rate_warrant,
      DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant,
    ),
    sellTaxMin: Math.round(
      toNum(row.sell_tax_min, DEFAULT_STOCK_SETTINGS.sellTaxMin),
    ),
  };
}

function getSellTaxRateByType(
  stockType: string,
  settings: StockSettings,
): number {
  if (stockType === "etf") return settings.sellTaxRateEtf;
  if (stockType === "warrant") return settings.sellTaxRateWarrant;
  return settings.sellTaxRateStock;
}

export function calcStockFee(
  amount: Decimal.Value,
  shares: Decimal.Value,
  settings: StockSettings,
  market: StockMarket | string = "TW",
): number {
  const decimalAmount = new Decimal(amount || 0);
  if (normalizeStockMarket(market) === "US" || !decimalAmount.gt(0)) return 0;
  const minFee = new Decimal(shares || 0).lt(1000)
    ? settings.feeMinOdd
    : settings.feeMinLot;
  const baseFee = decimalAmount
    .times(String(settings.feeRate))
    .times(String(settings.feeDiscount))
    .floor()
    .toNumber();
  return Math.max(minFee, baseFee);
}

/** Calculate stock notional from original decimal share/price inputs before fee calculation. */
export function calcStockFeeForTrade(
  shares: Decimal.Value,
  price: Decimal.Value,
  settings: StockSettings,
  market: StockMarket | string = "TW",
): number {
  const decimalShares = new Decimal(shares || 0);
  const amount = decimalShares.times(String(price || 0));
  return calcStockFee(amount, decimalShares, settings, market);
}

export function calcStockTax(
  amount: Decimal.Value,
  stockType: string,
  settings: StockSettings,
  market: StockMarket | string = "TW",
  dayTrade = false,
  transactionDate = "",
): number {
  const decimalAmount = new Decimal(amount || 0);
  if (normalizeStockMarket(market) === "US" || !decimalAmount.gt(0)) return 0;
  // 現股當沖賣出適用證券交易稅條例第 2 條之 2 的千分之一點五優惠稅率（見
  // lib/twStockTaxRules.ts）。非股票類型（ETF／權證）不適用該條優惠。
  const rate = resolveSellTaxRate(
    stockType,
    getSellTaxRateByType(stockType, settings),
    dayTrade,
    transactionDate,
  );
  const tax = decimalAmount.times(String(rate)).floor().toNumber();
  return Math.max(settings.sellTaxMin, tax);
}

/** Compute a sale's tax from source share/price values without binary-float multiplication. */
export function calcStockTaxForTrade(
  shares: number | string,
  price: number | string,
  stockType: string,
  settings: StockSettings,
  market: StockMarket | string = "TW",
  dayTrade = false,
  transactionDate = "",
): number {
  const amount = new Decimal(String(shares || 0)).times(String(price || 0));
  return calcStockTax(amount, stockType, settings, market, dayTrade, transactionDate);
}

/** 該筆交易是否可由使用者標記為現股當沖（僅台股股票類型）。 */
export function canMarkDayTrade(
  stockType: string,
  market: StockMarket | string = "TW",
  transactionDate = "",
): boolean {
  return (
    normalizeStockMarket(market) === "TW" &&
    isDayTradeEligibleStockType(stockType || "stock") &&
    isDayTradeTaxEffective(transactionDate)
  );
}

/**
 * Confirm available same-account, same-day cash purchases cover this tagged
 * day-trade sale. Multiple buy lots may be combined; all other same-day sells
 * consume available purchase quantity so buys cannot back more than one sale.
 */
export function hasQualifyingDayTradePurchase(
  userId: string,
  stockId: string,
  date: string,
  shares: Decimal.Value,
  accountId: string,
  excludeTransactionId = "",
): boolean {
  if (!accountId) return false;
  const rows = queryAll(
    "SELECT id, type, shares, day_trade, price, note, linked_dividend_id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND account_id = ?",
    [userId, stockId, date, accountId],
  );
  let purchased = new Decimal(0);
  let alreadySold = new Decimal(0);
  for (const row of rows) {
    const quantity = new Decimal(String(row.shares || 0));
    if (
      row.type === "buy" &&
      new Decimal(String(row.price || 0)).gt(0) &&
      !row.linked_dividend_id &&
      !isProtectedSyntheticTransaction(row.note)
    ) {
      purchased = purchased.plus(quantity);
    } else if (row.type === "sell" && String(row.id) !== excludeTransactionId) {
      alreadySold = alreadySold.plus(quantity);
    }
  }
  return purchased.minus(alreadySold).gte(new Decimal(String(shares || 0)));
}

export interface DayTradeTransactionChange {
  id: string;
  stockId: string;
  date: string;
  type: string;
  shares: Decimal.Value;
  price: Decimal.Value;
  accountId: string;
  dayTrade: boolean;
  note?: string | null;
  linkedDividendId?: string | null;
}

/** Ensure pending writes do not leave a day-trade sale under-backed by cash purchases. */
export function hasValidDayTradeCoverageAfterChanges(
  userId: string,
  changes: DayTradeTransactionChange[] = [],
  deletedIds: string[] = [],
): boolean {
  const changesById = new Map(changes.map((change) => [String(change.id), change]));
  const replacedIds = new Set([...changesById.keys(), ...deletedIds.map(String)]);
  const groups = new Map<string, { stockId: string; date: string; accountId: string }>();
  const addGroup = (stockId: string, date: string, accountId: string) => {
    const key = JSON.stringify([stockId, date, accountId]);
    groups.set(key, { stockId, date, accountId });
  };

  for (const id of replacedIds) {
    const existing = queryOne(
      "SELECT stock_id, date, account_id FROM stock_transactions WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing) addGroup(String(existing.stock_id), String(existing.date), String(existing.account_id || ""));
    const change = changesById.get(id);
    if (change) addGroup(change.stockId, change.date, change.accountId || "");
  }

  for (const group of groups.values()) {
    const rows = queryAll(
      "SELECT id, type, shares, day_trade, price, note, linked_dividend_id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND account_id = ?",
      [userId, group.stockId, group.date, group.accountId],
    ).filter((row) => !replacedIds.has(String(row.id)));
    const projected = [
      ...rows,
      ...changes.filter(
        (change) =>
          change.stockId === group.stockId &&
          change.date === group.date &&
          (change.accountId || "") === group.accountId,
      ),
    ];
    let hasDayTradeSale = false;
    let purchases = new Decimal(0);
    let sales = new Decimal(0);
    for (const row of projected) {
      const legacyFields = row as Record<string, unknown>;
      const quantity = new Decimal(String(row.shares || 0));
      if (
        row.type === "buy" &&
        new Decimal(String(row.price || 0)).gt(0) &&
        !legacyFields.linked_dividend_id &&
        !legacyFields.linkedDividendId &&
        !isProtectedSyntheticTransaction(row.note)
      ) {
        purchases = purchases.plus(quantity);
      } else if (row.type === "sell") {
        sales = sales.plus(quantity);
        if (normalizeDayTradeFlag(legacyFields.dayTrade ?? legacyFields.day_trade)) hasDayTradeSale = true;
      }
    }
    if (hasDayTradeSale && purchases.lt(sales)) return false;
  }
  return true;
}

/**
 * 正規化前端／API／CSV 傳入的布林旗標。
 * 僅接受明確真值（true / 1 / '1' / 'true' / 'yes' / '是'），
 * 其餘一律視為 false，避免字串 'false' 被 Boolean() 誤判為真。
 */
export function normalizeDayTradeFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "y" || v === "是";
  }
  return false;
}

export function normalizeStockSettingsInput(
  input: any = {},
  current: StockSettings = DEFAULT_STOCK_SETTINGS,
): StockSettings {
  const normalized: StockSettings = {
    feeRate: toNum(input.feeRate, current.feeRate),
    feeDiscount: toNum(input.feeDiscount, current.feeDiscount),
    feeMinLot: Math.round(toNum(input.feeMinLot, current.feeMinLot)),
    feeMinOdd: Math.round(toNum(input.feeMinOdd, current.feeMinOdd)),
    sellTaxRateStock: toNum(input.sellTaxRateStock, current.sellTaxRateStock),
    sellTaxRateEtf: toNum(input.sellTaxRateEtf, current.sellTaxRateEtf),
    sellTaxRateWarrant: toNum(
      input.sellTaxRateWarrant,
      current.sellTaxRateWarrant,
    ),
    sellTaxMin: Math.round(toNum(input.sellTaxMin, current.sellTaxMin)),
  };

  if (!(normalized.feeRate > 0 && normalized.feeRate <= 0.02))
    throw new Error("券商手續費率需介於 0 ~ 0.02");
  if (!(normalized.feeDiscount > 0 && normalized.feeDiscount <= 1))
    throw new Error("手續費折扣需介於 0 ~ 1");
  if (!(normalized.feeMinLot >= 0 && normalized.feeMinLot <= 1000))
    throw new Error("整股最低手續費需介於 0 ~ 1000");
  if (!(normalized.feeMinOdd >= 0 && normalized.feeMinOdd <= 1000))
    throw new Error("零股最低手續費需介於 0 ~ 1000");
  if (
    !(normalized.sellTaxRateStock >= 0 && normalized.sellTaxRateStock <= 0.02)
  )
    throw new Error("一般股票賣出稅率需介於 0 ~ 0.02");
  if (!(normalized.sellTaxRateEtf >= 0 && normalized.sellTaxRateEtf <= 0.02))
    throw new Error("ETF 賣出稅率需介於 0 ~ 0.02");
  if (
    !(
      normalized.sellTaxRateWarrant >= 0 &&
      normalized.sellTaxRateWarrant <= 0.02
    )
  )
    throw new Error("權證賣出稅率需介於 0 ~ 0.02");
  if (!(normalized.sellTaxMin >= 0 && normalized.sellTaxMin <= 100))
    throw new Error("賣出交易稅最低金額需介於 0 ~ 100");

  return normalized;
}

export function makeStockTxHash(
  date: string,
  symbol: string,
  type: string,
  shares: number,
  price: number,
  accountId: string,
  market: StockMarket | string = "TW",
): string {
  const HASH_SEP = "\x01";
  return [
    normalizeStockMarket(market),
    date || "",
    symbol || "",
    type || "",
    String(shares || ""),
    String(price || ""),
    accountId || "",
  ].join(HASH_SEP);
}

export function makeDividendHash(
  date: string,
  symbol: string,
  cashDividend: number,
  stockDividend: number,
  market: StockMarket | string = "TW",
): string {
  const HASH_SEP = "\x01";
  return [
    normalizeStockMarket(market),
    date || "",
    symbol || "",
    String(cashDividend || ""),
    String(stockDividend || ""),
  ].join(HASH_SEP);
}

// ── 股利再投資（DRIP，issue #263）───────────────────────────────
//
// 語意：現金股利入帳後不領出，改以「每股再投資價格」買回同一標的。系統在
// `stock_dividends.reinvest = 1` 時同步寫入一筆 synthetic buy 交易（`[DRIP]` 前綴），
// 讓既有 calcFifoLots() 自然把這批股票納入 FIFO 成本基礎，因此：
//   - 買進成本 = reinvest_shares × reinvest_price（可再加 reinvest_fee，見下）
//   - 未來賣出時成本基礎以此批次計入，已實現損益不需另寫特殊分支
//   - 未標記 reinvest 的股利完全不受影響（純現金股利不入 FIFO 佇列）

/** DRIP 合成交易的備註前綴（供刪除股利時比對連動刪除）。 */
export const DRIP_SYNTH_NOTE_PREFIX = "[DRIP] 股利再投資";

/**
 * 判斷某筆交易是否為 DRIP 合成買入。用於批次刪除保護／連動刪除，
 * 與既有 `[SYNTH] 股票股利配發` 合成交易相同模式。
 */
export function isDripSyntheticTransaction(note: unknown): boolean {
  return (
    typeof note === "string" && note.trimStart().startsWith(DRIP_SYNTH_NOTE_PREFIX)
  );
}

/** 既有股利合成交易（股票股利配發）判斷；供兩類合成交易共用防護。 */
export function isStockDividendSyntheticTransaction(note: unknown): boolean {
  return (
    typeof note === "string" &&
    /^(?:\[SYNTH\] 股票股利|股票股利配發)/.test(note.trimStart())
  );
}

/** 任一類合成交易（股利配發／DRIP 再投資）皆不可由交易頁直接刪除。 */
export function isProtectedSyntheticTransaction(note: unknown): boolean {
  return (
    isStockDividendSyntheticTransaction(note) ||
    isDripSyntheticTransaction(note)
  );
}

/**
 * Detect legacy stock-dividend synthetic buys that cannot be associated with
 * an unlinked dividend by stock, date, and share count. Legacy rows predate
 * linked_dividend_id; if an edit changed those fields, fail closed instead of
 * silently leaving an orphan FIFO lot.
 */
export function hasAmbiguousLegacyStockDividendTransactions(
  userId: string,
  stockId: string,
): boolean {
  const transactions = queryAll(
    "SELECT date, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
    [userId, stockId],
  );
  const dividends = queryAll(
    `SELECT sd.date, sd.stock_dividend_shares
     FROM stock_dividends sd
     WHERE sd.user_id = ? AND sd.stock_id = ? AND sd.stock_dividend_shares > 0
       AND NOT EXISTS (
         SELECT 1 FROM stock_transactions st
         WHERE st.user_id = sd.user_id AND st.stock_id = sd.stock_id
           AND st.linked_dividend_id = sd.id AND st.date = sd.date
           AND st.type = 'buy' AND st.price = 0
           AND ABS(st.shares - sd.stock_dividend_shares) < 0.001
           AND (st.note LIKE '[SYNTH] 股票股利%' OR st.note LIKE '股票股利配發%')
       )`,
    [userId, stockId],
  );
  const transactionCandidateCounts = transactions.map((tx) =>
    dividends.filter(
      (dividend) =>
        String(dividend.date) === String(tx.date) &&
        Math.abs(Number(dividend.stock_dividend_shares) - Number(tx.shares)) < 0.001,
    ).length,
  );
  const dividendCandidateCounts = dividends.map((dividend) =>
    transactions.filter(
      (tx) =>
        String(tx.date) === String(dividend.date) &&
        Math.abs(Number(tx.shares) - Number(dividend.stock_dividend_shares)) < 0.001,
    ).length,
  );
  return (
    transactionCandidateCounts.some((count) => count > 1) ||
    dividendCandidateCounts.some((count) => count > 1)
  );
}

export function hasUnmatchedLegacyStockDividendTransactions(
  userId: string,
  stockId: string,
): boolean {
  const transactions = queryAll(
    "SELECT id, date, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
    [userId, stockId],
  );
  if (transactions.length === 0) return false;

  const dividends = queryAll(
    `SELECT sd.id, sd.date, sd.stock_dividend_shares
     FROM stock_dividends sd
     WHERE sd.user_id = ? AND sd.stock_id = ? AND sd.stock_dividend_shares > 0
       AND NOT EXISTS (
         SELECT 1 FROM stock_transactions st
         WHERE st.user_id = sd.user_id AND st.stock_id = sd.stock_id
           AND st.linked_dividend_id = sd.id AND st.date = sd.date
           AND st.type = 'buy' AND st.price = 0
           AND ABS(st.shares - sd.stock_dividend_shares) < 0.001
           AND (st.note LIKE '[SYNTH] 股票股利%' OR st.note LIKE '股票股利配發%')
       )`,
    [userId, stockId],
  );
  const candidates = transactions.map((tx) =>
    dividends
      .map((dividend, index) => ({ dividend, index }))
      .filter(
        ({ dividend }) =>
          String(dividend.date) === String(tx.date) &&
          Math.abs(Number(dividend.stock_dividend_shares) - Number(tx.shares)) <
            0.001,
      )
      .map(({ index }) => index),
  );
  if (candidates.some((matches) => matches.length === 0)) return true;

  // Ensure every legacy lot has a distinct candidate dividend. Multiple
  // identical same-day records are interchangeable; a maximum matching is
  // sufficient because their synthetic buy terms are the same.
  const dividendToTransaction = new Array<number>(dividends.length).fill(-1);
  const assign = (transactionIndex: number, seen: boolean[]): boolean => {
    for (const dividendIndex of candidates[transactionIndex]) {
      if (seen[dividendIndex]) continue;
      seen[dividendIndex] = true;
      if (
        dividendToTransaction[dividendIndex] === -1 ||
        assign(dividendToTransaction[dividendIndex], seen)
      ) {
        dividendToTransaction[dividendIndex] = transactionIndex;
        return true;
      }
    }
    return false;
  };
  for (let index = 0; index < transactions.length; index++) {
    if (!assign(index, new Array<boolean>(dividends.length).fill(false))) return true;
  }
  return false;
}

export interface DripValidationInput {
  reinvest?: unknown;
  cashDividend?: unknown;
  reinvestShares?: unknown;
  reinvestPrice?: unknown;
  market?: StockMarket | string;
}

export interface DripValidationResult {
  reinvest: boolean;
  reinvestShares: number;
  reinvestPrice: number;
  cashDividend: number;
}

/**
 * 驗證並正規化 DRIP 輸入。DRIP 需要明確的再投資股數與每股價格，
 * 兩者皆為正數才成立（金額一律以十進位數值儲存，不引入浮點誤差）。
 * 再投資金額不得超過現金股利（避免記出無中生有的持股）。
 */
export function validateDripInput(
  input: DripValidationInput,
): DripValidationResult {
  const cashDividend = toNum(input?.cashDividend, 0);
  const reinvest = normalizeDayTradeFlag(input?.reinvest);
  const reinvestShares = toNum(input?.reinvestShares, 0);
  const reinvestPrice = toNum(input?.reinvestPrice, 0);

  if (!reinvest) {
    return { reinvest: false, reinvestShares: 0, reinvestPrice: 0, cashDividend };
  }

  if (!(reinvestShares > 0) || !(reinvestPrice > 0)) {
    throw new Error("股利再投資需填寫正數的再投資股數與每股價格");
  }
  if (!isValidStockShareQuantity(reinvestShares, input?.market || "TW")) {
    throw new Error("台股再投資股數必須為整數");
  }
  if (!(cashDividend > 0)) {
    throw new Error("股利再投資僅適用於含現金股利的紀錄");
  }
  // 以 decimal.js 比較金額，避免浮點乘法誤差造成邊界誤判。
  const investAmount = new Decimal(reinvestShares).times(reinvestPrice);
  if (investAmount.gt(new Decimal(cashDividend))) {
    throw new Error("再投資金額不可超過現金股利");
  }
  return { reinvest: true, reinvestShares, reinvestPrice, cashDividend };
}

export interface StockRealizedPlOptions {
  dateFrom?: string;
  dateTo?: string;
  stockId?: string;
}
export interface StockRealizedPlEntry {
  transactionId: string;
  sellDate: string;
  stockId: string;
  market: StockMarket;
  currency: string;
  symbol: string;
  name: string;
  shares: number;
  sellPrice: number;
  costPrice: number;
  feeAndTax: number;
  sellRevenue: number;
  totalCost: number;
  totalCostTwd: number;
  realizedPL: number;
  realizedPLTwd: number;
  returnRate: number;
}

export interface StockRealizedPlSummary {
  totalRealizedPL: number;
  totalRealizedPLTwd: number;
  overallReturnRate: number | null;
  overallReturnRateTwd: number | null;
  ytdRealizedPL: number;
  ytdRealizedPLTwd: number;
  count: number;
}

export interface StockRealizedPlResult {
  entries: StockRealizedPlEntry[];
  summary: StockRealizedPlSummary;
}

// 抽取自 app/api/stock-realized-pl/route.ts（無行為變更：不帶篩選參數時輸出與抽取前完全一致）。
// dateFrom/dateTo/stockId 為新增的篩選功能，套用於 FIFO 運算後的賣出明細，不影響 FIFO 成本計算本身。
export function getStockRealizedPl(
  userId: string,
  options: StockRealizedPlOptions = {},
): StockRealizedPlResult {
  const { dateFrom, dateTo, stockId } = options;
  const stocks = stockId
    ? queryAll("SELECT * FROM stocks WHERE user_id = ? AND id = ?", [
        userId,
        stockId,
      ])
    : queryAll("SELECT * FROM stocks WHERE user_id = ?", [userId]);
  const entries: StockRealizedPlEntry[] = [];

  stocks.forEach((s) => {
    const txs = queryAll(
      "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at, id",
      [s.id, userId],
    );
    const fifo = calcFifoLots(txs);
    const market = normalizeStockMarket(s.market);
    const currency = stockCurrency(market);
    const fxRateToTwd = getExchangeRateToTwd(userId, currency);
    fifo.sellEntries.forEach((entry) => {
      const t = entry.tx as Record<string, unknown>;
      entries.push({
        transactionId: String(t.id),
        sellDate: String(t.date),
        stockId: String(s.id),
        market,
        currency,
        symbol: String(s.symbol || ""),
        name: String(s.name || ""),
        shares: Number(t.shares),
        sellPrice: Number(t.price),
        costPrice: Math.round(entry.costPerShare.toNumber() * 100) / 100,
        feeAndTax: roundStockMoney(
          Number(t.fee || 0) + Number(t.tax || 0),
          currency,
        ),
        sellRevenue: roundStockMoney(entry.sellRevenue.toNumber(), currency),
        totalCost: roundStockMoney(entry.totalCost.toNumber(), currency),
        totalCostTwd: Math.round(entry.totalCost.toNumber() * fxRateToTwd),
        realizedPL: roundStockMoney(entry.realizedPL.toNumber(), currency),
        realizedPLTwd: Math.round(entry.realizedPL.toNumber() * fxRateToTwd),
        returnRate: Math.round(entry.returnRate.toNumber() * 100) / 100,
      });
    });
  });

  entries.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
  const filtered = entries.filter((e) => {
    if (dateFrom && e.sellDate < dateFrom) return false;
    if (dateTo && e.sellDate > dateTo) return false;
    return true;
  });

  const totalRealizedPL = filtered.reduce((s, e) => s + e.realizedPL, 0);
  const totalRealizedPLTwd = filtered.reduce((s, e) => s + e.realizedPLTwd, 0);
  const totalCostSum = filtered.reduce((s, e) => s + e.totalCost, 0);
  const totalCostSumTwd = filtered.reduce((s, e) => s + e.totalCostTwd, 0);
  const overallReturnRate =
    totalCostSum > 0
      ? Math.round((totalRealizedPL / totalCostSum) * 10000) / 100
      : null;
  const overallReturnRateTwd =
    totalCostSumTwd > 0
      ? Math.round((totalRealizedPLTwd / totalCostSumTwd) * 10000) / 100
      : null;
  const thisYear = String(new Date().getFullYear());
  const ytdEntries = filtered.filter((e) => e.sellDate.startsWith(thisYear));
  const ytdRealizedPL = ytdEntries.reduce((s, e) => s + e.realizedPL, 0);
  const ytdRealizedPLTwd = ytdEntries.reduce((s, e) => s + e.realizedPLTwd, 0);

  return {
    entries: filtered,
    summary: {
      totalRealizedPL,
      totalRealizedPLTwd,
      overallReturnRate,
      overallReturnRateTwd,
      ytdRealizedPL,
      ytdRealizedPLTwd,
      count: filtered.length,
    },
  };
}

export function getSharesAtDate(
  userId: string,
  stockId: string,
  date: string,
): number {
  const row = queryOne(
    "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
    [userId, stockId, date],
  );
  return row && row.shares != null ? Number(row.shares) : 0;
}

export function validateChainConstraint(
  userId: string,
  stockId: string,
  txDate: string,
  txType: string,
  txShares: number,
  excludeTxId: string | null = null,
): { ok: boolean; conflictDate?: string; expectedShares?: number } {
  const baseRow = excludeTxId
    ? queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ? AND id != ?",
        [userId, stockId, txDate, excludeTxId],
      )
    : queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
        [userId, stockId, txDate],
      );
  const baseShares =
    baseRow && baseRow.shares != null ? Number(baseRow.shares) : 0;
  const delta = txType === "buy" ? Number(txShares) : -Number(txShares);
  let cumulative = baseShares + delta;
  if (cumulative < 0)
    return { ok: false, conflictDate: txDate, expectedShares: cumulative };

  const futureSql = excludeTxId
    ? "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? AND id != ? ORDER BY date, created_at, id"
    : "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? ORDER BY date, created_at, id";
  const futureParams = excludeTxId
    ? [userId, stockId, txDate, excludeTxId]
    : [userId, stockId, txDate];
  const future = queryAll(futureSql, futureParams);
  for (const t of future) {
    cumulative += t.type === "buy" ? Number(t.shares) : -Number(t.shares);
    if (cumulative < 0)
      return {
        ok: false,
        conflictDate: t.date as string | undefined,
        expectedShares: cumulative,
      };
  }
  return { ok: true };
}

export interface StockTransactionChainEntry {
  id: string;
  date: string;
  type: "buy" | "sell";
  shares: Decimal.Value;
  createdAt: number | null;
}

/**
 * Validate the holdings chain after removing/replacing a set of synthetic
 * transactions. Used when a dividend edit/delete removes FIFO buy lots.
 */
export function validateStockTransactionChainChanges(
  userId: string,
  stockId: string,
  removedTransactionIds: string[],
  addedTransactions: StockTransactionChainEntry[] = [],
): { ok: boolean; conflictDate?: string; expectedShares?: number } {
  const removed = new Set(removedTransactionIds.map(String));
  const existing = queryAll(
    "SELECT id, date, type, shares, created_at FROM stock_transactions WHERE user_id = ? AND stock_id = ?",
    [userId, stockId],
  ).filter((tx) => !removed.has(String(tx.id)));
  const entries = [
    ...existing.map((tx) => ({
      id: String(tx.id),
      date: String(tx.date),
      type: String(tx.type) as "buy" | "sell",
      shares: new Decimal(String(tx.shares || 0)),
      createdAt: tx.created_at == null ? null : Number(tx.created_at),
    })),
    ...addedTransactions.map((tx) => ({
      ...tx,
      shares: new Decimal(String(tx.shares || 0)),
    })),
  ].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    if (dateOrder !== 0) return dateOrder;
    // PostgreSQL's ascending ORDER BY puts NULL timestamps last; mirror that
    // exactly so chain validation and FIFO reads agree on legacy rows.
    if (a.createdAt === null && b.createdAt !== null) return 1;
    if (a.createdAt !== null && b.createdAt === null) return -1;
    const createdAtOrder = (a.createdAt ?? 0) - (b.createdAt ?? 0);
    return createdAtOrder || a.id.localeCompare(b.id);
  });

  let cumulative = new Decimal(0);
  for (const entry of entries) {
    cumulative =
      entry.type === "buy"
        ? cumulative.plus(entry.shares)
        : cumulative.minus(entry.shares);
    if (cumulative.lt(0)) {
      return {
        ok: false,
        conflictDate: entry.date,
        expectedShares: cumulative.toNumber(),
      };
    }
  }
  return { ok: true };
}
