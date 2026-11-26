// tests/lib/apiV1Resources.test.ts — 公開 API /api/v1 帳戶與分類端點測試（API 自動化）。
//
// 涵蓋：查詢帳戶清單／新增支付帳戶／查詢分類清單、scope 最小權限、帳本範圍防護
// （非成員 404 不揭露存在性、viewer 寫入 403）、輸入驗證（400/413）與
// 雙層速率限制（429 + Retry-After）。
// 需要真實 PostgreSQL（DATABASE_URL）；未設定時略過（與 apiTokenWebhook.test.ts 相同策略）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/apiV1Resources.test.ts
import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  test('apiV1Resources（略過：未設定 DATABASE_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryAll } = await import('../../lib/db.ts');
  after(() => { getDB().close(); });
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createApiToken } = await import('../../lib/apiTokenAuth.ts');
  const { _resetApiRateLimitsForTests } = await import('../../lib/apiRateLimit.ts');
  const { NextRequest } = await import('next/server');
  const accountsRoute = await import('../../app/api/v1/accounts/route.ts');
  const categoriesRoute = await import('../../app/api/v1/categories/route.ts');
  const transactionsRoute = await import('../../app/api/v1/transactions/route.ts');
  const transactionCategoryRoute = await import('../../app/api/v1/transactions/[id]/category/route.ts');

  await initDB();
  beforeEach(() => _resetApiRateLimitsForTests());

  function createTestUser(userId: string): void {
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@test.local`, 'test', 'Test User', new Date().toISOString().slice(0, 10)],
    );
  }

  function cleanupUser(userId: string): void {
    getDB().run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM categories WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM api_tokens WHERE user_id = ?', [userId]);
    getDB().run(
      'DELETE FROM ledger_members WHERE user_id = ? OR ledger_id IN (SELECT id FROM financial_ledgers WHERE owner_user_id = ?)',
      [userId, userId],
    );
    getDB().run('DELETE FROM financial_ledgers WHERE owner_user_id = ?', [userId]);
    getDB().run('DELETE FROM users WHERE id = ?', [userId]);
  }

  interface ReqOptions {
    method?: string;
    url?: string;
    body?: unknown;
    rawBody?: string;
    ip?: string;
    ledgerId?: string;
    token?: string | null;
  }

  function buildRequest(route: string, opts: ReqOptions = {}) {
    const headers: Record<string, string> = {};
    if (opts.token !== null) headers['authorization'] = `Bearer ${opts.token}`;
    if (opts.ip) headers['x-forwarded-for'] = opts.ip;
    const raw = opts.rawBody !== undefined ? opts.rawBody : opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    if (raw !== undefined) headers['content-type'] = 'application/json';
    const url = new URL(opts.url || `http://localhost${route}`);
    if (opts.ledgerId) url.searchParams.set('ledgerId', opts.ledgerId);
    return new NextRequest(url, {
      method: opts.method || (raw === undefined ? 'GET' : 'POST'),
      headers,
      ...(raw === undefined ? {} : { body: raw }),
    });
  }

  test('GET /api/v1/accounts 回傳帳戶清單與餘額（scope accounts:read）', async () => {
    const userId = 'test_v1acc_' + uid();
    createTestUser(userId);
    try {
      const token = createApiToken(userId, '帳戶讀寫', ['accounts:read', 'accounts:write']).token;

      const created = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token, ip: '198.51.100.1',
        body: { name: '日常支出', category: 'bank', initialBalance: 1000, currency: 'TWD' },
      }));
      assert.equal(created.status, 201);
      const createdBody = await created.json();
      assert.equal(createdBody.account.name, '日常支出');
      assert.equal(createdBody.account.category, 'bank');
      assert.equal(createdBody.account.initialBalance, 1000);
      assert.equal(createdBody.account.isActive, true);

      const res = await accountsRoute.GET(buildRequest('/api/v1/accounts', { token, ip: '198.51.100.1' }));
      assert.equal(res.status, 200);
      const list = await res.json();
      assert.equal(list.accounts.length, 1);
      assert.equal(list.accounts[0].balance, 1000);
      assert.equal(list.accounts[0].twdBalance, 1000);
      assert.equal(list.accounts[0].statementClosingDay, null);

      // 唯讀 scope 無法寫入
      const readOnly = createApiToken(userId, '只讀', ['accounts:read']).token;
      const forbidden = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token: readOnly, ip: '198.51.100.2', body: { name: '無權建立' },
      }));
      assert.equal(forbidden.status, 403);
      assert.equal((await forbidden.json()).code, 'InsufficientScope');
    } finally {
      cleanupUser(userId);
    }
  });

  test('POST /api/v1/accounts 信用卡完整欄位（含扣款銀行與結帳日）', async () => {
    const userId = 'test_v1cc_' + uid();
    createTestUser(userId);
    try {
      const token = createApiToken(userId, '信用卡', ['accounts:write', 'accounts:read']).token;
      const bankRes = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token, ip: '198.51.100.3', body: { name: '扣款帳戶', category: 'bank' },
      }));
      const bankId = (await bankRes.json()).account.id;

      const res = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token, ip: '198.51.100.3',
        body: {
          name: '萬里遊信用卡',
          category: 'credit_card',
          currency: 'TWD',
          statementClosingDay: 25,
          overseasFeeRate: 1.5,
          linkedBankId: bankId,
        },
      }));
      assert.equal(res.status, 201);
      const card = (await res.json()).account;
      assert.equal(card.category, 'credit_card');
      assert.equal(card.statementClosingDay, 25);
      assert.equal(card.overseasFeeRate, 1.5);
      assert.equal(card.linkedBankId, bankId);
    } finally {
      cleanupUser(userId);
    }
  });

  test('POST /api/v1/accounts 輸入驗證（400/413，含欄位回報）', async () => {
    const userId = 'test_v1valid_' + uid();
    createTestUser(userId);
    try {
      const token = createApiToken(userId, '驗證', ['accounts:write']).token;
      const post = (body: unknown, raw?: string) =>
        accountsRoute.POST(buildRequest('/api/v1/accounts', {
          token, ip: '198.51.100.4', ...(raw !== undefined ? { rawBody: raw } : { body }),
        }));

      const longName = await post({ name: 'x'.repeat(65) });
      assert.equal(longName.status, 400);
      const longNameBody = await longName.json();
      assert.equal(longNameBody.code, 'ValidationError');
      assert.equal(longNameBody.field, 'name');

      const badDay = await post({ name: '卡', category: 'credit_card', statementClosingDay: 99 });
      assert.equal(badDay.status, 400);
      assert.equal((await badDay.json()).field, 'statementClosingDay');

      const badFee = await post({ name: '卡', category: 'credit_card', overseasFeeRate: 200 });
      assert.equal(badFee.status, 400);
      assert.equal((await badFee.json()).field, 'overseasFeeRate');

      const badBank = await post({ name: '卡', category: 'credit_card', linkedBankId: 'nope' });
      assert.equal(badBank.status, 400);

      const badBalance = await post({ name: '帳戶', initialBalance: 'abc' });
      assert.equal(badBalance.status, 400);
      assert.equal((await badBalance.json()).field, 'initialBalance');

      const arrayBody = await post(undefined, '[]');
      assert.equal(arrayBody.status, 400);
      assert.equal((await arrayBody.json()).code, 'ValidationError');

      const malformed = await post(undefined, '{not json');
      assert.equal(malformed.status, 400);

      const huge = await post(undefined, JSON.stringify({ name: 'x'.repeat(70 * 1024) }));
      assert.equal(huge.status, 413);
      assert.equal((await huge.json()).code, 'PayloadTooLarge');

      // 全部被拒絕，不得寫入
      const rows = queryAll('SELECT id FROM accounts WHERE user_id = ?', [userId]);
      assert.equal(rows.length, 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('GET /api/v1/categories 回傳分類清單（scope categories:read）', async () => {
    const userId = 'test_v1cat_' + uid();
    createTestUser(userId);
    try {
      const parentId = uid();
      getDB().run(
        'INSERT INTO categories (id, user_id, name, type, color, sort_order, parent_id) VALUES (?,?,?,?,?,?,?)',
        [parentId, userId, '餐飲', 'expense', '#ff0000', 1, ''],
      );
      getDB().run(
        'INSERT INTO categories (id, user_id, name, type, color, sort_order, parent_id) VALUES (?,?,?,?,?,?,?)',
        [uid(), userId, '午餐', 'expense', '#00ff00', 2, parentId],
      );

      const token = createApiToken(userId, '分類讀取', ['categories:read']).token;
      const res = await categoriesRoute.GET(buildRequest('/api/v1/categories', { token, ip: '198.51.100.5' }));
      assert.equal(res.status, 200);
      const list = await res.json();
      assert.equal(list.categories.length, 2);
      assert.equal(list.categories[0].name, '餐飲');
      assert.equal(list.categories[0].parentId, null, '頂層分類 parentId 為 null');
      assert.equal(list.categories[1].parentId, parentId);
      assert.equal(list.categories[0].isDefault, false);

      // 缺 scope 403
      const noScope = createApiToken(userId, '無分類權限', ['transactions:read']).token;
      const forbidden = await categoriesRoute.GET(buildRequest('/api/v1/categories', { token: noScope, ip: '198.51.100.5' }));
      assert.equal(forbidden.status, 403);
    } finally {
      cleanupUser(userId);
    }
  });

  test('PATCH 支出分類保留交易內容、同步手續費，並防止覆蓋其他分類', async () => {
    const userId = 'test_v1tx_category_' + uid();
    const outsider = 'test_v1tx_outsider_' + uid();
    createTestUser(userId);
    createTestUser(outsider);
    try {
      const parent = uid();
      const lunch = uid();
      const dinner = uid();
      const income = uid();
      const addCategory = (id: string, name: string, type: string, parentId: string) =>
        getDB().run('INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)',
          [id, userId, name, type, parentId]);
      addCategory(parent, '餐飲', 'expense', '');
      addCategory(lunch, '午餐', 'expense', parent);
      addCategory(dinner, '晚餐', 'expense', parent);
      addCategory(income, '收入子類', 'income', parent);

      const token = createApiToken(userId, '讀寫交易', ['transactions:read', 'transactions:write']).token;
      const readOnly = createApiToken(userId, '唯讀', ['transactions:read']).token;
      const stranger = createApiToken(outsider, '其他帳本', ['transactions:write']).token;
      const note = '測試餐廳｜信用卡末四碼 0000｜12:43｜中國信託消費通知';
      const created = await transactionsRoute.POST(buildRequest('/api/v1/transactions', {
        token,
        ip: '198.51.100.33',
        body: { type: 'expense', amount: 5, currency: 'USD', fxRate: 32, fxFee: 3, date: '2026-11-20', note },
      }));
      assert.equal(created.status, 201);
      const initial = (await created.json()).transaction;
      assert.equal(initial.categoryId, null);
      const readTransactions = async () => (await transactionsRoute.GET(
        buildRequest('/api/v1/transactions', { token, ip: '198.51.100.33' }),
      )).json();
      const before = (await readTransactions()).transactions[0];
      assert.equal(before.id, initial.id);

      const patchCategory = (body: unknown, authToken = token, id = initial.id) =>
        transactionCategoryRoute.PATCH(buildRequest('/api/v1/transactions/' + id + '/category', {
          token: authToken, method: 'PATCH', ip: '198.51.100.33', body,
        }), { params: Promise.resolve({ id }) });
      const choice = { categoryId: lunch, expectedCategoryId: null };
      assert.equal((await patchCategory(choice, readOnly)).status, 403);
      assert.equal((await patchCategory(choice, stranger)).status, 404);
      assert.equal((await patchCategory({ categoryId: lunch })).status, 400);
      assert.equal((await patchCategory({ ...choice, categoryId: parent })).status, 400);
      assert.equal((await patchCategory({ ...choice, categoryId: income })).status, 400);

      const updated = await patchCategory(choice);
      assert.equal(updated.status, 200);
      const updatedBody = await updated.json();
      assert.equal(updatedBody.transaction.id, initial.id);
      assert.equal(updatedBody.transaction.categoryId, lunch);
      const replay = await patchCategory(choice);
      assert.equal(replay.status, 200);
      assert.deepEqual(await replay.json(), updatedBody);
      const conflict = await patchCategory({ ...choice, categoryId: dinner });
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).code, 'CategoryConflict');

      assert.deepEqual((await readTransactions()).transactions, [{ ...before, categoryId: lunch }]);
      const fee = queryAll('SELECT id, category_id, amount FROM transactions WHERE linked_id = ? AND is_fx_fee = 1',
        [initial.id]);
      assert.equal(fee.length, 1);
      assert.equal(fee[0].category_id, lunch);
      assert.equal(Number(fee[0].amount), 3);
      assert.equal((await patchCategory(choice, token, fee[0].id)).status, 404);
    } finally {
      cleanupUser(outsider);
      cleanupUser(userId);
    }
  });

  test('帳本範圍防護：非成員 404（不揭露存在性）、viewer 寫入 403、viewer 讀取 200', async () => {
    const owner = 'test_v1led_owner_' + uid();
    const viewer = 'test_v1led_viewer_' + uid();
    const outsider = 'test_v1led_out_' + uid();
    createTestUser(owner);
    createTestUser(viewer);
    createTestUser(outsider);
    const ledgerId = 'test_ledger_' + uid();
    try {
      getDB().run(
        'INSERT INTO financial_ledgers (id, name, owner_user_id, data_owner_id, is_shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        [ledgerId, '測試共享帳本', owner, owner, 1, Date.now(), Date.now()],
      );
      getDB().run(
        "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,'owner',?)",
        [ledgerId, owner, Date.now()],
      );
      getDB().run(
        "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,'viewer',?)",
        [ledgerId, viewer, Date.now()],
      );

      const ownerToken = createApiToken(owner, 'Owner', ['accounts:read', 'accounts:write']).token;
      const viewerToken = createApiToken(viewer, 'Viewer', ['accounts:read', 'accounts:write']).token;
      const outsiderToken = createApiToken(outsider, 'Outsider', ['accounts:read']).token;

      // owner 在共享帳本建立帳戶（資料歸 data_owner_id）
      const created = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token: ownerToken, ip: '198.51.100.6', ledgerId, body: { name: '共享現金', category: 'cash' },
      }));
      assert.equal(created.status, 201);

      // viewer 可讀取（讀到 data owner 的資料）
      const viewerRead = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
        token: viewerToken, ip: '198.51.100.7', ledgerId,
      }));
      assert.equal(viewerRead.status, 200);
      assert.equal((await viewerRead.json()).accounts.length, 1);

      // viewer 寫入 403
      const viewerWrite = await accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token: viewerToken, ip: '198.51.100.7', ledgerId, body: { name: '不可建立' },
      }));
      assert.equal(viewerWrite.status, 403);
      assert.equal((await viewerWrite.json()).code, 'Forbidden');

      // 非成員 404（與「不存在」同形狀）
      const outsiderRead = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
        token: outsiderToken, ip: '198.51.100.8', ledgerId,
      }));
      assert.equal(outsiderRead.status, 404);
      const missing = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
        token: outsiderToken, ip: '198.51.100.8', ledgerId: 'ledger_does_not_exist',
      }));
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), await (async () => {
        const again = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
          token: outsiderToken, ip: '198.51.100.8', ledgerId,
        }));
        return again.json();
      })(), '不存在與非成員的回應完全同形狀');
    } finally {
      cleanupUser(owner);
      cleanupUser(viewer);
      cleanupUser(outsider);
    }
  });

  test('速率限制：per-Token 寫入額度滿 → 429 + Retry-After', async () => {
    const userId = 'test_v1rate_' + uid();
    createTestUser(userId);
    try {
      _resetApiRateLimitsForTests({
        tokenWrite: { limit: 2, windowMs: 60_000 },
        ip: { limit: 1000, windowMs: 60_000 },
      });
      const token = createApiToken(userId, '限流', ['accounts:write']).token;
      const post = () => accountsRoute.POST(buildRequest('/api/v1/accounts', {
        token, ip: '198.51.100.9', body: { name: '帳戶' + uid(), category: 'cash' },
      }));

      assert.equal((await post()).status, 201);
      assert.equal((await post()).status, 201);
      const limited = await post();
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).code, 'RateLimited');
      assert.ok(Number(limited.headers.get('retry-after')) >= 1, '需帶 Retry-After');
      assert.equal(limited.headers.get('ratelimit-remaining'), '0');
      assert.equal(limited.headers.get('cache-control'), 'no-store');

      // 讀取額度獨立，不受寫入額度影響
      const readToken = createApiToken(userId, '讀', ['accounts:read']).token;
      const read = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
        token: readToken, ip: '198.51.100.10',
      }));
      assert.equal(read.status, 200);
    } finally {
      cleanupUser(userId);
    }
  });

  test('速率限制：per-IP 於認證前生效，無效權杖的暴力猜測同樣被擋', async () => {
    _resetApiRateLimitsForTests({ ip: { limit: 2, windowMs: 60_000 } });
    const bad = () => accountsRoute.GET(buildRequest('/api/v1/accounts', {
      token: 'ap_api_invalid_' + uid(), ip: '203.0.113.50',
    }));
    assert.equal((await bad()).status, 401);
    assert.equal((await bad()).status, 401);
    const limited = await bad();
    assert.equal(limited.status, 429, '無效權杖嘗試超過 IP 額度後應回 429');

    // 不同 IP 不受影響
    const other = await accountsRoute.GET(buildRequest('/api/v1/accounts', {
      token: 'ap_api_invalid', ip: '203.0.113.51',
    }));
    assert.equal(other.status, 401);
  });

  test('回歸：/api/v1/transactions 以共用 body 解析建立交易仍為 201', async () => {
    const userId = 'test_v1txn_' + uid();
    createTestUser(userId);
    try {
      const token = createApiToken(userId, '交易', ['transactions:write', 'transactions:read']).token;
      const res = await transactionsRoute.POST(buildRequest('/api/v1/transactions', {
        token, ip: '198.51.100.11', body: { type: 'expense', amount: 100, note: '回歸測試' },
      }));
      assert.equal(res.status, 201);
      assert.equal((await res.json()).transaction.note, '回歸測試');

      const list = await transactionsRoute.GET(buildRequest('/api/v1/transactions', {
        token, ip: '198.51.100.11',
      }));
      assert.equal(list.status, 200);
      assert.equal((await list.json()).transactions.length, 1);
    } finally {
      cleanupUser(userId);
    }
  });
}
