// tests/lib/appleLinkFlow.test.ts — Apple 帳號連結／解除流程的測試
//
// 分成兩部分：
// 1. state 層（不需要資料庫）：驗證 link 流程的 state 綁定規則，
//    也就是「A 帳號簽發的 state 不能用在 B 帳號上」。
// 2. 路由層（需要 PostgreSQL）：實際呼叫 link-apple／unlink-apple 端點，
//    驗證綁定、拒絕重複綁定、解除時必須保留另一種登入方式。
//
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/appleLinkFlow.test.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';

const { issueAppleOAuthState, consumeAppleOAuthStateEntry } = await import(
  '../../lib/appleOAuthState.ts'
);

test('link 流程的 state 綁定 userId，且不可重複使用', () => {
  const issued = issueAppleOAuthState('link', { userId: 'user-a' });
  assert.ok(issued.state);
  assert.ok(issued.bindingToken);
  assert.ok(issued.nonce);

  const entry = consumeAppleOAuthStateEntry(issued.state);
  assert.ok(entry, '第一次消費應成功');
  assert.equal(entry!.flow, 'link');
  assert.equal(entry!.userId, 'user-a');
  assert.equal(entry!.bindingToken, issued.bindingToken);
  assert.equal(entry!.nonce, issued.nonce);

  // 單次使用：同一個 state 第二次消費必須失敗。
  assert.equal(consumeAppleOAuthStateEntry(issued.state), null);
});

test('login 流程的 state 不帶 userId', () => {
  const issued = issueAppleOAuthState('login');
  const entry = consumeAppleOAuthStateEntry(issued.state);
  assert.ok(entry);
  assert.equal(entry!.flow, 'login');
  assert.equal(entry!.userId, null);
});

test('link 流程未指定 userId 時不綁定任何人', () => {
  const issued = issueAppleOAuthState('link');
  const entry = consumeAppleOAuthStateEntry(issued.state);
  assert.ok(entry);
  assert.equal(entry!.flow, 'link');
  assert.equal(entry!.userId, null);
});

test('不同帳號的 state 各自獨立', () => {
  const a = issueAppleOAuthState('link', { userId: 'user-a' });
  const b = issueAppleOAuthState('link', { userId: 'user-b' });

  const entryB = consumeAppleOAuthStateEntry(b.state);
  assert.equal(entryB!.userId, 'user-b');

  // A 的 state 仍可正常使用，但綁的是 A 自己。
  const entryA = consumeAppleOAuthStateEntry(a.state);
  assert.equal(entryA!.userId, 'user-a');
  assert.notEqual(entryA!.bindingToken, entryB!.bindingToken);
});

test('非法的 state 值一律被拒絕', () => {
  assert.equal(consumeAppleOAuthStateEntry(null), null);
  assert.equal(consumeAppleOAuthStateEntry(undefined), null);
  assert.equal(consumeAppleOAuthStateEntry(''), null);
  assert.equal(consumeAppleOAuthStateEntry('short'), null);
  assert.equal(consumeAppleOAuthStateEntry('x'.repeat(500)), null);
  assert.equal(consumeAppleOAuthStateEntry('a'.repeat(64)), null);
});

// ── 路由層（需要 PostgreSQL）────────────────────────────────
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('appleLinkFlow 路由（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');

  // 本機 JWKS 伺服器：讓簽章驗證走真實的「取金鑰 → 找 kid → 驗簽章」路徑。
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const KID = 'test-key-link';
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  const jwksServer = http.createServer((req, res) => {
    if (req.url === '/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }],
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) =>
    jwksServer.listen(0, '127.0.0.1', resolve),
  );
  const address = jwksServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  // lib/appleOAuth.ts 在模組載入時讀取這些環境變數，因此必須在 import
  // 路由之前設定。
  process.env.APPLE_JWKS_URL = `http://127.0.0.1:${port}/jwks`;
  process.env.APPLE_CLIENT_ID =
    process.env.APPLE_CLIENT_ID || 'com.assetpilot.assetpilot';

  const linkRoute = await import('../../app/api/account/link-apple/route.ts');
  const unlinkRoute = await import('../../app/api/account/unlink-apple/route.ts');

  await initDB();
  const db = getDB();

  function base64Url(input: Buffer | string): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function makeIdentityToken(overrides: {
    sub?: string;
    aud?: string;
    nonce?: string;
    email?: string;
  } = {}): string {
    const header = { alg: 'RS256', kid: KID, typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://appleid.apple.com',
      aud:
        overrides.aud ??
        process.env.APPLE_CLIENT_ID ??
        'com.assetpilot.assetpilot',
      exp: now + 600,
      iat: now,
      sub: overrides.sub ?? 'apple-sub-link-test',
      nonce: overrides.nonce ?? '',
      email: overrides.email ?? 'link-test@example.com',
      email_verified: true,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(
      JSON.stringify(payload),
    )}`;
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `${signingInput}.${signature}`;
  }

  const APPLE_USER = `t_apple_link_${uid()}`;
  const OTHER_USER = `t_apple_other_${uid()}`;

  const linkRequest = (token: string, body: unknown) =>
    new NextRequest('http://localhost/api/account/link-apple', {
      method: 'POST',
      headers: {
        Cookie: `authToken=${token}`,
        Origin: 'http://localhost',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  const unlinkRequest = (token: string) =>
    new NextRequest('http://localhost/api/account/unlink-apple', {
      method: 'POST',
      headers: {
        Cookie: `authToken=${token}`,
        Origin: 'http://localhost',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

  const anonymousRequest = (path: string) =>
    new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

  test('appleLinkFlow 路由整合驗證', async (t) => {
    t.after(async () => {
      db.run('DELETE FROM users WHERE id = ? OR id = ?', [
        APPLE_USER,
        OTHER_USER,
      ]);
      await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    });

    // 建立兩位使用者。
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
      [APPLE_USER, 'link-a@example.com', '', 'A', Date.now()],
    );
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
      [OTHER_USER, 'link-b@example.com', '', 'B', Date.now()],
    );
    const tokenA = createLoginSession(APPLE_USER, 0, {}).token;
    const tokenB = createLoginSession(OTHER_USER, 0, {}).token;

    await t.test('缺少 identity token 時回 400', async () => {
      const res = await linkRoute.POST(linkRequest(tokenA, { state: 'x' }));
      assert.equal(res.status, 400);
    });

    await t.test('state 不存在時回 400', async () => {
      const res = await linkRoute.POST(
        linkRequest(tokenA, {
          identityToken: makeIdentityToken(),
          state: 'n'.repeat(32),
          bindingToken: 'b'.repeat(48),
        }),
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'state_mismatch');
    });

    await t.test('bindingToken 不符時回 400', async () => {
      const issued = issueAppleOAuthState('link', { userId: APPLE_USER });
      const res = await linkRoute.POST(
        linkRequest(tokenA, {
          identityToken: makeIdentityToken({ nonce: issued.nonce }),
          state: issued.state,
          bindingToken: 'wrong-binding-token',
        }),
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'state_mismatch');
    });

    await t.test('A 帳號的 state 不能用在 B 帳號上', async () => {
      const issued = issueAppleOAuthState('link', { userId: APPLE_USER });
      const res = await linkRoute.POST(
        linkRequest(tokenB, {
          identityToken: makeIdentityToken({ nonce: issued.nonce }),
          state: issued.state,
          bindingToken: issued.bindingToken,
        }),
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'state_mismatch');
    });

    await t.test('login 流程的 state 不能用於 link', async () => {
      const issued = issueAppleOAuthState('login');
      const res = await linkRoute.POST(
        linkRequest(tokenA, {
          identityToken: makeIdentityToken({ nonce: issued.nonce }),
          state: issued.state,
          bindingToken: issued.bindingToken,
        }),
      );
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'state_mismatch');
    });

    await t.test('正確流程可綁定，且 Apple 身分不能被第二個帳號搶走', async () => {
      const issued = issueAppleOAuthState('link', { userId: APPLE_USER });
      const res = await linkRoute.POST(
        linkRequest(tokenA, {
          identityToken: makeIdentityToken({ nonce: issued.nonce }),
          state: issued.state,
          bindingToken: issued.bindingToken,
        }),
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.appleEmail, 'link-test@example.com');

      const row = queryOne('SELECT apple_id FROM users WHERE id = ?', [
        APPLE_USER,
      ]);
      assert.equal(row?.apple_id, 'apple-sub-link-test');

      // B 帳號想綁同一個 Apple 身分 → 拒絕。
      const issued2 = issueAppleOAuthState('link', { userId: OTHER_USER });
      const res2 = await linkRoute.POST(
        linkRequest(tokenB, {
          identityToken: makeIdentityToken({ nonce: issued2.nonce }),
          state: issued2.state,
          bindingToken: issued2.bindingToken,
        }),
      );
      assert.equal(res2.status, 400);
    });

    await t.test('未登入時回 401', async () => {
      const res = await linkRoute.POST(
        anonymousRequest('/api/account/link-apple'),
      );
      assert.equal(res.status, 401);
    });

    await t.test('解除綁定前必須保留另一種登入方式', async () => {
      // A 目前只有 Apple 一種登入方式 → 拒絕解除。
      const res = await unlinkRoute.POST(unlinkRequest(tokenA));
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(String(data.error), /至少保留一種/);

      // 加上 Passkey 後可解除。
      db.run(
        'INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, counter, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [`cred-${uid()}`, APPLE_USER, 'pk', 'ES256', 0, Date.now()],
      );
      const res2 = await unlinkRoute.POST(unlinkRequest(tokenA));
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.success, true);

      const row = queryOne('SELECT apple_id FROM users WHERE id = ?', [
        APPLE_USER,
      ]);
      assert.equal(row?.apple_id, '');
    });

    await t.test('未綁定時解除回 400', async () => {
      const res = await unlinkRoute.POST(unlinkRequest(tokenB));
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, '尚未綁定 Apple 帳號');
    });

    await t.test('未登入時解除回 401', async () => {
      const res = await unlinkRoute.POST(
        anonymousRequest('/api/account/unlink-apple'),
      );
      assert.equal(res.status, 401);
    });
  });
}
