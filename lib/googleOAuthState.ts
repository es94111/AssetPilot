import crypto from 'crypto';

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const googleOAuthStates = new Map<string, number>();

function pruneGoogleOAuthStates() {
  const now = Date.now();
  for (const [state, issuedAt] of googleOAuthStates.entries()) {
    if ((now - issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS) googleOAuthStates.delete(state);
  }
}

export function issueGoogleOAuthState(): string {
  pruneGoogleOAuthStates();
  const state = crypto.randomBytes(24).toString('base64url');
  googleOAuthStates.set(state, Date.now());
  return state;
}

export function consumeGoogleOAuthState(state: unknown): boolean {
  if (typeof state !== 'string' || state.length < 20 || state.length > 200) return false;
  pruneGoogleOAuthStates();
  const issuedAt = googleOAuthStates.get(state);
  if (!issuedAt) return false;
  googleOAuthStates.delete(state);
  return (Date.now() - issuedAt) <= GOOGLE_OAUTH_STATE_TTL_MS;
}
