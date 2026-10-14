// lib/portfolioPerformance.ts — 投資組合績效分析（issue #310）：XIRR／TWR／Benchmark 與收益歸因。
//
// 本檔為零相依純邏輯（僅 decimal.js），刻意不 import lib/db 或任何網路模組，讓所有
// 計算可在無 PostgreSQL／無網路環境下以 node:test 完整驗證；讀取資料與抓取股價的
// 包裝見 app/api/stock-performance/route.ts。
//
// 計算約定（亦輸出至報表 methodology 區塊，避免使用者誤解）：
//   1. 單一報表只涵蓋單一市場（TW 或 US），因此只有一種原幣。輸入若混入不同幣別的
//      持股會直接拋出 PerformanceInputError('mixed-currency')——絕不把不同幣別相加。
//   2. 外部現金流（投資組合視角，投入為正）：
//        - 買進：投入 shares × price + fee
//        - 賣出：提出 shares × price − fee − tax
//        - 現金股利（非再投資）：提出 cash_dividend（股利離開投資組合成為現金）
//        - 股利再投資（DRIP）：只把「未再投入」的殘額 max(0, cash − 再投資股數 × 再投資價)
//          視為提出；再投入部分由合成買進（[DRIP]／[SYNTH] 交易）反映在持股中，
//          合成交易本身不列為外部現金流，避免股利被重複計算。
//   3. 市值 V(d) = Σ 持股數(d) × 最近一筆 ≤ d 的收盤價；收盤價最多向前沿用
//      PRICE_CARRY_FORWARD_DAYS 天（涵蓋週末與連假），超過即視為缺價，絕不插值。
//      期初市值取 from 前一日（期初日開盤前），期末市值取 to 當日收盤。
//   4. 收益歸因：總損益 = 期末 − 期初 − 淨投入；已實現損益採既有 FIFO 結果；
//      股利為期間內現金股利；未實現變動 = 總損益 − 已實現 − 股利（殘差，含價格變動）。
//      手續費與交易稅已內含於現金流中（因此已反映在總損益），另外單獨揭露金額。
//   5. TWR：以期初、每個現金流日與期末為分段點鏈結；
//        r_i = (V(d_i) + W_i) / (V(d_{i−1}) + C_i) − 1
//      投入假設於當日開盤前發生、提出假設於當日收盤後發生。任一分段點缺價時 TWR
//      標示為 incomplete 並列出缺價日期，不回傳數值。分母為 0 的分段跳過並揭露。
//   6. XIRR：Actual/365 日數慣例，投資人視角（投入為負、期末市值為正）。NPV 以
//      IEEE-754 double 計算（冪次運算無法以 Decimal 有效率求值），先於
//      r ∈ [−99%, +10000%] 以 log(1+r) 等距 XIRR_SCAN_STEPS 段掃描符號變化：
//      0 次 → no-root、≥2 次 → multiple-roots、1 次 → 二分法收斂至 XIRR_TOLERANCE，
//      否則 non-convergence。所有現金流同日 → zero-period。結果以 8 位小數輸出，
//      不呈現超出計算精度的位數。
//   7. Benchmark 為價格報酬（PRICE return）：不含股利再投資、不含交易成本。
//   8. 匯率換算僅用於「基準幣別檢視」：以目前（spot）匯率將原幣金額換算，並揭露
//      雙方匯率來源與更新時間；不是歷史逐日匯率。任一匯率缺失時明確降級為僅原幣。
//      報酬率（XIRR、TWR、Benchmark）一律以原幣計算。
//
// 金額運算使用 Decimal（precision 34、ROUND_HALF_EVEN）；金額輸出四捨五入至 2 位、
// 報酬率輸出 8 位小數。

import Decimal from 'decimal.js';

export const PerfDecimal = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN });
type D = InstanceType<typeof PerfDecimal>;

export const PRICE_CARRY_FORWARD_DAYS = 7;
export const XIRR_SCAN_STEPS = 400;
export const XIRR_TOLERANCE = 1e-10;
export const XIRR_MIN_RATE = -0.99;
export const XIRR_MAX_RATE = 100;
export const MONEY_DECIMALS = 2;
export const RATE_DECIMALS = 8;
const DAY_MS = 86_400_000;

export type PerformanceErrorCode = 'mixed-currency' | 'invalid-period' | 'invalid-date';

export class PerformanceInputError extends Error {
  readonly code: PerformanceErrorCode;
  constructor(code: PerformanceErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'PerformanceInputError';
  }
}

export interface PerformanceStock {
  id: string;
  symbol: string;
  currency: string;
}

export interface PerformanceTransaction {
  stockId: string;
  type: 'buy' | 'sell';
  date: string;
  shares: number | string;
  price: number | string;
  fee?: number | string | null;
  tax?: number | string | null;
  /** 合成交易（股票股利配股、股利再投資）：計入持股但不列外部現金流。 */
  synthetic?: boolean;
}

export interface PerformanceDividend {
  stockId: string;
  date: string;
  cashDividend: number | string;
  reinvest?: boolean;
  reinvestShares?: number | string | null;
  reinvestPrice?: number | string | null;
}

export interface PricePoint {
  date: string;
  close: number | string;
}

export interface BenchmarkMeta {
  type: 'price';
  symbol: string;
  source: string;
  dividendsReinvested: false;
  currency: string;
  feesIncluded: false;
}

export interface BenchmarkInput {
  meta: BenchmarkMeta;
  series: PricePoint[] | null;
  /** 抓取失敗時的原因（例如 'fetch-failed'）。 */
  error?: string | null;
}

export interface FxInput {
  baseCurrency: string;
  /** 1 單位原幣值多少 TWD。 */
  nativeRateToTwd: string | null;
  nativeSource: string | null;
  nativeFetchedAt: string | null;
  /** 1 單位基準幣別值多少 TWD。 */
  baseRateToTwd: string | null;
  baseSource: string | null;
  baseFetchedAt: string | null;
}

export interface PerformanceInput {
  from: string;
  to: string;
  market: string;
  currency: string;
  stocks: PerformanceStock[];
  transactions: PerformanceTransaction[];
  dividends: PerformanceDividend[];
  prices: Record<string, PricePoint[]>;
  /** 期間內已實現損益（原幣，由既有 FIFO 計算提供）。 */
  realizedPl: number | string;
  benchmark?: BenchmarkInput | null;
  fx?: FxInput | null;
  carryForwardDays?: number;
}

export type FlowKind = 'buy' | 'sell' | 'dividend' | 'drip-residual';

export interface PerformanceFlow {
  date: string;
  stockId: string;
  symbol: string;
  kind: FlowKind;
  direction: 'in' | 'out';
  /** 正值金額（原幣）。 */
  amount: string;
}

export type XirrFailureReason =
  | 'multiple-roots'
  | 'no-root'
  | 'zero-period'
  | 'non-convergence'
  | 'insufficient-flows'
  | 'missing-valuation';

export type XirrResult =
  | { status: 'ok'; rate: string; iterations: number }
  | { status: 'unavailable'; reason: XirrFailureReason; rootCount?: number };

export interface XirrCashFlow {
  date: string;
  amount: number;
}

export interface TwrResult {
  status: 'ok' | 'incomplete' | 'unavailable';
  twr: string | null;
  subPeriods: number;
  skippedPeriods: string[];
  missingDates: string[];
}

export interface BenchmarkResult {
  available: boolean;
  meta: BenchmarkMeta | null;
  reason: string | null;
  startDate: string | null;
  endDate: string | null;
  startClose: string | null;
  endClose: string | null;
  return: string | null;
  /** TWR − Benchmark 報酬（百分點以小數表示）。 */
  difference: string | null;
}

export interface MissingPrice {
  date: string;
  stockId: string;
  symbol: string;
}

export interface TrendPoint {
  date: string;
  marketValue: string | null;
  netContributions: string;
}

export interface PerformanceSummary {
  startValue: string | null;
  endValue: string | null;
  contributions: string;
  withdrawals: string;
  netFlow: string;
  totalGain: string | null;
  realizedPl: string;
  unrealizedChange: string | null;
  dividends: string;
  feesAndTaxes: string;
}

export interface FxView {
  status: 'ok' | 'unavailable' | 'identity';
  baseCurrency: string;
  nativeCurrency: string;
  rate: string | null;
  nativeSource: string | null;
  nativeFetchedAt: string | null;
  baseSource: string | null;
  baseFetchedAt: string | null;
  summary: PerformanceSummary | null;
}

export interface PerformanceReport {
  period: { from: string; to: string; startValuationDate: string; days: number };
  market: string;
  currency: string;
  summary: PerformanceSummary;
  xirr: XirrResult;
  twr: TwrResult;
  benchmark: BenchmarkResult;
  trend: TrendPoint[];
  flows: PerformanceFlow[];
  missingPrices: MissingPrice[];
  fx: FxView | null;
  methodology: {
    dayCount: 'Actual/365';
    priceCarryForwardDays: number;
    xirrScanSteps: number;
    xirrTolerance: number;
    xirrRateRange: [number, number];
    twrFlowTiming: 'flows-end-of-day';
    unrealizedIsResidual: true;
    fxMode: 'spot';
  };
}

// ---------------------------------------------------------------------------
// 日期工具（純 UTC 日期字串 YYYY-MM-DD）

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function dateMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(dateMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dateMs(b) - dateMs(a)) / DAY_MS);
}

function monthEnds(from: string, to: string): string[] {
  const result: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  for (;;) {
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (end > to) break;
    if (end >= from) result.push(end);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 數值工具

function dec(value: unknown): D {
  if (value === null || value === undefined || value === '') return new PerfDecimal(0);
  try {
    const d = new PerfDecimal(value as Decimal.Value);
    return d.isFinite() ? d : new PerfDecimal(0);
  } catch {
    return new PerfDecimal(0);
  }
}

function money(value: D): string {
  return value.toDecimalPlaces(MONEY_DECIMALS, PerfDecimal.ROUND_HALF_EVEN).toFixed(MONEY_DECIMALS);
}

function rate(value: D): string {
  return value.toDecimalPlaces(RATE_DECIMALS, PerfDecimal.ROUND_HALF_EVEN).toFixed(RATE_DECIMALS);
}

// ---------------------------------------------------------------------------
// 外部現金流

export function buildExternalFlows(
  input: Pick<PerformanceInput, 'from' | 'to' | 'stocks' | 'transactions' | 'dividends'>,
): PerformanceFlow[] {
  const symbolOf = new Map(input.stocks.map((s) => [s.id, s.symbol]));
  const flows: PerformanceFlow[] = [];
  const inPeriod = (date: string) => date >= input.from && date <= input.to;

  for (const tx of input.transactions) {
    if (tx.synthetic || !inPeriod(tx.date)) continue;
    const gross = dec(tx.shares).times(dec(tx.price));
    const symbol = symbolOf.get(tx.stockId) ?? tx.stockId;
    if (tx.type === 'buy') {
      const amount = gross.plus(dec(tx.fee));
      if (!amount.isZero()) {
        flows.push({ date: tx.date, stockId: tx.stockId, symbol, kind: 'buy', direction: 'in', amount: amount.toString() });
      }
    } else {
      const amount = gross.minus(dec(tx.fee)).minus(dec(tx.tax));
      if (!amount.isZero()) {
        // 賣出淨額為負（費稅大於成交金額）時，視為投入以保持金額守恆。
        flows.push({
          date: tx.date,
          stockId: tx.stockId,
          symbol,
          kind: 'sell',
          direction: amount.isNegative() ? 'in' : 'out',
          amount: amount.abs().toString(),
        });
      }
    }
  }

  for (const dv of input.dividends) {
    if (!inPeriod(dv.date)) continue;
    const cash = dec(dv.cashDividend);
    if (cash.lte(0)) continue;
    const symbol = symbolOf.get(dv.stockId) ?? dv.stockId;
    if (dv.reinvest) {
      const reinvested = dec(dv.reinvestShares).times(dec(dv.reinvestPrice));
      const residual = PerfDecimal.max(0, cash.minus(reinvested));
      if (residual.gt(0)) {
        flows.push({ date: dv.date, stockId: dv.stockId, symbol, kind: 'drip-residual', direction: 'out', amount: residual.toString() });
      }
    } else {
      flows.push({ date: dv.date, stockId: dv.stockId, symbol, kind: 'dividend', direction: 'out', amount: cash.toString() });
    }
  }

  return flows.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

export interface DailyFlow {
  date: string;
  contributions: D;
  withdrawals: D;
}

function aggregateFlowsByDate(flows: PerformanceFlow[]): DailyFlow[] {
  const map = new Map<string, DailyFlow>();
  for (const flow of flows) {
    let entry = map.get(flow.date);
    if (!entry) {
      entry = { date: flow.date, contributions: new PerfDecimal(0), withdrawals: new PerfDecimal(0) };
      map.set(flow.date, entry);
    }
    const amount = dec(flow.amount);
    if (flow.direction === 'in') entry.contributions = entry.contributions.plus(amount);
    else entry.withdrawals = entry.withdrawals.plus(amount);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// 市值

export interface Valuation {
  value: D | null;
  missing: string[];
}

export function holdingsAt(transactions: PerformanceTransaction[], date: string): Map<string, D> {
  const holdings = new Map<string, D>();
  for (const tx of transactions) {
    if (tx.date > date) continue;
    const current = holdings.get(tx.stockId) ?? new PerfDecimal(0);
    const shares = dec(tx.shares);
    holdings.set(tx.stockId, tx.type === 'buy' ? current.plus(shares) : current.minus(shares));
  }
  return holdings;
}

/** 回傳最近一筆 ≤ date 且距離不超過 carryDays 天的收盤價；序列需依日期遞增。 */
export function closeOnOrBefore(
  series: PricePoint[] | null | undefined,
  date: string,
  carryDays: number = PRICE_CARRY_FORWARD_DAYS,
): { date: string; close: D } | null {
  if (!series || series.length === 0) return null;
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  for (let i = found; i >= 0; i--) {
    const point = series[i];
    if (daysBetween(point.date, date) > carryDays) return null;
    const close = dec(point.close);
    if (close.gt(0)) return { date: point.date, close };
  }
  return null;
}

export function valuePortfolioAt(
  transactions: PerformanceTransaction[],
  prices: Record<string, PricePoint[]>,
  date: string,
  carryDays: number = PRICE_CARRY_FORWARD_DAYS,
): Valuation {
  let total = new PerfDecimal(0);
  const missing: string[] = [];
  for (const [stockId, shares] of holdingsAt(transactions, date)) {
    if (shares.isZero()) continue;
    const price = closeOnOrBefore(prices[stockId], date, carryDays);
    if (!price) {
      missing.push(stockId);
      continue;
    }
    total = total.plus(shares.times(price.close));
  }
  return { value: missing.length > 0 ? null : total, missing };
}

// ---------------------------------------------------------------------------
// XIRR

function npv(flows: { t: number; amount: number }[], r: number): number {
  const base = 1 + r;
  let sum = 0;
  for (const flow of flows) sum += flow.amount / Math.pow(base, flow.t);
  return sum;
}

export function computeXirr(cashFlows: XirrCashFlow[]): XirrResult {
  const nonZero = cashFlows.filter((f) => Number.isFinite(f.amount) && f.amount !== 0);
  if (nonZero.length < 2 || !nonZero.some((f) => f.amount > 0) || !nonZero.some((f) => f.amount < 0)) {
    return { status: 'unavailable', reason: 'insufficient-flows' };
  }
  const sorted = [...nonZero].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;
  if (sorted.every((f) => f.date === first)) {
    return { status: 'unavailable', reason: 'zero-period' };
  }
  const flows = sorted.map((f) => ({ t: daysBetween(first, f.date) / 365, amount: f.amount }));

  const xMin = Math.log1p(XIRR_MIN_RATE);
  const xMax = Math.log1p(XIRR_MAX_RATE);
  const step = (xMax - xMin) / XIRR_SCAN_STEPS;
  const brackets: [number, number][] = [];
  const exactRoots: number[] = [];
  let prevX: number | null = null;
  let prevV: number | null = null;
  let finiteSamples = 0;

  for (let i = 0; i <= XIRR_SCAN_STEPS; i++) {
    const x = xMin + step * i;
    const v = npv(flows, Math.expm1(x));
    if (!Number.isFinite(v)) {
      prevX = null;
      prevV = null;
      continue;
    }
    finiteSamples++;
    if (v === 0) {
      exactRoots.push(x);
      prevX = null;
      prevV = null;
      continue;
    }
    if (prevV !== null && prevX !== null && Math.sign(prevV) !== Math.sign(v)) {
      brackets.push([prevX, x]);
    }
    prevX = x;
    prevV = v;
  }

  if (finiteSamples === 0) return { status: 'unavailable', reason: 'non-convergence' };
  const rootCount = brackets.length + exactRoots.length;
  if (rootCount === 0) return { status: 'unavailable', reason: 'no-root', rootCount: 0 };
  if (rootCount > 1) return { status: 'unavailable', reason: 'multiple-roots', rootCount };

  if (exactRoots.length === 1) {
    return { status: 'ok', rate: rate(new PerfDecimal(Math.expm1(exactRoots[0]))), iterations: 0 };
  }

  let [lo, hi] = brackets[0];
  let fLo = npv(flows, Math.expm1(lo));
  for (let iteration = 1; iteration <= 200; iteration++) {
    const mid = (lo + hi) / 2;
    const r = Math.expm1(mid);
    const fMid = npv(flows, r);
    if (!Number.isFinite(fMid)) return { status: 'unavailable', reason: 'non-convergence' };
    if (fMid === 0 || Math.abs(Math.expm1(hi) - Math.expm1(lo)) < XIRR_TOLERANCE) {
      return { status: 'ok', rate: rate(new PerfDecimal(r)), iterations: iteration };
    }
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return { status: 'unavailable', reason: 'non-convergence' };
}

// ---------------------------------------------------------------------------
// TWR

export function computeTwr(params: {
  startDate: string;
  endDate: string;
  dailyFlows: DailyFlow[];
  valueAt: (date: string) => D | null;
}): TwrResult {
  const points = [params.startDate];
  for (const flow of params.dailyFlows) {
    if (flow.date > params.startDate && flow.date < params.endDate) points.push(flow.date);
  }
  points.push(params.endDate);
  const flowMap = new Map(params.dailyFlows.map((f) => [f.date, f]));

  const values = new Map<string, D | null>();
  const missingDates: string[] = [];
  for (const date of points) {
    const v = params.valueAt(date);
    values.set(date, v);
    if (v === null) missingDates.push(date);
  }
  if (missingDates.length > 0) {
    return { status: 'incomplete', twr: null, subPeriods: 0, skippedPeriods: [], missingDates };
  }

  let growth = new PerfDecimal(1);
  let subPeriods = 0;
  const skippedPeriods: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const date = points[i];
    const flow = flowMap.get(date);
    const contributions = flow?.contributions ?? new PerfDecimal(0);
    const withdrawals = flow?.withdrawals ?? new PerfDecimal(0);
    // Valuations already include same-day transactions, so flows are treated as end-of-day:
    // r = (V_end + W − C) / V_prev. When starting from zero, the contributed capital is the base.
    const prev = values.get(points[i - 1]) as D;
    const current = values.get(date) as D;
    let periodGrowth: D | null = null;
    if (prev.gt(0)) {
      periodGrowth = current.plus(withdrawals).minus(contributions).div(prev);
    } else if (contributions.gt(0)) {
      periodGrowth = current.plus(withdrawals).div(contributions);
    }
    if (periodGrowth === null) {
      if (!current.plus(withdrawals).minus(contributions).isZero()) skippedPeriods.push(date);
      continue;
    }
    growth = growth.times(periodGrowth);
    subPeriods++;
  }
  if (subPeriods === 0) {
    return { status: 'unavailable', twr: null, subPeriods: 0, skippedPeriods, missingDates: [] };
  }
  return { status: 'ok', twr: rate(growth.minus(1)), subPeriods, skippedPeriods, missingDates: [] };
}

// ---------------------------------------------------------------------------
// Benchmark

export function computeBenchmarkReturn(
  benchmark: BenchmarkInput | null | undefined,
  startDate: string,
  endDate: string,
  carryDays: number = PRICE_CARRY_FORWARD_DAYS,
): Omit<BenchmarkResult, 'difference'> {
  const empty = {
    startDate: null,
    endDate: null,
    startClose: null,
    endClose: null,
    return: null,
  };
  if (!benchmark) return { available: false, meta: null, reason: 'not-configured', ...empty };
  if (!benchmark.series || benchmark.series.length === 0) {
    return { available: false, meta: benchmark.meta, reason: benchmark.error || 'no-data', ...empty };
  }
  const series = [...benchmark.series].sort((a, b) => a.date.localeCompare(b.date));
  const start = closeOnOrBefore(series, startDate, carryDays);
  const end = closeOnOrBefore(series, endDate, carryDays);
  if (!start || !end) {
    return { available: false, meta: benchmark.meta, reason: 'missing-price', ...empty };
  }
  return {
    available: true,
    meta: benchmark.meta,
    reason: null,
    startDate: start.date,
    endDate: end.date,
    startClose: start.close.toString(),
    endClose: end.close.toString(),
    return: rate(end.close.div(start.close).minus(1)),
  };
}

// ---------------------------------------------------------------------------
// 匯率換算（spot）

export function fxConversionRate(fx: FxInput, nativeCurrency: string): string | null {
  if (fx.baseCurrency === nativeCurrency) return '1';
  if (!fx.nativeRateToTwd || !fx.baseRateToTwd) return null;
  const native = dec(fx.nativeRateToTwd);
  const base = dec(fx.baseRateToTwd);
  if (native.lte(0) || base.lte(0)) return null;
  return native.div(base).toString();
}

export function convertWithFx(amount: string | null, conversionRate: string | null): string | null {
  if (amount === null || conversionRate === null) return null;
  return money(dec(amount).times(dec(conversionRate)));
}

function convertSummary(summary: PerformanceSummary, conversionRate: string): PerformanceSummary {
  const c = (v: string | null) => convertWithFx(v, conversionRate);
  return {
    startValue: c(summary.startValue),
    endValue: c(summary.endValue),
    contributions: c(summary.contributions) as string,
    withdrawals: c(summary.withdrawals) as string,
    netFlow: c(summary.netFlow) as string,
    totalGain: c(summary.totalGain),
    realizedPl: c(summary.realizedPl) as string,
    unrealizedChange: c(summary.unrealizedChange),
    dividends: c(summary.dividends) as string,
    feesAndTaxes: c(summary.feesAndTaxes) as string,
  };
}

// ---------------------------------------------------------------------------
// 主流程

export function buildPerformanceReport(input: PerformanceInput): PerformanceReport {
  if (!isIsoDate(input.from) || !isIsoDate(input.to)) throw new PerformanceInputError('invalid-date');
  if (input.from > input.to) throw new PerformanceInputError('invalid-period');
  const mixed = input.stocks.find((s) => s.currency !== input.currency);
  if (mixed) {
    throw new PerformanceInputError(
      'mixed-currency',
      `stock ${mixed.symbol} uses ${mixed.currency}, report currency is ${input.currency}`,
    );
  }

  const carryDays = input.carryForwardDays ?? PRICE_CARRY_FORWARD_DAYS;
  const startDate = addDays(input.from, -1);
  const endDate = input.to;
  const symbolOf = new Map(input.stocks.map((s) => [s.id, s.symbol]));
  const transactions = [...input.transactions].sort((a, b) => a.date.localeCompare(b.date));
  const prices: Record<string, PricePoint[]> = {};
  for (const [stockId, series] of Object.entries(input.prices)) {
    prices[stockId] = [...series].sort((a, b) => a.date.localeCompare(b.date));
  }

  const missingPrices: MissingPrice[] = [];
  const valuationCache = new Map<string, D | null>();
  const valueAt = (date: string): D | null => {
    if (valuationCache.has(date)) return valuationCache.get(date) as D | null;
    const valuation = valuePortfolioAt(transactions, prices, date, carryDays);
    for (const stockId of valuation.missing) {
      missingPrices.push({ date, stockId, symbol: symbolOf.get(stockId) ?? stockId });
    }
    valuationCache.set(date, valuation.value);
    return valuation.value;
  };

  const flows = buildExternalFlows({ ...input, transactions });
  const dailyFlows = aggregateFlowsByDate(flows);
  const zero = new PerfDecimal(0);
  const contributions = dailyFlows.reduce((sum, f) => sum.plus(f.contributions), zero);
  const withdrawals = dailyFlows.reduce((sum, f) => sum.plus(f.withdrawals), zero);
  const netFlow = contributions.minus(withdrawals);

  const startValue = valueAt(startDate);
  const endValue = valueAt(endDate);
  const realized = dec(input.realizedPl);
  const dividends = input.dividends
    .filter((d) => d.date >= input.from && d.date <= input.to)
    .reduce((sum, d) => sum.plus(PerfDecimal.max(0, dec(d.cashDividend))), zero);
  const feesAndTaxes = transactions
    .filter((t) => !t.synthetic && t.date >= input.from && t.date <= input.to)
    .reduce((sum, t) => sum.plus(dec(t.fee)).plus(dec(t.tax)), zero);

  const totalGain = startValue !== null && endValue !== null ? endValue.minus(startValue).minus(netFlow) : null;
  const unrealized = totalGain !== null ? totalGain.minus(realized).minus(dividends) : null;

  const summary: PerformanceSummary = {
    startValue: startValue !== null ? money(startValue) : null,
    endValue: endValue !== null ? money(endValue) : null,
    contributions: money(contributions),
    withdrawals: money(withdrawals),
    netFlow: money(netFlow),
    totalGain: totalGain !== null ? money(totalGain) : null,
    realizedPl: money(realized),
    unrealizedChange: unrealized !== null ? money(unrealized) : null,
    dividends: money(dividends),
    feesAndTaxes: money(feesAndTaxes),
  };

  let xirr: XirrResult;
  if (startValue === null || endValue === null) {
    xirr = { status: 'unavailable', reason: 'missing-valuation' };
  } else {
    const cashFlows: XirrCashFlow[] = [{ date: startDate, amount: -startValue.toNumber() }];
    for (const f of dailyFlows) {
      cashFlows.push({ date: f.date, amount: -f.contributions.minus(f.withdrawals).toNumber() });
    }
    cashFlows.push({ date: endDate, amount: endValue.toNumber() });
    xirr = computeXirr(cashFlows);
  }

  const twr = computeTwr({ startDate, endDate, dailyFlows, valueAt });

  const benchmarkBase = computeBenchmarkReturn(input.benchmark, startDate, endDate, carryDays);
  const benchmark: BenchmarkResult = {
    ...benchmarkBase,
    difference:
      benchmarkBase.available && twr.status === 'ok' && twr.twr !== null && benchmarkBase.return !== null
        ? rate(dec(twr.twr).minus(dec(benchmarkBase.return)))
        : null,
  };

  const trendDates = Array.from(new Set([startDate, ...monthEnds(input.from, endDate), endDate])).sort();
  const trend: TrendPoint[] = trendDates.map((date) => {
    const v = valueAt(date);
    const cumulative = dailyFlows
      .filter((f) => f.date <= date)
      .reduce((sum, f) => sum.plus(f.contributions).minus(f.withdrawals), zero);
    return { date, marketValue: v !== null ? money(v) : null, netContributions: money(cumulative) };
  });

  let fx: FxView | null = null;
  if (input.fx) {
    const conversionRate = fxConversionRate(input.fx, input.currency);
    const status: FxView['status'] =
      input.fx.baseCurrency === input.currency ? 'identity' : conversionRate === null ? 'unavailable' : 'ok';
    fx = {
      status,
      baseCurrency: input.fx.baseCurrency,
      nativeCurrency: input.currency,
      rate: conversionRate,
      nativeSource: input.fx.nativeSource,
      nativeFetchedAt: input.fx.nativeFetchedAt,
      baseSource: input.fx.baseSource,
      baseFetchedAt: input.fx.baseFetchedAt,
      summary: conversionRate !== null ? convertSummary(summary, conversionRate) : null,
    };
  }

  const uniqueMissing = new Map<string, MissingPrice>();
  for (const m of missingPrices) uniqueMissing.set(`${m.date}:${m.stockId}`, m);

  return {
    period: { from: input.from, to: input.to, startValuationDate: startDate, days: daysBetween(startDate, endDate) },
    market: input.market,
    currency: input.currency,
    summary,
    xirr,
    twr,
    benchmark,
    trend,
    flows: flows.map((f) => ({ ...f, amount: money(dec(f.amount)) })),
    missingPrices: Array.from(uniqueMissing.values()).sort(
      (a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol),
    ),
    fx,
    methodology: {
      dayCount: 'Actual/365',
      priceCarryForwardDays: carryDays,
      xirrScanSteps: XIRR_SCAN_STEPS,
      xirrTolerance: XIRR_TOLERANCE,
      xirrRateRange: [XIRR_MIN_RATE, XIRR_MAX_RATE],
      twrFlowTiming: 'flows-end-of-day',
      unrealizedIsResidual: true,
      fxMode: 'spot',
    },
  };
}
