// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { deleteUserCompletely } from '../../../../../lib/userDeletion';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';

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
  // 管理員層級：未指定時預設超級管理員；'readonly' 為一般（唯讀）管理員。非管理員存空字串。
  const nextAdminRole = nextIsAdmin
    ? (String(body?.adminRole || '').toLowerCase() === 'readonly' ? 'readonly' : 'super')
    : 'super';

  const user = queryOne('SELECT id, email, is_admin, admin_role FROM users WHERE id = ?', [id]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
  const oldRole = !user.is_admin ? 'user' : (String(user.admin_role || 'super').toLowerCase() === 'readonly' ? 'readonly' : 'super');

  // 撤銷最後一位管理員會讓系統失去管理者，比照 DELETE 的保護。
  if (user.is_admin && !nextIsAdmin) {
    const adminCount = queryOne('SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1')?.cnt || 0;
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'last_admin_protected' }, { status: 400 });
    }
  }

  // 將最後一位「超級管理員」降為一般管理員，會使系統再也無人能執行變更操作，需阻擋。
  if (user.is_admin && (!nextIsAdmin || nextAdminRole === 'readonly')) {
    const superCount = queryOne(
      "SELECT COUNT(*) AS cnt FROM users WHERE is_admin = 1 AND COALESCE(LOWER(admin_role), 'super') <> 'readonly'"
    )?.cnt || 0;
    const targetWasSuper = queryOne(
      "SELECT COUNT(*) AS cnt FROM users WHERE id = ? AND is_admin = 1 AND COALESCE(LOWER(admin_role), 'super') <> 'readonly'",
      [id]
    )?.cnt || 0;
    if (targetWasSuper && superCount <= 1) {
      return NextResponse.json({ error: 'last_super_admin_protected' }, { status: 400 });
    }
  }

  const db = getDB();
  db.run('UPDATE users SET is_admin = ?, admin_role = ? WHERE id = ?', [nextIsAdmin ? 1 : 0, nextAdminRole, id]);
  saveDB();

  const newRole = nextIsAdmin ? nextAdminRole : 'user';
  // 敏感操作：變更使用者權限／角色（提升或降級管理員）。詳記舊→新角色。
  auditSensitiveAction(request, auth, {
    action: 'admin.user.role_change',
    metadata: {
      target_user_id: id,
      target_email: user.email || '',
      was_admin: !!user.is_admin,
      is_admin: nextIsAdmin,
      old_role: oldRole,
      new_role: newRole,
      self: auth.userId === id,
    },
  });

  const updated = queryOne(
    'SELECT id, email, display_name, created_at, google_id, line_id, has_password, is_admin, admin_role FROM users WHERE id = ?',
    [id]
  );
  const updatedIsSuper = !!updated.is_admin && String(updated.admin_role || 'super').toLowerCase() !== 'readonly';
  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.display_name,
    createdAt: updated.created_at,
    googleId: updated.google_id || '',
    lineId: updated.line_id || '',
    hasPassword: !!updated.has_password,
    isAdmin: !!updated.is_admin,
    adminRole: updated.is_admin ? (updatedIsSuper ? 'super' : 'readonly') : '',
    isSuperAdmin: updatedIsSuper,
  });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = queryOne('SELECT id, email, is_admin, admin_role FROM users WHERE id = ?', [id]);
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

  // 敏感操作：刪除帳號（含其所有資料）。
  auditSensitiveAction(request, auth, {
    action: 'admin.user.delete',
    metadata: {
      target_user_id: id,
      target_email: user.email || '',
      was_admin: !!user.is_admin,
    },
  });

  return NextResponse.json({ ok: true });
}
