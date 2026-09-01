import crypto from 'crypto';
import { registerTtlMapPrune } from './memoryStorePrune';

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type GoogleOAuthStateEntry = {
  issuedAt: number;
  // See lib/lineOAuthState.ts for the rationale: this binds the state to the
  // browser/client that requested it, closing OAuth login-CSRF where an
  // attacker relays their own code+state into a victim's browser
  // (AUTHZ-VULN-06).
  bindingToken: string;
};

const googleOAuthStates = new Map<string, GoogleOAuthStateEntry>();
registerTtlMapPrune(
  googleOAuthStates,
  (entry) => (Date.now() - entry.issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS,
);

function pruneGoogleOAuthStates() {
  const now = Date.now();
  for (const [state, entry] of googleOAuthStates.entries()) {
    if ((now - entry.issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS) googleOAuthStates.delete(state);
  }
}

export function issueGoogleOAuthState(): { state: string; bindingToken: string } {
  pruneGoogleOAuthStates();
  const state = crypto.randomBytes(24).toString('base64url');
  const bindingToken = crypto.randomBytes(24).toString('hex');
  googleOAuthStates.set(state, { issuedAt: Date.now(), bindingToken });
  return { state, bindingToken };
}

export function consumeGoogleOAuthStateEntry(state: unknown): { bindingToken: string } | null {
  if (typeof state !== 'string' || state.length < 20 || state.length > 200) return null;
  pruneGoogleOAuthStates();
  const entry = googleOAuthStates.get(state);
  if (!entry) return null;
  googleOAuthStates.delete(state);
  if ((Date.now() - entry.issuedAt) > GOOGLE_OAUTH_STATE_TTL_MS) return null;
  return { bindingToken: entry.bindingToken };
}
