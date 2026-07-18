import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardDrivers, getHoldingMarketContribution } from '../../lib/dashboardInsights.ts';

test('buildDashboardDrivers returns a deterministic Top 3 across income and expense groups', () => {
  const drivers = buildDashboardDrivers(
    [
      { parentName: 'Housing', parentColor: '#111111', total: 30_000 },
      { parentName: 'Food', parentColor: '#222222', total: 12_000 },
      { parentName: 'Travel', parentColor: '#333333', total: 8_000 },
    ],
    [
      { parentName: 'Salary', parentColor: '#444444', total: 80_000 },
      { parentName: 'Bonus', parentColor: '#555555', total: 10_000 },
    ],
    50_000,
    90_000
  );

  assert.deepEqual(
    drivers.map(({ type, name, amount, share }) => ({ type, name, amount, share })),
    [
      { type: 'income', name: 'Salary', amount: 80_000, share: 88.9 },
      { type: 'expense', name: 'Housing', amount: 30_000, share: 60 },
      { type: 'expense', name: 'Food', amount: 12_000, share: 24 },
    ]
  );
});

test('buildDashboardDrivers ignores zero rows and handles a zero type total', () => {
  const drivers = buildDashboardDrivers(
    [{ parentName: 'Other', parentColor: '#111111', total: 0 }],
    [{ parentName: 'Refund', parentColor: '#222222', total: 250 }],
    0,
    0
  );

  assert.equal(drivers.length, 1);
  assert.equal(drivers[0]?.share, 0);
  assert.equal(drivers[0]?.name, 'Refund');
});

test('buildDashboardDrivers uses a stable tie-break and respects the requested limit', () => {
  const drivers = buildDashboardDrivers(
    [{ parentName: 'B', parentColor: '#111111', total: 100 }],
    [{ parentName: 'A', parentColor: '#222222', total: 100 }],
    100,
    100,
    1
  );

  assert.deepEqual(drivers.map(driver => driver.type), ['expense']);
  assert.deepEqual(buildDashboardDrivers([], [], 0, 0), []);
});

test('getHoldingMarketContribution excludes sold and non-positive-price positions safely', () => {
  assert.deepEqual(getHoldingMarketContribution(0, 100), { marketValue: 0, unpriced: false });
  assert.deepEqual(getHoldingMarketContribution(10, 0), { marketValue: 0, unpriced: true });
  assert.deepEqual(getHoldingMarketContribution(10, -5), { marketValue: 0, unpriced: true });
  assert.deepEqual(getHoldingMarketContribution(10, 25), { marketValue: 250, unpriced: false });
});
