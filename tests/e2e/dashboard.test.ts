import { test, expect } from '@playwright/test';

test('dashboard loads and shows data', async ({ page }) => {
  // 假設已登入，這裡需要設定 cookie 或模擬登入
  // 為了本次遷移驗證，暫時假定已登入狀態
  await page.goto('/dashboard');
  
  await expect(page.getByText('儀表板')).toBeVisible();
  await expect(page.getByText('總收入')).toBeVisible();
  await expect(page.getByText('總支出')).toBeVisible();
});
