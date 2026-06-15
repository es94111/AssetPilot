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

// 計算國外刷卡手續費（TWD 整數）。
// 規則：client 明確帶 fxFee（含 0）→ 視為手動覆寫，直接採用（clamp >= 0）；
// 否則僅在「帳戶為信用卡」且「幣別 ≠ TWD」且「overseas_fee_rate > 0」時，
// 依 round(台幣本額 × 費率(百分比) / 100) 自動計算；其餘為 0。
export function resolveOverseasFee(opts: {
  userId: string;
  accountId: string | null | undefined;
  currency: string;
  twdBase: number;
  clientFxFee: number | string | null | undefined;
}): number {
  const { userId, accountId, currency, twdBase, clientFxFee } = opts;
  if (clientFxFee != null && String(clientFxFee).trim() !== '') {
    return Math.max(0, Math.round(Number(clientFxFee) || 0));
  }
  if (!accountId || normalizeCurrency(currency) === 'TWD') return 0;
  const acc = queryOne(
    'SELECT category, account_type, overseas_fee_rate FROM accounts WHERE id = ? AND user_id = ?',
    [accountId, userId]
  );
  if (!acc) return 0;
  const isCredit = acc.category === 'credit_card' || acc.account_type === '信用卡';
  const rate = Number(acc.overseas_fee_rate) || 0;
  if (!isCredit || rate <= 0) return 0;
  return Math.max(0, Math.round((Number(twdBase) || 0) * rate / 100));
}

// 驗證／正規化信用卡每月結帳日：必須為 1~31 的整數，否則回 null（視為未設定）。
export function normalizeStatementClosingDay(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

// 信用卡帳單週期：給「每月結帳日」與使用者當地今天（YYYY-MM-DD），
// 算出「當期（未出帳）」帳單區間 = 上一個結帳日的隔天 ~ 下一個（含今天）結帳日，皆含端點。
// 遇當月天數不足（如結帳日 31 遇 2 月）自動 clamp 到當月最後一天。
export function creditCardStatementCycle(
  closingDay: number | null | undefined,
  todayStr: string
): { start: string; end: string } | null {
  const day = normalizeStatementClosingDay(closingDay);
  if (day == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayStr));
  if (!m) return null;
  const ty = Number(m[1]);
  const tm = Number(m[2]); // 1-12
  const td = Number(m[3]);

  // mo 為 1-12；Date.UTC(y, mo, 0) = 該月最後一天
  const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const clampedClosing = (y: number, mo: number) => Math.min(day, daysInMonth(y, mo));

  // 找出「下一個（含今天）結帳日」所在年月：今天已過本月結帳日則落在下個月
  let endY = ty;
  let endMo = tm;
  if (td > clampedClosing(ty, tm)) {
    endMo = tm + 1;
    if (endMo > 12) { endMo = 1; endY = ty + 1; }
  }
  const endDay = clampedClosing(endY, endMo);

  // 區間開始 = 上一個結帳日（end 的前一個月）的隔天
  let prevY = endY;
  let prevMo = endMo - 1;
  if (prevMo < 1) { prevMo = 12; prevY = endY - 1; }
  const startDate = new Date(Date.UTC(prevY, prevMo - 1, clampedClosing(prevY, prevMo) + 1));
  const fmt = (y: number, mo: number, d: number) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return {
    start: fmt(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate()),
    end: fmt(endY, endMo, endDay),
  };
}

// 連續往前推算多期帳單區間：回傳最近 count 期（含當期），最新在前。
// 以「本期起日的前一天」當作下一輪基準日，逐期往回推，邊界自然連續不重疊。
export function creditCardStatementCycles(
  closingDay: number | null | undefined,
  todayStr: string,
  count: number
): Array<{ start: string; end: string }> {
  const n = Math.max(1, Math.min(36, Math.floor(Number(count)) || 1));
  const out: Array<{ start: string; end: string }> = [];
  let cursor = todayStr;
  for (let i = 0; i < n; i++) {
    const c = creditCardStatementCycle(closingDay, cursor);
    if (!c) break;
    out.push(c);
    // 下一輪基準 = 本期起日的前一天（即上一個結帳日）
    const sy = Number(c.start.slice(0, 4));
    const smo = Number(c.start.slice(5, 7));
    const sd = Number(c.start.slice(8, 10));
    const prev = new Date(Date.UTC(sy, smo - 1, sd - 1));
    cursor = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
  }
  return out;
}

// 某張帳單（結帳日 = cycleEnd）的「繳款窗口」＝結帳日的隔天 ~ 下一個結帳日。
// 帳單結帳後通常在下一個區間才繳清，故繳款應對應回上一張帳單。回傳該窗口 [start, end]。
export function creditCardPaymentWindow(
  closingDay: number | null | undefined,
  cycleEnd: string
): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(cycleEnd));
  if (!m) return null;
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return creditCardStatementCycle(closingDay, nextStr);
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
