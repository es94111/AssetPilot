// app/api/push/unsubscribe/route.ts — 以完整端點解除訂閱（issue #257）
//
// 瀏覽器端解除訂閱時手上只有完整 endpoint（PushSubscription.endpoint），
// 用它直接刪除自己的訂閱列，伺服器不需相信前端提供的列 id。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { removePushSubscription } from '../../../../lib/webPush';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const endpoint = String((body as { endpoint?: unknown }).endpoint ?? '').trim();
  if (!endpoint) {
    return NextResponse.json({ error: '缺少端點', code: 'ValidationError' }, { status: 400 });
  }
  const removed = removePushSubscription(auth.userId, endpoint);
  return NextResponse.json({ ok: true, removed });
}
