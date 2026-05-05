import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../../lib/auth';
import { getDB, saveDB } from '../../../../lib/db';
import {
  normalizeEmail,
  isValidEmail,
  getUserCount,
  canSelfRegister,
} from '../../../../lib/loginHelpers';
import { uid, todayStr, createDefaultsForUser } from '../../../../lib/userDefaults';
import { setAuthCookie } from '../../../../lib/apiHelpers';

function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') return '密碼為必填';
  if (password.length < 8) return '密碼長度至少 8 字元';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    return '密碼需包含大寫字母、小寫字母、數字與特殊符號';
  }
  return null;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '');
  const password = String(body.password || '');
  const displayName = String(body.displayName || '');

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: '電子郵件格式不正確' }, { status: 400 });
  }
  const pwdError = validateStrongPassword(password);
  if (pwdError) {
    return NextResponse.json({ error: pwdError }, { status: 400 });
  }

  const emailLower = normalizeEmail(email);
  const registerCheck = canSelfRegister(emailLower);
  if (!registerCheck.ok) {
    return NextResponse.json({ error: registerCheck.error }, { status: 403 });
  }

  const { queryOne } = await import('../../../../lib/db.js');
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [emailLower]);
  if (existing) {
    return NextResponse.json({ error: '此電子郵件已被註冊' }, { status: 400 });
  }

  const id = uid();
  const firstUser = getUserCount() === 0;
  const isAdmin = firstUser ? 1 : 0;
  const passwordHash = await bcrypt.hash(password, 10);

  const db = getDB();
  db.run(
    'INSERT INTO users (id, email, password_hash, display_name, has_password, is_admin, created_at) VALUES (?,?,?,?,1,?,?)',
    [id, emailLower, passwordHash, displayName, isAdmin, todayStr()]
  );

  createDefaultsForUser(id);
  saveDB();

  const token = signToken(id, 0);
  const response = NextResponse.json({
    user: { id, email: emailLower, displayName, themeMode: 'system', isAdmin: !!isAdmin }
  });
  return setAuthCookie(response, token);
}
