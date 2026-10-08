// tests/lib/twStockDripAndDayTrade.test.ts — issue #263
// 台股進階：股利再投資（DRIP）與現股當沖證交稅減半。
//
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過
// （保持 `npm test` 在無 DB 環境下仍可通過）。
//
// 覆蓋驗收條件：
//   1. 股利可標記為再投資，自動產生買入紀錄並調整 FIFO 成本基礎
//   2. DRIP 不影響既有已實現損益計算的正確性
//   3. 當沖交易可標記，證交稅以減半稅率（0.15%）計算
//   4. 稅率與適用規則集中管理（lib/twStockTaxRules.ts）+ 法規註解
//   5. 本檔已納入 `npm test`（package.json test:tw-stock-drip-day-trade）
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/twStockDripAndDayTrade.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('twStockDripAndDayTrade（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  // Route auth can trigger the optional server-wide stock price updater during integration tests.
  const originalStockAutoUpdate = process.env.STOCK_AUTO_UPDATE_ENABLED;
  process.env.STOCK_AUTO_UPDATE_ENABLED = 'false';
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const {
    calcStockTax,
    calcStockTaxForTrade,
    canMarkDayTrade,
    normalizeDayTradeFlag,
    validateDripInput,
    isDripSyntheticTransaction,
    isProtectedSyntheticTransaction,
    DRIP_SYNTH_NOTE_PREFIX,
    getStockSettings,
    getStockRealizedPl,
    validateStockTransactionChainChanges,
  } = await import('../../lib/stockHelpers.ts');
  const {
    TW_STOCK_SELL_TAX_RATE,
    TW_DAY_TRADE_SELL_TAX_RATE,
    resolveSellTaxRate,
    isDayTradeEligibleStockType,
  } = await import('../../lib/twStockTaxRules.ts');
  const dividendRoute = await import('../../app/api/stock-dividends/route.ts');
  const dividendIdRoute = await import('../../app/api/stock-dividends/[id]/route.ts');
  const txRoute = await import('../../app/api/stock-transactions/route.ts');
  const txIdRoute = await import('../../app/api/stock-transactions/[id]/route.ts');
  const txImportRoute = await import('../../app/api/stock-transactions/import/route.ts');
  const dividendImportRoute = await import('../../app/api/stock-dividends/import/route.ts');
  const dividendExportRoute = await import('../../app/api/stock-dividends/export/route.ts');
  const stockTransactionExportRoute = await import('../../app/api/stock-transactions/export/route.ts');
  const dividendBatchDeleteRoute = await import('../../app/api/stock-dividends/batch-delete/route.ts');

  await initDB();
  // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉。
  after(() => {
    getDB().close();
    if (originalStockAutoUpdate === undefined) delete process.env.STOCK_AUTO_UPDATE_ENABLED;
    else process.env.STOCK_AUTO_UPDATE_ENABLED = originalStockAutoUpdate;
  });

  const userId = 'test_drip_dt_' + uid();

  function authedRequest(method: string, url: string, body?: unknown) {
    const { token } = createLoginSession(userId, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}` };
    if (method !== 'GET') headers.Origin = new URL(url).origin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  function seedUser() {
    const db = getDB();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', 'DRIP 測試使用者', now],
    );
  }

  function seedAccount(): string {
    const id = uid();
    getDB().run(
      'INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, userId, '證券帳戶', 'cash', 0, 'TWD', Date.now(), Date.now()],
    );
    return id;
  }

  function seedStock(symbol: string, stockType = 'stock', market = 'TW'): string {
    const id = uid();
    getDB().run(
      'INSERT INTO stocks (id, user_id, symbol, name, market, stock_type, shares, avg_cost, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,0,0,?,?,?)',
      [id, userId, symbol, symbol, market, stockType, market === 'US' ? 'USD' : 'TWD', Date.now(), Date.now()],
    );
    return id;
  }

  function seedTx(stockId: string, opts: { type: string; shares: number; price: number; fee?: number; tax?: number; date: string; dayTrade?: boolean }) {
    const id = uid();
    getDB().run(
      'INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, fee, tax, date, note, created_at, day_trade) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, stockId, opts.type, opts.shares, opts.price, opts.fee || 0, opts.tax || 0, opts.date, '', Date.now(), opts.dayTrade ? 1 : 0],
    );
    return id;
  }

  seedUser();
  const accountId = seedAccount();

  // ── A. 稅率規則（集中管理 + 法規依據）────────────────────────
  test('A0. Migration：既有 DB 升級後可查詢所有 issue #263 欄位', () => {
    assert.deepEqual(queryAll('SELECT day_trade, linked_dividend_id FROM stock_transactions LIMIT 0'), []);
    assert.deepEqual(queryAll('SELECT reinvest, reinvest_shares, reinvest_price FROM stock_dividends LIMIT 0'), []);
  });

  test('A1. 稅率集中管理：一般股票 0.3%、當沖 0.15%，當沖為法定半數稅率', () => {
    assert.equal(TW_STOCK_SELL_TAX_RATE, 0.003, '證交稅條例第 2 條第 1 款為千分之三');
    assert.equal(TW_DAY_TRADE_SELL_TAX_RATE, 0.0015, '證交稅條例第 2 條之 2 為千分之一點五');
    assert.equal(TW_DAY_TRADE_SELL_TAX_RATE, TW_STOCK_SELL_TAX_RATE / 2, '當沖稅率必須恰為一般稅率一半');
  });

  test('A2. resolveSellTaxRate：僅股票類型且 dayTrade 時套用減半稅率', () => {
    assert.equal(resolveSellTaxRate('stock', 0.003, false), 0.003);
    assert.equal(resolveSellTaxRate('stock', 0.003, true), 0.0015);
    // ETF／權證不適用第 2 條之 2（條文限「股票」）
    assert.equal(resolveSellTaxRate('etf', 0.001, true), 0.001);
    assert.equal(resolveSellTaxRate('warrant', 0.001, true), 0.001);
    assert.equal(isDayTradeEligibleStockType('stock'), true);
    assert.equal(isDayTradeEligibleStockType('etf'), false);
    assert.equal(isDayTradeEligibleStockType('warrant'), false);
  });

  test('A3. calcStockTax：100,000 元當沖賣出稅額為 150 元（一般為 300 元）', () => {
    const settings = getStockSettings(userId);
    assert.equal(calcStockTax(100000, 'stock', settings, 'TW', false), 300);
    assert.equal(calcStockTax(100000, 'stock', settings, 'TW', true), 150);
    // 美股不課證交稅
    assert.equal(calcStockTax(100000, 'stock', settings, 'US', true), 0);
    // 最低稅額 1 元仍適用
    assert.equal(calcStockTax(1, 'stock', settings, 'TW', true), 1);
    // Decimal share × price prevents binary-float boundary changes to FLOOR tax.
    assert.equal(
      calcStockTaxForTrade('1', '666.6666666666666', 'stock', { ...settings, sellTaxMin: 0 }, 'TW', true),
      0,
    );
  });

  test('A4. normalizeDayTradeFlag 僅接受明確真值，字串 "false" 不得視為當沖', () => {
    assert.equal(normalizeDayTradeFlag(true), true);
    assert.equal(normalizeDayTradeFlag(1), true);
    assert.equal(normalizeDayTradeFlag('1'), true);
    assert.equal(normalizeDayTradeFlag('true'), true);
    assert.equal(normalizeDayTradeFlag('是'), true);
    assert.equal(normalizeDayTradeFlag(false), false);
    assert.equal(normalizeDayTradeFlag(0), false);
    assert.equal(normalizeDayTradeFlag('false'), false);
    assert.equal(normalizeDayTradeFlag(undefined), false);
  });

  test('A5. canMarkDayTrade：僅台股一般股票可標記', () => {
    assert.equal(canMarkDayTrade('stock', 'TW'), true);
    assert.equal(canMarkDayTrade('etf', 'TW'), false);
    assert.equal(canMarkDayTrade('stock', 'US'), false);
  });

  test('A6. chain simulation puts NULL created_at rows last like PostgreSQL FIFO reads', () => {
    const stockId = seedStock('6689');
    const date = '2026-01-05';
    const rows = [
      { id: uid(), type: 'buy', shares: 100, price: 100, createdAt: 100, note: 'first buy' },
      { id: uid(), type: 'buy', shares: 50, price: 100, createdAt: 150, note: '[DRIP] 股利再投資' },
      { id: uid(), type: 'sell', shares: 150, price: 120, createdAt: 200, note: 'sell' },
      { id: uid(), type: 'buy', shares: 50, price: 100, createdAt: null, note: 'legacy null timestamp buy' },
    ];
    rows.forEach((row) => {
      getDB().run(
        'INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [row.id, userId, stockId, date, row.type, row.shares, row.price, 0, 0, row.note, row.createdAt],
      );
    });
    const chain = validateStockTransactionChainChanges(userId, stockId, [rows[1].id]);
    assert.equal(chain.ok, false);
    assert.equal(chain.conflictDate, date);
    assert.equal(chain.expectedShares, -50);
  });

  // ── B. DRIP 驗證 ──────────────────────────────────────────────
  test('B1. validateDripInput：未勾選再投資時不建立任何再投資資料', () => {
    const r = validateDripInput({ reinvest: false, cashDividend: 1000, reinvestShares: 10, reinvestPrice: 90 });
    assert.equal(r.reinvest, false);
    assert.equal(r.reinvestShares, 0);
    assert.equal(r.reinvestPrice, 0);
  });

  test('B2. validateDripInput：勾選再投資需正數股數與價格、且需有現金股利', () => {
    assert.throws(() => validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 0, reinvestPrice: 90 }), /再投資股數與每股價格/);
    assert.throws(() => validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 10, reinvestPrice: 0 }), /再投資股數與每股價格/);
    assert.throws(() => validateDripInput({ reinvest: true, cashDividend: 0, reinvestShares: 10, reinvestPrice: 90 }), /僅適用於含現金股利/);
  });

  test('B3. validateDripInput：再投資金額不得超過現金股利（decimal 邊界比較）', () => {
    assert.throws(
      () => validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 11, reinvestPrice: 91 }),
      /不可超過現金股利/,
    );
    const ok = validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 10, reinvestPrice: 100, market: 'TW' });
    assert.equal(ok.reinvest, true);
    assert.equal(ok.reinvestShares, 10);
    assert.equal(ok.reinvestPrice, 100);
    assert.throws(
      () => validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 1.5, reinvestPrice: 100, market: 'TW' }),
      /台股再投資股數必須為整數/,
    );
    const fractionalUsDrip = validateDripInput({ reinvest: true, cashDividend: 1000, reinvestShares: 1.5, reinvestPrice: 100, market: 'US' });
    assert.equal(fractionalUsDrip.reinvestShares, 1.5);
  });

  test('B4. 合成交易判定：DRIP 前綴與股票股利前綴皆受保護', () => {
    assert.equal(isDripSyntheticTransaction(`${DRIP_SYNTH_NOTE_PREFIX} | 每股 $90`), true);
    assert.equal(isDripSyntheticTransaction('[SYNTH] 股票股利配發'), false);
    assert.equal(isProtectedSyntheticTransaction('[SYNTH] 股票股利配發'), true);
    assert.equal(isProtectedSyntheticTransaction(`${DRIP_SYNTH_NOTE_PREFIX} | 每股 $90`), true);
    assert.equal(isProtectedSyntheticTransaction('一般買進：股票股利配發已確認'), false);
    assert.equal(isProtectedSyntheticTransaction('一般買進'), false);
  });

  // ── C. API 端到端：當沖標記與稅額 ─────────────────────────────
  test('C1. POST 賣出標記當沖：自動稅額採 0.15%，並寫入 day_trade = 1', async () => {
    const stockId = seedStock('2317');
    seedTx(stockId, { type: 'buy', shares: 2000, price: 100, date: '2026-01-05' });

    const res = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: true, accountId,
      }),
    );
    assert.equal(res.status, 201);
    const { id } = await res.json();
    const row = queryOne('SELECT tax, day_trade, tax_auto_calculated FROM stock_transactions WHERE id = ?', [id]);
    assert.equal(Number(row?.tax), 150, '100,000 × 0.15% = 150');
    assert.equal(Number(row?.day_trade), 1);
    assert.equal(Number(row?.tax_auto_calculated), 1);
    // 對照組：同日同股不標當沖的另一筆賣出應為 300 元
    const res2 = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-02-01', shares: 1000, price: 100,
      }),
    );
    assert.equal(res2.status, 201);
    const row2 = queryOne('SELECT tax, day_trade FROM stock_transactions WHERE id = ?', [(await res2.json()).id]);
    assert.equal(Number(row2?.tax), 300, '100,000 × 0.3% = 300');
    assert.equal(Number(row2?.day_trade), 0);
  });

  test('C2. POST 拒絕：ETF 標記當沖；買進標記當沖', async () => {
    const etfId = seedStock('0050', 'etf');
    seedTx(etfId, { type: 'buy', shares: 1000, price: 100, date: '2026-01-05' });
    const etfRes = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId: etfId, type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: true,
      }),
    );
    assert.equal(etfRes.status, 400);
    assert.match((await etfRes.json()).error, /僅適用台股一般股票/);

    const stockId = seedStock('2301');
    const buyRes = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'buy', date: '2026-01-06', shares: 1000, price: 50, dayTrade: true,
      }),
    );
    assert.equal(buyRes.status, 400);
    assert.match((await buyRes.json()).error, /僅適用於賣出交易/);
  });

  test('C3. PUT 切換當沖標記會重算自動稅額；手動稅額不因標記切換被覆蓋', async () => {
    const stockId = seedStock('2412');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 100, date: '2026-01-05' });
    const created = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-01-05', shares: 1000, price: 100,
      }),
    );
    const { id } = await created.json();
    assert.equal(Number(queryOne('SELECT tax FROM stock_transactions WHERE id = ?', [id])?.tax), 300);

    // 標記當沖 → 自動重算為 150
    const turnOn = await txIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-transactions/${id}`, {
        type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: true,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(turnOn.status, 200);
    const afterOn = queryOne('SELECT tax, day_trade FROM stock_transactions WHERE id = ?', [id]);
    assert.equal(Number(afterOn?.tax), 150);
    assert.equal(Number(afterOn?.day_trade), 1);

    // 取消標記 → 自動重算回 300
    const turnOff = await txIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-transactions/${id}`, {
        type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: false,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(turnOff.status, 200);
    const afterOff = queryOne('SELECT tax, day_trade, tax_auto_calculated FROM stock_transactions WHERE id = ?', [id]);
    assert.equal(Number(afterOff?.tax), 300, '取消當沖應回復一般稅率');
    assert.equal(Number(afterOff?.day_trade), 0);
    // 明確傳入的手動稅額優先於 dayTrade 切換，不能被自動重算覆蓋。
    const manual = await txIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-transactions/${id}`, {
        type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: true, tax: 123,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(manual.status, 200);
    const afterManual = queryOne('SELECT tax, day_trade, tax_auto_calculated FROM stock_transactions WHERE id = ?', [id]);
    assert.equal(Number(afterManual?.tax), 123);
    assert.equal(Number(afterManual?.day_trade), 1);
    assert.equal(Number(afterManual?.tax_auto_calculated), 0);
  });

  test('C4. 單筆交易 DELETE 拒絕 DRIP 合成買入，避免股利留下孤兒標記', async () => {
    const stockId = seedStock('2344');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 20, date: '2026-01-05' });
    const created = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 200, reinvest: true, reinvestShares: 10, reinvestPrice: 20, accountId,
      }),
    );
    const { id, dripTxId } = await created.json();
    const res = await txIdRoute.DELETE(
      authedRequest('DELETE', `http://localhost/api/stock-transactions/${dripTxId}`),
      { params: Promise.resolve({ id: dripTxId }) },
    );
    assert.equal(res.status, 400);
    assert.ok(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [id]));
    assert.ok(queryOne('SELECT id FROM stock_transactions WHERE id = ?', [dripTxId]));
  });

  test('C5. CSV 匯入接受當沖是值，但拒絕 ETF 或買進交易標記', async () => {
    const common = { date: '2026-08-01', shares: 100, price: 10, dayTrade: '是' };
    const validStock = seedStock('2354', 'stock');
    const valid = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{ ...common, market: 'TW', symbol: '2354', type: '賣出' }],
      }),
    );
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).imported, 1);
    const imported = queryOne('SELECT day_trade, type FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, validStock, common.date]);
    assert.equal(Number(imported?.day_trade), 1);
    assert.equal(imported?.type, 'sell');

    const etfStock = seedStock('0056', 'etf');
    const invalidEtf = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{ ...common, date: '2026-08-02', market: 'TW', symbol: '0056', type: '賣出' }],
      }),
    );
    assert.equal(invalidEtf.status, 200);
    assert.equal((await invalidEtf.json()).imported, 0);
    assert.equal(queryOne('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, etfStock, '2026-08-02']), null);

    const rejectedNewSymbol = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{ ...common, date: '2026-08-04', market: 'TW', symbol: '2368', stockType: 'stock', type: '買進' }],
      }),
    );
    assert.equal(rejectedNewSymbol.status, 200);
    assert.equal((await rejectedNewSymbol.json()).imported, 0);
    assert.equal(queryOne('SELECT id FROM stocks WHERE user_id = ? AND market = ? AND symbol = ?', [userId, 'TW', '2368']), null, '拒絕的 CSV 列不得建立空持倉');

    const invalidBuy = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{ ...common, date: '2026-08-03', market: 'TW', symbol: '2354', type: '買進' }],
      }),
    );
    assert.equal(invalidBuy.status, 200);
    assert.equal((await invalidBuy.json()).imported, 0);
    assert.equal(queryOne('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, validStock, '2026-08-03']), null);
  });

  test('C6. 舊客戶未傳 dayTrade 時可將當沖賣出改為買進，旗標會清除', async () => {
    const stockId = seedStock('2382');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 100, date: '2026-01-05' });
    const created = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-01-05', shares: 1000, price: 100, dayTrade: true,
      }),
    );
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const updated = await txIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-transactions/${id}`, {
        type: 'buy', date: '2026-01-05', shares: 1000, price: 100,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(updated.status, 200);
    const row = queryOne('SELECT type, day_trade FROM stock_transactions WHERE id = ?', [id]);
    assert.equal(row?.type, 'buy');
    assert.equal(Number(row?.day_trade), 0);
  });

  // ── D. API 端到端：DRIP 與 FIFO ──────────────────────────────
  test('D1. POST 股利標記再投資：自動產生買進紀錄並調整 FIFO 成本基礎', async () => {
    const stockId = seedStock('2330');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 100, fee: 20, date: '2026-01-05' });

    const res = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-15', cashDividend: 5000, reinvest: true, reinvestShares: 50, reinvestPrice: 100, accountId,
      }),
    );
    assert.equal(res.status, 201);
    const { id, dripTxId } = await res.json();
    assert.ok(dripTxId, 'DRIP 合成買入交易必須產生');

    const div = queryOne('SELECT reinvest, reinvest_shares, reinvest_price FROM stock_dividends WHERE id = ?', [id]);
    assert.equal(Number(div?.reinvest), 1);
    assert.equal(Number(div?.reinvest_shares), 50);
    assert.equal(Number(div?.reinvest_price), 100);

    const dripTx = queryOne('SELECT type, shares, price, note, day_trade, linked_dividend_id FROM stock_transactions WHERE id = ?', [dripTxId]);
    assert.equal(dripTx?.type, 'buy');
    assert.equal(Number(dripTx?.shares), 50);
    assert.equal(Number(dripTx?.price), 100);
    assert.equal(Number(dripTx?.day_trade), 0);
    assert.equal(dripTx?.linked_dividend_id, id);
    assert.equal(isDripSyntheticTransaction(dripTx?.note), true);

    // 持股與 FIFO 成本基礎：原 1,000 股 @100（含手續費 20）+ DRIP 50 股 @100。
    const positions = queryAll('SELECT type, shares, price, fee FROM stock_transactions WHERE user_id = ? AND stock_id = ? ORDER BY date, created_at, id', [userId, stockId]);
    assert.equal(positions.length, 2, '原始買進 + DRIP 合成買進');
    const { calcFifoLots } = await import('../../lib/moneyDecimal.ts');
    const fifo = calcFifoLots(positions);
    assert.equal(fifo.totalShares.toNumber(), 1050);
    assert.equal(fifo.totalCost.toNumber(), 105020, '1,000×100+20 + 50×100');
    assert.equal(fifo.realizedPL.toNumber(), 0, '尚未賣出');
  });

  test('D2. DRIP 批次納入 FIFO：賣出時成本基礎包含再投資批次（全精度）', async () => {
    const stockId = seedStock('2454');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 100, date: '2026-01-05' });
    const divRes = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-01-06', cashDividend: 1200, reinvest: true, reinvestShares: 10, reinvestPrice: 120, accountId,
      }),
    );
    assert.equal(divRes.status, 201);
    // 賣出 1,010 股 @ 110：FIFO = 1,000×100 + 10×120 = 101,200
    const sellRes = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-02-01', shares: 1010, price: 110, fee: 10, tax: 166,
      }),
    );
    assert.equal(sellRes.status, 201);
    const realized = getStockRealizedPl(userId, { stockId });
    assert.equal(realized.entries.length, 1);
    const entry = realized.entries[0];
    assert.equal(entry.shares, 1010);
    assert.equal(entry.sellRevenue, 1010 * 110 - 10 - 166);
    assert.equal(entry.totalCost, 101200, 'DRIP 批次成本必須計入 FIFO');
    assert.equal(entry.realizedPL, 1010 * 110 - 10 - 166 - 101200);
  });

  test('D3. 未標記再投資的股利不影響已實現損益（regression-free）', async () => {
    const stockId = seedStock('2881');
    seedTx(stockId, { type: 'buy', shares: 500, price: 50, date: '2026-01-05' });
    await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-03-01', cashDividend: 2000, accountId,
      }),
    );
    await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-04-01', shares: 500, price: 55, fee: 20, tax: 82,
      }),
    );
    const realized = getStockRealizedPl(userId, { stockId });
    assert.equal(realized.entries.length, 1);
    // 純現金股利不入 FIFO 佇列：成本基礎仍為 500 × 50
    assert.equal(realized.entries[0].totalCost, 25000);
    assert.equal(realized.summary.count, 1);
  });

  test('D4. 股利編輯重建 DRIP 合成交易（不留孤兒紀錄）', async () => {
    const stockId = seedStock('1301');
    seedTx(stockId, { type: 'buy', shares: 2000, price: 30, date: '2026-01-05' });
    const created = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 600, stockDividendShares: 10, reinvest: true, reinvestShares: 20, reinvestPrice: 30, accountId,
      }),
    );
    const { id } = await created.json();
    const otherCreated = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 900, stockDividendShares: 6, reinvest: true, reinvestShares: 30, reinvestPrice: 30, accountId,
      }),
    );
    const { id: otherId } = await otherCreated.json();
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id IN (?, ?)', [userId, id, otherId]).length, 4);
    const originalLinked = queryAll('SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? ORDER BY id', [userId, id]);

    // 改為 25 股：只重建該股利的合成買入，不影響同日另一筆股利或 FIFO 時序。
    const putRes = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${id}`, {
        date: '2026-07-01', cashDividend: 750, stockDividendShares: 12, reinvest: true, reinvestShares: 25, reinvestPrice: 30, accountId,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(putRes.status, 200);
    const dripTxs = queryAll('SELECT shares FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?', [userId, id, `${DRIP_SYNTH_NOTE_PREFIX}%`]);
    const stockDivTxs = queryAll('SELECT shares FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND price = 0', [userId, id]);
    const otherLinkedTxs = queryAll('SELECT shares FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, otherId]);
    assert.equal(dripTxs.length, 1, '不應殘留舊的 DRIP 合成交易');
    assert.equal(Number(dripTxs[0].shares), 25);
    assert.equal(stockDivTxs.length, 1, '股票股利合成買入應連結同一股利並依更新後股數重建');
    assert.equal(Number(stockDivTxs[0].shares), 12);
    const editedLinked = queryAll('SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? ORDER BY id', [userId, id]);
    assert.deepEqual(editedLinked, originalLinked, '編輯股利不得改變同日合成買入的 FIFO 時序');
    assert.equal(otherLinkedTxs.length, 2, '同日另一筆股利的股票股利與 DRIP FIFO 批次必須保留');
    assert.deepEqual(otherLinkedTxs.map((tx) => Number(tx.shares)).sort((a, b) => a - b), [6, 30]);

    // 取消再投資：合成交易一併移除
    const cancelRes = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${id}`, {
        date: '2026-07-01', cashDividend: 750, stockDividendShares: 12, reinvest: false, accountId,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(cancelRes.status, 200);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?', [userId, id, `${DRIP_SYNTH_NOTE_PREFIX}%`]).length, 0);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND price = 0', [userId, id]).length, 1, '股利紀錄中的股票股利合成買進仍保留');
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, otherId]).length, 2);
    assert.equal(Number(queryOne('SELECT reinvest FROM stock_dividends WHERE id = ?', [id])?.reinvest), 0);

    // Deleting the edited dividend removes its stock-dividend synthetic buy too,
    // but must not touch the other same-day dividend's linked rows.
    const deleteRes = await dividendIdRoute.DELETE(
      authedRequest('DELETE', `http://localhost/api/stock-dividends/${id}`),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(deleteRes.status, 200);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, id]).length, 0);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, otherId]).length, 2);
  });

  test('D5. 刪除股利連動刪除 DRIP 合成交易，FIFO 回到原始成本', async () => {
    const stockId = seedStock('2105');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 60, date: '2026-01-05' });
    const created = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 600, reinvest: true, reinvestShares: 10, reinvestPrice: 60, accountId,
      }),
    );
    const { id } = await created.json();
    const otherCreated = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 300, reinvest: true, reinvestShares: 5, reinvestPrice: 60, accountId,
      }),
    );
    const { id: otherId } = await otherCreated.json();
    const delRes = await dividendIdRoute.DELETE(
      authedRequest('DELETE', `http://localhost/api/stock-dividends/${id}`),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.dripTransactionDeleted, true);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, id]).length, 0);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, otherId]).length, 1, '同日另一筆股利的 FIFO 批次必須保留');
    assert.equal(
      queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ?', [userId, stockId]).length,
      2,
      '原始買進與另一筆股利的買進都必須保留',
    );
  });

  test('D6. 交易批次刪除拒絕 DRIP 合成交易（須由股利頁處理）', async () => {
    const stockId = seedStock('1216');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 70, date: '2026-01-05' });
    const created = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 700, reinvest: true, reinvestShares: 10, reinvestPrice: 70, accountId,
      }),
    );
    const { dripTxId } = await created.json();
    const batchRoute = await import('../../app/api/stock-transactions/batch-delete/route.ts');
    const res = await batchRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/batch-delete', { ids: [dripTxId] }),
    );
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /股利再投資/);
    assert.ok(queryOne('SELECT id FROM stock_transactions WHERE id = ?', [dripTxId]), '合成交易不應被刪除');
  });

  test('D7. POST 拒絕無效 DRIP 輸入（無現金股利／超額再投資／台股零股）', async () => {
    const stockId = seedStock('1101');
    seedTx(stockId, { type: 'buy', shares: 1000, price: 40, date: '2026-01-05' });
    const noCash = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', stockDividendShares: 10, reinvest: true, reinvestShares: 10, reinvestPrice: 40, accountId,
      }),
    );
    assert.equal(noCash.status, 400);
    assert.match((await noCash.json()).error, /僅適用於含現金股利/);

    const over = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-01', cashDividend: 100, reinvest: true, reinvestShares: 10, reinvestPrice: 40, accountId,
      }),
    );
    assert.equal(over.status, 400);
    assert.match((await over.json()).error, /不可超過現金股利/);

    const fractional = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-07-02', cashDividend: 100, reinvest: true, reinvestShares: 1.5, reinvestPrice: 20, accountId,
      }),
    );
    assert.equal(fractional.status, 400);
    assert.match((await fractional.json()).error, /再投資股數必須為整數/);
  });

  test('D8. 無效 DRIP CSV row 不污染重複雜湊或建立空股票，後續有效 row 可匯入', async () => {
    const date = '2026-09-02';
    const rows = [
      {
        date, market: 'TW', symbol: '2664', name: 'DRIP 驗證測試', stockType: 'stock',
        cashDividend: 1000, stockDividend: 0, reinvest: '是', reinvestShares: 1.5,
        reinvestPrice: 100, accountName: '證券帳戶', note: 'invalid first',
      },
      {
        date, market: 'TW', symbol: '2664', name: 'DRIP 驗證測試', stockType: 'stock',
        cashDividend: 1000, stockDividend: 0, reinvest: '是', reinvestShares: 10,
        reinvestPrice: 100, accountName: '證券帳戶', note: 'valid second',
      },
    ];
    const res = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', { rows }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 1);
    assert.equal(body.skipped, 1);
    const stock = queryOne('SELECT id FROM stocks WHERE user_id = ? AND market = ? AND symbol = ?', [userId, 'TW', '2664']);
    assert.ok(stock, '只有有效的第二列應建立股票');
    const div = queryOne('SELECT id, reinvest_shares FROM stock_dividends WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, stock?.id as string, date]);
    assert.equal(Number(div?.reinvest_shares), 10);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, div?.id as string]).length, 1);

    const invalidOnly = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', {
        rows: [{
          date: '2026-09-03', market: 'TW', symbol: '2665', name: 'Invalid only', stockType: 'stock',
          cashDividend: 500, stockDividend: 0, reinvest: '是', reinvestShares: 1.5,
          reinvestPrice: 100, accountName: '證券帳戶', note: 'invalid only',
        }],
      }),
    );
    assert.equal(invalidOnly.status, 200);
    assert.equal((await invalidOnly.json()).imported, 0);
    assert.equal(queryOne('SELECT id FROM stocks WHERE user_id = ? AND market = ? AND symbol = ?', [userId, 'TW', '2665']), null);
  });

  test('D8. 批次刪除會對無法明確歸屬的舊版股票股利合成交易 fail closed', async () => {
    const stockId = seedStock('6677');
    const date = '2026-10-01';
    const dividendIds = [uid(), uid()];
    const db = getDB();
    for (const dividendId of dividendIds) {
      db.run(
        'INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [dividendId, userId, stockId, date, 0, 10, accountId, 'legacy row', Date.now()],
      );
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), userId, stockId, date, 'buy', 10, 0, 0, 0, accountId, '[SYNTH] 股票股利配發 legacy', Date.now(), ''],
      );
    }
    const res = await dividendBatchDeleteRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/batch-delete', { ids: dividendIds }),
    );
    assert.equal(res.status, 409, 'multiple identical legacy rows cannot be safely assigned to individual dividends');
    assert.equal(queryAll('SELECT id FROM stock_dividends WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, stockId, date]).length, 2);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND note LIKE ?', [userId, stockId, date, '[SYNTH] 股票股利%']).length, 2);
    const legacyTransactionExport = await stockTransactionExportRoute.GET(
      authedRequest('GET', 'http://localhost/api/stock-transactions/export'),
    );
    const legacyDividendExport = await dividendExportRoute.GET(
      authedRequest('GET', 'http://localhost/api/stock-dividends/export'),
    );
    assert.equal(legacyTransactionExport.status, 409, 'transaction export must not discard ambiguous legacy lots');
    assert.equal(legacyDividendExport.status, 409, 'dividend export must not duplicate ambiguous legacy lots');

    const ambiguousStockId = seedStock('6678');
    const ambiguousDividendId = uid();
    getDB().run(
      'INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [ambiguousDividendId, userId, ambiguousStockId, date, 0, 4, accountId, 'ambiguous legacy', Date.now()],
    );
    for (let index = 0; index < 2; index++) {
      getDB().run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), userId, ambiguousStockId, date, 'buy', 4, 0, 0, 0, accountId, '[SYNTH] 股票股利配發 duplicate', Date.now(), ''],
      );
    }
    const ambiguousRes = await dividendBatchDeleteRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/batch-delete', { ids: [ambiguousDividendId] }),
    );
    assert.equal(ambiguousRes.status, 409, '無法歸屬的舊合成交易必須拒絕刪除');
    assert.ok(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [ambiguousDividendId]));
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ?', [userId, ambiguousStockId, date]).length, 2);

    const nearMatchStockId = seedStock('6680');
    const nearMatchIds = [uid(), uid()];
    for (const [dividendId, shares] of [[nearMatchIds[0], 10], [nearMatchIds[1], 10.0014]]) {
      getDB().run(
        'INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [dividendId, userId, nearMatchStockId, date, 0, shares, accountId, 'near legacy', Date.now()],
      );
    }
    getDB().run(
      "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [uid(), userId, nearMatchStockId, date, 'buy', 10.0005, 0, 0, 0, accountId, '[SYNTH] 股票股利配發 near match', Date.now(), ''],
    );
    const nearMatchUpdate = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${nearMatchIds[0]}`, {
        date, cashDividend: 0, stockDividendShares: 10, accountId,
      }),
      { params: Promise.resolve({ id: nearMatchIds[0] }) },
    );
    assert.equal(nearMatchUpdate.status, 409, 'tolerance-overlapping legacy lots must not be assigned arbitrarily');
    const nearMatchBatch = await dividendBatchDeleteRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/batch-delete', { ids: nearMatchIds }),
    );
    assert.equal(nearMatchBatch.status, 409);
    assert.equal(queryAll('SELECT id FROM stock_dividends WHERE user_id = ? AND stock_id = ?', [userId, nearMatchStockId]).length, 2);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ?', [userId, nearMatchStockId]).length, 1);

    // Keep intentionally ambiguous fixtures from blocking later CSV export tests.
    getDB().run('DELETE FROM stock_transactions WHERE user_id = ? AND stock_id IN (?, ?, ?)', [userId, stockId, ambiguousStockId, nearMatchStockId]);
    getDB().run('DELETE FROM stock_dividends WHERE user_id = ? AND stock_id IN (?, ?, ?)', [userId, stockId, ambiguousStockId, nearMatchStockId]);
    getDB().run('DELETE FROM stocks WHERE user_id = ? AND id IN (?, ?, ?)', [userId, stockId, ambiguousStockId, nearMatchStockId]);
  });

  test('D9. Batch deleting a linked same-day dividend removes only its own synthetic lots', async () => {
    const stockId = seedStock('6681');
    seedTx(stockId, { type: 'buy', shares: 100, price: 20, date: '2026-01-01' });
    const first = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-02-01', cashDividend: 100, stockDividendShares: 2,
        reinvest: true, reinvestShares: 5, reinvestPrice: 20, accountId,
      }),
    );
    const second = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-02-01', cashDividend: 120, stockDividendShares: 3,
        reinvest: true, reinvestShares: 6, reinvestPrice: 20, accountId,
      }),
    );
    const { id: firstId } = await first.json();
    const { id: secondId } = await second.json();
    const deleted = await dividendBatchDeleteRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/batch-delete', { ids: [firstId] }),
    );
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).deleted, 1);
    assert.equal(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [firstId]), null);
    assert.ok(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [secondId]));
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, firstId]).length, 0);
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, secondId]).length, 2);
  });

  test('D10. Dividend edit/delete rejects changes that make later holdings negative', async () => {
    const stockId = seedStock('6676');
    seedTx(stockId, { type: 'buy', shares: 100, price: 20, date: '2026-01-01' });
    const created = await dividendRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends', {
        stockId, date: '2026-01-02', cashDividend: 0, stockDividendShares: 50, accountId,
      }),
    );
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const sell = await txRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions', {
        stockId, type: 'sell', date: '2026-01-03', shares: 150, price: 25,
      }),
    );
    assert.equal(sell.status, 201);

    const update = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${id}`, {
        date: '2026-01-04', cashDividend: 0, stockDividendShares: 50, accountId,
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(update.status, 400);
    const remove = await dividendIdRoute.DELETE(
      authedRequest('DELETE', `http://localhost/api/stock-dividends/${id}`),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(remove.status, 409);
    const batch = await dividendBatchDeleteRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/batch-delete', { ids: [id] }),
    );
    assert.equal(batch.status, 409);
    assert.ok(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [id]));
    assert.equal(queryAll('SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ?', [userId, id]).length, 1);
  });

  test('D11. Stale legacy synthetic buys block dividend edit/delete instead of orphaning FIFO lots', async () => {
    const stockId = seedStock('6679');
    const dividendId = uid();
    const legacyTxId = uid();
    // Simulate a pre-link dividend that was edited before this migration: the
    // dividend row changed, while its old synthetic buy kept its original date/shares.
    getDB().run(
      'INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [dividendId, userId, stockId, '2026-03-02', 120, 12, accountId, 'edited legacy', Date.now()],
    );
    getDB().run(
      "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [legacyTxId, userId, stockId, '2026-03-01', 'buy', 10, 0, 0, 0, accountId, '[SYNTH] 股票股利配發 old date/quantity', Date.now(), ''],
    );

    const update = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${dividendId}`, {
        date: '2026-03-03', cashDividend: 120, stockDividendShares: 12, accountId,
      }),
      { params: Promise.resolve({ id: dividendId }) },
    );
    assert.equal(update.status, 409);
    const remove = await dividendIdRoute.DELETE(
      authedRequest('DELETE', `http://localhost/api/stock-dividends/${dividendId}`),
      { params: Promise.resolve({ id: dividendId }) },
    );
    assert.equal(remove.status, 409);
    assert.ok(queryOne('SELECT id FROM stock_dividends WHERE id = ?', [dividendId]));
    assert.ok(queryOne('SELECT id FROM stock_transactions WHERE id = ?', [legacyTxId]));
    getDB().run('DELETE FROM stock_transactions WHERE user_id = ? AND stock_id = ?', [userId, stockId]);
    getDB().run('DELETE FROM stock_dividends WHERE user_id = ? AND stock_id = ?', [userId, stockId]);
    getDB().run('DELETE FROM stocks WHERE user_id = ? AND id = ?', [userId, stockId]);
  });

  test('D12. NULL FIFO timestamps remain NULL through export/import and dividend edits', async () => {
    const date = '2026-09-06';
    const sourceDripId = uid();
    const imported = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', {
        rows: [{
          date, market: 'TW', symbol: '2470', name: 'Null timestamp', stockType: 'stock',
          cashDividend: 500, stockDividend: 0, reinvest: '是', reinvestShares: 5,
          reinvestPrice: 100, reinvestTxCreatedAt: '', reinvestTxId: sourceDripId,
          accountName: '證券帳戶', note: 'NULL FIFO time',
        }],
      }),
    );
    assert.equal(imported.status, 200);
    const div = queryOne(
      'SELECT id FROM stock_dividends WHERE user_id = ? AND date = ? AND note = ?',
      [userId, date, 'NULL FIFO time'],
    );
    const originalTx = queryOne(
      'SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?',
      [userId, div?.id as string, `${DRIP_SYNTH_NOTE_PREFIX}%`],
    );
    assert.equal(originalTx?.id, sourceDripId);
    assert.equal(originalTx?.created_at, null);

    const update = await dividendIdRoute.PUT(
      authedRequest('PUT', `http://localhost/api/stock-dividends/${div?.id}`, {
        date, cashDividend: 500, stockDividendShares: 0, reinvest: true,
        reinvestShares: 5, reinvestPrice: 100, accountId, note: 'edited NULL FIFO time',
      }),
      { params: Promise.resolve({ id: div?.id }) },
    );
    assert.equal(update.status, 200);
    const updatedTx = queryOne(
      'SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?',
      [userId, div?.id as string, `${DRIP_SYNTH_NOTE_PREFIX}%`],
    );
    assert.equal(updatedTx?.id, sourceDripId);
    assert.equal(updatedTx?.created_at, null, 'PUT must not replace a source NULL timestamp with Date.now()');

    const zeroTimestampStockDivTxId = uid();
    const zeroTimestampImport = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', {
        rows: [{
          date: '2026-09-07', market: 'TW', symbol: '2471', name: 'Zero timestamp', stockType: 'stock',
          cashDividend: 0, stockDividend: 2, reinvest: '否',
          stockDividendTxCreatedAt: 0, stockDividendTxId: zeroTimestampStockDivTxId,
          accountName: '證券帳戶', note: 'zero FIFO time',
        }],
      }),
    );
    assert.equal(zeroTimestampImport.status, 200);

    const exported = await dividendExportRoute.GET(
      authedRequest('GET', 'http://localhost/api/stock-dividends/export'),
    );
    assert.equal(exported.status, 200);
    const csv = await exported.text();
    const row = csv.split(/\r?\n/).find((line) => line.includes(sourceDripId));
    assert.ok(row);
    assert.ok(row?.includes('edited NULL FIFO time'));
    const zeroTimestampRow = csv.split(/\r?\n/).find((line) => line.includes(zeroTimestampStockDivTxId));
    assert.ok(zeroTimestampRow);
    assert.equal(zeroTimestampRow?.split(',')[11], '0', 'zero epoch timestamp must not be exported as blank');
  });

  test('D13. DRIP CSV 匯出後以「是」匯入仍保留再投資和 FIFO 關聯', async () => {
    const date = '2026-09-01';
    const sourceStockDividendTxId = uid();
    const sourceReinvestTxId = uid();
    const sourceStockDividendCreatedAt = 1_700_000_000_123;
    const sourceReinvestCreatedAt = 1_700_000_000_124;
    const importRes = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', {
        rows: [{
          date,
          market: 'TW',
          symbol: '2459',
          name: 'DRIP CSV 測試',
          stockType: 'stock',
          cashDividend: 1000,
          stockDividend: 2,
          reinvest: '是',
          reinvestShares: 10,
          reinvestPrice: 100,
          stockDividendTxCreatedAt: sourceStockDividendCreatedAt,
          reinvestTxCreatedAt: sourceReinvestCreatedAt,
          stockDividendTxId: sourceStockDividendTxId,
          reinvestTxId: sourceReinvestTxId,
          accountName: '證券帳戶',
          note: 'CSV DRIP',
        }],
      }),
    );
    assert.equal(importRes.status, 200);
    assert.equal((await importRes.json()).imported, 1);
    const div = queryOne(
      'SELECT id, reinvest, reinvest_shares, reinvest_price, stock_dividend_shares FROM stock_dividends WHERE user_id = ? AND date = ? AND note = ?',
      [userId, date, 'CSV DRIP'],
    );
    assert.equal(Number(div?.reinvest), 1);
    assert.equal(Number(div?.reinvest_shares), 10);
    assert.equal(Number(div?.reinvest_price), 100);
    assert.equal(Number(div?.stock_dividend_shares), 2);
    const stockDividendTx = queryOne(
      'SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND price = 0',
      [userId, div?.id as string],
    );
    assert.equal(stockDividendTx?.id, sourceStockDividendTxId);
    assert.equal(Number(stockDividendTx?.created_at), sourceStockDividendCreatedAt);
    const linked = queryOne(
      'SELECT id, shares, price, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?',
      [userId, div?.id as string, `${DRIP_SYNTH_NOTE_PREFIX}%`],
    );
    assert.equal(Number(linked?.shares), 10);
    assert.equal(Number(linked?.price), 100);
    assert.equal(linked?.id, sourceReinvestTxId);
    const sourceCreatedAt = Number(linked?.created_at);
    assert.equal(sourceCreatedAt, sourceReinvestCreatedAt);

    const restoredDripId = uid();
    const restoreRes = await dividendImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-dividends/import', {
        rows: [{
          date: '2026-09-04', market: 'TW', symbol: '2460', name: 'FIFO restore copy',
          stockType: 'stock', cashDividend: 1000, stockDividend: 0, reinvest: '是',
          reinvestShares: 10, reinvestPrice: 100,
          reinvestTxCreatedAt: sourceCreatedAt, reinvestTxId: restoredDripId,
          accountName: '證券帳戶', note: 'FIFO restore copy',
        }],
      }),
    );
    assert.equal(restoreRes.status, 200);
    assert.equal((await restoreRes.json()).imported, 1);
    const restoredDividend = queryOne(
      'SELECT id FROM stock_dividends WHERE user_id = ? AND date = ? AND note = ?',
      [userId, '2026-09-04', 'FIFO restore copy'],
    );
    const restoredSynthetic = queryOne(
      'SELECT id, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND note LIKE ?',
      [userId, restoredDividend?.id as string, `${DRIP_SYNTH_NOTE_PREFIX}%`],
    );
    assert.equal(restoredSynthetic?.id, restoredDripId);
    assert.equal(Number(restoredSynthetic?.created_at), sourceCreatedAt, 'restore must preserve the DRIP lot FIFO timestamp');

    // A real buy that has the same economic hash as the DRIP lot must still import;
    // synthetic lots are not considered user-authored transaction duplicates.
    const realBuyCreatedAt = Date.now() - 1000;
    const realBuySourceId = uid();
    const realBuyRes = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{
          date, market: 'TW', symbol: '2459', type: '買進', shares: 10, price: 100,
          accountName: '證券帳戶', note: 'Manual additional buy', createdAt: realBuyCreatedAt, transactionId: realBuySourceId,
        }],
      }),
    );
    assert.equal(realBuyRes.status, 200);
    assert.equal((await realBuyRes.json()).imported, 1, 'linked DRIP row must not suppress a real matching buy');
    const importedRealBuy = queryOne(
      'SELECT st.id, st.created_at FROM stock_transactions st JOIN stocks s ON s.id = st.stock_id WHERE st.user_id = ? AND s.symbol = ? AND st.note = ?',
      [userId, '2459', 'Manual additional buy'],
    );
    assert.equal(importedRealBuy?.id, realBuySourceId);
    assert.equal(Number(importedRealBuy?.created_at), realBuyCreatedAt, 'transaction import must preserve FIFO ordering metadata');

    const nullTimestampSourceId = uid();
    const nullTimestampImport = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{
          date: '2026-09-05', market: 'TW', symbol: '2459', type: '買進', shares: 1, price: 5,
          accountName: '證券帳戶', note: 'Legacy null timestamp', createdAt: '', transactionId: nullTimestampSourceId,
        }],
      }),
    );
    assert.equal(nullTimestampImport.status, 200);
    assert.equal((await nullTimestampImport.json()).imported, 1);
    assert.equal(
      queryOne('SELECT created_at FROM stock_transactions WHERE id = ?', [nullTimestampSourceId])?.created_at,
      null,
      'an explicit blank exported timestamp must round-trip as SQL NULL',
    );

    const exportRes = await dividendExportRoute.GET(
      authedRequest('GET', 'http://localhost/api/stock-dividends/export'),
    );
    assert.equal(exportRes.status, 200);
    const csv = await exportRes.text();
    assert.match(csv, /再投資/);
    assert.match(csv, /是/);
    assert.match(csv, /CSV DRIP/);
    assert.ok(csv.includes(String(sourceStockDividendCreatedAt)));
    assert.ok(csv.includes(String(sourceReinvestCreatedAt)));
    assert.ok(csv.includes(sourceStockDividendTxId));
    assert.ok(csv.includes(sourceReinvestTxId));

    const nullNoteTransactionId = uid();
    const csvStock = queryOne(
      "SELECT id FROM stocks WHERE user_id = ? AND market = 'TW' AND symbol = '2459'",
      [userId],
    );
    getDB().run(
      "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [nullNoteTransactionId, userId, csvStock?.id ?? '', '2026-09-08', 'buy', 7, 25, 0, 0, accountId, null, Date.now()],
    );
    const transactionExport = await stockTransactionExportRoute.GET(
      authedRequest('GET', 'http://localhost/api/stock-transactions/export'),
    );
    assert.equal(transactionExport.status, 200);
    const transactionCsv = await transactionExport.text();
    assert.ok(transactionCsv.includes(nullNoteTransactionId), 'ordinary buy with NULL note must be exported');
    const duplicateNullNote = await txImportRoute.POST(
      authedRequest('POST', 'http://localhost/api/stock-transactions/import', {
        rows: [{ date: '2026-09-08', market: 'TW', symbol: '2459', type: '買進', shares: 7, price: 25, accountName: '證券帳戶', note: '' }],
      }),
    );
    assert.equal(duplicateNullNote.status, 200);
    assert.equal((await duplicateNullNote.json()).imported, 0, 'NULL-note purchase should still be recognized as an existing duplicate');
    assert.doesNotMatch(transactionCsv, /\[DRIP\] 股利再投資/);
    assert.doesNotMatch(transactionCsv, /\[SYNTH\] 股票股利配發/);
    assert.doesNotMatch(transactionCsv, /CSV DRIP/);
    assert.match(transactionCsv, /Manual additional buy/);
    assert.ok(transactionCsv.includes(String(realBuyCreatedAt)));
    assert.ok(transactionCsv.includes(realBuySourceId));
  });
}
