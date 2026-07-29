// app/api/user/mcp-credentials/route.ts — 使用者自助管理 MCP 存取憑證：列出 / 建立
// 沿用既有 authToken Cookie + requireAuth() 驗證慣例（非 Bearer PAT，見 mcp-credentials.openapi.yaml）
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { createMcpCredential, listMcpCredentials, McpCredentialLimitError, type McpCredentialSummary } from '../../../../lib/mcpAuth';
import { toIsoUtc } from '../../../../lib/userTime';

const MAX_NAME_LENGTH = 100;

// Constitution Principle IV：API 輸出時序化為既有 ISO 8601 UTC 格式；lib/mcpAuth.ts 內部仍以 Unix ms 儲存/比較。
function isoOrNull(ms: number | null): string | null {
  return ms == null ? null : toIsoUtc(ms);
}

function serializeCredential(c: McpCredentialSummary) {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    createdAt: toIsoUtc(c.createdAt),
    lastUsedAt: isoOrNull(c.lastUsedAt),
    expiresAt: isoOrNull(c.expiresAt),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ credentials: listMcpCredentials(auth.userId).map(serializeCredential) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as { name?: string; expiresAt?: string | null };
  const name = String(body?.name || '').trim();
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `名稱必須為 1~${MAX_NAME_LENGTH} 字元` }, { status: 400 });
  }

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
    const created = createMcpCredential(auth.userId, name, expiresAtMs);
    return NextResponse.json({
      credential: serializeCredential({
        id: created.id,
        name: created.name,
        status: 'active',
        createdAt: created.createdAt,
        lastUsedAt: null,
        expiresAt: created.expiresAt || null,
      }),
      token: created.token,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof McpCredentialLimitError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
