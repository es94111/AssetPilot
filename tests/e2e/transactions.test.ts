// tests/e2e/transactions.test.ts — 新增交易（issue #264）
// 以 tests/e2e/support/fixtures.ts 的 authedPage 注入可重現的已登入測試使用者。
import { test, expect } from './support/fixtures';

test('transactions page loads', async ({ authedPage }) => {
  await authedPage.goto('/finance/transactions');
  // AppLayout 於內容未自帶 <h1> 時會補一個 sr-only <h1> 供無障礙用途，
  // 與頁面內容的可見標題文字相同，故取第一個即可（兩者文字恆一致）。
  await expect(authedPage.getByRole('heading', { name: '交易記錄' }).first()).toBeVisible();
});

test('user can add a new expense transaction end-to-end', async ({ authedPage }) => {
  await authedPage.goto('/finance/transactions');

  // 桌面與行動版各有一顆「新增交易」按鈕（行動版 FAB 於桌面寬度被 CSS 隱藏但仍在 DOM 中），
  // 於預設桌機視窗下取第一個（桌面版）即為實際可見的按鈕。
  await authedPage.getByRole('button', { name: '新增交易' }).first().click();

  const dialog = authedPage.getByRole('dialog');
  await expect(dialog.getByText('新增交易')).toBeVisible();

  await dialog.locator('#transaction-amount').fill('888');
  await dialog.getByRole('button', { name: '儲存' }).click();

  await expect(dialog).toBeHidden();
  await expect(authedPage.getByText('NT$ 888').first()).toBeVisible();
});
