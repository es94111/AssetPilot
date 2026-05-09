import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';

type CategoryType = 'income' | 'expense';
type RouteContext = { params: Promise<{ id: string }> };

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType | string;
  color: string;
  is_default: number | null;
  sort_order: number;
  parent_id: string | null;
}

interface UpdateCategoryRequest {
  name?: string;
  type?: string;
  color?: string;
  parentId?: string | null;
}

function isValidColor(c: unknown): c is string {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    isDefault: !!row.is_default,
    sortOrder: row.sort_order,
    parentId: row.parent_id || '',
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = asRow<CategoryRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]));
  if (!row) {
    return NextResponse.json({ error: '分類不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  return NextResponse.json(serializeCategory(row));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = asRow<CategoryRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]));
  if (!existing) {
    return NextResponse.json({ error: '分類不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as UpdateCategoryRequest;
  const name = String(body.name || '').trim();
  const type = body.type;
  const color = body.color;
  const parentId = body.parentId || '';

  if (!name) {
    return NextResponse.json({ error: '分類名稱不可為空' }, { status: 400 });
  }
  if (type !== 'income' && type !== 'expense') {
    return NextResponse.json({ error: '分類類型不正確' }, { status: 400 });
  }
  if (!isValidColor(color)) {
    return NextResponse.json({ error: '顏色格式不正確' }, { status: 400 });
  }
  if (id === parentId) {
    return NextResponse.json({ error: '分類不可設為自己的父分類' }, { status: 400 });
  }

  if (parentId) {
    const parent = asRow<CategoryRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [parentId, auth.userId]));
    if (!parent) return NextResponse.json({ error: '父分類不存在' }, { status: 400 });
    if (parent.parent_id !== '' && parent.parent_id !== null) {
      return NextResponse.json({ error: '不可在子分類底下再新增子分類' }, { status: 400 });
    }
    if (parent.type !== type) {
      return NextResponse.json({ error: '子分類類型必須與父分類相同' }, { status: 400 });
    }
    const dup = queryOne(
      'SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ? AND id != ?',
      [auth.userId, parentId, name, id]
    );
    if (dup) return NextResponse.json({ error: '同父分類下名稱不可重複' }, { status: 400 });
  } else {
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL) AND id != ?",
      [auth.userId, type, name, id]
    );
    if (dup) return NextResponse.json({ error: '同類型下父分類名稱不可重複' }, { status: 400 });
  }

  getDB().run(
    'UPDATE categories SET name = ?, type = ?, color = ?, parent_id = ? WHERE id = ? AND user_id = ?',
    [name, type, color, parentId, id, auth.userId]
  );
  saveDB();

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = asRow<CategoryRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]));
  if (!existing) {
    return NextResponse.json({ error: '分類不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  const ownTx = queryOne('SELECT id FROM transactions WHERE user_id = ? AND category_id = ? LIMIT 1', [auth.userId, id]);
  if (ownTx) {
    return NextResponse.json({ error: '此子分類已有交易紀錄，不可刪除' }, { status: 400 });
  }

  const childRows = asRows<{ id: string }>(queryAll('SELECT id FROM categories WHERE user_id = ? AND parent_id = ?', [auth.userId, id]));
  const childIds = childRows.map(row => row.id);

  if (childIds.length > 0) {
    const placeholders = childIds.map(() => '?').join(', ');
    const childTx = queryOne(
      `SELECT category_id FROM transactions WHERE user_id = ? AND category_id IN (${placeholders}) LIMIT 1`,
      [auth.userId, ...childIds]
    );
    if (childTx) {
      return NextResponse.json({ error: '子分類已有交易紀錄，父分類不可刪除' }, { status: 400 });
    }
  }

  const idsToDelete = [id, ...childIds];
  const db = getDB();
  db.run('BEGIN');
  try {
    for (const categoryId of idsToDelete) {
      db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    }
    db.run('COMMIT');
  } catch {
    try { db.run('ROLLBACK'); } catch { /* noop */ }
    return NextResponse.json({ error: '刪除分類失敗' }, { status: 500 });
  }
  saveDB();

  return NextResponse.json({ ok: true, deletedIds: idsToDelete });
}
