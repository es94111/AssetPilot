import { getRequestIpFromHeaders } from './loginHelpers';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileSiteVerifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
};

export function getTurnstileSiteKey(): string {
  return process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY || '';
}

export function getTurnstileSecretKey(): string {
  return process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || '';
}

export function isTurnstileConfigured(): boolean {
  return !!(getTurnstileSiteKey() && getTurnstileSecretKey());
}

export function hasAnyTurnstileConfig(): boolean {
  return !!(getTurnstileSiteKey() || getTurnstileSecretKey());
}

export async function verifyTurnstileToken(
  token: string,
  headers: Headers,
  expectedAction?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = getTurnstileSecretKey();
  if (!secret) return { ok: false, error: 'Turnstile 尚未設定完成' };
  if (!token) return { ok: false, error: '請先完成真人驗證' };

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);

  const remoteIp = getRequestIpFromHeaders(headers);
  if (remoteIp && remoteIp !== 'unknown') form.set('remoteip', remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as TurnstileSiteVerifyResponse;
    if (!response.ok || !data.success) {
      return { ok: false, error: '真人驗證失敗，請重新確認' };
    }
    if (expectedAction && data.action && data.action !== expectedAction) {
      return { ok: false, error: '真人驗證用途不符，請重新確認' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: '真人驗證服務暫時無法使用，請稍後再試' };
  }
}
