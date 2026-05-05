import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

const BUSINESS_TABLES = [
  'stock_dividends', 'stock_transactions', 'stock_recurring', 'stocks',
  'transactions', 'budgets', 'recurring', 'accounts', 'categories',
  'exchange_rates', 'exchange_rate_settings', 'stock_settings',
  'passkey_credentials', 'user_settings',
];

function deleteUserData(userId) {
  const db = getDB();
  for (const t of BUSINESS_TABLES) {
    try { db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]); } catch (_) {}
  }
  db.run('DELETE FROM login_audit_logs WHERE user_id = ?', [userId]);
  db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
  db.run('DELETE FROM users WHERE id = ?', [userId]);
}

export async function DELETE(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { password } = body;

  const user = queryOne('SELECT id, password_hash, has_password, google_id, is_admin FROM users WHERE id = ?', [auth.userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  if (user.has_password) {
    if (!password) return NextResponse.json({ error: '請輸入密碼以確認刪除' }, { status: 400 });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: '密碼錯誤，請重新輸入' }, { status: 400 });
  }

  deleteUserData(auth.userId);
  saveDB();

  return NextResponse.json({ ok: true });
}
