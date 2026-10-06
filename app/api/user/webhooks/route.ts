// app/api/user/webhooks/route.ts — Webhook 訂閱：列出 / 建立（issue #258）
// 建立時回傳簽章密鑰一次；之後僅能透過 secretPrefix 辨識，無法再取回明文。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  serializeWebhookSubscription,
  ApiTokenError,
} from '../../../../lib/webhookHelpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    subscriptions: listWebhookSubscriptions(auth.userId).map(serializeWebhookSubscription),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { url?: unknown; events?: unknown };
  try {
    const created = createWebhookSubscription(auth.userId, body?.url, body?.events);
    auditSensitiveAction(request, auth, {
      action: 'webhook_subscription_create',
      metadata: {
        webhook_subscription_id: created.subscription.id,
        webhook_url: created.subscription.url,
        webhook_events: created.subscription.events.join(' '),
      },
    });
    return NextResponse.json(
      {
        subscription: serializeWebhookSubscription(created.subscription),
        // 簽章密鑰僅在此回應出現一次，之後無法再取得。
        secret: created.secret,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ApiTokenError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    throw e;
  }
}
