import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import {
  auditRecovery,
  getRecoveryCodeStatus,
  regenerateRecoveryCodes,
  verifyStepUpReauth,
} from '@/lib/accountRecovery';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(getRecoveryCodeStatus(auth.userId), { headers: NO_STORE });
}

/** 產生／重新產生復原碼。需近期登入，或附上新鮮的 Passkey 驗證（UV）。 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const stepUp = await verifyStepUpReauth(auth.userId, auth.sessionId, body, request.headers);
  if (!stepUp.ok) {
    return NextResponse.json(
      { error: stepUp.error || '需要重新驗證身分', reauthRequired: true },
      { status: stepUp.status, headers: NO_STORE },
    );
  }

  const before = getRecoveryCodeStatus(auth.userId);
  const codes = regenerateRecoveryCodes(auth.userId);
  auditRecovery(request.headers, auth.userId, before.generated ? 'recovery_codes_regenerate' : 'recovery_codes_generate', 'success', {
    recovery_code_count: codes.length,
  });
  return NextResponse.json({ codes, ...getRecoveryCodeStatus(auth.userId) }, { headers: NO_STORE });
}
