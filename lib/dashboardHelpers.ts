import logger from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import type { DashboardLayoutPreference } from '@/lib/dashboardPreferences';
import type { DashboardChangeDriver, DashboardComparisonWindow } from '@/lib/dashboardInsights';

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

export async function getDashboardData(month?: string): Promise<DashboardResponse> {
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
