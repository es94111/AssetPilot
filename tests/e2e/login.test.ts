// tests/e2e/login.test.ts — 登入流程（issue #264）
//
// 密碼登入已停用（app/api/auth/login/route.ts），正式登入只能透過 Google／
// LINE／Passkey，無法在 CI 中以真實第三方憑證重現。這裡改驗證兩段可重現、
// 不依賴正式環境憑證的行為：
//   1. 未登入造訪受保護頁面會被導向 /login（requireServerAuth 的守門邏輯）。
//   2. /login 頁面本身渲染正確（標題、說明文字、可用的登入方式）。
// 已登入後可存取頁面的情境由 dashboard.test.ts 等其他 spec 覆蓋
// （透過 tests/e2e/support/testUser.ts 注入可重現的測試 session）。
// 使用共用 fixtures（而非直接 import '@playwright/test'）是為了沿用其
// page fixture 覆寫：預先標記品牌入場動畫（SplashIntro）已播放，避免該
// 2.1 秒全螢幕動畫蓋住畫面，讓這裡的斷言更快、更穩定。
import { test, expect } from './support/fixtures';

test.describe('login', () => {
  test('unauthenticated users are redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });

  test('login page renders available sign-in methods', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'AssetPilot' })).toBeVisible();
    await expect(page.getByText('歡迎回來，請登入您的帳號')).toBeVisible();
    // Passkey 登入在未設定 Google/LINE 的測試環境下必定渲染。
    await expect(page.getByRole('button', { name: '使用 Passkey 登入' })).toBeVisible();
  });
});
