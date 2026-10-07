import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';
import { getDB, queryOne } from '../../lib/db';
import { assertNoSeriousA11yViolations } from './support/a11y';
import { forceTheme } from './support/theme';

for (const theme of ['light', 'dark'] as const) {
  test(`ledger management has no serious accessibility violations (${theme})`, async ({ authedPage }, testInfo) => {
    await forceTheme(authedPage, theme);
    await authedPage.goto('/settings/ledgers');
    await expect(authedPage.getByRole('heading', { name: '帳本共享管理' })).toBeVisible();
    await assertNoSeriousA11yViolations(authedPage, testInfo, `ledgers-${theme}`);
  });
}

test('stale or revoked ledger selection resets safely to the current user personal ledger', async ({ authedPage, testUser }) => {
  await createE2ETransaction(testUser.id, { note: 'Personal after revoked selection' });
  await authedPage.addInitScript(() => {
    if (!window.sessionStorage.getItem('ledger-stale-test-initialized')) {
      window.localStorage.setItem('assetpilot.active-ledger-id', 'revoked-ledger');
      window.sessionStorage.setItem('ledger-stale-test-initialized', '1');
    }
  });
  await authedPage.goto('/finance/transactions');
  await expect(authedPage.locator('#active-ledger')).toHaveValue(`personal:${testUser.id}`);
  await expect(authedPage.getByText('Personal after revoked selection', { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('creating an empty shared ledger keeps personal transactions private and switching restores them', async ({ authedPage, testUser }) => {
  await createE2ETransaction(testUser.id, { amount: 77, note: 'Private ledger fixture' });
  const name = `Family ${testUser.id}`;
  let ledgerId = '';
  try {
    await authedPage.goto('/settings/ledgers');
    await expect(authedPage.getByRole('heading', { name: '帳本共享管理' })).toBeVisible();
    await authedPage.getByRole('textbox', { name: '帳本名稱' }).fill(name);
    await authedPage.getByRole('button', { name: '建立帳本', exact: true }).click();
    await expect(authedPage.getByRole('status')).toHaveText('共享帳本已建立。');
    ledgerId = await authedPage.locator('#ledger-select').inputValue();
    expect(ledgerId).not.toBe(`personal:${testUser.id}`);
    await expect(authedPage.locator('#active-ledger')).toHaveValue(ledgerId);
    await authedPage.goto('/finance/transactions');
    await expect(authedPage.getByText('Private ledger fixture', { exact: true })).toHaveCount(0);
    const response = await authedPage.request.get('/api/transactions', { headers: { 'x-ledger-id': ledgerId } });
    expect((await response.json()).total).toBe(0);
    await authedPage.locator('#active-ledger').selectOption(`personal:${testUser.id}`);
    await expect(authedPage.getByText('Private ledger fixture', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  } finally {
    if (ledgerId) {
      const dataOwner = queryOne('SELECT data_owner_id FROM financial_ledgers WHERE id = ?', [ledgerId])?.data_owner_id;
      if (dataOwner) {
        for (const table of ['accounts', 'categories', 'transactions', 'budgets', 'recurring']) {
          getDB().run(`DELETE FROM ${table} WHERE user_id = ?`, [dataOwner]);
        }
      }
      getDB().run('DELETE FROM financial_ledgers WHERE id = ?', [ledgerId]);
    }
  }
});
