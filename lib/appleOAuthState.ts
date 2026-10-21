import crypto from 'crypto';
import { registerTtlMapPrune } from './memoryStorePrune';

const APPLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type AppleOAuthFlow = 'login' | 'link';

type AppleOAuthStateEntry = {
  issuedAt: number;
  // Binds the state to the client that requested it. The mobile app cannot
  // share a cookie jar with the system browser, so the binding token travels
  // in the JSON body and must be presented again when the identity token is
  // exchanged. This closes login-CSRF where an attacker relays their own
  // identity token into a victim's client (same rationale as
  // lib/googleOAuthState.ts).
  bindingToken: string;
  // The Apple "nonce" that must be embedded in the identity token. The client
  // generates it before starting the flow and the server verifies that the
  // returned token carries the same nonce, binding the token to this request.
  nonce: string;
  flow: AppleOAuthFlow;
  // Only set for flow==='link': the authenticated user/session that requested
  // the linking transaction. The link consumer must require this to match the
  // caller's own identity, so a state minted under one account can never be
  // used to link an Apple identity onto a different account.
  userId: string | null;
};

const appleOAuthStates = new Map<string, AppleOAuthStateEntry>();
registerTtlMapPrune(
  appleOAuthStates,
  (entry) => (Date.now() - entry.issuedAt) > APPLE_OAUTH_STATE_TTL_MS,
);

function pruneAppleOAuthStates() {
  const now = Date.now();
  for (const [state, entry] of appleOAuthStates.entries()) {
    if ((now - entry.issuedAt) > APPLE_OAUTH_STATE_TTL_MS) appleOAuthStates.delete(state);
  }
}

export function issueAppleOAuthState(
  flow: AppleOAuthFlow = 'login',
  options: { userId?: string } = {},
): {
  state: string;
  bindingToken: string;
  nonce: string;
} {
  pruneAppleOAuthStates();
  const safeFlow: AppleOAuthFlow = flow === 'link' ? 'link' : 'login';
  const state = crypto.randomBytes(24).toString('base64url');
  const bindingToken = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(24).toString('base64url');
  appleOAuthStates.set(state, {
    issuedAt: Date.now(),
    bindingToken,
    nonce,
    flow: safeFlow,
    userId: safeFlow === 'link' ? options.userId || null : null,
  });
  return { state, bindingToken, nonce };
}

export function consumeAppleOAuthStateEntry(state: unknown): {
  bindingToken: string;
  nonce: string;
  flow: AppleOAuthFlow;
  userId: string | null;
} | null {
  if (typeof state !== 'string' || state.length < 20 || state.length > 200) return null;
  pruneAppleOAuthStates();
  const entry = appleOAuthStates.get(state);
  if (!entry) return null;
  appleOAuthStates.delete(state);
  if ((Date.now() - entry.issuedAt) > APPLE_OAUTH_STATE_TTL_MS) return null;
  return {
    bindingToken: entry.bindingToken,
    nonce: entry.nonce,
    flow: entry.flow,
    userId: entry.userId,
  };
}
