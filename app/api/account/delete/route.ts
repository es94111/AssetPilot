import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAuth, clearAuthCookie } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

function normalizeEmail(email: string | number | null | undefined) {
  return String(email || '').trim().toLowerCase();
}

function createHashedEmail(email: string | number | null | undefined) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

function deleteUserData(userId: string) {
  const db = getDB();
  const user = queryOne('SELECT email FROM users WHERE id = ?', [userId]);
  const hashedEmail = user ? createHashedEmail(user.email || '') : '';
  const businessTables = [
    'stock_dividends', 'stock_transactions', 'stock_recurring', 'stocks',
    'transactions', 'budgets', 'recurring', 'accounts', 'categories',
    'exchange_rates', 'exchange_rate_settings', 'stock_settings',
    'passkey_credentials',
  ];
  try { db.run('BEGIN'); } catch (_) {}
  businessTables.forEach((t) => {
    try { db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]); } catch (_) {}
  });
  db.run('DELETE FROM login_audit_logs WHERE user_id = ?', [userId]);
  db.run("UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0", [hashedEmail, userId]);
  db.run('DELETE FROM login_attempt_logs WHERE user_id = ? AND is_success = 1', [userId]);
  db.run('DELETE FROM users WHERE id = ?', [userId]);
  try { db.run('COMMIT'); } catch (_) {}
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { password, confirmEmail } = body;

  const user = queryOne('SELECT * FROM users WHERE id = ?', [auth.userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  if (user.is_admin) {
    const adminCount = Number(queryOne('SELECT COUNT(1) AS count FROM users WHERE is_admin = 1')?.count || 0);
    if (adminCount <= 1) {
      return NextResponse.json({ error: '系統至少需保留一位管理員，請先指定其他管理員' }, { status: 400 });
    }
  }

  if (user.has_password) {
    // Accounts with a local password: re-confirm by password.
    if (!password) return NextResponse.json({ error: '請輸入密碼以確認刪除' }, { status: 400 });
    const valid = await bcrypt.compare(String(password), String(user.password_hash || ''));
    if (!valid) return NextResponse.json({ error: '密碼錯誤，請重新輸入' }, { status: 400 });
  } else {
    // OAuth-only accounts (Google / LINE) have no local password; the caller is
    // already authenticated via session, so re-confirm intent by typing the
    // account's own email address.
    if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
      return NextResponse.json({ error: '請輸入正確的帳號電子信箱以確認刪除' }, { status: 400 });
    }
  }

  deleteUserData(auth.userId);
  saveDB();
  const res = NextResponse.json({ success: true });
  clearAuthCookie(res);
  return res;
}
