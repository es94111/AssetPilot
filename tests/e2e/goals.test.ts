// tests/e2e/goals.test.ts — 儲蓄目標與還款計畫（issue #260）
import { test, expect } from './support/fixtures';

test('user can create a savings goal and an amortization plan end-to-end', async ({ authedPage }) => {
  await authedPage.goto('/finance/goals');
  await expect(authedPage.getByRole('heading', { name: '儲蓄目標' })).toBeVisible();
  await expect(authedPage.getByRole('heading', { name: '還款計畫' })).toBeVisible();

  await authedPage.getByRole('button', { name: '新增目標' }).click();
  const goalDialog = authedPage.getByRole('dialog');
  await goalDialog.getByLabel('目標名稱 *').fill('E2E 旅遊基金');
  await goalDialog.getByLabel('目標金額 *').fill('100000');
  await goalDialog.getByLabel('目標日期 *').fill('2027-12-31');
  await goalDialog.getByRole('button', { name: '儲存' }).click();

  await expect(goalDialog).toBeHidden();
  const goalCard = authedPage.locator('li').filter({ hasText: 'E2E 旅遊基金' }).first();
  await expect(goalCard).toBeVisible();
  await expect(goalCard.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

  await authedPage.getByRole('button', { name: '新增還款計畫' }).click();
  const planDialog = authedPage.getByRole('dialog');
  await planDialog.getByLabel('計畫名稱 *').fill('E2E 信貸');
  await planDialog.getByLabel('本金 *').fill('120000');
  await planDialog.getByLabel('年利率（%）').fill('6');
  await planDialog.getByLabel('期數（月）*').fill('12');
  await planDialog.getByLabel('首次應繳日 *').fill('2026-11-01');
  await expect(planDialog.getByText('攤還試算')).toBeVisible();
  await expect(planDialog.getByText('NT$ 10,328')).toBeVisible();
  await planDialog.getByRole('button', { name: '儲存' }).click();

  await expect(planDialog).toBeHidden();
  const planCard = authedPage.locator('li').filter({ hasText: 'E2E 信貸' }).first();
  await expect(planCard).toBeVisible();
  await planCard.getByRole('button', { name: '查看攤還表' }).click();
  const scheduleDialog = authedPage.getByRole('dialog');
  await expect(scheduleDialog.getByRole('table')).toBeVisible();
  await expect(scheduleDialog.getByRole('row')).toHaveCount(13);
});
