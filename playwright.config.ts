// playwright.config.ts — E2E / 視覺回歸 / 無障礙測試設定（issue #264）
//
// 設計原則：
// - 測試資料全部由 tests/e2e/support 下的 fixtures 以真實 PostgreSQL 直接建立
//   （測試使用者、分類、帳戶、股票），不依賴 Google/LINE 等正式環境 OAuth 憑證
//   （密碼登入已停用，見 app/api/auth/login/route.ts）。
// - webServer 使用 `next build && next start`（而非 `next dev`）：
//   `next dev --webpack` 在本機驗證時，/instrumentation 的 edge-runtime 編譯會因
//   `lib/postgresRuntime.ts` 的 `node:crypto` import 以 UnhandledSchemeError 失敗，
//   導致所有頁面請求回 500（與本次變更無關的既有問題，production build 不受影響）。
// - `next start` 會強制 NODE_ENV=production，authToken cookie 因而帶 `Secure`
//   旗標（見 lib/auth.ts AUTH_COOKIE_OPTIONS）；Chromium 將 http://localhost
//   視為 potentially trustworthy origin，仍會正常設置／送出 Secure cookie，
//   故可照常以 context.addCookies() 注入已登入 session。
// - DATABASE_URL / JWT_SECRET 預設對齊 docker-compose.yml 的本機 Postgres，
//   CI（.github/workflows/e2e.yml）會覆寫為獨立的測試資料庫。
import { defineConfig, devices } from '@playwright/test';

process.env.DATABASE_URL ||= 'postgres://assetpilot:assetpilot@localhost:5432/assetpilot';
process.env.JWT_SECRET ||= 'e2e-test-jwt-secret-do-not-use-in-production-0123456789';
process.env.API_TOKEN_ENCRYPTION_KEY ||= 'e2e-test-api-token-encryption-key-0123456789';

const PORT = process.env.PORT || '3000';
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // 既有 e2e 測試沿用 *.test.ts（與 tests/lib、tests/integration 一致）。
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    // 應用程式預設語言為 zh-TW（見 lib/i18n/resolveLocale.ts），且未登入時
    // 依 Accept-Language 推斷語言；明確指定 locale 讓測試斷言的中文文案
    // 不受執行環境（CI runner／本機 OS）語言設定影響，結果可重現。
    locale: 'zh-TW',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: process.env as Record<string, string>,
  },
});
