# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\dashboard.test.ts >> dashboard loads and shows data
- Location: tests\e2e\dashboard.test.ts:3:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/app/dashboard", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('dashboard loads and shows data', async ({ page }) => {
  4  |   // 假設已登入，這裡需要設定 cookie 或模擬登入
  5  |   // 為了本次遷移驗證，暫時假定已登入狀態
> 6  |   await page.goto('/app/dashboard');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  7  |   
  8  |   await expect(page.getByText('儀表板')).toBeVisible();
  9  |   await expect(page.getByText('總收入:')).toBeVisible();
  10 |   await expect(page.getByText('總支出:')).toBeVisible();
  11 | });
  12 | 
```