import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduledCashOutlook, getScheduledAccountImpactTwd } from '../../lib/dashboardForecast.ts';
import { getNextRecurringDate, listRecurringDatesInWindow } from '../../lib/recurringSchedule.ts';

test('recurring dates clamp month ends and leap years deterministically', () => {
  assert.equal(getNextRecurringDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(getNextRecurringDate('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(getNextRecurringDate('2024-02-29', 'yearly'), '2025-02-28');
  assert.equal(getNextRecurringDate('2026-01-01', 'weekly'), '2026-01-08');
  assert.equal(getNextRecurringDate('invalid', 'monthly'), null);
});

test('recurring window skips overdue occurrences and excludes today', () => {
  assert.deepEqual(listRecurringDatesInWindow({
    startDate: '2026-07-01',
    frequency: 'weekly',
    afterDate: '2026-07-18',
    throughDate: '2026-08-17',
  }), ['2026-07-22', '2026-07-29', '2026-08-05', '2026-08-12']);
});

test('recurring window rejects impossible calendar dates', () => {
  assert.deepEqual(listRecurringDatesInWindow({
    startDate: '2026-07-32',
    frequency: 'monthly',
    afterDate: '2026-07-01',
    throughDate: '2026-08-31',
  }), []);
  assert.equal(getNextRecurringDate('2026-02-30', 'monthly'), null);
});

test('foreign-currency schedules use the account current-rate basis', () => {
  assert.equal(getScheduledAccountImpactTwd({
    amountTwd: 3_000,
    fxFeeTwd: 0,
    recurringCurrency: 'USD',
    storedFxRate: 30,
    accountCurrency: 'USD',
    currentAccountRate: 33,
  }), 3_300);
  assert.equal(getScheduledAccountImpactTwd({
    amountTwd: 3_000,
    fxFeeTwd: 60,
    recurringCurrency: 'USD',
    storedFxRate: 0,
    accountCurrency: 'USD',
    currentAccountRate: 33,
  }), null);
});

test('scheduled cash outlook totals every covered occurrence and reports coverage', () => {
  const outlook = buildScheduledCashOutlook({
    today: '2026-07-18',
    startingBalance: 20_000,
    bankAccountCount: 1,
    schedules: [
      { id: 'salary', type: 'income', amount: 30_000, frequency: 'monthly', startDate: '2026-07-25', note: 'Salary', included: true },
      { id: 'rent', type: 'expense', amount: 18_000, frequency: 'monthly', startDate: '2026-07-20', note: 'Rent', included: true },
      { id: 'coffee', type: 'expense', amount: 100, frequency: 'daily', startDate: '2026-07-19', note: 'Coffee', included: false },
    ],
  });

  assert.equal(outlook.available, true);
  assert.equal(outlook.scheduledIncome, 30_000);
  assert.equal(outlook.scheduledExpense, 18_000);
  assert.equal(outlook.projectedClosingBalance, 32_000);
  assert.equal(outlook.lowestProjectedBalance, 2_000);
  assert.equal(outlook.lowestBalanceDate, '2026-07-20');
  assert.equal(outlook.uncoveredScheduleCount, 1);
  assert.equal(outlook.occurrenceCount, 2);
});

test('same-day events use end-of-day net and identify the first shortfall', () => {
  const outlook = buildScheduledCashOutlook({
    today: '2026-07-18',
    startingBalance: 1_000,
    bankAccountCount: 1,
    schedules: [
      { id: 'income', type: 'income', amount: 500, frequency: 'monthly', startDate: '2026-07-20', note: 'Income', included: true },
      { id: 'expense', type: 'expense', amount: 2_000, frequency: 'monthly', startDate: '2026-07-20', note: 'Expense', included: true },
    ],
  });

  assert.equal(outlook.projectedClosingBalance, -500);
  assert.equal(outlook.lowestProjectedBalance, -500);
  assert.equal(outlook.firstShortfallDate, '2026-07-20');
  assert.equal(outlook.firstShortfallBalance, -500);
});

test('outlook returns explicit unavailable states', () => {
  const noBank = buildScheduledCashOutlook({
    today: '2026-07-18', startingBalance: 0, bankAccountCount: 0, schedules: [],
  });
  assert.equal(noBank.available, false);
  assert.equal(noBank.unavailableReason, 'noBankAccounts');

  const noSchedules = buildScheduledCashOutlook({
    today: '2026-07-18', startingBalance: 0, bankAccountCount: 1, schedules: [],
  });
  assert.equal(noSchedules.unavailableReason, 'noSchedules');

  const uncovered = buildScheduledCashOutlook({
    today: '2026-07-18',
    startingBalance: 1_000,
    bankAccountCount: 1,
    schedules: [{ id: 'x', type: 'expense', amount: 100, frequency: 'monthly', startDate: '2026-07-20', note: '', included: false }],
  });
  assert.equal(uncovered.unavailableReason, 'noCoveredSchedules');
  assert.equal(uncovered.uncoveredScheduleCount, 1);
});
