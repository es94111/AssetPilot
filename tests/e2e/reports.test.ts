// tests/e2e/reports.test.ts — 報表（issue #264 / #255）
import { readFile } from 'node:fs/promises';
import { test, expect } from './support/fixtures';
import { createE2EExpenseCategory, createE2ETransaction } from './support/testUser';

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

test('report drill-down matches uncategorized and direct parent totals', async ({ authedPage: page, testUser }) => {
  const date = todayIsoDate();
  const parentId = await createE2EExpenseCategory(testUser.id, '報表父分類');
  const childId = await createE2EExpenseCategory(testUser.id, '報表子分類', parentId);

  await createE2ETransaction(testUser.id, { date, amount: 100, note: '篩選未分類交易' });
  await createE2ETransaction(testUser.id, { date, amount: 200, note: '篩選父分類交易', categoryId: parentId });
  await createE2ETransaction(testUser.id, { date, amount: 300, note: '篩選子分類交易', categoryId: childId });
  await createE2ETransaction(testUser.id, { date, amount: 400, note: '篩選統計以外交易', categoryId: parentId, excludeFromStats: true });

  const report = `/finance/reports?period=custom&from=${date}&to=${date}`;
  const transactions = page.getByRole('table');
  await page.goto(report);
  await page.getByRole('link', { name: '查看對應交易 · 未分類 › （其他）', exact: true }).click();
  await expect(transactions.getByText('篩選未分類交易', { exact: true })).toBeVisible();
  await expect(transactions.getByText('篩選父分類交易', { exact: true })).toBeHidden();

  await page.goto(report);
  await page.getByRole('link', { name: '查看對應交易 · 報表父分類 › （其他）', exact: true }).click();
  await expect(transactions.getByText('篩選父分類交易', { exact: true })).toBeVisible();
  await expect(transactions.getByText('篩選子分類交易', { exact: true })).toBeHidden();
  await expect(transactions.getByText('篩選統計以外交易', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: /^篩選/ }).click();
  await page.getByRole('checkbox', { name: '僅顯示計入統計的交易' }).uncheck();
  await page.getByRole('button', { name: '套用' }).click();
  await expect(transactions.getByText('篩選統計以外交易', { exact: true })).toBeVisible();
  await expect(transactions.getByText('篩選子分類交易', { exact: true })).toBeHidden();

  await page.goto(`/finance/transactions?categoryId=${parentId}`);
  await expect(transactions.getByText('篩選父分類交易', { exact: true })).toBeVisible();
  await expect(transactions.getByText('篩選子分類交易', { exact: true })).toBeVisible();
  await expect(transactions.getByText('篩選統計以外交易', { exact: true })).toBeVisible();
});
