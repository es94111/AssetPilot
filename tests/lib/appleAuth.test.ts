// tests/lib/appleAuth.test.ts — Apple 登入的伺服器端驗證邏輯測試
//
// 不需要資料庫：以本機產生的 RSA 金鑰簽出 Apple 格式的 identity token，
// 走真實的 RS256 驗證路徑，確認下列安全條件成立：
//   1. 簽章有效、iss/aud/exp/nonce 皆正確時通過。
//   2. 演算法不是 RS256（alg=none / HS256 換簽）時拒絕。
//   3. aud 不符（其他 App 的 Service ID）時拒絕。
//   4. iss 不是 appleid.apple.com 時拒絕。
//   5. 過期或簽發時間過舊時拒絕。
//   6. nonce 不符時拒絕。
//   7. appleEmail() 只在 emailVerified 為真時回傳 email（Apple 隱藏 email 的情形）。
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/appleAuth.test.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test, { after, before } from 'node:test';

const { verifyAppleIdentityToken, appleEmail } = await import(
  '../../lib/appleOAuth.ts'
);

const CLIENT_ID = 'com.assetpilot.assetpilot';
const APPLE_ISSUER = 'https://appleid.apple.com';
const KID = 'test-key-1';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

type TokenOverrides = {
  alg?: string;
  kid?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  emailVerified?: boolean | string;
  sub?: string;
  signWith?: crypto.KeyObject;
};

function makeIdentityToken(overrides: TokenOverrides = {}): string {
  const header = {
    alg: overrides.alg ?? 'RS256',
    kid: overrides.kid ?? KID,
    typ: 'JWT',
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: overrides.iss ?? APPLE_ISSUER,
    aud: overrides.aud ?? CLIENT_ID,
    exp: overrides.exp ?? now + 300,
    iat: overrides.iat ?? now,
    nonce: overrides.nonce ?? 'nonce-value',
    sub: overrides.sub ?? 'apple-sub-123',
    email: overrides.email ?? 'user@example.com',
    emailVerified: overrides.emailVerified ?? true,
  };

  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = overrides.signWith ?? privateKey;

  if (overrides.alg === 'none') {
    return `${signingInput}.`;
  }

  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    signer,
  );
  return `${signingInput}.${base64Url(signature)}`;
}

// 本機 JWKS 伺服器：讓驗證流程走真實的「取金鑰 → 找 kid → 驗簽章」路徑。
let jwksServer: http.Server;
let jwksUrl = '';

before(async () => {
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  jwksServer = http.createServer((req, res) => {
    if (req.url === '/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const address = jwksServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  jwksUrl = `http://127.0.0.1:${port}/jwks`;
});

after(() => {
  jwksServer?.close();
});

async function verify(token: string, nonce = 'nonce-value') {
  return verifyAppleIdentityToken(token, {
    expectedNonce: nonce,
    clientId: CLIENT_ID,
    jwksUrl,
  });
}

test('Apple 身分令牌：簽章與各項 claims 正確時驗證通過', async () => {
  const result = await verify(makeIdentityToken());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claims.sub, 'apple-sub-123');
  assert.equal(result.claims.email, 'user@example.com');
});

test('Apple 身分令牌：alg=none 不被接受', async () => {
  const result = await verify(makeIdentityToken({ alg: 'none' }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /簽章演算法/);
});

test('Apple 身分令牌：以 HMAC 偽裝的簽章不被接受', async () => {
  // 演算法混淆攻擊：攻擊者用自己的公鑰把 header 宣告成 HS256，
  // 再以該公鑰當 HMAC key 簽署。伺服器只接受 RS256，因此直接拒絕。
  const result = await verify(makeIdentityToken({ alg: 'HS256' }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /簽章演算法/);
});

test('Apple 身分令牌：aud 指向其他 App 時拒絕', async () => {
  const result = await verify(
    makeIdentityToken({ aud: 'com.other.vendor.app' }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /受眾/);
});

test('Apple 身分令牌：iss 不是 Apple 時拒絕', async () => {
  const result = await verify(
    makeIdentityToken({ iss: 'https://evil.example.com' }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /簽發者/);
});

test('Apple 身分令牌：已過期時拒絕', async () => {
  const now = Math.floor(Date.now() / 1000);
  const result = await verify(
    makeIdentityToken({ exp: now - 60, iat: now - 600 }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /過期/);
});

test('Apple 身分令牌：簽發時間過舊（重放風險）時拒絕', async () => {
  const now = Math.floor(Date.now() / 1000);
  const result = await verify(
    makeIdentityToken({ iat: now - 30 * 60, exp: now + 300 }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /過期/);
});

test('Apple 身分令牌：nonce 不符時拒絕', async () => {
  const result = await verify(makeIdentityToken({ nonce: 'other-nonce' }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /nonce/);
});

test('Apple 身分令牌：簽章被竄改時拒絕', async () => {
  const token = makeIdentityToken();
  const parts = token.split('.');
  // 改寫 payload（sub）但沿用原簽章。
  const tamperedPayload = base64Url(
    JSON.stringify({
      iss: APPLE_ISSUER,
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      nonce: 'nonce-value',
      sub: 'attacker-sub',
    }),
  );
  const result = await verify(`${parts[0]}.${tamperedPayload}.${parts[2]}`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /簽章/);
});

test('appleEmail()：只有驗證過的 email 才回傳', () => {
  assert.equal(
    appleEmail({ sub: 'a', email: 'u@example.com', emailVerified: true }),
    'u@example.com',
  );
  assert.equal(
    appleEmail({ sub: 'a', email: 'u@example.com', emailVerified: 'true' }),
    'u@example.com',
  );
  assert.equal(
    appleEmail({ sub: 'a', email: 'u@example.com', emailVerified: false }),
    '',
  );
  assert.equal(
    appleEmail({ sub: 'a', email: 'u@example.com', emailVerified: 'false' }),
    '',
  );
  assert.equal(appleEmail({ sub: 'a' }), '');
});
