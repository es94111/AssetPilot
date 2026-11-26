import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getConfiguredNotificationProvider, issueCaptureToken, readNotificationSettings, revokeCaptureToken } from '../../../../lib/notificationCaptureStore';
import { notificationSources } from '../../../../lib/notificationSources';
import { readJsonBodyWithLimit, RequestBodyTooLargeError } from '../../../../lib/receiptOcrRequest';

export const runtime = 'nodejs';

const authOptions = { skipAutomaticProcessing: true } as const;
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, authOptions);
  if (auth instanceof NextResponse) return auth;
  const settings = readNotificationSettings();
  const available = settings.enabled && Boolean(getConfiguredNotificationProvider(settings));
  return NextResponse.json({
    available,
    origin: available ? new URL(settings.endpoint).origin : '',
    model: available ? settings.model : '',
    revision: available ? settings.revision : '',
    sources: notificationSources,
  }, { headers });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, authOptions);
  if (auth instanceof NextResponse) return auth;
  let revision: unknown;
  try {
    const body = await readJsonBodyWithLimit(request.body, request.headers.get('content-length'), 1024);
    revision = (body as { revision?: unknown } | null)?.revision;
  } catch (error) {
    return NextResponse.json({ error: '通知辨識設定格式錯誤。' }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  const settings = readNotificationSettings();
  if (!settings.enabled || !getConfiguredNotificationProvider(settings)) {
    return NextResponse.json({ code: 'provider_unavailable', error: '辨識服務尚未開放。' }, { status: 503 });
  }
  if (!settings.revision || revision !== settings.revision) {
    return NextResponse.json({ code: 'consent_required', error: '辨識服務已變更，請重新查看並同意。' }, { status: 409 });
  }
  const token = issueCaptureToken(auth.actorUserId, auth.sessionId ?? '', request.headers, settings.revision);
  if (!token) return NextResponse.json({ error: '請從 iPhone App 重新登入後啟用。' }, { status: 403 });
  return NextResponse.json({ token, revision: settings.revision }, { headers });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, authOptions);
  if (auth instanceof NextResponse) return auth;
  if (auth.sessionId) revokeCaptureToken(auth.sessionId);
  return NextResponse.json({ success: true }, { headers });
}
