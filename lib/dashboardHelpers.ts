import logger from '@/lib/logger';
import Decimal from 'decimal.js';
import { parseDashboardLayout, type DashboardLayoutPreference } from '@/lib/dashboardPreferences';
import {
  getHoldingMarketContribution,
  buildDashboardChangeDrivers,
  getDashboardComparisonWindow,
  type DashboardComparisonCategory,
  type DashboardChangeDriver,
  type DashboardComparisonWindow,
} from '@/lib/dashboardInsights';
import {
  buildScheduledCashOutlook,
  getScheduledAccountImpactTwd,
  type ScheduledCashOutlook,
  type ScheduledCashInput,
} from '@/lib/dashboardForecast';
import type { GoalReminder } from '@/lib/savingsGoal';
import { listGoalReminders } from '@/lib/savingsGoalStore';
import { queryAll, queryOne } from '@/lib/db';
import { calcFifoLots } from '@/lib/moneyDecimal';
import {
  calcBalance,
  convertFromTwd,
  getExchangeRateToTwd,
  getUserExchangeRateMap,
  normalizeCurrency,
} from '@/lib/accountHelpers';
import { convertReportSummaryToBase } from '@/lib/reportCurrencyConversion';
import { monthInUserTz, todayInUserTz, isValidIsoDate } from '@/lib/userTime';

export interface DashboardCategoryAggregateRow {
  category_id: string | number | null;
  amount: string | number | null;
  cat_name: string | null;
  cat_color: string | null;
  cat_parent_id: string | number | null;
  cat_parent_name: string | null;
  cat_parent_color: string | null;
}

export interface DashboardCategoryNode {
  categoryId: string | null;
  name: string;
  color: string;
  parentId: string;
  parentName: string;
  parentColor: string;
  total: number;
  isOtherGroup: boolean;
}

export interface RecentTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency?: string | null;
  original_amount?: number | null;
  fx_rate?: string | number | null;
  fx_fee?: number | null;
  twd_amount?: number | null;
  date: string;
  category_id?: string | null;
  account_id?: string | null;
  note?: string | null;
  exclude_from_stats?: number | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  cat_name?: string | null;
  cat_color?: string | null;
  [key: string]: string | number | null | undefined;
}

export interface DashboardResponse {
  yearMonth: string;
  income: number;
  expense: number;
  net: number;
  todayExpense: number;
  bankBalance: number;
  stockMarketValue: number;
  dataStatus: {
    generatedAt: number;
    unpricedHoldingCount: number;
  };
  attention: {
    recurringNeedsAttentionCount: number;
    uncategorizedTransactionCount: number;
    uncategorizedAmount: number;
  };
  goalReminders: GoalReminder[];
  preferences: {
    layout: DashboardLayoutPreference;
    updatedAt: number;
  };
  comparison: {
    available: boolean;
    currentTransactionCount: number;
    previousTransactionCount: number;
    window: DashboardComparisonWindow | null;
    current: { income: number; expense: number; net: number };
    previous: { income: number; expense: number; net: number } | null;
    delta: { income: number; expense: number; net: number } | null;
    drivers: DashboardChangeDriver[];
  };
  portfolioHealth: {
    available: boolean;
    unavailableReason: 'noHoldings' | 'missingPrices' | 'mixedCurrencies' | null;
    currency: string | null;
    marketValue: number;
    totalCost: number;
    unrealizedGrossPL: number;
    costReturnRate: number | null;
    pricedHoldingCount: number;
    holdingCount: number;
    largestHolding: {
      name: string;
      symbol: string;
      marketValue: number;
      share: number;
    } | null;
  };
  cashOutlook: ScheduledCashOutlook;
  catBreakdown: DashboardCategoryNode[];
  incomeCatBreakdown: DashboardCategoryNode[];
  recent: RecentTransaction[];
}

interface ParentChildNode {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

interface ParentAggregateNode {
  parentId: string;
  parentName: string;
  parentColor: string;
  total: number;
  children: Map<string, ParentChildNode>;
  otherTotal: number;
}

export function buildCategoryAggregateNodes(rows: DashboardCategoryAggregateRow[]): DashboardCategoryNode[] {
  const parentMap = new Map<string, ParentAggregateNode>();
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    const childCategoryId = r.category_id ? String(r.category_id) : '';
    const childName = r.cat_name || '未分類';
    const childColor = r.cat_color || '#94a3b8';
    const parentId = r.cat_parent_id ? String(r.cat_parent_id) : '';
    const isLeaf = !!parentId;
    const parentKey = isLeaf ? parentId : (childCategoryId || `name:${childName}`);
    const parentName = isLeaf ? (r.cat_parent_name || '未分類') : childName;
    const parentColor = isLeaf ? (r.cat_parent_color || childColor) : childColor;
    if (!parentMap.has(parentKey)) {
      parentMap.set(parentKey, { parentId: parentKey, parentName, parentColor, total: 0, children: new Map(), otherTotal: 0 });
    }
    const p = parentMap.get(parentKey);
    if (!p) continue;
    p.total += amount;
    if (isLeaf) {
      const childKey = childCategoryId || `name:${childName}`;
      if (!p.children.has(childKey)) {
        p.children.set(childKey, { categoryId: childCategoryId, name: childName, color: childColor, total: 0 });
      }
      const child = p.children.get(childKey);
      if (!child) continue;
      child.total += amount;
    } else {
      p.otherTotal += amount;
    }
  }

  const parents = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
  const nodes: DashboardCategoryNode[] = [];
  for (const p of parents) {
    const children = Array.from(p.children.values()).sort((a, b) => b.total - a.total);
    for (const c of children) {
      nodes.push({ categoryId: c.categoryId, name: c.name, color: c.color, parentId: p.parentId, parentName: p.parentName, parentColor: p.parentColor, total: c.total, isOtherGroup: false });
    }
    if (p.otherTotal > 0) {
      nodes.push({ categoryId: null, name: '（其他）', color: p.parentColor, parentId: p.parentId, parentName: p.parentName, parentColor: p.parentColor, total: p.otherTotal, isOtherGroup: true });
    }
  }
  return nodes;
}

export class InvalidDateRangeError extends Error {
  constructor() {
    super('起始日不可晚於結束日');
    this.name = 'InvalidDateRangeError';
  }
}

export interface TransactionsSummaryOptions {
  type?: string;
  from?: string;
  to?: string;
}

export interface TransactionsSummaryResult {
  periodStart: string;
  periodEnd: string;
  catMap: Record<string, { total: number; color: string }>;
  categoryBreakdown: DashboardCategoryNode[];
  dailyMap: Record<string, number>;
  monthlyMap: Record<string, number>;
  total: number;
}

/**
 * 以基準幣別重新表達已彙總的報表結果（issue #255）。
 * 彙總本身仍以 TWD 等值（transactions.amount）計算，換算只在最後一步、
 * 以 decimal.js 全精度對每個已彙總欄位做一次，因此不引入浮點累加誤差。
 * `rateToBase` 語意同 exchange_rates.rate_to_twd：1 單位基準幣別值多少 TWD。
 */
export function convertTransactionsSummaryToBaseCurrency(
  summary: TransactionsSummaryResult,
  rateToBase: Decimal.Value,
  baseCurrency: string,
): TransactionsSummaryResult {
  if (baseCurrency === 'TWD') return summary;
  return convertReportSummaryToBase(summary, rateToBase, baseCurrency);
}

// 抽取自 app/api/reports/route.ts（無行為變更）；userTimezone 未提供時查詢 users.timezone。
export function getTransactionsSummary(
  userId: string,
  options: TransactionsSummaryOptions = {},
  userTimezone?: string
): TransactionsSummaryResult {
  const tz = userTimezone || String(queryOne('SELECT timezone FROM users WHERE id = ?', [userId])?.timezone || '') || 'Asia/Taipei';
  const txType = options.type || 'expense';
  let from = options.from || '';
  let to = options.to || '';

  if (from && to && String(from) > String(to)) {
    throw new InvalidDateRangeError();
  }

  const month = monthInUserTz(tz);
  const today = todayInUserTz(tz);

  if (!from && !to) {
    from = month + '-01';
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0);
    to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  } else if (from && !to) {
    to = today;
  } else if (!from && to) {
    from = String(to).slice(0, 7) + '-01';
  }

  const txs = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color, c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ? AND t.exclude_from_stats = 0
    ORDER BY t.date
  `, [userId, txType, from, to]) as unknown as Array<DashboardCategoryAggregateRow & { date: string }>;

  const catMap: Record<string, { total: number; color: string }> = {};
  txs.forEach(t => {
    const amount = Number(t.amount) || 0;
    const name = t.cat_name || '未分類';
    const color = t.cat_color || '#94a3b8';
    if (!catMap[name]) catMap[name] = { total: 0, color };
    catMap[name].total += amount;
  });

  const categoryBreakdown = buildCategoryAggregateNodes(txs);

  const dailyMap: Record<string, number> = {};
  const monthlyMap: Record<string, number> = {};
  txs.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.amount);
    const mo = t.date.slice(0, 7);
    monthlyMap[mo] = (monthlyMap[mo] || 0) + Number(t.amount);
  });

  return {
    periodStart: from,
    periodEnd: to,
    catMap,
    categoryBreakdown,
    dailyMap,
    monthlyMap,
    total: txs.reduce((s, t) => s + Number(t.amount), 0),
  };
}

export interface StockHoldingSummary {
  stockId: string;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
  marketValue: number;
  unrealizedPL: number;
  priced: boolean;
}

// 抽取自 app/api/dashboard/route.ts 的 getStockPortfolioStatus()（無行為變更：marketValue/
// unpricedHoldingCount/health 三項輸出與抽取前完全一致）；holdings 為本功能新增的持股明細
// （股數/均價/現價/未實現損益/幣別），供 T012 的 list_stock_holdings MCP 工具使用。
export function getStockPortfolioStatus(userId: string): {
  marketValue: number;
  unpricedHoldingCount: number;
  holdings: StockHoldingSummary[];
  health: DashboardResponse['portfolioHealth'];
} {
  const stocks = queryAll(
    'SELECT id, name, symbol, currency, current_price FROM stocks WHERE user_id = ?',
    [userId]
  ) as unknown as Array<{ id: string; name: string | null; symbol: string | null; currency: string | null; current_price: string | number | null }>;

  if (stocks.length === 0) {
    return {
      marketValue: 0,
      unpricedHoldingCount: 0,
      holdings: [],
      health: {
        available: false,
        unavailableReason: 'noHoldings',
        currency: null,
        marketValue: 0,
        totalCost: 0,
        unrealizedGrossPL: 0,
        costReturnRate: null,
        pricedHoldingCount: 0,
        holdingCount: 0,
        largestHolding: null,
      },
    };
  }

  const allTxs = queryAll(
    'SELECT * FROM stock_transactions WHERE user_id = ? ORDER BY date, created_at, id',
    [userId]
  );
  const allDivs = queryAll(
    'SELECT stock_id, stock_dividend_shares FROM stock_dividends WHERE user_id = ?',
    [userId]
  );

  const txsByStock = new Map<string, Array<Record<string, string | number | null>>>();
  for (const tx of allTxs) {
    const sid = String(tx.stock_id);
    let list = txsByStock.get(sid);
    if (!list) {
      list = [];
      txsByStock.set(sid, list);
    }
    list.push(tx);
  }

  const divsByStock = new Map<string, Array<Record<string, string | number | null>>>();
  for (const div of allDivs) {
    const sid = String(div.stock_id);
    let list = divsByStock.get(sid);
    if (!list) {
      list = [];
      divsByStock.set(sid, list);
    }
    list.push(div);
  }

  let unpricedHoldingCount = 0;
  let totalCost = 0;
  const holdings: Array<{ stockId: string; name: string; symbol: string; currency: string; marketValue: number; priced: boolean; shares: number; avgCost: number; currentPrice: number; unrealizedPL: number }> = [];
  const total = stocks.reduce((sum, stock) => {
    const txs = txsByStock.get(stock.id) || [];
    const divs = divsByStock.get(stock.id) || [];
    const fifo = calcFifoLots(txs);
    const dividendSyntheticShares = txs
      .filter(t => t.type === 'buy' && Number(t.price) === 0 && typeof t.note === 'string' && /\[SYNTH\] 股票股利|股票股利配發/.test(t.note as string))
      .reduce((shareSum, t) => shareSum + Number(t.shares || 0), 0);
    const recordedDividendShares = divs.reduce((shareSum, d) => shareSum + Number(d.stock_dividend_shares || 0), 0);
    const missingDividendShares = Math.max(0, recordedDividendShares - dividendSyntheticShares);
    const totalShares = fifo.totalShares.plus(missingDividendShares).toNumber();
    if (totalShares <= 0) return sum;
    const currentPrice = Number(stock.current_price) || 0;
    const contribution = getHoldingMarketContribution(totalShares, currentPrice);
    if (contribution.unpriced) unpricedHoldingCount += 1;
    if (!contribution.unpriced) totalCost += fifo.totalCost.toNumber();
    const avgCost = totalShares > 0 ? fifo.totalCost.div(totalShares).toNumber() : 0;
    holdings.push({
      stockId: stock.id,
      name: stock.name || stock.symbol || '—',
      symbol: stock.symbol || '',
      currency: normalizeCurrency(stock.currency),
      marketValue: contribution.marketValue,
      priced: !contribution.unpriced,
      shares: totalShares,
      avgCost,
      currentPrice,
      unrealizedPL: contribution.unpriced ? 0 : contribution.marketValue - fifo.totalCost.toNumber(),
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
    holdings: holdings.map(h => ({
      stockId: h.stockId,
      symbol: h.symbol,
      name: h.name,
      shares: h.shares,
      avgCost: Math.round(h.avgCost * 100) / 100,
      currentPrice: h.currentPrice,
      currency: h.currency,
      marketValue: Math.round(h.marketValue * 100) / 100,
      unrealizedPL: Math.round(h.unrealizedPL * 100) / 100,
      priced: h.priced,
    })),
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

type TotalRow = { total: string | number | null };
type AccountRow = {
  id: string;
  initial_balance: string | number | null;
  currency: string | null;
};
type AccountTransactionRow = {
  type: string | null;
  amount: string | number | null;
  currency: string | null;
  original_amount: string | number | null;
};
type CountRow = { count: string | number | null };
type SettingsRow = { dashboard_layout: string | null; dashboard_layout_updated_at: string | number | null };
type ComparisonRow = DashboardComparisonCategory & { period: 'current' | 'previous'; transactionCount: string | number | null };
type RecurringForecastRow = {
  id: string;
  type: string;
  amount: string | number | null;
  fx_fee: string | number | null;
  currency: string | null;
  fx_rate: string | number | null;
  frequency: string;
  start_date: string | null;
  last_generated: string | null;
  note: string | null;
  account_id: string | null;
  category_id: string | null;
  needs_attention: string | number | null;
  matched_account_id: string | null;
  matched_category_id: string | null;
};

function totalFromRow(row: Record<string, string | number | null> | null): number {
  return Number((row as TotalRow | null)?.total) || 0;
}

export function getBankStatusAsOf(userId: string, throughDate: string): {
  displayBalanceTwd: number;
  forecastBalanceTwd: number;
  accountIds: Set<string>;
  accountCount: number;
  accountDetails: Map<string, { currency: string; currentRate: number }>;
} {
  const accounts = queryAll(
    `SELECT id, initial_balance, currency
     FROM accounts
     WHERE user_id = ?
       AND COALESCE(exclude_from_total, 0) = 0
       AND (category = 'bank' OR account_type = '銀行')`,
    [userId]
  ) as unknown as AccountRow[];

  const rateMap = getUserExchangeRateMap(userId);
  const getRate = (c: string) => (rateMap && rateMap[c] > 0 ? rateMap[c] : getExchangeRateToTwd(userId, c));
  const displayBalanceTwd = accounts.reduce((sum, account) => {
    const currency = normalizeCurrency(account.currency);
    const balance = calcBalance(account.id, Number(account.initial_balance) || 0, userId, currency, rateMap);
    const rate = getRate(currency);
    return sum + balance * rate;
  }, 0);
  const forecastBalanceTwd = accounts.reduce((sum, account) => {
    const currency = normalizeCurrency(account.currency);
    let balance = Number(account.initial_balance) || 0;
    const transactions = queryAll(
      `SELECT type, amount, currency, original_amount
       FROM transactions
       WHERE account_id = ? AND user_id = ? AND date <= ?`,
      [account.id, userId, throughDate]
    ) as unknown as AccountTransactionRow[];
    for (const transaction of transactions) {
      const transactionCurrency = normalizeCurrency(transaction.currency);
      const value = transactionCurrency === currency
        ? (Number(transaction.original_amount) > 0 ? Number(transaction.original_amount) : Number(transaction.amount) || 0)
        : convertFromTwd(Number(transaction.amount), currency, userId, rateMap);
      if (transaction.type === 'income' || transaction.type === 'transfer_in') balance += value;
      else if (transaction.type === 'expense' || transaction.type === 'transfer_out') balance -= value;
    }
    const rate = getRate(currency);
    return sum + balance * rate;
  }, 0);

  return {
    displayBalanceTwd: Math.round(displayBalanceTwd),
    forecastBalanceTwd: Math.round(forecastBalanceTwd),
    accountIds: new Set(accounts.map(account => account.id)),
    accountCount: accounts.length,
    accountDetails: new Map(accounts.map(account => {
      const currency = normalizeCurrency(account.currency);
      const rate = getRate(currency);
      return [account.id, { currency, currentRate: rate }];
    })),
  };
}

export function computeDashboardPayload({
  userId,
  actorUserId,
  userTimezone,
  yearMonth,
}: {
  userId: string;
  actorUserId: string;
  userTimezone: string;
  yearMonth?: string | null;
}): DashboardResponse {
  const ymRaw = String(yearMonth || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : monthInUserTz(userTimezone);
  const todayS = todayInUserTz(userTimezone);
  const comparisonWindow = getDashboardComparisonWindow(month, todayS);

  const income = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0",
    [userId, month + '%']
  ));
  const expense = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0",
    [userId, month + '%']
  ));
  const todayExpense = totalFromRow(queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0",
    [userId, todayS]
  ));
  const bankStatus = getBankStatusAsOf(userId, todayS);
  const bankBalance = bankStatus.displayBalanceTwd;
  const stockStatus = getStockPortfolioStatus(actorUserId);
  const settings = queryOne(
    'SELECT dashboard_layout, dashboard_layout_updated_at FROM user_settings WHERE user_id = ?',
    [actorUserId]
  ) as SettingsRow | null;
  const recurringForecastRows = queryAll(`
    SELECT r.id, r.type, r.amount, r.fx_fee, r.currency, r.fx_rate, r.frequency, r.start_date, r.last_generated,
           r.note, r.account_id, r.category_id, r.needs_attention,
           a.id AS matched_account_id,
           c.id AS matched_category_id
    FROM recurring r
    LEFT JOIN accounts a ON r.account_id = a.id AND a.user_id = r.user_id
    LEFT JOIN categories c ON r.category_id = c.id AND c.user_id = r.user_id
    WHERE r.user_id = ? AND r.is_active = 1
  `, [userId]) as unknown as RecurringForecastRow[];
  const forecastSchedules: ScheduledCashInput[] = recurringForecastRows.map(row => {
    const account = row.account_id ? bankStatus.accountDetails.get(row.account_id) : null;
    const forecastAmount = account ? getScheduledAccountImpactTwd({
      amountTwd: Number(row.amount) || 0,
      fxFeeTwd: row.type === 'expense' ? Number(row.fx_fee) || 0 : 0,
      recurringCurrency: row.currency || 'TWD',
      storedFxRate: Number(row.fx_rate) || 0,
      accountCurrency: account.currency,
      currentAccountRate: account.currentRate,
    }) : null;
    const validReference = (!row.account_id || !!row.matched_account_id)
      && (!row.category_id || !!row.matched_category_id);
    const hasValidAnchor = row.last_generated
      ? isValidIsoDate(row.last_generated)
      : isValidIsoDate(row.start_date || '');
    const included = !row.needs_attention
      && validReference
      && !!row.account_id
      && bankStatus.accountIds.has(row.account_id)
      && (row.type === 'income' || row.type === 'expense')
      && ['daily', 'weekly', 'monthly', 'yearly'].includes(row.frequency)
      && hasValidAnchor
      && forecastAmount !== null;
    return {
      id: row.id,
      type: row.type === 'income' ? 'income' : 'expense',
      amount: forecastAmount || 0,
      frequency: row.frequency,
      startDate: row.start_date || '',
      lastGenerated: row.last_generated,
      note: row.note || '',
      included,
    };
  });
  const cashOutlook = buildScheduledCashOutlook({
    today: todayS,
    windowDays: 30,
    startingBalance: bankStatus.forecastBalanceTwd,
    bankAccountCount: bankStatus.accountCount,
    schedules: forecastSchedules,
  });

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
      userId,
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
    [userId]
  ) as CountRow | null)?.count) || 0;
  const goalReminders = listGoalReminders(userId, todayS, 3);
  const uncategorized = queryOne(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = ?
       AND type IN ('income', 'expense')
       AND date LIKE ?
       AND exclude_from_stats = 0
       AND (category_id IS NULL OR category_id = '')`,
    [userId, month + '%']
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
  `, [userId, month + '%']) as unknown as DashboardCategoryAggregateRow[];
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
  `, [userId, month + '%']) as unknown as DashboardCategoryAggregateRow[];
  const incomeCatBreakdown = buildCategoryAggregateNodes(incomeCatRows);

  const recent = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0 AND t.date LIKE ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `, [userId, month + '%']) as RecentTransaction[];

  return {
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
    goalReminders,
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
    cashOutlook,
    catBreakdown,
    incomeCatBreakdown,
    recent,
  };
}

export async function getDashboardData(month?: string): Promise<DashboardResponse> {
  const { requireAuth, verifyToken } = await import('@/lib/auth');
  const session = await requireAuth();
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const actorId = String((verifyToken(session) as { userId: string }).userId);

  const user = queryOne('SELECT timezone FROM users WHERE id = ?', [actorId]);
  const userTimezone = String(user?.timezone || 'Asia/Taipei');

  const selectedLedger = cookieStore.get('activeLedgerId')?.value || '';
  let userId = actorId;
  let ledgerTimezone = userTimezone;

  if (selectedLedger) {
    const ledger = queryOne(
      `SELECT l.data_owner_id, l.is_shared, l.timezone
       FROM financial_ledgers l
       JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
       WHERE l.id = ?`,
      [actorId, selectedLedger]
    ) as { data_owner_id?: string; is_shared?: number; timezone?: string } | null;
    if (ledger) {
      userId = String(ledger.data_owner_id || actorId);
      if (Number(ledger.is_shared) === 1 && ledger.timezone) {
        ledgerTimezone = String(ledger.timezone);
      }
    }
  }

  try {
    const { processDueRecurringOncePerDay } = await import('@/lib/apiHelpers');
    processDueRecurringOncePerDay(userId, ledgerTimezone);
  } catch {
    // Non-fatal if apiHelpers recurring fails
  }

  const validYm = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
  return computeDashboardPayload({
    userId,
    actorUserId: actorId,
    userTimezone: ledgerTimezone,
    yearMonth: validYm,
  });
}
