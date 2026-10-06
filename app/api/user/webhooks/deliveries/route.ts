// app/api/user/webhooks/deliveries/route.ts — Webhook 投遞紀錄查詢（issue #258 驗收條件 4）
// 可依 subscriptionId 過濾；預設回傳最近 50 筆，上限 200 筆。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { listWebhookDeliveries, serializeWebhookDelivery } from '../../../../../lib/webhookHelpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get('subscriptionId') || undefined;
  const limit = searchParams.get('limit') || undefined;

  const deliveries = listWebhookDeliveries(auth.userId, { subscriptionId, limit: Number(limit) });
  return NextResponse.json({ deliveries: deliveries.map(serializeWebhookDelivery) });
}
