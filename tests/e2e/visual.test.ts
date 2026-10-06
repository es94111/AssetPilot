// tests/e2e/visual.test.ts — 視覺回歸測試（issue #264）
//
// 驗收條件：「視覺回歸測試涵蓋深色／淺色主題」。
// 刻意只對穩定、無第三方腳本／圖表動畫的區塊做截圖比對（登入頁整頁；
// 儀表板的 hero 淨額卡片，資料由固定金額的測試交易產生，排除時間戳記等
// 動態區塊），降低 flaky 的機率。
//
// 基準圖（*-snapshots/）刻意不在本次 PR 內建立：Playwright 的截圖比對
// 需要與執行環境完全一致的字型/算繪結果，在本機（非 CI runner）產生的
// 基準圖套用到 GitHub Actions ubuntu runner 幾乎必定失敗。請於合併後，
// 由維護者於 `.github/workflows/e2e.yml` 的
// "Update visual snapshots"（workflow_dispatch）手動觸發一次，
// 下載產生的 snapshot artifact 並提交，後續 CI 才會開始比對差異。
// 詳見 tests/e2e/README.md。
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';
import { forceTheme, type ThemeMode } from './support/theme';

const THEMES: ThemeMode[] = ['light', 'dark'];

test.describe('visual regression', () => {
  for (const theme of THEMES) {
    test(`login page (${theme})`, async ({ page }) => {
      await forceTheme(page, theme);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'AssetPilot' })).toBeVisible();
      await expect(page).toHaveScreenshot(`login-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`dashboard hero (${theme})`, async ({ authedPage, testUser }) => {
      const today = new Date().toISOString().slice(0, 10);
      await createE2ETransaction(testUser.id, { type: 'income', amount: 50000, date: today });
      await createE2ETransaction(testUser.id, { type: 'expense', amount: 20000, date: today });
      await forceTheme(authedPage, theme);
      await authedPage.goto('/dashboard');

      const hero = authedPage.locator('.dashboard-hero');
      await expect(hero).toBeVisible();
      await expect(hero).toHaveScreenshot(`dashboard-hero-${theme}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
