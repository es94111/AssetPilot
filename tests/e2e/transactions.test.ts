// tests/e2e/transactions.test.ts — 新增交易（issue #264）、儲存後維持分頁位置
// 以 tests/e2e/support/fixtures.ts 的 authedPage 注入可重現的已登入測試使用者。
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

type CategoryItem = { id: string; name: string; type: string; parentId?: string | null };

// 列表依日期新到舊排序；每筆給不同日期，讓各頁內容可預期。
function seedDate(offset: number) {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
}

async function seedExpenses(
  userId: string,
  count: number,
  options: { categoryId: string; notes?: Record<number, string> },
) {
  for (let i = 0; i < count; i += 1) {
    await createE2ETransaction(userId, {
      type: 'expense',
      amount: 100 + i,
      date: seedDate(i),
      note: options.notes?.[i] ?? `E2E page seed ${i}`,
      categoryId: options.categoryId,
    });
  }
}

/** 取兩個不同父分類底下的支出子分類；toLabel 為列表上顯示的「父 › 子」名稱。 */
async function pickExpenseLeafCategories(page: Page) {
  const response = await page.request.get('/api/categories');
  expect(response.ok()).toBeTruthy();
  const categories: CategoryItem[] = await response.json();
  const leaves = categories.filter((item) => item.type === 'expense' && item.parentId);
  const from = leaves[0];
  const to = leaves.find((item) => item.parentId !== from?.parentId);
  if (!from || !to) throw new Error('the test user needs expense leaf categories under two parents');
  const parentName = categories.find((item) => item.id === to.parentId)?.name;
  return { from, to, toLabel: `${parentName} › ${to.name}` };
}

async function chooseCategoryAndSave(page: Page, categoryId: string) {
  const dialog = page.getByRole('dialog');
  await dialog.locator('#transaction-category').selectOption(categoryId);
  await dialog.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function recategorizeRow(page: Page, row: Locator, categoryId: string) {
  await row.getByRole('button', { name: /^編輯/ }).click();
  await chooseCategoryAndSave(page, categoryId);
}

async function expectListQuery(page: Page, expected: Record<string, string>) {
  await expect(page).toHaveURL((url) => Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value));
}

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
  const category = categories.find((item: { type: string; parentId?: string; id: string; name: string }) => item.type === 'expense' && item.parentId);
  expect(category, 'the test user has a default expense leaf category').toBeTruthy();
  const origin = new URL(categoriesResponse.url()).origin;

  for (const daysAgo of [21, 14, 7]) {
    const date = new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
    const response = await authedPage.request.post('/api/transactions', {
      headers: { Origin: origin },
      data: {
        type: 'expense', amount: 420, date, categoryId: category.id,
        note: 'coffee shop', currency: 'TWD',
      },
    });
    expect(response.ok(), `transaction seed failed (${response.status()}): ${await response.text()}`).toBeTruthy();
  }

  await authedPage.goto('/finance/transactions');
  await authedPage.getByRole('button', { name: '記一筆' }).first().click();
  const dialog = authedPage.getByRole('dialog');
  await dialog.getByText('交易細節', { exact: true }).click();
  await dialog.locator('#transaction-note').fill('coffee shop');

  // The recommendation is a button with a confidence percentage; it is not
  // applied until the user explicitly selects the suggestion.
  const suggestion = dialog.getByRole('button').filter({ hasText: category.name }).filter({ hasText: /\d+%/ });
  await expect(suggestion).toBeVisible();
  await expect(dialog.locator('#transaction-category')).toHaveValue('');
  await suggestion.click();
  await expect(dialog.locator('#transaction-category')).toHaveValue(category.id);
});

test('editing a transaction keeps the current page after saving', async ({ authedPage, testUser }) => {
  const { from, to, toLabel } = await pickExpenseLeafCategories(authedPage);
  // 25 筆、每頁 20 筆：第 3 舊的目標交易落在第 2 頁。
  await seedExpenses(testUser.id, 25, { categoryId: from.id, notes: { 2: 'E2E edit target' } });

  await authedPage.goto('/finance/transactions?page=2&limit=20');
  const pageInfo = authedPage.locator('.page-info');
  const targetRow = authedPage.getByRole('row').filter({ hasText: 'E2E edit target' });
  await expect(pageInfo).toHaveText('2 / 2');
  await recategorizeRow(authedPage, targetRow, to.id);

  await expect(targetRow.getByRole('cell').nth(3)).toHaveText(toLabel);
  await expect(pageInfo).toHaveText('2 / 2');
  await expectListQuery(authedPage, { page: '2', limit: '20' });
});

async function expectAddKeepsPageAndFilters(page: Page, userId: string, openAddDialog: (page: Page) => Promise<void>) {
  const { from } = await pickExpenseLeafCategories(page);
  await seedExpenses(userId, 25, { categoryId: from.id });

  await page.goto(`/finance/transactions?page=2&limit=20&categoryId=${from.id}`);
  const pageInfo = page.locator('.page-info');
  const count = page.locator('.tx-count');
  await expect(pageInfo).toHaveText('2 / 2');
  await expect(count).toHaveText('共 25 筆');

  await openAddDialog(page);
  await page.getByRole('dialog').locator('#transaction-amount').fill('321');
  await chooseCategoryAndSave(page, from.id);

  await expect(count).toHaveText('共 26 筆');
  await expect(pageInfo).toHaveText('2 / 2');
  await expectListQuery(page, { page: '2', limit: '20', categoryId: from.id });
}

test('adding a transaction from the page button keeps the current page and filters', async ({ authedPage, testUser }) => {
  await expectAddKeepsPageAndFilters(authedPage, testUser.id, (page) => page.getByRole('button', { name: '記一筆' }).first().click());
});

test.describe('keyboard quick add', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test('Alt+N opens the same form without losing the current page or filters', async ({ authedPage, testUser }) => {
    await expectAddKeepsPageAndFilters(authedPage, testUser.id, async (page) => {
      await expect(page.getByRole('button', { name: '記一筆' })).toBeEnabled();
      await page.keyboard.press('Alt+n');
    });
  });
});

test('editing the only transaction on the last filtered page falls back to the new last page', async ({ authedPage, testUser }) => {
  const { from, to } = await pickExpenseLeafCategories(authedPage);
  // 41 筆同分類、每頁 20 筆：第 3 頁只剩最舊的一筆。
  await seedExpenses(testUser.id, 41, { categoryId: from.id, notes: { 0: 'E2E last page only row' } });

  await authedPage.goto(`/finance/transactions?page=3&limit=20&categoryId=${from.id}`);
  const pageInfo = authedPage.locator('.page-info');
  const targetRow = authedPage.getByRole('row').filter({ hasText: 'E2E last page only row' });
  await expect(pageInfo).toHaveText('3 / 3');
  await recategorizeRow(authedPage, targetRow, to.id);

  // 改成其他分類後不再符合篩選、第 3 頁已不存在：退回新的最後一頁，而不是第 1 頁或空白頁。
  await expect(authedPage.locator('.tx-count')).toHaveText('共 40 筆');
  await expect(pageInfo).toHaveText('2 / 2');
  await expect(authedPage.locator('.data-table tbody tr')).toHaveCount(20);
  await expect(targetRow).toHaveCount(0);
  await expectListQuery(authedPage, { page: '2', categoryId: from.id });
});

test('the same form records income and transfers with a single save action', async ({ authedPage: page }) => {
  await page.goto('/dashboard');
  const add = page.getByRole('link', { name: '記一筆', exact: true });
  await expect(add).toHaveCount(1);
  await add.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '支出', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '收入', exact: true }).click();
  await dialog.locator('#transaction-amount').fill('245');
  const incomeRequest = page.waitForRequest(req => new URL(req.url()).pathname === '/api/transactions' && req.method() === 'POST');
  await dialog.getByRole('button', { name: '儲存', exact: true }).click();
  expect((await incomeRequest).postDataJSON()).toMatchObject({ type: 'income', amount: 245 });
  await expect(dialog).toBeHidden();

  // The seeded test user already has a cash account. Make a second one for transfer.
  const origin = new URL(page.url()).origin;
  const accountResponse = await page.request.post('/api/accounts', {
    headers: { Origin: origin },
    data: { name: 'UI QA transfer account', category: 'bank', currency: 'TWD', initialBalance: 0 },
  });
  expect(accountResponse.ok(), await accountResponse.text()).toBeTruthy();
  const { id: destination } = await accountResponse.json();
  const accounts = await (await page.request.get('/api/accounts')).json() as Array<{ id: string }>;
  const source = accounts.find(account => account.id !== destination)?.id;
  expect(source).toBeTruthy();

  // Reload account options, then open the existing calendar-style prefilled URL.
  await page.goto('/finance/transactions?action=add&date=2026-01-04');
  await dialog.getByRole('button', { name: '轉帳', exact: true }).click();
  await dialog.locator('#transaction-amount').fill('18');
  await dialog.getByLabel('轉出帳戶', { exact: false }).selectOption(source!);
  await dialog.getByLabel('轉入帳戶', { exact: false }).selectOption(destination);
  const transferRequest = page.waitForRequest(req => new URL(req.url()).pathname === '/api/transactions/transfer' && req.method() === 'POST');
  await dialog.getByRole('button', { name: '確認轉帳' }).click();
  expect((await transferRequest).postDataJSON()).toMatchObject({
    amount: 18, date: '2026-01-04', fromAccountId: source, toAccountId: destination,
  });
  await expect(dialog).toBeHidden();
});

test('a viewer can open the list without seeing or launching write controls', async ({ authedPage: page, testUser }) => {
  await page.route('**/api/ledgers', route => route.fulfill({
    json: [{ id: 'personal:' + testUser.id, name: 'UI QA', isPersonal: true, isShared: false, role: 'viewer' }],
  }));
  await page.goto('/finance/transactions?action=add');
  await expect(page.getByText('此帳本為唯讀，你只能檢視資料。')).toBeVisible();
  await expect(page.getByRole('button', { name: '記一筆' })).toHaveCount(0);
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
