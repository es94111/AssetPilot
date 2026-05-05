# 任務清單：前端框架遷移至 Next.js + Tailwind CSS v4

**輸入**：`specs/010-frontend-nextjs-tailwind/` 設計文件  
**前置條件**：plan.md ✅、spec.md ✅、research.md ✅、data-model.md ✅、contracts/ ✅、quickstart.md ✅

**格式**：`[ID] [P?] [Story?] 說明（含檔案路徑）`  
- **[P]**：可平行執行（不同檔案，無阻塞依賴）  
- **[Story]**：所屬使用者情境（US1 / US2 / US3）

---

## Phase 1：Setup（專案初始化）

**目的**：安裝依賴、建立目錄結構、設定建置工具

- [ ] T001 在 `package.json` 新增依賴：`next ^15.3.0`、`react ^19.1.0`、`react-dom ^19.1.0`、`tailwindcss ^4.1.0`、`@tailwindcss/postcss ^4.1.0`，並執行 `npm install`
- [ ] T002 [P] 建立 Next.js 設定檔 `next.config.js`：啟用 `output: 'standalone'`（Next.js 15 起 `instrumentation.js` 為穩定 API，無需 `experimental.instrumentationHook`）、設定安全標頭（對應現有 helmet 設定：CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy）
- [ ] T003 [P] 建立 `postcss.config.js`：設定 `@tailwindcss/postcss` 插件
- [ ] T004 [P] 建立 `styles/globals.css`：加入 `@import "tailwindcss"`；加入 `@theme {}` 區塊保留現有色票（從 `style.css` 提取 CSS 自訂變數：主色、背景色、間距等）
- [ ] T005 [P] 建立目錄結構：`app/`、`app/api/`、`components/layout/`、`components/ui/`、`components/features/`、`public/`
- [ ] T006 [P] 將 `favicon.svg`、`logo.svg` 複製至 `public/` 目錄
- [ ] T007 在 `package.json` `scripts` 新增：`"dev": "next dev"`、`"build": "next build"`、`"start": "next start"`（保留原有 `"test"` 指令）

---

## Phase 2：Foundational（阻塞性基礎建設）

**目的**：所有使用者情境共用的核心基礎設施，必須在 Phase 3 前全數完成

**⚠️ 重要**：此 Phase 未完成前，任何使用者情境不得開始

- [ ] T008 建立 `lib/db.js`：封裝 sql.js 全域單例邏輯——`initDB()`（從現有 `server.js` 提取 `initDB` 函式邏輯，包含 DB 加密/解密、migrations、`saveDB()`、`saveDBSync()`）；`getDB()` 回傳 cached instance（開發模式用 `globalThis.__sqlDb`，生產模式用模組層級變數）；匯出 `{ initDB, getDB, saveDB, flushOnExit }`
- [ ] T009 建立 `lib/auth.js`：從 `server.js` 提取 JWT 相關邏輯——`signToken(userId, tokenVersion)`、`verifyToken(token)`、`getTokenFromRequest(request)`（讀取 `token` Cookie）；保留現有 `JWT_SECRET`、`JWT_EXPIRES` 環境變數名稱
- [ ] T010 建立 `instrumentation.js`：實作 `register()` 函式，僅在 `process.env.NEXT_RUNTIME === 'nodejs'` 時執行——呼叫 `initDB()`、設定 `process.once('SIGINT', flushOnExit)` 與 `process.once('SIGTERM', flushOnExit)`；同時移植 `server.js` 中的排程器初始化（`SCHEDULER_TICK_MS`、`checkAndRunSchedule`）
- [ ] T011 建立 `middleware.js`（Next.js root middleware）：攔截所有請求，對受保護路徑（`/dashboard`、`/accounts`、`/transactions`、`/categories`、`/budgets`、`/reports`、`/stocks`、`/settings`、`/admin` 及 `/api/*` 除公開端點外）驗證 JWT Cookie；公開端點：`/login`、`/privacy`、`/terms`、`/api/auth/login`、`/api/auth/register`、`/api/config`、`/api/auth/google`、`/api/auth/google/state`、`/api/auth/passkey/*`；驗證失敗 redirect 至 `/login`；同時實作 in-memory Map 速率限制（移植現有 `RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX` 邏輯）
- [ ] T012 [P] 建立 `app/layout.js`：根佈局，引入 `styles/globals.css`；包含 HTML 骨架（`<html lang="zh-TW">`）、基礎 meta 標籤、全域 font（若現有 style.css 有引入字體）
- [ ] T013 [P] 建立 `app/page.js`：根路由，SSR redirect 至 `/dashboard`（已登入）或 `/login`（未登入），依據 `lib/auth.js` 驗證 Cookie
- [ ] T014 [P] 建立 `components/layout/AppLayout.js`、`components/layout/Sidebar.js`、`components/layout/TopNav.js`：主應用佈局（側邊欄 + 頂部導覽），對應現有 `index.html` + `app.js` 的主框架結構；`Sidebar.js` 包含導覽項目：儀表板、帳戶、交易記錄、分類、預算、統計報表、股票投資、設定（Admin 帳號額外顯示管理後台）；`AppLayout.js` 組合 `Sidebar` 與 `TopNav`
- [ ] T015 [P] 建立基礎 UI 元件（對應現有 `app.js` 中反覆使用的 HTML 結構）：`components/ui/Button.js`、`components/ui/Input.js`、`components/ui/Modal.js`、`components/ui/Table.js`、`components/ui/Select.js`、`components/ui/Toast.js`、`components/ui/Badge.js`

**Checkpoint**：基礎設施就緒——API Routes 與頁面開發可開始

---

## Phase 3：使用者情境 1 — 現有功能完整保留（P1）🎯 MVP

**目標**：所有現有功能（帳戶、交易、分類、預算、報表、股票投資、資料匯出匯入、管理後台）在遷移後運作正確，URL 路徑完全一致

**獨立測試**：啟動 Next.js 開發伺服器（`npm run dev`），逐頁依 `quickstart.md` 驗收清單操作，確認資料讀寫與現有行為一致

### Phase 3a：API Routes 遷移（後端邏輯搬移）

> **注意**：以下每個 route.js 均需從 `server.js` 提取對應邏輯，呼叫 `getDB()` 取得 DB 實例，使用 Next.js `NextRequest`/`NextResponse` 取代 Express `req`/`res`。

- [ ] T016 [P] [US1] 建立身份驗證端點：`app/api/auth/login/route.js`（POST）、`app/api/auth/logout/route.js`（POST）、`app/api/auth/register/route.js`（POST）、`app/api/auth/me/route.js`（GET）——移植 `server.js` 中 `app.post('/api/auth/login',...)`、`app.post('/api/auth/logout',...)`、`app.post('/api/auth/register',...)`、`app.get('/api/auth/me',...)` 邏輯
- [ ] T017 [P] [US1] 建立 Google OAuth 端點：`app/api/auth/google/route.js`（POST）、`app/api/auth/google/state/route.js`（GET）——移植 `server.js` 中 Google SSO 相關邏輯（`googleOAuthStates` Map 移至 `lib/auth.js` 或模組層級）
- [ ] T018 [P] [US1] 建立 Passkey 端點：`app/api/auth/passkey/challenge/route.js`（GET）、`app/api/auth/passkey/login/route.js`（POST）——移植 `server.js` 中 `@passwordless-id/webauthn` 驗證邏輯
- [ ] T019 [P] [US1] 建立系統設定端點：`app/api/config/route.js`（GET）、`app/api/changelog/route.js`（GET）、`app/api/external-apis/route.js`（GET）——移植對應 `server.js` 路由
- [ ] T020 [P] [US1] 建立帳戶 CRUD 端點：`app/api/accounts/route.js`（GET/POST）、`app/api/accounts/[id]/route.js`（GET/PUT/PATCH/DELETE）、`app/api/accounts/credit-card-repayment/route.js`（POST）——移植 `server.js` 中 `app.get('/api/accounts',...)`、`app.post('/api/accounts',...)`、`app.put('/api/accounts/:id',...)` 等邏輯
- [ ] T021 [P] [US1] 建立交易記錄核心端點：`app/api/transactions/route.js`（GET/POST）、`app/api/transactions/[txId]/route.js`（GET/PUT/PATCH/DELETE）、`app/api/transactions/transfer/route.js`（POST）——移植 `server.js` 中交易相關路由及 `transferHandler` 邏輯
- [ ] T022 [P] [US1] 建立交易批量操作端點：`app/api/transactions/batch-delete/route.js`（POST）、`app/api/transactions/batch-update/route.js`（POST）——移植 `batchDeleteHandler`、`batchUpdateHandler`；注意原 regex 路由統一改為 slash-style
- [ ] T023 [P] [US1] 建立交易匯出匯入端點：`app/api/transactions/export/route.js`（GET）、`app/api/transactions/import/route.js`（POST）、`app/api/imports/progress/route.js`（GET）——移植 `importLocks`、`importProgress` Map 至模組層級或 `lib/` 模組；移植 CSV 解析邏輯
- [ ] T024 [P] [US1] 建立分類管理端點：`app/api/categories/route.js`（GET/POST）、`app/api/categories/[id]/route.js`（PUT/PATCH/DELETE）、`app/api/categories/reorder/route.js`（POST）、`app/api/categories/restore-defaults/route.js`（POST）——移植 `server.js` 分類相關路由
- [ ] T025 [P] [US1] 建立分類匯出匯入端點：`app/api/categories/export/route.js`（GET）、`app/api/categories/import/route.js`（POST）——移植 `server.js` 中分類匯入解析邏輯
- [ ] T026 [P] [US1] 建立預算端點：`app/api/budgets/route.js`（GET/POST）、`app/api/budgets/[id]/route.js`（PATCH/DELETE）——移植 `server.js` 中預算相關路由
- [ ] T027 [P] [US1] 建立定期交易端點：`app/api/recurring/route.js`（GET/POST）、`app/api/recurring/[id]/route.js`（PUT/DELETE）、`app/api/recurring/[id]/toggle/route.js`（PATCH）、`app/api/recurring/process/route.js`（POST）——移植 `server.js` 定期交易相關路由
- [ ] T028 [P] [US1] 建立儀表板與統計報表端點：`app/api/dashboard/route.js`（GET）、`app/api/reports/route.js`（GET）——移植 `server.js` 中對應路由
- [ ] T029 [P] [US1] 建立匯率端點：`app/api/exchange-rates/route.js`（GET/PUT）、`app/api/exchange-rates/[currency]/route.js`（GET）、`app/api/exchange-rates/settings/route.js`（PUT）、`app/api/exchange-rates/refresh/route.js`（POST）——移植 `server.js` 匯率路由；`lib/exchangeRateCache.js` 直接 import 沿用
- [ ] T030 [P] [US1] 建立使用者偏好端點：`app/api/users/me/route.js`（GET）、`app/api/users/me/timezone/route.js`（PATCH）、`app/api/users/settings/pinned-currencies/route.js`（GET/PUT）、`app/api/user/login-audit/route.js`（GET）、`app/api/user/data-audit/route.js`（GET）——移植對應路由
- [ ] T031 [P] [US1] 建立帳號設定端點：`app/api/account/theme/route.js`（PUT）、`app/api/account/display-name/route.js`（PUT）、`app/api/account/password/route.js`（PUT）、`app/api/account/delete/route.js`（POST）、`app/api/account/link-google/route.js`（POST）、`app/api/account/unlink-google/route.js`（POST）——移植對應路由
- [ ] T032 [P] [US1] 建立 Passkey 帳號管理端點：`app/api/account/passkey/challenge/route.js`（GET）、`app/api/account/passkey/register/route.js`（POST）、`app/api/account/passkeys/route.js`（GET）、`app/api/account/passkey/[id]/route.js`（DELETE/PUT）——移植對應路由
- [ ] T033 [P] [US1] 建立股票投資核心端點：`app/api/stocks/route.js`（GET/POST）、`app/api/stocks/[id]/route.js`（PUT/DELETE）、`app/api/stocks/quote/route.js`（GET）、`app/api/stocks/batch-price/route.js`（POST）、`app/api/stocks/batch-fetch/route.js`（POST）、`app/api/stocks/cleanup/route.js`（POST）——移植對應路由；`lib/twseFetch.js` 直接 import 沿用
- [ ] T034 [P] [US1] 建立 TWSE 外部 API 端點：`app/api/twse/stock/[symbol]/route.js`（GET）、`app/api/twse/search/route.js`（GET）——移植對應路由
- [ ] T035 [P] [US1] 建立股票交易記錄端點：`app/api/stock-transactions/route.js`（GET/POST）、`app/api/stock-transactions/[id]/route.js`（PUT/DELETE）、`app/api/stock-transactions/export/route.js`（GET）、`app/api/stock-transactions/import/route.js`（POST）、`app/api/stock-transactions/batch-delete/route.js`（POST）——移植對應路由
- [ ] T036 [P] [US1] 建立股息記錄端點：`app/api/stock-dividends/route.js`（GET/POST）、`app/api/stock-dividends/[id]/route.js`（PUT/DELETE）、`app/api/stock-dividends/sync/route.js`（POST）、`app/api/stock-dividends/export/route.js`（GET）、`app/api/stock-dividends/import/route.js`（POST）、`app/api/stock-dividends/batch-delete/route.js`（POST）——移植對應路由
- [ ] T037 [P] [US1] 建立股票定期買入、持倉損益端點：`app/api/stock-recurring/route.js`（GET/POST）、`app/api/stock-recurring/[id]/route.js`（PUT/DELETE）、`app/api/stock-recurring/[id]/toggle/route.js`（PATCH）、`app/api/stock-recurring/process/route.js`（POST）、`app/api/stock-settings/route.js`（GET/PUT）、`app/api/stock-realized-pl/route.js`（GET）、`app/api/stock-realized/route.js`（GET）——移植對應路由
- [ ] T038 [P] [US1] 建立資料庫匯出匯入端點：`app/api/database/export/route.js`（GET）、`app/api/database/import/route.js`（POST，二進位 body 用 `request.arrayBuffer()` 取代 `express.raw()`）——移植對應路由；保留現有加密/解密邏輯
- [ ] T039 [P] [US1] 建立管理後台端點（使用者管理）：`app/api/admin/users/route.js`（GET/POST）、`app/api/admin/users/[id]/route.js`（DELETE）、`app/api/admin/users/[id]/password/route.js`（PUT）——移植對應路由；管理員驗證邏輯移至 route 內部（檢查 `req.userRole === 'admin'`）
- [ ] T040 [P] [US1] 建立管理後台端點（系統設定）：`app/api/admin/system-settings/route.js`（GET/PUT）、`app/api/admin/server-time/route.js`（GET/PUT）、`app/api/admin/server-time/ntp-sync/route.js`（POST）、`app/api/admin/email-providers/route.js`（GET）、`app/api/admin/test-email/route.js`（POST）——移植對應路由
- [ ] T041 [P] [US1] 建立管理後台端點（稽核、備份）：`app/api/admin/login-audit/route.js`（GET）、`app/api/admin/login-audit/[logId]/route.js`（DELETE）、`app/api/admin/login-audit/batch-delete/route.js`（POST）、`app/api/admin/data-audit/route.js`（GET）、`app/api/admin/data-audit/export/route.js`（GET）、`app/api/admin/data-audit/purge/route.js`（POST）、`app/api/admin/data-audit/retention/route.js`（GET/PUT）、`app/api/admin/backups/route.js`（GET）、`app/api/admin/backups/[filename]/route.js`（DELETE）——移植對應路由
- [ ] T042 [P] [US1] 建立管理後台端點（報表排程、憑證、系統更新）：`app/api/admin/report-schedule/route.js`（GET/PUT）、`app/api/admin/report-schedule/run-now/route.js`（POST）、`app/api/admin/report-schedules/route.js`（GET/POST）、`app/api/admin/report-schedules/[id]/route.js`（PUT/DELETE）、`app/api/admin/report-schedules/[id]/run-now/route.js`（POST）、`app/api/admin/certs/route.js`（GET）、`app/api/admin/certs/origin/route.js`（POST/DELETE）、`app/api/admin/certs/origin/ca/route.js`（POST/DELETE）、`app/api/system/update-app/route.js`（POST）——移植對應路由

### Phase 3b：前端頁面與元件（React 重寫）

- [ ] T043 [P] [US1] 建立登入頁 `app/login/page.js`（SSG，`export const dynamic = 'force-static'`）：移植現有 `index.html` + `app.js` 中登入表單 UI——Email/密碼登入、Google SSO 按鈕、Passkey 登入按鈕；正確行為：登入成功後 redirect 至 `/dashboard`
- [ ] T044 [P] [US1] 建立隱私政策頁 `app/privacy/page.js` 與服務條款頁 `app/terms/page.js`（SSG）：移植現有 `privacy.html`、`terms.html` 的 HTML 內容至 JSX，保留所有文字與結構
- [ ] T045 [US1] 建立儀表板頁面 `app/dashboard/page.js`（SSR）與 `components/features/dashboard/` 元件群：包含總資產卡片、帳戶餘額列表、近期交易列表、收支圓餅圖——移植 `app.js` 中儀表板相關 UI 邏輯（含 Chart.js 渲染）
- [ ] T046 [US1] 建立帳戶管理頁面 `app/accounts/page.js`（SSR）與 `components/features/accounts/` 元件群：帳戶列表、新增/編輯/刪除模態框、餘額顯示——移植 `app.js` 帳戶相關 UI
- [ ] T047 [US1] 建立交易記錄頁面 `app/transactions/page.js`（SSR）與 `components/features/transactions/` 元件群：交易列表（含篩選、分頁、搜尋）、新增/編輯/刪除模態框、批量操作——移植 `app.js` 交易相關 UI
- [ ] T048 [US1] 建立分類管理頁面 `app/categories/page.js`（SSR）與 `components/features/categories/` 元件群：分類樹狀列表、排序拖曳、新增/編輯/刪除——移植 `app.js` 分類相關 UI
- [ ] T049 [US1] 建立預算管理頁面 `app/budgets/page.js`（SSR）與 `components/features/budgets/` 元件群：月/年預算列表、使用率進度條、新增/編輯——移植 `app.js` 預算相關 UI
- [ ] T050 [US1] 建立統計報表頁面 `app/reports/page.js`（SSR）與 `components/features/reports/` 元件群：月報表、年報表、圖表（Chart.js）——移植 `app.js` 報表相關 UI
- [ ] T051 [US1] 建立股票投資頁面 `app/stocks/page.js`（SSR）與 `components/features/stocks/` 元件群：持倉列表、損益計算、TWSE 即時報價、股票交易記錄、股息記錄——移植 `app.js` 股票相關 UI
- [ ] T052 [US1] 建立個人設定頁面 `app/settings/page.js`（SSR）與 `components/features/settings/` 元件群：時區設定、主題設定、顯示名稱、密碼修改、Google 連結/解除、Passkey 管理、帳號刪除——移植 `app.js` 設定相關 UI
- [ ] T053 [US1] 建立管理後台頁面 `app/admin/page.js`（SSR）與 `components/features/admin/` 元件群：使用者管理、系統設定、登入稽核、資料稽核、報表排程、備份管理、Email 設定——移植 `app.js` 管理後台相關 UI
- [ ] T054 [US1] 建立資料匯出匯入功能元件 `components/features/data-transfer/`：CSV 匯入精靈、匯出按鈕、進度顯示（輪詢 `/api/imports/progress`）、DB 備份還原——移植 `app.js` 匯入匯出相關 UI

**Checkpoint（US1 完成）**：執行 `npm run dev`，逐頁依 `quickstart.md` 驗收清單操作，所有功能與現有版本行為一致

---

## Phase 4：使用者情境 2 — 頁面載入效能提升（P2）

**目標**：SSR 頁面 LCP ≥ 遷移前 +20%；SSG 頁面 LCP ≥ 遷移前 +40%

**獨立測試**：使用 Chrome Lighthouse 對 `/login`（SSG）與 `/dashboard`（SSR）量測 LCP，與現有 `/` SPA 對比

- [ ] T055 [US2] 確認所有功能頁面明確宣告 SSR：在 `app/dashboard/page.js`、`app/accounts/page.js`、`app/transactions/page.js`、`app/categories/page.js`、`app/budgets/page.js`、`app/reports/page.js`、`app/stocks/page.js`、`app/settings/page.js`、`app/admin/page.js` 頂部加入 `export const dynamic = 'force-dynamic'`
- [ ] T056 [US2] 確認靜態頁面採用 SSG：確認 `app/login/page.js`、`app/privacy/page.js`、`app/terms/page.js` 無動態資料，移除任何非必要的 `dynamic = 'force-dynamic'` 宣告
- [ ] T057 [US2] 在各 SSR 頁面實作 Server Component 資料預取：於 `page.js` 中先呼叫 `lib/auth.js` 的 `verifyToken()`（從 Next.js `cookies()` 讀取 `token` Cookie）取得 `userId`，再以 `userId` 呼叫 `getDB()` 預取初始資料（如儀表板摘要、帳戶列表），作為 React Server Component 的 props 傳入 Client Component，減少客戶端首次資料請求的等待時間；驗證失敗時 redirect 至 `/login`
- [ ] T058 [US2] 在 `next.config.js` 設定靜態資源快取標頭：對 `/_next/static/**`、`/public/**` 設定 `Cache-Control: public, max-age=31536000, immutable`，提升重複訪問效能

**Checkpoint（US2 完成）**：Chrome Lighthouse 報告 `/login` LCP < 現有值 ×0.6；`/dashboard` LCP < 現有值 ×0.8

---

## Phase 5：使用者情境 3 — 樣式視覺一致性（P3）

**目標**：Tailwind CSS v4 工具類別完整覆蓋現有 `style.css`，UI 元素視覺與現有版本一致，無意外樣式破損

**獨立測試**：對每個頁面截圖與現有版本比對（佈局、色彩、間距、響應式斷點）

- [ ] T059 [US3] 將 `style.css` 中的全域重設（reset）與基礎排版樣式移入 `styles/globals.css`（`@layer base {}`）；確認無遺漏的全域樣式
- [ ] T060 [US3] 審查 `components/ui/` 中每個基礎元件（Button、Input、Modal、Table、Select、Toast、Badge）的 Tailwind 類別是否與現有 `style.css` 對應 CSS 視覺等價；若有缺口，在 `styles/globals.css` 補充 `@layer components {}` 自訂類別
- [ ] T061 [US3] 審查各功能元件（`components/features/`）的響應式斷點設定是否與現有 `style.css` 媒體查詢一致（`sm:`、`md:`、`lg:` 對應現有斷點值）
- [ ] T062 [US3] 確認深色模式（若現有 `style.css` 含 `prefers-color-scheme: dark` 或 `[data-theme="dark"]`）在 Tailwind v4 `dark:` 前綴下正確運作

**Checkpoint（US3 完成）**：各頁面在 Chrome DevTools 模擬不同尺寸（375px、768px、1280px）截圖，與現有版本目視比對無明顯差異

---

## Phase 6：Polish（收尾與跨功能事項）

**目的**：版本更新、文件同步、最終驗收

- [ ] T063 [P] 在 `next.config.js` 增加 `async rewrites()` 或確認不需要（所有 `/api/*` 路徑在 Next.js 中完整對應）；移除 `server.js` 的 `npm start` 指向，改為 `next start`（Standalone 模式執行 `node .next/standalone/server.js`）
- [ ] T064 [P] 執行現有測試套件 `npm test`，確認所有測試通過（`tests/lib/userTime.test.js`、`tests/migration/*.test.js`、`tests/integration/*.test.js`）；若有測試因路徑變更失敗，最小幅度修正
- [ ] T065 [P] 更新 `changelog.json`：新增本次遷移版本記錄（版本號依現有規則遞增）；更新 `SRS.md` 中的技術架構章節，反映 Next.js 取代 Express 的事實
- [ ] T066 [P] 更新 `README.md`：更新啟動指令（`npm run dev` 取代 `node server.js`）、依賴說明、部署步驟（Standalone 模式）
- [ ] T067 更新 `.dockerignore`（若需要排除 `.next/` 快取），更新 `Dockerfile`：將 `CMD ["node", "server.js"]` 改為 `CMD ["node", ".next/standalone/server.js"]`，並加入 `COPY .next/standalone ./`、`COPY .next/static ./.next/static`、`COPY public ./public` 複製步驟
- [ ] T068 依 `quickstart.md` 第 7 節驗收清單逐項確認：登入/登出、帳戶、交易、分類、預算、報表、股票、匯出匯入、管理後台全部通過

---

## 依賴關係與執行順序

### Phase 依賴

- **Phase 1（Setup）**：無依賴，立即開始
- **Phase 2（Foundational）**：依賴 Phase 1 完成；**阻塞所有後續 Phase**
- **Phase 3（US1）**：依賴 Phase 2 完成；3a（API Routes）與 3b（Pages）可平行進行，但頁面需要 API Routes 完成後才能做完整功能測試
- **Phase 4（US2）**：依賴 Phase 3 完成（需要頁面存在才能量測 LCP）
- **Phase 5（US3）**：依賴 Phase 3 完成（需要元件存在才能審查樣式）
- **Phase 6（Polish）**：依賴 Phase 3、4、5 完成

### 使用者情境依賴

- **US1（P1）**：Phase 2 完成後即可開始，無跨情境依賴
- **US2（P2）**：US1 完成後開始（頁面已存在）
- **US3（P3）**：US1 完成後開始（元件已存在），可與 US2 平行

### 情境內部執行順序

- Phase 3a（API Routes）：各端點群組互相獨立 `[P]`，可全部平行
- Phase 3b（Pages）：各頁面互相獨立 `[P]`，但建議先完成 T045（儀表板）驗證整體框架
- Phase 4、5：各任務互相獨立 `[P]`，可平行執行

---

## 平行執行範例

### Phase 3a：API Routes 可全部平行啟動

```
Agent 1: T016 身份驗證端點
Agent 2: T020 帳戶 CRUD 端點
Agent 3: T021 交易記錄核心端點
Agent 4: T024 分類管理端點
Agent 5: T026 預算端點
Agent 6: T033 股票投資核心端點
... (所有標 [P] 的任務)
```

### Phase 3b：Pages 可全部平行啟動（Foundational 完成後）

```
Agent 1: T043 登入頁
Agent 2: T045 儀表板
Agent 3: T046 帳戶管理
Agent 4: T047 交易記錄
Agent 5: T048 分類管理
... (所有標 [P] 的頁面)
```

---

## 實作策略

### MVP 優先（僅 US1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（**關鍵阻塞點**）
3. 完成 Phase 3a：API Routes 遷移（T016–T042）
4. 完成 Phase 3b：頁面與元件重寫（T043–T054）
5. **停下來驗收**：依 `quickstart.md` 逐一確認所有功能正確
6. 可於此時切換至 Next.js 版本（停用舊 `server.js`）

### 漸進交付

1. Setup + Foundational → 基礎就緒
2. Phase 3（US1）→ 完整功能對等 → **切換點**
3. Phase 4（US2）→ 效能優化
4. Phase 5（US3）→ 樣式精修
5. Phase 6（Polish）→ 文件與版本更新

---

## 備註

- `[P]` 任務 = 不同檔案，無未完成任務的依賴，可平行執行
- `[Story]` 標籤追蹤任務所屬使用者情境
- 每個 API Route 均需：1）從 `server.js` 提取對應邏輯 2）呼叫 `getDB()` 3）使用 `NextRequest`/`NextResponse` 4）保留現有錯誤格式（`{ error: '...' }`）
- 每個頁面均需：1）正確 SSR/SSG 宣告 2）引入 `components/layout/AppLayout.js` 3）功能行為與 `app.js` 一致
- 遷移完成後，`server.js`、`app.js`、`index.html`、`style.css`、`privacy.html`、`terms.html` 暫停使用但不刪除，待獨立清理 PR 處理
