import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import { queryOne } from '@/lib/db';
import { decideAuthorize, getNouriLedgerOrigin } from '@/lib/nouriledgerHandoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectTo(location: string) {
  return new NextResponse(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

// 一鍵匯入 NouriLedger 的瀏覽器端點。已登入的使用者會帶著短效 code 被導回 NouriLedger；其他人什麼都拿不到。
// 資料本身要等使用者在 NouriLedger 確認後，才以伺服器對伺服器方式取走。
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getNouriLedgerOrigin();
  let session: { userId: string; tokenVersion: number } | null = null;
  if (origin) {
    const auth = await requireAuth(request);
    if (!(auth instanceof NextResponse)) {
      // code 要綁 token_version，讓「登出所有裝置」能撤銷尚未兌換的 code。
      const row = queryOne('SELECT token_version FROM users WHERE id = ?', [auth.userId]);
      session = { userId: auth.userId, tokenVersion: Number(row?.token_version) || 0 };
    }
  }
  const decision = decideAuthorize(url, session, origin);
  if (decision.kind === 'reject') return NextResponse.json({ error: decision.error }, { status: decision.status, headers: { 'Cache-Control': 'no-store' } });
  if (decision.kind === 'login') return redirectTo(`/login?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  return redirectTo(decision.location);
}
