# 實作計畫：前端框架遷移至 Next.js + Tailwind CSS v4

**分支**：`010-frontend-nextjs-tailwind` | **日期**：2026-05-03 | **規格**：[spec.md](spec.md)  
**輸入**：功能規格 `specs/010-frontend-nextjs-tailwind/spec.md`

---

## 摘要

將現有 Express + 原生 JS SPA（`server.js` 10,809 行 + `app.js` 10,571 行）一次性完整遷移至 Next.js 15（App Router）+ React 19 + Tailwind CSS v4。後端 API 路由從 Express 搬入 Next.js API Routes，前端重寫為 React 元件。所有現有 HTTP 端點路徑、請求與回應格式維持不變；資料庫結構（sql.js + SQLite）不做任何修改。

---

## Technical Context

**語言/版本**：JavaScript（Node.js `>=24.0.0`）；不引入 TypeScript（維持現有語言）  
**主要依賴（新增）**：`next ^15.3.0`、`react ^19.1.0`、`react-dom ^19.1.0`、`tailwindcss ^4.1.0`、`@tailwindcss/postcss ^4.1.0`  
**主要依賴（保留）**：`sql.js`、`jsonwebtoken`、`bcryptjs`、`@passwordless-id/webauthn`、`adm-zip`、`decimal.js`、`nodemailer`、`resend`、`dotenv`  
**儲存**：sql.js（SQLite in-memory，從 `database.db` 載入）；結構不變  
**測試**：現有測試套件（`node tests/**/*.test.js`）維持不變  
**目標平台**：自管 VPS / Docker 容器；Next.js Standalone 模式（`node .next/standalone/server.js`）  
**專案類型**：Web 應用（全端 Next.js，App Router + API Routes）  
**效能目標**：SSR 頁面 LCP 提升 ≥20%；SSG 頁面 LCP 提升 ≥40%；本地啟動 ≤30 秒  
**限制**：不修改現有 API 契約；不修改資料庫結構；不新增功能；僅使用最新穩定版套件  
**規模**：~120 個 API 端點；10 個功能頁面；單一使用者資料庫（非生產環境）

---

## 憲章檢查（Constitution Check）

*關卡：必須在 Phase 0 研究前通過。Phase 1 設計完成後再次確認。*

- **[I] 繁體中文文件規範 Gate**：✅ 本計畫及所有衍生文件（`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**`、`tasks.md`）均以繁體中文（zh-TW）撰寫。原始碼識別字、套件名稱、環境變數鍵不受此限。

- **[II] OpenAPI 3.2.0 契約 Gate**：✅ 遷移不新增、不移除、不修改任何 HTTP 端點（FR-002）。既有契約 `asset_openapi.yaml`（`openapi: 3.2.0`）維持不變。本功能分支新增 `specs/010-frontend-nextjs-tailwind/contracts/frontend-nextjs-tailwind.openapi.yaml`（`openapi: 3.2.0`）記錄零破壞性變更申報。

- **[III] Slash-Style HTTP Path Gate**：✅ 所有 Next.js API Route 目錄均採 slash-style 命名（`app/api/transactions/batch-delete/route.js`）。現有 `server.js` 中一處 regex 路由（`/api/transactions:batch-delete`）在遷移中統一改為 slash-style（原 `app.js` 前端呼叫已是 slash-style，此改動為後端對齊，無破壞性）。

- **[Development Workflow] Gate**：✅ 功能分支 `010-frontend-nextjs-tailwind` 已建立。`changelog.json` 與 `SRS.md` 更新列為任務。本次遷移含多項重大架構變更，PR 描述將以繁體中文說明遷移步驟與停用舊檔案的清單。

---

## 專案結構

### 文件（本功能）

```
specs/010-frontend-nextjs-tailwind/
├── plan.md              # 本文件
├── research.md          # Phase 0 輸出
├── data-model.md        # Phase 1 輸出
├── quickstart.md        # Phase 1 輸出
├── contracts/
│   └── frontend-nextjs-tailwind.openapi.yaml  # Phase 1 輸出
└── tasks.md             # Phase 2 輸出（/speckit-tasks 產生）
```

### 原始碼（遷移後結構）

```
/（專案根目錄）
│
├── app/                            # 新增：Next.js App Router
│   ├── layout.js                   # 根佈局（全域 CSS、導覽列 Provider）
│   ├── page.js                     # 根路由（redirect → /dashboard 或 /login）
│   ├── login/
│   │   └── page.js                 # 登入頁（SSG）
│   ├── dashboard/
│   │   └── page.js                 # 儀表板（SSR）
│   ├── accounts/
│   │   └── page.js                 # 帳戶管理（SSR）
│   ├── transactions/
│   │   └── page.js                 # 交易記錄（SSR）
│   ├── categories/
│   │   └── page.js                 # 分類管理（SSR）
│   ├── budgets/
│   │   └── page.js                 # 預算（SSR）
│   ├── reports/
│   │   └── page.js                 # 統計報表（SSR）
│   ├── stocks/
│   │   └── page.js                 # 股票投資（SSR）
│   ├── settings/
│   │   └── page.js                 # 個人設定（SSR）
│   ├── admin/
│   │   └── page.js                 # 管理後台（SSR）
│   ├── privacy/
│   │   └── page.js                 # 隱私政策（SSG，取代 privacy.html）
│   ├── terms/
│   │   └── page.js                 # 服務條款（SSG，取代 terms.html）
│   └── api/                        # Next.js API Routes（取代 Express 路由）
│       ├── auth/
│       │   ├── login/route.js
│       │   ├── logout/route.js
│       │   ├── register/route.js
│       │   ├── me/route.js
│       │   ├── google/
│       │   │   ├── route.js        # POST /api/auth/google
│       │   │   └── state/route.js  # GET /api/auth/google/state
│       │   └── passkey/
│       │       ├── challenge/route.js
│       │       └── login/route.js
│       ├── accounts/
│       │   ├── route.js            # GET/POST /api/accounts
│       │   ├── [id]/route.js       # GET/PUT/PATCH/DELETE /api/accounts/:id
│       │   └── credit-card-repayment/route.js
│       ├── transactions/
│       │   ├── route.js            # GET/POST
│       │   ├── [txId]/route.js     # GET/PUT/PATCH/DELETE
│       │   ├── export/route.js
│       │   ├── import/route.js
│       │   ├── transfer/route.js
│       │   ├── batch-delete/route.js
│       │   └── batch-update/route.js
│       ├── categories/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── reorder/route.js
│       │   ├── restore-defaults/route.js
│       │   ├── export/route.js
│       │   └── import/route.js
│       ├── budgets/
│       │   ├── route.js
│       │   └── [id]/route.js
│       ├── recurring/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── [id]/toggle/route.js
│       │   └── process/route.js
│       ├── reports/route.js
│       ├── dashboard/route.js
│       ├── exchange-rates/
│       │   ├── route.js
│       │   ├── [currency]/route.js
│       │   ├── settings/route.js
│       │   └── refresh/route.js
│       ├── stocks/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── quote/route.js
│       │   ├── batch-price/route.js
│       │   ├── batch-fetch/route.js
│       │   └── cleanup/route.js
│       ├── stock-transactions/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── export/route.js
│       │   ├── import/route.js
│       │   └── batch-delete/route.js
│       ├── stock-dividends/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── sync/route.js
│       │   ├── export/route.js
│       │   ├── import/route.js
│       │   └── batch-delete/route.js
│       ├── stock-recurring/
│       │   ├── route.js
│       │   ├── [id]/route.js
│       │   ├── [id]/toggle/route.js
│       │   └── process/route.js
│       ├── stock-realized-pl/route.js
│       ├── stock-realized/route.js
│       ├── stock-settings/route.js
│       ├── twse/
│       │   ├── stock/[symbol]/route.js
│       │   └── search/route.js
│       ├── imports/progress/route.js
│       ├── database/
│       │   ├── export/route.js
│       │   └── import/route.js
│       ├── admin/
│       │   ├── users/
│       │   │   ├── route.js
│       │   │   └── [id]/
│       │   │       ├── password/route.js
│       │   │       └── route.js    # DELETE
│       │   ├── system-settings/route.js
│       │   ├── server-time/
│       │   │   ├── route.js
│       │   │   └── ntp-sync/route.js
│       │   ├── login-audit/
│       │   │   ├── route.js
│       │   │   ├── [logId]/route.js
│       │   │   └── batch-delete/route.js
│       │   ├── data-audit/
│       │   │   ├── route.js
│       │   │   ├── export/route.js
│       │   │   ├── purge/route.js
│       │   │   └── retention/route.js
│       │   ├── email-providers/route.js
│       │   ├── test-email/route.js
│       │   ├── report-schedule/
│       │   │   ├── route.js
│       │   │   └── run-now/route.js
│       │   ├── report-schedules/
│       │   │   ├── route.js
│       │   │   └── [id]/
│       │   │       ├── route.js
│       │   │       └── run-now/route.js
│       │   ├── backups/
│       │   │   ├── route.js
│       │   │   └── [filename]/route.js
│       │   └── certs/
│       │       ├── route.js
│       │       └── origin/
│       │           ├── route.js
│       │           └── ca/route.js
│       ├── account/
│       │   ├── link-google/route.js
│       │   ├── unlink-google/route.js
│       │   ├── passkey/
│       │   │   ├── challenge/route.js
│       │   │   └── register/route.js
│       │   ├── passkeys/route.js
│       │   ├── passkey/[id]/route.js
│       │   ├── theme/route.js
│       │   ├── display-name/route.js
│       │   ├── password/route.js
│       │   └── delete/route.js
│       ├── users/
│       │   ├── me/
│       │   │   ├── route.js
│       │   │   └── timezone/route.js
│       │   └── settings/
│       │       └── pinned-currencies/route.js
│       ├── user/
│       │   ├── login-audit/route.js
│       │   ├── data-audit/route.js
│       │   └── settings/pinned-currencies/route.js
│       ├── config/route.js
│       ├── changelog/route.js
│       ├── external-apis/route.js
│       └── system/update-app/route.js
│
├── components/                     # 新增：React 元件
│   ├── layout/
│   │   ├── AppLayout.js            # 主佈局（側邊欄 + 頂部導覽）
│   │   ├── Sidebar.js              # 側邊導覽欄
│   │   └── TopNav.js               # 頂部導覽列
│   ├── ui/                         # 基礎元件（對應現有 HTML 結構）
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── Modal.js
│   │   ├── Table.js
│   │   ├── Select.js
│   │   ├── Badge.js
│   │   └── Toast.js
│   └── features/                   # 功能元件（由現有 app.js 重構而來）
│       ├── dashboard/
│       ├── transactions/
│       ├── accounts/
│       ├── categories/
│       ├── budgets/
│       ├── reports/
│       ├── stocks/
│       └── admin/
│
├── lib/                            # 更新：新增 DB/Auth 工具，保留現有
│   ├── db.js                       # 新增：sql.js 全域單例 + saveDB()
│   ├── auth.js                     # 新增：JWT 工具函式
│   ├── userTime.js                 # 保留（不修改）
│   ├── taipeiTime.js               # 保留（不修改）
│   ├── twseFetch.js                # 保留（不修改）
│   ├── exchangeRateCache.js        # 保留（不修改）
│   ├── moneyDecimal.js             # 保留（不修改）
│   ├── iso4217.js                  # 保留（不修改）
│   └── external-apis.json          # 保留（不修改）
│
├── middleware.js                   # 新增：JWT 驗證 + 速率限制
├── instrumentation.js              # 新增：DB 初始化（伺服器啟動一次）
├── next.config.js                  # 新增：Standalone 模式 + 安全標頭
├── postcss.config.js               # 新增：Tailwind v4 PostCSS
├── styles/
│   └── globals.css                 # 新增：Tailwind v4 指令 + 全域樣式
├── public/
│   ├── favicon.svg                 # 移入（從根目錄）
│   └── logo.svg                    # 移入（從根目錄）
│
# 遷移後停用（新版穩定後可在獨立清理 PR 刪除）：
# server.js   → 由 app/api/** 取代
# app.js      → 由 components/** + app/** 取代
# index.html  → 由 app/layout.js + app/** 取代
# style.css   → 由 styles/globals.css + Tailwind 取代
# privacy.html→ 由 app/privacy/page.js 取代
# terms.html  → 由 app/terms/page.js 取代
```

**結構決策**：採用 Next.js 標準 `app/` 目錄（App Router），所有 API Routes 置於 `app/api/`，React 元件置於 `components/`，現有 `lib/` 工具函式原地保留並新增 `db.js`、`auth.js`。

---

## 關鍵實作細節

### DB 初始化（instrumentation.js）

```js
// instrumentation.js — 伺服器啟動時執行一次（Next.js 15 正式 API）
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDB, flushOnExit } = await import('./lib/db.js');
    await initDB();
    process.once('SIGINT', flushOnExit);
    process.once('SIGTERM', flushOnExit);
  }
}
```

### DB 全域單例（lib/db.js）

```js
// 開發模式：globalThis 防止 HMR 重複初始化
// 生產模式：模組層級變數（Standalone 模式單一程序，initDB() 負責設值）
let _db = null;

export async function initDB() {
  // ... 載入 database.db、套用加密、執行 migrations ...
  _db = db; // 統一設值模組層級變數，開發/生產均適用
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__sqlDb = db; // 開發模式額外掛至 globalThis 以跨越 HMR
  }
}

export function getDB() {
  // 開發模式：HMR 後 _db 可能被清空，改從 globalThis 取回
  if (!_db && process.env.NODE_ENV !== 'production') {
    _db = globalThis.__sqlDb ?? null;
  }
  if (!_db) throw new Error('DB 尚未初始化，請確認 instrumentation.js 已執行');
  return _db;
}
```

### JWT 驗證中介層（middleware.js）

```js
// 保護路由：/dashboard、/accounts、/transactions、/categories、
//           /budgets、/reports、/stocks、/settings、/admin、/api/*
// 公開路由：/login、/privacy、/terms、/api/auth/login、/api/auth/register、
//           /api/config、/api/auth/google/*
```

### Next.js 設定（next.config.js）

```js
const nextConfig = {
  output: 'standalone',           // Standalone 模式（Docker/VPS 部署）
  // Next.js 15 起 instrumentation.js 為穩定 API，無需 experimental.instrumentationHook
  async headers() {
    // 對應現有 helmet 安全標頭設定
    return [{ source: '/(.*)', headers: [...] }];
  },
};
```

### Tailwind CSS v4（styles/globals.css）

```css
@import "tailwindcss";

@theme {
  /* 從現有 style.css 提取色票與間距設定 */
}

/* 無法直接轉換的全域樣式保留於此 */
```

---

## 複雜度追蹤（Complexity Tracking）

| 違規項目 | 為何需要 | 更簡單替代方案之排除理由 |
|----------|----------|--------------------------|
| 廢棄但暫留 Express 相關套件（`express`、`cors`、`cookie-parser`、`helmet`、`express-rate-limit`） | 遷移期間保留以便回滾；清理列為後續獨立 PR | 立即刪除會讓回滾更困難，遷移期間風險過高 |
| 現有 `server.js` regex 路由（`/api/transactions:batch-delete`）遷移後改為 slash-style | 憲章 Principle III 要求；前端呼叫已是 slash-style，無破壞性 | 保留 regex 路由語法在 Next.js App Router 中不支援 |
| `app.js`、`index.html`、`style.css`、`server.js` 停用但暫不刪除 | 遷移完成驗收前保留作對照基準 | 在 `/speckit-tasks` 後的清理任務中處理 |
