// tests/lib/nouriledgerRoutes.test.ts — 一鍵匯入 NouriLedger 的三個端點（需要真實 PostgreSQL；未設定則略過）。
// authorize 走一般登入 session（authToken cookie），userinfo／export 只靠 code + PKCE verifier。
// 執行方式：DATABASE_URL=postgresql://…/assetpilot_test node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/nouriledgerRoutes.test.ts
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import JSZip from 'jszip';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let usable = false;
try { usable = Boolean(DB_URL) && ['127.0.0.1', 'localhost'].includes(new URL(DB_URL as string).hostname); } catch { /* 無效的連線字串 */ }

if (!usable) {
  test('nouriledgerRoutes（略過：需設定指向本機 PostgreSQL 的 DATABASE_URL/POSTGRES_URL）', () => {});
} else {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-nouri-routes-'));
  process.env.TRANSACTION_PHOTO_LOCAL_DIR = path.join(scratch, 'photos');
  process.env.PHOTO_MASTER_KEY = Buffer.alloc(32, 5).toString('base64');
  process.env.JWT_SECRET = 'route-test-secret-value-0123456789';
  const ORIGIN = 'https://nouriledger.example.test';
  const CALLBACK = `${ORIGIN}/migrate/callback`;
  process.env.NOURILEDGER_ORIGIN = ORIGIN;
  const { NextRequest } = await import('next/server');
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { safeOAuthReturnTo } = await import('../../lib/loginReturn.ts');
  const handoff = await import('../../lib/nouriledgerHandoff.ts');
  const { ASSET_TABLES } = await import('../../lib/nouriledgerExport.ts');
  const authorizeRoute = await import('../../app/api/migration/nouriledger/authorize/route.ts');
  const userinfoRoute = await import('../../app/api/migration/nouriledger/userinfo/route.ts');
  const exportRoute = await import('../../app/api/migration/nouriledger/export/route.ts');
  await initDB();
  const db = getDB();

  const created: string[] = [];
  const challengeOf = (value: string) => createHash('sha256').update(value).digest('base64url');
  function makeUser(options: { id?: string; active?: number; tokenVersion?: number } = {}) {
    const id = options.id ?? uid();
    db.run('INSERT INTO users(id,email,password_hash,display_name,created_at,is_active,token_version) VALUES(?,?,?,?,?,?,?)',
      [id, `${id}@nouri-routes.invalid`, 'unused', 'Routes user', new Date().toISOString(), options.active ?? 1, options.tokenVersion ?? 0]);
    created.push(id);
    return { id, tokenVersion: options.tokenVersion ?? 0, token: createLoginSession(id, options.tokenVersion ?? 0, new Headers()).token };
  }
  function grantFor(user: { id: string; tokenVersion: number }, audience = ORIGIN) {
    const verifier = randomBytes(32).toString('base64url');
    const code = handoff.issueAuthorizationCode({ userId: user.id, tokenVersion: user.tokenVersion, codeChallenge: challengeOf(verifier), audience });
    return { code, code_verifier: verifier, redirect_uri: CALLBACK };
  }
  const post = (route: { POST: (request: InstanceType<typeof NextRequest>) => Promise<Response> }, body: unknown) => route.POST(new NextRequest('https://asset.example.test/api/migration/nouriledger/x', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const authorizeUrl = (params: Record<string, string>) => `https://asset.example.test/api/migration/nouriledger/authorize?${new URLSearchParams(params)}`;

  after(async () => {
    for (const id of created) {
      db.run('DELETE FROM accounts WHERE user_id=?', [id]);
      db.run('DELETE FROM login_sessions WHERE user_id=?', [id]);
      db.run("DELETE FROM data_operation_audit_log WHERE user_id=? AND action='export_to_nouriledger'", [id]);
      db.run('DELETE FROM users WHERE id=?', [id]);
    }
    db.close();
    await fs.rm(scratch, { recursive: true, force: true });
  });

  test('authorize sends anonymous visitors to login and signed-in users back to NouriLedger with a PKCE-bound code', async () => {
    const user = makeUser({ tokenVersion: 2 });
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const url = authorizeUrl({ response_type: 'code', redirect_uri: CALLBACK, state, code_challenge: challengeOf(verifier), code_challenge_method: 'S256' });

    const anonymous = await authorizeRoute.GET(new NextRequest(url));
    assert.equal(anonymous.status, 302);
    const loginTarget = new URL(anonymous.headers.get('location')!, 'https://asset.example.test');
    assert.equal(loginTarget.pathname, '/login');
    const returnTo = loginTarget.searchParams.get('returnTo')!;
    assert.equal(safeOAuthReturnTo(returnTo), returnTo, 'the login page is willing to send the user back here');
    assert.equal(new URL(returnTo, 'https://asset.example.test').searchParams.get('state'), state);
    assert.equal(anonymous.headers.get('cache-control'), 'no-store');

    const signedIn = await authorizeRoute.GET(new NextRequest(url, { headers: { cookie: `authToken=${user.token}` } }));
    assert.equal(signedIn.status, 302);
    const back = new URL(signedIn.headers.get('location')!);
    assert.equal(`${back.origin}${back.pathname}`, CALLBACK);
    assert.equal(back.searchParams.get('state'), state);
    const payload = handoff.verifyAuthorizationCode(back.searchParams.get('code')!, { verifier, audience: ORIGIN });
    assert.equal(payload.uid, user.id);
    assert.equal(payload.tv, 2, 'bound to the current token_version so sign-out-everywhere revokes it');
    assert.throws(() => handoff.verifyAuthorizationCode(back.searchParams.get('code')!, { verifier: randomBytes(32).toString('base64url'), audience: ORIGIN }));
  });

  test('authorize refuses untrusted redirect targets and malformed requests, and is absent when not configured', async () => {
    const user = makeUser();
    const verifier = randomBytes(32).toString('base64url');
    const base = { response_type: 'code', redirect_uri: CALLBACK, state: randomBytes(32).toString('base64url'), code_challenge: challengeOf(verifier), code_challenge_method: 'S256' };
    const get = (params: Record<string, string>) => authorizeRoute.GET(new NextRequest(authorizeUrl(params), { headers: { cookie: `authToken=${user.token}` } }));

    for (const bad of [{ redirect_uri: 'https://evil.example.test/migrate/callback' }, { redirect_uri: `${CALLBACK}/x` }, { state: 'short' }]) {
      const response = await get({ ...base, ...bad });
      assert.equal(response.status, 400, JSON.stringify(bad));
      assert.equal(response.headers.get('location'), null, 'no redirect to a URL that was not configured');
    }
    const malformed = await get({ ...base, code_challenge_method: 'plain' });
    assert.equal(malformed.status, 302);
    assert.equal(new URL(malformed.headers.get('location')!).searchParams.get('error'), 'invalid_request');

    const saved = process.env.NOURILEDGER_ORIGIN;
    delete process.env.NOURILEDGER_ORIGIN;
    try { assert.equal((await get(base)).status, 404); } finally { process.env.NOURILEDGER_ORIGIN = saved; }
  });

  test('userinfo identifies the account without spending the code; export returns the exact ZIP exactly once', async () => {
    const user = makeUser();
    db.run('INSERT INTO accounts(id,user_id,name,initial_balance,currency,created_at) VALUES(?,?,?,?,?,?)', [uid(), user.id, 'Route wallet', '9007199254740993.1234567', 'TWD', String(Date.now())]);
    const grant = grantFor(user);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await post(userinfoRoute, grant);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.sourceUserId, user.id);
      assert.equal(body.account.name, 'Routes user');
      assert.equal(body.counts.accounts, 1);
    }
    const exported = await post(exportRoute, grant);
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get('content-type'), 'application/zip');
    assert.equal(exported.headers.get('cache-control'), 'no-store');
    assert.equal(exported.headers.get('x-nouriledger-export-warnings'), null);
    const zip = await JSZip.loadAsync(Buffer.from(await exported.arrayBuffer()));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    assert.equal(manifest.userId, user.id);
    assert.equal(manifest.numericEncoding, 'postgres-numeric-text');
    assert.equal(JSON.parse(await zip.file('data/accounts.json')!.async('string'))[0].initial_balance, '9007199254740993.1234567');
    assert.equal(ASSET_TABLES.length, 15);
    for (const table of ASSET_TABLES) assert.ok(zip.file(`data/${table}.json`), `missing data/${table}.json`);

    assert.equal((await post(exportRoute, grant)).status, 400, 'a code cannot be redeemed twice');
    assert.equal((await post(userinfoRoute, grant)).status, 400, 'and is dead for userinfo as well');
    const audit = queryOne("SELECT result,metadata FROM data_operation_audit_log WHERE user_id=? AND action='export_to_nouriledger'", [user.id]);
    assert.equal(audit?.result, 'success');
    assert.ok(!String(audit?.metadata).includes('nouri-routes.invalid'), 'audit carries counts only');
  });

  test('requests that are not proven genuine are refused before anything is read', async () => {
    const user = makeUser();
    const grant = grantFor(user);
    for (const route of [userinfoRoute, exportRoute]) {
      assert.deepEqual(await (await post(route, { ...grant, code_verifier: randomBytes(32).toString('base64url') })).json(), { error: 'invalid_grant' });
      assert.deepEqual(await (await post(route, { ...grant, redirect_uri: 'https://evil.example.test/migrate/callback' })).json(), { error: 'invalid_grant' });
      assert.deepEqual(await (await post(route, grantFor(user, 'https://other.example.test'))).json(), { error: 'invalid_grant' }, 'code issued for another audience');
      assert.deepEqual(await (await post(route, { ...grant, code: `${grant.code.slice(0, -2)}xx` })).json(), { error: 'invalid_grant' });
      assert.deepEqual(await (await post(route, { code: grant.code })).json(), { error: 'invalid_request' });
      assert.deepEqual(await (await post(route, 'not json')).json(), { error: 'invalid_request' });
    }
    assert.equal((await post(userinfoRoute, grant)).status, 200, 'none of the failed attempts burned the genuine code');
  });

  test('disabled accounts, revoked sessions and unsupported ids cannot redeem a code', async () => {
    const disabled = makeUser({ active: 0 });
    assert.equal((await post(userinfoRoute, grantFor(disabled))).status, 400);
    assert.equal((await post(exportRoute, grantFor(disabled))).status, 400);

    const revoked = makeUser({ tokenVersion: 1 });
    const grant = grantFor(revoked);
    assert.equal((await post(userinfoRoute, grant)).status, 200);
    db.run('UPDATE users SET token_version=token_version+1 WHERE id=?', [revoked.id]);
    assert.equal((await post(userinfoRoute, grant)).status, 400, 'signing out everywhere revokes outstanding codes');
    assert.equal((await post(exportRoute, grant)).status, 400);

    const legacy = makeUser({ id: `legacy-${uid()}`.slice(0, 20) });
    for (const route of [userinfoRoute, exportRoute]) {
      const response = await post(route, grantFor(legacy));
      assert.equal(response.status, 422);
      assert.deepEqual(await response.json(), { error: 'unsupported_account' });
    }
    assert.equal((await post(exportRoute, grantFor({ id: 'no-such-user', tokenVersion: 0 }))).status, 400);
  });

  test('exports are rate limited per account and the endpoints disappear when the feature is off', async () => {
    const user = makeUser();
    for (let index = 0; index < 5; index += 1) assert.equal((await post(exportRoute, grantFor(user))).status, 200, `export ${index + 1}`);
    const limited = await post(exportRoute, grantFor(user));
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));

    const saved = process.env.NOURILEDGER_ORIGIN;
    delete process.env.NOURILEDGER_ORIGIN;
    try {
      const other = makeUser();
      for (const route of [userinfoRoute, exportRoute]) {
        const response = await post(route, grantFor(other));
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { error: 'not_found' });
      }
    } finally { process.env.NOURILEDGER_ORIGIN = saved; }
  });
}
