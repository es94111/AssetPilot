'use strict';
// lib/accountHelpers.js — 帳戶、貨幣、匯率共用邏輯（從 server.js 提取）

const { getDB, queryOne, queryAll, saveDB } = require('./db');

const DEFAULT_EXCHANGE_RATES = {
  TWD: 1, USD: 31.5, JPY: 0.21, EUR: 34.2, CNY: 4.35, HKD: 4.03,
};

function normalizeCurrency(code) {
  const c = String(code || 'TWD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'TWD';
}

function parseCurrencyCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : '';
}

function normalizeAccountIcon(icon) {
  const value = String(icon || '').trim().toLowerCase();
  return /^fa-[a-z0-9-]{1,40}$/.test(value) ? value : 'fa-wallet';
}

function categoryFromAccountType(accountType) {
  switch (accountType) {
    case '銀行': return 'bank';
    case '信用卡': return 'credit_card';
    case '虛擬錢包':
    case '虛擬': return 'virtual_wallet';
    case '現金':
    default: return 'cash';
  }
}

function accountTypeFromCategory(category) {
  switch (category) {
    case 'bank': return '銀行';
    case 'credit_card': return '信用卡';
    case 'virtual_wallet': return '虛擬錢包';
    case 'cash':
    default: return '現金';
  }
}

function getUserExchangeRateMap(userId) {
  const rows = queryAll('SELECT currency, rate_to_twd FROM exchange_rates WHERE user_id = ?', [userId]);
  const map = { TWD: 1 };
  rows.forEach(r => {
    const c = normalizeCurrency(r.currency);
    const rate = Number(r.rate_to_twd);
    if (rate > 0) map[c] = rate;
  });
  map.TWD = 1;
  return map;
}

function getExchangeRateToTwd(userId, currencyCode) {
  const c = normalizeCurrency(currencyCode);
  if (c === 'TWD') return 1;
  const row = queryOne('SELECT rate_to_twd FROM exchange_rates WHERE user_id = ? AND currency = ?', [userId, c]);
  if (row && Number(row.rate_to_twd) > 0) return Number(row.rate_to_twd);
  return Number(DEFAULT_EXCHANGE_RATES[c]) || 1;
}

function convertFromTwd(twdAmount, currencyCode, userId) {
  const currency = normalizeCurrency(currencyCode);
  const twd = Number(twdAmount) || 0;
  if (currency === 'TWD') return twd;
  const rate = getExchangeRateToTwd(userId, currency);
  if (!(rate > 0)) return twd;
  return Math.round((twd / rate) * 100) / 100;
}

function calcBalance(accId, initialBalance, userId, accountCurrency = 'TWD') {
  let balance = Number(initialBalance) || 0;
  const txs = queryAll(
    'SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?',
    [accId, userId]
  );
  txs.forEach(t => {
    const txCurrency = normalizeCurrency(t.currency);
    const value = txCurrency === accountCurrency
      ? (Number(t.original_amount) > 0 ? Number(t.original_amount) : Number(t.amount) || 0)
      : convertFromTwd(t.amount, accountCurrency, userId);
    if (t.type === 'income' || t.type === 'transfer_in') balance += value;
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= value;
  });
  return Math.round(balance * 100) / 100;
}

function getExchangeRateSettings(userId) {
  let row = queryOne('SELECT * FROM exchange_rate_settings WHERE user_id = ?', [userId]);
  if (!row) {
    getDB().run('INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)', [userId, Date.now()]);
    saveDB();
    row = queryOne('SELECT * FROM exchange_rate_settings WHERE user_id = ?', [userId]);
  }
  return {
    autoUpdate: !!row?.auto_update,
    lastSyncedAt: Number(row?.last_synced_at) || 0,
  };
}

function formatAccount(a, balance, twdAccumulated) {
  return {
    ...a,
    icon: normalizeAccountIcon(a.icon),
    initialBalance: a.initial_balance,
    currency: normalizeCurrency(a.currency),
    balance: balance ?? calcBalance(a.id, a.initial_balance, a.user_id, normalizeCurrency(a.currency)),
    twdAccumulated: twdAccumulated ?? 0,
    linkedBankId: a.linked_bank_id || null,
    category: a.category || categoryFromAccountType(a.account_type),
    overseasFeeRate: a.overseas_fee_rate ?? null,
    excludeFromTotal: a.exclude_from_total === 1,
    updatedAt: Number(a.updated_at) || 0,
  };
}

function convertToTwd(originalAmount, currencyCode, fxRateInput, userId) {
  const currency = normalizeCurrency(currencyCode);
  const original = Number(originalAmount);
  if (!(original > 0)) throw new Error('金額必須大於 0');
  const fxRate = currency === 'TWD'
    ? 1
    : (Number(fxRateInput) > 0 ? Number(fxRateInput) : getExchangeRateToTwd(userId, currency));
  const twdAmount = Math.round(original * fxRate * 100) / 100;
  return { currency, originalAmount: original, fxRate, twdAmount };
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  let candidate = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    candidate = s;
  } else if (/^\d{8}$/.test(s)) {
    candidate = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/');
    candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    return '';
  }
  const [y, m, d] = candidate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return '';
  return candidate;
}

module.exports = {
  normalizeCurrency,
  parseCurrencyCode,
  normalizeAccountIcon,
  categoryFromAccountType,
  accountTypeFromCategory,
  getUserExchangeRateMap,
  getExchangeRateToTwd,
  convertFromTwd,
  convertToTwd,
  normalizeDate,
  calcBalance,
  getExchangeRateSettings,
  formatAccount,
  DEFAULT_EXCHANGE_RATES,
};

