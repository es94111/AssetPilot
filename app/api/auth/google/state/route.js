import { NextResponse } from 'next/server';
import crypto from 'crypto';

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const googleOAuthStates = new Map();

function pruneGoogleOAuthStates() {
  const now = Date.now();
  for (const [state, issuedAt] of googleOAuthStates.entries()) {
    if ((now - issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS) googleOAuthStates.delete(state);
  }
}

export function issueGoogleOAuthState() {
  pruneGoogleOAuthStates();
  const state = crypto.randomBytes(24).toString('base64url');
  googleOAuthStates.set(state, Date.now());
  return state;
}

export function consumeGoogleOAuthState(state) {
  if (typeof state !== 'string' || state.length < 20 || state.length > 200) return false;
  pruneGoogleOAuthStates();
  const issuedAt = googleOAuthStates.get(state);
  if (!issuedAt) return false;
  googleOAuthStates.delete(state);
  return (Date.now() - issuedAt) <= GOOGLE_OAUTH_STATE_TTL_MS;
}

export async function GET() {
  const response = NextResponse.json({ state: issueGoogleOAuthState() });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
