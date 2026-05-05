import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

function validateStrongPassword(pwd) {
  if (!pwd || pwd.length < 8) return '密碼至少需要 8 個字元';
  if (!/[A-Z]/.test(pwd)) return '密碼必須包含至少一個大寫英文字母';
  if (!/[a-z]/.test(pwd)) return '密碼必須包含至少一個小寫英文字母';
  if (!/[0-9]/.test(pwd)) return '密碼必須包含至少一個數字';
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

  const hash = await bcrypt.hash(newPassword, 12);
  getDB().run(
    'UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
    [hash, auth.userId]
  );
  saveDB();

  return NextResponse.json({ ok: true });
}
