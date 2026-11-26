import { NextRequest, NextResponse } from 'next/server';
import { authorizeNotificationCapture, getConfiguredNotificationProvider, readNotificationSettings } from '../../../../../lib/notificationCaptureStore';
import { NOTIFICATION_REQUEST_MAX_BYTES, parseNotificationCompletion, prepareNotificationInput } from '../../../../../lib/notificationRecognitionCore';
import { NotificationProviderError, requestNotificationCompletion } from '../../../../../lib/notificationRecognitionProvider';
import { readJsonBodyWithLimit, RequestBodyTooLargeError } from '../../../../../lib/receiptOcrRequest';
import { checkRateLimit, type RateLimitEntry } from '../../../../../lib/rateLimit';
import logger from '../../../../../lib/logger';

export const runtime = 'nodejs';

const userLimit = new Map<string, RateLimitEntry>();
const serviceLimit = new Map<string, RateLimitEntry>();

function reply(data: object, status = 200, retryAfter?: number) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (retryAfter) headers.set('Retry-After', String(retryAfter));
  return NextResponse.json(data, { status, headers });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization');
  const grant = authorizeNotificationCapture(token);
  if (!grant) return reply({ code: 'capture_unauthorized' }, 401);
  const settings = readNotificationSettings();
  if (grant.revision !== settings.revision) return reply({ code: 'consent_required' }, 409);
  const provider = settings.enabled ? getConfiguredNotificationProvider(settings) : null;
  if (!provider) return reply({ code: 'provider_unavailable' }, 503, 300);

  let body: unknown;
  try { body = await readJsonBodyWithLimit(request.body, request.headers.get('content-length'), NOTIFICATION_REQUEST_MAX_BYTES); }
  catch (error) { return reply({ code: 'invalid_notice' }, error instanceof RequestBodyTooLargeError ? 413 : 400); }
  const prepared = prepareNotificationInput(body);
  if (prepared.status === 'invalid') return reply({ code: 'invalid_notice' }, 400);
  if (prepared.status === 'ignored') return reply({ outcome: 'ignored' });
  if (!checkRateLimit(userLimit, grant.userId, 12, 60_000) || !checkRateLimit(serviceLimit, 'all', 120, 60_000)) {
    return reply({ code: 'limited' }, 429, 60);
  }

  const startedAt = Date.now();
  let gateStatus = 200;
  try {
    const result = await requestNotificationCompletion(provider, prepared.notice, grant.timezone, () => {
      const currentGrant = authorizeNotificationCapture(token);
      const currentSettings = readNotificationSettings();
      if (!currentGrant) gateStatus = 401;
      else if (currentGrant.revision !== currentSettings.revision) gateStatus = 409;
      else if (!currentSettings.enabled || currentSettings.version !== settings.version) gateStatus = 503;
      return gateStatus === 200;
    });
    if (gateStatus === 401) return reply({ code: 'capture_unauthorized' }, 401);
    if (gateStatus === 409) return reply({ code: 'consent_required' }, 409);
    if (gateStatus === 503) return reply({ code: 'provider_unavailable' }, 503, 60);
    const decoded = parseNotificationCompletion(result, prepared.notice, grant.timezone);
    logger.info({ event: 'notification_recognition', outcome: decoded.outcome, durationMs: Date.now() - startedAt });
    return reply(decoded);
  } catch (error) {
    const code = error instanceof NotificationProviderError ? error.code : 'response';
    logger.warn({ event: 'notification_recognition', errorType: code, durationMs: Date.now() - startedAt });
    if (code === 'limited') return reply({ code: 'limited' }, 429, 120);
    return reply({ code: 'provider_unavailable' }, 503, 60);
  }
}
