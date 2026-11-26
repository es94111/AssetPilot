import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import {
  adminNotificationSettings, getConfiguredNotificationProvider, NotificationSettingsError,
  readNotificationSettings, saveNotificationSettings,
} from '../../../../lib/notificationCaptureStore';
import { parseNotificationCompletion } from '../../../../lib/notificationRecognitionCore';
import { NotificationProviderError, requestNotificationCompletion } from '../../../../lib/notificationRecognitionProvider';
import { readJsonBodyWithLimit, RequestBodyTooLargeError } from '../../../../lib/receiptOcrRequest';
import { checkRateLimit, type RateLimitEntry } from '../../../../lib/rateLimit';
import logger from '../../../../lib/logger';

export const runtime = 'nodejs';

const testLimit = new Map<string, RateLimitEntry>();

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(adminNotificationSettings(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  const initialAuth = await requireAdmin(request);
  if (initialAuth instanceof NextResponse) return initialAuth;
  let body: unknown;
  try { body = await readJsonBodyWithLimit(request.body, request.headers.get('content-length'), 4096); }
  catch (error) {
    return NextResponse.json({ error: '設定內容格式或大小無效。' }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const settings = saveNotificationSettings(body);
    auditSensitiveAction(request, auth, { action: 'admin.notification_ai.update', metadata: { enabled: settings.enabled } });
    return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof NotificationSettingsError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.warn({ event: 'notification_ai_settings', errorType: 'storage' }, 'Could not save recognition settings');
    return NextResponse.json({ error: '無法儲存辨識服務設定。' }, { status: 500 });
  }
}

const testErrors = {
  address: 'API 主機須解析到公開位址。',
  network: '連線逾時或無法連線，請檢查 API 網址。',
  redirect: 'API 服務回傳重新導向，請填入直接端點。',
  credentials: 'API 服務拒絕授權，請檢查 Key。',
  limited: 'API 服務限制用量，請檢查配額或稍後再試。',
  upstream: 'API 服務拒絕請求，請檢查模型名稱及相容端點。',
  response: 'API 服務回應無法識別，請確認模型能回傳 JSON。',
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const settings = readNotificationSettings();
  const config = getConfiguredNotificationProvider(settings);
  if (!config) return NextResponse.json({ error: '請先儲存有效的 API 設定。' }, { status: 400 });
  if (!checkRateLimit(testLimit, auth.userId, 5, 60_000)) {
    return NextResponse.json({ error: '測試連線過於頻繁，請稍後再試。' }, { status: 429 });
  }
  const notice = {
    sourceId: 'ctbc', title: '消費通知（設定測試）', subtitle: '',
    body: '您在測試商店刷卡消費 NT$75，授權成功。', receivedAt: new Date().toISOString(),
  };
  try {
    const response = await requestNotificationCompletion(config, notice, 'Asia/Taipei',
      () => readNotificationSettings().version === settings.version);
    if (response === null) return NextResponse.json({ error: '設定已變更，請重新測試。' }, { status: 409 });
    const result = parseNotificationCompletion(response, notice, 'Asia/Taipei');
    if (result.outcome === 'ignored' || result.draft.amount !== '75' || result.draft.currency !== 'TWD') {
      throw new NotificationProviderError('response');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof NotificationProviderError ? error.code : 'response';
    return NextResponse.json({ error: testErrors[code] }, { status: 502 });
  }
}
