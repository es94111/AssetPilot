// tests/e2e/accessibility.test.ts — 無障礙檢測（issue #264）
//
// 驗收條件：「無障礙檢測（axe）納入 CI，重大違規視為失敗」「涵蓋深色／淺色主題」。
// 對主要頁面（含未登入的 /login）各以淺色、深色主題跑一次 axe 掃描；
// critical／serious 違規會讓測試失敗，其餘等級只記錄於報表附件
// （見 tests/e2e/support/a11y.ts）。
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';
import { assertNoSeriousA11yViolations } from './support/a11y';
import { forceTheme, type ThemeMode } from './support/theme';

const THEMES: ThemeMode[] = ['light', 'dark'];

test.describe('accessibility — public pages', () => {
  for (const theme of THEMES) {
    test(`login page has no serious violations (${theme})`, async ({ page }, testInfo) => {
      await forceTheme(page, theme);
      await page.goto('/login');
      await assertNoSeriousA11yViolations(page, testInfo, `login-${theme}`);
    });
  }
});

test.describe('accessibility — authenticated pages', () => {
  const PAGES: Array<{ path: string; label: string; heading: string }> = [
    { path: '/dashboard', label: 'dashboard', heading: '儀表板' },
    { path: '/finance/transactions', label: 'transactions', heading: '交易記錄' },
    { path: '/finance/budget', label: 'budget', heading: '預算管理' },
    { path: '/stocks/portfolio', label: 'portfolio', heading: '持股總覽' },
    { path: '/finance/reports', label: 'reports', heading: '統計報表' },
  ];

  for (const theme of THEMES) {
    for (const { path, label, heading } of PAGES) {
      test(`${label} has no serious violations (${theme})`, async ({ authedPage, testUser }, testInfo) => {
        await createE2ETransaction(testUser.id, { type: 'expense', amount: 1000 });
        await forceTheme(authedPage, theme);
        await authedPage.goto(path);
        // 等待頁面主要內容（標題）渲染完成，避免掃到載入骨架畫面。
        // AppLayout 可能補一個與可見標題文字相同的 sr-only <h1>，取第一個即可。
        await expect(authedPage.getByRole('heading', { name: heading }).first()).toBeVisible();
        await assertNoSeriousA11yViolations(authedPage, testInfo, `${label}-${theme}`);
      });
    }
  }
});
