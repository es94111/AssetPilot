import { test, expect } from '@playwright/test';

test('transactions page loads and filters', async ({ page }) => {
  await page.goto('/app/finance/transactions');
  
  await expect(page.getByText('交易紀錄')).toBeVisible();
  
  // Test Filtering
  await page.fill('input[name="account"]', 'Main');
  await page.click('button[type="submit"]');
  
  // Verify URL update
  await expect(page).toHaveURL(/account=Main/);
});
