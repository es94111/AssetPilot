---

description: "前端路由與頁面（008-frontend-routing）任務清單"
---

# Tasks：前端路由與頁面（Frontend Routing & Pages）

**Input**：設計文件位於 [`specs/008-frontend-routing/`](./)
**Prerequisites**：[plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml)、[quickstart.md](./quickstart.md)

**Tests**：本專案無自動化測試框架；驗證採手動 + DevTools + axe-core，依 [quickstart.md](./quickstart.md) 劇本執行（不在 tasks 內列為獨立 test 任務，於 Polish 階段一次性跑完）。

**Organization**：依 user story 分組；US1 + US2（P1）構成 MVP；US3~US6 為增量交付。

## Format：`[ID] [P?] [Story] Description`

- **[P]**：可並行（不同檔案、無依賴）
- **[Story]**：所屬 user story（US1～US6；Setup/Foundational/Polish 無 Story 標籤）
- 描述含明確檔案路徑

## Path Conventions（沿用既有單體結構）

- **Backend**：[server.js](../../server.js)（單檔）
- **Frontend**：[app.js](../../app.js)、[index.html](../../index.html)、[style.css](../../style.css)
- **Contracts**：[openapi.yaml](../../openapi.yaml)（根目錄）+ [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml)（本功能 delta）
- **Docs**：[changelog.json](../../changelog.json)、[SRS.md](../../SRS.md)

---

## Phase 1：Setup（共用基礎）

**Purpose**：確認 baseline 環境與既有路由可運作

- [ ] T001 啟動 `npm start` 並 curl `/`、`/login`、`/dashboard`、`/privacy`、`/terms` 驗證 baseline 路由皆 200，記錄當前 [changelog.json](../../changelog.json) 版本與 [openapi.yaml](../../openapi.yaml) `info.version`，作為後續 v4.29.0 升版依據

---

## Phase 2：Foundational（阻塞所有 User Story 的前置條件）

**Purpose**：建立路由表、純函式 helper、共用 DOM/CSS 殼層、後端常數與資料表欄位；本階段不變更任何業務行為，但所有 US 皆依賴

**⚠️ CRITICAL**：本階段未完成前任何 User Story 皆不可開始

### 後端常數與 schema

- [ ] T002 [server.js](../../server.js) 於 catch-all（[server.js:10167](../../server.js#L10167)）附近新增模組級常數 `const ADMIN_ONLY_PATHS = ['/settings/admin'];`（FR-032a；單行常數，與前端 ROUTES 表 `requireAdmin: true` 條目對應）
- [ ] T003 [server.js](../../server.js) 新增模組級 helper `function normalizeRoutePath(rawPath)`，演算法：去 query/hash → 小寫 → 折疊連續斜線 → 去尾端斜線（除 `/`）；位置：與 `ADMIN_ONLY_PATHS` 共置（FR-010a 後端版）
- [ ] T004 [server.js](../../server.js) 於既有 `system_settings` 建表/migration 區段（[server.js:600](../../server.js#L600)附近）追加冪等 `ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'`（try/catch 包覆，與 007 風格一致）（FR-033、data-model §2）
- [ ] T005 [server.js](../../server.js) 新增 helper `function getRouteAuditMode()`：`SELECT route_audit_mode FROM system_settings WHERE id = 1`，回傳 `'security'` 為 fallback；位置：與 `normalizeRoutePath` 共置（FR-033）

### 前端核心資料表與純函式

- [ ] T006 [P] [app.js](../../app.js) 新增模組級常數 `const ROUTES = [...]`，含 20 條（4 公開 + 16 受保護，含 `/stocks` 與 `/stocks/portfolio` 雙別名為兩條獨立項目）並依 [data-model.md §1](./data-model.md) 完整欄位（`path`、`page`、`sub`、`isPublic`、`requireAdmin`、`staticTitle`、`icon`、`fab`、`alias`）（FR-001、FR-002、FR-015b 第 4 點）
- [ ] T007 [P] [app.js](../../app.js) 新增模組級常數 `const SIDEBAR_ICONS = { wallet, chart, ... }`：14 個 inline SVG 字典 + 1 個首字方塊 fallback；採 Lucide 字彙、`stroke="currentColor"`（FR-015b 第 1、5 點；research §8）
- [ ] T008 [app.js](../../app.js) 新增純函式 `function normalizePath(rawPath)`：小寫 + 折雙斜 + 去尾斜（除 `/`）；演算法見 [research.md §2](./research.md)（FR-010a）
- [ ] T009 [app.js](../../app.js) 新增純函式 `function parsePath(pathname)`：先 `normalizePath`，再對 `ROUTES` 線性查找精確 match；找不到回 `null`（驅動 404）（FR-005、FR-008、依賴 T006、T008）
- [ ] T010 [app.js](../../app.js) 新增純函式 `function buildPath(pageOrRoute, sub)`：以 `ROUTES` 反查 `path`；保留舊 `buildPath(page, sub)` 簽章（依賴 T006）
- [ ] T011 [app.js](../../app.js) 新增純函式 `function validateNextParam(rawNext)`：5 條規則（解碼 → `/` 開頭 → 拒 protocol-relative → pathname 命中 ROUTES → 通過則 target 為解碼後 next）；演算法見 [research.md §3](./research.md)（FR-006a；依賴 T006、T008）
- [ ] T012 [app.js](../../app.js) 新增 helper `async function apiFetch(url, options = {})`：包覆 `fetch`，偵測 401（除 `/api/auth/login` 等登入端點）→ 呼叫 `redirectToLogin('session-expired')` 並 throw（FR-007a；依賴 T013）
- [ ] T013 [app.js](../../app.js) 新增 helper `function redirectToLogin(reason)`：支援 `'session-expired' | 'unauthenticated' | 'logout'` 三模式；前兩種寫 `?next=`（單次 `encodeURIComponent`）+ Toast；`'logout'` 不寫 next 並清 localStorage（FR-006a 編碼契約、FR-007a、FR-007b；依賴 T011）
- [ ] T014 [app.js](../../app.js) 新增 IIFE module-scoped 變數 `let currentRoute = null; let progressTimer = null; let modalStack = []; let modalPreviousFocus = []; let bodyScrollY = 0;`（[data-model.md §5](./data-model.md)）
- [ ] T015 [app.js](../../app.js) 新增 helper `showRouteProgress(deferMs = 200)` / `hideRouteProgress()` / `announceRoute(pageName)`：操作 `#route-progress`（200ms 延遲門檻）與 `#sr-route-status` 之 `textContent`（FR-010d 第 2 點、FR-010e）
- [ ] T016 [app.js](../../app.js) 新增 IIFE `ModalBase` 物件骨架：暴露 `open(modalId, options)` / `close()` / `closeTopmost()` / `getStack()`；先實作骨架簽章與內部狀態，行為邏輯於 US5 補完（FR-022 共用基底前置；依賴 T014）

### 前端共用 DOM 殼層

- [ ] T017 [index.html](../../index.html) 在應用程式 root（`<body>` 內、所有 `.page` 容器之上）新增 `<div id="route-progress" class="route-progress" hidden></div>` 與 `<div id="sr-route-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`（FR-010d、FR-010e）
- [ ] T018 [index.html](../../index.html) 新增 `<div id="page-404" class="page" hidden>...</div>` 容器，含「找不到頁面」標題、訊息、「返回首頁」與「返回儀表板」按鈕（FR-008、FR-014；按鈕 onclick 留空，於 US1 T026 補綁）
- [ ] T019 [index.html](../../index.html) 將既有 `<aside id="sidebar">` 拆分為 `<div class="sidebar-top">`（logo）/ `<nav class="sidebar-mid">`（主清單）/ `<div class="sidebar-bottom">`（使用者區）三段（FR-015c；保留現有子節點，僅外層分組）
- [ ] T020 [index.html](../../index.html) 新增 `<div id="page-privacy" class="page" hidden>` 與 `<div id="page-terms" class="page" hidden>` 容器並內嵌既有 `privacy.html` / `terms.html` 主體 HTML（為 US6 T065 移除獨立 handler 鋪路；保留原檔以維持白名單向後兼容）

### 前端共用樣式

- [ ] T021 [P] [style.css](../../style.css) 新增 `.sr-only` 樣式（`position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap;`）（FR-010e）
- [ ] T022 [P] [style.css](../../style.css) 新增 `.route-progress` 與 `@keyframes route-progress-slide`：固定頂部、2px 高、`#6366f1` 主色、indeterminate 左→右循環；含 `@media (prefers-reduced-motion: reduce)` 降級為靜態淺色（FR-010d 第 2 點）
- [ ] T023 [P] [style.css](../../style.css) 新增 `body.modal-open` 規則（`position: fixed; width: 100%; overflow: hidden; overscroll-behavior: contain; touch-action: none;`）支援 iOS Safari 滾動穿透防護（FR-023a）
- [ ] T024 [P] [style.css](../../style.css) 新增 `.sidebar-top` / `.sidebar-mid` / `.sidebar-bottom` 三段式 flex column 佈局：中段 `flex: 1; overflow-y: auto; overscroll-behavior: contain`（FR-015c）

**Checkpoint**：路由表、純函式、後端常數、共用 DOM/CSS 殼層皆就緒；US 階段可開始

---

## Phase 3：User Story 1 — URL 直達／分享／書籤／重整任意頁面（Priority: P1）🎯 MVP

**Goal**：使用者輸入／書籤／分享 URL 即可直達任一頁面；F5 重整不掉頁；上一頁／下一頁完整還原；未登入訪客被導向登入頁並於登入後跳回；不存在或無權限的路徑落入 404 訊息頁

**Independent Test**：依 [quickstart.md §1](./quickstart.md) 20 條 URL 全部可直達 + 重整 + 書籤（4 公開 + 16 受保護，含 stocks 雙別名）；5 條 `?next=` 開放重定向攻擊全部攔下；瀏覽器上一頁／下一頁完整還原；不存在路徑顯示 404 訊息頁

### 路由切換核心改寫

- [ ] T025 [US1] [app.js](../../app.js) 新增 `function navigateToPath(targetPath, { pushState = true, replace = false })`：核心切換邏輯——寫入 `state.scrollY` → push/replace → 第一階段 title + `announceRoute` → `showRouteProgress` → render 殼 → 資料 fetch → in-place 填充 → `hideRouteProgress` → 第二階段 title 覆寫（依路由 fab 欄位）（FR-003、FR-010b、FR-010d；依賴 T009、T015、T016）
- [ ] T026 [US1] [app.js](../../app.js) 改寫既有 `function navigate(page, sub, pushState = true)`（[app.js:983-1005](../../app.js#L983)）為 thin wrapper：內部呼叫 `buildPath` 與 `navigateToPath`；保留簽章作為 alias，避免一次性大改影響既有頁面（漸進改寫策略；依賴 T010、T025）
- [ ] T027 [US1] [app.js](../../app.js) 改寫既有 `popstate` listener（[app.js:1065](../../app.js#L1065)附近）：新版本依 `parsePath(window.location.pathname)` 重渲染，並依 `event.state?.scrollY` 還原捲動（rAF + onDataReady 雙階段）；Modal hash 條目（`event.state?.modalLayer` 存在）short-circuit 不觸發本邏輯；正規化 `replaceState` 不引發 popstate（FR-003、FR-010c 第 5、6 點；依賴 T009、T025）
- [ ] T028 [US1] [app.js](../../app.js) 應用程式 `init()` 入口最前段加入：`history.scrollRestoration = 'manual'` → `normalizePath(location.pathname)`，若不一致 `replaceState` 改寫 → `parsePath` → 依角色與 `requireAdmin` 決定 render 殼或 404 → fetch 資料；非登入態且 `!isPublic` 時走 FR-006 流程（寫 `?next=` + 導 `/login`）（FR-005、FR-010a、FR-010c 第 1 點、FR-006、FR-014；依賴 T008、T009、T013、T025）

### URL 政策與 ?next= 流程

- [ ] T029 [US1] [app.js](../../app.js) 在登入頁 render 路徑加入 `?next=` 解析：以單次 `decodeURIComponent` 解碼 `URLSearchParams.get('next')`，丟入 `validateNextParam`；通過時登入成功後 `location.assign(target)`，未通過時 `location.assign('/dashboard')` 並透過 `apiFetch('/api/admin/data-audit-self-report', ...)` ——但本功能 **不新增端點**，open redirect 稽核改由後端 catch-all 偵測（見 T037），前端僅 fallback（FR-006、FR-006a、FR-007；依賴 T011、T012）
- [ ] T030 [US1] [app.js](../../app.js) 改寫既有 `showLoginPage`／`showPublicHome`／登入成功 callback（[app.js:462-477](../../app.js#L462)附近）：登入成功後若 URL 含合法 `?next=` MUST 跳回該 path；若已登入訪客造訪 `/login` MUST 自動 `replaceState` 至 `/dashboard`（FR-007；依賴 T011）
- [ ] T031 [US1] [app.js](../../app.js) 將 dashboard、transactions、stocks 三條最高頻 fetch 路徑（既有 `fetch('/api/...')` 呼叫）改用 `apiFetch`：對應 401 自動導向 `/login?next=<currentUrl>` + Toast「您的登入已過期，請重新登入」；其餘 fetch 點留作後續清理（FR-007a；漸進式改寫策略；依賴 T012、T013）

### 404 訊息頁

- [ ] T032 [US1] [app.js](../../app.js) 新增 `function render404()`：顯示 `#page-404`、隱藏其他 `.page`、`document.title = '找不到頁面 — 記帳網頁'`、`announceRoute('找不到頁面')`、綁定「返回首頁」與「返回儀表板」按鈕之 onclick（FR-008、FR-010b、FR-010e；依賴 T015、T018、T025）
- [ ] T033 [US1] [app.js](../../app.js) 在 `parsePath` 回 `null` 或 `requireAdmin === true` 且當前角色非 admin 時呼叫 `render404()`；URL 保留原樣不被改寫（FR-008、FR-014；依賴 T009、T032）

### document.title 兩階段與 SR live region

- [ ] T034 [US1] [app.js](../../app.js) 在 `navigateToPath` 第一階段加入 `document.title = ${route.staticTitle} — 記帳網頁`（路由切換瞬間、資料 fetch 開始前）；同時 `announceRoute(route.staticTitle)`（FR-010b 第 1、3 點、FR-010e 第 2 點；依賴 T015、T025）
- [ ] T035 [US1] [app.js](../../app.js) 既有頁面（transactions、stocks、budget 等）資料 fetch 完成 callback 內加入 `document.title` 第二階段覆寫（例：`2026-04 交易記錄 — 記帳網頁`）；MUST NOT 觸發 `announceRoute`（FR-010b 第 2、4 點；於資料就緒回呼點擴充，不另行新增函式）

### 後端 catch-all 攔截

- [ ] T036 [US1] [server.js](../../server.js) 改寫 catch-all（[server.js:10167](../../server.js#L10167)）：呼叫 `normalizeRoutePath(req.path)` → 依 `getRouteAuditMode()` 判斷是否寫稽核（`minimal` 模式跳過）；本任務先建立框架，下面三個任務各自填入偵測邏輯（FR-027、FR-006a、FR-014；依賴 T002、T003、T005）
- [ ] T037 [US1] [server.js](../../server.js) catch-all 內加入 path traversal 偵測：`req.originalUrl.includes('..')` 或 `/(%2e|%252e){2}/i.test(req.originalUrl)` → 透過既有 `writeOperationAudit({ action: 'static_path_traversal_blocked', metadata: { rawUrl, pattern: 'literal' | 'percent-encoded' | 'double-encoded' }, ... })` 寫稽核；走 catch-all `sendFile(index.html)`（HTTP 200，由前端依 FR-008 渲染 404 訊息頁；FR-027 修訂版：與 FR-008 統一前端 404 渲染策略，不再回 HTTP 404）（FR-027、FR-032；依賴 T036）
- [ ] T038 [US1] [server.js](../../server.js) catch-all 內加入 open redirect 偵測：若 `req.path === '/login'` 且 `req.query.next` 不通過後端版 `validateNextParam`（演算法與前端一致，呼叫 T003 `normalizeRoutePath` + 內建 ROUTES path 列表常數同步）→ 透過 `writeOperationAudit({ action: 'route_open_redirect_blocked', metadata: { next, reason }, ... })` 寫稽核；仍 `sendFile(index.html)`（FR-006a、FR-032；依賴 T036；後端 ROUTES path 列表與前端 T006 手動同步）

**Checkpoint**：US1 完成；應用程式可作為 SPA 運作於所有 20 條 URL（4 公開 + 16 受保護）；MVP 路由能力達成

---

## Phase 4：User Story 2 — 主應用程式導航（Priority: P1）

**Goal**：桌面側邊欄常駐、行動漢堡選單、14+1 個項目（管理員多 1）、三件式 active、圖示與文字並列、三段式佈局、admin 入口僅管理員可見、非管理員命中 admin 路徑落入 404 並寫稽核

**Independent Test**：依 [quickstart.md §2](./quickstart.md) 桌面 ≥ 1024px 側邊欄常駐、< 768px 漢堡選單、一般使用者看不到管理員面板、三件式 active 視覺、圖示+文字並列、三段式佈局、admin 路徑命中 404 + 後端 audit log 寫入 1 筆 `route_admin_path_blocked`

### 側邊欄渲染與 active 狀態

- [ ] T039 [US2] [app.js](../../app.js) 新增 `function renderSidebar(currentUser)`：依 `ROUTES`（過濾 `isPublic === false`）+ `currentUser.isAdmin`（過濾 `requireAdmin === true`）並 **依 FR-012 規定之分組順序**（儀表板 → 收支管理：交易／報表／預算／帳戶／分類／固定收支 → 股票投資：持股／交易紀錄／股利／實現損益 → API 使用 → 設定：帳號／資料匯出匯入／管理員面板）生成 `<a class="nav-item" data-path="${r.path}"><span class="nav-icon">${SIDEBAR_ICONS[r.icon] || fallbackBlock(r.staticTitle)}</span><span class="nav-label">${r.staticTitle}</span></a>`；ROUTES 表排列順序 MUST 與 FR-012 一致（C1）。**角色變更刷新（C2）**：在 `/api/auth/me` 回應到達後（含登入完成、token 刷新、權限變更）MUST 重新呼叫 `renderSidebar(currentUser)` 重渲染側邊欄，避免「管理員身分被移除但側邊欄仍顯示管理員面板」之 stale 狀態（spec Edge Cases 提到此情境；依賴 T006、T007、T019）
- [ ] T040 [US2] [app.js](../../app.js) 在 `navigateToPath` 內呼叫 `updateSidebarActive(currentPath)`：依正規化後 path 比對 `[data-path]` 並切換 `.active` class；移除舊版手動 `data-page` 對應邏輯之冗餘部分（FR-015a；依賴 T025、T039）
- [ ] T041 [US2] [app.js](../../app.js) 點擊 `.nav-item` 之 click handler：若 `data-path === currentRoute.path` 即 `e.preventDefault()` 且不 `pushState`，避免「上一頁」陷在同一頁回退（FR-009；依賴 T039、T040）

### 樣式

- [ ] T042 [US2] [style.css](../../style.css) 新增 `.nav-item` 基礎樣式 + `.nav-item.active` 三件式（左 4px `#6366f1` 直條、文字主色、背景主色 8% 透明度）+ `.nav-item:hover`（灰階 4% 背景）+ `.nav-item:focus-visible`（主色 2px 焦點環）；淺色與深色模式皆適用（FR-015a、FR-025）
- [ ] T043 [US2] [style.css](../../style.css) 新增 `.nav-icon`（20×20px、`stroke="currentColor"` 透過 inline SVG 自然繼承）+ `.nav-label` + 項目高度 40px、左右 padding 12px、圖示與文字間距 12px（FR-015b 第 2、3 點）
- [ ] T044 [US2] [style.css](../../style.css) 行動斷點（< 768px）下側邊欄 `position: fixed; transform: translateX(-100%); transition: transform 200ms;`，加上 `.sidebar-open` class 後 `translateX(0)`；遮罩層 `.sidebar-backdrop`；漢堡按鈕僅於 < 768px 顯示（FR-011、FR-015）

### 漢堡選單與遮罩

- [ ] T045 [US2] [app.js](../../app.js) 新增 `toggleSidebar(open?)` 與遮罩 click handler、ESC keydown handler；點選 `.nav-item` 後於 < 768px 自動收合（FR-015；依賴 T039）
- [ ] T046 [US2] [index.html](../../index.html) 新增 `<button id="sidebar-toggle" aria-label="開合選單">☰</button>` 於 header（既有 header 結構內），與 `<div class="sidebar-backdrop" hidden></div>`（FR-011、FR-015）

### 後端 admin-only 攔截

- [ ] T047 [US2] [server.js](../../server.js) catch-all（T036 框架內）加入 admin-only 偵測：若 `ADMIN_ONLY_PATHS.includes(normalizedPath)` 且使用者非管理員（解 `req.cookies.token` 透過既有 `verifyJwt` + 既有 `isUserAdmin`；token 缺失或解析失敗視為非管理員）→ 透過 `writeOperationAudit({ action: 'route_admin_path_blocked', metadata: { path: req.path, normalizedPath }, ... })` 寫稽核；仍 `sendFile(index.html)`（讓前端依 FR-014 渲染 404）（FR-014、FR-032、FR-032a；依賴 T002、T003、T036）

**Checkpoint**：US2 完成；P1 全部達成；MVP 可上線

---

## Phase 5：User Story 3 — 情境式 FAB（Priority: P2）

**Goal**：FAB 依當前路由情境顯示／隱藏、切換內容、z-index 低於 Modal 遮罩

**Independent Test**：依 [quickstart.md §3](./quickstart.md) 14 + 4 個頁面 FAB 對照表 100% 對齊；開啟 Modal 時 FAB 不擋遮罩

- [ ] T048 [US3] [app.js](../../app.js) 改寫既有 `function updateFabForPage(page)`（[app.js:990](../../app.js#L990)附近）為 `updateFabForRoute(route)`：依路由表 `route.fab` 欄位（`{ label, modalId } | null`）決定顯示與標籤；點擊綁定 `ModalBase.open(route.fab.modalId)`（FR-016；依賴 T006、T016、T025）
- [ ] T049 [US3] [app.js](../../app.js) 在 `navigateToPath` 內呼叫 `updateFabForRoute(currentRoute)`，取代既有以 `page` 字串判斷之邏輯（FR-016；依賴 T025、T048）
- [ ] T050 [US3] [style.css](../../style.css) 設定 FAB z-index：`.fab` z-index 低於 `.modal-backdrop`；層次 `.modal-content (1003) > .modal-backdrop (1002) > .fab (1001) > 主內容`（FR-017）

**Checkpoint**：US3 完成；FAB 在 14 + 4 頁行為對齊規格

---

## Phase 6：User Story 4 — 外觀模式跨裝置同步（Priority: P2）

**Goal**：三選一外觀模式立即套用、跨裝置同步、登入頁依 `prefers-color-scheme`、登出清理快取、三層 fallback 消除 FOUC

**Independent Test**：依 [quickstart.md §4](./quickstart.md) 設定切換立即生效；跨裝置同步 P95 ≤ 500ms；登出後 localStorage `theme_pref` 已清除；登入頁無快取殘留

- [ ] T051 [US4] [app.js](../../app.js) 新增 `function applyTheme(mode)`：`mode === 'system'` 時依 `window.matchMedia('(prefers-color-scheme: dark)')` 解析；其他直接套用 `document.documentElement.setAttribute('data-theme', resolved)`；同時 `addEventListener('change', ...)` 處理 `system` 模式下系統主題切換（FR-020、FR-021；位置：app.js 啟動最早期）
- [ ] T052 [US4] [app.js](../../app.js) 在 `init()` 最早段（fetch `/api/auth/me` 前）加入：讀 `localStorage.getItem('theme_pref')` → 若非 `['system', 'light', 'dark']` 之一 fallback 為 `'system'` → `applyTheme(...)`（FR-021a 第 2、3 點；依賴 T051）
- [ ] T053 [US4] [app.js](../../app.js) 在登入成功 callback、`/api/auth/me` 回應到達後、`PUT /api/account/theme` 成功後三處共用 `function onUserThemeReceived(serverTheme)`：若與 localStorage 不一致 → `localStorage.setItem('theme_pref', serverTheme)` + `applyTheme(serverTheme)`（FR-019、FR-021a 第 1 點；依賴 T051）
- [ ] T054 [US4] [app.js](../../app.js) `redirectToLogin('logout')`（T013 已建立）內加入 `localStorage.removeItem('theme_pref')` 與其他帳號偏好 storage 清除；同時呼叫 `applyTheme('system')` 還原至公開頁主題（FR-007b、FR-021a；依賴 T013）
- [ ] T055 [US4] [app.js](../../app.js) 在帳號設定頁主題切換 UI（既有 [app.js:18-22](../../app.js#L18) 與 `PUT /api/account/theme` 呼叫處）成功後同步呼叫 `onUserThemeReceived(newMode)`，確保 UI 立即生效（FR-018、FR-020；依賴 T053）

**Checkpoint**：US4 完成；跨裝置主題同步達成

---

## Phase 7：User Story 5 — 統一設計系統（Priority: P3）

**Goal**：12 個 Modal 共用基底元件（捲動鎖、history 整合、堆疊規則、焦點 trap、初始焦點）；金額／日期／顏色／動畫／無障礙跨頁一致

**Independent Test**：依 [quickstart.md §5](./quickstart.md) 12 個 Modal 行為一致；捲動鎖 + history + 堆疊 + 焦點 trap 全部運作；axe-core 36 畫面 WCAG AA 違規 0

### ModalBase 行為實作（補完 T016 骨架）

- [ ] T056 [US5] [app.js](../../app.js) `ModalBase.open(modalId, options)` 完整邏輯：堆疊規則檢查（非 modalConfirm 且 stack 不空 → console.warn return）→ `modalPreviousFocus.push(document.activeElement)` → `bodyScrollY = window.scrollY` + 套 `body.modal-open` + `body.style.top = -bodyScrollY + 'px'` → `replaceState({...current, modalParent: { hash, scrollY }})` → `pushState({modalLayer: id, modalStack: [...]}, '#modal-' + id)` → 顯示 Modal DOM → 焦點移至第一個可互動元素（FR-022、FR-023a、FR-024、FR-024a、FR-024b 第 1、2 點；依賴 T014、T016、T023）
- [ ] T057 [US5] [app.js](../../app.js) `ModalBase.close()` / `closeTopmost()`：呼叫 `history.back()`；popstate handler 內依 `event.state?.modalLayer` / `modalParent` 判別「下層仍開」vs「全部關閉」並執行解鎖（`body.modal-open` 移除、`window.scrollTo(0, bodyScrollY)`、`location.hash` 還原）+ 焦點還原至 `modalPreviousFocus.pop()`（FR-024 第 3、4 點、FR-024b 第 4、5 點；依賴 T056）
- [ ] T058 [US5] [app.js](../../app.js) `ModalBase` 內加入 `function trapFocus(modalEl, e)` Tab/Shift+Tab 環圈邏輯（依 [research.md §4](./research.md) 焦點 trap 實作）；於 `open` 時 `addEventListener('keydown', handleTabFn)`，`close` 時 `removeEventListener`；ESC 鍵亦於同一 handler 處理；同時 `addEventListener('hashchange', handleExternalHashChange)` 偵測 Modal 開啟期間外部觸發改變 `location.hash`（例：使用者貼上含錨點之 URL 至網址列）→ 視為「使用者主動離開 Modal」並呼叫 `ModalBase.close()` 關閉所有 Modal，不嘗試保留 Modal 狀態（FR-024 第 6 點）；hashchange listener 於 `close` 時一併移除（FR-024b 第 3 點、FR-024 第 6 點；依賴 T056）

### 12 個 Modal 接入

- [ ] T059 [US5] [app.js](../../app.js) 將 12 個 Modal 既有開啟程式碼改用 `ModalBase.open('modalTransaction', { onClose })` 風格 API；個別 Modal 之內容 DOM 與表單邏輯保留，僅 lifecycle（顯示／隱藏／焦點／捲動鎖）由 `ModalBase` 接管（FR-022；依賴 T056~T058；逐一改寫 modalTransaction、modalTransfer、modalCategory、modalAccount、modalBudget、modalRecurring、modalBatchChange、modalConfirm、modalStock、modalStockTx、modalStockDiv、modalPriceUpdate）
- [ ] T060 [US5] [app.js](../../app.js) 將所有 `if (confirm(...))` / `window.confirm(...)` 之刪除確認改為 `ModalBase.open('modalConfirm', { message, onConfirm })`；既有 `confirm()` 用法逐一替換（FR-023；依賴 T059）

### 樣式與設計系統檢核

- [ ] T061 [US5] [style.css](../../style.css) Modal 堆疊 z-index：`.modal-backdrop` 1002 / `.modal-content` 1003 / `.modal-confirm-backdrop` 1004 / `.modal-confirm-content` 1005，確保 `modalConfirm` 疊在其他 Modal 之上（FR-024a c 點）
- [ ] T062 [US5] 視覺檢核既有實作金額（`NT$ 1,234.56` 千分位 + `tabular-nums`）、日期（`YYYY-MM-DD`）、顏色（收入綠／支出紅／轉帳藍／主色 `#6366f1`）、Toast 樣式、focus-visible 焦點環；發現偏差於 [style.css](../../style.css) 修正（FR-025；依賴 [quickstart.md §5.1~5.4](./quickstart.md)）

**Checkpoint**：US5 完成；12 個 Modal 行為一致；設計系統達標

---

## Phase 8：User Story 6 — 靜態檔白名單（Priority: P3）

**Goal**：白名單擴充至 9 條合法路徑、Cache-Control 套用、移除獨立 `/privacy` 與 `/terms` handler 改由 SPA 處理、9 條黑名單路徑（含 path traversal）絕不洩漏

**Independent Test**：依 [quickstart.md §6](./quickstart.md) 9 條合法路徑回 200 + 預期內容；9 條黑名單路徑回 SPA index 或 404；含 `..` 與 `%2e%2e` 寫稽核；Cache-Control 標頭符合預期

- [ ] T063 [US6] [server.js](../../server.js) `PUBLIC_FILES` 與 `PUBLIC_FILE_MAP`（[server.js:430-444](../../server.js#L430)附近）擴充 `/changelog.json`（讀根目錄 `changelog.json`）、`/privacy.html`（讀 `privacy.html`）、`/terms.html`（讀 `terms.html`）三條目（FR-026）
- [ ] T064 [US6] [server.js](../../server.js) `app.get(PUBLIC_FILES, ...)` handler 內依檔名套用 `Cache-Control`：`/index.html` 與 `/changelog.json` → `no-cache`；`*.css` / `*.js` / `*.svg` / `*.html`（除 `index.html`）→ `public, max-age=300`（FR-028）
- [ ] T065 [US6] [server.js](../../server.js) 移除既有獨立 handler `app.get('/privacy', ...)` 與 `app.get('/terms', ...)`（[server.js:10160-10165](../../server.js#L10160)）；改由 catch-all 走 SPA index → 前端 router 渲染 `#page-privacy` / `#page-terms` 容器（FR-001、FR-003；依賴 T020）
- [ ] T066 [US6] [app.js](../../app.js) 在 `parsePath` 命中 `/privacy` / `/terms` 時 `render` 顯示 `#page-privacy` / `#page-terms` 並隱藏其他 `.page`；公開頁 sidebar 不顯示（FR-001；依賴 T020、T025）

**Checkpoint**：US6 完成；靜態檔白名單測試 SC-006 達成

---

## Phase 9：Polish & 跨切面工作

**Purpose**：API delta、契約／文件／版號同步、執行 quickstart.md 完整驗證

### API delta 與管理員 UI

- [ ] T067 [server.js](../../server.js) `GET /api/admin/system-settings`（[server.js:3821](../../server.js#L3821)附近）response 加 `routeAuditMode` 欄位（讀自 T004 新增之 column）（FR-033、契約 [§paths./api/admin/system-settings.get](./contracts/frontend-routing.openapi.yaml)；依賴 T004、T005）
- [ ] T068 [server.js](../../server.js) `PUT /api/admin/system-settings` request body 接受可選 `routeAuditMode`：值需 ∈ `{'security', 'extended', 'minimal'}`，否則 400「routeAuditMode 必須為 security、extended 或 minimal」；寫入既有 column；不新增端點（FR-033、契約 [§paths./api/admin/system-settings.put](./contracts/frontend-routing.openapi.yaml)；依賴 T067）
- [ ] T069 [app.js](../../app.js) + [index.html](../../index.html) 管理員設定頁 UI 新增「路由稽核模式」三選一單選（`security` / `extended` / `minimal`）；呼叫 `PUT /api/admin/system-settings` 提交（FR-033；依賴 T068）
- [ ] T070 [server.js](../../server.js) catch-all（T036~T038、T047）內所有 `writeOperationAudit` 呼叫以 `getRouteAuditMode()` 判別模式：`minimal` 全跳過；`extended` 額外於 401 偵測點寫 `session_expired`（前端 401 走 `/api/auth/me` 等端點；後端在 authMiddleware 401 回應路徑加寫 hook 即可，不影響業務邏輯）（FR-033；依賴 T005、T036、T037、T038、T047）

### 契約與文件同步

- [ ] T071 [P] [openapi.yaml](../../openapi.yaml) 將 `info.version` 升至 `4.29.0`；`SystemSettings` schema `properties` 加 `routeAuditMode`（enum: security/extended/minimal, default: security）並補入 `required`；`PUT /api/admin/system-settings` requestBody schema 同步加可選 `routeAuditMode`；`AuditLogActions` 列舉值擴充三條 `route_admin_path_blocked` / `route_open_redirect_blocked` / `static_path_traversal_blocked`（與 [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml) 一致）
- [ ] T072 [P] [changelog.json](../../changelog.json) 新增 v4.29.0 條目：摘要「前端路由與頁面（008）：URL-first SPA 路由、12 個 Modal 共用基底、側邊欄三段式佈局、外觀模式跨裝置同步快取、靜態檔白名單擴充、路由稽核模式」+ 對應 PR 連結 placeholder；版本日期填 2026-04-27
- [ ] T073 [P] [SRS.md](../../SRS.md) 補登：admin-only 路徑 `ADMIN_ONLY_PATHS = ['/settings/admin']` 常數宣告與手動同步要求（FR-032a）；`route_audit_mode` 欄位三模式行為矩陣（FR-033）；`data_operation_audit_log.action` 三條新增列舉值描述

### 驗證

- [ ] T074 執行 [quickstart.md §1](./quickstart.md) US1 全部驗證（**對應 SC-001 深層連結 5/5、SC-002 F5 ≥ 99%**）：20 條 URL 直達 + 重整 + 書籤（4 公開 + 16 受保護）；5 條 `?next=` 開放重定向攻擊；404 訊息頁；上一頁／下一頁；正規化；捲動還原
- [ ] T075 執行 [quickstart.md §2](./quickstart.md) US2 全部驗證（**SC-003 部分**：FAB 顯示與標籤對照於 T076 涵蓋；本任務聚焦 sidebar 行為）：14 + 1 個側邊欄項目；三件式 active；圖示+文字；三段式佈局；漢堡選單行為；admin 路徑命中 404 + audit log；**以一般使用者 cookie 對 `/api/admin/*` 任一 GET 端點驗證後端回 403**（FR-014 後端強制要求 — 確認既有 `adminMiddleware` 仍掛在所有 admin API；非依 UI 表現而異）
- [ ] T076 執行 [quickstart.md §3~6](./quickstart.md) US3~US6 全部驗證（**對應 SC-003 FAB 14 頁對齊、SC-004 主題同步 P95 ≤ 500ms、SC-006 白名單 9+9**）：FAB 對照表 14 + 4 頁；外觀模式三選一立即生效 + 跨裝置同步 P95 ≤ 500ms；12 個 Modal 行為一致；9 條合法路徑 + 9 條黑名單路徑
- [ ] T077 執行 [quickstart.md §7](./quickstart.md) 路由稽核三事件覆蓋 + 三模式（`security` / `extended` / `minimal`）切換驗證
- [ ] T078 執行 [quickstart.md §8](./quickstart.md) 性能 P95 量測（**對應 SC-008a 路由切換 ≤ 100ms、SC-008b 完整渲染 ≤ 1000ms**）：14 個受保護頁各切換 50 次，路由切換（殼可見）P95 ≤ 100ms；完整內容渲染（資料 fetch 完成）P95 ≤ 1000ms
- [ ] T079 執行 [quickstart.md §9](./quickstart.md) 跨瀏覽器 + 行動驗證：Chrome / Edge / Firefox latest 2 majors + Safari 16+ macOS / iOS + Android Chrome latest 2，US1 + US2 通過率 100%（SC-007）
- [ ] T080 執行 axe-core 掃描淺色 + 深色 × 18 個畫面 = 36 個畫面 WCAG AA 違規數應為 0（SC-005）

---

## Dependencies & Execution Order

### Phase 依賴

- **Phase 1（Setup）**：無依賴；T001 即可執行
- **Phase 2（Foundational）**：依賴 Phase 1 完成；BLOCKS Phase 3~8 全部
- **Phase 3（US1）**：依賴 Phase 2；可獨立完成 MVP（與 US2 並列 P1）
- **Phase 4（US2）**：依賴 Phase 2；與 US1 大致獨立（共用 ROUTES 表 + ModalBase 骨架；US2 不需 ModalBase 行為實作）
- **Phase 5（US3）**：依賴 Phase 2 + Phase 4（FAB 點擊觸發 Modal，需 Phase 7 完成才完整可用，但 FAB 顯示邏輯本身可獨立驗證）
- **Phase 6（US4）**：依賴 Phase 2；與 US1~US3 互相獨立
- **Phase 7（US5）**：依賴 Phase 2 + Phase 5（FAB 觸發 Modal）；ModalBase 行為實作為核心
- **Phase 8（US6）**：依賴 Phase 2；與其他 US 互相獨立
- **Phase 9（Polish）**：依賴所有 US 完成；T067~T070 依賴 Phase 2 + Phase 7（管理員 UI 需 Modal）

### User Story 內依賴

- **US1**：T025 → T026 → T027 → T028（核心切換鏈）；T029~T031 依賴 T011~T013；T032~T033 依賴 T009 + T032；T036~T038 依賴 T002~T005
- **US2**：T039 → T040 → T041（側邊欄渲染鏈）；T042~T044 並行；T045~T046 依賴 T039；T047 依賴 T002~T005、T036
- **US3**：T048 → T049（依賴 T025、T016）；T050 並行
- **US4**：T051 → T052 → T053 → T054 → T055（主題鏈，共用 `applyTheme`）
- **US5**：T056 → T057 → T058（ModalBase 行為鏈）；T059 → T060 依賴 T056~T058；T061~T062 並行
- **US6**：T063 → T064；T065 → T066（依賴 T020）
- **Polish**：T067 → T068 → T069；T070 依賴 T036~T038 + T047；T071~T073 並行；T074~T080 依賴所有實作完成

### 並行機會

- **Phase 2 內**：T002+T003+T004+T005（同 server.js 故依序）；T006+T007（不同常數，可並行；同檔故注意 merge）；T008~T016（同 app.js 函式區段，建議依序）；T017~T020（同 index.html 不同位置）；T021~T024（同 style.css 不同 selector，可並行 `[P]`）
- **跨 US**：US1 + US4 + US6 高度獨立，可並行（若多開發者）
- **Polish T071~T073**：同 PR 內三個獨立檔案，可並行 `[P]`

---

## Parallel Example：US1 起步

```bash
# Phase 2 完成後，US1 並行起步：
Task: "T029 [app.js] 登入頁 ?next= 解析 + validateNextParam 落地"
Task: "T036 [server.js] catch-all 改寫加 normalizeRoutePath + getRouteAuditMode 框架"
Task: "T032 [app.js] render404 + 按鈕綁定"

# 上述完成後：
Task: "T037 [server.js] catch-all path traversal 偵測"
Task: "T038 [server.js] catch-all open redirect 偵測"
Task: "T033 [app.js] parsePath null / requireAdmin 落入 404"
```

---

## Implementation Strategy

### MVP 優先（US1 + US2 = P1 雙條）

1. Phase 1 Setup（T001）
2. Phase 2 Foundational（T002~T024，**CRITICAL**）
3. Phase 3 US1（T025~T038）
4. Phase 4 US2（T039~T047）
5. **STOP and VALIDATE**：執行 quickstart.md §1 + §2，確認 P1 全部達成
6. 部署或 Demo MVP

### 增量交付

1. MVP 上線後加入 US3（T048~T050）→ Demo
2. 加入 US4（T051~T055）→ Demo
3. 加入 US5（T056~T062，含 ModalBase 完整行為）→ Demo
4. 加入 US6（T063~T066）→ Demo
5. Polish（T067~T080）→ Ship v4.29.0

### 並行團隊（多開發者）

Phase 2 完成後可平行：
- 開發者 A：US1（T025~T038）
- 開發者 B：US2（T039~T047）
- 開發者 C：US4（T051~T055）
- 開發者 D：US6（T063~T066）

US3（依賴 US2 渲染框架）+ US5（ModalBase 行為實作）建議於 US2 + US4 完成後並行。

---

## Notes

- `[P]` 任務 = 不同檔案、無依賴；同檔案多任務即使邏輯獨立亦不標 `[P]`，避免 merge 衝突
- `[Story]` 標籤對應 spec 6 條 user story 之優先序（US1/US2 = P1、US3/US4 = P2、US5/US6 = P3）
- 每完成一個 Story 階段建議 commit 並執行對應 quickstart 區段
- 「不引入新依賴」原則：所有任務 MUST 嚴守，發現需新 npm 套件／CDN 即停下與 user 確認
- 漸進式 `apiFetch` 改寫策略（T031）：US1 僅替換高頻路徑；其餘 fetch 留作後續 PR 清理（不影響功能、僅體驗稍差）
- 後端 ROUTES path 列表（T038 內隱含）需與前端 T006 手動同步；於 T071 openapi.yaml 同步檢查時雙方對齊
- T020 + T065 + T066 為「移除獨立 `/privacy` `/terms` handler 改由 SPA 處理」之三步動作，需於同一 PR 內完成避免 broken state
- ModalBase 改寫（T056~T060）為 12 個 Modal 一次性 lifecycle 接管，建議於同一 PR 完成並逐一回歸；若風險過高可拆分為「先實作 ModalBase + 接 5 個高頻 Modal」與「補完剩餘 7 個 Modal」兩 PR
