// app/api/push/subscriptions/[id]/route.ts — 以列 id 刪除訂閱（issue #257）
//
// 設定頁的裝置列表只拿到端點主機名稱（完整端點不外流），因此「刪除其他裝置」
// 走列 id；刪除目前這台裝置則由 DELETE /api/push/unsubscribe 帶完整端點處理。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { removePushSubscriptionById } from '../../../../../lib/webPush';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: '缺少訂閱 id', code: 'ValidationError' }, { status: 400 });
  }
  const removed = removePushSubscriptionById(auth.userId, id);
  return NextResponse.json({ ok: true, removed });
}
