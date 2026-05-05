# 研究報告：前端框架遷移至 Next.js + Tailwind CSS v4

**功能分支**：`010-frontend-nextjs-tailwind`  
**建立日期**：2026-05-03  
**用途**：解決 plan.md Technical Context 中所有 NEEDS CLARIFICATION 項目，確立技術決策

---

## 1. 套件版本決策

### 決策：套件版本選用

| 套件 | 選定版本 | 理由 |
|------|----------|------|
| `next` | `^15.3.0` | 最新穩定版（2026-05），App Router 完整成熟，Standalone 模式穩定 |
| `react` | `^19.1.0` | Next.js 15 要求 React 19；最新穩定版 |
| `react-dom` | `^19.1.0` | 與 react 同版 |
| `tailwindcss` | `^4.1.0` | v4 最新穩定版，CSS-first 設定方式 |
| `@tailwindcss/postcss` | `^4.1.0` | Next.js 透過 PostCSS 整合 Tailwind v4 |

**現有套件保持不變**（遵循憲章 Principle V）：`sql.js`、`jsonwebtoken`、`bcryptjs`、`@passwordless-id/webauthn`、`adm-zip`、`decimal.js`、`nodemailer`、`resend`、`dotenv`

**廢棄但暫留套件**（遷移完成後列為清理任務）：`express`、`express-rate-limit`、`cors`、`cookie-parser`、`helmet`。這些套件在 Next.js 遷移後不再使用，但遷移期間保留以便回滾。

**替代方案考量**：
- Remix / Vite + React：不是「Next.js」，不符合使用者需求
- Next.js 14：非最新版，排除
- Tailwind CSS v3：使用者明確要求 v4，排除

---

## 2. Next.js 渲染策略實作方式

### 決策：App Router + SSR/SSG 混用

**選定方案**：Next.js 15 App Router
- 含使用者資料的功能頁面（帳戶、交易、分類、預算、報表、股票）：**SSR**（`export const dynamic = 'force-dynamic'`）
- 靜態頁面（登入、隱私政策、服務條款）：**SSG**（預設，`generateStaticParams` 或無動態資料）
- 根路由 `/`：SSR redirect 至 `/dashboard` 或 `/login`

**理由**：
- App Router 是 Next.js 13+ 的標準；Pages Router 已進入維護模式
- `force-dynamic` 確保每次請求都重新從 DB 取得使用者資料，避免資料殘留在快取
- SSG 靜態頁面由 Node.js 在建置時生成，直接提供 HTML，減少伺服器負擔

**替代方案考量**：
- Pages Router：已進入維護模式，不適合新遷移
- 全部 CSR：無法達到 SC-002 LCP 目標，排除

---

## 3. 資料庫（sql.js）在 Next.js 的管理方式

### 決策：Next.js Instrumentation Hook + globalThis 快取

**問題**：sql.js 將整個 SQLite 資料庫載入記憶體。Next.js 在開發模式下會 Hot Reload，若每次都重新初始化 DB 會造成資料遺失與效能問題。

**選定方案**：
1. **`instrumentation.js`**（Next.js 15 正式 API）：在伺服器啟動時執行一次 `register()` 函式，初始化 DB 並設定 SIGTERM/SIGINT flush 處理器
2. **`globalThis.__sqlDb`** 快取：開發模式下透過 `globalThis` 防止 Hot Reload 重複初始化
3. **`lib/db.js`**：匯出 `getDB()` 同步函式（DB 已在 instrumentation 初始化完成，後續呼叫皆直接返回 cached instance）

```
啟動流程：
  Next.js 進程啟動
    → instrumentation.js register() 執行
    → initSqlJs() 初始化 SQL.js
    → 從 DB_PATH 讀取並載入資料庫（或建新 DB）
    → 執行 migrations
    → 設定 saveDB() 定時器（或由寫入操作觸發）
    → 設定 process.once('SIGINT/SIGTERM', saveDBSync)
    → Next.js HTTP server 啟動
```

**替代方案考量**：
- Custom server（`server.js` 包裝 Next.js）：可行但 Next.js 官方不推薦新專案使用；Instrumentation Hook 更符合 Next.js 生態
- 每次 API Route 呼叫重新開啟 DB 檔案：效能極差，排除
- 外部 SQLite 連線池（better-sqlite3）：需要替換 sql.js，屬於功能外變更，排除

---

## 4. JWT 身份驗證在 Next.js 的實作方式

### 決策：Next.js Middleware + lib/auth.js

**現狀**：`server.js` 使用 `jsonwebtoken` 簽發/驗證 JWT，儲存在 `httpOnly` Cookie（名稱待確認）。

**選定方案**：
- **`middleware.js`**（Next.js root middleware）：攔截所有 `/dashboard`、`/accounts` 等受保護路由及 `/api/*`（除公開端點外），驗證 JWT Cookie，驗證失敗則 redirect 至 `/login`
- **`lib/auth.js`**：封裝 `jwt.verify()`、`jwt.sign()`、Cookie 讀取邏輯，供 middleware 和 API Routes 共用
- Cookie 名稱、JWT_SECRET、JWT_EXPIRES 從 `.env` 讀取（與現有一致）

**理由**：
- Next.js Middleware 在 Edge Runtime 執行，速度快且無需進入 API Route 層才能驗證
- `jsonwebtoken` 為現有套件，不需引入新依賴
- `httpOnly` Cookie 安全屬性保持不變

**替代方案考量**：
- `iron-session`：加密 Cookie session，需額外套件且需改變 token 格式，排除
- `next-auth`：功能過重，且現有已有 Google OAuth、WebAuthn 等自製流程，排除

---

## 5. 安全標頭（Helmet 替代方案）

### 決策：`next.config.js` headers() 設定

現有 Express 使用 `helmet` 設定安全標頭（CSP、HSTS 等）。

**選定方案**：在 `next.config.js` 的 `async headers()` 函式中靜態宣告等效標頭。

**理由**：Next.js 原生支援，無需額外套件。

---

## 6. 速率限制（express-rate-limit 替代方案）

### 決策：Next.js Middleware 中的 in-memory Map 實作

現有 Express 使用 `express-rate-limit` 套件（針對 `/api/auth/*` 等敏感端點）。

**選定方案**：在 `middleware.js` 中實作簡易 in-memory Map-based 速率限制，邏輯與現有完全相同（視窗時間 15 分鐘、最大請求數）。

**理由**：
- 非生產環境，in-memory 方案足夠
- 避免引入新套件（符合憲章 Principle V 精神）

---

## 7. Tailwind CSS v4 設定方式

### 決策：CSS-first 設定（無 `tailwind.config.js`）

Tailwind CSS v4 採用全新的 CSS-first 設定方式：

```css
/* styles/globals.css */
@import "tailwindcss";

/* 自訂設定透過 CSS 變數或 @theme 宣告 */
@theme {
  --color-primary: #your-color;
}
```

**PostCSS 整合**：
```js
// postcss.config.js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

**理由**：v4 官方推薦方式；零設定檔維護負擔；與 Next.js PostCSS pipeline 完全相容。

**現有 style.css 遷移策略**：
1. 保留現有 CSS 自訂變數（色票、間距）至 `@theme` 區塊
2. 逐步將 class 名稱轉換為 Tailwind 工具類別
3. 無法直接對應的樣式保留在 `styles/globals.css` 全域樣式中

---

## 8. 靜態檔案與公開資源

### 決策：Next.js /public 目錄

| 現有檔案 | 遷移後位置 | 備註 |
|----------|-----------|------|
| `favicon.svg` | `public/favicon.svg` | Next.js 自動提供 |
| `logo.svg` | `public/logo.svg` | 透過 `<Image>` 或 `<img>` 引用 |
| `changelog.json` | 由 `app/api/changelog/route.js` 提供 | 已有 API 端點 |
| `privacy.html` | `app/privacy/page.js`（SSG） | 轉為 React JSX |
| `terms.html` | `app/terms/page.js`（SSG） | 轉為 React JSX |
| `lib/moneyDecimal.js` | `lib/moneyDecimal.js`（保留） | 既可伺服器端也可客戶端使用 |
| `vendor/webauthn.min.js` | 透過 npm 套件引用 | `@passwordless-id/webauthn` 已在 package.json |

---

## 9. Import 進度輪詢端點（/api/imports/progress）

### 確認：非 SSE，為普通 JSON 輪詢

`/api/imports/progress` 回傳 JSON（非 Server-Sent Events），前端以輪詢方式取得進度。Next.js App Router Route Handler 完全支援，無需特殊處理。

---

## 10. Node.js 版本

**維持**：`>=24.0.0`（已在 `package.json` `engines` 欄位宣告）。Next.js 15 最低要求 Node.js 18.18，與現有需求相容。
