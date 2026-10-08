// tests/lib/recurringDetection.test.ts — 固定收支智慧偵測純函式（issue #252）
// 零相依、不需 PostgreSQL，可離線執行。
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RECURRING_DETECTION_MIN_CONFIDENCE,
  detectRecurringPatterns,
  filterExistingRecurring,
  matchFrequency,
  type DetectionTransaction,
} from '../../lib/recurringDetection.ts';

const TODAY = '2026-10-07';

function monthlyDates(count: number, day = 1): string[] {
  const [year, month] = TODAY.split('-').map(Number);
  const safeDay = Math.min(day, 28);
  return Array.from({ length: count }, (_, index) => {
    const monthsAgo = count - index - 1;
    return new Date(Date.UTC(year, month - 1 - monthsAgo, safeDay)).toISOString().slice(0, 10);
  });
}

function tx(overrides: Partial<DetectionTransaction> & { date: string }): DetectionTransaction {
  return {
    id: overrides.id ?? `tx-${overrides.date}`,
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 500,
    date: overrides.date,
    categoryId: overrides.categoryId ?? 'subscription',
    accountId: overrides.accountId ?? 'card-1',
    note: overrides.note ?? 'Netflix',
    originalAmount: overrides.originalAmount,
    currency: overrides.currency,
    fxRate: overrides.fxRate,
  };
}

test('matchFrequency 辨識每日／每週／每月／每年並附信心度', () => {
  const daily = matchFrequency([1, 1, 1, 1]);
  assert.equal(daily?.frequency, 'daily');
  assert.ok((daily?.confidence ?? 0) > 0.9);

  const weekly = matchFrequency([7, 7, 7, 7]);
  assert.equal(weekly?.frequency, 'weekly');
  assert.ok((weekly?.confidence ?? 0) > 0.9);

  const monthly = matchFrequency([30, 31, 30, 31]);
  assert.equal(monthly?.frequency, 'monthly');
  assert.ok((monthly?.confidence ?? 0) > 0.8);

  const yearly = matchFrequency([365, 365]);
  assert.equal(yearly?.frequency, 'yearly');
});

test('matchFrequency 對不規律或不足的間隔回傳 null', () => {
  assert.equal(matchFrequency([]), null);
  assert.equal(matchFrequency([30]), null, '只有一個間隔不足以判定週期');
  assert.equal(matchFrequency([5, 40, 3, 120]), null, '離散間隔不應誤判為任何週期');
  assert.equal(matchFrequency([0, 0]), null, '同日重複不構成週期');
});

test('偵測每月固定金額支出（訂閱服務）並提示轉為固定收支', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: monthlyDates(5, 1).map((date) => tx({ date, note: 'Netflix' })),
  });
  assert.equal(result.length, 1, '同一群組應只產生一筆建議');
  const suggestion = result[0];
  assert.equal(suggestion.frequency, 'monthly');
  assert.equal(suggestion.type, 'expense');
  assert.equal(suggestion.amount, 500);
  assert.equal(suggestion.categoryId, 'subscription');
  assert.equal(suggestion.accountId, 'card-1');
  assert.equal(suggestion.occurrences, 5);
  assert.equal(suggestion.firstDate, monthlyDates(5, 1)[0]);
  assert.equal(suggestion.lastDate, monthlyDates(5, 1).at(-1));
  assert.equal(suggestion.suggestedStartDate, '2026-11-01', '起始日應為最近一筆交易之後的下一個月，避免回補重複交易');
  assert.equal(suggestion.sampleNote, 'Netflix');
  assert.equal(suggestion.latestTransactionId, `tx-${monthlyDates(5, 1).at(-1)}`);
  assert.equal(suggestion.transactionIds.length, 5);
  assert.ok(suggestion.confidence >= RECURRING_DETECTION_MIN_CONFIDENCE);
});

test('金額不同者不視為同一週期群組（浮動金額消費不誤判）', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-04-01', amount: 800, note: '超市' }),
      tx({ date: '2026-05-01', amount: 1250, note: '超市' }),
      tx({ date: '2026-06-01', amount: 960, note: '超市' }),
      tx({ date: '2026-07-01', amount: 1100, note: '超市' }),
    ],
  });
  assert.deepEqual(result, [], '每月採買但金額浮動，不應提示為固定收支');
});

test('分類或帳戶不同者視為不同群組', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-08-05', categoryId: 'rent' }),
      tx({ date: '2026-09-05', categoryId: 'rent' }),
      tx({ date: '2026-10-05', categoryId: 'rent' }),
      tx({ date: '2026-08-05', categoryId: 'gym' }),
      tx({ date: '2026-09-05', categoryId: 'gym' }),
      tx({ date: '2026-10-05', categoryId: 'gym' }),
    ],
  });
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.categoryId).sort(),
    ['gym', 'rent'],
  );
});

test('兩筆交易不足 3 次不提示（避免單次消費被誤判）', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-09-01' }),
      tx({ date: '2026-10-01' }),
    ],
  });
  assert.deepEqual(result, []);
});

test('收入週期（每月薪資）同樣會被偵測', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-07-05', type: 'income', amount: 60000, categoryId: 'salary', note: '月薪' }),
      tx({ date: '2026-08-05', type: 'income', amount: 60000, categoryId: 'salary', note: '月薪' }),
      tx({ date: '2026-09-05', type: 'income', amount: 60000, categoryId: 'salary', note: '月薪' }),
      tx({ date: '2026-10-05', type: 'income', amount: 60000, categoryId: 'salary', note: '月薪' }),
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'income');
  assert.equal(result[0].frequency, 'monthly');
});

test('month-end monthly patterns are not suggested when the existing schedule would drift', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-07-31', amount: 4800, note: 'rent end month' }),
      tx({ date: '2026-08-31', amount: 4800, note: 'rent end month' }),
      tx({ date: '2026-09-30', amount: 4800, note: 'rent end month' }),
    ],
  });
  assert.deepEqual(result, [], 'month-end cadence cannot be represented without a stable anchor day');
});

test('patterns whose next occurrence is already overdue are not suggested', () => {
  const result = detectRecurringPatterns({
    today: '2026-10-08',
    transactions: [
      tx({ date: '2026-06-19', amount: 900, note: 'old monthly bill' }),
      tx({ date: '2026-07-19', amount: 900, note: 'old monthly bill' }),
      tx({ date: '2026-08-19', amount: 900, note: 'old monthly bill' }),
    ],
  });
  assert.deepEqual(result, [], 'next occurrence 2026-09-19 is past due and would be backfilled immediately');
});

test('過期週期群組不再提示，避免確認後回補多年舊交易', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2025-01-01', amount: 300, note: 'old daily' }),
      tx({ date: '2025-01-02', amount: 300, note: 'old daily' }),
      tx({ date: '2025-01-03', amount: 300, note: 'old daily' }),
      tx({ date: '2025-01-04', amount: 300, note: 'old daily' }),
    ],
  });
  assert.deepEqual(result, [], '久未出現的固定間隔消費不得被當成目前有效的配方');
});

test('轉帳與未來日期不納入偵測，跨年每月週期仍可辨識', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2025-11-20', type: 'transfer_out', amount: 1000 }),
      tx({ date: '2025-12-20', type: 'transfer_out', amount: 1000 }),
      tx({ date: '2026-01-20', type: 'transfer_out', amount: 1000 }),
      tx({ date: '2026-12-01', amount: 900, note: '未來' }),
      tx({ date: '2027-01-01', amount: 900, note: '未來' }),
      tx({ date: '2027-02-01', amount: 900, note: '未來' }),
    ],
  });
  assert.deepEqual(result, [], '轉帳與未來日期皆應被排除，故無任何建議');
});

test('每週週期可辨識且容忍週末順延', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-09-14', amount: 300, note: '健身房' }),
      tx({ date: '2026-09-21', amount: 300, note: '健身房' }),
      tx({ date: '2026-09-28', amount: 300, note: '健身房' }),
      tx({ date: '2026-10-05', amount: 300, note: '健身房' }),
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].frequency, 'weekly');
});

test('外幣群組保留最新交易的原幣金額與匯率供固定收支表單預填', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-08-07', amount: 3100, originalAmount: 100, currency: 'USD', fxRate: '31' }),
      tx({ date: '2026-09-07', amount: 3120, originalAmount: 100, currency: 'USD', fxRate: '31.2' }),
      tx({ date: '2026-10-07', amount: 3125, originalAmount: 100, currency: 'USD', fxRate: '31.25' }),
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 3125, '顯示／分群使用最新 TWD 金額');
  assert.equal(result[0].suggestedAmount, 100, '新增表單預填原幣金額');
  assert.equal(result[0].currency, 'USD');
  assert.equal(result[0].fxRate, '31.25');
});

test('建議依信心度遞減、再依出現次數遞減排序', () => {
  const result = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      // 完全規律的每月固定支出（信心度高）
      tx({ date: '2026-07-01', amount: 500, categoryId: 'a' }),
      tx({ date: '2026-08-01', amount: 500, categoryId: 'a' }),
      tx({ date: '2026-09-01', amount: 500, categoryId: 'a' }),
      tx({ date: '2026-10-01', amount: 500, categoryId: 'a' }),
      // 每月但日期略有偏移（信心度較低）
      tx({ date: '2026-07-03', amount: 700, categoryId: 'b' }),
      tx({ date: '2026-08-07', amount: 700, categoryId: 'b' }),
      tx({ date: '2026-09-06', amount: 700, categoryId: 'b' }),
      tx({ date: '2026-10-04', amount: 700, categoryId: 'b' }),
    ],
  });
  assert.equal(result.length, 2);
  assert.ok(result[0].confidence >= result[1].confidence, '信心度應遞減');
});

test('limit 限制回傳筆數，且相同輸入可重現', () => {
  const transactions = ['a', 'b', 'c'].flatMap((categoryId) => monthlyDates(3, 1).map((date) =>
    tx({ date, amount: 100, categoryId }),
  ));
  const input = { today: TODAY, transactions, limit: 2 };
  const result = detectRecurringPatterns(input);
  assert.equal(result.length, 2);
  assert.deepEqual(detectRecurringPatterns(input), result);
});

test('外幣週期與既有固定收支以原幣金額容差比對，匯率波動及本幣整數化不造成重複提示', () => {
  const detected = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-08-07', amount: 302, originalAmount: 9.99, currency: 'USD', fxRate: '30.2' }),
      tx({ date: '2026-09-07', amount: 302, originalAmount: 9.99, currency: 'USD', fxRate: '30.23' }),
      tx({ date: '2026-10-07', amount: 302, originalAmount: 9.99, currency: 'USD', fxRate: '30.25' }),
    ],
  });
  assert.equal(detected.length, 1);
  const remaining = filterExistingRecurring(detected, [
    { type: 'expense', amount: 302, categoryId: 'subscription', accountId: 'card-1', currency: 'USD', fxRate: '30.2' },
  ]);
  assert.deepEqual(remaining, [], 'USD 9.99 即使反算本幣只能得到 10.00，也不應重複提示');

  const lowRate = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-08-07', amount: 210, originalAmount: 999, currency: 'JPY', fxRate: '0.21' }),
      tx({ date: '2026-09-07', amount: 210, originalAmount: 999, currency: 'JPY', fxRate: '0.21' }),
      tx({ date: '2026-10-07', amount: 210, originalAmount: 999, currency: 'JPY', fxRate: '0.21' }),
    ],
  });
  assert.equal(lowRate.length, 1);
  assert.deepEqual(filterExistingRecurring(lowRate, [
    { type: 'expense', amount: 210, categoryId: 'subscription', accountId: 'card-1', currency: 'JPY', fxRate: '0.21' },
  ]), [], '低於 1 的匯率也須涵蓋 TWD 整數化造成的反算差異');
});

test('已存在的固定收支不會再被提示（filterExistingRecurring）', () => {
  const detected = detectRecurringPatterns({
    today: TODAY,
    transactions: [
      tx({ date: '2026-07-10', categoryId: 'rent', accountId: 'bank', amount: 15000 }),
      tx({ date: '2026-08-10', categoryId: 'rent', accountId: 'bank', amount: 15000 }),
      tx({ date: '2026-09-10', categoryId: 'rent', accountId: 'bank', amount: 15000 }),
      tx({ date: '2026-07-15', categoryId: 'gym', accountId: 'card-1', amount: 1200 }),
      tx({ date: '2026-08-15', categoryId: 'gym', accountId: 'card-1', amount: 1200 }),
      tx({ date: '2026-09-15', categoryId: 'gym', accountId: 'card-1', amount: 1200 }),
    ],
  });
  assert.equal(detected.length, 2);

  const remaining = filterExistingRecurring(detected, [
    { type: 'expense', amount: 15000, categoryId: 'rent', accountId: 'bank' },
  ]);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].categoryId, 'gym');

  const none = filterExistingRecurring(detected, [
    { type: 'expense', amount: 15000, categoryId: 'rent', accountId: 'bank' },
    { type: 'expense', amount: 1200, categoryId: 'gym', accountId: 'card-1' },
  ]);
  assert.deepEqual(none, []);
});
