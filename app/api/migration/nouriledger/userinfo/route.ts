import { NextRequest, NextResponse } from 'next/server';
import { failure, NO_STORE, resolveGrant } from '@/lib/nouriledgerGrant';
import { SOURCE_USER_ID_RE, summarizeAssetUser } from '@/lib/nouriledgerExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 伺服器對伺服器：這組 code 屬於誰、有多少資料，供 NouriLedger 確認頁顯示。不消耗 code。
export async function POST(request: NextRequest) {
  const grant = await resolveGrant(request, { consume: false, scope: 'userinfo', limit: 20 });
  if (!grant.ok) return grant.response;
  // 提早告知：ID 格式不是 NouriLedger 支援的 32 位十六進位時，匯出一定會失敗。
  if (!SOURCE_USER_ID_RE.test(grant.userId)) return failure('unsupported_account', 422);
  const summary = summarizeAssetUser(grant.userId);
  if (!summary) return failure('invalid_grant', 400);
  return NextResponse.json(summary, { headers: NO_STORE });
}
