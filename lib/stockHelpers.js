'use strict';

const { getDB, queryAll, queryOne, saveDB } = require('./db');

const HASH_SEP = '\x01';

const DEFAULT_STOCK_SETTINGS = {
  feeRate: 0.001425,
  feeDiscount: 1,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getStockSettings(userId) {
  const db = getDB();
  const row = queryOne('SELECT * FROM stock_settings WHERE user_id = ?', [userId]);
  if (!row) {
    db.run(
      `INSERT INTO stock_settings (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock, sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        DEFAULT_STOCK_SETTINGS.feeRate,
        DEFAULT_STOCK_SETTINGS.feeDiscount,
        DEFAULT_STOCK_SETTINGS.feeMinLot,
        DEFAULT_STOCK_SETTINGS.feeMinOdd,
        DEFAULT_STOCK_SETTINGS.sellTaxRateStock,
        DEFAULT_STOCK_SETTINGS.sellTaxRateEtf,
        DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant,
        DEFAULT_STOCK_SETTINGS.sellTaxMin,
        Date.now(),
      ]
    );
    saveDB();
    return { ...DEFAULT_STOCK_SETTINGS };
  }
  return {
    feeRate: toNum(row.fee_rate, DEFAULT_STOCK_SETTINGS.feeRate),
    feeDiscount: toNum(row.fee_discount, DEFAULT_STOCK_SETTINGS.feeDiscount),
    feeMinLot: Math.round(toNum(row.fee_min_lot, DEFAULT_STOCK_SETTINGS.feeMinLot)),
    feeMinOdd: Math.round(toNum(row.fee_min_odd, DEFAULT_STOCK_SETTINGS.feeMinOdd)),
    sellTaxRateStock: toNum(row.sell_tax_rate_stock, DEFAULT_STOCK_SETTINGS.sellTaxRateStock),
    sellTaxRateEtf: toNum(row.sell_tax_rate_etf, DEFAULT_STOCK_SETTINGS.sellTaxRateEtf),
    sellTaxRateWarrant: toNum(row.sell_tax_rate_warrant, DEFAULT_STOCK_SETTINGS.sellTaxRateWarrant),
    sellTaxMin: Math.round(toNum(row.sell_tax_min, DEFAULT_STOCK_SETTINGS.sellTaxMin)),
  };
}

function getSellTaxRateByType(stockType, settings) {
  if (stockType === 'etf') return settings.sellTaxRateEtf;
  if (stockType === 'warrant') return settings.sellTaxRateWarrant;
  return settings.sellTaxRateStock;
}

function calcStockFee(amount, shares, settings) {
  if (!(amount > 0)) return 0;
  const minFee = Number(shares) < 1000 ? settings.feeMinOdd : settings.feeMinLot;
  const baseFee = Math.floor(amount * settings.feeRate * settings.feeDiscount);
  return Math.max(minFee, baseFee);
}

function calcStockTax(amount, stockType, settings) {
  if (!(amount > 0)) return 0;
  const tax = Math.floor(amount * getSellTaxRateByType(stockType, settings));
  return Math.max(settings.sellTaxMin, tax);
}

function normalizeStockSettingsInput(input = {}, current = DEFAULT_STOCK_SETTINGS) {
  const normalized = {
    feeRate: toNum(input.feeRate, current.feeRate),
    feeDiscount: toNum(input.feeDiscount, current.feeDiscount),
    feeMinLot: Math.round(toNum(input.feeMinLot, current.feeMinLot)),
    feeMinOdd: Math.round(toNum(input.feeMinOdd, current.feeMinOdd)),
    sellTaxRateStock: toNum(input.sellTaxRateStock, current.sellTaxRateStock),
    sellTaxRateEtf: toNum(input.sellTaxRateEtf, current.sellTaxRateEtf),
    sellTaxRateWarrant: toNum(input.sellTaxRateWarrant, current.sellTaxRateWarrant),
    sellTaxMin: Math.round(toNum(input.sellTaxMin, current.sellTaxMin)),
  };

  if (!(normalized.feeRate > 0 && normalized.feeRate <= 0.02)) throw new Error('券商手續費率需介於 0 ~ 0.02');
  if (!(normalized.feeDiscount > 0 && normalized.feeDiscount <= 1)) throw new Error('手續費折扣需介於 0 ~ 1');
  if (!(normalized.feeMinLot >= 0 && normalized.feeMinLot <= 1000)) throw new Error('整股最低手續費需介於 0 ~ 1000');
  if (!(normalized.feeMinOdd >= 0 && normalized.feeMinOdd <= 1000)) throw new Error('零股最低手續費需介於 0 ~ 1000');
  if (!(normalized.sellTaxRateStock >= 0 && normalized.sellTaxRateStock <= 0.02)) throw new Error('一般股票賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxRateEtf >= 0 && normalized.sellTaxRateEtf <= 0.02)) throw new Error('ETF 賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxRateWarrant >= 0 && normalized.sellTaxRateWarrant <= 0.02)) throw new Error('權證賣出稅率需介於 0 ~ 0.02');
  if (!(normalized.sellTaxMin >= 0 && normalized.sellTaxMin <= 100)) throw new Error('賣出交易稅最低金額需介於 0 ~ 100');

  return normalized;
}

function makeStockTxHash(date, symbol, type, shares, price, accountId) {
  return [date || '', symbol || '', type || '', String(shares || ''), String(price || ''), accountId || ''].join(HASH_SEP);
}

function makeDividendHash(date, symbol, cashDividend, stockDividend) {
  return [date || '', symbol || '', String(cashDividend || ''), String(stockDividend || '')].join(HASH_SEP);
}

function getSharesAtDate(userId, stockId, date) {
  const row = queryOne(
    "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
    [userId, stockId, date]
  );
  return row && row.shares != null ? Number(row.shares) : 0;
}

function validateChainConstraint(userId, stockId, txDate, txType, txShares, excludeTxId = null) {
  const baseRow = excludeTxId
    ? queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ? AND id != ?",
        [userId, stockId, txDate, excludeTxId]
      )
    : queryOne(
        "SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?",
        [userId, stockId, txDate]
      );
  const baseShares = baseRow && baseRow.shares != null ? Number(baseRow.shares) : 0;
  const delta = txType === 'buy' ? Number(txShares) : -Number(txShares);
  let cumulative = baseShares + delta;
  if (cumulative < 0) return { ok: false, conflictDate: txDate, expectedShares: cumulative };

  const futureSql = excludeTxId
    ? "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? AND id != ? ORDER BY date, created_at"
    : "SELECT date, type, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date > ? ORDER BY date, created_at";
  const futureParams = excludeTxId ? [userId, stockId, txDate, excludeTxId] : [userId, stockId, txDate];
  const future = queryAll(futureSql, futureParams);
  for (const t of future) {
    cumulative += t.type === 'buy' ? Number(t.shares) : -Number(t.shares);
    if (cumulative < 0) return { ok: false, conflictDate: t.date, expectedShares: cumulative };
  }
  return { ok: true };
}

module.exports = {
  DEFAULT_STOCK_SETTINGS,
  getStockSettings,
  calcStockFee,
  calcStockTax,
  normalizeStockSettingsInput,
  makeStockTxHash,
  makeDividendHash,
  getSharesAtDate,
  validateChainConstraint,
};
