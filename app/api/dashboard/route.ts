import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../lib/db';
import { todayInUserTz, monthInUserTz } from '../../../lib/userTime';
import { calcBalance, getExchangeRateToTwd, normalizeCurrency } from '../../../lib/accountHelpers';
import { calcFifoLots } from '../../../lib/moneyDecimal';
import {
  buildDashboardChangeDrivers,
  getDashboardComparisonWindow,
  getHoldingMarketContribution,
  type DashboardComparisonCategory,
} from '../../../lib/dashboardInsights';
import { parseDashboardLayout } from '../../../lib/dashboardPreferences';
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
  name: string | null;
  symbol: string | null;
  currency: string | null;
  current_price: string | number | null;
};
type CountRow = { count: string | number | null };
type SettingsRow = { dashboard_layout: string | null; dashboard_layout_updated_at: string | number | null };
type ComparisonRow = DashboardComparisonCategory & { period: 'current' | 'previous'; transactionCount: string | number | null };

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

function getStockPortfolioStatus(userId: string): {
  marketValue: number;
  unpricedHoldingCount: number;
  health: DashboardResponse['portfolioHealth'];
} {
  const stocks = queryAll(
    'SELECT id, name, symbol, currency, current_price FROM stocks WHERE user_id = ?',
    [userId]
  ) as unknown as StockRow[];

  let unpricedHoldingCount = 0;
  let totalCost = 0;
  const holdings: Array<{ name: string; symbol: string; currency: string; marketValue: number; priced: boolean }> = [];
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
    if (totalShares <= 0) return sum;
    const currentPrice = Number(stock.current_price) || 0;
    const contribution = getHoldingMarketContribution(totalShares, currentPrice);
    if (contribution.unpriced) unpricedHoldingCount += 1;
    if (!contribution.unpriced) totalCost += fifo.totalCost.toNumber();
    holdings.push({
      name: stock.name || stock.symbol || '—',
      symbol: stock.symbol || '',
      currency: normalizeCurrency(stock.currency),
      marketValue: contribution.marketValue,
      priced: !contribution.unpriced,
    });
    return sum + contribution.marketValue;
  }, 0);

  const currencies = new Set(holdings.map(holding => holding.currency));
  const pricedHoldings = holdings.filter(holding => holding.priced);
  const largestHolding = pricedHoldings.sort((a, b) => b.marketValue - a.marketValue)[0] || null;
  const portfolioCurrency = currencies.size === 1 ? [...currencies][0] : null;
  const roundAmount = (value: number) => portfolioCurrency === 'TWD'
    ? Math.round(value)
    : Math.round(value * 100) / 100;
  const roundedMarketValue = roundAmount(total);
  const roundedTotalCost = roundAmount(totalCost);
  const mixedCurrencies = currencies.size > 1;
  const unavailableReason = holdings.length === 0
    ? 'noHoldings'
    : mixedCurrencies
      ? 'mixedCurrencies'
      : pricedHoldings.length === 0
        ? 'missingPrices'
        : null;

  return {
    marketValue: roundedMarketValue,
    unpricedHoldingCount,
    health: {
      available: unavailableReason === null,
      unavailableReason,
      currency: portfolioCurrency,
      marketValue: roundedMarketValue,
      totalCost: roundedTotalCost,
      unrealizedGrossPL: roundAmount(total - totalCost),
      costReturnRate: totalCost > 0 ? Math.round(((total - totalCost) / totalCost) * 1000) / 10 : null,
      pricedHoldingCount: pricedHoldings.length,
      holdingCount: holdings.length,
      largestHolding: largestHolding && total > 0 ? {
        name: largestHolding.name,
        symbol: largestHolding.symbol,
        marketValue: roundAmount(largestHolding.marketValue),
        share: Math.round((largestHolding.marketValue / total) * 1000) / 10,
      } : null,
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ymRaw = String(searchParams.get('yearMonth') || searchParams.get('ym') || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : monthInUserTz(auth.userTimezone);
  const todayS = todayInUserTz(auth.userTimezone);
  const comparisonWindow = getDashboardComparisonWindow(month, todayS);

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
  const settings = queryOne(
    'SELECT dashboard_layout, dashboard_layout_updated_at FROM user_settings WHERE user_id = ?',
    [auth.userId]
  ) as SettingsRow | null;

  let comparisonRows: ComparisonRow[] = [];
  if (comparisonWindow) {
    comparisonRows = queryAll(`
      SELECT
        CASE
          WHEN t.date BETWEEN ? AND ? THEN 'current'
          WHEN t.date BETWEEN ? AND ? THEN 'previous'
        END AS period,
        t.type,
        COALESCE(c.parent_id, c.id) AS "categoryId",
        COALESCE(p.name, c.name, '未分類') AS name,
        COALESCE(p.color, c.color, '#94a3b8') AS color,
        COALESCE(SUM(t.amount), 0) AS amount,
        COUNT(*) AS "transactionCount"
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
      LEFT JOIN categories p ON c.parent_id = p.id AND p.user_id = t.user_id
      WHERE t.user_id = ?
        AND t.type IN ('income', 'expense')
        AND t.exclude_from_stats = 0
        AND ((t.date BETWEEN ? AND ?) OR (t.date BETWEEN ? AND ?))
      GROUP BY period, t.type, COALESCE(c.parent_id, c.id), COALESCE(p.name, c.name, '未分類'), COALESCE(p.color, c.color, '#94a3b8')
    `, [
      comparisonWindow.currentStart,
      comparisonWindow.currentEnd,
      comparisonWindow.previousStart,
      comparisonWindow.previousEnd,
      auth.userId,
      comparisonWindow.currentStart,
      comparisonWindow.currentEnd,
      comparisonWindow.previousStart,
      comparisonWindow.previousEnd,
    ]) as unknown as ComparisonRow[];
  }
  const currentComparisonRows = comparisonRows.filter(row => row.period === 'current');
  const previousComparisonRows = comparisonRows.filter(row => row.period === 'previous');
  const comparisonTotals = (rows: ComparisonRow[]) => {
    const totals = rows.reduce((result, row) => {
      result[row.type] += Number(row.amount) || 0;
      result.transactionCount += Number(row.transactionCount) || 0;
      return result;
    }, { income: 0, expense: 0, transactionCount: 0 });
    return { ...totals, net: totals.income - totals.expense };
  };
  const currentComparison = comparisonTotals(currentComparisonRows);
  const previousComparison = comparisonTotals(previousComparisonRows);

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
    preferences: {
      layout: parseDashboardLayout(settings?.dashboard_layout),
      updatedAt: Number(settings?.dashboard_layout_updated_at) || 0,
    },
    comparison: {
      available: comparisonWindow !== null && previousComparison.transactionCount > 0,
      currentTransactionCount: currentComparison.transactionCount,
      previousTransactionCount: previousComparison.transactionCount,
      window: comparisonWindow,
      current: currentComparison,
      previous: comparisonWindow ? {
        income: previousComparison.income,
        expense: previousComparison.expense,
        net: previousComparison.net,
      } : null,
      delta: comparisonWindow ? {
        income: currentComparison.income - previousComparison.income,
        expense: currentComparison.expense - previousComparison.expense,
        net: currentComparison.net - previousComparison.net,
      } : null,
      drivers: comparisonWindow
        ? buildDashboardChangeDrivers(currentComparisonRows, previousComparisonRows)
        : [],
    },
    portfolioHealth: stockStatus.health,
    catBreakdown,
    incomeCatBreakdown,
    recent,
  };

  return NextResponse.json(response);
}
