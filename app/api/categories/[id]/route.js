import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { categoryDefaultKey } from '../../../../lib/userDefaults';

function isValidColor(c) { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }

// PUT — edit name/color only
export async function PUT(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, color, type } = body || {};

  const cat = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!cat) return NextResponse.json({ error: '分類不存在' }, { status: 404 });
  if (type !== undefined && type !== null && type !== cat.type) {
    return NextResponse.json({ error: '分類類型不可變更' }, { status: 400 });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '分類名稱不可為空' }, { status: 400 });
  }
  if (!isValidColor(color)) {
    return NextResponse.json({ error: '顏色格式不正確' }, { status: 400 });
  }

  const pId = cat.parent_id || '';
  if (pId === '') {
    const dup = queryOne(
      "SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL) AND id != ?",
      [auth.userId, cat.type, name, id]
    );
    if (dup) return NextResponse.json({ error: '同類型下父分類名稱不可重複' }, { status: 400 });
  } else {
    const dup = queryOne(
      'SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ? AND id != ?',
      [auth.userId, pId, name, id]
    );
    if (dup) return NextResponse.json({ error: '同父分類下名稱不可重複' }, { status: 400 });
  }

  getDB().run('UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?', [name, color, id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}

// PATCH — move child category to another parent
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { parentId: newParentId } = body || {};

  if (!newParentId || typeof newParentId !== 'string') {
    return NextResponse.json({ error: '請指定新的父分類 ID' }, { status: 400 });
  }

  const cat = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!cat) return NextResponse.json({ error: '分類不存在' }, { status: 404 });
  if (!cat.parent_id) return NextResponse.json({ error: '父分類不可移動到其他父分類底下' }, { status: 400 });
  if (newParentId === id) return NextResponse.json({ error: '不可將分類移到自身底下' }, { status: 400 });

  const newParent = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [newParentId, auth.userId]);
  if (!newParent) return NextResponse.json({ error: '新的父分類不存在' }, { status: 400 });
  if (newParent.parent_id !== '' && newParent.parent_id !== null) {
    return NextResponse.json({ error: '目標必須為父分類' }, { status: 400 });
  }
  if (newParent.type !== cat.type) {
    return NextResponse.json({ error: '子分類類型必須與新父分類相同' }, { status: 400 });
  }

  const dup = queryOne(
    'SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ? AND id != ?',
    [auth.userId, newParentId, cat.name, id]
  );
  if (dup) return NextResponse.json({ error: '新父分類底下已有同名子分類' }, { status: 400 });

  const newOrder = (queryOne(
    'SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ? AND parent_id = ?',
    [auth.userId, newParentId]
  )?.m || 0) + 1;

  getDB().run(
    'UPDATE categories SET parent_id = ?, sort_order = ? WHERE id = ? AND user_id = ?',
    [newParentId, newOrder, id, auth.userId]
  );
  saveDB();
  return NextResponse.json({ ok: true });
}

// DELETE — delete category and its children
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const cat = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!cat) return NextResponse.json({ error: '分類不存在' }, { status: 404 });

  const hasTx = queryOne('SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1', [id, auth.userId]);
  if (hasTx) return NextResponse.json({ error: '此分類下有交易記錄，請先移轉至其他分類' }, { status: 400 });

  const isParent = !cat.parent_id;
  const now = Date.now();
  let childRows = [];
  if (isParent) {
    childRows = queryAll('SELECT id, name, is_default FROM categories WHERE parent_id = ? AND user_id = ?', [id, auth.userId]);
    for (const c of childRows) {
      const childTx = queryOne('SELECT id FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1', [c.id, auth.userId]);
      if (childTx) return NextResponse.json({ error: '此分類的子分類下有交易記錄，請先移轉至其他分類' }, { status: 400 });
    }
  }

  const db = getDB();
  db.run('BEGIN');
  try {
    if (isParent) {
      for (const c of childRows) {
        if (c.is_default) {
          const key = categoryDefaultKey(cat.type, cat.name, c.name);
          db.run('INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)', [auth.userId, key, now]);
        }
      }
      db.run('DELETE FROM categories WHERE parent_id = ? AND user_id = ?', [id, auth.userId]);
      if (cat.is_default) {
        const key = categoryDefaultKey(cat.type, null, cat.name);
        db.run('INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)', [auth.userId, key, now]);
      }
      db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]);
    } else {
      if (cat.is_default) {
        const parent = queryOne('SELECT name FROM categories WHERE id = ? AND user_id = ?', [cat.parent_id, auth.userId]);
        if (parent) {
          const key = categoryDefaultKey(cat.type, parent.name, cat.name);
          db.run('INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, ?)', [auth.userId, key, now]);
        }
      }
      db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, auth.userId]);
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) {}
    console.error('[categories/delete]', err);
    return NextResponse.json({ error: '刪除分類失敗' }, { status: 500 });
  }
  saveDB();
  return NextResponse.json({ ok: true });
}
