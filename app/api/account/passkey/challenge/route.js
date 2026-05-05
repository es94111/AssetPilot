import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { issuePasskeyChallenge } from '../../../auth/passkey/challenge/route';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { key, challenge } = issuePasskeyChallenge(auth.userId);
  return NextResponse.json({ key, challenge });
}
