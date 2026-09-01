import crypto from 'crypto';
import { safeOAuthReturnTo } from './loginReturn';
import { registerTtlMapPrune } from './memoryStorePrune';

const LINE_OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

type LineOAuthFlow = 'login' | 'link';

type LineOAuthStateEntry = {
  issuedAt: number;
  nonce: string;
  flow: LineOAuthFlow;
  turnstileVerified: boolean;
  returnTo: string;
  // Random value delivered back to the client out-of-band (httpOnly cookie for
  // the browser-redirect flow, explicit response/request field for the JSON
  // state endpoint used by the mobile app) and required again at consumption.
  // This proves the caller consuming the state is the same party that issued
  // it, closing OAuth login/link-CSRF where an attacker relays their own
  // code+state into a victim's authenticated browser (see AUTH-VULN-02).
  bindingToken: string;
  // Only set for flow==='link': the authenticated user/session that requested
  // the linking transaction. The link consumer must require this to match the
  // caller's own identity, so a state minted under one account can never be
  // used to link a LINE identity onto a different account (AUTH-VULN-01 /
  // AUTHZ-VULN-04).
  userId: string | null;
  sessionId: string | null;
};

const lineOAuthStates = new Map<string, LineOAuthStateEntry>();
registerTtlMapPrune(
  lineOAuthStates,
  (entry) => (Date.now() - entry.issuedAt) > LINE_OAUTH_STATE_TTL_MS,
);

function pruneLineOAuthStates() {
  const now = Date.now();
  for (const [state, entry] of lineOAuthStates.entries()) {
    if ((now - entry.issuedAt) > LINE_OAUTH_STATE_TTL_MS) lineOAuthStates.delete(state);
  }
}

export function issueLineOAuthState(
  flow = 'login',
  options: {
    turnstileVerified?: boolean;
    returnTo?: string;
    userId?: string;
    sessionId?: string;
  } = {}
): { state: string; nonce: string; bindingToken: string } {
  pruneLineOAuthStates();
  const safeFlow: LineOAuthFlow = flow === 'link' ? 'link' : 'login';
  const state = `${safeFlow}.${crypto.randomBytes(24).toString('hex')}`;
  const nonce = crypto.randomBytes(24).toString('hex');
  const bindingToken = crypto.randomBytes(24).toString('hex');
  lineOAuthStates.set(state, {
    issuedAt: Date.now(),
    nonce,
    flow: safeFlow,
    turnstileVerified: !!options.turnstileVerified,
    returnTo: safeFlow === 'login' ? safeOAuthReturnTo(options.returnTo) : '',
    bindingToken,
    userId: safeFlow === 'link' ? (options.userId || null) : null,
    sessionId: safeFlow === 'link' ? (options.sessionId || null) : null,
  });
  return { state, nonce, bindingToken };
}

export function consumeLineOAuthStateEntry(
  state: unknown
): {
  nonce: string;
  flow: LineOAuthFlow;
  turnstileVerified: boolean;
  returnTo: string;
  bindingToken: string;
  userId: string | null;
  sessionId: string | null;
} | null {
  if (typeof state !== 'string' || !state) return null;
  pruneLineOAuthStates();
  const entry = lineOAuthStates.get(state);
  if (!entry) return null;
  lineOAuthStates.delete(state);
  return {
    nonce: entry.nonce,
    flow: entry.flow,
    turnstileVerified: entry.turnstileVerified,
    returnTo: entry.returnTo,
    bindingToken: entry.bindingToken,
    userId: entry.userId,
    sessionId: entry.sessionId,
  };
}
