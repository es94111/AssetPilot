import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  KEYRING_PURPOSES,
  decryptVersionedSecret,
  encryptVersionedSecret,
  parseRootKek,
  parseVersionedSecret,
  unwrapPurposeKey,
  wrapPurposeKey,
} from '../../lib/keyringCore.ts';

const kid = 'k_12345678abcdefgh';
const root = crypto.randomBytes(32);

test('root KEK parsing rejects missing, malformed, non-canonical, and wrong-length values', () => {
  assert.equal(parseRootKek(undefined), null);
  assert.equal(parseRootKek('  '), null);
  assert.deepEqual(parseRootKek(root.toString('base64')), root);
  assert.throws(() => parseRootKek('not base64!'), /base64/);
  assert.throws(() => parseRootKek(Buffer.alloc(31).toString('base64')), /32 bytes/);
  assert.deepEqual(parseRootKek(` ${root.toString('base64')} `), root);
  assert.throws(() => parseRootKek(`${root.toString('base64')}=`), /base64/);
});

test('wrapped purpose keys round-trip and bind purpose and key id', () => {
  for (const purpose of KEYRING_PURPOSES) {
    const key = Buffer.from(`legacy-${purpose}-secret`, 'utf8');
    const wrapped = wrapPurposeKey(key, root, purpose, kid);
    assert.deepEqual(unwrapPurposeKey(wrapped, root, purpose, kid), key);
    assert.throws(() => unwrapPurposeKey(wrapped, root, purpose, 'k_87654321abcdefgh'));
    const otherPurpose = KEYRING_PURPOSES.find((candidate) => candidate !== purpose)!;
    assert.throws(() => unwrapPurposeKey(wrapped, root, otherPurpose, kid));
    assert.throws(() => unwrapPurposeKey(wrapped, crypto.randomBytes(32), purpose, kid));
  }
});

test('wrapped purpose keys reject malformed components and oversized inputs', () => {
  const key = Buffer.from('secret');
  const wrapped = wrapPurposeKey(key, root, 'jwt', kid);
  assert.throws(() => unwrapPurposeKey({ ...wrapped, iv: '%%%' }, root, 'jwt', kid));
  assert.throws(() => unwrapPurposeKey({ ...wrapped, tag: Buffer.alloc(15).toString('base64') }, root, 'jwt', kid));
  assert.throws(() => unwrapPurposeKey({ ...wrapped, ciphertext: '' }, root, 'jwt', kid));
  assert.throws(() => wrapPurposeKey(key, Buffer.alloc(31), 'jwt', kid));
  assert.throws(() => wrapPurposeKey(Buffer.alloc(4097), root, 'jwt', kid));
  assert.throws(() => wrapPurposeKey(key, root, 'jwt', 'invalid'));
});

test('versioned secrets round-trip, including empty plaintext, and bind purpose, kid, and key', () => {
  for (const purpose of KEYRING_PURPOSES) {
    const key = crypto.randomBytes(32);
    for (const plaintext of ['', 'invoice-驗證碼-123', 'webhook-secret']) {
      const encrypted = encryptVersionedSecret(plaintext, key, purpose, kid);
      assert.equal(decryptVersionedSecret(encrypted, key, purpose, kid), plaintext);
      assert.deepEqual(parseVersionedSecret(encrypted), { kid, payload: encrypted });
      const otherPurpose = KEYRING_PURPOSES.find((candidate) => candidate !== purpose)!;
      assert.throws(() => decryptVersionedSecret(encrypted, key, otherPurpose, kid));
      assert.throws(() => decryptVersionedSecret(encrypted, crypto.randomBytes(32), purpose, kid));
      assert.throws(() => decryptVersionedSecret(encrypted, key, purpose, 'k_87654321abcdefgh'));
    }
  }
});

test('versioned secrets reject tampering and malformed encodings', () => {
  const key = crypto.randomBytes(32);
  const encrypted = encryptVersionedSecret('sensitive', key, 'api-token', kid);
  const parts = encrypted.split('.');
  const changedTag = Buffer.from(parts[3], 'base64url');
  changedTag[0] ^= 1;
  parts[3] = changedTag.toString('base64url');
  assert.throws(() => decryptVersionedSecret(parts.join('.'), key, 'api-token', kid));

  const malformed = encrypted.split('.');
  malformed[2] = '%%%';
  assert.throws(() => decryptVersionedSecret(malformed.join('.'), key, 'api-token', kid), /base64url/);
  assert.equal(parseVersionedSecret('iv.tag.ciphertext'), null);
  assert.equal(parseVersionedSecret('v1.invalid.iv.tag.data'), null);
  assert.throws(() => encryptVersionedSecret('secret', key, 'api-token', 'invalid'), /key id/);
});
