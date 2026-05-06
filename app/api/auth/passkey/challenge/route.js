import { NextResponse } from 'next/server';
import { issuePasskeyChallenge } from '@/lib/passkeyChallenge';

export async function GET() {
  const { key, challenge } = issuePasskeyChallenge(null);
  return NextResponse.json({ key, challenge });
}
