// tests/lib/apiTokenCore.test.ts — API Token／Webhook 核心純函式測試（issue #258）
// 刻意不加 DATABASE_URL 略過守衛：本檔只測 lib/apiTokenCore.ts 的零相依函式，
// 因此在沒有 PostgreSQL 的環境也能驗證（與 transactionEditRules.test.ts 相同策略）。
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  API_TOKEN_PREFIX,
  WEBHOOK_SECRET_PREFIX,
  API_TOKEN_SCOPES,
  WEBHOOK_EVENTS,
  MAX_DELIVERY_ATTEMPTS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  ApiTokenError,
  generateApiToken,
  hashApiToken,
  generateWebhookSecret,
  parseApiTokenScopes,
  hasScope,
  parseWebhookEvents,
  validateWebhookUrl,
  encryptSecret,
  decryptSecret,
  buildSignaturePayload,
  signWebhookPayload,
  verifyWebhookSignature,
  retryDelayMs,
  nextRetryAt,
  isRetryableStatus,
} from '../../lib/apiTokenCore.ts';

const MASTER = 'test-master-secret-for-webhook-encryption';

test('generateApiToken 產生 ap_api_ 前綴的高熵權杖，且每次不同', () => {
  const token = generateApiToken();
  assert.ok(token.startsWith(API_TOKEN_PREFIX));
  assert.ok(token.length > 40);
  assert.notEqual(token, generateApiToken());
});

test('hashApiToken 具決定性（可供雜湊索引查找），且不同權杖雜湊不同', () => {
  const token = generateApiToken();
  const hash = hashApiToken(token);
  assert.equal(hashApiToken(token), hash);
  assert.notEqual(hashApiToken(token), hashApiToken(generateApiToken()));
  // 雜湊為 sha256 hex，且等於 sha256(明文)（儲存的是雜湊而不是明文）
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, crypto.createHash('sha256').update(token).digest('hex'));
  // 明文一旦落成雜湊即不可回復：sha256(雜湊) 與雜湊不同，也不會命中任何權杖
  assert.notEqual(hashApiToken(hash), hash);
  assert.equal(hashApiToken(hash), hashApiToken(hashApiToken(token)));
});

test('generateWebhookSecret 產生 whsec_ 前綴密鑰', () => {
  const secret = generateWebhookSecret();
  assert.ok(secret.startsWith(WEBHOOK_SECRET_PREFIX));
  assert.notEqual(secret, generateWebhookSecret());
});

test('parseApiTokenScopes 接受陣列與空白分隔字串並去除重複', () => {
  assert.deepEqual(parseApiTokenScopes(['transactions:read']), ['transactions:read']);
  assert.deepEqual(
    parseApiTokenScopes('transactions:read transactions:write transactions:read'),
    ['transactions:read', 'transactions:write'],
  );
  assert.deepEqual(parseApiTokenScopes([...API_TOKEN_SCOPES]), [...API_TOKEN_SCOPES]);
});

test('parseApiTokenScopes 對空值與未知 scope 拋出 ApiTokenError', () => {
  assert.throws(() => parseApiTokenScopes([]), ApiTokenError);
  assert.throws(() => parseApiTokenScopes(''), ApiTokenError);
  assert.throws(() => parseApiTokenScopes(['admin:all']), (e: unknown) => {
    assert.ok(e instanceof ApiTokenError);
    assert.equal(e.code, 'InvalidScope');
    return true;
  });
});

test('hasScope 僅在使用者授予時回傳 true', () => {
  assert.equal(hasScope(['transactions:read'], 'transactions:read'), true);
  assert.equal(hasScope(['transactions:read'], 'transactions:write'), false);
  assert.equal(hasScope([], 'transactions:read'), false);
});

test('parseWebhookEvents 預設訂閱全部事件，並可指定子集', () => {
  assert.deepEqual(parseWebhookEvents(undefined), [...WEBHOOK_EVENTS]);
  assert.deepEqual(parseWebhookEvents(['transaction.created']), ['transaction.created']);
  assert.deepEqual(
    parseWebhookEvents('transaction.created transaction.deleted'),
    ['transaction.created', 'transaction.deleted'],
  );
  assert.throws(() => parseWebhookEvents(['transaction.archived']), ApiTokenError);
});

test('validateWebhookUrl 只接受 HTTPS 公開網址（避免 SSRF 與明文傳輸）', () => {
  assert.equal(validateWebhookUrl('https://example.com/hooks'), 'https://example.com/hooks');
  for (const bad of [
    'http://example.com/hooks',
    'https://localhost/hooks',
    'https://localhost.localdomain/hooks',
    'https://foo.localhost/hooks',
    'https://internal.local/hooks',
    'https://127.0.0.1/hooks',
    'https://127.1.2.3/hooks',
    'https://0.0.0.0/hooks',
    'https://0.1.2.3/hooks',
    'https://10.0.0.5/hooks',
    'https://192.168.1.10/hooks',
    'https://172.16.0.1/hooks',
    'https://172.31.255.254/hooks',
    'https://100.64.0.1/hooks',
    'https://169.254.169.254/latest/meta-data',
    'https://198.18.0.1/hooks',
    'https://240.0.0.1/hooks',
    'https://255.255.255.255/hooks',
    'https://[::1]/hooks',
    'https://[::]/hooks',
    'https://[fe80::1]/hooks',
    'https://[fd00::1]/hooks',
    'https://[::ffff:127.0.0.1]/hooks',
    'https://[::ffff:0:127.0.0.1]/hooks',
    'https://[64:ff9b::7f00:1]/hooks',
    'https://[2002:7f00:1::]/hooks',
    'https://[2002:a9fe:a9fe::]/hooks',
    'https://localhost./hooks',
    'https://LOCALHOST./hooks',
    'https://foo.localhost./hooks',
    'https://internal.local./hooks',
    'https://user:pass@example.com/hooks',
    'not-a-url',
    '',
    null,
  ]) {
    assert.throws(() => validateWebhookUrl(bad), ApiTokenError, `應拒絕：${String(bad)}`);
  }
  // 公開位址仍須放行（避免過度封鎖）
  assert.equal(validateWebhookUrl('https://8.8.8.8/hooks'), 'https://8.8.8.8/hooks');
  assert.equal(validateWebhookUrl('https://[2001:4860:4860::8888]/hooks'), 'https://[2001:4860:4860::8888]/hooks');
  // 6to4／NAT64 指向公開位址時亦須放行
  assert.ok(validateWebhookUrl('https://[2002:0808:0808::]/hooks'));
  assert.ok(validateWebhookUrl('https://[64:ff9b::808:808]/hooks'));
  // 一般公開網域的尾端點（FQDN 寫法）仍可通過
  assert.ok(validateWebhookUrl('https://example.com./hooks'));
});

test('encryptSecret／decryptSecret 可往返，且密文不含明文', () => {
  const secret = generateWebhookSecret();
  const encrypted = encryptSecret(secret, MASTER);
  assert.ok(!encrypted.includes(secret));
  assert.equal(decryptSecret(encrypted, MASTER), secret);
  // 同一明文每次加密的密文不同（隨機 IV）
  assert.notEqual(encryptSecret(secret, MASTER), encrypted);
});

test('decryptSecret 對錯誤主密鑰或竄改密文拋出錯誤（不可靜默回傳）', () => {
  const encrypted = encryptSecret('secret-value', MASTER);
  assert.throws(() => decryptSecret(encrypted, 'another-master'));
  assert.throws(() => decryptSecret('not-a-valid-payload', MASTER));
  // 竄改密文（GCM tag 驗證必須失敗，而非回傳錯值）
  const [iv, tag, data] = encrypted.split('.');
  const flipped = Buffer.from(data, 'base64');
  flipped[0] = flipped[0] ^ 0xff;
  assert.throws(() => decryptSecret(`${iv}.${tag}.${flipped.toString('base64')}`, MASTER));
});

test('signWebhookPayload 產生 t／v1 格式簽章，且可被 verifyWebhookSignature 驗證', () => {
  const secret = generateWebhookSecret();
  const body = JSON.stringify({ id: 'evt_1', type: 'transaction.created' });
  const now = Math.floor(Date.now() / 1000);
  const header = signWebhookPayload(secret, body, now);

  assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
  assert.ok(header.includes(`t=${now}`));
  assert.equal(verifyWebhookSignature(secret, body, header, { now }), true);
  // 簽章內容為 `${timestamp}.${body}`
  assert.ok(buildSignaturePayload(now, body).startsWith(`${now}.`));
});

test('verifyWebhookSignature 拒絕竄改的內容、錯誤密鑰與過期時間戳', () => {
  const secret = generateWebhookSecret();
  const body = JSON.stringify({ amount: 100 });
  const now = Math.floor(Date.now() / 1000);
  const header = signWebhookPayload(secret, body, now);

  assert.equal(verifyWebhookSignature(secret, JSON.stringify({ amount: 999 }), header, { now }), false);
  assert.equal(verifyWebhookSignature(generateWebhookSecret(), body, header, { now }), false);
  assert.equal(verifyWebhookSignature(secret, body, 'garbage', { now }), false);
  assert.equal(verifyWebhookSignature(secret, body, '', { now }), false);
  // 超過容忍範圍（重放攻擊）
  const stale = now - WEBHOOK_SIGNATURE_TOLERANCE_SECONDS - 1;
  const staleHeader = signWebhookPayload(secret, body, stale);
  assert.equal(verifyWebhookSignature(secret, body, staleHeader, { now }), false);
});

test('retryDelayMs 呈指數退避且有上限', () => {
  assert.equal(retryDelayMs(1), RETRY_BASE_MS);
  assert.equal(retryDelayMs(2), RETRY_BASE_MS * 4);
  assert.equal(retryDelayMs(3), RETRY_BASE_MS * 16);
  assert.equal(retryDelayMs(10), RETRY_MAX_MS);
});

test('nextRetryAt 在達到最大嘗試次數後回傳 null（不再重試）', () => {
  const now = 1_700_000_000_000;
  assert.equal(nextRetryAt(1, now), now + RETRY_BASE_MS);
  assert.equal(nextRetryAt(MAX_DELIVERY_ATTEMPTS, now), null);
  assert.equal(nextRetryAt(MAX_DELIVERY_ATTEMPTS + 1, now), null);
});

test('isRetryableStatus 只重試 429 與 5xx', () => {
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(200), false);
  // 網路錯誤（無狀態碼，以 0 表示）視為可重試
  assert.equal(isRetryableStatus(0), true);
});
