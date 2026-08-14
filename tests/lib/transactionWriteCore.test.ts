// tests/lib/transactionWriteCore.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 針對 lib/transactionWriteCore.ts 抽出的共用交易寫入核心撰寫回歸測試，涵蓋既有
// POST /api/transactions、POST /api/transactions/transfer 依賴的既有情境（Constitution
// Principle V 第 6 款：抽出共用函式必須有回歸測試保護既有行為，不只測 MCP 新路徑）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/transactionWriteCore.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('transactionWriteCore（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { insertIncomeExpenseTransaction, insertTransferPair } = await import('../../lib/transactionWriteCore.ts');

  await initDB();
  // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
  after(() => { getDB().close(); });

  function cleanupUser(userId: string): void {
    getDB().run('DELETE FROM transactions WHERE user_id = ?', [userId]);
  }

  test('insertIncomeExpenseTransaction：一般支出換算 TWD 整數化，回應與寫入內容一致', () => {
    const userId = 'test_txwritecore_' + uid();
    const accountId = uid();
    try {
      const result = insertIncomeExpenseTransaction({
        userId, type: 'expense', twdAmount: 350, currency: 'TWD', originalAmount: 350, fxRate: '1',
        fxFee: 0, date: '2026-08-14', categoryId: null, accountId, note: '晚餐', excludeFromStats: false,
      });
      assert.ok(result.id);
      assert.equal(result.twdAmount, 350);
      assert.equal(result.fxFee, 0);
      assert.equal(result.feeId, null);
      assert.ok(result.updatedAt > 0);

      const row = queryOne('SELECT type, twd_amount, account_id, note, category_id FROM transactions WHERE id = ?', [result.id]);
      assert.equal(row?.type, 'expense');
      assert.equal(Number(row?.twd_amount), 350);
      assert.equal(row?.account_id, accountId);
      assert.equal(row?.note, '晚餐');
      assert.equal(row?.category_id, null);
    } finally {
      cleanupUser(userId);
    }
  });

  test('insertIncomeExpenseTransaction：外幣信用卡支出手續費另存副交易，與原交易 linked_id 雙向關聯', () => {
    const userId = 'test_txwritecore_' + uid();
    const accountId = uid();
    try {
      const result = insertIncomeExpenseTransaction({
        userId, type: 'expense', twdAmount: 3000, currency: 'USD', originalAmount: 100, fxRate: '30',
        fxFee: 45, date: '2026-08-14', categoryId: null, accountId, note: '海外刷卡', excludeFromStats: false,
      });
      assert.ok(result.feeId);
      assert.equal(result.fxFee, 45);

      const mainRow = queryOne('SELECT linked_id FROM transactions WHERE id = ?', [result.id]);
      assert.equal(mainRow?.linked_id, result.feeId);

      const feeRow = queryOne('SELECT linked_id, is_fx_fee, amount, type FROM transactions WHERE id = ?', [result.feeId]);
      assert.equal(feeRow?.linked_id, result.id);
      assert.equal(Number(feeRow?.is_fx_fee), 1);
      assert.equal(feeRow?.type, 'expense');
      assert.equal(Number(feeRow?.amount), 45);
    } finally {
      cleanupUser(userId);
    }
  });

  test('insertIncomeExpenseTransaction：收入類型即使帶手續費也不建立副交易（僅支出才產生）', () => {
    const userId = 'test_txwritecore_' + uid();
    const accountId = uid();
    try {
      const result = insertIncomeExpenseTransaction({
        userId, type: 'income', twdAmount: 3000, currency: 'USD', originalAmount: 100, fxRate: '30',
        fxFee: 45, date: '2026-08-14', categoryId: null, accountId, note: '', excludeFromStats: false,
      });
      assert.equal(result.feeId, null);
    } finally {
      cleanupUser(userId);
    }
  });

  test('insertTransferPair：建立轉帳雙腳並互相以 linked_id 關聯', () => {
    const userId = 'test_txwritecore_' + uid();
    const fromAccountId = uid();
    const toAccountId = uid();
    try {
      const pair = insertTransferPair({
        userId, fromAccountId, toAccountId, fromCurrency: 'TWD', toCurrency: 'TWD',
        twdAmount: 1000, originalAmount: 1000, fxRate: '1', date: '2026-08-14', note: '轉帳',
      });
      assert.equal(pair.transferOut.accountId, fromAccountId);
      assert.equal(pair.transferOut.toAccountId, toAccountId);
      assert.equal(pair.transferOut.linkedId, pair.transferIn.id);
      assert.equal(pair.transferIn.accountId, toAccountId);
      assert.equal(pair.transferIn.toAccountId, fromAccountId);
      assert.equal(pair.transferIn.linkedId, pair.transferOut.id);

      const outRow = queryOne('SELECT type, linked_id FROM transactions WHERE id = ?', [pair.transferOut.id]);
      assert.equal(outRow?.type, 'transfer_out');
      assert.equal(outRow?.linked_id, pair.transferIn.id);

      const inRow = queryOne('SELECT type, linked_id FROM transactions WHERE id = ?', [pair.transferIn.id]);
      assert.equal(inRow?.type, 'transfer_in');
      assert.equal(inRow?.linked_id, pair.transferOut.id);
    } finally {
      cleanupUser(userId);
    }
  });

  test('insertTransferPair：失敗時 ROLLBACK，不留下部分建立的資料', () => {
    const userId = 'test_txwritecore_' + uid();
    const fromAccountId = uid();
    const toAccountId = uid();
    const marker = 'rollback_marker_' + uid();
    try {
      assert.throws(() => {
        insertTransferPair({
          userId: null as unknown as string, fromAccountId, toAccountId, fromCurrency: 'TWD', toCurrency: 'TWD',
          twdAmount: 1000, originalAmount: 1000, fxRate: '1', date: '2026-08-14', note: marker,
        });
      });

      const leftover = queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE note = ?', [marker]);
      assert.equal(Number(leftover?.cnt) || 0, 0);
    } finally {
      cleanupUser(userId);
    }
  });
}
