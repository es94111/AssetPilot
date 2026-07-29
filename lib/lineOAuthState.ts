import crypto from 'crypto';
import { safeOAuthReturnTo } from './loginReturn';

const LINE_OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

type LineOAuthFlow = 'login' | 'link';

type LineOAuthStateEntry = {
  issuedAt: number;
  nonce: string;
  flow: LineOAuthFlow;
  turnstileVerified: boolean;
  returnTo: string;
};

const lineOAuthStates = new Map<string, LineOAuthStateEntry>();

function pruneLineOAuthStates() {
  const now = Date.now();
  for (const [state, entry] of lineOAuthStates.entries()) {
    if ((now - entry.issuedAt) > LINE_OAUTH_STATE_TTL_MS) lineOAuthStates.delete(state);
  }
}

export function issueLineOAuthState(
  flow = 'login',
  options: { turnstileVerified?: boolean; returnTo?: string } = {}
): { state: string; nonce: string } {
  pruneLineOAuthStates();
  const safeFlow: LineOAuthFlow = flow === 'link' ? 'link' : 'login';
  const state = `${safeFlow}.${crypto.randomBytes(24).toString('hex')}`;
  const nonce = crypto.randomBytes(24).toString('hex');
  lineOAuthStates.set(state, {
    issuedAt: Date.now(),
    nonce,
    flow: safeFlow,
    turnstileVerified: !!options.turnstileVerified,
    returnTo: safeFlow === 'login' ? safeOAuthReturnTo(options.returnTo) : '',
  });
  return { state, nonce };
}

export function consumeLineOAuthStateEntry(
  state: unknown
): { nonce: string; flow: LineOAuthFlow; turnstileVerified: boolean; returnTo: string } | null {
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
  };
}

export function consumeLineOAuthState(state: unknown): string | null {
  return consumeLineOAuthStateEntry(state)?.nonce || null;
}
