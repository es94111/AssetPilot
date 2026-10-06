// app/api/user/webhooks/[id]/route.ts — Webhook 訂閱：更新（網址／事件／啟用狀態）與刪除（issue #258）
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';
import {
  updateWebhookSubscription,
  deleteWebhookSubscription,
  serializeWebhookSubscription,
  ApiTokenError,
} from '../../../../../lib/webhookHelpers';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { url?: unknown; events?: unknown; active?: unknown };
  try {
    const updated = updateWebhookSubscription(auth.userId, id, body || {});
    if (!updated) {
      return NextResponse.json({ error: '找不到此 Webhook 訂閱' }, { status: 404 });
    }
    auditSensitiveAction(request, auth, {
      action: 'webhook_subscription_update',
      metadata: {
        webhook_subscription_id: updated.id,
        webhook_url: updated.url,
        webhook_events: updated.events.join(' '),
      },
    });
    return NextResponse.json({ subscription: serializeWebhookSubscription(updated) });
  } catch (e) {
    if (e instanceof ApiTokenError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const deleted = deleteWebhookSubscription(auth.userId, id);
  if (!deleted) {
    return NextResponse.json({ error: '找不到此 Webhook 訂閱' }, { status: 404 });
  }
  auditSensitiveAction(request, auth, {
    action: 'webhook_subscription_delete',
    metadata: { webhook_subscription_id: id },
  });
  return NextResponse.json({ success: true });
}
