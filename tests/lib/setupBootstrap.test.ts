import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret-for-setup-bootstrap';

const mod = await import('../../lib/setupBootstrap.ts');

test('generated setup token has >=128-bit entropy and is unique', () => {
  const a = mod.generateSetupToken();
  const b = mod.generateSetupToken();
  assert.notEqual(a, b);
  assert.ok(a.startsWith('ap-setup-'));
  assert.ok(a.length - 'ap-setup-'.length >= 32);
});

test('token hash is deterministic, one-way and differs from plaintext', () => {
  const t = mod.generateSetupToken();
  assert.equal(mod.hashSetupToken(t), mod.hashSetupToken(t));
  assert.notEqual(mod.hashSetupToken(t), t);
  assert.notEqual(mod.hashSetupToken(t), mod.hashSetupToken(t + 'x'));
  assert.match(mod.hashSetupToken(t), /^[0-9a-f]{64}$/);
});

test('identity validation normalises email and rejects invalid input', () => {
  const ok = mod.validateSetupIdentity({ email: '  Admin@Example.COM ', displayName: '  Root  ' });
  assert.equal(ok.email, 'admin@example.com');
  assert.equal(ok.displayName, 'Root');
  assert.throws(() => mod.validateSetupIdentity({ email: 'nope', displayName: 'x' }), mod.SetupError);
  assert.throws(() => mod.validateSetupIdentity({ email: 'a@b.co', displayName: '   ' }), mod.SetupError);
});

test('throttle blocks one IP after the per-IP limit without affecting recovery after the window', () => {
  mod.resetSetupThrottleForTests();
  const now = Date.now();
  for (let i = 0; i < 8; i++) assert.equal(mod.checkSetupThrottle('1.1.1.1', now), true);
  assert.equal(mod.checkSetupThrottle('1.1.1.1', now), false);
  assert.equal(mod.checkSetupThrottle('1.1.1.1', now + 16 * 60 * 1000), true);
  mod.resetSetupThrottleForTests();
});

test('setup origin check only trusts configured origins', () => {
  process.env.ALLOWED_ORIGINS = 'https://app.example';
  assert.equal(mod.isTrustedSetupOrigin(new Headers({ origin: 'https://evil.example' })), false);
  assert.equal(mod.isTrustedSetupOrigin(new Headers()), false);
  assert.equal(mod.isTrustedSetupOrigin(new Headers({ origin: 'https://app.example' })), true);
  delete process.env.ALLOWED_ORIGINS;
});