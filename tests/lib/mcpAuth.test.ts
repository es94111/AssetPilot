// tests/lib/mcpAuth.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過），設定時執行完整驗證。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/mcpAuth.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('mcpAuth（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
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
    setMcpCredentialAllowUpdateNote,
    MAX_ACTIVE_MCP_CREDENTIALS,
    McpCredentialLimitError,
  } = await import('../../lib/mcpAuth.ts');

  await initDB();

  // verifyMcpToken 現在會 JOIN users 檢查 is_active（見安全報告 AUTHZ-VULN-03：
  // 停用帳號的 MCP PAT 不應繼續有效），因此測試憑證必須綁定一筆真實存在、
  // is_active 預設為 1 的 users 列，才能驗證「有效權杖」情境。
  function createTestUser(userId: string): void {
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@test.local`, 'test', 'Test User', new Date().toISOString().slice(0, 10)]
    );
  }

  function cleanupUser(userId: string): void {
    getDB().run('DELETE FROM mcp_credentials WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM users WHERE id = ?', [userId]);
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
    createTestUser(userId);
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
    createTestUser(userId);
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
    createTestUser(userId);
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

  // ── 004-mcp-update-notes-only：allowUpdateNote 權限 ──────────────────────

  test('createMcpCredential 預設 allowUpdateNote=false（FR-006）', () => {
    const userId = 'test_mcpauth_' + uid();
    createTestUser(userId);
    try {
      const created = createMcpCredential(userId, '備註權限測試');
      const verified = verifyMcpToken(created.token);
      assert.equal(verified?.allowUpdateNote, false);
      const listed = listMcpCredentials(userId).find((c) => c.id === created.id);
      assert.equal(listed?.allowUpdateNote, false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('setMcpCredentialAllowUpdateNote 可開關並反映於 verifyMcpToken／listMcpCredentials', () => {
    const userId = 'test_mcpauth_' + uid();
    createTestUser(userId);
    try {
      const created = createMcpCredential(userId, '備註權限切換');
      assert.equal(verifyMcpToken(created.token)?.allowUpdateNote, false);

      const opened = setMcpCredentialAllowUpdateNote(userId, created.id, true);
      assert.equal(opened, true);
      assert.equal(verifyMcpToken(created.token)?.allowUpdateNote, true);
      assert.equal(listMcpCredentials(userId).find((c) => c.id === created.id)?.allowUpdateNote, true);

      const closed = setMcpCredentialAllowUpdateNote(userId, created.id, false);
      assert.equal(closed, true);
      assert.equal(verifyMcpToken(created.token)?.allowUpdateNote, false);
      assert.equal(listMcpCredentials(userId).find((c) => c.id === created.id)?.allowUpdateNote, false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('權限獨立性：開 allowUpdateNote 不影響 allowCreate，反之亦然（FR-005）', () => {
    const userId = 'test_mcpauth_' + uid();
    createTestUser(userId);
    try {
      const created = createMcpCredential(userId, '獨立權限');

      // 只開 allowUpdateNote —— allowCreate 仍為 false
      setMcpCredentialAllowUpdateNote(userId, created.id, true);
      assert.equal(verifyMcpToken(created.token)?.allowUpdateNote, true);
      assert.equal(verifyMcpToken(created.token)?.allowCreate, false);

      // 只開 allowCreate —— allowUpdateNote 仍為 false（另一組憑證）
      const other = createMcpCredential(userId, '獨立權限2');
      setMcpCredentialAllowCreate(userId, other.id, true);
      assert.equal(verifyMcpToken(other.token)?.allowCreate, true);
      assert.equal(verifyMcpToken(other.token)?.allowUpdateNote, false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('關閉 allowUpdateNote 不回溯影響已更新的備註（US2 Acceptance Scenario 3、FR-007）', () => {
    const userId = 'test_mcpauth_' + uid();
    const txId = 'test_mcpnote_tx_' + uid();
    try {
      const created = createMcpCredential(userId, '關閉不回溯');
      // 模擬先前已透過 update_transaction_note 成功更新過備註（直接以 SQL 設值，不需呼叫 MCP 工具）
      getDB().run(
        'INSERT INTO transactions (id, user_id, type, amount, date, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [txId, userId, 'expense', 100, '2026-08-10', '先前已更新的備註', Date.now(), Date.now()]
      );

      // 關閉權限
      const closed = setMcpCredentialAllowUpdateNote(userId, created.id, false);
      assert.equal(closed, true);

      // 備註與關閉前完全相同（未被回溯）
      const row = queryOne('SELECT note FROM transactions WHERE id = ?', [txId]) as { note: string } | null;
      assert.equal(row?.note, '先前已更新的備註');
    } finally {
      getDB().run('DELETE FROM transactions WHERE user_id = ?', [userId]);
      cleanupUser(userId);
    }
  });

  test('帳號被停用（is_active=0）後，其原本有效的 MCP PAT 應立即失效（AUTHZ-VULN-03）', () => {
    const userId = 'test_mcpauth_' + uid();
    createTestUser(userId);
    try {
      const created = createMcpCredential(userId, '停用帳號測試');
      assert.ok(verifyMcpToken(created.token), '停用前應可驗證通過');

      getDB().run('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
      assert.equal(verifyMcpToken(created.token), null, '停用後應立即拒絕，即使 PAT 本身未過期/未撤銷');

      getDB().run('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);
      assert.ok(verifyMcpToken(created.token), '重新啟用後應恢復可驗證');
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
