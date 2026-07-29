// tests/lib/stockHelpers.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 getStockRealizedPl()（T007 從 app/api/stock-realized-pl/route.ts 抽取）：
// 不帶篩選參數時的 FIFO 損益計算與抽取前完全一致，回應 analyze-01.md 的 X1。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/stockHelpers.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('stockHelpers（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { getStockRealizedPl } = await import('../../lib/stockHelpers.ts');

  await initDB();
  // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
  after(() => { getDB().close(); });

  function seedStock(userId: string, symbol: string): string {
    const stockId = uid();
    getDB().run(
      'INSERT INTO stocks (id, user_id, symbol, name, shares, avg_cost, currency, created_at, updated_at) VALUES (?,?,?,?,0,0,?,?,?)',
      [stockId, userId, symbol, symbol, 'TWD', Date.now(), Date.now()]
    );
    return stockId;
  }

  function seedStockTx(userId: string, stockId: string, opts: { type: string; shares: number; price: number; fee?: number; tax?: number; date: string }): void {
    getDB().run(
      'INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, fee, tax, date, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), userId, stockId, opts.type, opts.shares, opts.price, opts.fee || 0, opts.tax || 0, opts.date, '', Date.now()]
    );
  }

  function cleanupUser(userId: string): void {
    const db = getDB();
    db.run('DELETE FROM stock_transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM stocks WHERE user_id = ?', [userId]);
  }

  test('FIFO 已實現損益：無篩選參數時輸出與抽取前既有邏輯完全一致', () => {
    const userId = 'test_stockhelpers_' + uid();
    try {
      const stockId = seedStock(userId, '2330');
      const thisYear = new Date().getFullYear();
      const lastYear = thisYear - 1;
      seedStockTx(userId, stockId, { type: 'buy', shares: 1000, price: 100, fee: 20, date: `${lastYear}-06-01` });
      seedStockTx(userId, stockId, { type: 'sell', shares: 200, price: 110, fee: 10, tax: 20, date: `${lastYear}-12-01` });
      seedStockTx(userId, stockId, { type: 'sell', shares: 400, price: 120, fee: 15, tax: 36, date: `${thisYear}-03-01` });

      const result = getStockRealizedPl(userId);
      assert.equal(result.entries.length, 2);

      // 賣出明細依 sellDate 降冪排序（既有行為）。
      const [entryThisYear, entryLastYear] = result.entries;
      assert.equal(entryThisYear.sellDate, `${thisYear}-03-01`);
      assert.equal(entryThisYear.shares, 400);
      assert.equal(entryThisYear.sellRevenue, 47949); // 400*120 - 15 - 36
      assert.equal(entryThisYear.totalCost, 40008); // 400*100 + (20*400/1000)
      assert.equal(entryThisYear.realizedPL, 7941);
      assert.equal(entryThisYear.costPrice, 100.02);

      assert.equal(entryLastYear.sellDate, `${lastYear}-12-01`);
      assert.equal(entryLastYear.shares, 200);
      assert.equal(entryLastYear.sellRevenue, 21970); // 200*110 - 10 - 20
      assert.equal(entryLastYear.totalCost, 20004); // 200*100 + (20*200/1000)
      assert.equal(entryLastYear.realizedPL, 1966);

      const expectedTotalRealizedPL = entryThisYear.realizedPL + entryLastYear.realizedPL;
      const expectedTotalCost = entryThisYear.totalCost + entryLastYear.totalCost;
      const expectedOverallReturnRate = Math.round((expectedTotalRealizedPL / expectedTotalCost) * 10000) / 100;
      assert.equal(result.summary.totalRealizedPL, expectedTotalRealizedPL);
      assert.equal(result.summary.overallReturnRate, expectedOverallReturnRate);
      assert.equal(result.summary.count, 2);
      // ytdRealizedPL 僅計入本年度賣出（既有行為：sellDate.startsWith(thisYear)）。
      assert.equal(result.summary.ytdRealizedPL, entryThisYear.realizedPL);
    } finally {
      cleanupUser(userId);
    }
  });

  test('dateFrom/dateTo 篩選僅套用於賣出明細，不影響 FIFO 成本計算本身', () => {
    const userId = 'test_stockhelpers_' + uid();
    try {
      const stockId = seedStock(userId, '2330');
      const thisYear = new Date().getFullYear();
      const lastYear = thisYear - 1;
      seedStockTx(userId, stockId, { type: 'buy', shares: 1000, price: 100, fee: 20, date: `${lastYear}-06-01` });
      seedStockTx(userId, stockId, { type: 'sell', shares: 200, price: 110, fee: 10, tax: 20, date: `${lastYear}-12-01` });
      seedStockTx(userId, stockId, { type: 'sell', shares: 400, price: 120, fee: 15, tax: 36, date: `${thisYear}-03-01` });

      const onlyThisYear = getStockRealizedPl(userId, { dateFrom: `${thisYear}-01-01` });
      assert.equal(onlyThisYear.entries.length, 1);
      assert.equal(onlyThisYear.entries[0].sellDate, `${thisYear}-03-01`);
      assert.equal(onlyThisYear.entries[0].realizedPL, 7941); // 與無篩選時相同（FIFO 成本不受篩選影響）

      const onlyLastYear = getStockRealizedPl(userId, { dateTo: `${lastYear}-12-31` });
      assert.equal(onlyLastYear.entries.length, 1);
      assert.equal(onlyLastYear.entries[0].sellDate, `${lastYear}-12-01`);
    } finally {
      cleanupUser(userId);
    }
  });

  test('stockId 篩選僅回傳指定標的的已實現損益', () => {
    const userId = 'test_stockhelpers_' + uid();
    try {
      const stockA = seedStock(userId, '2330');
      const stockB = seedStock(userId, '0050');
      const date = `${new Date().getFullYear()}-01-15`;
      seedStockTx(userId, stockA, { type: 'buy', shares: 100, price: 50, date: `${new Date().getFullYear() - 1}-01-01` });
      seedStockTx(userId, stockA, { type: 'sell', shares: 100, price: 60, date });
      seedStockTx(userId, stockB, { type: 'buy', shares: 200, price: 30, date: `${new Date().getFullYear() - 1}-01-01` });
      seedStockTx(userId, stockB, { type: 'sell', shares: 200, price: 40, date });

      const all = getStockRealizedPl(userId);
      assert.equal(all.entries.length, 2);

      const onlyA = getStockRealizedPl(userId, { stockId: stockA });
      assert.equal(onlyA.entries.length, 1);
      assert.equal(onlyA.entries[0].stockId, stockA);
    } finally {
      cleanupUser(userId);
    }
  });
}
