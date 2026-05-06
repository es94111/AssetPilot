import logger from '@/lib/logger';
import { requireAuth } from '@/lib/auth';

interface CategoryNode {
  categoryId: string | null;
  name: string;
  color: string;
  parentId: string;
  parentName: string;
  parentColor: string;
  total: number;
  isOtherGroup: boolean;
}

export function buildCategoryAggregateNodes(rows: any[]): CategoryNode[] {
  const parentMap = new Map<string, any>();
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    const childCategoryId = r.category_id || '';
    const childName = r.cat_name || '未分類';
    const childColor = r.cat_color || '#94a3b8';
    const parentId = r.cat_parent_id || '';
    const isLeaf = !!parentId;
    const parentKey = isLeaf ? parentId : (childCategoryId || `name:${childName}`);
    const parentName = isLeaf ? (r.cat_parent_name || '未分類') : childName;
    const parentColor = isLeaf ? (r.cat_parent_color || childColor) : childColor;
    if (!parentMap.has(parentKey)) {
      parentMap.set(parentKey, { parentId: parentKey, parentName, parentColor, total: 0, children: new Map(), otherTotal: 0 });
    }
    const p = parentMap.get(parentKey);
    p.total += amount;
    if (isLeaf) {
      const childKey = childCategoryId || `name:${childName}`;
      if (!p.children.has(childKey)) {
        p.children.set(childKey, { categoryId: childCategoryId, name: childName, color: childColor, total: 0 });
      }
      p.children.get(childKey).total += amount;
    } else {
      p.otherTotal += amount;
    }
  }

  const parents = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
  const nodes: CategoryNode[] = [];
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

export async function getDashboardData(month?: string) {
  const session = await requireAuth();
  
  const url = month 
    ? `http://localhost:3000/api/dashboard?yearMonth=${month}`
    : 'http://localhost:3000/api/dashboard';

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

  return res.json();
}
