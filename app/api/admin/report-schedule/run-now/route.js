import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers.js';

export async function POST(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { error: '手動執行報表排程需要伺服器程序支援，請使用 node server.js 模式' },
    { status: 501 }
  );
}
