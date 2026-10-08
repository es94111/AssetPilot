// app/api/push/subscriptions/route.ts — Web Push 訂閱管理（issue #257）
//
// GET  ：列出目前使用者的訂閱裝置（僅回傳端點主機名稱，不外流完整端點）
// POST ：建立／更新訂閱（同一 endpoint 重送＝更新，可安全重試）
//
// 刪除訂閱走 DELETE /api/push/unsubscribe（需帶完整 endpoint）或
// DELETE /api/push/subscriptions/[id]（以列 id 刪除）。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import {
  MAX_PUSH_SUBSCRIPTIONS,
  PushSubscriptionError,
  listPushSubscriptions,
  savePushSubscription,
} from '../../../../lib/webPush';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const currentEndpoint = request.headers.get('x-push-endpoint') || '';
  const subscriptions = listPushSubscriptions(auth.userId, currentEndpoint);
  return NextResponse.json(
    {
      subscriptions,
      maxSubscriptions: MAX_PUSH_SUBSCRIPTIONS,
      count: subscriptions.length,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  try {
    const result = savePushSubscription(
      auth.userId,
      (body as { subscription?: unknown }).subscription ?? body,
      request.headers.get('user-agent') || '',
    );
    return NextResponse.json({ ok: true, id: result.id, created: result.created });
  } catch (error) {
    if (error instanceof PushSubscriptionError) {
      return NextResponse.json(
        { error: error.message, code: 'InvalidPushSubscription' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : '訂閱失敗';
    return NextResponse.json({ error: message, code: 'PushSubscriptionFailed' }, { status: 400 });
  }
}
