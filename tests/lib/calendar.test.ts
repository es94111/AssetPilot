import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCalendarEvents, getTodayInTimezone } from '../../lib/calendarEvents.ts';
import { addCalendarDays, getCalendarRange, isCalendarIsoDate, listCalendarDates, shiftCalendarAnchor } from '../../lib/calendarDates.ts';


test('month and week ranges are stable date-only intervals', () => {
  const month = getCalendarRange('2026-10-06', 'month');
  assert.deepEqual(month, { from: '2026-09-27', to: '2026-11-07' });
  assert.equal(listCalendarDates(month!).length, 42);

  const week = getCalendarRange('2026-10-06', 'week');
  assert.deepEqual(week, { from: '2026-10-04', to: '2026-10-10' });
  assert.deepEqual(listCalendarDates(week!), [
    '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10',
  ]);
});

test('calendar date math handles leap days, month navigation, and invalid dates', () => {
  assert.equal(isCalendarIsoDate('2024-02-29'), true);
  assert.equal(isCalendarIsoDate('2025-02-29'), false);
  assert.equal(getCalendarRange('2026-02-30', 'month'), null);
  assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addCalendarDays('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftCalendarAnchor('2026-01-31', 'month', 1), '2026-02-01');
  assert.equal(shiftCalendarAnchor('2026-01-03', 'week', -1), '2025-12-27');
});

test('today uses the signed-in user timezone rather than the host timezone', () => {
  const instant = Date.parse('2026-01-01T01:00:00.000Z');
  assert.equal(getTodayInTimezone('Asia/Taipei', instant), '2026-01-01');
  assert.equal(getTodayInTimezone('America/Los_Angeles', instant), '2025-12-31');
  assert.equal(getTodayInTimezone('not/a-timezone', instant), '2026-01-01');
});

test('calendar events aggregate transactions, dividends, and read-only recurring occurrences', () => {
  const events = buildCalendarEvents({
    range: { from: '2026-10-06', to: '2026-10-12' },
    transactions: [
      { id: 'tx-1', date: '2026-10-08', type: 'expense', amount: 125, currency: 'TWD', note: 'Lunch', category_name: 'Food' },
      { id: 'tx-2', date: '2026-10-08', type: 'income', amount: 500, currency: 'TWD', note: 'Refund' },
      { id: 'outside', date: '2026-10-13', type: 'expense', amount: 1 },
    ],
    dividends: [
      { id: 'div-1', date: '2026-10-08', symbol: '2330', stock_name: 'TSMC', cash_dividend: 80, stock_dividend_shares: 0, currency: 'TWD' },
    ],
    recurringSchedules: [
      { id: 'rent', type: 'expense', frequency: 'weekly', start_date: '2026-10-01', last_generated: '2026-10-01', is_active: 1, note: 'Rent', currency: 'TWD' },
      { id: 'paused', type: 'expense', frequency: 'daily', start_date: '2026-10-01', last_generated: null, is_active: 0 },
    ],
  });

  const sameDay = events.filter((event) => event.date === '2026-10-08');
  assert.equal(sameDay.length, 4);
  assert.deepEqual(sameDay.map((event) => event.kind), ['dividend', 'recurring', 'transaction', 'transaction']);
  assert.equal(sameDay.find((event) => event.kind === 'recurring')?.id, 'recurring:rent:2026-10-08');
  assert.equal(events.some((event) => event.id.includes('paused')), false);
  assert.equal(events.some((event) => event.id.includes('outside')), false);
});
