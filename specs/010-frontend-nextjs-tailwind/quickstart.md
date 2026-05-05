# 快速啟動指南：Next.js + Tailwind CSS v4 遷移版

**功能分支**：`010-frontend-nextjs-tailwind`  
**目標讀者**：開發者在本機設定並執行遷移後的 Next.js 版本

---

## 前置需求

| 工具 | 版本要求 |
|------|----------|
| Node.js | `>=24.0.0 <25`（與原版相同） |
| npm | `>=10` |

---

## 1. 安裝依賴

```bash
npm install
```

新增的依賴（遷移後）：`next`、`react`、`react-dom`、`tailwindcss`、`@tailwindcss/postcss`

---

## 2. 設定環境變數

複製 `.env.example` 為 `.env`，填入所需值：

```bash
cp .env.example .env
```

關鍵環境變數（與原版完全相同，無新增）：

```env
JWT_SECRET=your-secret-key
DB_PATH=./database.db
PORT=3000
# 其餘見 .env.example
```

---

## 3. 開發模式啟動

```bash
npm run dev
```

Next.js 開發伺服器預設在 `http://localhost:3000` 啟動，支援熱更新（HMR）。

**注意**：首次啟動時 `instrumentation.js` 會初始化資料庫（載入現有 `database.db` 或建立新 DB）。

---

## 4. 建置與生產模式

```bash
# 建置（產生 .next/standalone）
npm run build

# 生產模式啟動（Standalone 模式）
node .next/standalone/server.js
```

或使用 PM2：

```bash
pm2 start .next/standalone/server.js --name bookkeeping-app
```

---

## 5. 測試

現有測試套件維持不變：

```bash
npm test
```

---

## 6. 目錄結構（遷移後）

```
/
├── app/                    # Next.js App Router
│   ├── layout.js           # 根佈局（導覽列、全域 CSS）
│   ├── page.js             # 根路由（redirect 至 /dashboard 或 /login）
│   ├── login/page.js       # 登入頁（SSG）
│   ├── dashboard/page.js   # 儀表板（SSR）
│   ├── accounts/page.js    # 帳戶（SSR）
│   ├── transactions/page.js# 交易記錄（SSR）
│   ├── categories/page.js  # 分類管理（SSR）
│   ├── budgets/page.js     # 預算（SSR）
│   ├── reports/page.js     # 統計報表（SSR）
│   ├── stocks/page.js      # 股票投資（SSR）
│   ├── settings/page.js    # 個人設定（SSR）
│   ├── admin/page.js       # 管理後台（SSR）
│   ├── privacy/page.js     # 隱私政策（SSG）
│   ├── terms/page.js       # 服務條款（SSG）
│   └── api/                # API Routes（取代 Express 路由）
│       ├── auth/           # 身份驗證端點
│       ├── accounts/       # 帳戶 CRUD
│       ├── transactions/   # 交易 CRUD + 匯入匯出
│       ├── categories/     # 分類 CRUD + 排序
│       ├── budgets/        # 預算 CRUD
│       ├── recurring/      # 定期交易
│       ├── reports/        # 統計報表
│       ├── stocks/         # 股票投資
│       ├── exchange-rates/ # 匯率
│       ├── admin/          # 管理功能
│       ├── database/       # DB 匯出匯入
│       └── ...
├── components/             # React 元件
│   ├── layout/             # 佈局元件（Nav、Sidebar）
│   ├── ui/                 # 基礎元件（Button、Input、Table）
│   └── features/           # 功能元件（TransactionList、AccountCard 等）
├── lib/                    # 共用工具（現有 + 新增）
│   ├── db.js               # 新增：sql.js 全域單例 + saveDB()
│   ├── auth.js             # 新增：JWT 工具函式
│   ├── userTime.js         # 保留：現有時區工具
│   ├── taipeiTime.js       # 保留：現有時區工具
│   ├── twseFetch.js        # 保留：TWSE 外部 API
│   ├── exchangeRateCache.js# 保留：匯率快取
│   ├── moneyDecimal.js     # 保留：金額精度計算
│   └── iso4217.js          # 保留：貨幣代碼驗證
├── middleware.js           # 新增：Next.js 身份驗證 + 速率限制
├── instrumentation.js      # 新增：DB 初始化（伺服器啟動時執行一次）
├── next.config.js          # 新增：Next.js 設定（安全標頭、Standalone 模式）
├── postcss.config.js       # 新增：Tailwind v4 PostCSS 整合
├── styles/
│   └── globals.css         # 新增：Tailwind v4 指令 + 全域樣式
├── public/                 # 新增：靜態資源
│   ├── favicon.svg         # 從根目錄移入
│   └── logo.svg            # 從根目錄移入
├── package.json            # 更新：新增 Next.js 相關依賴
│
# 遷移後停用（切換完成後可刪除）：
# server.js    → 由 app/api/** 取代
# app.js       → 由 components/** + app/** 取代
# index.html   → 由 app/layout.js + app/page.js 取代
# style.css    → 由 styles/globals.css + Tailwind 取代
# privacy.html → 由 app/privacy/page.js 取代
# terms.html   → 由 app/terms/page.js 取代
```

---

## 7. 驗收確認清單

遷移完成後，依以下順序驗證功能對等性：

1. **[ ] 登入 / 登出** — 能正常登入（Email/密碼、Google SSO、Passkey），登出後 Cookie 清除
2. **[ ] 帳戶管理** — 新增、編輯、刪除帳戶；餘額計算正確
3. **[ ] 交易記錄** — 新增、編輯、刪除交易；篩選、搜尋正常
4. **[ ] 分類管理** — 新增、排序、刪除分類；階層結構正確
5. **[ ] 預算管理** — 建立月預算；使用率計算正確
6. **[ ] 統計報表** — 月報表、年報表數字與原版一致
7. **[ ] 股票投資** — 持倉顯示、TWSE 報價抓取、損益計算
8. **[ ] 資料匯出匯入** — CSV 匯出匯入、DB 備份還原
9. **[ ] 管理後台** — 系統設定、使用者管理、稽核日誌
10. **[ ] LCP 量測** — Lighthouse 驗證 SSR 頁面 LCP 較原版提升 ≥20%
