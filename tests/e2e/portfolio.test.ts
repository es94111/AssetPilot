// tests/e2e/portfolio.test.ts — 持股（issue #264）
//
// 股票透過 fixtures 直接寫入 DB（避免呼叫 TWSE／Yahoo Finance 等外部報價
// API，確保測試可重現且不受外部服務可用性影響）。測試聚焦在「記一筆買進
// 交易後，持股總覽會正確反映」這段使用者可觀察到的行為。
import { test, expect } from './support/fixtures';
import { createE2EStock } from './support/testUser';

test('recording a buy transaction surfaces the holding in the portfolio', async ({ authedPage, testUser }) => {
  await createE2EStock(testUser.id, { symbol: '2330', name: '台積電', market: 'TW' });

  await authedPage.goto('/stocks/transactions');
  await expect(authedPage.getByRole('heading', { name: '股票交易紀錄' }).first()).toBeVisible();

  await authedPage.getByRole('button', { name: '新增交易' }).click();
  const dialog = authedPage.getByRole('dialog');
  await expect(dialog.getByText('新增交易')).toBeVisible();

  // 對話框開啟時已預先帶入唯一一檔股票（stockId = stocks[0].id），不需再手動選擇。
  await dialog.getByLabel('股數 *').fill('1000');
  await dialog.getByLabel('單價 *').fill('600');
  await dialog.getByRole('button', { name: '儲存' }).click();

  // 確認送出沒有顯示任何表單錯誤（而非等對話框自動關閉——此表單送出成功後不會自動關閉對話框）。
  await expect(dialog.locator('p.text-red-500')).toHaveCount(0);
  await authedPage.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const txTable = authedPage.getByRole('table');
  await expect(txTable.getByText('台積電')).toBeVisible();
  await expect(txTable.getByText('NT$ 600').first()).toBeVisible();

  await authedPage.goto('/stocks/portfolio');
  await expect(authedPage.getByRole('heading', { name: '持股總覽' }).first()).toBeVisible();
  await expect(authedPage.getByText('2330')).toBeVisible();
  await expect(authedPage.getByText('台積電').first()).toBeVisible();
});
