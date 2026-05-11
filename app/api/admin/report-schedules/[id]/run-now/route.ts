// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../../lib/db';
import { runScheduledReportNow } from '../../../../../../lib/scheduler';

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT id FROM report_schedules WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: '排程不存在' }, { status: 404 });

  try {
    const result = await runScheduledReportNow(id, '管理員手動');
    if (result.status === 'no_email_service') {
      return NextResponse.json({ status: 'no_email_service', reason: '寄信服務未設定', ...result }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || '排程執行失敗' }, { status: 500 });
  }
}
