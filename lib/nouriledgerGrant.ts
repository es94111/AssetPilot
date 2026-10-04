// lib/nouriledgerGrant.ts — NouriLedger 伺服器對伺服器兩個端點（userinfo／export）的共用閘門。
//
// 順序很重要：在請求被證明為真之前不花任何資源（速率額度、code），一次性 code 也只在其他檢查都通過後才燒掉。
import { NextResponse } from 'next/server';
import { queryOne } from './db';
import { getNouriLedgerOrigin, HandoffError, markCodeUsed, redeemGrant } from './nouriledgerHandoff';
import { checkRateLimit, type RateLimitEntry } from './rateLimit';
import { isActiveUserFlag } from './userActive';

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;
export const failure = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

const perUserLimits = new Map<string, RateLimitEntry>();

export type GrantResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function resolveGrant(
  request: Request,
  options: { consume: boolean; scope: 'userinfo' | 'export'; limit: number },
): Promise<GrantResult> {
  const origin = getNouriLedgerOrigin();
  if (!origin) return { ok: false, response: failure('not_found', 404) };

  let body: unknown = null;
  try { body = await request.json(); } catch { /* 下方回報 invalid_request */ }
  let payload;
  try {
    payload = redeemGrant(body, origin, { consume: false });
  } catch (error) {
    if (error instanceof HandoffError) return { ok: false, response: failure(error.code, 400) };
    throw error;
  }

  const user = queryOne('SELECT id, is_active, token_version FROM users WHERE id = ?', [payload.uid]);
  if (!user || !isActiveUserFlag(user.is_active) || (Number(user.token_version) || 0) !== payload.tv) {
    return { ok: false, response: failure('invalid_grant', 400) };
  }

  if (!checkRateLimit(perUserLimits, `${options.scope}:${String(user.id)}`, options.limit, 10 * 60 * 1000)) {
    return { ok: false, response: NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '600' } }) };
  }

  if (options.consume && !markCodeUsed(payload)) return { ok: false, response: failure('invalid_grant', 400) };
  return { ok: true, userId: String(user.id) };
}
