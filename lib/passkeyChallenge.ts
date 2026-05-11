import crypto from 'crypto';
import { server as webauthnServer } from '@passwordless-id/webauthn';

/** In-memory challenge store (per process) */
export interface PasskeyChallengeEntry {
  challenge: string;
  userId: string | null;
  expiresAt: number;
}

export const passkeyChallenge = new Map<string, PasskeyChallengeEntry>();

export function issuePasskeyChallenge(userId?: string | null): { key: string; challenge: string } {
  const challenge = webauthnServer.randomChallenge();
  const key = crypto.randomUUID();
  passkeyChallenge.set(key, { challenge, userId: userId || null, expiresAt: Date.now() + 5 * 60 * 1000 });
  for (const [k, v] of passkeyChallenge) {
    if (v.expiresAt < Date.now()) passkeyChallenge.delete(k);
  }
  return { key, challenge };
}

export function consumePasskeyChallenge(key: string): PasskeyChallengeEntry | null {
  const entry = passkeyChallenge.get(key);
  if (!entry) return null;
  passkeyChallenge.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}
