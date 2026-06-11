import { NextResponse } from 'next/server';
import { issueIntegrityNonce } from '../../../../../lib/playIntegrityNonce';

// Public endpoint — the mobile App fetches a one-time nonce here right before
// requesting a Play Integrity token, then sends both the token and this nonce
// with login/register so the backend can bind the verdict to this challenge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const nonce = issueIntegrityNonce();
  return NextResponse.json(
    { nonce },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
