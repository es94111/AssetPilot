import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../lib/db';
import { todayInUserTz, monthInUserTz } from '../../../lib/userTime';
import { calcBalance, getExchangeRateToTwd, normalizeCurrency } from '../../../lib/accountHelpers';
import { calcFifoLots } from '../../../lib/moneyDecimal';
import { getHoldingMarketContribution } from '../../../lib/dashboardInsights';
import {
  buildCategoryAggregateNodes,
  type DashboardCategoryAggregateRow,
  type DashboardResponse,
  type RecentTransaction,
} from '../../../lib/dashboardHelpers';

type TotalRow = { total: string | number | null };
type AccountRow = {
  id: string;
  initial_balance: string | number | null;
  currency: string | null;
};
type StockRow = {
  id: string;
  current_price: string | number | null;
};
type CountRow = { count: string | number | null };

function totalFromRow(row: Record<string, string | number | null> | null): number {
  return Number((row as TotalRow | null)?.total) || 0;
}

function getBankBalanceTwd(userId: string): number {
  const accounts = queryAll(
    `SELECT id, initial_balance, currency
     FROM accounts
     WHERE user_id = ?
       AND COALESCE(exclude_from_total, 0) = 0
       AND (category = 'bank' OR account_type = '銀行')`,
    [userId]
  ) as unknown as AccountRow[];

  const total = accounts.reduce((sum, account) => {
    const currency = normalizeCurrency(account.currency);
    const balance = calcBalance(account.id, Number(account.initial_balance) || 0, userId, currency);
    return sum + balance * getExchangeRateToTwd(userId, currency);
  }, 0);

  return Math.round(total);
}

function getStockPortfolioStatus(userId: string): { marketValue: number; unpricedHoldingCount: number } {
  const stocks = queryAll(
    'SELECT id, current_price FROM stocks WHERE user_id = ?',
    [userId]
  ) as unknown as StockRow[];

  let unpricedHoldingCount = 0;
  const total = stocks.reduce((sum, stock) => {
    const txs = queryAll(
      'SELECT * FROM stock_transactions WHERE user_id = ? AND stock_id = ? ORDER BY date, created_at',
      [userId, stock.id]
    );
    const divs = queryAll(
      'SELECT stock_dividend_shares FROM stock_dividends WHERE user_id = ? AND stock_id = ?',
      [userId, stock.id]
    );
    const fifo = calcFifoLots(txs);
    const dividendSyntheticShares = txs
      .filter(t => t.type === 'buy' && Number(t.price) === 0 && typeof t.note === 'string' && /\[SYNTH\] 股票股利|股票股利配發/.test(t.note))
      .reduce((shareSum, t) => shareSum + Number(t.shares || 0), 0);
    const recordedDividendShares = divs.reduce((shareSum, d) => shareSum + Number(d.stock_dividend_shares || 0), 0);
    const missingDividendShares = Math.max(0, recordedDividendShares - dividendSyntheticShares);
    const totalShares = fifo.totalShares.plus(missingDividendShares).toNumber();
    const currentPrice = Number(stock.current_price) || 0;
    const contribution = getHoldingMarketContribution(totalShares, currentPrice);
    if (contribution.unpriced) unpricedHoldingCount += 1;
    return sum + contribution.marketValue;
  }, 0);

  return { marketValue: Math.round(total), unpricedHoldingCount };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ymRaw = String(searchParams.get('yearMonth') || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : monthInUserTz(auth.userTimezone);
  const todayS = todayInUserTz(auth.userTimezone);

  const income = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0",
    [auth.userId, month + '%']
  ));
  const expense = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0",
    [auth.userId, month + '%']
  ));
  const todayExpense = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0",
    [auth.userId, todayS]
  ));
  const bankBalance = getBankBalanceTwd(auth.userId);
  const stockStatus = getStockPortfolioStatus(auth.userId);

  const recurringNeedsAttentionCount = Number((queryOne(
    `SELECT COUNT(*) AS count
     FROM recurring
     WHERE user_id = ? AND is_active = 1 AND needs_attention = 1`,
    [auth.userId]
  ) as CountRow | null)?.count) || 0;
  const uncategorized = queryOne(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = ?
       AND type IN ('income', 'expense')
       AND date LIKE ?
       AND exclude_from_stats = 0
       AND (category_id IS NULL OR category_id = '')`,
    [auth.userId, month + '%']
  ) as (CountRow & TotalRow) | null;

  const catRows = queryAll(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `, [auth.userId, month + '%']) as unknown as DashboardCategoryAggregateRow[];
  const catBreakdown = buildCategoryAggregateNodes(catRows);

  const incomeCatRows = queryAll(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'income' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `, [auth.userId, month + '%']) as unknown as DashboardCategoryAggregateRow[];
  const incomeCatBreakdown = buildCategoryAggregateNodes(incomeCatRows);

  const recent = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0 AND t.date LIKE ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `, [auth.userId, month + '%']) as RecentTransaction[];

  const response: DashboardResponse = {
    yearMonth: month,
    income,
    expense,
    net: income - expense,
    todayExpense,
    bankBalance,
    stockMarketValue: stockStatus.marketValue,
    dataStatus: {
      generatedAt: Date.now(),
      unpricedHoldingCount: stockStatus.unpricedHoldingCount,
    },
    attention: {
      recurringNeedsAttentionCount,
      uncategorizedTransactionCount: Number(uncategorized?.count) || 0,
      uncategorizedAmount: totalFromRow(uncategorized),
    },
    catBreakdown,
    incomeCatBreakdown,
    recent,
  };

  return NextResponse.json(response);
}
