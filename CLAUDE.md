# 資產管理 - Claude Code 專案指引

## 專案概述

個人資產管理網頁應用程式，提供記帳、股票紀錄、預算管理等功能。

## 技術架構

- **前端**：原生 HTML / CSS / JavaScript（單頁應用程式 SPA）
- **後端**：Node.js + Express
- **資料庫**：SQLite（透過 sql.js，記憶體 + 檔案持久化）
- **認證**：JWT（Bearer Token），bcryptjs 密碼加密，Google SSO（選配）
- **圖表**：Chart.js
- **圖示**：Font Awesome 6
- **外部服務**：Google Identity Services（GSI，選配 SSO 登入）

## 檔案結構

```
├── server.js          # Express 後端（API + 資料庫）
├── app.js             # 前端 SPA 邏輯（IIFE 模組 App）
├── index.html         # 單頁 HTML（所有頁面 + Modal）
├── style.css          # 全域樣式
├── changelog.json     # 版本更新紀錄（前端讀取顯示）
├── logo.svg           # 網站 Logo（登入頁）
├── favicon.svg        # Favicon + 側邊欄 Logo
├── database.db        # SQLite 資料庫檔案（自動產生）
├── .env               # 環境變數（JWT 金鑰、Google Client ID 等，勿提交版控）
├── .env.example       # 環境變數範本（可提交版控）
├── .gitignore         # Git 忽略清單（含 .env、database.db）
├── SRS.md             # 軟體需求規格書
├── CLAUDE.md          # 本檔案
└── .claude/
    ├── launch.json           # 開發伺服器設定
    └── settings.local.json   # 本地權限設定
```

## 啟動方式

```bash
npm install        # 安裝依賴：express, cors, sql.js, bcryptjs, jsonwebtoken, dotenv
cp .env.example .env   # 複製環境變數範本，填入實際值
node server.js         # 啟動伺服器，預設 http://localhost:3000
```

### 環境變數（.env）

| 變數名稱           | 說明                          | 預設值                                       |
| ------------------ | ----------------------------- | -------------------------------------------- |
| `PORT`             | 伺服器埠號                    | `3000`                                       |
| `JWT_SECRET`       | JWT 簽章金鑰（正式環境務必更換）| `bookkeeping-secret-key-change-in-production` |
| `JWT_EXPIRES`      | JWT 有效期限                  | `7d`                                         |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID（選配，留空則停用 SSO）| （空）                    |

## 開發慣例

### 程式碼風格

- **前端**：所有邏輯封裝在 `App` IIFE 模組內，透過 `return {}` 暴露公開方法
- **後端**：Express 路由，API 路徑統一使用 `/api/` 前綴
- **命名**：
  - 資料庫欄位：`snake_case`（如 `category_id`, `parent_id`）
  - API 回傳 JSON：`camelCase`（如 `categoryId`, `parentId`）
  - HTML id：`camelCase`（如 `stockTxBody`, `reportRange`）
  - CSS class：`kebab-case`（如 `stock-card`, `summary-cards`）

### 頁面新增流程

1. `index.html`：新增 `<a class="nav-item" data-page="xxx">` 側邊欄項目
2. `index.html`：新增 `<section class="page" id="page-xxx">` 頁面區塊
3. `app.js`：`validPages` 陣列加入頁面名稱
4. `app.js`：`titles` 物件加入中文標題
5. `app.js`：`renderPage()` switch 加入 `case 'xxx'`
6. `app.js`：實作 `renderXxx()` 函式
7. `app.js`：`return {}` 暴露需要從 HTML onclick 呼叫的函式

### Modal 新增流程

1. `index.html`：新增 `<div class="modal-overlay" id="modalXxx">` 結構
2. `app.js`：實作 `openXxxModal()` 和表單 submit handler
3. `app.js`：`return {}` 暴露 Modal 相關函式

### API 新增流程

1. `server.js`：在 catch-all 路由之前新增路由
2. 所有需認證的路由自動經過 `authMiddleware`（掛在 `/api/` 下，排除 `/api/auth/` 和 `/api/config`）
3. 寫入資料庫後務必呼叫 `saveDB()`

## 資料庫結構

### 主要資料表

| 資料表 | 用途 |
|--------|------|
| `users` | 使用者帳號（支援密碼登入 + Google SSO） |
| `categories` | 分類（支援 `parent_id` 子分類） |
| `accounts` | 帳戶 |
| `transactions` | 交易記錄（含 `linked_id` 轉帳配對） |
| `budgets` | 預算 |
| `recurring` | 固定收支 |
| `stocks` | 股票清單（含 `stock_type`：stock / etf / warrant） |
| `stock_transactions` | 股票買賣紀錄 |
| `stock_dividends` | 股利紀錄 |

### 資料庫升級

- 新增欄位使用 `ALTER TABLE ... ADD COLUMN`，包在 `try/catch` 中（欄位已存在時忽略）
- 新增資料表使用 `CREATE TABLE IF NOT EXISTS`
- 升級邏輯放在 `initDB()` 函式中

## 前端路由

使用 `history.pushState` 實作 SPA 路由：

| URL | 頁面 |
|-----|------|
| `/` | 儀表板 |
| `/transactions` | 交易記錄 |
| `/reports` | 統計報表 |
| `/budget` | 預算管理 |
| `/accounts` | 帳戶管理 |
| `/stocks` | 股票紀錄 |
| `/settings/categories` | 設定 > 分類管理 |
| `/settings/recurring` | 設定 > 固定收支 |
| `/settings/export` | 設定 > 資料匯出匯入 |
| `/settings/account` | 設定 > 帳號設定 |

伺服器端有 catch-all 路由回傳 `index.html` 以支援直接輸入 URL。

## 功能模組

### 已實作功能

- 使用者註冊/登入/登出（JWT 認證）
- Google SSO 登入（選配，需設定 `GOOGLE_CLIENT_ID` 環境變數）
- 交易記錄 CRUD + 批次操作（刪除/變更分類/帳戶/日期）
- 帳戶間轉帳（`linked_id` 雙向關聯）
- 分類管理（支援子分類，`parent_id` 自關聯）
- 帳戶管理（餘額自動計算）
- 預算管理（月度/分類預算 + 進度條）
- 固定收支（週期自動產生交易）
- 統計報表（分類統計、趨勢分析、每日消費 + 自訂時間範圍）
- 股票紀錄（持股總覽、買賣交易、股利紀錄、實現損益紀錄、FIFO 損益計算）
- TWSE 臺灣證券交易所 OpenAPI 整合（股票代號查詢、自動填入名稱與股價、批次更新股價、除權息自動同步）
- 股票交易/股利新增時輸入代號自動建立股票（無需先手動新增）
- 股票交易紀錄與股利紀錄支援搜尋篩選、多選批次刪除、分頁（每頁筆數可選）
- 股票類型管理（一般股票 / ETF / 權證），影響證交稅計算稅率
- CSV 匯出/匯入（交易記錄 + 分類結構 + 股票交易紀錄 + 股利紀錄）
- 響應式設計（桌面 + 手機）

### 重要注意事項

- `express.json()` 的 body 上限設為 `50mb`（支援大量 CSV 匯入）
- 分類下拉使用 `<optgroup>` 顯示父子階層
- 交易記錄表格支援 checkbox 多選 + 批次操作列
- 股票交易紀錄 / 股利紀錄表格支援 checkbox 多選批次刪除 + 分頁
- 每頁筆數支援自訂輸入（不限於預設選項）
- 股票手續費自動計算：`Math.floor(成交金額 × 0.1425%)`，無條件捨去，整股最低 **20 元**（零股最低 1 元）
- 股票證交稅自動計算（僅賣出）：`Math.floor(成交金額 × 稅率)`，無條件捨去，最低 **1 元**
  - 一般股票：0.3%；ETF / 權證：0.1%
- 實現損益紀錄：FIFO 逐筆賣出計算成本均價、實現損益、報酬率；彙總卡片顯示總實現損益、整體報酬率、今年實現損益、已實現筆數
- 股票交易/股利 Modal 輸入股票代號自動查詢 TWSE，若無持倉則自動新增
- TWSE 即時/收盤價三段策略：盤中 → mis.twse.com.tw 即時價；盤後 → STOCK_DAY 今日收盤；其他 → STOCK_DAY_ALL 備援
- TWSE 代理快取：即時價 1 分鐘、STOCK_DAY 5 分鐘、STOCK_DAY_ALL 10 分鐘、除權息 30 分鐘；前端防抖 500ms
- TWSE 除權息自動同步：`POST /api/stock-dividends/sync`，查詢 `TWT49U`（除權息列表）+ `TWT49UDetail`（個股明細），依持股期間自動新增現金股利/股票股利，不重複新增
- 更新股價 Modal 顯示每檔股票的價格來源（即時成交價/收盤價）與時間
- 股票交易紀錄/股利紀錄的搜尋篩選使用下拉式選單（支援代號或名稱搜尋）
- 股票 CSV 匯出欄位：日期、股票代號、股票名稱、類型（買進/賣出）、股數、成交價、手續費、交易稅、帳戶、備註
- 股利 CSV 匯出欄位：日期、股票代號、股票名稱、現金股利、股票股利、備註
- 股票/股利 CSV 匯入時若股票不存在則自動建立；若已存在但名稱為代號（不正確），自動以 CSV 名稱更新
- 新使用者註冊時自動建立預設分類（含子分類）和預設帳戶
- Google SSO 登入自動建立使用者帳號（首次登入即註冊）

### Google SSO 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 建立專案
2. 啟用「Google Identity Services」
3. 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
4. 設定授權的 JavaScript 來源（如 `http://localhost:3000`）
5. 將 Client ID 設為環境變數 `GOOGLE_CLIENT_ID` 啟動伺服器
6. 未設定時 Google 按鈕自動隱藏，不影響帳號密碼登入功能

## 版本更新流程（重要）

**每次完成功能開發或修正後，必須更新版本資訊：**

1. **更新 `changelog.json`**：
   - 修改 `currentVersion` 為新版本號
   - 在 `releases` 陣列**最前面**新增一筆版本紀錄
   - 格式範例：
     ```json
     {
       "version": "3.7",
       "date": "2026-03-21",
       "title": "簡短版本標題",
       "type": "feature",
       "changes": [
         { "tag": "new", "text": "新增的功能說明" },
         { "tag": "improved", "text": "改進的功能說明" },
         { "tag": "fixed", "text": "修正的問題說明" },
         { "tag": "removed", "text": "移除的功能說明" }
       ]
     }
     ```
   - `tag` 可用值：`new`（新增）、`improved`（改進）、`fixed`（修正）、`removed`（移除）

2. **同步更新 `SRS.md`** 的版本歷程表（8.2 節）

3. **版本號規則**：
   - 大版本（如 4.0）：新增重大模組
   - 小版本（如 3.7）：新增功能或重要改進
   - 修正版（如 3.7.1）：Bug 修正

## 測試帳號

- Email: `test@test.com`
- Password: `test1234`
