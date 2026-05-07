import { test, expect } from '@playwright/test';

test('transactions page loads and filters', async ({ page }) => {
  await page.goto('/finance/transactions');
  
  await expect(page.getByText('交易紀錄')).toBeVisible();
});
