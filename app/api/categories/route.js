import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { uid } from '../../../lib/userDefaults';

function isValidColor(c) { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll(
    'SELECT id, user_id, name, type, color, is_default, sort_order, parent_id FROM categories WHERE user_id = ? ORDER BY sort_order',
    [auth.userId]
  );
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

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
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
    const parent = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [pId, auth.userId]);
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
  const maxOrder = queryOne('SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?', [auth.userId])?.m || 0;
  getDB().run(
    'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
    [id, auth.userId, name, type, color, maxOrder + 1, pId]
  );
  saveDB();
  return NextResponse.json({ id });
}
