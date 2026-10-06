// tests/e2e/budget.test.ts — 預算（issue #264）
import { test, expect } from './support/fixtures';

test('user can create a monthly budget end-to-end', async ({ authedPage }) => {
  await authedPage.goto('/finance/budget');
  // AppLayout 補的 sr-only <h1> 與可見標題文字相同，取第一個即可。
  await expect(authedPage.getByRole('heading', { name: '預算管理' }).first()).toBeVisible();

  await authedPage.getByRole('button', { name: '新增預算' }).click();

  const dialog = authedPage.getByRole('dialog');
  await expect(dialog.getByText('新增預算')).toBeVisible();
  await dialog.getByLabel('預算金額 *').fill('5000');
  await dialog.getByRole('button', { name: '儲存' }).click();

  await expect(dialog).toBeHidden();
  await expect(authedPage.getByText('（總預算）')).toBeVisible();
  await expect(authedPage.getByText('NT$ 5,000').first()).toBeVisible();
});
