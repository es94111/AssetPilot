// tests/e2e/transactions.test.ts — 新增交易（issue #264）
// 以 tests/e2e/support/fixtures.ts 的 authedPage 注入可重現的已登入測試使用者。
import { test, expect } from './support/fixtures';

test('transactions page loads', async ({ authedPage }) => {
  await authedPage.goto('/finance/transactions');
  // AppLayout 於內容未自帶 <h1> 時會補一個 sr-only <h1> 供無障礙用途，
  // 與頁面內容的可見標題文字相同，故取第一個即可（兩者文字恆一致）。
  await expect(authedPage.getByRole('heading', { name: '交易記錄' }).first()).toBeVisible();
});

test('user gets an explicit category suggestion from matching transaction history', async ({ authedPage }) => {
  const categoriesResponse = await authedPage.request.get('/api/categories');
  expect(categoriesResponse.ok()).toBeTruthy();
  const categories = await categoriesResponse.json();
  const category = categories.find((item: { parentId?: string; id: string; name: string }) => item.parentId);
  expect(category, 'the test user has at least one default leaf category').toBeTruthy();

  for (const date of ['2026-09-10', '2026-09-17', '2026-09-24']) {
    const response = await authedPage.request.post('/api/transactions', {
      headers: { Origin: 'http://localhost:3000' },
      data: {
        type: 'expense', amount: 420, date, categoryId: category.id,
        note: 'coffee shop', currency: 'TWD',
      },
    });
    expect(response.ok(), `transaction seed failed (${response.status()}): ${await response.text()}`).toBeTruthy();
  }

  await authedPage.goto('/finance/transactions');
  await authedPage.getByRole('button', { name: '新增交易' }).first().click();
  const dialog = authedPage.getByRole('dialog');
  await dialog.locator('details > summary').click();
  await dialog.locator('#transaction-note').fill('coffee shop');

  // The recommendation is a button with a confidence percentage; it is not
  // applied until the user explicitly selects the suggestion.
  const suggestion = dialog.getByRole('button').filter({ hasText: category.name }).filter({ hasText: /\d+%/ });
  await expect(suggestion).toBeVisible();
  await expect(dialog.locator('#transaction-category')).toHaveValue('');
  await suggestion.click();
  await expect(dialog.locator('#transaction-category')).toHaveValue(category.id);
});
