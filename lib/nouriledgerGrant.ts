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

/** 請求本文只有 code、PKCE verifier 與一個網址；這兩個端點是公開的，所以在驗章之前先限制大小。 */
const MAX_BODY_BYTES = 16 * 1024;

/** 最多讀 `maxBytes` 的本文（先看宣告長度，串流時再檢查一次）；超過則回傳 null。 */
async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // 只停止讀取、不取消串流：取消會銷毀 socket，使 keep-alive 連線（以及共用它的反向代理連線池）被重設。
      // 回應之後，伺服器會自行丟棄尚未讀完的剩餘內容。
      reader.releaseLock();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export async function resolveGrant(
  request: Request,
  options: { consume: boolean; scope: 'userinfo' | 'export'; limit: number },
): Promise<GrantResult> {
  const origin = getNouriLedgerOrigin();
  if (!origin) return { ok: false, response: failure('not_found', 404) };

  let raw: string | null;
  try { raw = await readBodyLimited(request, MAX_BODY_BYTES); } catch { raw = null; }
  if (raw === null) return { ok: false, response: failure('invalid_request', 400) };
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* 下方回報 invalid_request */ }
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
