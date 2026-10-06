// tests/e2e/visual.test.ts — 視覺回歸測試（issue #264）
//
// 驗收條件：「視覺回歸測試涵蓋深色／淺色主題」。
// 刻意只對穩定、無第三方腳本／圖表動畫的區塊做截圖比對（登入頁整頁；
// 儀表板的 hero 淨額卡片，資料由固定金額的測試交易產生，排除時間戳記等
// 動態區塊），降低 flaky 的機率。
//
// 基準圖（tests/e2e/visual.test.ts-snapshots/*-linux.png）透過
// `.github/workflows/e2e.yml` 的 "Update visual snapshots"
// （workflow_dispatch）在與正式 CI 相同的 ubuntu runner 上產生、人工檢視
// 後提交，確保與比對環境一致。畫面調整後如何重新產生基準圖，詳見
// tests/e2e/README.md。
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
