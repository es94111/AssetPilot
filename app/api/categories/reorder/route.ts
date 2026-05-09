import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';

type CategoryType = 'income' | 'expense';

interface ReorderCategoryItem {
  id: string;
  sortOrder: number;
}

interface ReorderCategoriesRequest {
  scope?: string;
  items?: ReorderCategoryItem[];
}

interface CategoryScopeRow {
  id: string;
  type: CategoryType | string;
  parent_id: string | null;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as ReorderCategoriesRequest;
  const { scope, items } = body || {};

  if (typeof scope !== 'string' || !/^(parents:(expense|income)|children:.+)$/.test(scope)) {
    return NextResponse.json({ error: 'scope 不合法' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items 不可為空' }, { status: 400 });
  }

  const ids = items.map(it => String(it && it.id || ''));
  if (ids.some(id => !id)) return NextResponse.json({ error: 'item.id 不可為空' }, { status: 400 });

  const placeholders = ids.map(() => '?').join(',');
  const rows = asRows<CategoryScopeRow>(queryAll(
    `SELECT id, type, parent_id FROM categories WHERE user_id = ? AND id IN (${placeholders})`,
    [auth.userId, ...ids]
  ));
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: '部分分類不存在或無權限' }, { status: 400 });
  }

  let expectedParentId: string;
  let expectedType: string;
  if (scope.startsWith('parents:')) {
    expectedParentId = '';
    expectedType = scope === 'parents:expense' ? 'expense' : 'income';
  } else {
    expectedParentId = scope.slice('children:'.length);
    const parentRow = asRow<CategoryScopeRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [expectedParentId, auth.userId]));
    if (!parentRow) return NextResponse.json({ error: '父分類不存在' }, { status: 400 });
    if (parentRow.parent_id !== '' && parentRow.parent_id !== null) {
      return NextResponse.json({ error: 'scope 對應的父分類不合法' }, { status: 400 });
    }
    expectedType = parentRow.type;
  }

  for (const r of rows) {
    if ((r.parent_id || '') !== expectedParentId) {
      return NextResponse.json({ error: '所有分類必須屬於同一 scope（不可跨層）' }, { status: 400 });
    }
    if (r.type !== expectedType) {
      return NextResponse.json({ error: '所有分類必須屬於同一 type' }, { status: 400 });
    }
  }

  const db = getDB();
  db.run('BEGIN');
  try {
    for (const it of items) {
      db.run(
        'UPDATE categories SET sort_order = ? WHERE id = ? AND user_id = ?',
        [Number(it.sortOrder) || 0, String(it.id), auth.userId]
      );
    }
    db.run('COMMIT');
  } catch {
    try { db.run('ROLLBACK'); } catch { /* noop */ }
    return NextResponse.json({ error: '重排失敗' }, { status: 500 });
  }
  saveDB();
  return NextResponse.json({ ok: true, updated: items.length });
}
