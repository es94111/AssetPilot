import crypto from 'crypto';
import { server as webauthnServer } from '@passwordless-id/webauthn';

/** In-memory challenge store (per process) */
export const passkeyChallenge = new Map();

export function issuePasskeyChallenge(userId) {
  const challenge = webauthnServer.randomChallenge();
  const key = crypto.randomUUID();
  passkeyChallenge.set(key, { challenge, userId: userId || null, expiresAt: Date.now() + 5 * 60 * 1000 });
  for (const [k, v] of passkeyChallenge) {
    if (v.expiresAt < Date.now()) passkeyChallenge.delete(k);
  }
  return { key, challenge };
}

export function consumePasskeyChallenge(key) {
  const entry = passkeyChallenge.get(key);
  if (!entry) return null;
  passkeyChallenge.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}
