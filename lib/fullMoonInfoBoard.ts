import { categoryFromAccountType, convertFromTwd, getExchangeRateToTwd, normalizeCurrency } from './accountHelpers';
import { blankMonthsAfter, visibleThroughMonthIndexForToday } from './fullMoonInfoBoardCutoff';
import { queryAll, queryOne } from './db';
import { getMonthClosePrices, priceCacheKey } from './stockMonthClosePrice';
import { todayInUserTz } from './userTime';

export const FULL_MOON_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export type BoardTone = 'asset' | 'income' | 'debt' | 'investment' | 'expense';

export type BoardRow = {
  group: string;
  item: string;
  values: number[];
  tone?: BoardTone;
};

export type BoardSection = {
  title: string;
  totalLabel: string;
  totalMode: 'change' | 'sum';
  tone: BoardTone;
  rows: BoardRow[];
};

export type FullMoonInfoBoardData = {
  year: number;
  visibleThroughMonthIndex: number;
  sections: BoardSection[];
  hasRecordedData: boolean;
};

type AccountRow = {
  id: string;
  name: string;
  category: string | null;
  account_type: string | null;
  initial_balance: string | number | null;
  currency: string | null;
  exclude_from_total: string | number | null;
  created_at: string | number | null;
  sort_order: string | number | null;
};

type TransactionRow = {
  date: string;
  type: string;
  amount: string | number | null;
  currency: string | null;
  original_amount: string | number | null;
};

type CategoryTransactionRow = {
  date: string;
  amount: string | number | null;
  cat_name: string | null;
  cat_parent_name: string | null;
  cat_sort_order: string | number | null;
  cat_parent_sort_order: string | number | null;
};

type StockRow = {
  id: string;
  symbol: string;
  name: string;
  current_price: string | number | null;
  currency: string | null;
};

type StockTransactionRow = {
  date: string;
  type: string;
  shares: string | number | null;
};

type StockDividendRow = {
  date: string;
  cash_dividend: string | number | null;
};

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function emptyValues(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundTwd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function monthEnd(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function monthIndexFor(date: string, year: number): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(date || ''));
  if (!match || Number(match[1]) !== year) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month - 1 : null;
}

function accountCreatedAfterMonth(account: AccountRow, endDate: string): boolean {
  const createdAt = typeof account.created_at === 'string' ? account.created_at.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(createdAt) && createdAt > endDate;
}

function accountCategory(account: AccountRow): string {
  return account.category || categoryFromAccountType(account.account_type || '');
}

function accountGroupLabel(category: string): string {
  switch (category) {
    case 'bank': return '銀行';
    case 'cash': return '現金';
    case 'virtual_wallet': return '虛擬錢包';
    case 'credit_card': return '信用卡';
    default: return '帳戶';
  }
}

function applyTransactionToBalance(balance: number, tx: TransactionRow, accountCurrency: string, userId: string): number {
  const txCurrency = normalizeCurrency(tx.currency);
  const value = txCurrency === accountCurrency
    ? (Number(tx.original_amount) > 0 ? Number(tx.original_amount) : Number(tx.amount) || 0)
    : convertFromTwd(Number(tx.amount) || 0, accountCurrency, userId);

  if (tx.type === 'income' || tx.type === 'transfer_in') return balance + value;
  if (tx.type === 'expense' || tx.type === 'transfer_out') return balance - value;
  return balance;
}

function monthlyAccountBalances(userId: string, account: AccountRow, year: number, visibleThroughMonthIndex: number): number[] {
  const accountCurrency = normalizeCurrency(account.currency);
  const rate = getExchangeRateToTwd(userId, accountCurrency);
  const txs = asRows<TransactionRow>(queryAll(
    `SELECT type, amount, currency, original_amount, date
     FROM transactions
     WHERE user_id = ? AND account_id = ? AND date <= ?
     ORDER BY date, created_at`,
    [userId, account.id, monthEnd(year, visibleThroughMonthIndex)]
  ));

  return FULL_MOON_MONTHS.map((_, index) => {
    if (index > visibleThroughMonthIndex) return 0;
    const endDate = monthEnd(year, index);
    if (accountCreatedAfterMonth(account, endDate)) return 0;

    const balance = txs
      .filter(tx => tx.date <= endDate)
      .reduce(
        (current, tx) => applyTransactionToBalance(current, tx, accountCurrency, userId),
        Number(account.initial_balance) || 0
      );
    return roundTwd(balance * rate);
  });
}

function buildAccountRows(userId: string, year: number, visibleThroughMonthIndex: number): { assets: BoardRow[]; debts: BoardRow[] } {
  const accounts = asRows<AccountRow>(queryAll(
    `SELECT id, name, category, account_type, initial_balance, currency, exclude_from_total, created_at, sort_order
     FROM accounts
     WHERE user_id = ?
     ORDER BY sort_order, created_at, name`,
    [userId]
  ));

  const assets: BoardRow[] = [];
  const debts: BoardRow[] = [];

  for (const account of accounts) {
    if (Number(account.exclude_from_total) === 1) continue;
    const category = accountCategory(account);
    const balances = monthlyAccountBalances(userId, account, year, visibleThroughMonthIndex);

    if (category === 'credit_card') {
      debts.push({
        group: accountGroupLabel(category),
        item: account.name,
        values: balances.map(value => Math.max(0, -value)),
      });
      continue;
    }

    assets.push({
      group: accountGroupLabel(category),
      item: account.name,
      values: balances,
    });
  }

  return { assets, debts };
}

function buildCategoryRows(userId: string, year: number, visibleThroughMonthIndex: number, type: 'income' | 'expense'): BoardRow[] {
  const rows = asRows<CategoryTransactionRow>(queryAll(
    `SELECT t.date, t.amount,
            c.name AS cat_name,
            c.sort_order AS cat_sort_order,
            p.name AS cat_parent_name,
            p.sort_order AS cat_parent_sort_order
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN categories p ON c.parent_id = p.id
     WHERE t.user_id = ?
       AND t.type = ?
       AND t.date >= ?
       AND t.date <= ?
       AND COALESCE(t.exclude_from_stats, 0) = 0
     ORDER BY COALESCE(p.sort_order, c.sort_order, 9999), COALESCE(c.sort_order, 9999), c.name`,
    [userId, type, `${year}-01-01`, monthEnd(year, visibleThroughMonthIndex)]
  ));

  const buckets = new Map<string, {
    group: string;
    item: string;
    values: number[];
    parentOrder: number;
    childOrder: number;
  }>();

  for (const row of rows) {
    const index = monthIndexFor(row.date, year);
    if (index === null) continue;
    const group = row.cat_parent_name || '';
    const item = row.cat_name || '未分類';
    const key = `${group}\u0000${item}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        group,
        item,
        values: emptyValues(),
        parentOrder: Number(row.cat_parent_sort_order ?? row.cat_sort_order ?? 9999),
        childOrder: Number(row.cat_sort_order ?? 9999),
      });
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.values[index] += Number(row.amount) || 0;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.parentOrder - b.parentOrder || a.childOrder - b.childOrder || sum(b.values) - sum(a.values) || a.item.localeCompare(b.item, 'zh-Hant'))
    .map(row => ({
      group: row.group,
      item: row.item,
      values: blankMonthsAfter(row.values.map(roundTwd), visibleThroughMonthIndex),
      tone: type === 'expense' && /投資|股票|基金|ETF/i.test(`${row.group} ${row.item}`) ? 'investment' : undefined,
    }));
}

function monthlyStockValues(
  userId: string,
  stock: StockRow,
  year: number,
  visibleThroughMonthIndex: number,
  monthClosePrices: Map<string, number>
): number[] {
  const txs = asRows<StockTransactionRow>(queryAll(
    `SELECT date, type, shares
     FROM stock_transactions
     WHERE user_id = ? AND stock_id = ? AND date <= ?
     ORDER BY date, created_at`,
    [userId, stock.id, monthEnd(year, visibleThroughMonthIndex)]
  ));
  const currentPrice = Number(stock.current_price) > 0 ? Number(stock.current_price) : 0;
  const rate = getExchangeRateToTwd(userId, normalizeCurrency(stock.currency));

  return FULL_MOON_MONTHS.map((_, index) => {
    if (index > visibleThroughMonthIndex) return 0;
    const endDate = monthEnd(year, index);
    const shares = txs
      .filter(tx => tx.date <= endDate)
      .reduce((current, tx) => {
        if (tx.type === 'buy') return current + (Number(tx.shares) || 0);
        if (tx.type === 'sell') return current - (Number(tx.shares) || 0);
        return current;
      }, 0);
    // 已結束月份鎖定當月最後交易日收盤價；當月（尚未結束）才用目前股價，抓不到收盤價時才 fallback 回目前股價
    const lockedPrice = index < visibleThroughMonthIndex
      ? monthClosePrices.get(priceCacheKey(stock.symbol, year, index))
      : undefined;
    const price = lockedPrice !== undefined ? lockedPrice : currentPrice;
    return roundTwd(Math.max(0, shares) * price * rate);
  });
}

async function buildStockRows(userId: string, year: number, visibleThroughMonthIndex: number): Promise<BoardRow[]> {
  const stocks = asRows<StockRow>(queryAll(
    `SELECT id, symbol, name, current_price, currency
     FROM stocks
     WHERE user_id = ? AND COALESCE(delisted, 0) = 0
     ORDER BY symbol, name`,
    [userId]
  ));

  const closedMonthIndexes = Array.from({ length: visibleThroughMonthIndex }, (_, index) => index);
  const monthClosePrices = await getMonthClosePrices(
    stocks.map(stock => stock.symbol),
    year,
    closedMonthIndexes
  );

  return stocks
    .map((stock): BoardRow => ({
      group: '投資',
      item: `${stock.symbol} ${stock.name}`.trim(),
      values: monthlyStockValues(userId, stock, year, visibleThroughMonthIndex, monthClosePrices),
    }))
    .filter(row => row.values.some(value => value !== 0));
}

function buildCashDividendRow(userId: string, year: number, visibleThroughMonthIndex: number): BoardRow | null {
  const dividends = asRows<StockDividendRow>(queryAll(
    `SELECT date, cash_dividend
     FROM stock_dividends
     WHERE user_id = ? AND date >= ? AND date <= ?`,
    [userId, `${year}-01-01`, monthEnd(year, visibleThroughMonthIndex)]
  ));
  const values = emptyValues();
  for (const dividend of dividends) {
    const index = monthIndexFor(dividend.date, year);
    if (index === null) continue;
    values[index] += Number(dividend.cash_dividend) || 0;
  }
  if (!values.some(value => value !== 0)) return null;
  return { group: '', item: '現金股利', values: blankMonthsAfter(values.map(roundTwd), visibleThroughMonthIndex) };
}

function currentPeriodForUser(userId: string): { year: number; visibleThroughMonthIndex: number } {
  const user = asRow<{ timezone: string | null }>(queryOne('SELECT timezone FROM users WHERE id = ?', [userId]));
  const today = todayInUserTz(user?.timezone || 'Asia/Taipei');
  const year = Number(today.slice(0, 4)) || new Date().getFullYear();
  const visibleThroughMonthIndex = visibleThroughMonthIndexForToday(today);
  return { year, visibleThroughMonthIndex };
}

export async function getFullMoonInfoBoardData(userId: string): Promise<FullMoonInfoBoardData> {
  const { year, visibleThroughMonthIndex } = currentPeriodForUser(userId);
  const accountRows = buildAccountRows(userId, year, visibleThroughMonthIndex);
  const stockRows = await buildStockRows(userId, year, visibleThroughMonthIndex);
  const incomeRows = buildCategoryRows(userId, year, visibleThroughMonthIndex, 'income');
  const cashDividendRow = buildCashDividendRow(userId, year, visibleThroughMonthIndex);
  const expenseRows = buildCategoryRows(userId, year, visibleThroughMonthIndex, 'expense');

  const sections: BoardSection[] = [
    {
      title: '資產市值',
      totalLabel: '資產總計',
      totalMode: 'change',
      tone: 'asset',
      rows: [...accountRows.assets, ...stockRows],
    },
    {
      title: '收入',
      totalLabel: '收入總計',
      totalMode: 'sum',
      tone: 'income',
      rows: cashDividendRow ? [...incomeRows, cashDividendRow] : incomeRows,
    },
    {
      title: '負債',
      totalLabel: '負債總計',
      totalMode: 'sum',
      tone: 'debt',
      rows: accountRows.debts,
    },
    {
      title: '支出',
      totalLabel: '支出總計',
      totalMode: 'sum',
      tone: 'expense',
      rows: expenseRows,
    },
  ];

  return {
    year,
    visibleThroughMonthIndex,
    sections,
    hasRecordedData: sections.some(section => section.rows.some(row => row.values.some(value => value !== 0))),
  };
}
