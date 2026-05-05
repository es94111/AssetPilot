import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signToken } from '../../../../lib/auth';
import { queryOne, saveDB } from '../../../../lib/db';
import {
  normalizeEmail,
  getUserCount,
  recordLoginAudit,
  recordLoginAttempt,
} from '../../../../lib/loginHelpers';
import { backfillDefaultsForUser } from '../../../../lib/userDefaults';
import { setAuthCookie, formatUser } from '../../../../lib/apiHelpers';

/** Map<email, { count, lastAttempt }> — in-memory per-process */
const loginAttempts = new Map();

function trackFailedLogin(email) {
  const current = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  current.count++;
  current.lastAttempt = Date.now();
  loginAttempts.set(email, current);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '');
  const password = String(body.password || '');
  const headers = request.headers;

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

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    trackFailedLogin(emailLower);
    recordLoginAttempt({ user, email: emailLower, headers, method: 'password', isSuccess: false, failureReason: 'wrong_password' });
    return NextResponse.json({ error: '電子郵件或密碼錯誤' }, { status: 401 });
  }

  loginAttempts.delete(emailLower);
  const currentLogin = recordLoginAudit(user, headers, 'password');
  recordLoginAttempt({ user, email: emailLower, headers, method: 'password', isSuccess: true });

  try { backfillDefaultsForUser(user.id); } catch (e) { console.error('[backfill]', e); }
  // 固定收支與股票定期定額觸發（非阻塞）
  setImmediate(async () => {
    try {
      const { processRecurringForUser } = await import('../../../../lib/recurringHelpers.js');
      processRecurringForUser(user.id);
    } catch (_) {}
    try {
      const { processStockRecurring } = await import('../../../../lib/stockHelpers.js');
      await processStockRecurring(user.id);
    } catch (_) {}
  });

  const token = signToken(user.id, Number(user.token_version) || 0);
  const response = NextResponse.json({ user: formatUser(user), currentLogin });
  return setAuthCookie(response, token);
}
