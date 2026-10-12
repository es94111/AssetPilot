import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret-for-recovery';

const mod = await import('../../lib/accountRecovery.ts');
const challenge = await import('../../lib/passkeyChallenge.ts');

test('recovery code has >=128-bit entropy and is unique', () => {
  const a = mod.generateRecoveryCode();
  const b = mod.generateRecoveryCode();
  assert.notEqual(a, b);
  const raw = a.replace(/-/g, '');
  assert.ok(raw.length * 5 >= 128);
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})+$/);
});

test('normalize accepts case, separators and ambiguous characters', () => {
  const code = mod.generateRecoveryCode();
  const messy = ' ' + code.toLowerCase().replace(/-/g, ' - ') + ' ';
  assert.equal(mod.normalizeRecoveryCode(messy), mod.normalizeRecoveryCode(code));
});

test('hash is deterministic, one-way and never equals plaintext', () => {
  const code = mod.normalizeRecoveryCode(mod.generateRecoveryCode());
  const h = mod.hashRecoveryCode(code);
  assert.equal(h, mod.hashRecoveryCode(code));
  assert.notEqual(h, code);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('throttle blocks repeated attempts on the same credential', () => {
  mod.resetRecoveryThrottleForTests();
  const code = mod.normalizeRecoveryCode(mod.generateRecoveryCode());
  const results = [1, 2, 3, 4].map((i) => mod.checkRecoveryThrottle(`1.1.1.${i}`, `u${i}@x.com`, code, 1000));
  assert.deepEqual(results, [true, true, true, false]);
  mod.resetRecoveryThrottleForTests();
  const byAccount = Array.from({ length: 6 }, (_, i) =>
    mod.checkRecoveryThrottle(`2.2.2.${i}`, 'same@x.com', mod.normalizeRecoveryCode(mod.generateRecoveryCode()), 1000),
  );
  assert.equal(byAccount[5], false);
  mod.resetRecoveryThrottleForTests();
});

test('recovery challenge carries purpose and binding; normal ones do not', () => {
  const normal = challenge.issuePasskeyChallenge('u1');
  const recovery = challenge.issuePasskeyChallenge('u1', { purpose: mod.RECOVERY_CHALLENGE_PURPOSE, bindingId: 's1' });
  const n = challenge.consumePasskeyChallenge(normal.key);
  const r = challenge.consumePasskeyChallenge(recovery.key);
  assert.equal(n?.purpose, undefined);
  assert.equal(r?.purpose, 'recovery');
  assert.equal(r?.bindingId, 's1');
  assert.equal(challenge.consumePasskeyChallenge(recovery.key), null);
});

test('recovery session cookie is not accepted as an auth session token', () => {
  assert.notEqual(mod.RECOVERY_COOKIE_NAME, 'authToken');
  assert.equal(mod.verifyRecoverySession(undefined), null);
});
