// tests/e2e/support/fixtures.ts — 共用 Playwright fixtures
//
// 提供已登入（authedPage）與未登入（page，沿用 @playwright/test 原生 fixture）
// 兩種情境。每個測試會各自建立一個全新的 E2E 測試使用者，測試結束後自動清除，
// 彼此獨立、可並行執行，且不依賴任何正式環境 OAuth 憑證（見 testUser.ts）。
import { test as base, expect, type Page } from '@playwright/test';
import { createE2ETestUser, deleteE2ETestUser, type E2ETestUser } from './testUser';

type Fixtures = {
  testUser: E2ETestUser;
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  // 覆寫內建 page fixture：components/public/SplashIntro.tsx 的品牌入場動畫
  // 以 sessionStorage 記錄「本工作階段已播放過」，否則每次造訪都會播放
  // 2.1 秒、覆蓋全畫面的動畫。Playwright 每個測試都是全新瀏覽器 context
  // （sessionStorage 必為空），若不先標記為已播放，會讓畫面斷言／截圖在
  // 動畫期間抓到被蓋住的畫面（toBeVisible() 不檢查是否被其他元素遮擋）。
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem('assetpilot-splash-played', '1');
      } catch {
        // sessionStorage 可能在極少數環境被封鎖；忽略即可，頂多動畫多播一次。
      }
    });
    await use(page);
  },

  testUser: async ({}, use) => {
    const user = await createE2ETestUser();
    await use(user);
    await deleteE2ETestUser(user.id);
  },

  authedPage: async ({ page, baseURL, testUser }, use) => {
    await page.context().addCookies([
      {
        name: 'authToken',
        value: testUser.token,
        url: baseURL,
      },
    ]);
    await use(page);
  },
});

export { expect };
