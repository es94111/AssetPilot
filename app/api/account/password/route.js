import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, setAuthCookie } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { signToken } from '../../../../lib/auth';

function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') return '密碼為必填';
  if (password.length < 8) return '密碼長度至少 8 字元';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    return '密碼需包含大寫字母、小寫字母、數字與特殊符號';
  }
  return null;
}

export async function PUT(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');

  const pwdError = validateStrongPassword(newPassword);
  if (pwdError) return NextResponse.json({ error: pwdError }, { status: 400 });

  const user = queryOne('SELECT id, password_hash, has_password FROM users WHERE id = ?', [auth.userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  if (user.has_password) {
    if (!currentPassword) return NextResponse.json({ error: '請輸入目前密碼' }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return NextResponse.json({ error: '目前密碼錯誤' }, { status: 401 });
    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsOld) return NextResponse.json({ error: '新密碼不可與目前密碼相同' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  getDB().run('UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [passwordHash, auth.userId]);
  saveDB();

  const updatedUser = queryOne('SELECT token_version FROM users WHERE id = ?', [auth.userId]);
  const newToken = signToken(auth.userId, Number(updatedUser.token_version) || 0);
  const res = NextResponse.json({ success: true });
  setAuthCookie(res, newToken);
  return res;
}
