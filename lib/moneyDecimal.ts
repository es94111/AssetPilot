// lib/moneyDecimal.ts — 金額換算工具（server-only）。
// FR-022a：禁用原生 float／Number 直接相乘；以 decimal.js 計算 fx_rate × amount + fx_fee。
import Decimal from 'decimal.js';

// 各幣別最小單位倍率（amount integer 對應實際單位的倍數）
// 例：USD smallestUnit=100 → 整數 1234 = $12.34；JPY smallestUnit=1 → 整數 1234 = ¥1234
export const SMALLEST_UNIT_BY_CURRENCY: Record<string, number> = {
  TWD: 1, USD: 100, EUR: 100, GBP: 100, CNY: 100, SGD: 100, HKD: 100,
  AUD: 100, CAD: 100, NZD: 100, CHF: 100, MYR: 100, THB: 100, PHP: 100,
  JPY: 1, KRW: 1, VND: 1, IDR: 1,
  BHD: 1000, KWD: 1000, OMR: 1000, JOD: 1000, TND: 1000,
};

// 取得幣別最小單位倍率；未列入表者用 Intl.NumberFormat 推測小數位數，再 fallback 100
export function getSmallestUnit(currency: string): number {
  if (typeof currency !== 'string') return 1;
  const upper = currency.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(SMALLEST_UNIT_BY_CURRENCY, upper)) {
    return SMALLEST_UNIT_BY_CURRENCY[upper];
  }
  try {
    const fmt = new Intl.NumberFormat('en', { style: 'currency', currency: upper });
    const opts = fmt.resolvedOptions();
    const fractionDigits = typeof opts.maximumFractionDigits === 'number' ? opts.maximumFractionDigits : 2;
    return Math.pow(10, fractionDigits);
  } catch (_) {
    return 100;
  }
}

// 計算 TWD 等值整數（以 TWD 元為單位）；公式：amount × fx_rate + fx_fee
// amountInt：原幣最小單位整數；fxRateStr：decimal 字串；fxFeeInt：TWD 元整數
export function computeTwdAmount(amountInt: number, fxRateStr: string | null | undefined, fxFeeInt: number): number {
  const a = new Decimal(amountInt || 0);
  const r = new Decimal(fxRateStr != null ? String(fxRateStr) : '1');
  const f = new Decimal(fxFeeInt || 0);
  return a.times(r).plus(f).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

// 將整數依幣別格式化為人類可讀字串
// TWD 1200 → "$1,200"；USD 1234 → "$12.34"；JPY 1234 → "¥1,234"
export function formatForDisplay(amountInt: number, currency: string): string {
  if (typeof amountInt !== 'number' || !isFinite(amountInt)) amountInt = 0;
  const unit = getSmallestUnit(currency);
  const fractionDigits = unit === 1 ? 0 : (unit === 1000 ? 3 : 2);
  const value = amountInt / unit;
  try {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: (currency || 'TWD').toUpperCase(),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch (_) {
    return `${(currency || 'TWD').toUpperCase()} ${value.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
  }
}

export interface FifoLot {
  shares: Decimal;
  price: Decimal;
  fee: Decimal;
}

export interface SellEntry {
  tx: Record<string, unknown>;
  sellRevenue: Decimal;
  totalCost: Decimal;
  realizedPL: Decimal;
  costPerShare: Decimal;
  returnRate: Decimal;
}

export interface FifoResult {
  lots: FifoLot[];
  totalShares: Decimal;
  totalCost: Decimal;
  realizedPL: Decimal;
  sellEntries: SellEntry[];
}

// 006-stock-investments T030：FIFO 計算（decimal.js 全精度）
// 輸入：transactions 陣列（依 date / created_at 升序），每筆 { type: 'buy'|'sell', shares, price, fee, tax, ... 其他自由欄位 }
// 回傳：{ lots, totalShares, totalCost, realizedPL, sellEntries }
export function calcFifoLots(transactions: Array<Record<string, unknown>>): FifoResult {
  const lots: FifoLot[] = [];
  let totalShares = new Decimal(0);
  let realizedPL = new Decimal(0);
  const sellEntries: SellEntry[] = [];
  const list = Array.isArray(transactions) ? transactions : [];
  for (const t of list) {
    const shares = new Decimal((t.shares as number) || 0);
    const price = new Decimal((t.price as number) || 0);
    const fee = new Decimal((t.fee as number) || 0);
    const tax = new Decimal((t.tax as number) || 0);
    if (t.type === 'buy') {
      lots.push({ shares, price, fee });
      totalShares = totalShares.plus(shares);
    } else if (t.type === 'sell') {
      let remaining = shares;
      const sellRevenue = shares.times(price).minus(fee).minus(tax);
      let sellCost = new Decimal(0);
      while (remaining.gt(0) && lots.length > 0) {
        const lot = lots[0];
        const used = Decimal.min(remaining, lot.shares);
        // 手續費按比例分攤（保留全精度）
        const feeUsed = lot.shares.gt(0) ? lot.fee.times(used).div(lot.shares) : new Decimal(0);
        sellCost = sellCost.plus(used.times(lot.price)).plus(feeUsed);
        lot.fee = lot.fee.minus(feeUsed);
        lot.shares = lot.shares.minus(used);
        remaining = remaining.minus(used);
        if (lot.shares.lte(0)) lots.shift();
      }
      const txRealizedPL = sellRevenue.minus(sellCost);
      realizedPL = realizedPL.plus(txRealizedPL);
      totalShares = totalShares.minus(shares);
      const costPerShare = shares.gt(0) ? sellCost.div(shares) : new Decimal(0);
      const returnRate = sellCost.gt(0) ? txRealizedPL.div(sellCost).times(100) : new Decimal(0);
      sellEntries.push({
        tx: t,
        sellRevenue,
        totalCost: sellCost,
        realizedPL: txRealizedPL,
        costPerShare,
        returnRate,
      });
    }
  }
  const totalCost = lots.reduce((acc, l) => acc.plus(l.shares.times(l.price)).plus(l.fee), new Decimal(0));
  return { lots, totalShares, totalCost, realizedPL, sellEntries };
}
