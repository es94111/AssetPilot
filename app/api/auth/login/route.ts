import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '../../../../lib/db';
import {
  normalizeEmail,
  recordLoginAudit,
  recordLoginAttempt,
} from '../../../../lib/loginHelpers';
import { backfillDefaultsForUser } from '../../../../lib/userDefaults';
import { setAuthCookie, formatUser } from '../../../../lib/apiHelpers';
import { createLoginSession } from '../../../../lib/sessionHelpers';
import { isTurnstileConfigured, verifyTurnstileToken } from '../../../../lib/turnstile';
import { isPlayIntegrityConfigured, isPlayIntegrityEnforced, verifyIntegrity } from '../../../../lib/playIntegrity';
import { consumeIntegrityNonce } from '../../../../lib/playIntegrityNonce';

/** Map<email, { count, lastAttempt }> — in-memory per-process */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

function trackFailedLogin(email: string) {
  const current = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  current.count++;
  current.lastAttempt = Date.now();
  loginAttempts.set(email, current);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '');
  const password = String(body.password || '');
  const turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '');
  const integrityToken = String(body.integrityToken || '');
  const integrityNonce = String(body.integrityNonce || '');
  const headers = request.headers;

  if (isTurnstileConfigured()) {
    const turnstile = await verifyTurnstileToken(turnstileToken, headers, 'login');
    if (!turnstile.ok) {
      recordLoginAttempt({ email, headers, method: 'password', isSuccess: false, failureReason: 'turnstile_failed' });
      return NextResponse.json({ error: turnstile.error }, { status: 403 });
    }
  }

  if (!email || !password) {
    recordLoginAttempt({ email, headers, method: 'password', isSuccess: false, failureReason: 'missing_credentials' });
    return NextResponse.json({ error: '請填寫電子郵件與密碼' }, { status: 400 });
  }

  const emailLower = normalizeEmail(email);

  const attempt = loginAttempts.get(emailLower);
  if (attempt && attempt.count >= 5 && Date.now() - attempt.lastAttempt < 30 * 60 * 1000) {
    const remaining = Math.ceil((30 * 60 * 1000 - (Date.now() - attempt.lastAttempt)) / 60000);
    recordLoginAttempt({ email: emailLower, headers, method: 'password', isSuccess: false, failureReason: 'account_temporarily_locked' });
    return NextResponse.json({ error: `登入失敗次數過多，請 ${remaining} 分鐘後再試` }, { status: 429 });
  }

  const user = queryOne('SELECT * FROM users WHERE email = ?', [emailLower]);
  if (!user) {
    const DUMMY_HASH = '$2b$10$dummy.hash.for.timing.consistency.do.not.use';
    await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
    trackFailedLogin(emailLower);
    recordLoginAttempt({ email: emailLower, headers, method: 'password', isSuccess: false, failureReason: 'user_not_found' });
    return NextResponse.json({ error: '電子郵件或密碼錯誤' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, String(user.password_hash || ''));
  if (!valid) {
    trackFailedLogin(emailLower);
    recordLoginAttempt({ user, email: emailLower, headers, method: 'password', isSuccess: false, failureReason: 'wrong_password' });
    return NextResponse.json({ error: '電子郵件或密碼錯誤' }, { status: 401 });
  }

  // Play Integrity（軟性上線）：有帶 token 且後端已設定憑證時才驗證。
  // 預設僅記錄、放行；PLAY_INTEGRITY_ENFORCE=true 時不通過則擋下登入。
  if (integrityToken && isPlayIntegrityConfigured()) {
    const expectedNonce = consumeIntegrityNonce(integrityNonce) ? integrityNonce : undefined;
    const result = await verifyIntegrity({
      token: integrityToken,
      expectedNonce,
      context: 'login',
      headers,
      user,
      email: emailLower,
    });
    if (!result.ok && isPlayIntegrityEnforced()) {
      return NextResponse.json({ error: '裝置完整性驗證未通過，請於 Google Play 安裝的官方 App 重試' }, { status: 403 });
    }
  }

  loginAttempts.delete(emailLower);
  const currentLogin = recordLoginAudit(user, headers, 'password');
  recordLoginAttempt({ user, email: emailLower, headers, method: 'password', isSuccess: true });

  const userId = String(user.id);
  try { backfillDefaultsForUser(userId); } catch (e) { console.error('[backfill]', e); }
  // 固定收支與股票定期定額觸發（非阻塞）
  setImmediate(async () => {
    try {
      const { processRecurringForUser } = await import('../../../../lib/recurringHelpers');
      processRecurringForUser(userId);
    } catch (_) {}
    try {
      const stockHelpers: any = await import('../../../../lib/stockHelpers');
      await stockHelpers.processStockRecurring?.(userId);
    } catch (_) {}
  });

  const { token } = createLoginSession(userId, Number(user.token_version) || 0, headers);
  const response = NextResponse.json({ user: formatUser(user), currentLogin });
  return setAuthCookie(response, token);
}
