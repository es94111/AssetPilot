// tests/lib/creditCardRepayment.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
//
// 驗證 006-credit-card-total-repayment 的三個端點：
//  - POST /api/accounts/credit-card-repayment（寫入端點，總金額還款）
//  - GET  /api/accounts/{id}/repayment-cards（欠款快照）
//  - GET  /api/credit-card-repayment-summaries/{id}（摘要與陳舊判定）
//
// 涵蓋：V1-V5 驗證拒絕、納入規則（FR-003）、等比例分配寫入（FR-002）、舊格式加總重算
// （FR-019a／019b）、送出當下重算後變不合法的拒絕（FR-018a）、原子性（FR-017a）、
// 摘要寫入與回應（FR-020／020a）、摘要陳舊判定（FR-020b）、快照端點（FR-003／011）。
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/creditCardRepayment.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('creditCardRepayment（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll, saveDB } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest, NextResponse } = await import('next/server');
  const { convertToTwd, convertFromTwd, normalizeCurrency } = await import('../../lib/accountHelpers.ts');
  const {
    collectPayableCards,
    computeRepaymentAllocation,
    executeRepayment,
    evaluateRepaymentSummary,
  } = await import('../../lib/creditCardRepayment.ts');
  const { allocateRepayment } = await import('../../lib/creditCardRepaymentAllocation.ts');
  const repaymentRoute = await import('../../app/api/accounts/credit-card-repayment/route.ts');
  const summaryRoute = await import('../../app/api/credit-card-repayment-summaries/[id]/route.ts');
  const cardsRoute = await import('../../app/api/accounts/[id]/repayment-cards/route.ts');

  await initDB();

  const userId = 'test_ccr_' + uid();
  const now = Date.now();

  function authedRequest(method: string, url: string, body?: unknown) {
    const { token } = createLoginSession(userId, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}` };
    if (method !== 'GET') headers.Origin = new URL(url).origin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  before(() => {
    const db = getDB();
    const nowIso = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', nowIso]
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM login_sessions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM credit_card_repayment_summaries WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.close();
  });

  // 建立一組 fixture：1 個銀行帳戶（付款）＋ 3 張關聯信用卡（欠款 6000／3000／1000，TWD）
  function setupTwdFixture(): { bankId: string; cardIds: string[] } {
    const db = getDB();
    const bankId = uid();
    const cardIds = [uid(), uid(), uid()];
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [bankId, userId, '台銀活存', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    const debts = [6000, 3000, 1000];
    const createdDates = ['2026-02-01', '2026-03-01', '2026-04-01'];
    cardIds.forEach((cid, i) => {
      db.run(
        "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [cid, userId, `卡${i + 1}`, 'credit_card', '信用卡', 'TWD', 0, bankId, createdDates[i], now]
      );
      // 建立一筆 expense 讓卡片欠款（餘額為負）：欠款 = 6000/3000/1000
      db.run(
        "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [uid(), userId, 'expense', debts[i], 'TWD', debts[i], debts[i], '2026-08-10', cid, '消費', now, now]
      );
    });
    saveDB();
    return { bankId, cardIds };
  }

  // ── V1/V2 既有驗證 ──
  test('V1：缺 fromAccountId → 400（沿用既有純訊息、無 code）', async () => {
    const { bankId } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { date: '2026-08-15', totalAmount: 5000 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, '應有 error 訊息');
    assert.equal(body.code, undefined, 'V1 沿用既有純訊息，不帶 code');
  });

  test('V2：付款帳戶為信用卡 → 400（沿用既有純訊息、無 code）', async () => {
    const db = getDB();
    const cardId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [cardId, userId, '信用卡付款', 'credit_card', '信用卡', 'TWD', 0, null, '2026-01-01', now]
    );
    saveDB();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: cardId, date: '2026-08-15', totalAmount: 5000 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
    assert.equal(body.code, undefined, 'V2 沿用既有純訊息，不帶 code');
  });

  test('V3：totalAmount 非正整數 → 400 InvalidTotalAmount', async () => {
    const { bankId } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5.5 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'InvalidTotalAmount');
  });

  test('V5：totalAmount < 納入張數 → 400 TotalAmountTooSmall', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    // 3 張卡 → 至少需 3
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 2 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'TotalAmountTooSmall');
  });

  test('V4：無關聯卡／全無欠款 → 400 NoPayableCards', async () => {
    const db = getDB();
    const bankId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [bankId, userId, '無卡銀行', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    saveDB();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5000 }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'NoPayableCards');
  });

  // ── 核心寫入與分配 ──
  test('等比例分配寫入：T=5000, debts=[6000,3000,1000] → [3000,1500,500]（FR-002）', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5000 }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.summaryId, '應回傳 summaryId');
    assert.equal(body.totalAmount, 5000);
    assert.equal(body.allocations.length, 3);
    const got = body.allocations.map((a: any) => a.amount);
    assert.deepEqual(got, [3000, 1500, 500]);
    // 總和恆等
    assert.equal(got.reduce((a: number, b: number) => a + b, 0), 5000);
    // 2N 筆交易皆帶同一 repayment_summary_id（FR-020a）
    const txs = queryAll('SELECT repayment_summary_id FROM transactions WHERE user_id = ? AND repayment_summary_id != ?', [userId, '']);
    assert.ok(txs.length >= 6, '應至少 6 筆還款交易');
    const summaryIds = new Set(txs.map((t) => t.repayment_summary_id));
    assert.equal(summaryIds.size, 1, '2N 筆交易應帶同一 summaryId');
    // 摘要 input_mode = 'total'
    const summary = queryOne('SELECT input_mode, from_account_name FROM credit_card_repayment_summaries WHERE id = ?', [body.summaryId]);
    assert.equal(summary?.input_mode, 'total');
    assert.ok(summary?.from_account_name, 'from_account_name 應有快照值');
  });

  test('回應含 balanceAfter（FR-020）', async () => {
    const { bankId } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5000 }));
    const body = await res.json();
    for (const a of body.allocations) {
      assert.ok(typeof a.balanceAfter === 'number', '每張卡應有 balanceAfter');
      assert.ok(a.cardName, '每張卡應有 cardName 快照');
      assert.ok(a.cardCurrency, '每張卡應有 cardCurrency');
    }
  });

  // ── 舊格式加總重算（FR-019a／019b）──
  test('舊格式 repayments[] 加總後重算：指定 1000/4000 仍寫成 3000/1500/500 且納入第三張（FR-019a）', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    // 加總 = 5000，故應與 totalAmount=5000 相同結果
    const res = await repaymentRoute.POST(authedRequest('POST', url, {
      fromAccountId: bankId, date: '2026-08-15',
      repayments: [{ cardId: cardIds[0], amount: 1000 }, { cardId: cardIds[1], amount: 4000 }],
    }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totalAmount, 5000);
    assert.deepEqual(body.allocations.map((a: any) => a.amount), [3000, 1500, 500]);
    // input_mode 應為 'legacy_items'
    const summary = queryOne('SELECT input_mode FROM credit_card_repayment_summaries WHERE id = ?', [body.summaryId]);
    assert.equal(summary?.input_mode, 'legacy_items');
  });

  test('舊格式加總帶小數 → 400 InvalidTotalAmount（FR-019b）', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, {
      fromAccountId: bankId, date: '2026-08-15',
      repayments: [{ cardId: cardIds[0], amount: 1000.5 }, { cardId: cardIds[1], amount: 4000 }],
    }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'InvalidTotalAmount');
  });

  test('舊格式加總後小於納入張數 → 400（FR-019b／FR-008a）', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    // 加總 = 2，但 3 張卡 → 太小
    const res = await repaymentRoute.POST(authedRequest('POST', url, {
      fromAccountId: bankId, date: '2026-08-15',
      repayments: [{ cardId: cardIds[0], amount: 1 }, { cardId: cardIds[1], amount: 1 }],
    }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'TotalAmountTooSmall');
  });

  test('totalAmount 與 repayments 併存時以前者為準（FR-019）', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, {
      fromAccountId: bankId, date: '2026-08-15', totalAmount: 10000,
      repayments: [{ cardId: cardIds[0], amount: 1 }],
    }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totalAmount, 10000, '應以 totalAmount 為準');
    assert.deepEqual(body.allocations.map((a: any) => a.amount), [6000, 3000, 1000]);
    const summary = queryOne('SELECT input_mode FROM credit_card_repayment_summaries WHERE id = ?', [body.summaryId]);
    assert.equal(summary?.input_mode, 'total', '併存時 input_mode 應為 total');
  });

  test('兩者皆無 → 400', async () => {
    const { bankId } = setupTwdFixture();
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15' }));
    assert.equal(res.status, 400);
  });

  // ── 摘要讀取與陳舊判定（FR-020b）──
  test('摘要只改備註 → stale: false；改金額 → modified；刪除 → deleted', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const postUrl = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', postUrl, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5000 }));
    const { summaryId } = await res.json();
    const summaryUrl = `http://localhost/api/credit-card-repayment-summaries/${summaryId}`;

    // (a) 一開始應 stale: false，各卡 intact
    const r0 = await summaryRoute.GET(authedRequest('GET', summaryUrl), { params: Promise.resolve({ id: summaryId }) });
    assert.equal(r0.status, 200);
    const b0 = await r0.json();
    assert.equal(b0.stale, false);
    assert.ok(b0.allocations.every((a: any) => a.status === 'intact'));
    assert.equal(b0.inputMode, 'total');
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b0.createdAt), 'createdAt 應為毫秒精度 UTC ISO 8601');
    assert.ok(b0.fromAccount.name, 'fromAccount.name 取自快照');

    // (b) 只改備註 → 仍 stale: false
    const txs = queryAll('SELECT id FROM transactions WHERE user_id = ? AND repayment_summary_id = ? AND type = ?', [userId, summaryId, 'transfer_out']);
    const firstOutId = txs[0].id as string;
    // 直接改 note（模擬備註修改，不經端點以聚焦陳舊判定）
    getDB().run('UPDATE transactions SET note = ?, updated_at = ? WHERE id = ?', ['改備註', now, firstOutId]);
    saveDB();
    const r1 = await summaryRoute.GET(authedRequest('GET', summaryUrl), { params: Promise.resolve({ id: summaryId }) });
    const b1 = await r1.json();
    assert.equal(b1.stale, false, '只改備註不應 stale');

    // (c) 改金額 → modified → stale: true
    getDB().run('UPDATE transactions SET original_amount = ?, twd_amount = ?, amount = ?, updated_at = ? WHERE id = ?', [9999, 9999, 9999, now, firstOutId]);
    saveDB();
    const r2 = await summaryRoute.GET(authedRequest('GET', summaryUrl), { params: Promise.resolve({ id: summaryId }) });
    const b2 = await r2.json();
    assert.equal(b2.stale, true);
    assert.ok(b2.allocations.some((a: any) => a.status === 'modified'), '應有卡為 modified');

    // (d) 刪除一筆 → deleted → stale: true
    getDB().run('DELETE FROM transactions WHERE id = ?', [firstOutId]);
    saveDB();
    const r3 = await summaryRoute.GET(authedRequest('GET', summaryUrl), { params: Promise.resolve({ id: summaryId }) });
    const b3 = await r3.json();
    assert.equal(b3.stale, true);
    assert.ok(b3.allocations.some((a: any) => a.status === 'deleted'), '應有卡為 deleted');
  });

  test('摘要 fromAccount.name 為快照，帳戶改名後仍回傳原名稱（FR-020a）', async () => {
    const { bankId } = setupTwdFixture();
    const postUrl = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', postUrl, { fromAccountId: bankId, date: '2026-08-15', totalAmount: 5000 }));
    const { summaryId } = await res.json();
    // 改帳戶名
    getDB().run('UPDATE accounts SET name = ?, updated_at = ? WHERE id = ?', ['改名後的銀行', now, bankId]);
    saveDB();
    const summaryUrl = `http://localhost/api/credit-card-repayment-summaries/${summaryId}`;
    const r = await summaryRoute.GET(authedRequest('GET', summaryUrl), { params: Promise.resolve({ id: summaryId }) });
    const b = await r.json();
    assert.equal(b.fromAccount.name, '台銀活存', '摘要應維持寫入當時的帳戶名稱快照');
  });

  test('摘要不存在或不屬於本人 → 404', async () => {
    const url = 'http://localhost/api/credit-card-repayment-summaries/nonexistent';
    const r = await summaryRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: 'nonexistent' }) });
    assert.equal(r.status, 404);
  });

  // ── 快照端點（US2）──
  test('快照端點：cards 已排序、debt 為正整數、不含 createdAt、totalDebt 正確', async () => {
    const { bankId, cardIds } = setupTwdFixture();
    const url = `http://localhost/api/accounts/${bankId}/repayment-cards`;
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: bankId }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.cards.length, 3);
    // 標準排序：created_at 早→晚 → cardIds[0],[1],[2]
    assert.deepEqual(body.cards.map((c: any) => c.id), cardIds);
    assert.deepEqual(body.cards.map((c: any) => c.debt), [6000, 3000, 1000]);
    assert.equal(body.totalDebt, 10000);
    assert.equal(body.minTotalAmount, 3);
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.snapshotAt));
    // 不含 createdAt
    for (const c of body.cards) assert.equal('createdAt' in c, false, '不得輸出 createdAt');
    // 每張卡只有 5 個欄位
    for (const c of body.cards) {
      const keys = Object.keys(c).sort();
      assert.deepEqual(keys, ['currency', 'debt', 'debtInCardCurrency', 'id', 'name']);
    }
    assert.equal(body.fromAccount.id, bankId);
    assert.equal(body.fromAccount.currency, 'TWD');
  });

  test('快照端點：無關聯卡或全無欠款 → cards 為空陣列（FR-009）', async () => {
    const db = getDB();
    const bankId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [bankId, userId, '空銀行', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    saveDB();
    const url = `http://localhost/api/accounts/${bankId}/repayment-cards`;
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: bankId }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.cards, []);
    assert.equal(body.totalDebt, 0);
    assert.equal(body.minTotalAmount, 0);
  });

  test('快照端點：付款帳戶為信用卡 → 400 NotCreditCardPayer', async () => {
    const db = getDB();
    const cardId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [cardId, userId, '卡當付款', 'credit_card', '信用卡', 'TWD', 0, null, '2026-01-01', now]
    );
    saveDB();
    const url = `http://localhost/api/accounts/${cardId}/repayment-cards`;
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: cardId }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'NotCreditCardPayer');
  });

  test('快照端點：非本人帳戶 → 404', async () => {
    const url = 'http://localhost/api/accounts/nonexistent/repayment-cards';
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: 'nonexistent' }) });
    assert.equal(res.status, 404);
  });

  test('快照端點：未設關聯銀行的有欠款卡不被納入（FR-003 收斂）', async () => {
    const db = getDB();
    const bankId = uid();
    const unlinkedCardId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [bankId, userId, '銀行A', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [unlinkedCardId, userId, '未關聯卡', 'credit_card', '信用卡', 'TWD', 0, '', '2026-02-01', now]
    );
    db.run(
      "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, account_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [uid(), userId, 'expense', 5000, 'TWD', 5000, 5000, '2026-08-10', unlinkedCardId, now, now]
    );
    saveDB();
    const url = `http://localhost/api/accounts/${bankId}/repayment-cards`;
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: bankId }) });
    const body = await res.json();
    assert.deepEqual(body.cards, [], '未設關聯銀行的卡不應被納入');
  });

  test('快照端點：以非銀行帳戶為付款來源 → cards 為空陣列', async () => {
    const db = getDB();
    const cashId = uid();
    const cardId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [cashId, userId, '現金帳戶', 'cash', '現金', 'TWD', 100000, null, '2026-01-01', now]
    );
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [cardId, userId, '卡關聯現金', 'credit_card', '信用卡', 'TWD', 0, cashId, '2026-02-01', now]
    );
    db.run(
      "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, account_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [uid(), userId, 'expense', 5000, 'TWD', 5000, 5000, '2026-08-10', cardId, now, now]
    );
    saveDB();
    const url = `http://localhost/api/accounts/${cashId}/repayment-cards`;
    const res = await cardsRoute.GET(authedRequest('GET', url), { params: Promise.resolve({ id: cashId }) });
    const body = await res.json();
    assert.deepEqual(body.cards, [], '以非銀行帳戶為付款來源時不應納入（FR-003）');
  });

  // ── 007：三個共用函式的直接單元測試（不透過 HTTP 路由）──
  // 驗證 computeRepaymentAllocation／executeRepayment／evaluateRepaymentSummary 的行為與既有路由一致
  // （FR-002、FR-010、FR-012；research.md 第 13 節三層測試分工的第二層）。

  test('computeRepaymentAllocation() 的 balanceAfter 與既有 POST 路由回應數值相同（FR-010）', async () => {
    const { bankId } = setupTwdFixture();
    const fromCurrency = 'TWD';
    const cards = collectPayableCards(userId, bankId, fromCurrency);
    const totalAmount = 5000;

    // 直接呼叫共用函式
    const details = computeRepaymentAllocation(userId, fromCurrency, totalAmount, cards);
    // 透過既有路由送出（同一組輸入）
    const url = 'http://localhost/api/accounts/credit-card-repayment';
    const res = await repaymentRoute.POST(authedRequest('POST', url, { fromAccountId: bankId, date: '2026-08-15', totalAmount }));
    const body = await res.json();

    assert.equal(details.length, body.allocations.length);
    for (let i = 0; i < details.length; i++) {
      assert.equal(details[i].balanceAfter, body.allocations[i].balanceAfter, `第 ${i} 張卡 balanceAfter 應相同`);
      assert.equal(details[i].transferAmount, body.allocations[i].amount, `第 ${i} 張卡 amount 應相同`);
      assert.equal(details[i].inOriginal, body.allocations[i].amountInCardCurrency, `第 ${i} 張卡 amountInCardCurrency 應相同`);
    }
  });

  test('executeRepayment() aiCreated:true 寫入 ai_created=1；aiCreated:false 寫入 ai_created=0（FR-007 單元層驗證）', async () => {
    const { bankId } = setupTwdFixture();
    const fromCurrency = 'TWD';
    const cards = collectPayableCards(userId, bankId, fromCurrency);
    const totalAmount = 5000;

    // aiCreated: true（MCP 路徑）
    const detailsTrue = computeRepaymentAllocation(userId, fromCurrency, totalAmount, cards);
    const { summaryId: summaryIdTrue } = executeRepayment({
      userId, fromAccountId: bankId, fromAccountName: '台銀活存', fromCurrency, date: '2026-08-15',
      totalAmount, inputMode: 'total', details: detailsTrue, aiCreated: true,
    });
    const txsTrue = queryAll('SELECT ai_created FROM transactions WHERE user_id = ? AND repayment_summary_id = ?', [userId, summaryIdTrue]);
    assert.ok(txsTrue.length >= 2 * cards.length, '應寫入 2N 筆交易');
    assert.ok(txsTrue.every((t) => Number(t.ai_created) === 1), 'aiCreated:true 時所有交易 ai_created 應為 1');

    // aiCreated: false（既有網頁/App 路徑）
    const { bankId: bankId2 } = setupTwdFixture();
    const cards2 = collectPayableCards(userId, bankId2, fromCurrency);
    const detailsFalse = computeRepaymentAllocation(userId, fromCurrency, totalAmount, cards2);
    const { summaryId: summaryIdFalse } = executeRepayment({
      userId, fromAccountId: bankId2, fromAccountName: '台銀活存', fromCurrency, date: '2026-08-15',
      totalAmount, inputMode: 'total', details: detailsFalse, aiCreated: false,
    });
    const txsFalse = queryAll('SELECT ai_created FROM transactions WHERE user_id = ? AND repayment_summary_id = ?', [userId, summaryIdFalse]);
    assert.ok(txsFalse.every((t) => Number(t.ai_created) === 0), 'aiCreated:false 時所有交易 ai_created 應為 0');
  });

  test('evaluateRepaymentSummary()：完全未異動 stale:false 全 intact；刪除一組配對後該卡 deleted 且 stale:true（FR-012）', async () => {
    const { bankId } = setupTwdFixture();
    const fromCurrency = 'TWD';
    const cards = collectPayableCards(userId, bankId, fromCurrency);
    const totalAmount = 5000;
    const details = computeRepaymentAllocation(userId, fromCurrency, totalAmount, cards);
    const { summaryId } = executeRepayment({
      userId, fromAccountId: bankId, fromAccountName: '台銀活存', fromCurrency, date: '2026-08-15',
      totalAmount, inputMode: 'total', details, aiCreated: false,
    });

    const summary = queryOne(
      'SELECT date, from_account_id, allocations FROM credit_card_repayment_summaries WHERE id = ? AND user_id = ?',
      [summaryId, userId]
    ) as { date: string; from_account_id: string; allocations: string };

    // (a) 完全未異動 → stale: false，全 intact
    const r0 = evaluateRepaymentSummary(userId, summary);
    assert.equal(r0.stale, false);
    assert.ok(r0.allocations.every((a) => a.status === 'intact'), '未異動時所有卡應為 intact');

    // (b) 刪除其中一組配對（一張卡的轉出／轉入）→ 該卡 deleted，整體 stale: true
    const txs = queryAll('SELECT id FROM transactions WHERE user_id = ? AND repayment_summary_id = ? AND type = ?', [userId, summaryId, 'transfer_out']);
    const firstOutId = txs[0].id as string;
    getDB().run('DELETE FROM transactions WHERE repayment_summary_id = ? AND linked_id = ?', [summaryId, firstOutId]);
    getDB().run('DELETE FROM transactions WHERE id = ?', [firstOutId]);
    saveDB();

    const r1 = evaluateRepaymentSummary(userId, summary);
    assert.equal(r1.stale, true);
    assert.ok(r1.allocations.some((a) => a.status === 'deleted'), '刪除一組配對後應有卡為 deleted');
  });
}