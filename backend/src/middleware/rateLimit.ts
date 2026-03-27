import type { RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };

function getClientIp(req: Parameters<RequestHandler>[0]): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const raw = forwarded || req.ip || req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '') || 'unknown';
}

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }): RequestHandler {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${getClientIp(req)}:${req.method}:${req.baseUrl || req.path}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({ error: message });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: '登入嘗試次數過多，請稍後再試',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: '請求過於頻繁，請稍後再試',
});
