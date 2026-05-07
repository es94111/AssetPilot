import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../../lib/db';

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

  const db = getDB();
  // Delete user data from all business tables
  db.run('DELETE FROM transactions WHERE user_id = ?', [id]);
  db.run('DELETE FROM accounts WHERE user_id = ?', [id]);
  db.run('DELETE FROM categories WHERE user_id = ?', [id]);
  db.run('DELETE FROM budgets WHERE user_id = ?', [id]);
  db.run('DELETE FROM recurring WHERE user_id = ?', [id]);
  db.run('DELETE FROM stocks WHERE user_id = ?', [id]);
  db.run('DELETE FROM stock_transactions WHERE user_id = ?', [id]);
  db.run('DELETE FROM stock_dividends WHERE user_id = ?', [id]);
  db.run('DELETE FROM stock_recurring WHERE user_id = ?', [id]);
  db.run('DELETE FROM exchange_rates WHERE user_id = ?', [id]);
  db.run('DELETE FROM exchange_rate_settings WHERE user_id = ?', [id]);
  db.run('DELETE FROM user_settings WHERE user_id = ?', [id]);
  db.run('DELETE FROM deleted_defaults WHERE user_id = ?', [id]);
  db.run('DELETE FROM report_schedules WHERE user_id = ?', [id]);
  db.run('DELETE FROM login_audit_logs WHERE user_id = ?', [id]);
  db.run('DELETE FROM login_attempt_logs WHERE user_id = ?', [id]);
  db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [id]);
  db.run('DELETE FROM users WHERE id = ?', [id]);

  saveDB();

  return NextResponse.json({ ok: true });
}
