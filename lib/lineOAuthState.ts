import crypto from 'crypto';

const LINE_OAUTH_STATE_TTL_MS = 5 * 60 * 1000;
const lineOAuthStates = new Map<string, { issuedAt: number; nonce: string }>();

function pruneLineOAuthStates() {
  const now = Date.now();
  for (const [state, entry] of lineOAuthStates.entries()) {
    if ((now - entry.issuedAt) > LINE_OAUTH_STATE_TTL_MS) lineOAuthStates.delete(state);
  }
}

export function issueLineOAuthState(): { state: string; nonce: string } {
  pruneLineOAuthStates();
  const state = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(24).toString('hex');
  lineOAuthStates.set(state, { issuedAt: Date.now(), nonce });
  return { state, nonce };
}

export function consumeLineOAuthState(state: unknown): string | null {
  if (typeof state !== 'string' || !state) return null;
  pruneLineOAuthStates();
  const entry = lineOAuthStates.get(state);
  if (!entry) return null;
  lineOAuthStates.delete(state);
  return entry.nonce;
}
