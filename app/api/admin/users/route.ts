// @ts-nocheck
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../lib/db';
import { isValidEmail, uid } from '../../../../lib/loginHelpers';
import { createDefaultsForUser } from '../../../../lib/userDefaults';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';

function validateStrongPassword(password) {
  const p = String(password || '');
  if (p.length < 8) return '密碼長度至少 8 個字元';
  if (!/[A-Z]/.test(p)) return '密碼必須包含至少一個大寫字母';
  if (!/[a-z]/.test(p)) return '密碼必須包含至少一個小寫字母';
  if (!/[0-9]/.test(p)) return '密碼必須包含至少一個數字';
  if (!/[^A-Za-z0-9]/.test(p)) return '密碼必須包含至少一個特殊字元';
  return null;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll(
    'SELECT id, email, display_name, created_at, google_id, line_id, has_password, is_admin, admin_role FROM users ORDER BY created_at DESC, email ASC'
  );
  const users = rows.map(r => {
    const isSuperAdmin = !!r.is_admin && String(r.admin_role || 'super').toLowerCase() !== 'readonly';
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      createdAt: r.created_at,
      googleId: r.google_id || '',
      lineId: r.line_id || '',
      hasPassword: !!r.has_password,
      isAdmin: !!r.is_admin,
      // adminRole 僅在 is_admin 時有意義：'super' | 'readonly'。
      adminRole: r.is_admin ? (isSuperAdmin ? 'super' : 'readonly') : '',
      isSuperAdmin,
    };
  });
  return NextResponse.json(users);
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const displayName = String(body?.displayName || '').trim();
  const isAdmin = !!body?.isAdmin;
  // 管理員層級：預設超級管理員；指定 'readonly' 即為一般（唯讀）管理員。非管理員忽略此值。
  const adminRole = isAdmin && String(body?.adminRole || '').toLowerCase() === 'readonly' ? 'readonly' : 'super';

  if (!email) return NextResponse.json({ error: '缺少 email' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  if (!password) return NextResponse.json({ error: '缺少密碼' }, { status: 400 });

  const pwError = validateStrongPassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  if (!displayName) return NextResponse.json({ error: '缺少顯示名稱' }, { status: 400 });

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return NextResponse.json({ error: '此 Email 已被使用' }, { status: 409 });

  const id = uid();
  const passwordHash = await bcrypt.hash(password, 12);
  const createdAt = new Date().toISOString();

  const db = getDB();
  db.run(
    'INSERT INTO users (id, email, password_hash, display_name, created_at, is_admin, admin_role, has_password, token_version) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)',
    [id, email, passwordHash, displayName, createdAt, isAdmin ? 1 : 0, adminRole]
  );

  try {
    createDefaultsForUser(id);
  } catch (e) {
    console.error('createDefaultsForUser failed', e);
  }

  saveDB();

  // 敏感操作：建立帳號（尤以建立管理員帳號需詳細留痕）。
  auditSensitiveAction(request, auth, {
    action: 'admin.user.create',
    metadata: {
      target_user_id: id,
      target_email: email,
      is_admin: isAdmin,
      new_role: isAdmin ? adminRole : 'user',
    },
  });

  return NextResponse.json({
    id,
    email,
    displayName,
    createdAt,
    isAdmin,
    adminRole: isAdmin ? adminRole : '',
    isSuperAdmin: isAdmin && adminRole !== 'readonly',
    hasPassword: true,
  }, { status: 201 });
}
