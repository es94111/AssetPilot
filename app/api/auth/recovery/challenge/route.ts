import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { issuePasskeyChallenge } from '@/lib/passkeyChallenge';
import { RECOVERY_CHALLENGE_PURPOSE, RECOVERY_COOKIE_NAME, verifyRecoverySession } from '@/lib/accountRecovery';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const session = verifyRecoverySession(request.cookies.get(RECOVERY_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: '復原工作階段已失效' }, { status: 401, headers: NO_STORE });
  const user = queryOne('SELECT id, email FROM users WHERE id = ?', [session.userId]);
  if (!user) return NextResponse.json({ error: '復原工作階段已失效' }, { status: 401, headers: NO_STORE });

  const { key, challenge } = issuePasskeyChallenge(session.userId, {
    purpose: RECOVERY_CHALLENGE_PURPOSE,
    bindingId: session.id,
  });
  return NextResponse.json(
    { key, challenge, user: { id: String(user.id), name: String(user.email || ''), displayName: String(user.email || '') } },
    { headers: NO_STORE },
  );
}
