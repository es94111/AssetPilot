// lib/reportCurrencyConversion.ts — 報表基準幣別換算（issue #255）。
//
// 兩階段設計，確保「跨幣別彙總不引入浮點誤差」：
//   1. 既有彙總一律先以 TWD 等值計算（整數，float 完全精確）。
//   2. 再把每個已彙總的 TWD 金額以 decimal.js 一次換算為基準幣別並四捨五入。
// 因為「先加總再換算」等同「逐筆換算再相加」（無中間四捨五入），且換算全程
// 使用 Decimal，最終結果不會出現 float 累加誤差（例如 10.01 / 2 於 float 下
// 為 5.004999...，toFixed(2) 得 5.00，Decimal HALF_UP 得正確的 5.01）。
//
// 只依賴 decimal.js 與零相依的 moneyDecimal，刻意不 import lib/db，
// 使純數學邏輯可在無 PostgreSQL 環境下獨立測試。

import Decimal from 'decimal.js';
import { getSmallestUnit } from './moneyDecimal';

/** 幣別最小單位的小數位數（TWD 1 → 0、USD 100 → 2、BHD 1000 → 3）。 */
export function reportFractionDigits(currency: string): number {
  const unit = getSmallestUnit(currency);
  if (!Number.isFinite(unit) || unit <= 1) return 0;
  return Math.round(Math.log10(unit));
}

/** 安全轉為 Decimal：null／undefined／NaN／Infinity／非數字字串一律視為 0。 */
export function toReportDecimal(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

/** 匯率是否可用（必須為有限正數）。 */
export function isUsableReportRate(rate: Decimal.Value | null | undefined): boolean {
  return toReportDecimal(rate).gt(0);
}

/**
 * 以 Decimal 全精度把 TWD 等值換算為基準幣別（不四捨五入）。
 * rateToBase 語意與 exchange_rates.rate_to_twd 一致：1 單位基準幣別值多少 TWD。
 */
export function convertTwdToBase(
  twdAmount: Decimal.Value | null | undefined,
  rateToBase: Decimal.Value | null | undefined,
): Decimal {
  const rate = toReportDecimal(rateToBase);
  if (!rate.gt(0)) throw new Error('rateToBase must be a positive number');
  return toReportDecimal(twdAmount).div(rate);
}

/** 以基準幣別最小單位四捨五入（ROUND_HALF_UP）；僅用於輸出，彙總過程維持全精度。 */
export function roundReportAmount(
  value: Decimal.Value | null | undefined,
  currency: string,
): Decimal {
  return toReportDecimal(value).toDecimalPlaces(reportFractionDigits(currency), Decimal.ROUND_HALF_UP);
}

/** 換算後的金額（保留全精度 Decimal）；rateToBase 對 TWD 基準為 1。 */
export function convertAmountToBase(
  twdAmount: Decimal.Value | null | undefined,
  rateToBase: Decimal.Value | null | undefined,
  baseCurrency: string,
): Decimal {
  if (baseCurrency === 'TWD') return toReportDecimal(twdAmount);
  return convertTwdToBase(twdAmount, rateToBase);
}

/** 對外的顯示／API 金額：換算後以最小單位四捨五入，再轉為 number。 */
export function toBaseAmountNumber(
  twdAmount: Decimal.Value | null | undefined,
  rateToBase: Decimal.Value | null | undefined,
  baseCurrency: string,
): number {
  return roundReportAmount(convertAmountToBase(twdAmount, rateToBase, baseCurrency), baseCurrency).toNumber();
}

/** getTransactionsSummary() 輸出中所有以金額表達的欄位（結構型別，避免循環相依）。 */
export interface ConvertibleReportSummary {
  catMap: Record<string, { total: number; color: string }>;
  categoryBreakdown: Array<{ total: number }>;
  dailyMap: Record<string, number>;
  monthlyMap: Record<string, number>;
  total: number;
}

function convertAndReconcileValues<T>(
  entries: T[],
  amountOf: (entry: T) => Decimal.Value,
  targetTotal: Decimal,
  rateToBase: Decimal.Value,
  baseCurrency: string,
): number[] {
  if (entries.length === 0) return [];

  const exactValues = entries.map(entry => convertAmountToBase(amountOf(entry), rateToBase, baseCurrency));
  const roundedValues = exactValues.map(value => roundReportAmount(value, baseCurrency));
  const roundedSum = roundedValues.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const residual = targetTotal.minus(roundedSum);
  const fractionDigits = reportFractionDigits(baseCurrency);
  const unit = new Decimal(10).pow(-fractionDigits);
  const residualUnits = residual.div(unit).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

  if (residualUnits !== 0) {
    const direction = residualUnits > 0 ? 1 : -1;
    const order = exactValues
      .map((value, index) => ({ index, roundingError: value.minus(roundedValues[index]) }))
      .sort((a, b) => direction > 0
        ? b.roundingError.comparedTo(a.roundingError)
        : a.roundingError.comparedTo(b.roundingError));
    for (let i = 0; i < Math.abs(residualUnits); i += 1) {
      const index = order[i % order.length].index;
      roundedValues[index] = roundedValues[index].plus(unit.times(direction));
    }
  }

  return roundedValues.map(value => value.toNumber());
}

/**
 * 把既有（TWD 等值）報表彙總結果整體換算為基準幣別。
 * decimal.js 負責全精度換算；分組明細的最小單位捨入差額依最大餘數法分配，
 * 確保分類／每日／每月分項加總與報表總計完全一致。
 */
export function convertReportSummaryToBase<T extends ConvertibleReportSummary>(
  summary: T,
  rateToBase: Decimal.Value,
  baseCurrency: string,
): T {
  if (baseCurrency === 'TWD') return summary;

  const targetTotal = roundReportAmount(convertAmountToBase(summary.total, rateToBase, baseCurrency), baseCurrency);

  const catEntries = Object.entries(summary.catMap);
  const catTotals = convertAndReconcileValues(
    catEntries,
    ([, entry]) => entry.total,
    targetTotal,
    rateToBase,
    baseCurrency,
  );
  const catMap: ConvertibleReportSummary['catMap'] = {};
  catEntries.forEach(([name, entry], index) => {
    catMap[name] = { total: catTotals[index], color: entry.color };
  });

  const dailyEntries = Object.entries(summary.dailyMap);
  const dailyTotals = convertAndReconcileValues(
    dailyEntries,
    ([, value]) => value,
    targetTotal,
    rateToBase,
    baseCurrency,
  );
  const dailyMap: Record<string, number> = {};
  dailyEntries.forEach(([date], index) => { dailyMap[date] = dailyTotals[index]; });

  const monthlyEntries = Object.entries(summary.monthlyMap);
  const monthlyTotals = convertAndReconcileValues(
    monthlyEntries,
    ([, value]) => value,
    targetTotal,
    rateToBase,
    baseCurrency,
  );
  const monthlyMap: Record<string, number> = {};
  monthlyEntries.forEach(([month], index) => { monthlyMap[month] = monthlyTotals[index]; });

  const categoryTotals = convertAndReconcileValues(
    summary.categoryBreakdown,
    node => node.total,
    targetTotal,
    rateToBase,
    baseCurrency,
  );

  return {
    ...summary,
    catMap,
    categoryBreakdown: summary.categoryBreakdown.map((node, index) => ({ ...node, total: categoryTotals[index] })),
    dailyMap,
    monthlyMap,
    total: targetTotal.toNumber(),
  } as T;
}
