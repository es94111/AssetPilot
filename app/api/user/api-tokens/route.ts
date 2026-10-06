// app/api/user/api-tokens/route.ts — 第三方自動化整合用 API Token：列出 / 建立（issue #258）
// 沿用既有 authToken Cookie + requireAuth() 驗證慣例（比照 app/api/user/mcp-credentials/route.ts）。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import {
  createApiToken,
  listApiTokens,
  serializeApiToken,
  ApiTokenError,
} from '../../../../lib/apiTokenAuth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ tokens: listApiTokens(auth.userId).map(serializeApiToken) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    scopes?: unknown;
    expiresAt?: string | null;
  };

  let expiresAtMs = 0;
  if (body?.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: '到期時間格式無效' }, { status: 400 });
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: '到期時間必須為未來時間' }, { status: 400 });
    }
    expiresAtMs = parsed.getTime();
  }

  try {
    const created = createApiToken(auth.userId, String(body?.name || ''), body?.scopes, expiresAtMs);
    auditSensitiveAction(request, auth, {
      action: 'api_token_create',
      metadata: {
        api_token_id: created.id,
        api_token_name: created.name,
        api_token_scopes: created.scopes.join(' '),
      },
    });
    return NextResponse.json(
      {
        token: serializeApiToken({
          id: created.id,
          name: created.name,
          status: 'active',
          scopes: created.scopes,
          prefix: created.prefix,
          createdAt: created.createdAt,
          lastUsedAt: null,
          expiresAt: created.expiresAt || null,
        }),
        // 明文權杖僅在此回應出現一次，之後無法再取得。
        secret: created.token,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ApiTokenError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    throw e;
  }
}
