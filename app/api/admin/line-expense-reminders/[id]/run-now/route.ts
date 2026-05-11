// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../../lib/db';
import { runLineExpenseReminderNow } from '../../../../../../lib/scheduler';

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT id FROM line_expense_reminders WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: '提醒不存在' }, { status: 404 });

  try {
    const result = await runLineExpenseReminderNow(id, '管理員手動');
    if (result.status === 'no_line_service') {
      return NextResponse.json({ status: 'no_line_service', reason: 'LINE Messaging API 未設定', ...result }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || '提醒執行失敗' }, { status: 500 });
  }
}
