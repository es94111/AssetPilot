import logger from '@/lib/logger';
import type { DashboardLayoutPreference } from '@/lib/dashboardPreferences';
import { getHoldingMarketContribution, type DashboardChangeDriver, type DashboardComparisonWindow } from '@/lib/dashboardInsights';
import type { ScheduledCashOutlook } from '@/lib/dashboardForecast';
import { queryAll, queryOne } from '@/lib/db';
import { calcFifoLots } from '@/lib/moneyDecimal';
import { normalizeCurrency } from '@/lib/accountHelpers';
import { monthInUserTz, todayInUserTz } from '@/lib/userTime';

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

  let unpricedHoldingCount = 0;
  let totalCost = 0;
  const holdings: Array<{ stockId: string; name: string; symbol: string; currency: string; marketValue: number; priced: boolean; shares: number; avgCost: number; currentPrice: number; unrealizedPL: number }> = [];
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

export async function getDashboardData(month?: string): Promise<DashboardResponse> {
  // 動態載入：@/lib/auth 依賴 next/headers/next/navigation（僅 Next.js runtime 可用），
  // 延後載入使本檔其餘可重用的純函式（如 getTransactionsSummary/getStockPortfolioStatus）
  // 能在 Node 原生測試環境中被獨立匯入與測試。
  const { requireAuth } = await import('@/lib/auth');
  const session = await requireAuth();
  
  const port = process.env.PORT || 3000;
  const url = month
    ? `http://localhost:${port}/api/dashboard?yearMonth=${month}`
    : `http://localhost:${port}/api/dashboard`;

  logger.info({ url }, 'Fetching dashboard data');

  const res = await fetch(url, {
    headers: {
      Cookie: `authToken=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'Failed to fetch dashboard data');
    throw new Error('Failed to fetch dashboard data');
  }

  return res.json() as Promise<DashboardResponse>;
}
