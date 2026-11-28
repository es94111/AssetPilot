// tests/e2e/reports.test.ts — 報表（issue #264 / #255）
import { readFile } from 'node:fs/promises';
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('reports page summarizes seeded transactions for the current month', async ({ authedPage, testUser }) => {
  const seedDate = todayIsoDate();
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 3000, date: seedDate, note: 'E2E 報表測試' });

  await authedPage.goto('/finance/reports');
  await expect(authedPage.getByRole('heading', { name: '統計報表' }).first()).toBeVisible();

  await authedPage.getByLabel('期間').selectOption({ label: '自訂' });
  await authedPage.getByLabel('開始').fill(seedDate);
  await authedPage.getByLabel('結束').fill(seedDate);

  await expect(authedPage.getByText('本期合計')).toBeVisible();
  await expect(authedPage.getByText('NT$ 3,000').first()).toBeVisible();
});

test('reports page converts to the selected base currency and exports matching CSV', async ({ authedPage, testUser }) => {
  const seedDate = todayIsoDate();
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 3000, date: seedDate, note: 'E2E 多幣別報表測試' });

  await authedPage.goto('/finance/reports');
  await authedPage.getByLabel('期間').selectOption({ label: '自訂' });
  await authedPage.getByLabel('開始').fill(seedDate);
  await authedPage.getByLabel('結束').fill(seedDate);
  await authedPage.getByText('報表選項', { exact: true }).click();
  await authedPage.getByLabel('基準幣別').selectOption('USD');

  await expect(authedPage.getByText('95.24 USD').first()).toBeVisible();
  await expect(authedPage.getByText(/全球即時匯率 API|系統預設匯率/)).toBeVisible();

  const downloadPromise = authedPage.waitForEvent('download');
  await authedPage.getByRole('button', { name: '匯出 CSV' }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('幣別');
  expect(csv).toContain('USD');
  expect(csv).toContain('95.24');
  expect(csv).toContain('匯率來源');
  expect(csv).toContain('匯率時間');
});
