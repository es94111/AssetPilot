// lib/apiTokenRequestAuth.ts — 以 API Token 驗證的公開 REST 端點認證（issue #258）
//
// 這組端點（/api/v1/**）與站內 /api/user/** 不同：不使用 authToken Cookie，
// 只接受 `Authorization: Bearer ap_api_…`，因此 proxy.ts 將其列為不需要 cookie 的路徑，
// 由本模組完成實際的權杖與權限範圍驗證。
//
// 回應一律帶 `Cache-Control: no-store`，避免共享快取把使用者資料外洩給其他權杖持有者。
import { NextResponse } from 'next/server';
import { verifyApiToken, requireApiTokenScope, type VerifyApiTokenResult } from './apiTokenAuth';
import type { ApiTokenScope } from './apiTokenCore';
import { apiRateLimitHeaders, checkIpRateLimit, checkTokenRateLimit } from './apiRateLimit';
import { getClientIpFromHeaders } from './requestIp';

export const API_TOKEN_BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  if (!authorizationHeader.startsWith(API_TOKEN_BEARER_PREFIX)) return null;
  const token = authorizationHeader.slice(API_TOKEN_BEARER_PREFIX.length).trim();
  return token || null;
}

// 排空冷卻：重試最快 30 秒後才到期，故每 15 秒最多排空一次即可。
// 沒有這層冷卻時，只使用 API Token 的用戶端每個請求都會觸發一次掃描。
const DRAIN_COOLDOWN_MS = 15 * 1000;
let lastDrainAt = 0;

function drainDeliveriesOnce(): void {
  const now = Date.now();
  if (now - lastDrainAt < DRAIN_COOLDOWN_MS) return;
  lastDrainAt = now;
  void import('./transactionWebhooks')
    .then(({ triggerWebhookDeliveryDrain }) => triggerWebhookDeliveryDrain())
    .catch((error) => console.error('[webhook] token-request delivery drain failed', error));
}

/** 測試用：重設冷卻狀態。 */
export function _resetApiTokenDrainCooldown(): void {
  lastDrainAt = 0;
}

function unauthorized(message: string): NextResponse {
  // WWW-Authenticate 讓用戶端知道應改用 Bearer 權杖（RFC 6750）。
  return NextResponse.json(
    { error: message, code: 'Unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } },
  );
}

function rateLimited(
  decision: import('./apiRateLimit').RateLimitDecision,
): NextResponse {
  return NextResponse.json(
    { error: '請求過於頻繁，請稍後再試', code: 'RateLimited' },
    {
      status: 429,
      headers: { ...apiRateLimitHeaders(decision), 'Cache-Control': 'no-store' },
    },
  );
}

/**
 * 帳本授權失敗一律以既有錯誤形狀回覆：不區分「不存在」與「非成員」，
 * 避免洩漏其他帳本的存在。viewer 寫入則明確回 403（與站內 API 一致）。
 * （自 app/api/v1/* 各端點抽出共用。）
 */
export function ledgerScopeError(
  reason: 'not-a-member' | 'read-only' | 'not-found',
): NextResponse {
  if (reason === 'read-only') {
    return jsonNoStore(
      { error: '此帳本為唯讀，無法修改資料', code: 'Forbidden' },
      { status: 403 },
    );
  }
  return jsonNoStore(
    { error: '找不到帳本或沒有存取權', code: 'NotFound' },
    { status: 404 },
  );
}

/** 公開 API 的 JSON body 上限（防超大請求體癱瘓解析）。 */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

/**
 * 嚴格讀取 JSON body：大小上限 64KB、必須為 JSON 物件（非陣列／純值）。
 * 空 body 以 `{}` 回傳（沿用既有端點「空 body 交由欄位驗證回報」的語意）。
 * 失敗時回傳可直接 return 的 413／400 回應。
 */
export async function readJsonBody<T = Record<string, unknown>>(
  request: { headers: { get(name: string): string | null }; text: () => Promise<string> },
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonNoStore({ error: '請求內容過大', code: 'PayloadTooLarge' }, { status: 413 }),
    };
  }
  const text = await request.text().catch(() => '');
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonNoStore({ error: '請求內容過大', code: 'PayloadTooLarge' }, { status: 413 }),
    };
  }
  if (!text.trim()) return { ok: true, body: {} as T };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: jsonNoStore({ error: 'JSON 格式無效', code: 'ValidationError' }, { status: 400 }),
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      response: jsonNoStore({ error: 'JSON 格式無效', code: 'ValidationError' }, { status: 400 }),
    };
  }
  return { ok: true, body: parsed as T };
}

/**
 * 驗證請求並確認具備指定權限範圍。
 * 成功回傳驗證結果；失敗回傳可直接 return 的 NextResponse。
 *
 * 防護順序（速率限制見 lib/apiRateLimit.ts）：
 *   1. per-IP 限流（認證前）——無效權杖的暴力猜測同樣消耗額度；
 *   2. Bearer 權杖解析與驗證（401 不區分無效／過期／撤銷／停用）；
 *   3. scope 最小權限檢查（403）；
 *   4. per-Token 限流（認證後，讀寫分額度）。
 */
export function requireApiToken(
  request: { headers: { get(name: string): string | null } },
  requiredScope: ApiTokenScope,
): VerifyApiTokenResult | NextResponse {
  // per-IP 先行：擋權杖暴力猜測與單一來源洪水（限流回應不揭露權杖狀態）。
  // SAFETY: 呼叫端只保證 `headers.get(name)`；requestIp 的 getHeader 只使用此能力。
  const ip = getClientIpFromHeaders(
    request.headers as unknown as Parameters<typeof getClientIpFromHeaders>[0],
  );
  const ipDecision = checkIpRateLimit(ip);
  if (!ipDecision.allowed) return rateLimited(ipDecision);

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return unauthorized('請以 Authorization: Bearer <API Token> 呼叫');
  }

  const verified = verifyApiToken(token);
  if (!verified) {
    // 不區分「不存在／已撤銷／已過期／帳號停用」，避免洩漏權杖狀態。
    return unauthorized('API Token 無效、已過期或已撤銷');
  }

  try {
    requireApiTokenScope(verified, requiredScope);
  } catch {
    return NextResponse.json(
      { error: `此 API Token 缺少必要權限範圍：${requiredScope}`, code: 'InsufficientScope' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // per-Token 限流：辨識失控的自動化；讀寫分額度（寫入較嚴）。
  const tokenDecision = checkTokenRateLimit(verified.tokenId, requiredScope);
  if (!tokenDecision.allowed) return rateLimited(tokenDecision);

  // 只使用 API Token 的用戶端不會經過 Cookie 認證路徑，若不在這裡觸發，
  // 失敗的 Webhook 投遞將永遠沒有請求可以把它們拾起（issue #258 review）。
  drainDeliveriesOnce();

  return verified;
}

/** 供端點統一加上 no-store，避免快取外洩。 */
export function jsonNoStore(body: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * 讀取呼叫端明確指定的帳本 ID（issue #281）。
 *
 * 公開 API 沒有 Cookie 與 `x-ledger-id` 標頭，改以 query string `ledgerId`
 * 或 JSON body `ledgerId` 明確傳遞；未指定時維持既有個人帳本行為。
 */
export function readRequestedLedgerId(request: {
  url?: string;
  headers: { get(name: string): string | null };
}, body?: unknown): string {
  const header = String(request.headers.get('x-ledger-id') || '').trim();
  if (header) return header;
  try {
    const url = new URL(String(request.url || ''), 'http://localhost');
    const query = String(url.searchParams.get('ledgerId') || '').trim();
    if (query) return query;
  } catch {
    /* 非標準 URL 時略過，交由 body 決定 */
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const value = (body as { ledgerId?: unknown }).ledgerId;
    if (value != null) return String(value).trim();
  }
  return '';
}
