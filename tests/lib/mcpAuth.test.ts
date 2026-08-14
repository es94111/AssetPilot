// tests/lib/mcpAuth.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過），設定時執行完整驗證。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/mcpAuth.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('mcpAuth（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB } = await import('../../lib/db.ts');
  // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
  after(() => { getDB().close(); });
  const { uid } = await import('../../lib/userDefaults.ts');
  const {
    generateMcpToken,
    hashMcpToken,
    createMcpCredential,
    verifyMcpToken,
    listMcpCredentials,
    revokeMcpCredential,
    setMcpCredentialAllowCreate,
    MAX_ACTIVE_MCP_CREDENTIALS,
    McpCredentialLimitError,
  } = await import('../../lib/mcpAuth.ts');

  await initDB();

  function cleanupUser(userId: string): void {
    getDB().run('DELETE FROM mcp_credentials WHERE user_id = ?', [userId]);
  }

  test('generateMcpToken 產生 ap_mcp_ 前綴的高熵權杖', () => {
    const token = generateMcpToken();
    assert.ok(token.startsWith('ap_mcp_'));
    assert.ok(token.length > 40);
    assert.notEqual(token, generateMcpToken());
  });

  test('hashMcpToken 對相同明文具決定性，可用於雜湊索引查找', () => {
    const token = generateMcpToken();
    assert.equal(hashMcpToken(token), hashMcpToken(token));
    assert.notEqual(hashMcpToken(token), hashMcpToken(generateMcpToken()));
  });

  test('createMcpCredential 建立後 verifyMcpToken 可查找並更新 last_used_at', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      const created = createMcpCredential(userId, '我的 ChatGPT');
      assert.ok(created.token.startsWith('ap_mcp_'));

      const result = verifyMcpToken(created.token);
      assert.ok(result);
      assert.equal(result?.userId, userId);
      assert.equal(result?.credentialId, created.id);
      assert.equal(result?.name, '我的 ChatGPT');

      const list = listMcpCredentials(userId);
      const found = list.find((c) => c.id === created.id);
      assert.ok(found);
      assert.equal(found?.status, 'active');
      assert.ok((found?.lastUsedAt || 0) > 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('verifyMcpToken 對不存在的權杖回傳 null', () => {
    assert.equal(verifyMcpToken('ap_mcp_not-a-real-token'), null);
  });

  test('revokeMcpCredential 撤銷後 verifyMcpToken 回傳 null，且再次撤銷回傳 false', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      const created = createMcpCredential(userId, '測試撤銷');
      assert.ok(verifyMcpToken(created.token));

      const revoked = revokeMcpCredential(userId, created.id);
      assert.equal(revoked, true);
      assert.equal(verifyMcpToken(created.token), null);

      const secondRevoke = revokeMcpCredential(userId, created.id);
      assert.equal(secondRevoke, false);

      const list = listMcpCredentials(userId);
      const found = list.find((c) => c.id === created.id);
      assert.equal(found?.status, 'revoked');
    } finally {
      cleanupUser(userId);
    }
  });

  test('已到期憑證 verifyMcpToken 回傳 null，listMcpCredentials 顯示 expired', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      const past = Date.now() - 1000;
      const created = createMcpCredential(userId, '已過期', past);
      assert.equal(verifyMcpToken(created.token), null);

      const list = listMcpCredentials(userId);
      const found = list.find((c) => c.id === created.id);
      assert.equal(found?.status, 'expired');
    } finally {
      cleanupUser(userId);
    }
  });

  test('createMcpCredential 預設 allowCreate=false，setMcpCredentialAllowCreate 可開關並反映於 verifyMcpToken／listMcpCredentials', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      const created = createMcpCredential(userId, '寫入權限測試');

      const verifiedBefore = verifyMcpToken(created.token);
      assert.equal(verifiedBefore?.allowCreate, false);
      const listedBefore = listMcpCredentials(userId).find((c) => c.id === created.id);
      assert.equal(listedBefore?.allowCreate, false);

      const opened = setMcpCredentialAllowCreate(userId, created.id, true);
      assert.equal(opened, true);
      const verifiedOpen = verifyMcpToken(created.token);
      assert.equal(verifiedOpen?.allowCreate, true);
      const listedOpen = listMcpCredentials(userId).find((c) => c.id === created.id);
      assert.equal(listedOpen?.allowCreate, true);

      const closed = setMcpCredentialAllowCreate(userId, created.id, false);
      assert.equal(closed, true);
      const verifiedClosed = verifyMcpToken(created.token);
      assert.equal(verifiedClosed?.allowCreate, false);
      const listedClosed = listMcpCredentials(userId).find((c) => c.id === created.id);
      assert.equal(listedClosed?.allowCreate, false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('setMcpCredentialAllowCreate 對不存在或非本人的憑證回傳 false', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      assert.equal(setMcpCredentialAllowCreate(userId, 'not-a-real-id', true), false);

      const otherUserId = 'test_mcpauth_' + uid();
      const created = createMcpCredential(otherUserId, '別人的憑證');
      try {
        assert.equal(setMcpCredentialAllowCreate(userId, created.id, true), false);
      } finally {
        cleanupUser(otherUserId);
      }
    } finally {
      cleanupUser(userId);
    }
  });

  test('達 20 組啟用中憑證上限時 createMcpCredential 拒絕建立', () => {
    const userId = 'test_mcpauth_' + uid();
    try {
      for (let i = 0; i < MAX_ACTIVE_MCP_CREDENTIALS; i++) {
        createMcpCredential(userId, `憑證 ${i}`);
      }
      assert.throws(() => createMcpCredential(userId, '超過上限'), McpCredentialLimitError);
    } finally {
      cleanupUser(userId);
    }
  });
}
