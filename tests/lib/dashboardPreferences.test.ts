import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DASHBOARD_MODULE_IDS,
  normalizeDashboardLayout,
  parseDashboardLayout,
} from '../../lib/dashboardPreferences.ts';

test('dashboard layout keeps a deterministic allowlisted order', () => {
  const layout = normalizeDashboardLayout({
    moduleOrder: ['whyChanged', 'assets', 'whyChanged', 'unknown'],
    hiddenModules: ['assets', 'unknown', 'assets'],
  });

  assert.deepEqual(layout.moduleOrder.slice(0, 2), ['whyChanged', 'assets']);
  assert.deepEqual(new Set(layout.moduleOrder), new Set(DASHBOARD_MODULE_IDS));
  assert.deepEqual(layout.hiddenModules, ['assets']);
});

test('dashboard layout safely falls back for invalid JSON and future fields', () => {
  assert.deepEqual(parseDashboardLayout('{broken'), normalizeDashboardLayout(null));
  assert.deepEqual(
    parseDashboardLayout(JSON.stringify({ version: 99, moduleOrder: ['attention'], extra: true })),
    normalizeDashboardLayout({ moduleOrder: ['attention'] })
  );
});
