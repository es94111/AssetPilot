// lib/accountHelpers.ts — 帳戶、貨幣、匯率共用邏輯
import Decimal from 'decimal.js';
import { getDB, queryOne, queryAll, saveDB } from './db';

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  TWD: 1, USD: 31.5, JPY: 0.21, EUR: 34.2, CNY: 4.35, HKD: 4.03,
};

export function normalizeCurrency(code: string | null | undefined): string {
  const c = String(code || 'TWD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'TWD';
}

export function parseCurrencyCode(code: string | null | undefined): string {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : '';
}

export function normalizeAccountIcon(icon: string | null | undefined): string {
  const value = String(icon || '').trim().toLowerCase();
  return /^fa-[a-z0-9-]{1,40}$/.test(value) ? value : 'fa-wallet';
}

export function categoryFromAccountType(accountType: string): string {
  switch (accountType) {
    case '銀行': return 'bank';
    case '信用卡': return 'credit_card';
    case '虛擬錢包':
    case '虛擬': return 'virtual_wallet';
    case '現金':
    default: return 'cash';
  }
}

export function accountTypeFromCategory(category: string): string {
  switch (category) {
    case 'bank': return '銀行';
    case 'credit_card': return '信用卡';
    case 'virtual_wallet': return '虛擬錢包';
    case 'cash':
    default: return '現金';
  }
}

export function getUserExchangeRateMap(userId: string): Record<string, number> {
  const rows = queryAll('SELECT currency, rate_to_twd FROM exchange_rates WHERE user_id = ?', [userId]);
  const map: Record<string, number> = { TWD: 1 };
  rows.forEach(r => {
    const c = normalizeCurrency(r.currency as string);
    const rate = Number(r.rate_to_twd);
    if (rate > 0) map[c] = rate;
  });
  map.TWD = 1;
  return map;
}

export function getExchangeRateToTwd(userId: string, currencyCode: string | null | undefined): number {
  const c = normalizeCurrency(currencyCode);
  if (c === 'TWD') return 1;
  const row = queryOne('SELECT rate_to_twd FROM exchange_rates WHERE user_id = ? AND currency = ?', [userId, c]);
  if (row && Number(row.rate_to_twd) > 0) return Number(row.rate_to_twd);
  return Number(DEFAULT_EXCHANGE_RATES[c]) || 1;
}

// 取得 decimal 字符串格式的匯率（精確到小數點後 8 位）
export function getExchangeRateToTwdAsDecimal(userId: string, currencyCode: string | null | undefined): string {
  const c = normalizeCurrency(currencyCode);
  if (c === 'TWD') return '1';
  const row = queryOne('SELECT rate_to_twd FROM exchange_rates WHERE user_id = ? AND currency = ?', [userId, c]);
  if (row && row.rate_to_twd) {
    const rateStr = String(row.rate_to_twd).trim();
    if (rateStr) return rateStr;
  }
  // fallback 到默認匯率（轉為 decimal 字符串）
  const defaultRate = DEFAULT_EXCHANGE_RATES[c] || 1;
  return new Decimal(defaultRate).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toString();
}

export function convertFromTwd(twdAmount: number, currencyCode: string, userId: string): number {
  const currency = normalizeCurrency(currencyCode);
  const twd = Number(twdAmount) || 0;
  if (currency === 'TWD') return twd;
  const rate = getExchangeRateToTwd(userId, currency);
  if (!(rate > 0)) return twd;
  return Math.round((twd / rate) * 100) / 100;
}

export function calcBalance(accId: string, initialBalance: number, userId: string, accountCurrency = 'TWD'): number {
  let balance = Number(initialBalance) || 0;
  const txs = queryAll(
    'SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?',
    [accId, userId]
  );
  txs.forEach(t => {
    const txCurrency = normalizeCurrency(t.currency as string);
    const value = txCurrency === accountCurrency
      ? (Number(t.original_amount) > 0 ? Number(t.original_amount) : Number(t.amount) || 0)
      : convertFromTwd(Number(t.amount), accountCurrency, userId);
    if (t.type === 'income' || t.type === 'transfer_in') balance += value;
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= value;
  });
  return Math.round(balance * 100) / 100;
}

export interface ExchangeRateSettings {
  autoUpdate: boolean;
  lastSyncedAt: number;
}

export function getExchangeRateSettings(userId: string): ExchangeRateSettings {
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

export function formatAccount(
  a: Record<string, unknown>,
  balance?: number | null,
  twdAccumulated?: number | null
): Record<string, unknown> {
  return {
    ...a,
    icon: normalizeAccountIcon(a.icon as string),
    initialBalance: a.initial_balance,
    currency: normalizeCurrency(a.currency as string),
    balance: balance ?? calcBalance(a.id as string, a.initial_balance as number, a.user_id as string, normalizeCurrency(a.currency as string)),
    twdAccumulated: twdAccumulated ?? 0,
    linkedBankId: a.linked_bank_id || null,
    category: a.category || categoryFromAccountType(a.account_type as string),
    overseasFeeRate: a.overseas_fee_rate ?? null,
    excludeFromTotal: a.exclude_from_total === 1,
    updatedAt: Number(a.updated_at) || 0,
  };
}

export interface ConvertToTwdResult {
  currency: string;
  originalAmount: number;
  fxRate: string;  // decimal 字符串，精確到小數點後 8 位
  twdAmount: number;
}

export function convertToTwd(
  originalAmount: number,
  currencyCode: string,
  fxRateInput: number | string | null | undefined,
  userId: string
): ConvertToTwdResult {
  const currency = normalizeCurrency(currencyCode);
  const original = Number(originalAmount);
  if (!(original > 0)) throw new Error('金額必須大於 0');
  
  let fxRate: string;
  if (currency === 'TWD') {
    fxRate = '1';
  } else if (fxRateInput != null && String(fxRateInput).trim()) {
    // 使用用戶提供的匯率，轉為 decimal 字符串
    const inputValue = new Decimal(String(fxRateInput));
    if (inputValue.lessThanOrEqualTo(0)) {
      throw new Error('匯率必須大於 0');
    }
    fxRate = inputValue.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toString();
  } else {
    // 從資料庫取得匯率
    fxRate = getExchangeRateToTwdAsDecimal(userId, currency);
  }
  
  // 使用 Decimal.js 精確計算 TWD 等值
  const fxRateDecimal = new Decimal(fxRate);
  const twdAmount = new Decimal(original).times(fxRateDecimal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  
  return { currency, originalAmount: original, fxRate, twdAmount };
}

export function normalizeDate(dateStr: string | null | undefined): string {
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
