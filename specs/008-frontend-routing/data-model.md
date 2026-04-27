# Phase 1 資料模型：前端路由與頁面（008-frontend-routing）

**Date**: 2026-04-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**作用**：列出本功能涉及的資料實體、欄位、驗證規則、狀態轉換；標示「既有 / 新增 / 擴欄」。

> 本功能**幾乎不增加資料庫實體**：核心邏輯為前端路由，僅後端 `system_settings` 表新增 1 欄、`data_operation_audit_log`（007 既建）擴充 `action` 列舉值；其餘為前端 in-memory／localStorage 結構。

---

## 1. 路由定義（Route Definition）— 前端 in-memory 常數

**載體**：`app.js` 內 `const ROUTES`（純 JS array of objects）。
**生命週期**：應用程式啟動時載入；不可變。

### 結構

```js
const ROUTES = [
  // ─── 公開路由（FR-001）───
  { path: '/',          page: 'public-home', sub: null, isPublic: true,  requireAdmin: false, staticTitle: '首頁',         icon: null,            fab: null },
  { path: '/login',     page: 'login',       sub: null, isPublic: true,  requireAdmin: false, staticTitle: '登入',         icon: null,            fab: null },
  { path: '/privacy',   page: 'privacy',     sub: null, isPublic: true,  requireAdmin: false, staticTitle: '隱私權政策',   icon: null,            fab: null },
  { path: '/terms',     page: 'terms',       sub: null, isPublic: true,  requireAdmin: false, staticTitle: '服務條款',     icon: null,            fab: null },

  // ─── 受保護路由（FR-002）───
  { path: '/dashboard',                page: 'dashboard',    sub: null,           isPublic: false, requireAdmin: false, staticTitle: '儀表板',           icon: 'gauge',     fab: null },
  { path: '/finance/transactions',     page: 'transactions', sub: null,           isPublic: false, requireAdmin: false, staticTitle: '交易記錄',         icon: 'receipt',   fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/finance/reports',          page: 'reports',      sub: null,           isPublic: false, requireAdmin: false, staticTitle: '統計報表',         icon: 'chart',     fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/finance/budget',           page: 'budget',       sub: null,           isPublic: false, requireAdmin: false, staticTitle: '預算管理',         icon: 'wallet',    fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/finance/accounts',         page: 'accounts',     sub: null,           isPublic: false, requireAdmin: false, staticTitle: '帳戶管理',         icon: 'bank',      fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/finance/categories',       page: 'categories',   sub: null,           isPublic: false, requireAdmin: false, staticTitle: '分類管理',         icon: 'tags',      fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/finance/recurring',        page: 'recurring',    sub: null,           isPublic: false, requireAdmin: false, staticTitle: '固定收支',         icon: 'repeat',    fab: { label: '新增交易', modalId: 'modalTransaction' } },
  { path: '/stocks',                   page: 'stocks',       sub: 'portfolio',    isPublic: false, requireAdmin: false, staticTitle: '持股總覽',         icon: 'briefcase', fab: { label: '新增股票交易紀錄', modalId: 'modalStockTx' }, alias: '/stocks/portfolio' },
  { path: '/stocks/portfolio',         page: 'stocks',       sub: 'portfolio',    isPublic: false, requireAdmin: false, staticTitle: '持股總覽',         icon: 'briefcase', fab: { label: '新增股票交易紀錄', modalId: 'modalStockTx' } },
  { path: '/stocks/transactions',      page: 'stocks',       sub: 'transactions', isPublic: false, requireAdmin: false, staticTitle: '股票交易紀錄',     icon: 'arrow-up-down', fab: { label: '新增股票交易紀錄', modalId: 'modalStockTx' } },
  { path: '/stocks/dividends',         page: 'stocks',       sub: 'dividends',    isPublic: false, requireAdmin: false, staticTitle: '股票股利紀錄',     icon: 'gift',      fab: { label: '新增股票交易紀錄', modalId: 'modalStockTx' } },
  { path: '/stocks/realized',          page: 'stocks',       sub: 'realized',     isPublic: false, requireAdmin: false, staticTitle: '股票實現損益紀錄', icon: 'check',     fab: { label: '新增股票交易紀錄', modalId: 'modalStockTx' } },
  { path: '/api-credits',              page: 'api-credits',  sub: null,           isPublic: false, requireAdmin: false, staticTitle: 'API 使用與授權',   icon: 'key',       fab: null },
  { path: '/settings/account',         page: 'settings',     sub: 'account',      isPublic: false, requireAdmin: false, staticTitle: '帳號設定',         icon: 'user',      fab: null },
  { path: '/settings/admin',           page: 'settings',     sub: 'admin',        isPublic: false, requireAdmin: true,  staticTitle: '管理員面板',       icon: 'shield',    fab: null },
  { path: '/settings/export',          page: 'settings',     sub: 'export',       isPublic: false, requireAdmin: false, staticTitle: '資料匯出匯入',     icon: 'database',  fab: null },
];
```

### 欄位

| 欄位            | 型別                                  | 必填 | 說明                                                                 |
| --------------- | ------------------------------------- | ---- | -------------------------------------------------------------------- |
| `path`          | string                                | Y    | 正規化後的 URL pathname；唯一鍵                                      |
| `page`          | string                                | Y    | 對應前端內部頁面元件名（既有 `navigate()` 之 `page` 參數）           |
| `sub`           | string \| null                        | N    | 子分頁名稱（settings／stocks 群組）；其他頁為 null                   |
| `isPublic`      | boolean                               | Y    | true 表示無需登入；false 表示需登入                                  |
| `requireAdmin`  | boolean                               | Y    | true 表示需管理員角色；非管理員命中時走 FR-014 404 流程              |
| `staticTitle`   | string                                | Y    | FR-010b 第一階段靜態標題（不含 `— 記帳網頁` 後綴；router 拼接）       |
| `icon`          | string \| null                        | N    | FR-015b 圖示識別；對應 `SIDEBAR_ICONS` 字典 key；公開頁與 404 為 null |
| `fab`           | `{ label, modalId }` \| null          | N    | FR-016 情境化 FAB；null 表示不顯示                                   |
| `alias`         | string \| null                        | N    | FR-002 雙別名（僅 `/stocks` → `/stocks/portfolio`）                   |

### 驗證規則

- `path` MUST 為 `normalizePath(path)` 之冪等結果（小寫、無 trailing slash、無連續斜線）。
- `path` MUST 唯一（不允許重複 path 條目；alias 例外採獨立欄位表達）。
- `requireAdmin` 為 true 之 path MUST 同步加入後端 `ADMIN_ONLY_PATHS` 常數陣列（FR-032a 手動同步要求）。
- 公開頁 (`isPublic: true`) MUST `icon: null`、`fab: null`（不在側邊欄顯示）。
- 受保護頁 MUST `icon` 非 null（用於側邊欄渲染；無對應圖示時走 fallback「首字方塊」於 render 階段處理）。

### 與後端關係

- 後端 `ADMIN_ONLY_PATHS = ['/settings/admin']`：與本表 `requireAdmin === true` 條目之 path 對應。**手動同步**，由 PR code review 把關（FR-032a）。
- 後端 catch-all 不需要逐路由認知；僅 ADMIN_ONLY_PATHS 與 PUBLIC_FILES 兩個常數陣列。

---

## 2. 系統設定（System Settings）— 既有表，**擴 1 欄**

**載體**：sql.js 表 `system_settings`（既有；[server.js:600](../../server.js#L600)）。
**生命週期**：表既有；本功能新增 1 個欄位（`route_audit_mode`），透過 `ALTER TABLE` 冪等加入。

### Schema 變更

```sql
ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security';
```

### 完整欄位列表（含本次新增）

| 欄位                          | 型別      | 預設       | 說明                                       | 來源        |
| ----------------------------- | --------- | ---------- | ------------------------------------------ | ----------- |
| `id`                          | INTEGER   | —          | PK，CHECK(id = 1) 單列模式                 | 既有        |
| `public_registration`         | INTEGER   | 1          | 是否開放公開註冊                           | 既有        |
| `allowed_registration_emails` | TEXT      | ''         | 允許註冊的 email 列表（CSV）               | 既有        |
| `admin_ip_allowlist`          | TEXT      | ''         | 管理員 IP 白名單（CSV）                    | 既有        |
| `updated_at`                  | INTEGER   | 0          | 最後修改 unix timestamp                    | 既有        |
| `updated_by`                  | TEXT      | ''         | 最後修改者 user_id                         | 既有        |
| `smtp_*`（6 欄）              | 多型別    | —          | SMTP 設定                                  | 既有        |
| `report_schedule_freq`        | TEXT      | 'off'      | 報表排程頻率                               | 既有        |
| `audit_log_retention_days`    | TEXT      | '90'       | 稽核日誌保留天數（30/90/180/365/forever）  | 既有（007） |
| **`route_audit_mode`**        | TEXT      | 'security' | **路由稽核模式（FR-033）**                 | **本次新增** |

### `route_audit_mode` 值域

- `security`（預設）：僅寫 FR-032 列出的高訊號安全事件（admin path blocked、open redirect blocked、static path traversal blocked）。
- `extended`：security 範圍 + 401（使用中 session 失效，FR-007a 觸發點）。
- `minimal`：本功能定義的所有路由相關事件皆不寫入；既有 007 稽核行為（資料匯出／匯入／備份／還原）不受影響。

### 端點變更

- `GET /api/admin/system-settings`：response 加 `routeAuditMode: 'security' | 'extended' | 'minimal'`。
- `PUT /api/admin/system-settings`：request body 新增可選 `routeAuditMode`（值需 ∈ `{ 'security', 'extended', 'minimal' }`，否則 400）。
- 切換立即生效，不需重啟（catch-all 每次查詢即時讀取；單行 SQL ~1ms）。

---

## 3. 資料操作稽核日誌（Data Operation Audit Log）— 既有表（007），**擴 `action` 列舉值**

**載體**：sql.js 表 `data_operation_audit_log`（既有；[server.js:570-584](../../server.js#L570)）。
**生命週期**：表既有；本功能不變更欄位，僅擴充 `action` 欄位之合法列舉值。

### 既有欄位（不變更）

| 欄位                  | 型別    | 說明                                            |
| --------------------- | ------- | ----------------------------------------------- |
| `id`                  | TEXT    | PK，UUID                                        |
| `user_id`             | TEXT    | 觸發使用者 user_id（未登入時為空字串 `''`）     |
| `role`                | TEXT    | `admin` / `user` / `guest`                       |
| `action`              | TEXT    | 動作識別碼（列舉值；本次新增 3 條，見下表）      |
| `ip_address`          | TEXT    | 來源 IP                                         |
| `user_agent`          | TEXT    | 來源 User-Agent                                 |
| `timestamp`           | TEXT    | ISO 8601                                        |
| `result`              | TEXT    | `success` / `failure`                           |
| `is_admin_operation`  | INTEGER | 是否為管理員針對其他使用者之操作                |
| `metadata`            | TEXT    | JSON object（依 action 不同欄位）               |

### 本次新增的 `action` 列舉值

| `action`                          | 觸發點                           | `metadata` JSON 內容                                                                                |
| --------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `route_admin_path_blocked`        | catch-all 偵測非管理員命中 admin path（FR-014、FR-032、FR-032a） | `{ path: string, normalizedPath: string }`                                                          |
| `route_open_redirect_blocked`     | catch-all 偵測非法 `?next=`（FR-006a、FR-032）  | `{ next: string, reason: 'malformed-uri' \| 'not-relative' \| 'protocol-relative' \| 'unknown-path' }` |
| `static_path_traversal_blocked`   | catch-all 偵測 `..` / `%2e%2e`（FR-027、FR-032） | `{ rawUrl: string, pattern: 'literal' \| 'percent-encoded' \| 'double-encoded' }`                     |
| `session_expired`                 | `authMiddleware` 對受保護 API 回 401（FR-007a、FR-032、FR-033 `extended` 模式專屬） | `{ path: string, reason: 'token-missing' \| 'token-invalid' \| 'token-expired' \| 'token-version-mismatch' }` |

### 既有 `action` 列舉值（不變更，列出供參考）

- `export_transactions` / `export_categories` / `export_stock_transactions` / `export_stock_dividends`
- `import_transactions` / `import_categories` / `import_stock_transactions` / `import_stock_dividends`
- `database_export` / `database_import`
- `audit_log_purge` / `audit_log_retention_changed`
- `backup_listed` / `backup_deleted`

### 擴充模式（FR-033）下的寫入規則

FR-032 共定義 4 條新增 action：前 3 條為高訊號安全事件（`route_admin_path_blocked`／`route_open_redirect_blocked`／`static_path_traversal_blocked`），第 4 條為 `session_expired`（僅 `extended` 模式寫入）。

| `route_audit_mode` 值 | 寫入前 3 條 action | 寫入 `session_expired` | 既有 007 action |
| ----------------------- | ------------------ | ---------------------- | --------------- |
| `security`（預設）      | ✅                 | ❌                     | ✅              |
| `extended`              | ✅                 | ✅                     | ✅              |
| `minimal`               | ❌                 | ❌                     | ✅              |

---

## 4. 使用者主題偏好（Theme Preference）— 既有欄位，**前端新增 localStorage 快取**

**後端載體**：`users.theme_mode` 欄位（既有；[server.js:799](../../server.js#L799)）。

### 既有欄位（不變更）

| 欄位         | 型別 | 預設       | 值域                       |
| ------------ | ---- | ---------- | -------------------------- |
| `theme_mode` | TEXT | `'system'` | `system` / `light` / `dark` |

### 既有端點（不變更）

- `PUT /api/account/theme` request `{ themeMode: 'system' | 'light' | 'dark' }`（[server.js:5502](../../server.js#L5502)）。
- `POST /api/auth/login` response `user.themeMode`（[server.js:2952](../../server.js#L2952)）。
- `GET /api/auth/me` response `user.themeMode`（[server.js:3559](../../server.js#L3559)）。
- `POST /api/auth/google` response `user.themeMode`（[server.js:3436、3529](../../server.js#L3436)）。
- `POST /api/auth/passkey/login` response `user.themeMode`（檢查既有實作）。

### 前端新增 localStorage 結構

| Key          | 值域                                     | 寫入時機                                              | 讀取時機                            |
| ------------ | ---------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `theme_pref` | `'system'` / `'light'` / `'dark'`        | 1. 登入成功取得 `themeMode` 後 2. `/api/auth/me` 回應 3. `PUT /api/account/theme` 成功 | 1. 應用程式啟動最早期 2. 登入頁渲染前 |

**清除時機**：
- 使用者主動登出（FR-007b）：`localStorage.removeItem('theme_pref')`。
- 偵測到 `theme_pref` 值非合法值（外部竄改）：覆寫為 `'system'` 並繼續。

**fallback 順序**（FR-021a）：
1. localStorage `theme_pref`（樂觀渲染）；
2. API response `themeMode`（覆寫 localStorage）；
3. `prefers-color-scheme`（首次登入或 localStorage 缺值或非合法值）。

---

## 5. 路由切換期間的 in-memory 狀態（前端）

**載體**：`app.js` IIFE 內 module-scoped 變數。
**生命週期**：頁面載入存在；重整即清空（不持久化）。

### 結構

```js
let currentRoute = null;        // RouteRecord | null
let progressTimer = null;       // setTimeout ID | 'shown' | null
let modalStack = [];            // string[]，最多 2 層
let modalPreviousFocus = [];    // Element[]，與 modalStack 同步
let bodyScrollY = 0;            // body 鎖定前的 scrollY，用於還原
let pendingDataAbort = null;    // AbortController | null，路由切換時 abort 舊頁未完成的 fetch
```

### 狀態轉換

```text
[初始]
  currentRoute = null
  modalStack = []
  bodyScrollY = 0

[路由切換: navigate(path)]
  → showRouteProgress (200ms 延遲)
  → 渲染目標頁殼
  → 第一階段 title + SR 公告
  → fetch 資料
  → in-place 填充
  → hideRouteProgress
  → 第二階段 title 覆寫（若有）

[Modal 開啟: ModalBase.open(id)]
  modalStack.push(id)
  modalPreviousFocus.push(document.activeElement)
  bodyScrollY = window.scrollY
  body.classList.add('modal-open')
  history.replaceState({...current, modalParent: { hash, scrollY: bodyScrollY }}, ...)
  history.pushState({modalLayer: id, modalStack: [...]}, '#modal-' + id)
  → 焦點移至 Modal 內第一個可互動元素

[Modal 關閉: ModalBase.close()]
  history.back()
  // popstate handler 會：
  //   modalStack.pop()
  //   focus 還原至 modalPreviousFocus.pop()
  //   若 modalStack 為空 → 解 body 鎖、還原 scrollY、還原 hash
```

---

## 6. URL 結構契約（前端）

### 公開路由（無需登入）

```
/                              → 首頁（page-public-home）
/login                         → 登入頁（含 ?next= 處理）
/login?next=<encoded>          → 登入後跳回（FR-006）
/privacy                       → 隱私權政策
/terms                         → 服務條款
```

### 受保護路由（需登入）

```
/dashboard
/finance/transactions[?month=YYYY-MM]
/finance/reports
/finance/budget
/finance/accounts
/finance/categories
/finance/recurring
/stocks                        ← 雙別名 → 等同 /stocks/portfolio
/stocks/portfolio
/stocks/transactions
/stocks/dividends
/stocks/realized
/api-credits
/settings/account
/settings/admin                ← 限管理員；非管理員命中走 FR-014 404
/settings/export
```

### 特殊 hash

```
#modal-<modalId>               ← Modal 開啟時 pushState（FR-024）
#modal-confirm                 ← Modal 疊加（僅 modalConfirm 可疊；FR-024a）
```

### 不存在路由

任何不在 ROUTES 表中的 path → 前端渲染 `#page-404`（FR-008、FR-014）。

---

## 7. 變更總結

| 變更項目                                  | 類型     | 影響面                          |
| ----------------------------------------- | -------- | ------------------------------- |
| 前端 `ROUTES` 常數                        | 新增     | `app.js` ~30 行                 |
| 前端 `SIDEBAR_ICONS` 字典                 | 新增     | `app.js` ~80 行（14 個 SVG）    |
| 前端 `ModalBase` 物件                     | 新增     | `app.js` ~250 行                |
| 前端 `parsePath` / `normalizePath` / `validateNextParam` / `apiFetch` | 新增 | `app.js` ~150 行                |
| 前端 `theme_pref` localStorage 邏輯       | 新增     | `app.js` ~30 行                 |
| `index.html` 新增 #page-404、#sr-route-status、#route-progress | 新增 | `index.html` ~50 行 |
| `style.css` 新增 .sr-only、.route-progress、.modal-open 等 | 新增 | `style.css` ~200 行 |
| `system_settings.route_audit_mode` 欄位   | **擴 1 欄** | DB 表變更（冪等 ALTER）       |
| `data_operation_audit_log.action` 列舉值 | 擴充列舉 | 不變更欄位定義                  |
| 後端 catch-all 新增稽核偵測               | 新增邏輯 | `server.js` ~30 行              |
| 後端 `ADMIN_ONLY_PATHS` 常數              | 新增     | `server.js` 1 行                |
| 後端 PUBLIC_FILES 擴充 + Cache-Control    | 擴充     | `server.js` ~10 行              |
| 後端移除獨立 `/privacy`、`/terms` handler | 刪減     | `server.js` -10 行              |
| `/api/admin/system-settings` GET/PUT 擴 `routeAuditMode` 欄位 | 擴欄 | `server.js` ~10 行 |

**完全不變更**：所有既有資料表（users、transactions、accounts、categories、stocks、stock_transactions、stock_dividends、exchange_rates、login_audit_logs、login_attempt_logs、login_history、unverified_users）；所有既有 npm 套件；所有既有 CDN；所有既有檔案結構（前端仍為 `index.html` + `app.js` + `style.css`）。
