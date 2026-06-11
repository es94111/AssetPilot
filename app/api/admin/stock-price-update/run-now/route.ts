// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { runStockPriceUpdate } from '../../../../../lib/stockPriceUpdater';

// 管理員手動觸發一次股價更新（略過交易時段閘門與節流）
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await runStockPriceUpdate('管理員手動');
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || '股價更新失敗' }, { status: 500 });
  }
}
