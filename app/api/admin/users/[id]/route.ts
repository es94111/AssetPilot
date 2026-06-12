// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { deleteUserCompletely } from '../../../../../lib/userDeletion';

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (typeof body?.isAdmin !== 'boolean') {
    return NextResponse.json({ error: '缺少 isAdmin（需為布林值）' }, { status: 400 });
  }
  const nextIsAdmin = body.isAdmin;

  const user = queryOne('SELECT id, is_admin FROM users WHERE id = ?', [id]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  // 撤銷最後一位管理員會讓系統失去管理者，比照 DELETE 的保護。
  if (user.is_admin && !nextIsAdmin) {
    const adminCount = queryOne('SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1')?.cnt || 0;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'last_admin_protected' }, { status: 400 });
    }
  }

  const db = getDB();
  db.run('UPDATE users SET is_admin = ? WHERE id = ?', [nextIsAdmin ? 1 : 0, id]);
  saveDB();

  const updated = queryOne(
    'SELECT id, email, display_name, created_at, google_id, line_id, has_password, is_admin FROM users WHERE id = ?',
    [id]
  );
  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.display_name,
    createdAt: updated.created_at,
    googleId: updated.google_id || '',
    lineId: updated.line_id || '',
    hasPassword: !!updated.has_password,
    isAdmin: !!updated.is_admin,
  });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = queryOne('SELECT id, is_admin FROM users WHERE id = ?', [id]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  if (user.is_admin) {
    const adminCount = queryOne('SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1')?.cnt || 0;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'last_admin_protected' }, { status: 400 });
    }
  }

  // 完整刪除：所有 user_id 關聯資料表 + 交易憑證照片實體檔案（本機/S3）+ 全域引用。
  // 與自助刪除帳號共用同一流程，避免漏表。
  await deleteUserCompletely(id);
  saveDB();

  return NextResponse.json({ ok: true });
}
