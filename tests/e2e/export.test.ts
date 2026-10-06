// tests/e2e/export.test.ts — 匯出（issue #264）
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

test('user can export transactions as CSV', async ({ authedPage, testUser }) => {
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 999, note: 'E2E 匯出測試' });

  await authedPage.goto('/settings/export');
  await expect(authedPage.getByRole('heading', { name: '資料匯出匯入' }).first()).toBeVisible();

  const transactionsSection = authedPage.locator('section').filter({ hasText: '交易記錄' }).first();
  const downloadPromise = authedPage.waitForEvent('download');
  await transactionsSection.getByRole('button', { name: '匯出 CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const path = await download.path();
  expect(path).toBeTruthy();
});
