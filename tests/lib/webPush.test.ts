// tests/lib/webPush.test.ts — Web Push 純邏輯單元測試（issue #257）
//
// 範圍：lib/webPushCore.ts 的全部純函式（無 DB／無網路／無 next 相依），以及
// lib/webPushEvents.ts 的事件偵測純函式。
// 執行：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/webPush.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTranslator } from '../../lib/i18n/translate.ts';
import { zhTW } from '../../lib/i18n/dictionaries/zh-TW.ts';
import {
  MAX_PUSH_FAILURES,
  PUSH_CATEGORIES,
  PushSubscriptionError,
  billDueEventKey,
  budgetExceededEventKey,
  buildPushPayload,
  defaultPushPreferences,
  dividendEventKey,
  endpointHost,
  eventKeyOf,
  formatPushAmount,
  generateVapidKeys,
  isBase64Url,
  isExpiredSubscriptionStatus,
  isPushCategory,
  isValidVapidPrivateKey,
  isValidVapidPublicKey,
  isValidVapidKeyPair,
  nextFailureCount,
  normalizePushSubscription,
  pushEventKey,
  readPushPreferences,
  resolveVapidSubject,
  serializePushPayload,
  shouldDisableSubscription,
  urlBase64ToUint8Array,
  yearMonthOf,
} from '../../lib/webPushCore.ts';
import { findDueBills, findExceededBudgets, findTodayDividends } from '../../lib/webPushEvents.ts';

const t = createTranslator(zhTW);

// ── 通知種類 ──

test('通知種類固定為三種，且可逐一辨識', () => {
  assert.deepEqual([...PUSH_CATEGORIES], ['bill_due', 'budget_exceeded', 'dividend']);
  for (const category of PUSH_CATEGORIES) assert.equal(isPushCategory(category), true);
  assert.equal(isPushCategory('promotion'), false);
  assert.equal(isPushCategory(null), false);
});

test('預設三種通知全部開啟；欄位為 0 時視為關閉', () => {
  assert.deepEqual(defaultPushPreferences(), {
    bill_due: true,
    budget_exceeded: true,
    dividend: true,
  });
  assert.deepEqual(readPushPreferences(null), defaultPushPreferences());
  const prefs = readPushPreferences({
    push_bill_due: 0,
    push_budget_exceeded: '1',
    push_dividend: '0',
  });
  assert.deepEqual(prefs, { bill_due: false, budget_exceeded: true, dividend: false });
});

test('缺欄位時沿用預設（既有部署補欄位前後行為一致）', () => {
  const prefs = readPushPreferences({ push_bill_due: 0 });
  assert.deepEqual(prefs, { bill_due: false, budget_exceeded: true, dividend: true });
});

// ── 訂閱驗證 ──

function validSubscription(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: {
      p256dh: 'B'.repeat(87),
      auth: 'A'.repeat(22),
    },
    ...overrides,
  };
}

test('合法的訂閱內容可正規化（含 toJSON 的 keys 形式）', () => {
  const normalized = normalizePushSubscription(validSubscription());
  assert.equal(normalized.endpoint, 'https://fcm.googleapis.com/fcm/send/abc123');
  assert.equal(normalized.p256dh, 'B'.repeat(87));
  assert.equal(normalized.auth, 'A'.repeat(22));
});

test('缺少／格式錯誤的訂閱內容一律拒絕', () => {
  assert.throws(() => normalizePushSubscription(null), PushSubscriptionError);
  assert.throws(() => normalizePushSubscription({}), PushSubscriptionError);
  assert.throws(
    () => normalizePushSubscription(validSubscription({ endpoint: 'http://insecure.example.com/push' })),
    /HTTPS/,
  );
  assert.throws(
    () => normalizePushSubscription(validSubscription({ endpoint: 'not-a-url' })),
    PushSubscriptionError,
  );
  assert.throws(
    () => normalizePushSubscription(validSubscription({ endpoint: 'https://user:pass@push.example.com/x' })),
    /帳密/,
  );
  assert.throws(
    () => normalizePushSubscription(validSubscription({ endpoint: 'https://attacker.example.com/collect' })),
    /不支援/,
  );
  assert.throws(
    () => normalizePushSubscription(validSubscription({ endpoint: 'https://fcm.googleapis.com:8443/fcm/send/x' })),
    /標準連接埠/,
  );
  assert.doesNotThrow(() => normalizePushSubscription(validSubscription({
    endpoint: 'https://wns2-example.notify.windows.com/w/?token=abc',
  })));
  assert.throws(
    () => normalizePushSubscription(validSubscription({ keys: { p256dh: 'short', auth: 'A'.repeat(22) } })),
    /p256dh/,
  );
  assert.throws(
    () => normalizePushSubscription(validSubscription({ keys: { p256dh: 'B'.repeat(87), auth: 'x' } })),
    /auth/,
  );
  // 非 base64url 字元（+ / =）不可接受
  assert.throws(
    () => normalizePushSubscription(validSubscription({ keys: { p256dh: `${'B'.repeat(85)}/+`, auth: 'A'.repeat(22) } })),
    /p256dh/,
  );
});

test('base64url 形狀檢查與端點主機萃取', () => {
  assert.equal(isBase64Url('abc-_123'), true);
  assert.equal(isBase64Url('abc+123'), false);
  assert.equal(isBase64Url(''), false);
  assert.equal(endpointHost('https://fcm.googleapis.com/fcm/send/xyz'), 'fcm.googleapis.com');
  assert.equal(endpointHost('garbage'), '');
});

// ── 失效訂閱判定 ──

test('404／410 視為訂閱已失效；其他狀態不刪除訂閱', () => {
  assert.equal(isExpiredSubscriptionStatus(404), true);
  assert.equal(isExpiredSubscriptionStatus('410'), true);
  assert.equal(isExpiredSubscriptionStatus(400), false);
  assert.equal(isExpiredSubscriptionStatus(500), false);
  assert.equal(isExpiredSubscriptionStatus(undefined), false);
});

test('成功即歸零失敗次數；連續失敗達門檻才停用', () => {
  assert.equal(nextFailureCount(3, true), 0);
  assert.equal(nextFailureCount(3, false), 4);
  assert.equal(nextFailureCount(null, false), 1);
  assert.equal(shouldDisableSubscription(MAX_PUSH_FAILURES - 1), false);
  assert.equal(shouldDisableSubscription(MAX_PUSH_FAILURES), true);
});

// ── VAPID ──

test('產生的 VAPID 金鑰為合法的 P-256 金鑰組', () => {
  const keys = generateVapidKeys();
  assert.equal(isValidVapidPublicKey(keys.publicKey), true);
  assert.equal(isValidVapidPrivateKey(keys.privateKey), true);
  assert.equal(isValidVapidKeyPair(keys.publicKey, keys.privateKey), true);
  assert.equal(Buffer.from(keys.publicKey, 'base64url').length, 65);
  assert.equal(Buffer.from(keys.privateKey, 'base64url').length, 32);
  const other = generateVapidKeys();
  assert.equal(isValidVapidKeyPair(keys.publicKey, other.privateKey), false);
  assert.notEqual(other.publicKey, keys.publicKey);
});

test('VAPID 金鑰格式檢查會擋掉截斷或非 base64url 的值', () => {
  assert.equal(isValidVapidPublicKey(''), false);
  assert.equal(isValidVapidPrivateKey('abc+/='), false);
  assert.equal(isValidVapidPrivateKey('A'.repeat(43) + '+'), false);
});

test('VAPID subject 必須為 https URL 或 mailto', () => {
  assert.equal(resolveVapidSubject('https://asset.example.com', '', ''), 'https://asset.example.com');
  assert.equal(resolveVapidSubject('asset.example.com', '', ''), 'https://asset.example.com');
  assert.equal(
    resolveVapidSubject('https://asset.example.com/dashboard', '', ''),
    'https://asset.example.com',
  );
  // 非 https（本機 http）不可作為 subject，退回 mailto
  assert.equal(resolveVapidSubject('http://localhost:3000', '', 'me@example.com'), 'mailto:me@example.com');
  assert.equal(resolveVapidSubject('', '', 'me@example.com'), 'mailto:me@example.com');
  assert.match(String(resolveVapidSubject('', '', '')), /^mailto:/);
});

// ── 事件鍵（去重鍵） ──

test('事件鍵由事件本身決定，因此重複偵測會產生相同鍵', () => {
  assert.equal(billDueEventKey('acc1', '2026-10-05'), 'bill:acc1:2026-10-05');
  assert.equal(budgetExceededEventKey('bud1', '2026-10'), 'budget:bud1:2026-10');
  assert.equal(dividendEventKey('div1'), 'dividend:div1');
  assert.equal(pushEventKey('dividend', 'dividend:div1'), 'dividend:dividend:div1');

  assert.equal(
    eventKeyOf({
      category: 'bill_due',
      accountId: 'acc1',
      accountName: '卡',
      cycleStart: '2026-09-06',
      cycleEnd: '2026-10-05',
      amount: 100,
      currency: 'TWD',
    }),
    'bill:acc1:2026-10-05',
  );
  assert.equal(
    eventKeyOf({
      category: 'budget_exceeded',
      budgetId: 'bud1',
      categoryName: '餐飲',
      yearMonth: '2026-10',
      budgetAmount: 1000,
      usedAmount: 1500,
    }),
    'budget:bud1:2026-10',
  );
  assert.equal(
    eventKeyOf({
      category: 'dividend',
      dividendId: 'div1',
      symbol: '2330',
      stockName: '台積電',
      date: '2026-10-07',
      cashDividend: 5000,
      stockDividendShares: 0,
      currency: 'TWD',
    }),
    'dividend:div1',
  );
});

test('yearMonthOf 以使用者當地時區的 year/month 產生 YYYY-MM', () => {
  assert.equal(yearMonthOf({ year: 2026, month: 10 }), '2026-10');
  assert.equal(yearMonthOf({ year: 2026, month: 1 }), '2026-01');
});

// ── 通知文案 ──

test('金額格式化帶幣別且千分位', () => {
  assert.equal(formatPushAmount(1234.4, 'TWD'), 'TWD 1,234');
  assert.equal(formatPushAmount(0, 'USD'), 'USD 0');
  assert.equal(formatPushAmount(Number.NaN, ''), 'TWD 0');
});

test('帳單到期通知：標題與內文帶入帳戶、結帳日與金額，並指向帳戶頁', () => {
  const payload = buildPushPayload(
    {
      category: 'bill_due',
      accountId: 'acc1',
      accountName: '國泰信用卡',
      cycleStart: '2026-09-06',
      cycleEnd: '2026-10-05',
      amount: 12345,
      currency: 'TWD',
    },
    t,
  );
  assert.equal(payload.category, 'bill_due');
  assert.equal(payload.title, t('notifications.push.billDue.title'));
  assert.match(payload.body, /國泰信用卡/);
  assert.match(payload.body, /2026-10-05/);
  assert.match(payload.body, /TWD 12,345/);
  assert.equal(payload.tag, 'bill:acc1:2026-10-05');
  assert.equal(payload.url, '/finance/accounts');
  // 不得出現未插值的佔位符
  assert.doesNotMatch(payload.body, /\{[a-zA-Z]+\}/);
});

test('預算超標通知：標題帶分類、內文帶年月與用量，並指向預算頁', () => {
  const payload = buildPushPayload(
    {
      category: 'budget_exceeded',
      budgetId: 'bud1',
      categoryName: '餐飲',
      yearMonth: '2026-10',
      budgetAmount: 10000,
      usedAmount: 13500,
    },
    t,
  );
  assert.equal(payload.category, 'budget_exceeded');
  assert.match(payload.title, /餐飲/);
  assert.match(payload.body, /2026-10/);
  assert.match(payload.body, /TWD 13,500/);
  assert.match(payload.body, /TWD 10,000/);
  assert.equal(payload.tag, 'budget:bud1:2026-10');
  assert.equal(payload.url, '/finance/budget');
});

test('股利發放通知：帶股票代號、日期、現金與股數，並指向股利頁', () => {
  const payload = buildPushPayload(
    {
      category: 'dividend',
      dividendId: 'div1',
      symbol: '2330',
      stockName: '台積電',
      date: '2026-10-07',
      cashDividend: 5000,
      stockDividendShares: 12.5,
      currency: 'TWD',
    },
    t,
  );
  assert.equal(payload.category, 'dividend');
  assert.match(payload.body, /2330/);
  assert.match(payload.body, /2026-10-07/);
  assert.match(payload.body, /TWD 5,000/);
  assert.match(payload.body, /12\.5/);
  assert.equal(payload.tag, 'dividend:div1');
  assert.equal(payload.url, '/stocks/dividends');
});

test('英文語系亦使用同一組鍵（多語系文案不寫死在程式）', () => {
  const en = createTranslator({
    notifications: {
      push: {
        billDue: { title: 'Bill due', body: 'Card {account} · {date} · {amount}' },
        budgetExceeded: { title: 'Budget exceeded: {category}', body: '{month} used {used} of {budget}' },
        dividend: { title: 'Dividend', body: '{symbol} on {date}: cash {cash}, shares {shares}' },
        test: { title: 'Test', body: 'Test body' },
      },
    },
  } as unknown as typeof zhTW);
  const payload = buildPushPayload(
    {
      category: 'budget_exceeded',
      budgetId: 'bud1',
      categoryName: 'Dining',
      yearMonth: '2026-10',
      budgetAmount: 10000,
      usedAmount: 13500,
    },
    en,
  );
  assert.equal(payload.title, 'Budget exceeded: Dining');
  assert.equal(payload.body, '2026-10 used TWD 13,500 of TWD 10,000');
});

test('序列化後的 payload 保持精簡（4KB 上限內）且欄位齊全', () => {
  const payload = buildPushPayload(
    {
      category: 'dividend',
      dividendId: 'div1',
      symbol: '2412',
      stockName: '中華電信',
      date: '2026-10-07',
      cashDividend: 3200.5,
      stockDividendShares: 0,
      currency: 'TWD',
    },
    t,
  );
  const json = serializePushPayload(payload);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ['body', 'category', 'tag', 'title', 'url']);
  assert.equal(parsed.tag, 'dividend:div1');
  assert.ok(Buffer.byteLength(json, 'utf8') < 4096, 'payload 必須在 push service 上限內');
});

test('urlBase64ToUint8Array 可還原 VAPID 公鑰位元組', () => {
  const keys = generateVapidKeys();
  const bytes = urlBase64ToUint8Array(keys.publicKey);
  assert.equal(bytes.length, 65);
  assert.equal(Buffer.from(bytes).toString('base64url'), keys.publicKey.replace(/=+$/, ''));
});

// ── 事件偵測（純函式） ──

test('帳單到期：僅結帳日當天、且當期有設定的信用卡會產生事件', () => {
  const rows = [
    // 結帳日 = 5，當地今天 = 2026-10-05 → 命中
    {
      id: 'acc1',
      name: '國泰卡',
      category: 'credit_card',
      account_type: '信用卡',
      is_active: 1,
      statement_closing_day: 5,
      cycle_spending: 8888.888,
      currency: 'TWD',
    },
    // 同一張卡但不是結帳日 → 不推播
    {
      id: 'acc2',
      name: '結帳日 20 的卡',
      category: 'credit_card',
      account_type: '信用卡',
      is_active: 1,
      statement_closing_day: 20,
      cycle_spending: 100,
      currency: 'TWD',
    },
    // 非信用卡 → 不推播
    {
      id: 'acc3',
      name: '銀行帳戶',
      category: 'bank',
      account_type: '銀行',
      is_active: 1,
      statement_closing_day: 5,
      cycle_spending: 100,
      currency: 'TWD',
    },
    // 未設定結帳日 → 不推播
    {
      id: 'acc4',
      name: '未設定結帳日',
      category: 'credit_card',
      account_type: '信用卡',
      is_active: 1,
      statement_closing_day: null,
      cycle_spending: 100,
      currency: 'TWD',
    },
    // 結帳日當天但本期無消費 → 不推播
    {
      id: 'acc6',
      name: '零消費卡',
      category: 'credit_card',
      account_type: '信用卡',
      is_active: 1,
      statement_closing_day: 5,
      cycle_spending: 0,
      currency: 'TWD',
    },
  ];
  const events = findDueBills(rows, '2026-10-05');
  assert.equal(events.length, 1);
  assert.equal(events[0].accountId, 'acc1');
  assert.equal(events[0].cycleEnd, '2026-10-05');
  assert.equal(events[0].cycleStart, '2026-09-06');
  assert.equal(events[0].amount, 8888.89);
  assert.equal(events[0].currency, 'TWD');
});

test('帳單到期：結帳日 31 遇小月時 clamp 到當月最後一天', () => {
  const rows = [
    {
      id: 'acc1',
      name: '卡',
      category: 'credit_card',
      is_active: 1,
      statement_closing_day: 31,
      cycle_spending: 100,
      currency: 'TWD',
    },
  ];
  assert.equal(findDueBills(rows, '2026-02-28').length, 1);
  assert.equal(findDueBills(rows, '2026-02-27').length, 0);
});

test('預算超標：僅超過預算金額者產生事件，未超標或金額 <= 0 略過', () => {
  const events = findExceededBudgets([
    { budget: { id: 'b1', amount: 1000, year_month: '2026-10' }, used: 1500, categoryName: '餐飲' },
    { budget: { id: 'b2', amount: 1000, year_month: '2026-10' }, used: 1000, categoryName: '交通' },
    { budget: { id: 'b3', amount: 0, year_month: '2026-10' }, used: 500, categoryName: '娛樂' },
    { budget: { id: 'b4', amount: 500, year_month: '2026-10' }, used: 500.02, categoryName: '購物' },
  ]);
  assert.deepEqual(
    events.map((e) => e.budgetId),
    ['b1', 'b4'],
  );
  assert.equal(events[0].budgetAmount, 1000);
  assert.equal(events[0].usedAmount, 1500);
});

test('股利發放：僅當日且金額或股數非零者產生事件', () => {
  const rows = [
    { id: 'd1', date: '2026-10-07', cash_dividend: 5000, stock_dividend_shares: 0, symbol: '2330', stock_name: '台積電', currency: 'TWD' },
    { id: 'd2', date: '2026-10-07', cash_dividend: 0, stock_dividend_shares: 10, symbol: '2412', stock_name: '中華電', currency: 'TWD' },
    { id: 'd3', date: '2026-10-06', cash_dividend: 100, stock_dividend_shares: 0, symbol: '2317', stock_name: '鴻海', currency: 'TWD' },
    { id: 'd4', date: '2026-10-07', cash_dividend: 0, stock_dividend_shares: 0, symbol: '2454', stock_name: '聯發科', currency: 'TWD' },
  ];
  const events = findTodayDividends(rows, '2026-10-07');
  assert.deepEqual(
    events.map((e) => e.dividendId),
    ['d1', 'd2'],
  );
  assert.equal(events[0].currency, 'TWD');
  assert.equal(events[1].stockDividendShares, 10);
});
