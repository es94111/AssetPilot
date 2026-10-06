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
