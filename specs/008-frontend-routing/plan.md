# 實作計畫：前端路由與頁面（Frontend Routing & Pages）

**Branch**: `008-frontend-routing` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/008-frontend-routing/spec.md`

## Summary

本計畫將 008 規格（**6 個 user story（P1×2 + P2×2 + P3×2）／33 base FR + 13 sub-FR（`a`~`e` 後綴）= 46 FR／23 條 Clarification／8 SC**）落地至既有單體應用。**完全不引入任何新技術規格**（使用者明確要求：「使用目前專案現有的技術規格，不要新增任何技術規格」）：沿用 001~007 已建立的 Node.js 24+、Express 5、單一 `server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`、純 vanilla JS IIFE、無框架、無 router 套件、無打包工具）、sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI 3.2.0 契約、既有 `data_operation_audit_log` 表（007 既建）、既有 `system_settings` 表、既有 `users.theme_mode` 欄位、既有 `PUBLIC_FILES` 靜態檔白名單、既有 catch-all、既有 Modal 容器（`index.html` 已含 12 個 Modal 結構）；**不引入任何新 npm 套件、不引入新前端 CDN、不引入 router 函式庫（如 page.js / Navigo / vue-router）、不引入 Modal 函式庫、不新增獨立服務或 worker**。

既有實作（baseline）已涵蓋本功能約 **45% 表面**：
- **Baseline 已實作**：
  - **catch-all**（[server.js:10167](../../server.js#L10167)）— `app.get('{*path}', ...)` 已將所有非 API、非靜態檔案請求回傳 `index.html`，FR-004 已達成。
  - **靜態檔白名單**（[server.js:430-444](../../server.js#L430)）— `PUBLIC_FILES` 已限定 6 個檔案（`/app.js`、`/style.css`、`/logo.svg`、`/favicon.svg`、`/vendor/webauthn.min.js`、`/lib/moneyDecimal.js`）；`/privacy` 與 `/terms` 走獨立 handler（[server.js:10160-10165](../../server.js#L10160)）；FR-026 已大致達成（缺：白名單需擴充 `/changelog.json`、`/privacy.html`、`/terms.html` 並補 Cache-Control 標頭）。
  - **History API 路由雛型**（[app.js:983-1005](../../app.js#L983)、[app.js:1065](../../app.js#L1065)）— `navigate(page, sub, pushState)` 已用 `history.pushState` 切換頁面、`popstate` 監聽器已存在；FR-003 雛型已成型，但採「`page + sub` 兩階模型」而非 spec 要求的「URL pathname 直接對應頁面」。
  - **公開頁切換**（[app.js:462-477](../../app.js#L462)）— `showLoginPage` / `showPublicHome` 已支援 pushState；未登入時導向 `/login` 已成立。
  - **主題支援**（[app.js:18-22](../../app.js#L18)、[server.js:5502](../../server.js#L5502)、[server.js:799](../../server.js#L799)）— `users.theme_mode` 欄位已存在；`PUT /api/account/theme` 端點已實作；`/api/auth/login`、`/api/auth/me` 回應已含 `themeMode` 欄位（[server.js:2952](../../server.js#L2952)、[server.js:3559](../../server.js#L3559)）；前端啟動時讀 `prefers-color-scheme`；FR-018~021 後端面已達成，FR-021a localStorage 快取層尚缺。
  - **API 401 → 登入**（既有 `authMiddleware`）— 後端已對未登入請求回 401；前端 fetch 失敗目前未統一導向 `/login`。
  - **稽核日誌表**（[server.js:570-584](../../server.js#L570)）— `data_operation_audit_log` 表與 3 個 index 已由 007 建立；`writeOperationAudit()` helper 已有；本功能 FR-032 直接擴充其 `action` 列舉值（不新增欄位）。
  - **Admin middleware**（[server.js:2763](../../server.js#L2763)）— `adminMiddleware` 已存在，後端管理員 API 之 RBAC 已生效；FR-014 後端 403 行為直接沿用。
  - **Modal 結構雛型**（`index.html` 內共 124 處 modal class 引用）— 12 種 Modal 之 DOM 容器已存在，但**沒有共用基底元件**：每個 Modal 各自綁定開關、無統一 history 整合、無焦點 trap、無捲動鎖、無堆疊規則。

- **Baseline 未實作（本計畫補強）**：
  1. **URL-first 路由模型**（FR-001~005、FR-009~010）：將既有 `navigate(page, sub)` 改寫為「先解析 `window.location.pathname` → `{page, sub}`，再呼叫 render」之單向資料流；新增 `parsePath(pathname) → { page, sub, isPublic, requireAdmin }` 與 `buildPath({page, sub})` 兩個對偶函式，作為前後端共用的路由表單一資料來源（純 JS object 常數，於 `app.js` 內聲明，無新檔案）。
  2. **路徑正規化**（FR-010a）：啟動與每次 popstate 時對 `pathname` 執行小寫化、折疊連續斜線、去尾端斜線；不一致時 `replaceState` 改寫；超過正規化能力（含 `%2F`、`..` 編碼）走 FR-027 攔截。
  3. **`?next=` 嚴格白名單**（FR-006、FR-006a、FR-007、FR-007a、FR-007b）：純前端 helper `validateNextParam(next)` 依 5 條規則檢查；不通過 fallback 至 `/dashboard` + 寫稽核（透過既有 `/api/admin/data-audit` 入口由後端在 catch-all 偵測，前端不直接寫 audit）。
  4. **401 自動導向**（FR-007a）：以單一 `apiFetch()` wrapper 包覆所有 `fetch('/api/...')` 呼叫；偵測 401 → 立刻 `redirectToLoginWithNext(currentUrl)` + Toast；既有散落的 `fetch` 集中替換。
  5. **404 訊息頁**（FR-008、FR-014）：純前端訊息頁（`#page-404` 容器加入 `index.html`），含「返回首頁／儀表板」按鈕；管理員專屬路徑（FR-014）由前端比對路由表 `requireAdmin: true` + 當前角色決定是否落入 404；後端 catch-all 維持 200 + SPA index 不變。
  6. **document.title 兩階段更新**（FR-010b）：路由切換瞬間以路由表中的 `staticTitle` 套用第一階段；資料就緒後各頁可選擇覆寫第二階段（既有頁面實作層面追加）。
  7. **SR live region**（FR-010e）：於 `index.html` 應用程式 root 加入唯一一個 `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">`；router 於第一階段 title 更新時同步寫入 textContent。
  8. **手動捲動還原**（FR-010c）：應用程式啟動 `history.scrollRestoration = 'manual'`；`pushState` 前以 `replaceState` 寫入 `state.scrollY`；popstate 時依 `event.state.scrollY` 還原。
  9. **頁面殼 + 進度條**（FR-010d）：路由 root 唯一一條 2px indeterminate 進度條（200ms 延遲門檻、CSS 動畫）；殼層由各頁靜態 DOM 模板提供（既有 `index.html` 內 `.page` 容器已具部分殼結構）。
  10. **側邊欄三件式 active**（FR-015a）：純 CSS 改寫；前端 router 依正規化 pathname 自動套用 `.active` class，刪除既有手動 `data-page` 對應邏輯內冗餘部分。
  11. **側邊欄圖示**（FR-015b）：路由表加入 `icon: 'wallet'` 等欄位；側邊欄渲染時插入 inline SVG（採 Lucide 字彙；SVG 直接內聯於 `app.js` 字典常數，**不引入 SVG 字型檔、不引入 CDN**）。
  12. **側邊欄三段式佈局**（FR-015c）：純 CSS（grid 或 flex column）；既有 `#sidebar` DOM 拆為 `.sidebar-top` / `.sidebar-mid` / `.sidebar-bottom` 三層。
  13. **FAB 情境化**（FR-016、FR-017）：既有 `updateFabForPage(page)`（[app.js:990](../../app.js#L990)）擴充以路由表 `fab` 欄位驅動；z-index 規則於 `style.css` 補正。
  14. **Modal 共用基底元件**（FR-022~024b）：純 JS class `ModalBase` + 純 CSS；同檔（`app.js`）定義一個統一的 open / close 機制，封裝 history 整合（pushState 前 `replaceState({modalParent})` + pushState `#modal-<id>` 條目 + popstate 判別）、捲動鎖（`<body>` 套用 `.modal-open`、儲存當前 `scrollY`、Modal 關閉後還原）、堆疊規則（僅 `modalConfirm` 可疊在其他 Modal 上；其他組合 console.warn 拒絕）、焦點 trap（記憶 `activeElement`、Tab/Shift+Tab 環圈、ESC 關閉、關閉後還原焦點）、初始焦點。既有 12 個 Modal 改為呼叫 `ModalBase.open('modalTransaction')` 風格 API；個別 Modal 不再各自綁 `display: block`。
  15. **theme localStorage 樂觀渲染**（FR-021a）：前端啟動時讀 `localStorage.theme_pref` → 套用 `<html data-theme>`；`/api/auth/me` 回應到達後若不一致則覆寫；登出時 `localStorage.removeItem('theme_pref')`。
  16. **後端 admin-only 路徑常數**（FR-032a）：於 `server.js` 加入 `const ADMIN_ONLY_PATHS = ['/settings/admin']`（單行常數宣告）；catch-all 在送出 `index.html` 前先做正規化比對 + 角色檢查 + 呼叫既有 `writeOperationAudit({ action: 'route_admin_path_blocked', ... })`；不需新表、不需新 helper。
  17. **後端路由稽核模式設定**（FR-033）：`system_settings` 加 1 個欄位 `route_audit_mode TEXT DEFAULT 'security'`（值：`security`／`extended`／`minimal`）；既有 `GET /api/admin/system-settings` 與 `PUT /api/admin/system-settings`（[server.js:3821-3826](../../server.js#L3821)）回傳／接受多 1 個欄位；不新增端點。
  18. **後端開放重定向稽核**（FR-006a）：catch-all 偵測 `/login?next=...` 時若 `next` 非合法內部路徑（同前端正規化白名單演算法）寫入 `route_open_redirect_blocked` 稽核；前端純 fallback 至 `/dashboard`，不直接呼叫稽核 API（避免引入新端點）。
  19. **後端 path traversal 稽核**（FR-027）：catch-all 偵測請求 raw URL 含 `..` 或 `%2e%2e` / `%252e%252e` 時寫入 `static_path_traversal_blocked` 稽核；既有 PUBLIC_FILES 仍按白名單運作（含 `..` 之請求自然走 catch-all 攔截，現只是補稽核）；不變更 PUBLIC_FILES 處理邏輯。
  20. **靜態檔白名單擴充與 Cache-Control**（FR-026、FR-028）：`PUBLIC_FILE_MAP` 加入 `/changelog.json`（讀根目錄檔案）、`/privacy.html`、`/terms.html` 三條目；於 `app.get(PUBLIC_FILES, ...)` 統一加 `Cache-Control: no-cache`（`index.html`、`changelog.json`）／`Cache-Control: public, max-age=300`（`*.css`／`*.js`／SVG，未來檔名指紋化前先採短 max-age）；不引入 hash bundling 工具。
  21. **登出清理**（FR-007b）：既有登出處理擴充三條清理：`?next=` 移除、`localStorage.theme_pref` 移除、其他帳號偏好 storage 清除；後端 `/api/auth/logout` 行為不變。

本計畫的工作可拆為 **6 大塊**（每一塊對應規格的若干 FR；落地細節見 [research.md](./research.md)）：

1. **路由表與正規化核心**（FR-001 ~ FR-010c、FR-014、FR-015a／FR-015b 路由表共置）：
   - 於 `app.js` 內定義 `const ROUTES = [{ path, page, sub, isPublic, requireAdmin, staticTitle, icon, fab }, ...]`（共 18 條：4 公開 + 14 受保護）。
   - 純函式 `parsePath(pathname): RouteRecord | null` / `buildPath(routeRecord): string` / `normalizePath(pathname): string` / `validateNextParam(rawNext): string`。
   - 改寫 `navigate()` 為 thin wrapper，內部呼叫 `parsePath(window.location.pathname)`；對外 API 變為 `navigateTo(path, options)` 但保留既有 `navigate(page, sub)` 簽章作 alias 以利漸進改寫。
   - 啟動順序：`init()` 中先 `normalizePath()` + `replaceState`，再 `parsePath`，再 `renderPage`；`popstate` 同樣走此順序。

2. **頁面殼 + 進度條 + SR live region**（FR-010d、FR-010e、FR-010b 第 4 點）：
   - 於 `index.html` 應用程式 root 加入 `<div id="route-progress" class="route-progress" hidden></div>` + `<div id="sr-route-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`。
   - `style.css` 新增 `.route-progress` 動畫、`.sr-only` 樣式、`prefers-reduced-motion` 降級。
   - router 內 `showRouteProgress(deferMs=200)` / `hideRouteProgress()` / `announceRoute(name)` helper。

3. **Modal 共用基底元件**（FR-022 ~ FR-024b）：
   - `app.js` 內新增 `ModalBase` 物件（IIFE 模組，非 class，與既有風格一致）：`open(modalId, options)` / `close()` / `closeTopmost()` / `getStack(): string[]`。
   - 內部維護 `modalStack: string[]`（最多 2 層；違規 console.warn）+ `previousFocus: WeakRef<Element>` 陣列 + `bodyScrollY: number`。
   - 整合 history.state：開啟前 `replaceState({...current, modalParent: { hash, scrollY }})`；接著 `pushState({modalLayer: id, modalStack: [...]}, '', `#modal-${id}`)`。
   - 整合 popstate：依 `event.state?.modalLayer` / `event.state?.modalParent` 判別事件類型（FR-024 第 3 點演算法）。
   - 焦點 trap：`document.addEventListener('keydown', handleTab)` 於開啟期間註冊；關閉解除。
   - 既有 12 個 Modal 之開啟 trigger 改為呼叫 `ModalBase.open('modalTransaction', { onClose: ... })`。

4. **側邊欄三段式佈局 + 圖示**（FR-011 ~ FR-013、FR-015、FR-015a/b/c）：
   - `index.html` 內 `#sidebar` 拆為 `<div class="sidebar-top">` / `<nav class="sidebar-mid">` / `<div class="sidebar-bottom">`。
   - `style.css` 採 `display: flex; flex-direction: column;` + 中段 `flex: 1; overflow-y: auto; overscroll-behavior: contain;`。
   - 圖示：`app.js` 內 `const SIDEBAR_ICONS = { wallet: '<svg ...>...</svg>', chart: '<svg ...>...</svg>', ... }`（純字串字典，~14 個圖示，每個 ~200~400 bytes inline SVG，總計約 4 KB；不引入字型檔、不引入 CDN）。
   - 側邊欄渲染時依路由表生成 `<a class="nav-item"><span class="nav-icon">${SIDEBAR_ICONS[icon]}</span><span class="nav-label">${label}</span></a>`。
   - active 三件式（FR-015a）：純 CSS（`.nav-item.active`：左 4px border、`color: #6366f1`、`background: rgba(99, 102, 241, 0.08)`）。
   - 行動斷點（< 768px）：既有漢堡邏輯保留；側邊欄展開時三段式佈局共用同一規則，外層改為 `position: fixed` 滑入。

5. **FAB 情境化 + 公開頁／404／登入跳轉**（FR-016、FR-017、FR-008、FR-014、FR-006、FR-007、FR-007a/b、FR-021a）：
   - `updateFabForPage(page)` 改寫為依路由表 `fab` 欄位查詢（`{ label, modalId } | null`）。
   - 404 頁面：`index.html` 加 `<div id="page-404" class="page">…</div>`；`renderPage('404')` 顯示。
   - 登入跳轉：新增 helper `redirectToLogin(reason: 'unauthenticated' | 'session-expired' | 'logout')`：寫 `?next=`（前兩種）／不寫（後者）+ Toast 對應訊息。
   - `apiFetch(url, options)`：包覆 `fetch`；偵測 401 → 呼叫 `redirectToLogin('session-expired')`；偵測網路錯誤 → 透過 Toast 通知；其他狀態原樣回傳。**所有現有 fetch('/api/…') 呼叫改用 apiFetch**（漸進式改寫；既有 `fetch` 仍可運作但不享有 401 自動導向，留作後續清理）。
   - localStorage `theme_pref`：登入成功後寫入；登出時刪除；啟動時讀並樂觀渲染。

6. **後端強化（admin-only 路徑稽核 + 路徑遊走稽核 + 稽核模式設定 + 靜態白名單擴充 + Cache-Control）**（FR-026 ~ FR-028、FR-032 ~ FR-033）：
   - `server.js` 新增模組級常數 `const ADMIN_ONLY_PATHS = ['/settings/admin'];`（位置：catch-all 附近，可讀性優先）。
   - 新增模組級 helper `normalizeRoutePath(rawPath): string`（與前端 `normalizePath` 演算法一致：小寫、折疊雙斜、去尾端斜線）。
   - catch-all（[server.js:10168](../../server.js#L10168)）內新增前置檢查：
     - 若路徑含 `..` 或 `%2e%2e`／`%252e%252e` → 寫稽核 `static_path_traversal_blocked` → 仍走 SPA（FR-027 spec 要求 404 但 SPA index 已涵蓋；前端會落入 404 頁），維持與 spec 兼容。
     - 若 `/login` 且 `?next=...` 非合法 → 寫稽核 `route_open_redirect_blocked`。
     - 若正規化後 path 命中 `ADMIN_ONLY_PATHS` 且非管理員（檢查 cookie 解 JWT；無 cookie 視為非管理員）→ 寫稽核 `route_admin_path_blocked`。
   - 稽核寫入透過既有 `writeOperationAudit({ ... })`（007 既有）；稽核模式為 `minimal` 時跳過寫入；為 `extended` 時加寫 401（待 401 偵測點補實作）。
   - `system_settings` 表加欄位 `ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'`（try/catch 冪等；與既有 007 風格一致）。
   - `GET /api/admin/system-settings` / `PUT /api/admin/system-settings` 回傳／接受 `routeAuditMode` 欄位（既有 endpoint 擴欄，不新增端點）。
   - `PUBLIC_FILE_MAP` 擴充 `/changelog.json`、`/privacy.html`、`/terms.html` 三條；既有 `/privacy` 與 `/terms` handler（[server.js:10160-10165](../../server.js#L10160)）保留（網址列為 `/privacy` 而非 `/privacy.html`，仍由前端 SPA catch-all 接 + 前端 router 渲染 → 該 handler 將與 SPA catch-all 重複，本計畫**移除這兩個獨立 handler** 改由前端 SPA 處理 `/privacy`、`/terms` 路由與內容（`index.html` 內 `<div id="page-privacy">` + `<div id="page-terms">`）；`/privacy.html`、`/terms.html` 仍存在於白名單以利舊書籤直接下載 raw HTML）。
   - `app.get(PUBLIC_FILES, (req, res) => {...})` handler 內套用 Cache-Control（`changelog.json` → `no-cache`；`*.svg`／`*.css`／`*.js` → `public, max-age=300`）。
   - `app.use(express.static(...))` 既有未使用；不新增。
   - 不引入 helmet 新規則（既有 `helmet()` 設定保留）。

不引入新依賴的關鍵驗證：
- 路由解析（`parsePath` / `buildPath` / `normalizePath`）皆為純 JS 字串操作（`String.prototype.split` / `slice` / `toLowerCase` / `replace`）；不引入 path-to-regexp、page.js、Navigo、history（npm）等。
- Modal 基底（焦點 trap、history 整合、捲動鎖）皆為純 DOM API + JS class／物件；不引入 focus-trap、micromodal、a11y-dialog 等。
- 圖示為 inline SVG 字串字典；不引入 Lucide／Heroicons npm 套件、不引入字型檔、不引入 CDN。
- SR live region 為純 DOM；不引入 ally.js、aria-live 套件。
- 進度條為純 CSS keyframe 動畫；不引入 NProgress、topbar.js。
- 後端稽核寫入沿用既有 007 `writeOperationAudit()`；不新增表、不新增 cron。
- 後端 admin-only 比對採 `Array.includes()` + 既有 `isUserAdmin(userId)`；不引入 RBAC 套件。
- 後端 catch-all 偵測 `..` / `%2e%2e` 採 `String.prototype.includes` + 預編譯 regex；不引入 path-traversal 套件。

## Technical Context

**Language/Version**: Node.js 24.x（既有 `package.json` `engines.node: ">=24.0.0"`，不變）；前端純 vanilla JS（IIFE，無 build step）。

**Primary Dependencies**：
- Backend：Express 5.2.1、sql.js 1.14.1、jsonwebtoken 9.0.2、bcryptjs 3.0.3、helmet 8.1.0、express-rate-limit 8.4.0、cookie-parser 1.4.7、cors 2.8.5。**全部既有，本功能不變更 `package.json`**。
- Frontend：純 vanilla JS、既有 CDN 條目（Chart.js、decimal.js）；本功能**不新增任何 CDN、不引入 router／Modal／focus-trap／圖示套件**。

**Storage**：sql.js + `database.db`（既有）。本功能：
- 不新增任何資料表。
- `system_settings` 表新增 1 欄 `route_audit_mode`（冪等 `ALTER TABLE` 並 try/catch 包覆，與 007 風格一致）。
- `data_operation_audit_log` 表（007 既建）擴充 `action` 列舉值（新增 `route_admin_path_blocked`／`route_open_redirect_blocked`／`static_path_traversal_blocked`）；不變更欄位定義。
- 前端瀏覽器 localStorage 新增 1 個 key `theme_pref`（值 `system`／`light`／`dark`）；不引入 IndexedDB／SessionStorage 額外結構。

**Testing**：手動驗證 + DevTools Network 面板 + axe-core 無障礙掃描（與 001~007 一致；無自動化測試框架）；以 [quickstart.md](./quickstart.md) 為驗證劇本。

**Target Platform**：自架 Linux 伺服器（Docker）+ Cloudflare 反向代理；瀏覽器端為 Chrome／Edge／Firefox 桌面 latest 2 majors、Safari 16+（含 macOS／iOS）、Android Chrome latest 2（與 SC-007 對齊）。

**Project Type**：單體 web service（單一 `server.js` + 根目錄 SPA：`index.html` + `app.js` + `style.css`）。

**Performance Goals**：
- SC-008a：客戶端路由切換（URL 更新 + 主內容區換頁框架可見）P95 ≤ 100ms。
- SC-008b：完整內容渲染（含資料 fetch 完成）P95 ≤ 1000ms。
- SC-004：跨裝置主題偏好同步 P95 ≤ 500ms（讀取 `/api/auth/me` 之 themeMode 欄位）。
- SC-005：14 個受保護頁 + 4 個公開頁 × 淺／深 = 36 個畫面 axe-core WCAG AA 違規數 0。

**Constraints**：
- 不新增 npm 依賴（使用者明確要求）。
- 不新增前端 CDN 資源（使用者明確要求）。
- 不引入 router 函式庫（page.js／Navigo／vue-router／react-router 等）。
- 不引入 Modal／焦點 trap／icon／progress bar 等任何 UI 函式庫。
- 不新增獨立服務或 worker。
- 不刪除任何既有表 / 欄位（嚴守憲章 backward compatibility）。
- 路由整合採漸進式改寫：既有 `navigate(page, sub)` 簽章保留作 alias，避免一次性大改影響既有頁面。
- Modal 共用基底元件改寫採「機制集中、行為一致」策略：12 個 Modal 之內容 DOM 不變，僅其開／關／焦點／捲動鎖之邏輯由共用基底接管（既有各 Modal 之表單提交、驗證等業務邏輯保留）。

**Scale/Scope**：個人記帳工具，預期使用者數 < 1000；同時上線使用者 < 50；單頁元件複雜度由既有實作決定（本功能不擴增資料規模）；side effect 範圍：`server.js` ~50 行（catch-all 附近 + PUBLIC_FILES + system-settings extension）+ `app.js` ~600 行（routes 表 + ModalBase + apiFetch + 路徑正規化／?next= helper + SR live region helper）+ `index.html` 約 +50 行（404 page、SR live region、route progress、sidebar 三段式 markup）+ `style.css` 約 +200 行（route progress 動畫、sr-only、Modal stack z-index、sidebar 三段式、active 三件式）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.2.0：

- **[I] 繁體中文文件規範 Gate**：本計畫及其衍生產出（`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**`、未來的 `tasks.md`）皆以繁體中文（zh-TW）撰寫；原始碼識別字（`parsePath`、`ModalBase`、`ROUTES`、`SIDEBAR_ICONS`）、外部 API／函式庫名稱（Express、sql.js、Lucide／Heroicons SVG 字彙來源）、瀏覽器 API 名稱（`history.pushState`、`prefers-color-scheme`）、環境變數鍵、commit message 前綴（`feat:` / `fix:` / `docs:`）不在此限。
  - **檢核結果**：✅ 通過。本檔案、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md) 主體皆為繁體中文。

- **[II] OpenAPI 3.2.0 契約 Gate**：
  - 本計畫**新增 0 個對外 HTTP 端點**（路由相關行為皆為前端 SPA 邏輯）。
  - 本計畫**修改既有端點**（補欄位 `routeAuditMode`）：
    - `GET /api/admin/system-settings`：response 加 `routeAuditMode` 欄位（值 `security`／`extended`／`minimal`）。
    - `PUT /api/admin/system-settings`：request body 接受可選 `routeAuditMode` 欄位。
    - `POST /api/auth/login`：response `user` 物件已含 `themeMode`（既有，不變更）。
    - `GET /api/auth/me`：response `user` 物件已含 `themeMode`（既有，不變更）。
  - 已於 [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml) 宣告 `openapi: 3.2.0` 並描述上述兩個 PATCH 與既有兩個端點之回應欄位 delta。
  - 根目錄 `openapi.yaml`（v4.28.0）將於同 PR 同步更新（新版本 `4.29.0`，MINOR 非破壞性 — 僅補欄位）。
  - 共用 schema：`SystemSettings` schema 既有，本計畫 `properties` 加 `routeAuditMode`；`AuditLogActions` 列舉值擴充三條。
  - 認證：`/api/admin/system-settings` 既有 `security: [cookieAuth: []]` + admin role 不變；不新增公開端點。
  - **檢核結果**：✅ 通過。

- **[III] Slash-Style HTTP Path Gate**：
  - 本計畫**不新增任何 HTTP 路徑**；既有 `/api/admin/system-settings`、`/api/auth/login`、`/api/auth/me` 全部斜線。
  - 本計畫之**前端路由表**（FR-001 + FR-002，共 18 條 path）皆為斜線形式（`/dashboard`、`/finance/transactions`、`/stocks/portfolio`、`/settings/admin` 等）；**無**冒號自訂方法。
  - **檢核結果**：✅ 通過。

- **Development Workflow Gate**：
  - 已建立功能分支 `008-frontend-routing`（透過 `speckit.git.feature` hook）。
  - 預計同步更新 `changelog.json`（新增 4.29.0 條目）與 `SRS.md`（補登 routeAuditMode 設定 + admin-only 路徑稽核行為）。
  - 無破壞性變更：所有變動皆為新增（前端路由整合、Modal 基底元件）或行為強化（catch-all 加稽核、靜態白名單擴充）；既有 `navigate(page, sub)` API 保留作 alias。
  - API 變更於同一 PR 更新契約：`openapi.yaml` 與 [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml) 同步維護。
  - **檢核結果**：✅ 通過。

無 Constitution 違反項目；**Complexity Tracking 表格留空**。

### Post-Design 重新檢核（Phase 1 完成後）

- [I]：✅ 所有 Phase 1 衍生文件以繁體中文撰寫；OpenAPI 描述以中文撰寫。
- [II]：✅ [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml) `openapi: 3.2.0` 字串完全相等；新增欄位於既有端點 `properties` 內補上，認證宣告沿用。
- [III]：✅ 全檔案路徑斜線；前端路由表無冒號；後端無新端點。
- Workflow：✅ 計畫與契約同 PR 出貨。

## Project Structure

### Documentation (this feature)

```text
specs/008-frontend-routing/
├── plan.md                                    # 本檔（/speckit.plan 產出）
├── research.md                                # Phase 0 產出
├── data-model.md                              # Phase 1 產出
├── quickstart.md                              # Phase 1 產出
├── contracts/
│   └── frontend-routing.openapi.yaml          # Phase 1 產出（openapi: 3.2.0）
├── checklists/
│   └── requirements.md                        # /speckit.checklist 既有
├── spec.md                                    # /speckit.specify + /speckit.clarify 產出
└── tasks.md                                   # 由 /speckit.tasks 產出（非本指令）
```

### Source Code (repository root)

本功能之改動完全落在既有單體結構內，不新增任何子目錄／模組／套件：

```text
記帳網頁/
├── server.js                # +~50 行（catch-all 稽核、ADMIN_ONLY_PATHS、PUBLIC_FILE_MAP 擴充、Cache-Control、system-settings 擴欄）
├── app.js                   # +~600 行（ROUTES 表、parsePath/buildPath/normalizePath、validateNextParam、apiFetch、ModalBase、SIDEBAR_ICONS、404 render、theme localStorage）
├── index.html               # +~50 行（#page-404、#sr-route-status、#route-progress、sidebar 三段式 markup）
├── style.css                # +~200 行（.route-progress、.sr-only、Modal stack z-index、.sidebar-* 三段式、.nav-item.active 三件式、.modal-open body 鎖、prefers-reduced-motion 降級）
├── openapi.yaml             # 補 routeAuditMode 欄位（v4.29.0）
├── changelog.json           # 補 4.29.0 條目
├── SRS.md                   # 補 admin-only 路徑與路由稽核段落
├── lib/                     # 無變動
└── specs/008-frontend-routing/  # 本規格相關文件
```

**Structure Decision**：採用既有「單體 SPA + 單一 server.js + 根目錄前端三檔」結構；不引入 router 套件、不引入 build step、不引入前端框架、不引入子套件目錄。本功能之程式碼改動分布於 4 個既有檔案（`server.js`／`app.js`／`index.html`／`style.css`），加總約 900 行；Modal 基底與 ROUTES 表為兩個最大區塊，分別佔 ~250 行與 ~200 行。

## Complexity Tracking

> 本計畫**無 Constitution 違反項目**；本表格留空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |
