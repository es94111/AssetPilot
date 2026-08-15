// tests/lib/transactionRestore.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 005-mcp-transaction-restore 的兩個還原端點：
//   POST /api/transactions/{id}/restore-ai-created（還原 AI 建立＝級聯刪除）
//   POST /api/transactions/{id}/restore-ai-note（還原備註，含樂觀鎖重新驗證）
// 涵蓋成功／失敗路徑、連動群組整組移除、稽核紀錄寫入與不含備註全文（FR-011、FR-012）。
// 比照 transactionsManualEdit.test.ts 的 authedRequest() 固定寫法（createLoginSession + NextRequest）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/transactionRestore.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('transactionRestore（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const restoreCreatedRoute = await import('../../app/api/transactions/[txId]/restore-ai-created/route.ts');
  const restoreNoteRoute = await import('../../app/api/transactions/[txId]/restore-ai-note/route.ts');

  await initDB();

  const userId = 'test_txrestore_' + uid();
  const otherUserId = 'test_txrestore_other_' + uid();
  const accountId = uid();
  const otherAccountId = uid();

  // 前置資料交易 id
  let aiCreatedTxId = '';
  let transferOutTxId = '';
  let transferInTxId = '';
  let manualTxId = '';
  let noteModifiedTxId = '';
  let noteNotModifiedTxId = '';
  let noteModifiedForGetTxId = '';
  let otherUserTxId = '';

  function authedRequest(method: string, url: string, body?: unknown) {
    const { token } = createLoginSession(userId, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}` };
    if (method !== 'GET') headers.Origin = new URL(url).origin; // CSRF 檢查要求 Origin 與 request URL 同源
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    const nowMs = Date.now();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now]
    );
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [otherUserId, `${otherUserId}@example.com`, 'x', '另一個測試使用者', now]
    );
    db.run(
      'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
      [accountId, userId, '測試帳戶', 'TWD', now]
    );
    db.run(
      'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
      [otherAccountId, otherUserId, '另一使用者帳戶', 'TWD', now]
    );

    // (a) 一筆 ai_created=1 的一般交易
    aiCreatedTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, ai_created, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [aiCreatedTxId, userId, 'expense', 100, 'TWD', '2026-08-10', accountId, 'AI 建立', 1, nowMs, nowMs]
    );

    // (b) 一組轉帳兩腳（linked_id 互相指向，皆 ai_created=1）
    transferOutTxId = uid();
    transferInTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, linked_id, ai_created, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [transferOutTxId, userId, 'transfer_out', 200, 'TWD', '2026-08-11', accountId, '轉出', transferInTxId, 1, nowMs, nowMs]
    );
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, linked_id, ai_created, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [transferInTxId, userId, 'transfer_in', 200, 'TWD', '2026-08-11', accountId, '轉入', transferOutTxId, 1, nowMs, nowMs]
    );

    // (c) 一筆 ai_created=0 的手動交易
    manualTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, ai_created, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [manualTxId, userId, 'expense', 50, 'TWD', '2026-08-12', accountId, '手動', 0, nowMs, nowMs]
    );

    // (a) 一筆 note_ai_modified=1 且帶 pre_ai_note 快照的交易
    noteModifiedTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, note_ai_modified, pre_ai_note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [noteModifiedTxId, userId, 'expense', 80, 'TWD', '2026-08-13', accountId, 'AI 改過的備註', 1, '修改前的備註', nowMs, nowMs]
    );

    // (d) 一筆 note_ai_modified=0 的交易
    noteNotModifiedTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, note_ai_modified, pre_ai_note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [noteNotModifiedTxId, userId, 'expense', 30, 'TWD', '2026-08-14', accountId, '普通備註', 0, '', nowMs, nowMs]
    );

    // GET 預覽測試專用：一筆仍為 note_ai_modified=1 的交易（POST 測試 (a) 已還原 noteModifiedTxId）
    noteModifiedForGetTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, note_ai_modified, pre_ai_note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [noteModifiedForGetTxId, userId, 'expense', 90, 'TWD', '2026-08-16', accountId, '目前備註內容', 1, '修改前原文', nowMs, nowMs]
    );

    // (d) 另一個使用者的交易（404 非本人）
    otherUserTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, ai_created, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [otherUserTxId, otherUserId, 'expense', 999, 'TWD', '2026-08-15', otherAccountId, '他人的交易', 1, nowMs, nowMs]
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM login_sessions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [otherUserId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [otherUserId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [otherUserId]);
    db.close();
  });

  // ── POST .../restore-ai-created ──────────────────────────────────────

  test('restore-ai-created (a) 對 ai_created=1 的一般交易成功還原，回應 removedIds 含該 id，列從資料庫消失', async () => {
    const res = await restoreCreatedRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${aiCreatedTxId}/restore-ai-created`),
      { params: Promise.resolve({ txId: aiCreatedTxId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.removedIds, [aiCreatedTxId]);
    const row = queryOne('SELECT id FROM transactions WHERE id = ?', [aiCreatedTxId]);
    assert.equal(row, null);
  });

  test('restore-ai-created (b) 對轉帳其中一腳還原，removedIds 含兩個 id，兩腳皆消失', async () => {
    const res = await restoreCreatedRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${transferOutTxId}/restore-ai-created`),
      { params: Promise.resolve({ txId: transferOutTxId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.removedIds, [transferOutTxId, transferInTxId]);
    assert.equal(queryOne('SELECT id FROM transactions WHERE id = ?', [transferOutTxId]), null);
    assert.equal(queryOne('SELECT id FROM transactions WHERE id = ?', [transferInTxId]), null);
  });

  test('restore-ai-created (c) 對 ai_created=0 的交易回傳 409 NotRestorable，交易不受影響', async () => {
    const res = await restoreCreatedRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${manualTxId}/restore-ai-created`),
      { params: Promise.resolve({ txId: manualTxId }) }
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'NotRestorable');
    const row = queryOne('SELECT id FROM transactions WHERE id = ?', [manualTxId]);
    assert.ok(row, '交易應仍存在');
  });

  test('restore-ai-created (d) 對不存在或非本人的交易 id 回傳 404', async () => {
    const missing = await restoreCreatedRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/nonexistent_${uid()}/restore-ai-created`),
      { params: Promise.resolve({ txId: 'nonexistent_' + uid() }) }
    );
    assert.equal(missing.status, 404);

    const notOwned = await restoreCreatedRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${otherUserTxId}/restore-ai-created`),
      { params: Promise.resolve({ txId: otherUserTxId }) }
    );
    assert.equal(notOwned.status, 404);
    assert.ok(queryOne('SELECT id FROM transactions WHERE id = ?', [otherUserTxId]), '他人交易不應被刪除');
  });

  test('restore-ai-created (e) 成功還原後稽核出現 restore_ai_created_transaction，metadata 含 transaction_id／linked_transaction_id；失敗嘗試不留稽核', async () => {
    // 成功案例（轉帳整組）已於 (b) 執行，查稽核
    const auditRow = queryOne(
      "SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'restore_ai_created_transaction' AND result = 'success' ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );
    assert.ok(auditRow, '應查得 restore_ai_created_transaction 稽核紀錄');
    const metadata = JSON.parse(String(auditRow?.metadata));
    assert.equal(metadata.transaction_id, transferOutTxId);
    assert.equal(metadata.linked_transaction_id, transferInTxId);

    // (c)(d) 的失敗嘗試不應新增稽核；(a)(b) 兩次成功各留一筆，共 2 筆
    const count = Number(queryOne(
      "SELECT COUNT(*) AS cnt FROM data_operation_audit_log WHERE user_id = ? AND action = 'restore_ai_created_transaction'",
      [userId]
    )?.cnt) || 0;
    assert.equal(count, 2, '僅成功還原應留下 2 筆稽核（(a) 一般交易與 (b) 轉帳各一筆）');
  });

  // ── POST .../restore-ai-note ─────────────────────────────────────────

  test('restore-ai-note (a) 對 note_ai_modified=1 的交易帶正確 expectedUpdatedAt 成功還原，note 變回 pre_ai_note，回應含新 updatedAt，DB 旗標清除', async () => {
    const before = queryOne('SELECT updated_at FROM transactions WHERE id = ?', [noteModifiedTxId]);
    const res = await restoreNoteRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${noteModifiedTxId}/restore-ai-note`, { expectedUpdatedAt: Number(before?.updated_at) }),
      { params: Promise.resolve({ txId: noteModifiedTxId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.note, '修改前的備註');
    assert.ok(body.updatedAt > 0);

    const row = queryOne('SELECT note, note_ai_modified, pre_ai_note, updated_at FROM transactions WHERE id = ?', [noteModifiedTxId]);
    assert.equal(row?.note, '修改前的備註');
    assert.equal(Number(row?.note_ai_modified), 0);
    assert.equal(row?.pre_ai_note, '');
    assert.equal(Number(row?.updated_at), body.updatedAt);
  });

  test('restore-ai-note (b) 缺 expectedUpdatedAt 回傳 400', async () => {
    const res = await restoreNoteRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${noteNotModifiedTxId}/restore-ai-note`, {}),
      { params: Promise.resolve({ txId: noteNotModifiedTxId }) }
    );
    assert.equal(res.status, 400);
  });

  test('restore-ai-note (c) 帶錯誤（過期）的 expectedUpdatedAt 回傳 409 NoteChanged，資料不變', async () => {
    const before = queryOne('SELECT note, note_ai_modified, pre_ai_note, updated_at FROM transactions WHERE id = ?', [noteNotModifiedTxId]);
    const res = await restoreNoteRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${noteNotModifiedTxId}/restore-ai-note`, { expectedUpdatedAt: 1 }),
      { params: Promise.resolve({ txId: noteNotModifiedTxId }) }
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'NoteChanged');
    const after = queryOne('SELECT note, note_ai_modified, pre_ai_note, updated_at FROM transactions WHERE id = ?', [noteNotModifiedTxId]);
    assert.deepEqual(after, before, '樂觀鎖衝突時資料不得變更');
  });

  test('restore-ai-note (d) 對 note_ai_modified=0 的交易帶正確 expectedUpdatedAt 回傳 409 NotRestorable', async () => {
    const before = queryOne('SELECT updated_at FROM transactions WHERE id = ?', [noteNotModifiedTxId]);
    const res = await restoreNoteRoute.POST(
      authedRequest('POST', `http://localhost/api/transactions/${noteNotModifiedTxId}/restore-ai-note`, { expectedUpdatedAt: Number(before?.updated_at) }),
      { params: Promise.resolve({ txId: noteNotModifiedTxId }) }
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'NotRestorable');
  });

  test('restore-ai-note (e) 成功還原後稽核出現 restore_ai_modified_note，metadata 僅含 transaction_id、不含任何備註文字', async () => {
    const auditRow = queryOne(
      "SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'restore_ai_modified_note' AND result = 'success' ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );
    assert.ok(auditRow, '應查得 restore_ai_modified_note 稽核紀錄');
    const metadataJson = String(auditRow?.metadata);
    const metadata = JSON.parse(metadataJson);
    assert.equal(metadata.transaction_id, noteModifiedTxId);
    assert.ok(!metadataJson.includes('修改前的備註'), '稽核 metadata 不得含備註全文');
    assert.ok(!metadataJson.includes('AI 改過的備註'), '稽核 metadata 不得含目前備註全文');
  });

  // ── GET .../restore-ai-note（預覽，US3）──────────────────────────────

  test('restore-ai-note GET (a) 對 note_ai_modified=1 的交易，restorable=true、preAiNote 為修改前原文、currentNote 為目前備註', async () => {
    const res = await restoreNoteRoute.GET(
      authedRequest('GET', `http://localhost/api/transactions/${noteModifiedForGetTxId}/restore-ai-note`),
      { params: Promise.resolve({ txId: noteModifiedForGetTxId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.restorable, true);
    assert.equal(body.preAiNote, '修改前原文');
    assert.equal(body.currentNote, '目前備註內容');
    assert.ok(body.updatedAt > 0);
  });

  test('restore-ai-note GET (b) 對從未被 AI 改過備註的交易，restorable=false、preAiNote=null', async () => {
    const res = await restoreNoteRoute.GET(
      authedRequest('GET', `http://localhost/api/transactions/${noteNotModifiedTxId}/restore-ai-note`),
      { params: Promise.resolve({ txId: noteNotModifiedTxId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.restorable, false);
    assert.equal(body.preAiNote, null);
  });

  test('restore-ai-note GET (c) 對不存在或非本人的交易 id 回傳 404', async () => {
    const missing = await restoreNoteRoute.GET(
      authedRequest('GET', `http://localhost/api/transactions/nonexistent_${uid()}/restore-ai-note`),
      { params: Promise.resolve({ txId: 'nonexistent_' + uid() }) }
    );
    assert.equal(missing.status, 404);

    const notOwned = await restoreNoteRoute.GET(
      authedRequest('GET', `http://localhost/api/transactions/${otherUserTxId}/restore-ai-note`),
      { params: Promise.resolve({ txId: otherUserTxId }) }
    );
    assert.equal(notOwned.status, 404);
  });

  test('restore-ai-note GET (d) 呼叫本端點本身不變更任何資料（note／note_ai_modified／updated_at 逐欄相同）', async () => {
    const before = queryOne('SELECT note, note_ai_modified, updated_at FROM transactions WHERE id = ?', [noteModifiedForGetTxId]);
    const res = await restoreNoteRoute.GET(
      authedRequest('GET', `http://localhost/api/transactions/${noteModifiedForGetTxId}/restore-ai-note`),
      { params: Promise.resolve({ txId: noteModifiedForGetTxId }) }
    );
    assert.equal(res.status, 200);
    const after = queryOne('SELECT note, note_ai_modified, updated_at FROM transactions WHERE id = ?', [noteModifiedForGetTxId]);
    assert.deepEqual(after, before, 'GET 預覽不得變更任何資料');
  });
}
