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

export const API_TOKEN_BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  if (!authorizationHeader.startsWith(API_TOKEN_BEARER_PREFIX)) return null;
  const token = authorizationHeader.slice(API_TOKEN_BEARER_PREFIX.length).trim();
  return token || null;
}

function unauthorized(message: string): NextResponse {
  // WWW-Authenticate 讓用戶端知道應改用 Bearer 權杖（RFC 6750）。
  return NextResponse.json(
    { error: message, code: 'Unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } },
  );
}

/**
 * 驗證請求並確認具備指定權限範圍。
 * 成功回傳驗證結果；失敗回傳可直接 return 的 NextResponse。
 */
export function requireApiToken(
  request: { headers: { get(name: string): string | null } },
  requiredScope: ApiTokenScope,
): VerifyApiTokenResult | NextResponse {
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

  return verified;
}

/** 供端點統一加上 no-store，避免快取外洩。 */
export function jsonNoStore(body: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
