// tests/lib/savingsGoal.test.ts — 目標儲蓄與還款計畫純計算（不需 DB）。
//
// 涵蓋 issue #260 驗收條件中「金額計算使用 decimal.js」與「攤還表自動產生」兩項：
//  - 進度、預估達成日、落後判定與提醒排序
//  - 攤還表的不變式：各期本金加總 = 原始本金、最後一期後餘額 = 0、月付金公式
//  - 驗證函式（日期、請求內容）的邊界
//
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/savingsGoal.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMonthsClamped,
  buildAmortizationSchedule,
  buildGoalReminders,
  computeGoalProgress,
  computeRepaymentProgress,
  daysBetween,
  isValidGoalDate,
  parseRepaymentPlanRequest,
  parseSavingsGoalRequest,
  todayInTimezone,
  MAX_REPAYMENT_PERIODS,
} from '../../lib/savingsGoal.ts';

// ── 日期工具 ──

test('isValidGoalDate 接受真實日期並拒絕不存在或格式錯誤的日期', () => {
  assert.equal(isValidGoalDate('2026-12-31'), true);
  assert.equal(isValidGoalDate('2024-02-29'), true, '閏年 2 月 29 日應有效');
  assert.equal(isValidGoalDate('2026-02-29'), false, '非閏年 2 月 29 日應無效');
  assert.equal(isValidGoalDate('2026-04-31'), false, '4 月 31 日應無效');
  assert.equal(isValidGoalDate('2026-13-01'), false, '13 月應無效');
  assert.equal(isValidGoalDate('2026-1-1'), false, '未補零應無效');
  assert.equal(isValidGoalDate(''), false);
  assert.equal(isValidGoalDate(null), false);
  assert.equal(isValidGoalDate(20260101), false);
});

test('todayInTimezone returns the user-local calendar day at UTC date boundaries', () => {
  const instant = new Date('2026-10-07T16:30:00.000Z');
  assert.equal(todayInTimezone('Asia/Taipei', instant), '2026-10-08');
  assert.equal(todayInTimezone('America/Los_Angeles', instant), '2026-10-07');
});

test('daysBetween 以 UTC 日界計算，不受執行環境時區影響', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.equal(daysBetween('2026-01-31', '2026-01-01'), -30);
  assert.equal(daysBetween('2026-01-01', '2026-01-01'), 0);
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
});

test('addMonthsClamped 於月底溢位時夾到該月最後一天', () => {
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsClamped('2024-01-31', 1), '2024-02-29', '閏年應夾到 2/29');
  assert.equal(addMonthsClamped('2026-01-15', 2), '2026-03-15');
  assert.equal(addMonthsClamped('2026-12-15', 1), '2027-01-15', '應跨年');
  assert.equal(addMonthsClamped('2026-03-31', 12), '2027-03-31');
});

// ── 目標進度 ──

test('computeGoalProgress 以時間比例判定進度是否落後', () => {
  // 100 天期間，過了一半（50 天）→ 應達 50%。
  const onTrack = computeGoalProgress({
    targetAmount: 100_000,
    targetDate: '2026-04-11',
    startDate: '2026-01-01',
    contributedAmount: 60_000,
    today: '2026-02-20',
  });
  assert.equal(onTrack.behind, false);
  assert.equal(onTrack.progressPercent, 60);
  assert.equal(onTrack.expectedAmount, 50_000);
  assert.equal(onTrack.shortfallAmount, 0);
  assert.equal(onTrack.remainingAmount, 40_000);

  const behind = computeGoalProgress({
    targetAmount: 100_000,
    targetDate: '2026-04-11',
    startDate: '2026-01-01',
    contributedAmount: 20_000,
    today: '2026-02-20',
  });
  assert.equal(behind.behind, true);
  assert.equal(behind.expectedAmount, 50_000);
  assert.equal(behind.shortfallAmount, 30_000);
});

test('computeGoalProgress 在達成時將剩餘與落後歸零並標記 achieved', () => {
  const progress = computeGoalProgress({
    targetAmount: 50_000,
    targetDate: '2026-06-30',
    startDate: '2026-01-01',
    contributedAmount: 75_000,
    today: '2026-03-01',
  });
  assert.equal(progress.achieved, true);
  assert.equal(progress.behind, false);
  assert.equal(progress.remainingAmount, 0);
  assert.equal(progress.shortfallAmount, 0);
  assert.equal(progress.progressPercent, 100, '超過目標時百分比應夾在 100');
  assert.equal(progress.projectedCompletionDate, '2026-03-01');
});

test('computeGoalProgress clamps negative linked balances to zero', () => {
  const progress = computeGoalProgress({
    targetAmount: 100,
    targetDate: '2026-12-31',
    startDate: '2026-01-01',
    contributedAmount: -50,
    today: '2026-01-01',
  });
  assert.equal(progress.contributedAmount, 0);
  assert.equal(progress.progressPercent, 0);
  assert.equal(progress.remainingAmount, 100);
});

test('computeGoalProgress 以目前速度外推預估達成日', () => {
  // 10 天存 10,000（日均 1,000），尚缺 20,000 → 還需 20 天。
  const progress = computeGoalProgress({
    targetAmount: 30_000,
    targetDate: '2026-12-31',
    startDate: '2026-01-01',
    contributedAmount: 10_000,
    today: '2026-01-11',
  });
  assert.equal(progress.projectedCompletionDate, '2026-01-31');
});

test('computeGoalProgress 在零進度時無法預估達成日', () => {
  const progress = computeGoalProgress({
    targetAmount: 30_000,
    targetDate: '2026-12-31',
    startDate: '2026-01-01',
    contributedAmount: 0,
    today: '2026-01-11',
  });
  assert.equal(progress.projectedCompletionDate, null);
  assert.equal(progress.daysRemaining, 354);
  assert.ok(progress.requiredDailyAmount > 0, '仍有剩餘期間時應給出所需日均');
});

test('computeGoalProgress 逾期未達成時標記 overdue 且剩餘天數為 0', () => {
  const progress = computeGoalProgress({
    targetAmount: 100_000,
    targetDate: '2026-01-31',
    startDate: '2025-01-01',
    contributedAmount: 40_000,
    today: '2026-03-01',
  });
  assert.equal(progress.overdue, true);
  assert.equal(progress.daysRemaining, 0);
  assert.equal(progress.requiredDailyAmount, 0);
  assert.equal(progress.behind, true);
});

test('computeGoalProgress 對目標日期在今日之後的零利率目標給出所需日均', () => {
  // 100,000 分 100 天 → 每日 1,000。
  const progress = computeGoalProgress({
    targetAmount: 100_000,
    targetDate: '2026-04-11',
    startDate: '2026-01-01',
    contributedAmount: 0,
    today: '2026-01-01',
  });
  assert.equal(progress.daysRemaining, 100);
  assert.equal(progress.requiredDailyAmount, 1000);
  assert.equal(progress.expectedAmount, 0, '起算當日應達 0');
});

test('computeGoalProgress 金額計算無浮點殘留（decimal.js）', () => {
  // 0.1 + 0.2 型誤差：目標 3 元、已存 1.1 元 → 應為 1.9 而非 1.9000000000000001。
  const progress = computeGoalProgress({
    targetAmount: 3,
    targetDate: '2026-12-31',
    startDate: '2026-01-01',
    contributedAmount: 1.1,
    today: '2026-06-01',
  });
  assert.equal(progress.remainingAmount, 1.9);
  assert.equal(progress.contributedAmount, 1.1);
});

// ── 提醒排序 ──

test('buildGoalReminders 只挑落後目標，逾期優先、缺口大者在前', () => {
  const makeProgress = (overrides: Partial<ReturnType<typeof computeGoalProgress>>) => ({
    ...computeGoalProgress({
      targetAmount: 100_000, targetDate: '2026-06-30', startDate: '2026-01-01',
      contributedAmount: 100_000, today: '2026-03-01',
    }),
    ...overrides,
  });

  const reminders = buildGoalReminders([
    { id: 'ok', name: '正常', progress: makeProgress({ behind: false, achieved: true }) },
    { id: 'small', name: '小幅落後', progress: makeProgress({ behind: true, overdue: false, shortfallAmount: 5_000, progressPercent: 40 }) },
    { id: 'big', name: '大幅落後', progress: makeProgress({ behind: true, overdue: false, shortfallAmount: 30_000, progressPercent: 10 }) },
    { id: 'late', name: '已逾期', progress: makeProgress({ behind: true, overdue: true, shortfallAmount: 1_000, progressPercent: 80 }) },
  ]);

  assert.deepEqual(reminders.map(r => r.id), ['late', 'big', 'small']);
  assert.equal(reminders[0].overdue, true);
});

test('buildGoalReminders 尊重 limit 參數', () => {
  const behind = (id: string, shortfall: number) => ({
    id,
    name: id,
    progress: {
      ...computeGoalProgress({
        targetAmount: 100_000, targetDate: '2026-06-30', startDate: '2026-01-01',
        contributedAmount: 0, today: '2026-03-01',
      }),
      behind: true,
      overdue: false,
      shortfallAmount: shortfall,
    },
  });
  assert.equal(buildGoalReminders([behind('a', 1), behind('b', 2), behind('c', 3)], 2).length, 2);
  assert.equal(buildGoalReminders([behind('a', 1)], 0).length, 0);
});

// ── 攤還表 ──

test('buildAmortizationSchedule 於零利率時平均攤還本金且無利息', () => {
  const schedule = buildAmortizationSchedule({ principal: 500_000, annualRatePercent: 0, periods: 10 });
  assert.equal(schedule.monthlyPayment, 50_000);
  assert.equal(schedule.totalPayment, 500_000);
  assert.equal(schedule.totalInterest, 0);
  assert.equal(schedule.payments.length, 10);
  assert.equal(schedule.payments[9].remainingBalance, 0);
});

test('buildAmortizationSchedule 本息平均攤還符合月付金公式', () => {
  // 1,000,000 × 0.02/12 ÷ (1 − (1 + 0.02/12)^-12) ≈ 84,238.87
  const schedule = buildAmortizationSchedule({ principal: 1_000_000, annualRatePercent: 2, periods: 12 });
  assert.equal(schedule.monthlyPayment, 84_238.87);
  assert.equal(schedule.totalInterest, 10_866.42);
});

test('buildAmortizationSchedule 各期本金加總等於原始本金且末期後餘額歸零', () => {
  const cases = [
    { principal: 1_000_000, annualRatePercent: 2, periods: 12 },
    { principal: 100_000, annualRatePercent: 12, periods: 24 },
    { principal: 1_200, annualRatePercent: 0, periods: 12 },
    { principal: 999_999, annualRatePercent: 3.7777, periods: 37 },
  ];
  for (const input of cases) {
    const schedule = buildAmortizationSchedule(input);
    const principalSum = schedule.payments.reduce((sum, row) => sum + row.principal, 0);
    // 逐期先四捨五入至分再加總，故允許 1 分以內的累積誤差。
    assert.ok(Math.abs(principalSum - input.principal) <= 0.01,
      `${input.principal}/${input.annualRatePercent}%/${input.periods}期 本金加總 ${principalSum} 應等於 ${input.principal}`);
    assert.equal(schedule.payments[schedule.payments.length - 1].remainingBalance, 0,
      `${input.periods} 期後餘額應為 0`);
    assert.equal(schedule.payments.length, input.periods);
  }
});

test('buildAmortizationSchedule 每期應繳金額不為負且利息隨餘額遞減', () => {
  const schedule = buildAmortizationSchedule({ principal: 600_000, annualRatePercent: 6, periods: 36 });
  for (const row of schedule.payments) {
    assert.ok(row.payment >= 0, `第 ${row.period} 期應繳不得為負`);
    assert.ok(row.interest >= 0, `第 ${row.period} 期利息不得為負`);
    assert.ok(row.remainingBalance >= 0, `第 ${row.period} 期餘額不得為負`);
  }
  assert.ok(schedule.payments[0].interest > schedule.payments[35].interest, '利息應隨本金攤還遞減');
  assert.ok(schedule.payments[0].principal < schedule.payments[35].principal, '本金佔比應逐期提高');
});

test('buildAmortizationSchedule rejects a term whose rounded installments clear early', () => {
  assert.throws(
    () => buildAmortizationSchedule({ principal: 10, annualRatePercent: 0, periods: 600 }),
    /指定期數前清償/,
    '不得回傳餘額已清償後還包含零額分期的名義期程',
  );
});

test('buildAmortizationSchedule 拒絕不合法輸入', () => {
  assert.throws(() => buildAmortizationSchedule({ principal: 0, annualRatePercent: 0, periods: 12 }), /principal/);
  assert.throws(() => buildAmortizationSchedule({ principal: -1, annualRatePercent: 0, periods: 12 }), /principal/);
  assert.throws(() => buildAmortizationSchedule({ principal: 1000, annualRatePercent: -1, periods: 12 }), /annualRatePercent/);
  assert.throws(() => buildAmortizationSchedule({ principal: 1000, annualRatePercent: 0, periods: 0 }), /periods/);
  assert.throws(() => buildAmortizationSchedule({ principal: 1000, annualRatePercent: 0, periods: 2.5 }), /periods/);
  assert.throws(
    () => buildAmortizationSchedule({ principal: 1000, annualRatePercent: 0, periods: MAX_REPAYMENT_PERIODS + 1 }),
    /periods/,
  );
  assert.throws(
    () => buildAmortizationSchedule({ principal: 1_000_000, annualRatePercent: 100, periods: 600 }),
    /無法按期清償/,
    '月付金被四捨五入後不足付息時應拒絕建立攤還表',
  );
  assert.throws(
    () => buildAmortizationSchedule({ principal: 1_000_000, annualRatePercent: 99.9, periods: 60 }),
    /最後一期金額/,
    '四捨五入造成過大尾款時應拒絕呈現為平均月付計畫',
  );
});

// ── 還款進度 ──

test('computeRepaymentProgress 依首次應繳日推算已到期期數與剩餘本金', () => {
  const schedule = buildAmortizationSchedule({ principal: 120_000, annualRatePercent: 0, periods: 12 });
  // 首次應繳 2026-01-15；今日 2026-03-20 → 1/15、2/15、3/15 共 3 期到期。
  const progress = computeRepaymentProgress({ startDate: '2026-01-15', today: '2026-03-20', schedule });
  assert.equal(progress.elapsedPeriods, 3);
  assert.equal(progress.remainingPeriods, 9);
  assert.equal(progress.elapsedPrincipal, 30_000);
  assert.equal(progress.remainingBalance, 90_000);
  assert.equal(progress.nextDueDate, '2026-04-15');
  assert.equal(progress.nextPaymentAmount, 10_000);
  assert.equal(progress.finalDueDate, '2026-12-15');
  assert.equal(progress.scheduleComplete, false);
  assert.equal(progress.progressPercent, 25);
});

test('computeRepaymentProgress 在首期到期前為零期，且全數到期時標記完成', () => {
  const schedule = buildAmortizationSchedule({ principal: 24_000, annualRatePercent: 0, periods: 12 });
  const before = computeRepaymentProgress({ startDate: '2026-01-15', today: '2026-01-14', schedule });
  assert.equal(before.elapsedPeriods, 0);
  assert.equal(before.remainingBalance, 24_000);
  assert.equal(before.nextDueDate, '2026-01-15');
  assert.equal(before.progressPercent, 0);

  const done = computeRepaymentProgress({ startDate: '2026-01-15', today: '2026-12-15', schedule });
  assert.equal(done.elapsedPeriods, 12);
  assert.equal(done.scheduleComplete, true);
  assert.equal(done.remainingBalance, 0);
  assert.equal(done.nextDueDate, null);
  assert.equal(done.nextPaymentAmount, 0);
  assert.equal(done.progressPercent, 100);
});

test('computeRepaymentProgress 月底應繳日以夾擠月份推算', () => {
  const schedule = buildAmortizationSchedule({ principal: 12_000, annualRatePercent: 0, periods: 12 });
  // 1/31 起算：2 月應繳日夾到 2/28。
  const progress = computeRepaymentProgress({ startDate: '2026-01-31', today: '2026-02-28', schedule });
  assert.equal(progress.elapsedPeriods, 2);
  assert.equal(progress.nextDueDate, '2026-03-31');
  assert.equal(progress.finalDueDate, '2026-12-31');
});

// ── 請求驗證 ──

test('parseSavingsGoalRequest 驗證名稱、金額、日期與綁定互斥', () => {
  assert.deepEqual(
    parseSavingsGoalRequest({ name: '買房頭期款', targetAmount: 3_000_000, targetDate: '2028-06-30' }),
    { name: '買房頭期款', targetAmount: 3_000_000, targetDate: '2028-06-30', accountId: null, categoryId: null },
  );
  assert.equal((parseSavingsGoalRequest({ name: '  ', targetAmount: 1, targetDate: '2028-06-30' }) as { field: string }).field, 'name');
  assert.equal((parseSavingsGoalRequest({ name: 'a', targetAmount: 0, targetDate: '2028-06-30' }) as { field: string }).field, 'targetAmount');
  assert.equal((parseSavingsGoalRequest({ name: 'a', targetAmount: 1.5, targetDate: '2028-06-30' }) as { field: string }).field, 'targetAmount');
  assert.equal((parseSavingsGoalRequest({ name: 'a', targetAmount: 1, targetDate: '2028-02-30' }) as { field: string }).field, 'targetDate');
  assert.equal(
    (parseSavingsGoalRequest({ name: 'a', targetAmount: 1, targetDate: '2028-06-30', accountId: 'x', categoryId: 'y' }) as { field: string }).field,
    'categoryId',
    '同時綁定帳戶與分類應被拒絕',
  );
  assert.ok(parseSavingsGoalRequest({ name: 'x'.repeat(61), targetAmount: 1, targetDate: '2028-06-30' }));
});

test('parseRepaymentPlanRequest 驗證本金、利率、期數與日期', () => {
  assert.deepEqual(
    parseRepaymentPlanRequest({ name: '車貸', principal: 500_000, annualRatePercent: 2.5, periods: 60, startDate: '2026-02-01' }),
    { name: '車貸', principal: 500_000, annualRatePercent: 2.5, periods: 60, startDate: '2026-02-01', accountId: null },
  );
  assert.equal((parseRepaymentPlanRequest({ name: '', principal: 1, periods: 1, startDate: '2026-01-01' }) as { field: string }).field, 'name');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 0, periods: 1, startDate: '2026-01-01' }) as { field: string }).field, 'principal');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 100, annualRatePercent: -0.1, periods: 1, startDate: '2026-01-01' }) as { field: string }).field, 'annualRatePercent');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 100, annualRatePercent: 101, periods: 1, startDate: '2026-01-01' }) as { field: string }).field, 'annualRatePercent');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 100, periods: 0, startDate: '2026-01-01' }) as { field: string }).field, 'periods');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 100, periods: 601, startDate: '2026-01-01' }) as { field: string }).field, 'periods');
  assert.equal((parseRepaymentPlanRequest({ name: 'a', principal: 100, periods: 12, startDate: '2026-13-01' }) as { field: string }).field, 'startDate');
  // 利率未提供時預設 0（零利率）。
  const zeroRate = parseRepaymentPlanRequest({ name: 'a', principal: 100, periods: 12, startDate: '2026-01-01' });
  assert.equal((zeroRate as { annualRatePercent: number }).annualRatePercent, 0);
  // 利率四捨五入至小數 4 位。
  const rounded = parseRepaymentPlanRequest({ name: 'a', principal: 100, annualRatePercent: 2.3456789, periods: 12, startDate: '2026-01-01' });
  assert.equal((rounded as { annualRatePercent: number }).annualRatePercent, 2.3457);

  const nonAmortizing = parseRepaymentPlanRequest({
    name: '不可清償計畫', principal: 1_000_000, annualRatePercent: 100, periods: 600, startDate: '2026-01-01',
  });
  assert.equal((nonAmortizing as { field: string }).field, 'periods', '無法攤還的輸入組合應在寫入前被拒絕');
  const balloon = parseRepaymentPlanRequest({
    name: '尾款過高計畫', principal: 1_000_000, annualRatePercent: 99.9, periods: 60, startDate: '2026-01-01',
  });
  assert.equal((balloon as { field: string }).field, 'periods', '尾款過高的輸入組合應在寫入前被拒絕');
  const earlyPayoff = parseRepaymentPlanRequest({
    name: '無法分期計畫', principal: 10, annualRatePercent: 0, periods: 600, startDate: '2026-01-01',
  });
  assert.equal((earlyPayoff as { field: string }).field, 'periods', '月付金精度導致提前清償的期程應被拒絕');
});
