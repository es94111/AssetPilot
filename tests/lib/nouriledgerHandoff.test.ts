// tests/lib/nouriledgerHandoff.test.ts — 一鍵匯入 NouriLedger 的授權碼／PKCE／authorize 決策（純函式，不需資料庫）。
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/nouriledgerHandoff.test.ts
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import { safeOAuthReturnTo } from '../../lib/loginReturn.ts';
import {
  CODE_TTL_SECONDS, decideAuthorize, encodeWarnings, getNouriLedgerOrigin, HandoffError, isCodeUsed, issueAuthorizationCode,
  markCodeUsed, normalizeOrigin, pkceChallenge, redeemGrant, verifyAuthorizationCode,
} from '../../lib/nouriledgerHandoff.ts';

const env = { JWT_SECRET: 'unit-test-secret-for-handoff' };
const ORIGIN = 'https://nouriledger.example.test';
const CALLBACK = `${ORIGIN}/migrate/callback`;
const NOW = 1_800_000_000_000;
const verifier = () => randomBytes(32).toString('base64url');
const challengeOf = (value: string) => createHash('sha256').update(value).digest('base64url');
const state = () => randomBytes(32).toString('base64url');

function expectGrantError(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => error instanceof HandoffError && error.code === code);
}

function issue(overrides: Partial<{ userId: string; tokenVersion: number; challenge: string; audience: string; now: number }> = {}) {
  const proof = verifier();
  const code = issueAuthorizationCode(
    { userId: overrides.userId ?? 'a'.repeat(32), tokenVersion: overrides.tokenVersion ?? 3, codeChallenge: overrides.challenge ?? challengeOf(proof), audience: overrides.audience ?? ORIGIN },
    { now: overrides.now ?? NOW, env },
  );
  return { code, proof };
}

test('the feature is off unless NOURILEDGER_ORIGIN is a valid HTTPS (or loopback) origin', () => {
  assert.equal(getNouriLedgerOrigin({}), null);
  assert.equal(getNouriLedgerOrigin({ NOURILEDGER_ORIGIN: '  ' }), null);
  assert.equal(getNouriLedgerOrigin({ NOURILEDGER_ORIGIN: 'https://nouriledger.shao.one/' }), 'https://nouriledger.shao.one');
  assert.equal(getNouriLedgerOrigin({ NOURILEDGER_ORIGIN: 'http://localhost:3100' }), 'http://localhost:3100');
  for (const bad of ['http://nouriledger.shao.one', 'https://nouriledger.shao.one/app', 'https://u:p@nouriledger.shao.one', 'ftp://x.test', 'javascript:alert(1)', 'nouriledger.shao.one']) {
    assert.equal(getNouriLedgerOrigin({ NOURILEDGER_ORIGIN: bad }), null, bad);
    assert.equal(normalizeOrigin(bad), null, bad);
  }
});

test('a code verifies only with the matching PKCE verifier, audience and signature, and before it expires', () => {
  const { code, proof } = issue();
  const payload = verifyAuthorizationCode(code, { verifier: proof, audience: ORIGIN }, { now: NOW + 1000, env });
  assert.equal(payload.uid, 'a'.repeat(32));
  assert.equal(payload.tv, 3);
  assert.equal(payload.exp, Math.floor(NOW / 1000) + CODE_TTL_SECONDS);
  expectGrantError(() => verifyAuthorizationCode(code, { verifier: verifier(), audience: ORIGIN }, { now: NOW, env }), 'invalid_grant');
  expectGrantError(() => verifyAuthorizationCode(code, { verifier: proof, audience: 'https://other.example.test' }, { now: NOW, env }), 'invalid_grant');
  expectGrantError(() => verifyAuthorizationCode(code, { verifier: proof, audience: ORIGIN }, { now: NOW + (CODE_TTL_SECONDS + 1) * 1000, env }), 'invalid_grant');
  expectGrantError(() => verifyAuthorizationCode(code, { verifier: proof, audience: ORIGIN }, { now: NOW, env: { JWT_SECRET: 'a-different-secret' } }), 'invalid_grant');
  assert.throws(() => verifyAuthorizationCode(code, { verifier: proof, audience: ORIGIN }, { now: NOW, env: {} }), /JWT_SECRET/);
});

test('tampered, truncated and foreign codes are rejected with the same opaque error', () => {
  const { code, proof } = issue();
  const [prefix, body, signature] = code.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), uid: 'b'.repeat(32) })).toString('base64url');
  const flipped = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
  for (const attempt of [
    `${prefix}.${forgedPayload}.${signature}`, `${prefix}.${body}.${flipped}`, `${prefix}.${body}.`, `${prefix}.${body}`,
    `${prefix}.${body}.${signature}.extra`, `nlh2.${body}.${signature}`, '', 'garbage', 'a.b.c', `${prefix}..`,
  ]) expectGrantError(() => verifyAuthorizationCode(attempt, { verifier: proof, audience: ORIGIN }, { now: NOW, env }), 'invalid_grant');
});

test('redeeming validates the request body strictly and ties the code to the configured callback', () => {
  const { code, proof } = issue({ now: Date.now() });
  const good = { code, code_verifier: proof, redirect_uri: CALLBACK };
  const options = { env, consume: false };
  assert.equal(redeemGrant(good, ORIGIN, options).uid, 'a'.repeat(32));
  for (const bad of [null, undefined, 'string', [], {}, { ...good, extra: 1 }, { ...good, code_verifier: 'short' }, { ...good, code_verifier: `${proof}!` }, { ...good, code: 'x' }, { code: good.code }]) {
    expectGrantError(() => redeemGrant(bad, ORIGIN, options), 'invalid_request');
  }
  expectGrantError(() => redeemGrant({ ...good, redirect_uri: 'https://evil.example.test/migrate/callback' }, ORIGIN, options), 'invalid_grant');
  expectGrantError(() => redeemGrant({ ...good, redirect_uri: `${ORIGIN}/other` }, ORIGIN, options), 'invalid_grant');
});

test('userinfo does not consume a code, export consumes it exactly once, and a consumed code is dead everywhere', () => {
  const { code, proof } = issue({ now: Date.now() });
  const body = { code, code_verifier: proof, redirect_uri: CALLBACK };
  const first = redeemGrant(body, ORIGIN, { env, consume: false });
  assert.equal(redeemGrant(body, ORIGIN, { env, consume: false }).jti, first.jti);
  assert.equal(isCodeUsed(first), false);
  assert.equal(redeemGrant(body, ORIGIN, { env, consume: true }).jti, first.jti);
  assert.equal(markCodeUsed(first), false);
  expectGrantError(() => redeemGrant(body, ORIGIN, { env, consume: true }), 'invalid_grant');
  expectGrantError(() => redeemGrant(body, ORIGIN, { env, consume: false }), 'invalid_grant');
});

test('the authorize decision never redirects to a URL it did not configure', () => {
  const proof = verifier();
  const query = (extra: Record<string, string> = {}) => new URL(`https://asset.example.test/api/migration/nouriledger/authorize?${new URLSearchParams({
    response_type: 'code', redirect_uri: CALLBACK, state: state(), code_challenge: challengeOf(proof), code_challenge_method: 'S256', ...extra,
  })}`);
  const session = { userId: 'c'.repeat(32), tokenVersion: 4 };
  assert.deepEqual(decideAuthorize(query(), session, null, { env, now: NOW }), { kind: 'reject', status: 404, error: 'not_found' });
  for (const redirectUri of ['https://evil.example.test/migrate/callback', `${ORIGIN}/elsewhere`, `${ORIGIN}/migrate/callback/`, `${CALLBACK}?x=1`, '', 'http://nouriledger.example.test/migrate/callback']) {
    assert.deepEqual(decideAuthorize(query({ redirect_uri: redirectUri }), session, ORIGIN, { env, now: NOW }), { kind: 'reject', status: 400, error: 'invalid_redirect_uri' }, redirectUri);
  }
  for (const badState of ['', 'short', 'has space in it ok!!', 'x'.repeat(200)]) {
    assert.deepEqual(decideAuthorize(query({ state: badState }), session, ORIGIN, { env, now: NOW }), { kind: 'reject', status: 400, error: 'invalid_request' }, badState);
  }
});

test('authorize sends bad parameters back with an error, anonymous users to login, and signed-in users back with a code', () => {
  const proof = verifier();
  const stateValue = state();
  const build = (extra: Record<string, string> = {}) => new URL(`https://asset.example.test/api/migration/nouriledger/authorize?${new URLSearchParams({
    response_type: 'code', redirect_uri: CALLBACK, state: stateValue, code_challenge: challengeOf(proof), code_challenge_method: 'S256', ...extra,
  })}`);
  const session = { userId: 'c'.repeat(32), tokenVersion: 4 };
  for (const bad of [{ response_type: 'token' }, { code_challenge_method: 'plain' }, { code_challenge: 'short' }, { code_challenge: '' }] as Array<Record<string, string>>) {
    const decision = decideAuthorize(build(bad), session, ORIGIN, { env, now: NOW });
    assert.equal(decision.kind, 'redirect');
    const location = new URL((decision as { location: string }).location);
    assert.equal(`${location.origin}${location.pathname}`, CALLBACK);
    assert.equal(location.searchParams.get('error'), 'invalid_request');
    assert.equal(location.searchParams.get('state'), stateValue);
    assert.equal(location.searchParams.get('code'), null);
  }
  assert.deepEqual(decideAuthorize(build(), null, ORIGIN, { env, now: NOW }), { kind: 'login' }, 'nothing is issued before sign-in');
  const decision = decideAuthorize(build(), session, ORIGIN, { env, now: NOW });
  assert.equal(decision.kind, 'redirect');
  const location = new URL((decision as { location: string }).location);
  assert.equal(location.searchParams.get('state'), stateValue);
  const payload = verifyAuthorizationCode(location.searchParams.get('code')!, { verifier: proof, audience: ORIGIN }, { now: NOW, env });
  assert.equal(payload.uid, 'c'.repeat(32));
  assert.equal(payload.tv, 4);
});

test('pkce challenge is RFC 7636 S256, warnings fit a header, and the login return allow-list admits only the two known targets', () => {
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const encoded = encodeWarnings(Array.from({ length: 20 }, () => 'x'.repeat(400)));
  assert.ok(encoded.length < 2000);
  assert.equal((JSON.parse(Buffer.from(encoded, 'base64url').toString()) as string[]).length, 5);

  const authorize = '/api/migration/nouriledger/authorize?response_type=code&state=abc';
  assert.equal(safeOAuthReturnTo(authorize), authorize);
  assert.equal(safeOAuthReturnTo('/oauth/authorize?client_id=a'), '/oauth/authorize?client_id=a', 'existing MCP behaviour is unchanged');
  for (const rejected of ['/api/migration/nouriledger/export', '/api/migration/nouriledger/userinfo', '/api/migration/other/authorize?x=1', '//evil.test/api/migration/nouriledger/authorize', 'https://evil.test/api/migration/nouriledger/authorize', '/\\evil.test/api/migration/nouriledger/authorize', '/dashboard', '']) {
    assert.equal(safeOAuthReturnTo(rejected), '', rejected);
  }
});
