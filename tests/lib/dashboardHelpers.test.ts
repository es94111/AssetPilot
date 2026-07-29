// tests/lib/dashboardHelpers.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 getTransactionsSummary()（T008，抽取自 app/api/reports/route.ts）與
// getStockPortfolioStatus()（T012，抽取自 app/api/dashboard/route.ts）與抽取前既有邏輯一致，
// 回應 analyze-01.md 的 X1。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/dashboardHelpers.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('dashboardHelpers（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { getTransactionsSummary, InvalidDateRangeError, getStockPortfolioStatus } = await import('../../lib/dashboardHelpers.ts');
  // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
  after(() => { getDB().close(); });

  await initDB();

  function seedUser(userId: string): void {
    getDB().run('INSERT INTO users (id, email, password_hash, display_name, created_at, timezone) VALUES (?,?,?,?,?,?)',
      [userId, `${userId}@test.local`, 'x', 'Test', String(Date.now()), 'Asia/Taipei']);
  }

  function seedCategory(userId: string, name: string, type: string, parentId = ''): string {
    const id = uid();
    getDB().run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,1,?)",
      [id, userId, name, type, '#ef4444', parentId]);
    return id;
  }

  function seedTransaction(userId: string, opts: { type: string; amount: number; date: string; categoryId?: string; excludeFromStats?: boolean }): void {
    getDB().run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), userId, opts.type, opts.amount, 'TWD', opts.amount, '1', opts.date, opts.categoryId || null, null, '', opts.excludeFromStats ? 1 : 0, Date.now(), Date.now()]
    );
  }

  function cleanupUser(userId: string): void {
    const db = getDB();
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM categories WHERE user_id = ?', [userId]);
    db.run('DELETE FROM stock_transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM stock_dividends WHERE user_id = ?', [userId]);
    db.run('DELETE FROM stocks WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
  }

  test('getTransactionsSummary：明確 from/to 期間內依分類彙總，排除 exclude_from_stats', () => {
    const userId = 'test_dashhelpers_' + uid();
    try {
      seedUser(userId);
      const parentId = seedCategory(userId, '餐飲', 'expense');
      const childId = seedCategory(userId, '午餐', 'expense', parentId);
      seedTransaction(userId, { type: 'expense', amount: 100, date: '2026-05-10', categoryId: childId });
      seedTransaction(userId, { type: 'expense', amount: 200, date: '2026-05-15', categoryId: childId });
      seedTransaction(userId, { type: 'expense', amount: 9999, date: '2026-05-16', categoryId: childId, excludeFromStats: true });
      seedTransaction(userId, { type: 'expense', amount: 300, date: '2026-06-01', categoryId: childId }); // 期間外

      const result = getTransactionsSummary(userId, { type: 'expense', from: '2026-05-01', to: '2026-05-31' });
      assert.equal(result.periodStart, '2026-05-01');
      assert.equal(result.periodEnd, '2026-05-31');
      assert.equal(result.total, 300);
      assert.equal(result.dailyMap['2026-05-10'], 100);
      assert.equal(result.dailyMap['2026-05-15'], 200);
      assert.equal(result.monthlyMap['2026-05'], 300);
      assert.equal(result.catMap['午餐']?.total, 300);
    } finally {
      cleanupUser(userId);
    }
  });

  test('getTransactionsSummary：未提供 from/to 時預設當月（比照既有 app/api/reports 行為）', () => {
    const userId = 'test_dashhelpers_' + uid();
    try {
      seedUser(userId);
      const result = getTransactionsSummary(userId, { type: 'expense' });
      const now = new Date();
      const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      assert.equal(result.periodStart, `${expectedMonth}-01`);
      assert.ok(result.periodEnd.startsWith(expectedMonth));
    } finally {
      cleanupUser(userId);
    }
  });

  test('getTransactionsSummary：起始日晚於結束日時拋出 InvalidDateRangeError', () => {
    const userId = 'test_dashhelpers_' + uid();
    try {
      seedUser(userId);
      assert.throws(
        () => getTransactionsSummary(userId, { from: '2026-05-31', to: '2026-05-01' }),
        InvalidDateRangeError
      );
    } finally {
      cleanupUser(userId);
    }
  });

  test('getStockPortfolioStatus：持股清單含股數/均價/現價/未實現損益/幣別，彙總與抽取前一致', () => {
    const userId = 'test_dashhelpers_' + uid();
    try {
      seedUser(userId);
      const db = getDB();
      const stockId = uid();
      db.run('INSERT INTO stocks (id, user_id, symbol, name, shares, avg_cost, currency, current_price, created_at, updated_at) VALUES (?,?,?,?,0,0,?,?,?,?)',
        [stockId, userId, '2330', '台積電', 'TWD', 600, Date.now(), Date.now()]);
      db.run('INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, fee, tax, date, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [uid(), userId, stockId, 'buy', 1000, 500, 20, 0, '2026-01-01', '', Date.now()]);

      const status = getStockPortfolioStatus(userId);
      assert.equal(status.holdings.length, 1);
      const holding = status.holdings[0];
      assert.equal(holding.stockId, stockId);
      assert.equal(holding.symbol, '2330');
      assert.equal(holding.shares, 1000);
      assert.equal(holding.avgCost, 500.02); // (1000*500+20)/1000
      assert.equal(holding.currentPrice, 600);
      assert.equal(holding.currency, 'TWD');
      assert.equal(holding.marketValue, 600000); // 1000*600
      assert.equal(holding.unrealizedPL, 600000 - 500020);
      assert.equal(holding.priced, true);

      assert.equal(status.marketValue, 600000);
      assert.equal(status.unpricedHoldingCount, 0);
      assert.equal(status.health.available, true);
      assert.equal(status.health.holdingCount, 1);
    } finally {
      cleanupUser(userId);
    }
  });

  test('getStockPortfolioStatus：無現價（current_price=0）時計入 unpricedHoldingCount，持股不計入成本彙總', () => {
    const userId = 'test_dashhelpers_' + uid();
    try {
      seedUser(userId);
      const db = getDB();
      const stockId = uid();
      db.run('INSERT INTO stocks (id, user_id, symbol, name, shares, avg_cost, currency, current_price, created_at, updated_at) VALUES (?,?,?,?,0,0,?,?,?,?)',
        [stockId, userId, '0050', '元大台灣50', 'TWD', 0, Date.now(), Date.now()]);
      db.run('INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, fee, tax, date, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [uid(), userId, stockId, 'buy', 100, 50, 5, 0, '2026-01-01', '', Date.now()]);

      const status = getStockPortfolioStatus(userId);
      assert.equal(status.unpricedHoldingCount, 1);
      assert.equal(status.holdings[0].priced, false);
      assert.equal(status.holdings[0].marketValue, 0);
      assert.equal(status.health.unavailableReason, 'missingPrices');
    } finally {
      cleanupUser(userId);
    }
  });
}
