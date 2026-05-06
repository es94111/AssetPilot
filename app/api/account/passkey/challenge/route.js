import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { issuePasskeyChallenge } from '@/lib/passkeyChallenge';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { key, challenge } = issuePasskeyChallenge(auth.userId);
  return NextResponse.json({ key, challenge });
}
