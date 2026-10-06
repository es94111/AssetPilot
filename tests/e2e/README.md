# E2E / 視覺回歸 / 無障礙測試

對應 [issue #264](https://github.com/es94111/AssetPilot/issues/264)：補齊 E2E、視覺回歸與無障礙檢測的測試防護網。

## 涵蓋範圍

| 檔案 | 內容 |
| --- | --- |
| `login.test.ts` | 未登入導向 `/login`；登入頁渲染 |
| `dashboard.test.ts` | 儀表板收支總覽 |
| `transactions.test.ts` | 交易列表、新增一筆交易 |
| `budget.test.ts` | 新增預算 |
| `portfolio.test.ts` | 記一筆股票買進交易，持股總覽正確反映 |
| `reports.test.ts` | 統計報表本期合計 |
| `export.test.ts` | 交易記錄 CSV 匯出 |
| `accessibility.test.ts` | 以 [axe-core](https://github.com/dequelabs/axe-core) 掃描主要頁面（含淺色／深色主題），`critical`/`serious` 違規視為失敗 |
| `visual.test.ts` | 登入頁與儀表板 hero 區塊的截圖比對（淺色／深色主題） |

## 不依賴正式環境憑證

正式登入僅支援 Google／LINE／Passkey（密碼登入已停用，見
`app/api/auth/login/route.ts`），無法在自動化測試中以真實第三方憑證重現。
`tests/e2e/support/testUser.ts` 改為直接對 PostgreSQL 寫入測試使用者，並用
`lib/sessionHelpers.createLoginSession()` 產生合法的 `authToken` JWT，再由
Playwright 以 `context.addCookies()` 注入瀏覽器，等效於「已登入」狀態。

- 每個測試建立一個 `e2e_` 前綴、唯一亂碼 id 的全新使用者，測試之間互不影響，
  可並行執行；測試結束後自動清除該使用者的所有資料。
- 持股測試直接在 DB 建立股票代號，不呼叫 TWSE／Yahoo Finance 等外部報價 API。
- 不需要、也不會使用任何 `GOOGLE_CLIENT_SECRET`、`LINE_CHANNEL_SECRET` 等正式環境密鑰。

## 本機執行

預設連線到與 `docker-compose.yml` 相同設定的本機 PostgreSQL：

```bash
docker compose up -d postgres
npm run test:e2e              # 全部 E2E / a11y / 視覺回歸測試
npm run test:e2e:ui           # Playwright UI 模式，方便除錯
npm run test:a11y             # 只跑無障礙測試
npm run test:visual           # 只跑視覺回歸測試
```

可用環境變數覆寫（例如改連別的測試資料庫）：`DATABASE_URL`、`JWT_SECRET`、
`PORT`、`E2E_BASE_URL`。

Playwright 會自動以 `npm run build && npm start` 啟動一個本機伺服器（除非
`E2E_BASE_URL` 指向已在執行的伺服器）。改用 production build 而非
`next dev`，是因為 `next dev --webpack` 的 `/instrumentation` edge-runtime
編譯目前會因 `lib/postgresRuntime.ts` 的 `node:crypto` import 失敗（既有問題，
與本次變更無關），導致所有頁面回應 500。`next start` 會強制
`NODE_ENV=production`，使 `authToken` cookie 帶 `Secure` 旗標；但 Chromium 將
`http://localhost` 視為 potentially trustworthy origin，仍會正常設置／送出
Secure cookie，故 `context.addCookies()` 注入已登入 session 的作法不受影響。

## 視覺回歸基準圖（baseline snapshots）

截圖比對需要與執行環境（OS／字型／GPU 算繪）完全一致的基準圖，在本機或
非 CI 環境產生的 PNG 套用到 GitHub Actions ubuntu runner 幾乎必定會因 1px
級的算繪差異而失敗。`tests/e2e/visual.test.ts-snapshots/` 內的基準圖皆是
透過 `.github/workflows/e2e.yml` 的 `workflow_dispatch` →
`update-visual-snapshots` job（在與正式 CI 相同的 ubuntu runner 上）產生，
再下載 artifact 人工檢視後提交，確保與 `e2e` job 的比對環境一致。

畫面有調整、基準圖需要更新時，請由維護者重複同樣流程：

1. 到 Actions 頁面手動觸發 `.github/workflows/e2e.yml` 的
   `workflow_dispatch`（會額外執行 `update-visual-snapshots` job）。
2. 下載該次執行產生的 `visual-snapshots` artifact。
3. 人工檢視每張截圖無異狀後，覆蓋到對應的
   `tests/e2e/visual.test.ts-snapshots/` 目錄並提交。

本機也可以執行 `npm run test:e2e:update-snapshots` 更新基準圖，但產出的
檔名會帶本機平台（例如 `-darwin.png`），不會覆蓋 CI 用的 `-linux.png`
基準圖，僅適合本機除錯比對，不要提交。

## CI

`.github/workflows/e2e.yml` 會在 `push`（main/dev）與相關路徑變更的
`pull_request` 時，以獨立的 PostgreSQL service container 執行整套測試；
失敗時會上傳 Playwright HTML report 與（trace／影片等）test-results 作為
artifact 方便除錯。
