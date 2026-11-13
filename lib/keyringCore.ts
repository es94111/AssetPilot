import crypto from 'node:crypto';

export const KEYRING_ROTATION_LOCK_NAME = 'assetpilot:keyring:rotation-operations';
export const KEYRING_PURPOSES = ['jwt', 'api-token', 'photo'] as const;
export type KeyringPurpose = (typeof KEYRING_PURPOSES)[number];

export interface WrappedKey {
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface VersionedSecret {
  kid: string;
  payload: string;
}

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KID_PATTERN = /^k_[A-Za-z0-9_-]{8,64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

function assertKid(kid: string): void {
  if (!KID_PATTERN.test(kid)) throw new Error('Invalid key id');
}

function decodeBase64(value: string): Buffer {
  if (!BASE64_PATTERN.test(value)) throw new Error('Invalid base64 data');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new Error('Invalid base64 data');
  return decoded;
}

function decodeBase64Url(value: string): Buffer {
  if (!BASE64URL_PATTERN.test(value)) throw new Error('Invalid base64url data');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) throw new Error('Invalid base64url data');
  return decoded;
}

export function parseRootKek(value: unknown): Buffer | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!BASE64_PATTERN.test(raw)) {
    throw new Error('KEYRING_ROOT_KEK must be base64-encoded');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH || key.toString('base64') !== raw) {
    throw new Error(`KEYRING_ROOT_KEK must decode to exactly ${KEY_LENGTH} bytes`);
  }
  return key;
}

function keyAad(purpose: KeyringPurpose, kid: string): Buffer {
  return Buffer.from(`assetpilot:keyring:wrapped-key:v1:${purpose}:${kid}`, 'utf8');
}

export function wrapPurposeKey(
  key: Buffer,
  rootKek: Buffer,
  purpose: KeyringPurpose,
  kid: string,
): WrappedKey {
  if (key.length === 0 || key.length > 4096 || rootKek.length !== KEY_LENGTH) {
    throw new Error('Purpose keys must contain 1–4096 bytes and the root KEK must be exactly 32 bytes');
  }
  assertKid(kid);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', rootKek, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(keyAad(purpose, kid));
  const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function unwrapPurposeKey(
  wrapped: WrappedKey,
  rootKek: Buffer,
  purpose: KeyringPurpose,
  kid: string,
): Buffer {
  if (rootKek.length !== KEY_LENGTH) throw new Error('The root KEK must be exactly 32 bytes');
  assertKid(kid);
  const iv = decodeBase64(wrapped.iv);
  const tag = decodeBase64(wrapped.tag);
  const ciphertext = decodeBase64(wrapped.ciphertext);
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || ciphertext.length === 0 || ciphertext.length > 4096) {
    throw new Error(`Invalid wrapped ${purpose} key ${kid}`);
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', rootKek, iv, { authTagLength: TAG_LENGTH });
  decipher.setAAD(keyAad(purpose, kid));
  decipher.setAuthTag(tag);
  const key = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (key.length === 0 || key.length > 4096) throw new Error(`Invalid unwrapped ${purpose} key ${kid}`);
  return key;
}

function deriveSecretKey(key: Buffer, purpose: KeyringPurpose, kid: string): Buffer {
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    key,
    Buffer.from('assetpilot:keyring:v1', 'utf8'),
    Buffer.from(`assetpilot:${purpose}:${kid}`, 'utf8'),
    KEY_LENGTH,
  ));
}

function secretAad(purpose: KeyringPurpose, kid: string): Buffer {
  return Buffer.from(`assetpilot:secret:v1:${purpose}:${kid}`, 'utf8');
}

export function encryptVersionedSecret(
  plaintext: string,
  key: Buffer,
  purpose: KeyringPurpose,
  kid: string,
): string {
  if (key.length === 0 || key.length > 4096) throw new Error('Purpose keys must contain 1–4096 bytes');
  assertKid(kid);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveSecretKey(key, purpose, kid), iv, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(secretAad(purpose, kid));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1.${kid}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function parseVersionedSecret(payload: unknown): VersionedSecret | null {
  const value = String(payload ?? '');
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1' || !KID_PATTERN.test(parts[1])) return null;
  return { kid: parts[1], payload: value };
}

export function decryptVersionedSecret(
  payload: string,
  key: Buffer,
  purpose: KeyringPurpose,
  kid: string,
): string {
  const parts = payload.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1' || parts[1] !== kid || !KID_PATTERN.test(kid)) {
    throw new Error('Invalid versioned secret format');
  }
  const iv = decodeBase64Url(parts[2]);
  const tag = decodeBase64Url(parts[3]);
  const ciphertext = decodeBase64Url(parts[4]);
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) throw new Error('Invalid versioned secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveSecretKey(key, purpose, kid), iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAAD(secretAad(purpose, kid));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
