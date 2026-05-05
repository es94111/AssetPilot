import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../../lib/db';

export async function POST(request, { params }) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT id FROM report_schedules WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: '排程不存在' }, { status: 404 });

  return NextResponse.json({ error: '此功能在 Next.js 執行環境中不支援' }, { status: 501 });
}
