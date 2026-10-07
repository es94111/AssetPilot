// tests/e2e/export.test.ts — 匯出（issue #264、#261）
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

test('user can export transactions as XLSX', async ({ authedPage, testUser }) => {
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 1234.56, note: "=E2E 匯出測試" });

  await authedPage.goto('/settings/export');
  await expect(authedPage.getByRole('heading', { name: '資料匯出匯入' }).first()).toBeVisible();

  // 匯出頁可選擇 CSV 或 XLSX。
  await authedPage.getByLabel('匯出格式').selectOption('xlsx');

  const transactionsSection = authedPage.locator('section').filter({ hasText: '交易記錄' }).first();
  const downloadPromise = authedPage.waitForEvent('download');
  await transactionsSection.getByRole('button', { name: '匯出 Excel' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^transactions-\d{8}\.xlsx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});
