// tests/lib/offlineIdempotency.test.ts — client_ref 幂等寫入的 DB 回歸測試（007-pwa-offline-entry）
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過，保持 `npm test` 在無 DB
// 環境下仍可通過（比照 tests/lib/db.test.ts 的略過守衛）。
//
// 目的：釘住 Issue 驗收條件「離線新增的交易存入本機佇列，恢復連線後自動送出」與
// 「同步衝突處理策略需明確定義（以最後寫入或提示使用者選擇）」所依賴的伺服器保證：
//   1. transactions.client_ref 欄位與 (user_id, client_ref) 部分唯一索引存在。
//   2. 相同 client_ref 重送不會產生第二筆交易，且回傳同一 id（伺服器冪等）。
//   3. client_ref = ''（線上直接新增）維持原行為：不觸發唯一索引、每筆各自獨立。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/offlineIdempotency.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('offline idempotency（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { insertIncomeExpenseTransaction, insertTransferPair } = await import('../../lib/transactionWriteCore.ts');

  await initDB();

  after(() => { getDB().close(); });

  function cleanup(userId: string): void {
    getDB().run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM users WHERE id = ?', [userId]);
  }

  function seedUser(userId: string, accountId: string): void {
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', new Date().toISOString()],
    );
    getDB().run(
      'INSERT INTO accounts (id, user_id, name, currency) VALUES (?,?,?,?)',
      [accountId, userId, '離線錢包', 'TWD'],
    );
  }

  function baseInput(userId: string, accountId: string, clientRef?: string) {
    return {
      userId,
      type: 'expense',
      twdAmount: 200,
      currency: 'TWD',
      originalAmount: 200,
      fxRate: '1',
      fxFee: 0,
      date: '2026-10-05',
      categoryId: null,
      accountId,
      note: '離線新增',
      excludeFromStats: false,
      clientRef,
    };
  }

  test('transactions.client_ref 欄位與 (user_id, client_ref) 唯一索引存在', () => {
    const column = queryOne(
      "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'client_ref'",
    );
    assert.ok(column, 'client_ref 欄位應存在');
    assert.equal(column!.is_nullable, 'NO');
    assert.equal(column!.column_default, "''::text");

    const index = queryOne(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_client_ref'",
    );
    assert.ok(index, '唯一索引應存在');
    assert.match(String(index!.indexdef), /UNIQUE/);
    assert.match(String(index!.indexdef), /client_ref/);
  });

  test('相同 client_ref 重送僅寫入一筆，且回傳同一 id（伺服器冪等）', () => {
    const userId = 'test_offline_idem_' + uid();
    const accountId = uid();
    const clientRef = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    seedUser(userId, accountId);
    try {
      const first = insertIncomeExpenseTransaction(baseInput(userId, accountId, clientRef));
      const second = insertIncomeExpenseTransaction(baseInput(userId, accountId, clientRef));
      const third = insertIncomeExpenseTransaction(baseInput(userId, accountId, clientRef));

      assert.equal(second.id, first.id, '重送應回傳同一交易 id');
      assert.equal(third.id, first.id);
      assert.equal(first.twdAmount, 200);
      assert.equal(second.twdAmount, 200, '去重回應需與新建形狀一致');

      const rows = queryAll(
        'SELECT id FROM transactions WHERE user_id = ? AND client_ref = ?',
        [userId, clientRef],
      );
      assert.equal(rows.length, 1, '相同 client_ref 僅能存在一筆交易');
    } finally {
      cleanup(userId);
    }
  });

  test('不同使用者可使用相同 client_ref（唯一鍵含 user_id）', () => {
    const userA = 'test_offline_idem_a_' + uid();
    const userB = 'test_offline_idem_b_' + uid();
    const accA = uid();
    const accB = uid();
    const clientRef = 'b1b2c3d4e5f60718293a4b5c6d7e8f91';
    seedUser(userA, accA);
    seedUser(userB, accB);
    try {
      const createdA = insertIncomeExpenseTransaction(baseInput(userA, accA, clientRef));
      const createdB = insertIncomeExpenseTransaction(baseInput(userB, accB, clientRef));
      assert.notEqual(createdA.id, createdB.id, '不同使用者的相同 client_ref 不應互相去重');
    } finally {
      cleanup(userA);
      cleanup(userB);
    }
  });

  test('client_ref 為空字串時不觸發去重，維持既有線上新增行為', () => {
    const userId = 'test_offline_idem_empty_' + uid();
    const accountId = uid();
    seedUser(userId, accountId);
    try {
      const n1 = insertIncomeExpenseTransaction(baseInput(userId, accountId, undefined));
      const n2 = insertIncomeExpenseTransaction(baseInput(userId, accountId, undefined));
      assert.notEqual(n1.id, n2.id, '未帶 clientRef 時每筆各自獨立');
      const empties = queryAll(
        "SELECT id FROM transactions WHERE user_id = ? AND client_ref = ''",
        [userId],
      );
      assert.equal(empties.length, 2);
    } finally {
      cleanup(userId);
    }
  });

  test('轉帳冪等：相同 client_ref 重送僅一組配對，且 client_ref 只落在轉出腳', () => {
    const userId = 'test_offline_idem_tr_' + uid();
    const fromAccountId = uid();
    const toAccountId = uid();
    const clientRef = 'c1c2c3d4e5f60718293a4b5c6d7e8f92';
    seedUser(userId, fromAccountId);
    getDB().run(
      'INSERT INTO accounts (id, user_id, name, currency) VALUES (?,?,?,?)',
      [toAccountId, userId, '轉入帳戶', 'TWD'],
    );
    try {
      const first = insertTransferPair({
        userId,
        fromAccountId,
        toAccountId,
        fromCurrency: 'TWD',
        toCurrency: 'TWD',
        twdAmount: 500,
        originalAmount: 500,
        fxRate: '1',
        date: '2026-10-05',
        note: '離線轉帳',
        clientRef,
      });
      // 唯一索引為 (user_id, client_ref)：若兩腳都寫同一 client_ref，轉入腳會撞唯一鍵
      // 而使整組 rollback —— 這裡同時驗證兩腳都成功寫入。
      const second = insertTransferPair({
        userId,
        fromAccountId,
        toAccountId,
        fromCurrency: 'TWD',
        toCurrency: 'TWD',
        twdAmount: 500,
        originalAmount: 500,
        fxRate: '1',
        date: '2026-10-05',
        note: '離線轉帳',
        clientRef,
      });
      assert.equal(second.transferOut.id, first.transferOut.id, '重送應回傳同一轉出腳');
      assert.equal(second.transferIn.id, first.transferIn.id, '重送應回傳同一轉入腳');

      const legs = queryAll(
        'SELECT id, type, client_ref FROM transactions WHERE user_id = ? ORDER BY type',
        [userId],
      );
      assert.equal(legs.length, 2, '重送不應新增配對，應恆為兩腳');
      const withRef = legs.filter((row) => String(row.client_ref) === clientRef);
      assert.equal(withRef.length, 1, 'client_ref 僅能落在一個轉出腳');
      assert.equal(String(withRef[0].type), 'transfer_out');
    } finally {
      cleanup(userId);
    }
  });
}
