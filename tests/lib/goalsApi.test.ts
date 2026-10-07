// tests/lib/goalsApi.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
//
// 涵蓋 issue #260 的端點行為：
//  - GET/POST /api/goals：建立（含帳戶與分類兩種綁定）、驗證拒絕、跨使用者隔離
//  - GET/PUT/DELETE /api/goals/{id}：進度回報、編輯不改 start_date、刪除
//  - GET/POST /api/repayment-plans 與 /api/repayment-plans/{id}：攤還表、清單摘要、更新與刪除
//  - 帳本授權：viewer 可讀但不可寫
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/goalsApi.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('goalsApi（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const goalsRoute = await import('../../app/api/goals/route.ts');
  const goalItemRoute = await import('../../app/api/goals/[id]/route.ts');
  const plansRoute = await import('../../app/api/repayment-plans/route.ts');
  const planItemRoute = await import('../../app/api/repayment-plans/[id]/route.ts');

  await initDB();

  const userId = 'test_goals_' + uid();
  const otherUserId = 'test_goals_other_' + uid();
  const viewerId = 'test_goals_viewer_' + uid();
  const ledgerId = 'shared_goals_' + uid();
  const now = Date.now();

  function authedRequest(user: string, method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const { token } = createLoginSession(user, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}`, ...extraHeaders };
    if (method !== 'GET') headers.Origin = new URL(url).origin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  function insertUser(id: string) {
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [id, `${id}@example.com`, 'x', '測試使用者', new Date().toISOString()],
    );
  }

  insertUser(userId);
  insertUser(otherUserId);
  insertUser(viewerId);

  // 共享帳本：userId 為 owner、viewerId 為 viewer（驗證唯讀角色不可寫入）。
  // data_owner_id 必須與任何個人帳本相異（見 lib/ledgerCore.ts createSharedLedger），
  // 否則 users 上的 UNIQUE(data_owner_id) 會與自動建立的 'personal:<userId>' 衝突。
  const dataOwnerId = `ledger-data:${uid()}`;
  getDB().run(
    `INSERT INTO financial_ledgers (id, name, owner_user_id, data_owner_id, is_shared, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [ledgerId, 'Goal ledger', userId, dataOwnerId, now, now],
  );
  getDB().run(
    "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,?,?)",
    [ledgerId, userId, 'owner', now],
  );
  getDB().run(
    "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,?,?)",
    [ledgerId, viewerId, 'viewer', now],
  );

  const goalIds: string[] = [];
  const planIds: string[] = [];

  test.after(() => {
    const db = getDB();
    db.run('DELETE FROM savings_goals WHERE user_id = ?', [userId]);
    db.run('DELETE FROM repayment_plans WHERE user_id = ?', [userId]);
    for (const id of [userId, otherUserId, viewerId]) db.run('DELETE FROM login_sessions WHERE user_id = ?', [id]);
    db.run('DELETE FROM ledger_members WHERE ledger_id = ?', [ledgerId]);
    db.run('DELETE FROM financial_ledgers WHERE id = ?', [ledgerId]);
    for (const id of [userId, otherUserId, viewerId]) db.run('DELETE FROM users WHERE id = ?', [id]);
    db.close();
  });

  // ── 儲蓄目標 ──

  test('POST /api/goals：建立未綁定的目標並回傳初始進度', async () => {
    const res = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '買房頭期款',
      targetAmount: 3_000_000,
      targetDate: '2028-06-30',
    }));
    assert.equal(res.status, 201);
    const body = await res.json();
    goalIds.push(body.id);
    assert.equal(body.name, '買房頭期款');
    assert.equal(body.targetAmount, 3_000_000);
    assert.equal(body.targetDate, '2028-06-30');
    assert.equal(body.contributedAmount, 0);
    assert.equal(body.remainingAmount, 3_000_000);
    assert.equal(body.achieved, false);
    assert.equal(body.accountId, null);
    assert.equal(body.categoryId, null);
    assert.ok(typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate), '應記錄建立當日為起算日');
  });

  test('POST /api/goals：驗證失敗回 400 且帶欄位名稱', async () => {
    const bad = [
      [{ name: '', targetAmount: 100, targetDate: '2028-06-30' }, 'name'],
      [{ name: 'a', targetAmount: 0, targetDate: '2028-06-30' }, 'targetAmount'],
      [{ name: 'a', targetAmount: 100, targetDate: '2028-06-31' }, 'targetDate'],
      [{ name: 'a', targetAmount: 100, targetDate: '2028-06-30', accountId: 'x', categoryId: 'y' }, 'categoryId'],
    ] as const;
    for (const [payload, field] of bad) {
      const res = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', payload));
      assert.equal(res.status, 400, `${field} 應被拒絕`);
      const body = await res.json();
      assert.equal(body.code, 'ValidationError');
      assert.equal(body.field, field);
    }
  });

  test('POST /api/goals：綁定不存在或非本人的帳戶／分類回 400', async () => {
    const missingAccount = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: 'a', targetAmount: 100, targetDate: '2028-06-30', accountId: 'no-such-account',
    }));
    assert.equal(missingAccount.status, 400);
    assert.equal((await missingAccount.json()).field, 'accountId');

    const missingCategory = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: 'a', targetAmount: 100, targetDate: '2028-06-30', categoryId: 'no-such-category',
    }));
    assert.equal(missingCategory.status, 400);
    assert.equal((await missingCategory.json()).field, 'categoryId');
  });

  test('GET /api/goals：綁定帳戶的目標以帳戶餘額為已存金額', async () => {
    const accountId = uid();
    getDB().run(
      'INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [accountId, userId, '儲蓄專戶', 'bank', '銀行', 'TWD', 250_000, '2026-01-01', now],
    );

    const created = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '裝潢基金', targetAmount: 500_000, targetDate: '2027-12-31', accountId,
    }));
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    goalIds.push(createdBody.id);
    assert.equal(createdBody.contributedAmount, 250_000, '已存應等於帳戶餘額');
    assert.equal(createdBody.remainingAmount, 250_000);
    assert.equal(createdBody.accountId, accountId);

    const list = await goalsRoute.GET(authedRequest(userId, 'GET', 'http://localhost/api/goals'));
    assert.equal(list.status, 200);
    const listBody = await list.json() as Array<{ id: string }>;
    assert.ok(listBody.some(goal => goal.id === createdBody.id), '清單應包含剛建立的目標');

    getDB().run('DELETE FROM accounts WHERE id = ?', [accountId]);
  });

  test('GET /api/goals：綁定分類的目標以建立日起該分類支出累計為已存', async () => {
    const categoryId = uid();
    getDB().run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,?,?,?)',
      [categoryId, userId, '教育金', 'expense', '#6366f1', 0, 0, ''],
    );

    const created = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '進修基金', targetAmount: 60_000, targetDate: '2027-06-30', categoryId,
    }));
    assert.equal(created.status, 201);
    const body = await created.json();
    goalIds.push(body.id);
    // 起算日為今天，故先前的交易不計入；新增一筆今日支出後才會反映。
    assert.equal(body.contributedAmount, 0, '建立當下的歷史支出不應計入');

    const today = body.startDate as string;
    getDB().run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, category_id, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), userId, 'expense', 12_000, 'TWD', 12_000, 12_000, today, categoryId, 0, now, now],
    );
    // 排除統計的交易不應計入。
    getDB().run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, category_id, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), userId, 'expense', 99_999, 'TWD', 99_999, 99_999, today, categoryId, 1, now, now],
    );

    const detail = await goalItemRoute.GET(authedRequest(userId, 'GET', `http://localhost/api/goals/${body.id}`), ctx(body.id));
    assert.equal(detail.status, 200);
    const detailBody = await detail.json();
    assert.equal(detailBody.contributedAmount, 12_000, '已存應只計入未排除統計的分類支出');
    assert.equal(detailBody.remainingAmount, 48_000);

    getDB().run('DELETE FROM transactions WHERE user_id = ? AND category_id = ?', [userId, categoryId]);
    getDB().run('DELETE FROM categories WHERE id = ?', [categoryId]);
  });

  test('PUT /api/goals/{id}：更新欄位但不更動 start_date', async () => {
    const created = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '旅遊基金', targetAmount: 100_000, targetDate: '2027-03-31',
    }));
    const body = await created.json();
    goalIds.push(body.id);
    const originalStart = body.startDate;

    const res = await goalItemRoute.PUT(authedRequest(userId, 'PUT', `http://localhost/api/goals/${body.id}`, {
      name: '歐洲旅遊基金', targetAmount: 180_000, targetDate: '2027-09-30',
    }), ctx(body.id));
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.name, '歐洲旅遊基金');
    assert.equal(updated.targetAmount, 180_000);
    assert.equal(updated.targetDate, '2027-09-30');
    assert.equal(updated.startDate, originalStart, '編輯不得改動起算日，以免歷史進度失真');
  });

  test('GET/PUT/DELETE /api/goals/{id}：他人或不存在一律 404', async () => {
    const created = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '私有目標', targetAmount: 1_000, targetDate: '2027-01-31',
    }));
    const body = await created.json();
    goalIds.push(body.id);

    const foreignGet = await goalItemRoute.GET(authedRequest(otherUserId, 'GET', `http://localhost/api/goals/${body.id}`), ctx(body.id));
    assert.equal(foreignGet.status, 404, '其他使用者不得讀取');
    const foreignPut = await goalItemRoute.PUT(authedRequest(otherUserId, 'PUT', `http://localhost/api/goals/${body.id}`, {
      name: 'x', targetAmount: 1, targetDate: '2027-01-31',
    }), ctx(body.id));
    assert.equal(foreignPut.status, 404, '其他使用者不得編輯');
    const foreignDelete = await goalItemRoute.DELETE(authedRequest(otherUserId, 'DELETE', `http://localhost/api/goals/${body.id}`), ctx(body.id));
    assert.equal(foreignDelete.status, 404, '其他使用者不得刪除');

    const missing = await goalItemRoute.GET(authedRequest(userId, 'GET', 'http://localhost/api/goals/no-such-goal'), ctx('no-such-goal'));
    assert.equal(missing.status, 404);

    const ownDelete = await goalItemRoute.DELETE(authedRequest(userId, 'DELETE', `http://localhost/api/goals/${body.id}`), ctx(body.id));
    assert.equal(ownDelete.status, 200);
    const afterDelete = await goalItemRoute.GET(authedRequest(userId, 'GET', `http://localhost/api/goals/${body.id}`), ctx(body.id));
    assert.equal(afterDelete.status, 404, '刪除後應查不到');
  });

  // ── 還款計畫 ──

  test('POST /api/repayment-plans 與 GET {id}：自動產生攤還表', async () => {
    const created = await plansRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/repayment-plans', {
      name: '信貸', principal: 240_000, annualRatePercent: 6, periods: 24, startDate: '2026-01-15',
    }));
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    planIds.push(createdBody.id);

    const res = await planItemRoute.GET(authedRequest(userId, 'GET', `http://localhost/api/repayment-plans/${createdBody.id}`), ctx(createdBody.id));
    assert.equal(res.status, 200);
    const plan = await res.json();
    assert.equal(plan.principal, 240_000);
    assert.equal(plan.periods, 24);
    assert.equal(plan.annualRatePercent, 6);
    assert.equal(plan.schedule.payments.length, 24, '應產生 24 期攤還表');
    assert.equal(plan.schedule.payments[23].remainingBalance, 0, '最後一期後餘額應歸零');
    assert.equal(plan.finalDueDate, '2027-12-15', '首次應繳日 + 23 個月');
    assert.ok(plan.monthlyPayment > 0);
    assert.ok(plan.totalInterest > 0);
    // 逐期本金加總應等於原始本金（允許逐期四捨五入的 1 分累積誤差）。
    const principalSum = (plan.schedule.payments as Array<{ principal: number }>).reduce((sum, row) => sum + row.principal, 0);
    assert.ok(Math.abs(principalSum - 240_000) <= 0.01, `本金加總 ${principalSum} 應等於 240000`);
  });

  test('GET /api/repayment-plans：清單回摘要（不含完整攤還表）', async () => {
    const list = await plansRoute.GET(authedRequest(userId, 'GET', 'http://localhost/api/repayment-plans'));
    assert.equal(list.status, 200);
    const body = await list.json() as Array<Record<string, unknown>>;
    assert.ok(body.length >= 1);
    for (const plan of body) {
      assert.equal(plan.schedule, undefined, '清單端點不應回傳完整攤還表');
      assert.equal(typeof plan.monthlyPayment, 'number');
      assert.equal(typeof plan.paidPeriods, 'number');
      assert.equal(typeof plan.remainingBalance, 'number');
    }
  });

  test('POST /api/repayment-plans：驗證失敗回 400', async () => {
    const bad = [
      [{ name: '', principal: 1000, periods: 12, startDate: '2026-01-01' }, 'name'],
      [{ name: 'a', principal: 0, periods: 12, startDate: '2026-01-01' }, 'principal'],
      [{ name: 'a', principal: 1000, annualRatePercent: -1, periods: 12, startDate: '2026-01-01' }, 'annualRatePercent'],
      [{ name: 'a', principal: 1000, annualRatePercent: 120, periods: 12, startDate: '2026-01-01' }, 'annualRatePercent'],
      [{ name: 'a', principal: 1000, periods: 0, startDate: '2026-01-01' }, 'periods'],
      [{ name: 'a', principal: 1000, periods: 601, startDate: '2026-01-01' }, 'periods'],
      [{ name: 'a', principal: 1000, periods: 12, startDate: '2026-02-30' }, 'startDate'],
    ] as const;
    for (const [payload, field] of bad) {
      const res = await plansRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/repayment-plans', payload));
      assert.equal(res.status, 400, `${field} 應被拒絕`);
      assert.equal((await res.json()).field, field);
    }
  });

  test('PUT /api/repayment-plans/{id}：更新後攤還表隨之重算', async () => {
    const created = await plansRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/repayment-plans', {
      name: '車貸', principal: 600_000, annualRatePercent: 3, periods: 60, startDate: '2026-03-01',
    }));
    const createdBody = await created.json();
    planIds.push(createdBody.id);

    const res = await planItemRoute.PUT(authedRequest(userId, 'PUT', `http://localhost/api/repayment-plans/${createdBody.id}`, {
      name: '車貸（增貸）', principal: 720_000, annualRatePercent: 3, periods: 48, startDate: '2026-03-01',
    }), ctx(createdBody.id));
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.name, '車貸（增貸）');
    assert.equal(updated.principal, 720_000);
    assert.equal(updated.periods, 48);
    assert.equal(updated.schedule.payments.length, 48);
    assert.equal(updated.schedule.payments[47].remainingBalance, 0);
    assert.equal(updated.finalDueDate, '2030-02-01', '首次應繳日 + 47 個月');
  });

  test('DELETE /api/repayment-plans/{id}：他人 404、本人可刪除', async () => {
    const created = await plansRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/repayment-plans', {
      name: '待刪除', principal: 10_000, periods: 12, startDate: '2026-01-01',
    }));
    const body = await created.json();

    const foreign = await planItemRoute.DELETE(authedRequest(otherUserId, 'DELETE', `http://localhost/api/repayment-plans/${body.id}`), ctx(body.id));
    assert.equal(foreign.status, 404);

    const own = await planItemRoute.DELETE(authedRequest(userId, 'DELETE', `http://localhost/api/repayment-plans/${body.id}`), ctx(body.id));
    assert.equal(own.status, 200);
    assert.equal(
      (await planItemRoute.GET(authedRequest(userId, 'GET', `http://localhost/api/repayment-plans/${body.id}`), ctx(body.id))).status,
      404,
    );
  });

  // ── 帳本授權 ──

  test('共享帳本：viewer 可讀目標與計畫，但任何寫入回 403', async () => {
    const ledgerHeader = { 'x-ledger-id': ledgerId };

    const readGoals = await goalsRoute.GET(authedRequest(viewerId, 'GET', 'http://localhost/api/goals', undefined, ledgerHeader));
    assert.equal(readGoals.status, 200, 'viewer 應可讀取目標');
    const readPlans = await plansRoute.GET(authedRequest(viewerId, 'GET', 'http://localhost/api/repayment-plans', undefined, ledgerHeader));
    assert.equal(readPlans.status, 200, 'viewer 應可讀取還款計畫');

    const writeGoal = await goalsRoute.POST(authedRequest(viewerId, 'POST', 'http://localhost/api/goals', {
      name: 'viewer 嘗試新增', targetAmount: 100, targetDate: '2027-01-01',
    }, ledgerHeader));
    assert.equal(writeGoal.status, 403, 'viewer 不得新增目標');

    const writePlan = await plansRoute.POST(authedRequest(viewerId, 'POST', 'http://localhost/api/repayment-plans', {
      name: 'viewer 嘗試新增', principal: 1000, periods: 12, startDate: '2026-01-01',
    }, ledgerHeader));
    assert.equal(writePlan.status, 403, 'viewer 不得新增還款計畫');
  });

  test('共享帳本：owner 寫入的目標歸屬於帳本資料擁有者', async () => {
    const res = await goalsRoute.POST(authedRequest(userId, 'POST', 'http://localhost/api/goals', {
      name: '帳本共同目標', targetAmount: 200_000, targetDate: '2027-12-31',
    }, { 'x-ledger-id': ledgerId }));
    assert.equal(res.status, 201);
    const body = await res.json();
    goalIds.push(body.id);

    const row = getDB().prepare('SELECT user_id FROM savings_goals WHERE id = ?');
    row.bind([body.id]);
    assert.ok(row.step());
    assert.equal(row.getAsObject().user_id, dataOwnerId, '資料應歸屬於帳本資料擁有者');
    row.free();
  });

  // ── 使用者刪除清理 ──

  test('刪除使用者時一併清除目標與還款計畫', async () => {
    const tempId = 'test_goals_cascade_' + uid();
    insertUser(tempId);
    getDB().run(
      'INSERT INTO savings_goals (id, user_id, name, target_amount, target_date, start_date, account_id, category_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), tempId, 'cascade', 100, '2027-01-01', '2026-01-01', '', '', now, now],
    );
    getDB().run(
      'INSERT INTO repayment_plans (id, user_id, name, principal, annual_rate, periods, start_date, account_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [uid(), tempId, 'cascade', 100, 0, 12, '2026-01-01', '', now, now],
    );

    const { deleteUserCompletely } = await import('../../lib/userDeletion.ts');
    await deleteUserCompletely(tempId);

    const goalsLeft = getDB().prepare('SELECT COUNT(*) AS count FROM savings_goals WHERE user_id = ?');
    goalsLeft.bind([tempId]);
    goalsLeft.step();
    assert.equal(Number(goalsLeft.getAsObject().count), 0, '刪除使用者後不應殘留目標');
    goalsLeft.free();

    const plansLeft = getDB().prepare('SELECT COUNT(*) AS count FROM repayment_plans WHERE user_id = ?');
    plansLeft.bind([tempId]);
    plansLeft.step();
    assert.equal(Number(plansLeft.getAsObject().count), 0, '刪除使用者後不應殘留還款計畫');
    plansLeft.free();
  });
}
