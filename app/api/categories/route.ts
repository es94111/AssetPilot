import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { uid } from '../../../lib/userDefaults';

type CategoryType = 'income' | 'expense';

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

interface CreateCategoryRequest {
  name?: string;
  type?: string;
  color?: string;
  parentId?: string | null;
}

function isValidColor(c: unknown): c is string { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = asRows<CategoryRow>(queryAll(
    'SELECT id, user_id, name, type, color, is_default, sort_order, parent_id FROM categories WHERE user_id = ? ORDER BY sort_order',
    [auth.userId]
  ));
  return NextResponse.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    color: r.color,
    isDefault: !!r.is_default,
    sortOrder: r.sort_order,
    parentId: r.parent_id || '',
  })));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreateCategoryRequest;
  const { name, type, color, parentId } = body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '分類名稱不可為空' }, { status: 400 });
  }
  if (type !== 'income' && type !== 'expense') {
    return NextResponse.json({ error: '分類類型不正確' }, { status: 400 });
  }
  if (!isValidColor(color)) {
    return NextResponse.json({ error: '顏色格式不正確' }, { status: 400 });
  }

  const pId = parentId || '';
  if (pId) {
    const parent = asRow<CategoryRow>(queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [pId, auth.userId]));
    if (!parent) return NextResponse.json({ error: '父分類不存在' }, { status: 400 });
    if (parent.parent_id !== '' && parent.parent_id !== null) {
      return NextResponse.json({ error: '不可在子分類底下再新增子分類' }, { status: 400 });
    }
    if (parent.type !== type) {
      return NextResponse.json({ error: '子分類類型必須與父分類相同' }, { status: 400 });
    }
    const dup = queryOne('SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ?', [auth.userId, pId, name]);
    if (dup) return NextResponse.json({ error: '同父分類下名稱不可重複' }, { status: 400 });
  } else {
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL)",
      [auth.userId, type, name]
    );
    if (dup) return NextResponse.json({ error: '同類型下父分類名稱不可重複' }, { status: 400 });
  }

  const id = uid();
  const maxOrder = Number(asRow<{ m: number }>(queryOne('SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?', [auth.userId]))?.m) || 0;
  getDB().run(
    'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
    [id, auth.userId, name, type, color, maxOrder + 1, pId]
  );
  saveDB();
  return NextResponse.json({ id });
}
