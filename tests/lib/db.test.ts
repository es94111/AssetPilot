// tests/lib/db.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 T001 在 lib/db.ts _runMigrations() 新增的「ai_created 歷史回填」兩段 UPDATE 陳述式的
// 正確性與冪等性（005-mcp-transaction-restore）。
//
// 測法說明：initDB() 內建「_db 已存在即直接 return」的守門（lib/db.ts:45），同一行程內無法真正
// 重跑 _runMigrations()；故本測試改為直接對 fixture 資料執行與 T001 完全相同的兩段 UPDATE
// 陳述式（透過 getDB().run(sql)），驗證 SQL 本身的正確性與冪等性。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/db.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('db 遷移回填（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');

  await initDB();

  const userId = 'test_dbmigration_' + uid();
  const txIdA = uid();
  const txIdB = uid();

  // 與 lib/db.ts T001 完全相同的兩段回填陳述式（第一段：從稽核日誌回填；第二段：沿 linked_id 傳播）。
  const BACKFILL_STEP_1 = `UPDATE transactions SET ai_created = 1
    WHERE ai_created = 0 AND id IN (
      SELECT (metadata::jsonb->>'transaction_id')
      FROM data_operation_audit_log
      WHERE action = 'mcp_create_transaction'
    )`;
  const BACKFILL_STEP_2 = `UPDATE transactions SET ai_created = 1
    WHERE ai_created = 0 AND id IN (
      SELECT linked_id FROM transactions WHERE ai_created = 1 AND linked_id != ''
    )`;

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now]
    );
    // (a) 一筆 ai_created=0 的交易，對應一筆 mcp_create_transaction 稽核列。
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, date, ai_created) VALUES (?,?,?,?,?,?)',
      [txIdA, userId, 'expense', 100, '2026-08-14', 0]
    );
    db.run(
      'INSERT INTO data_operation_audit_log (id, user_id, role, action, timestamp, result, metadata) VALUES (?,?,?,?,?,?,?)',
      [uid(), userId, 'user', 'mcp_create_transaction', now, 'success', JSON.stringify({ transaction_id: txIdA })]
    );
    // (b) 另一筆 ai_created=0、linked_id 指向 (a) 該筆的交易（模擬轉帳另一腳／手續費子交易）。
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, date, linked_id, ai_created) VALUES (?,?,?,?,?,?,?)',
      [txIdB, userId, 'transfer_in', 100, '2026-08-14', txIdA, 0]
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
    db.close();
  });

  test('第一段回填：有 mcp_create_transaction 稽核列的既有交易，ai_created 變為 1', () => {
    getDB().run(BACKFILL_STEP_1);
    const row = queryOne('SELECT ai_created FROM transactions WHERE id = ?', [txIdA]);
    assert.equal(Number(row?.ai_created), 1);
  });

  test('第二段回填：沿 linked_id 傳播一跳，連動交易 ai_created 也變為 1', () => {
    getDB().run(BACKFILL_STEP_2);
    const row = queryOne('SELECT ai_created FROM transactions WHERE id = ?', [txIdB]);
    assert.equal(Number(row?.ai_created), 1);
  });

  test('冪等：兩段陳述式重跑不拋例外，且兩筆列的 ai_created 仍為 1', () => {
    getDB().run(BACKFILL_STEP_1);
    getDB().run(BACKFILL_STEP_2);
    assert.equal(Number(queryOne('SELECT ai_created FROM transactions WHERE id = ?', [txIdA])?.ai_created), 1);
    assert.equal(Number(queryOne('SELECT ai_created FROM transactions WHERE id = ?', [txIdB])?.ai_created), 1);
  });
}
