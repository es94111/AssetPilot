import { NextRequest, NextResponse } from 'next/server';
import { issuePasskeyChallenge } from '@/lib/passkeyChallenge';
import { getRequestIpFromHeaders, uid } from '@/lib/loginHelpers';
import {
  SETUP_CHALLENGE_PURPOSE,
  SetupError,
  auditSetup,
  checkSetupThrottle,
  isSetupRequired,
  isTrustedSetupOrigin,
  validateSetupIdentity,
  verifySetupToken,
} from '@/lib/setupBootstrap';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!isTrustedSetupOrigin(request.headers)) {
    return NextResponse.json({ error: '不允許的請求來源' }, { status: 403, headers: NO_STORE });
  }
  if (!isSetupRequired()) {
    return NextResponse.json({ error: '系統已完成初始化' }, { status: 404, headers: NO_STORE });
  }
  if (!checkSetupThrottle(getRequestIpFromHeaders(request.headers as never))) {
    auditSetup(request.headers, 'setup_challenge', 'failure', undefined, 'rate_limited');
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429, headers: NO_STORE });
  }

  const body = await request.json().catch(() => ({}));
  const tokenHash = verifySetupToken(body.token);
  if (!tokenHash) {
    auditSetup(request.headers, 'setup_challenge', 'failure', undefined, 'invalid_token');
    return NextResponse.json({ error: '初始化憑證不正確或已失效' }, { status: 401, headers: NO_STORE });
  }

  try {
    const identity = validateSetupIdentity(body);
    const userId = uid();
    const { key, challenge } = issuePasskeyChallenge(userId, { purpose: SETUP_CHALLENGE_PURPOSE, bindingId: tokenHash });
    return NextResponse.json(
      { key, challenge, user: { id: userId, name: identity.email, displayName: identity.displayName } },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof SetupError) return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    return NextResponse.json({ error: '無法建立挑戰' }, { status: 500, headers: NO_STORE });
  }
}
