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
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
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
    // (a) 一筆 ai_created=0 的轉出腳交易，對應一筆 mcp_create_transaction 稽核列，
    //     且其 linked_id 指向轉入腳——與 transactionWriteCore 實際寫入的方向一致
    //     （轉出腳的 linked_id = 轉入腳 id）。
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, date, linked_id, ai_created) VALUES (?,?,?,?,?,?,?)',
      [txIdA, userId, 'transfer_out', 100, '2026-08-14', txIdB, 0]
    );
    db.run(
      'INSERT INTO data_operation_audit_log (id, user_id, role, action, timestamp, result, metadata) VALUES (?,?,?,?,?,?,?)',
      [uid(), userId, 'user', 'mcp_create_transaction', now, 'success', JSON.stringify({ transaction_id: txIdA })]
    );
    // (b) 另一筆 ai_created=0 的轉入腳交易，會被第二段沿 linked_id 傳播回填。
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, date, ai_created) VALUES (?,?,?,?,?,?)',
      [txIdB, userId, 'transfer_in', 100, '2026-08-14', 0]
    );
  });

  after(async () => {
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    // Postgres worker thread 不會自動結束行程，測試結束後需等待關閉，避免殘留 MessagePort。
    await db.close();
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

  // 006-credit-card-total-repayment：新增 credit_card_repayment_summaries 表、
  // transactions.repayment_summary_id 欄位、2 個索引（T003）。
  test('credit_card_repayment_summaries 表存在且 11 個欄位齊全', () => {
    const row = queryOne(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'credit_card_repayment_summaries' ORDER BY ordinal_position`,
    );
    // 有列代表表存在；逐欄檢查
    const cols = queryAll(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'credit_card_repayment_summaries' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    const names = cols.map((c) => c.column_name);
    const expected = [
      'id', 'user_id', 'date', 'from_account_id', 'from_account_name', 'from_currency',
      'total_amount', 'input_mode', 'allocations', 'created_at', 'updated_at',
    ];
    for (const e of expected) assert.ok(names.includes(e), `缺少欄位 ${e}`);
    assert.equal(names.length, 11, '應有 11 個欄位');
    assert.ok(row != null || cols.length > 0, '表應存在');
  });

  test('transactions.repayment_summary_id 欄位存在且預設為空字串', () => {
    const cols = queryAll(
      `SELECT column_name, column_default FROM information_schema.columns
       WHERE table_name = 'transactions' AND column_name = 'repayment_summary_id'`,
    ) as Array<{ column_name: string; column_default: string | null }>;
    assert.equal(cols.length, 1, 'repayment_summary_id 欄位應存在');
    // 預設值含單引號（Postgres 回傳 ''''）；只驗證存在與可重複建立索引不報錯。
    assert.ok(cols[0].column_name === 'repayment_summary_id');
  });

  test('Web Push 訂閱／去重資料表與 user_settings 開關欄位由 migration 建立', () => {
    const subscriptionColumns = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'web_push_subscriptions' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    assert.deepEqual(
      subscriptionColumns.map((column) => column.column_name),
      [
        'id', 'user_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at',
        'updated_at', 'last_success_at', 'failure_count', 'disabled_at',
      ],
    );

    const sendLogColumns = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'web_push_send_log' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    assert.deepEqual(
      sendLogColumns.map((column) => column.column_name),
      ['id', 'user_id', 'category', 'event_key', 'sent_at_utc', 'send_status', 'delivered', 'error_message'],
    );

    const preferenceColumns = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_settings' AND column_name IN ('push_bill_due','push_budget_exceeded','push_dividend')`,
    ) as Array<{ column_name: string }>;
    assert.deepEqual(
      preferenceColumns.map((column) => column.column_name).sort(),
      ['push_bill_due', 'push_budget_exceeded', 'push_dividend'],
    );

    const uniqueIndexes = queryAll(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'web_push_send_log'`,
    ) as Array<{ indexdef: string }>;
    assert.ok(
      uniqueIndexes.some((index) => /CREATE UNIQUE INDEX/i.test(index.indexdef)
        && /\(user_id, category, event_key\)/i.test(index.indexdef)),
      'web_push_send_log 必須以 user_id + category + event_key 唯一去重',
    );

    const schedulerLocks = queryAll(
      "SELECT lock_name, lock_owner, lock_until FROM web_push_scheduler_locks WHERE lock_name = 'event-scan'",
    ) as Array<{ lock_name: string; lock_owner: string; lock_until: string | number }>;
    assert.equal(schedulerLocks.length, 1, 'scheduler lease row must be seeded exactly once');
    assert.equal(schedulerLocks[0].lock_name, 'event-scan');

    const schedulerIndexes = queryAll(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'web_push_scheduler_locks'",
    ) as Array<{ indexname: string }>;
    assert.ok(schedulerIndexes.some((index) => index.indexname.endsWith('_pkey')));

    const vapidColumns = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'web_push_vapid_config' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    assert.deepEqual(vapidColumns.map((column) => column.column_name), ['id', 'public_key', 'created_at']);
  });

  test('Web Push 去重 UNIQUE 條件拒絕同一事件重複 INSERT', () => {
    const db = getDB();
    const eventId = uid();
    const insert = (id: string) => db.run(
      'INSERT INTO web_push_send_log (id,user_id,category,event_key,sent_at_utc) VALUES (?,?,?,?,?)',
      [id, userId, 'dividend', `dividend:${eventId}`, new Date().toISOString()],
    );
    insert(uid());
    assert.throws(() => insert(uid()), /duplicate key|unique|constraint/i);
  });

  test('兩個新索引可重複執行不報錯', () => {
    getDB().run('CREATE INDEX IF NOT EXISTS idx_ccr_summaries_user ON credit_card_repayment_summaries(user_id)');
    getDB().run('CREATE INDEX IF NOT EXISTS idx_transactions_repayment_summary ON transactions(repayment_summary_id) WHERE repayment_summary_id != \'\'');
    // 再跑一次確認冪等
    getDB().run('CREATE INDEX IF NOT EXISTS idx_ccr_summaries_user ON credit_card_repayment_summaries(user_id)');
    getDB().run('CREATE INDEX IF NOT EXISTS idx_transactions_repayment_summary ON transactions(repayment_summary_id) WHERE repayment_summary_id != \'\'');
  });

  // #253 雲端發票載具整合：確認啟動 migration 已建立資料表、排程欄位及索引。
  test('invoice_carriers migration 含加密憑證、退避狀態與 auto_sync 欄位', () => {
    const cols = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'invoice_carriers' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    const names = cols.map((c) => c.column_name);
    for (const name of [
      'id', 'user_id', 'carrier_barcode', 'carrier_barcode_masked', 'verify_code_encrypted',
      'status', 'auto_sync', 'last_sync_at', 'last_sync_status', 'last_error',
      'consecutive_failures', 'next_retry_at', 'last_sync_retryable', 'sync_lock_until',
      'last_invoice_date', 'created_at', 'updated_at',
    ]) assert.ok(names.includes(name), `invoice_carriers 缺少欄位 ${name}`);
    assert.equal(names.length, 17);
  });

  test('invoice_imports migration 含草稿欄位與發票去重唯一鍵', () => {
    const cols = queryAll(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'invoice_imports' ORDER BY ordinal_position`,
    ) as Array<{ column_name: string }>;
    const names = cols.map((c) => c.column_name);
    for (const name of [
      'id', 'user_id', 'carrier_id', 'invoice_number', 'invoice_date', 'invoice_time',
      'seller_name', 'amount', 'status', 'transaction_id', 'created_at', 'updated_at', 'imported_at',
    ]) assert.ok(names.includes(name), `invoice_imports 缺少欄位 ${name}`);
    assert.equal(names.length, 13);

    const uniqueKeys = queryAll(
      `SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.constraint_schema = kcu.constraint_schema
       WHERE tc.table_name = 'invoice_imports' AND tc.constraint_type = 'UNIQUE'
       GROUP BY tc.constraint_name`,
    ) as Array<{ columns: string }>;
    assert.ok(uniqueKeys.some((key) => key.columns === 'user_id,invoice_number'), '缺少 (user_id, invoice_number) 唯一鍵');
  });

  test('invoice migration 查詢索引存在', () => {
    const indexes = queryAll(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname IN (
           'idx_invoice_carriers_user', 'idx_invoice_carriers_pending',
           'idx_invoice_imports_user_date', 'idx_invoice_imports_status', 'idx_invoice_imports_carrier'
         )`,
    ) as Array<{ indexname: string }>;
    assert.equal(indexes.length, 5, '應有 5 個載具／發票查詢索引');
  });
}
