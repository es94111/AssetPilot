// tests/e2e/dashboard.test.ts — 儀表板（issue #264）
// 以 tests/e2e/support/fixtures.ts 的 authedPage 注入可重現的已登入測試使用者，
// 不依賴任何正式環境登入憑證（取代先前「暫時假定已登入狀態」的佔位測試）。
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

test('dashboard loads and shows income/expense totals for seeded data', async ({ authedPage, testUser }) => {
  const today = new Date().toISOString().slice(0, 10);
  await createE2ETransaction(testUser.id, { type: 'income', amount: 50000, date: today, note: 'E2E 薪資' });
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 1200, date: today, note: 'E2E 午餐' });

  await authedPage.goto('/dashboard');

  await expect(authedPage.getByRole('heading', { name: '儀表板', level: 1 })).toBeVisible();
  // Hero 區塊顯示本月淨額（50,000 - 1,200 = 48,800）及收入／支出金額連結。
  await expect(authedPage.getByRole('heading', { name: 'NT$ 48,800', level: 2 })).toBeVisible();
  await expect(authedPage.getByRole('link', { name: '收入 NT$ 50,000' })).toBeVisible();
  await expect(authedPage.getByRole('link', { name: '支出 NT$ 1,200' })).toBeVisible();
});
