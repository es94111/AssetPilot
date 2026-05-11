// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ error: '系統更新功能在 Next.js 執行環境中不支援，請使用 Docker 或 PM2 管理服務更新' }, { status: 501 });
}
