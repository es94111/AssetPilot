// tests/lib/smartAssist.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
//
// 驗證 issue #252 的伺服器端組裝（lib/smartAssist.ts）與 API 路由：
//   - 分類建議只以「同一帳本、同類型」的歷史紀錄計算
//   - 固定收支偵測排除已是固定收支者與使用者已忽略者
//   - 智慧輔助開關可關閉（關閉後兩者皆回傳空結果，且不寫入任何建議）
//   - 建議僅為提示：呼叫建議 API 不會新增任何 recurring 列或修改交易
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/smartAssist.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('smartAssist（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const { addDaysToIsoDate } = await import('../../lib/recurringSchedule.ts');
  const { todayInUserTz } = await import('../../lib/userTime.ts');
  const {
    isSmartAssistEnabled,
    setSmartAssistEnabled,
    getCategorySuggestions,
    getRecurringSuggestions,
    recurringSuggestionSignature,
    dismissRecurringSuggestion,
  } = await import('../../lib/smartAssist.ts');
  const suggestionsRoute = await import('../../app/api/transactions/suggestions/route.ts');
  const recurringSuggestionsRoute = await import('../../app/api/recurring/suggestions/route.ts');
  const recurringRoute = await import('../../app/api/recurring/route.ts');
  const dismissRoute = await import('../../app/api/recurring/suggestions/dismiss/route.ts');
  const smartAssistRoute = await import('../../app/api/user/settings/smart-assist/route.ts');

  await initDB();

  const userId = 'test_smartassist_' + uid();
  const otherUserId = 'test_smartassist_other_' + uid();
  const parentId = uid();
  const breakfastId = uid();
  const lunchId = uid();
  const rentId = uid();
  const incomeParentId = uid();
  const incomeBreakfastId = uid();
  const accountId = uid();
  const otherUserCategoryId = uid();
  let sideEffectRecurringId = '';
  const today = todayInUserTz('Asia/Taipei');
  function recentMonthlyDates(count: number): string[] {
    const [year, month, rawDay] = today.split('-').map(Number);
    const day = Math.min(rawDay, 28);
    return Array.from({ length: count }, (_, index) => {
      const monthsAgo = count - index - 1;
      return new Date(Date.UTC(year, month - 1 - monthsAgo, day)).toISOString().slice(0, 10);
    });
  }

  function authedRequest(method: string, url: string, body?: unknown) {
    const { token } = createLoginSession(userId, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}` };
    if (method !== 'GET') headers.Origin = new URL(url).origin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  function insertTx(row: {
    type: string;
    amount: number;
    date: string;
    categoryId: string | null;
    note: string;
    ownerId?: string;
  }): string {
    const id = uid();
    getDB().run(
      `INSERT INTO transactions (id, user_id, type, amount, currency, twd_amount, date, category_id, account_id, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, row.ownerId ?? userId, row.type, row.amount, 'TWD', row.amount, row.date,
        row.categoryId, accountId, row.note, Date.now(), Date.now(),
      ],
    );
    return id;
  }

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    for (const id of [userId, otherUserId]) {
      db.run(
        'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
        [id, `${id}@example.com`, 'x', '測試使用者', now],
      );
      db.run(
        'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, updated_at) VALUES (?,?,?,?) ON CONFLICT (user_id) DO NOTHING',
        [id, '["TWD"]', 'TWD', Date.now()],
      );
    }
    db.run(
      'INSERT INTO accounts (id, user_id, name, initial_balance, currency, created_at) VALUES (?,?,?,?,?,?)',
      [accountId, userId, '測試帳戶', 0, 'TWD', now],
    );

    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [parentId, userId, '餐飲', 'expense', '#ef4444', 1, ''],
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [breakfastId, userId, '早餐', 'expense', '#fca5a5', 2, parentId],
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [lunchId, userId, '午餐', 'expense', '#f87171', 3, parentId],
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [incomeParentId, userId, '收入', 'income', '#10b981', 4, ''],
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [incomeBreakfastId, userId, '早餐', 'income', '#34d399', 5, incomeParentId],
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [rentId, userId, '房租/房貸', 'expense', '#22d3ee', 6, ''],
    );
    // 另一位使用者的分類：驗證建議不會跨使用者／帳本洩漏。
    db.run(
      'INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,0,?,?)',
      [otherUserCategoryId, otherUserId, '他人分類', 'expense', '#111111', 1, ''],
    );
    // 他人同名摘要的歷史交易：不得影響本使用者的建議。
    insertTx({ type: 'expense', amount: 90, date: '2026-10-05', categoryId: null, note: '早餐', ownerId: otherUserId });
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM recurring_suggestion_dismissals WHERE user_id = ?', [userId]);
    db.run('DELETE FROM recurring WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id IN (?, ?)', [userId, otherUserId]);
    db.run('DELETE FROM categories WHERE user_id IN (?, ?)', [userId, otherUserId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM user_settings WHERE user_id IN (?, ?)', [userId, otherUserId]);
    db.run('DELETE FROM users WHERE id IN (?, ?)', [userId, otherUserId]);
    db.close();
  });

  test('智慧輔助預設開啟，關閉後可再開啟', () => {
    assert.equal(isSmartAssistEnabled(userId), true, '預設應為開啟');
    setSmartAssistEnabled(userId, false);
    assert.equal(isSmartAssistEnabled(userId), false);
    setSmartAssistEnabled(userId, true);
    assert.equal(isSmartAssistEnabled(userId), true);
  });

  test('分類建議依同類型歷史摘要共現推薦，且不跨使用者洩漏', () => {
    insertTx({ type: 'expense', amount: 60, date: '2026-10-01', categoryId: breakfastId, note: '早餐' });
    insertTx({ type: 'expense', amount: 75, date: '2026-09-25', categoryId: breakfastId, note: '早餐 蛋餅' });
    insertTx({ type: 'expense', amount: 120, date: '2026-10-02', categoryId: lunchId, note: '午餐' });

    const result = getCategorySuggestions({ userId, note: '早餐', type: 'expense' });
    assert.equal(result.enabled, true);
    assert.equal(result.suggestions.length, 1, '只有早餐有詞彙交集');
    assert.equal(result.suggestions[0].categoryId, breakfastId);
    assert.equal(result.suggestions[0].categoryName, '早餐');
    assert.equal(result.suggestions[0].parentName, '餐飲');
    assert.equal(result.suggestions[0].matchedCount, 2, '只計本使用者的歷史，不含他人的同名交易');
    assert.equal(result.suggestions.some((item) => item.categoryId === incomeBreakfastId), false,
      '同名收入子分類不得出現在支出建議');
  });

  test('收入類型不會採用支出歷史（型別隔離）', () => {
    const result = getCategorySuggestions({ userId, note: '早餐', type: 'income' });
    assert.equal(result.suggestions.length, 0);
  });

  test('空白摘要不觸發查詢且回傳空建議', () => {
    assert.deepEqual(getCategorySuggestions({ userId, note: '   ', type: 'expense' }).suggestions, []);
  });

  test('關閉開關後分類建議回傳 enabled=false 且無建議', () => {
    setSmartAssistEnabled(userId, false);
    try {
      const result = getCategorySuggestions({ userId, note: '早餐', type: 'expense' });
      assert.equal(result.enabled, false);
      assert.deepEqual(result.suggestions, []);
    } finally {
      setSmartAssistEnabled(userId, true);
    }
  });

  test('固定收支偵測找出每月固定支出並附分類／帳戶名稱', () => {
    for (const date of recentMonthlyDates(4)) {
      insertTx({ type: 'expense', amount: 15000, date, categoryId: rentId, note: '房租' });
    }
    const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' });
    assert.equal(result.enabled, true);
    const rent = result.suggestions.find((item) => item.categoryId === rentId);
    assert.ok(rent, '應偵測到房租週期');
    assert.equal(rent.frequency, 'monthly');
    assert.equal(rent.amount, 15000);
    assert.equal(rent.categoryName, '房租/房貸');
    assert.equal(rent.occurrences, 4);
  });

  test('舊交易 twd_amount 預設為 0 時，固定收支偵測仍回退到 amount', () => {
    for (const date of recentMonthlyDates(3)) {
      getDB().run(
        `INSERT INTO transactions (id, user_id, type, amount, twd_amount, original_amount, currency, fx_rate,
          date, category_id, account_id, note, created_at, updated_at)
         VALUES (?, ?, 'expense', 3000, 0, 3000, 'TWD', '1', ?, ?, ?, 'legacy rent', ?, ?)`,
        [uid(), userId, date, rentId, accountId, Date.now(), Date.now()],
      );
    }
    const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' });
    assert.ok(result.suggestions.some((item) => item.amount === 3000),
      'twd_amount=0 的歷史列應使用 amount 作為 TWD 金額');
  });

  test('已是固定收支的群組不再提示', () => {
    getDB().run(
      `INSERT INTO recurring (id, user_id, type, amount, category_id, account_id, frequency, start_date, note, is_active, last_generated, currency, fx_rate, fx_fee, exclude_from_stats, needs_attention, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,1,NULL,'TWD','1',0,0,0,?)`,
      [uid(), userId, 'expense', 15000, rentId, accountId, 'monthly', recentMonthlyDates(4)[0], '房租', Date.now()],
    );
    const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' });
    assert.equal(
      result.suggestions.some((item) => item.categoryId === rentId && item.amount === 15000),
      false,
      '已建立的固定收支不應再被提示',
    );
  });

  test('忽略的建議不再出現，且忽略為幂等操作', () => {
    getDB().run('DELETE FROM recurring WHERE user_id = ?', [userId]);
    const signature = recurringSuggestionSignature({
      type: 'expense', categoryId: rentId, accountId, amount: 15000,
    });
    dismissRecurringSuggestion(userId, signature);
    dismissRecurringSuggestion(userId, signature);
    const rows = queryAll(
      'SELECT signature FROM recurring_suggestion_dismissals WHERE user_id = ?',
      [userId],
    );
    assert.equal(rows.length, 1, '重複忽略同一簽章只保留一列');

    const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' });
    assert.equal(
      result.suggestions.some((item) => item.categoryId === rentId && item.amount === 15000),
      false,
    );

    getDB().run('DELETE FROM recurring_suggestion_dismissals WHERE user_id = ?', [userId]);
    assert.equal(
      getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' })
        .suggestions.some((item) => item.categoryId === rentId && item.amount === 15000),
      true,
      '清除忽略紀錄後應再次提示',
    );
  });

  test('關閉開關後固定收支偵測回傳 enabled=false 且無建議', () => {
    setSmartAssistEnabled(userId, false);
    try {
      const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' });
      assert.equal(result.enabled, false);
      assert.deepEqual(result.suggestions, []);
    } finally {
      setSmartAssistEnabled(userId, true);
    }
  });

  test('既有與忽略的高順位週期候選不會佔用 Top-N 名額', () => {
    const amounts = [20000, 19000, 18000, 17000, 16000, 15000, 14000];
    for (const amount of amounts) {
      for (const date of recentMonthlyDates(4)) {
        insertTx({ type: 'expense', amount, date, categoryId: rentId, note: `租金 ${amount}` });
      }
    }
    // 最高順位已經存在；接下來五個候選已被使用者忽略。
    sideEffectRecurringId = uid();
    getDB().run(
      `INSERT INTO recurring (id, user_id, type, amount, category_id, account_id, frequency, start_date, note, is_active, last_generated, currency, fx_rate, fx_fee, exclude_from_stats, needs_attention, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,1,NULL,'TWD','1',0,0,0,?)`,
      [sideEffectRecurringId, userId, 'expense', 20000, rentId, accountId, 'monthly', recentMonthlyDates(4)[0], '租金 20000', Date.now()],
    );
    for (const amount of [19000, 18000, 17000, 16000, 15000]) {
      dismissRecurringSuggestion(userId, recurringSuggestionSignature({
        type: 'expense', categoryId: rentId, accountId, amount,
      }));
    }

    const result = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei', limit: 1 });
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].amount, 14000, '應繼續往後找未忽略且尚未建立的候選');
  });

  test('GET /api/transactions/suggestions 僅回傳提示，不寫入任何交易', async () => {
    const before = Number(
      queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId])?.cnt,
    ) || 0;
    const response = await suggestionsRoute.GET(
      authedRequest('GET', 'http://localhost/api/transactions/suggestions?type=expense&note=%E6%97%A9%E9%A4%90'),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.enabled, true);
    assert.equal(body.suggestions[0]?.categoryId, breakfastId);
    const after = Number(
      queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId])?.cnt,
    ) || 0;
    assert.equal(after, before, '建議 API 不得新增交易');
    assert.equal(
      queryOne('SELECT last_generated FROM recurring WHERE id = ?', [sideEffectRecurringId])?.last_generated,
      null,
      '讀取分類建議不可隱式執行到期固定收支',
    );
  });

  test('GET /api/recurring/suggestions 不建立任何固定收支（僅提示）', async () => {
    const before = Number(
      queryOne('SELECT COUNT(*) AS cnt FROM recurring WHERE user_id = ?', [userId])?.cnt,
    ) || 0;
    const response = await recurringSuggestionsRoute.GET(
      authedRequest('GET', 'http://localhost/api/recurring/suggestions'),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.suggestions));
    assert.ok(body.suggestions[0]?.signature, '每筆建議都應附穩定簽章');
    const after = Number(
      queryOne('SELECT COUNT(*) AS cnt FROM recurring WHERE user_id = ?', [userId])?.cnt,
    ) || 0;
    assert.equal(after, before, '建議 API 不得建立固定收支');
    assert.equal(
      queryOne('SELECT last_generated FROM recurring WHERE id = ?', [sideEffectRecurringId])?.last_generated,
      null,
      '讀取固定收支建議不可隱式執行到期固定收支',
    );
  });

  test('POST /api/recurring/suggestions/dismiss 驗證簽章格式並記錄忽略', async () => {
    const invalid = await dismissRoute.POST(
      authedRequest('POST', 'http://localhost/api/recurring/suggestions/dismiss', { signature: '' }),
    );
    assert.equal(invalid.status, 400);

    const valid = await dismissRoute.POST(
      authedRequest('POST', 'http://localhost/api/recurring/suggestions/dismiss', {
        signature: recurringSuggestionSignature({ type: 'expense', categoryId: rentId, accountId, amount: 15000 }),
      }),
    );
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { dismissed: true });
    assert.equal(
      queryOne('SELECT last_generated FROM recurring WHERE id = ?', [sideEffectRecurringId])?.last_generated,
      null,
      '忽略提示端點不可隱式執行到期固定收支',
    );
    getDB().run('DELETE FROM recurring_suggestion_dismissals WHERE user_id = ?', [userId]);
  });

  test('GET/PUT /api/user/settings/smart-assist 讀寫操作者偏好並驗證輸入', async () => {
    const put = await smartAssistRoute.PUT(
      authedRequest('PUT', 'http://localhost/api/user/settings/smart-assist', { enabled: false }),
    );
    assert.equal(put.status, 200);
    assert.deepEqual(await put.json(), { enabled: false });

    const get = await smartAssistRoute.GET(
      authedRequest('GET', 'http://localhost/api/user/settings/smart-assist'),
    );
    assert.equal(get.status, 200);
    assert.equal((await get.json()).enabled, false);

    const invalid = await smartAssistRoute.PUT(
      authedRequest('PUT', 'http://localhost/api/user/settings/smart-assist', { enabled: 'yes' }),
    );
    assert.equal(invalid.status, 400);

    const restore = await smartAssistRoute.PUT(
      authedRequest('PUT', 'http://localhost/api/user/settings/smart-assist', { enabled: true }),
    );
    assert.equal(restore.status, 200);
    assert.equal(
      queryOne('SELECT last_generated FROM recurring WHERE id = ?', [sideEffectRecurringId])?.last_generated,
      null,
      '智慧輔助設定端點不可隱式執行到期固定收支',
    );
  });

  test('建立建議配方時以帳本時區重新驗證起始日，拒絕已過期日期', async () => {
    for (const date of recentMonthlyDates(4)) {
      insertTx({ type: 'expense', amount: 15555, date, categoryId: rentId, note: 'stale-guard recurring' });
    }
    const suggestion = getRecurringSuggestions({ userId, userTimezone: 'Asia/Taipei' })
      .suggestions.find((item) => item.amount === 15555);
    assert.ok(suggestion, '應先有一筆目前有效的建議');
    const pastStartDate = addDaysToIsoDate(today, -1);
    assert.ok(pastStartDate);
    const countBefore = Number(queryOne('SELECT COUNT(*) AS cnt FROM recurring WHERE user_id = ?', [userId])?.cnt) || 0;

    const response = await recurringRoute.POST(authedRequest(
      'POST',
      'http://localhost/api/recurring',
      {
        type: suggestion.type,
        amount: suggestion.suggestedAmount,
        currency: suggestion.currency,
        fxRate: suggestion.fxRate,
        categoryId: suggestion.categoryId,
        accountId: suggestion.accountId,
        frequency: suggestion.frequency,
        startDate: pastStartDate,
        note: suggestion.sampleNote,
        smartSuggestionSignature: suggestion.signature,
      },
    ));
    assert.equal(response.status, 409, 'server must reject a suggestion whose start date passed');
    const countAfter = Number(queryOne('SELECT COUNT(*) AS cnt FROM recurring WHERE user_id = ?', [userId])?.cnt) || 0;
    assert.equal(countAfter, countBefore, 'expired suggestion must not create a recurring recipe');
  });

  test('未登入時建議端點回傳 401（不做匿名推論）', async () => {
    const response = await suggestionsRoute.GET(
      new NextRequest('http://localhost/api/transactions/suggestions?type=expense&note=x'),
    );
    assert.equal(response.status, 401);
  });

  test('建議端點屬帳本資料 API，共享帳本成員只以帳本內資料計算', async () => {
    const { isLedgerDataPath } = await import('../../lib/ledgerPolicy.ts');
    assert.equal(isLedgerDataPath('/api/transactions/suggestions'), true, '分類建議應走帳本範圍');
    assert.equal(isLedgerDataPath('/api/recurring/suggestions'), true, '週期建議應走帳本範圍');
    assert.equal(isLedgerDataPath('/api/recurring/suggestions/dismiss'), true, '忽略紀錄應走帳本範圍');

    // 帳本 context 由 applyLedgerContext 決定 userId（共享帳本為 data_owner_id），
    // 故以他人 userId 查詢時只會看到他人自己的歷史，不會混入本次使用者資料。
    const otherResult = getCategorySuggestions({ userId: otherUserId, note: '早餐', type: 'expense' });
    assert.deepEqual(otherResult.suggestions, [], '他人帳本沒有相符的歷史摘要');
  });
}
