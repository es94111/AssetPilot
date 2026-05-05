# 資料模型文件：前端框架遷移至 Next.js + Tailwind CSS v4

**功能分支**：`010-frontend-nextjs-tailwind`**建立日期**：2026-05-03

> **重要說明**：本次遷移嚴格遵循憲章 Principle V（Brownfield Development Discipline），**資料庫結構完全不變**。本文件記錄現有資料模型，供 Next.js 頁面與 API Routes 開發者參考，確保各端點存取正確欄位。

---

## 資料庫技術

- **引擎**：`sql.js`（SQLite 在 Node.js 記憶體中執行，從 `database.db` 載入）
- **持久化**：每次寫入後觸發 `saveDB()`，程序退出前執行 `saveDBSync()`
- **加密**：選用（`DB_ENCRYPTION_KEY` 環境變數）；ChaCha20-Poly1305

---

## 實體清單

### users（使用者）

| 欄位          | 類型        | 說明                                    |
| ------------- | ----------- | --------------------------------------- |
| id            | TEXT PK     | UUID（無連字符）                        |
| email         | TEXT UNIQUE | 電子郵件                                |
| password_hash | TEXT        | bcrypt 雜湊；Google SSO 使用者可為 NULL |
| display_name  | TEXT        | 顯示名稱                                |
| role          | TEXT        | `user` / `admin`                    |
| timezone      | TEXT        | IANA 時區（預設 `Asia/Taipei`）       |
| theme         | TEXT        | `system` / `light` / `dark`       |
| google_sub    | TEXT        | Google SSO subject ID                   |
| token_version | INTEGER     | JWT 失效版本號（改密碼時遞增）          |
| created_at    | INTEGER     | Unix ms UTC                             |
| updated_at    | INTEGER     | Unix ms UTC                             |

**Next.js 使用方式**：`middleware.js` 驗證 JWT 後將 `userId` 傳入請求上下文；受保護的 API Routes 讀取 `req.userId` 查詢此表。

---

### accounts（帳戶）

| 欄位       | 類型             | 說明                                                        |
| ---------- | ---------------- | ----------------------------------------------------------- |
| id         | TEXT PK          | UUID                                                        |
| user_id    | TEXT FK → users | 所屬使用者                                                  |
| name       | TEXT             | 帳戶名稱                                                    |
| type       | TEXT             | `checking` / `savings` / `credit` / `investment` 等 |
| currency   | TEXT             | ISO 4217 貨幣代碼（如 `TWD`）                             |
| balance    | REAL             | 目前餘額                                                    |
| icon       | TEXT             | FontAwesome class（如 `fa-wallet`）                       |
| color      | TEXT             | `#RRGGBB` 格式                                            |
| sort_order | INTEGER          | 排序                                                        |
| is_active  | INTEGER          | 0/1                                                         |
| created_at | INTEGER          | Unix ms UTC                                                 |
| updated_at | INTEGER          | Unix ms UTC                                                 |

---

### transactions（交易記錄）

| 欄位                   | 類型                  | 說明                                    |
| ---------------------- | --------------------- | --------------------------------------- |
| id                     | TEXT PK               | UUID                                    |
| user_id                | TEXT FK → users      |                                         |
| account_id             | TEXT FK → accounts   |                                         |
| type                   | TEXT                  | `income` / `expense` / `transfer` |
| amount                 | REAL                  | 金額（Decimal 計算用）                  |
| currency               | TEXT                  | ISO 4217                                |
| category_id            | TEXT FK → categories |                                         |
| date                   | TEXT                  | `YYYY-MM-DD`（使用者時區日期）        |
| note                   | TEXT                  | 備註                                    |
| transfer_to_account_id | TEXT                  | 轉帳目標帳戶（轉帳類型專用）            |
| created_at             | INTEGER               | Unix ms UTC                             |
| updated_at             | INTEGER               | Unix ms UTC                             |

---

### categories（分類）

| 欄位       | 類型             | 說明                     |
| ---------- | ---------------- | ------------------------ |
| id         | TEXT PK          | UUID                     |
| user_id    | TEXT FK → users |                          |
| name       | TEXT             | 分類名稱                 |
| type       | TEXT             | `income` / `expense` |
| parent_id  | TEXT             | 父分類 ID（樹狀結構）    |
| color      | TEXT             | `#RRGGBB`              |
| icon       | TEXT             | FontAwesome class        |
| sort_order | INTEGER          |                          |
| is_default | INTEGER          | 0/1                      |
| created_at | INTEGER          | Unix ms UTC              |

---

### budgets（預算）

| 欄位        | 類型                  | 說明                     |
| ----------- | --------------------- | ------------------------ |
| id          | TEXT PK               | UUID                     |
| user_id     | TEXT FK → users      |                          |
| category_id | TEXT FK → categories |                          |
| amount      | REAL                  | 預算金額                 |
| period      | TEXT                  | `monthly` / `yearly` |
| year        | INTEGER               | 年份                     |
| month       | INTEGER               | 月份（月預算專用）       |
| created_at  | INTEGER               | Unix ms UTC              |
| updated_at  | INTEGER               | Unix ms UTC              |

---

### recurring（定期交易）

| 欄位        | 類型                  | 說明                                              |
| ----------- | --------------------- | ------------------------------------------------- |
| id          | TEXT PK               | UUID                                              |
| user_id     | TEXT FK → users      |                                                   |
| name        | TEXT                  |                                                   |
| type        | TEXT                  | `income` / `expense` / `transfer`           |
| amount      | REAL                  |                                                   |
| currency    | TEXT                  |                                                   |
| category_id | TEXT FK → categories |                                                   |
| account_id  | TEXT FK → accounts   |                                                   |
| freq        | TEXT                  | `daily` / `weekly` / `monthly` / `yearly` |
| next_date   | TEXT                  | `YYYY-MM-DD`                                    |
| is_active   | INTEGER               | 0/1                                               |
| created_at  | INTEGER               | Unix ms UTC                                       |

---

### stocks（股票持倉）

| 欄位       | 類型                | 說明        |
| ---------- | ------------------- | ----------- |
| id         | TEXT PK             | UUID        |
| user_id    | TEXT FK → users    |             |
| symbol     | TEXT                | 股票代號    |
| name       | TEXT                | 股票名稱    |
| shares     | REAL                | 持有股數    |
| avg_cost   | REAL                | 平均成本    |
| currency   | TEXT                |             |
| account_id | TEXT FK → accounts | 關聯帳戶    |
| created_at | INTEGER             | Unix ms UTC |
| updated_at | INTEGER             | Unix ms UTC |

---

### stock_transactions（股票交易記錄）

| 欄位       | 類型              | 說明               |
| ---------- | ----------------- | ------------------ |
| id         | TEXT PK           | UUID               |
| user_id    | TEXT FK → users  |                    |
| stock_id   | TEXT FK → stocks |                    |
| type       | TEXT              | `buy` / `sell` |
| shares     | REAL              |                    |
| price      | REAL              | 每股價格           |
| date       | TEXT              | `YYYY-MM-DD`     |
| note       | TEXT              |                    |
| created_at | INTEGER           | Unix ms UTC        |

---

### stock_dividends（股息記錄）

| 欄位       | 類型              | 說明           |
| ---------- | ----------------- | -------------- |
| id         | TEXT PK           | UUID           |
| user_id    | TEXT FK → users  |                |
| stock_id   | TEXT FK → stocks |                |
| amount     | REAL              | 股息金額       |
| date       | TEXT              | `YYYY-MM-DD` |
| note       | TEXT              |                |
| created_at | INTEGER           | Unix ms UTC    |

---

### system_settings（系統設定）

單一列（`id = 1`），包含：公開註冊開關、允許註冊 Email 清單、管理員 IP 白名單、報表排程設定、稽核日誌保留天數等。

---

### login_audit_logs / login_attempt_logs（登入稽核）

記錄使用者登入成功/失敗事件，包含 IP、國家、時間戳。

---

## Next.js 資料存取層設計

```
API Route (app/api/*/route.js)
  │
  ├── getDB()                    ← lib/db.js（全域單例）
  │     └── globalThis.__sqlDb  ← sql.js Database 實例
  │
  ├── verifyAuth(request)        ← lib/auth.js
  │     └── jwt.verify(cookie)
  │
  └── 直接執行 db.prepare().get/all/run()
        ↕
      [記憶體中的 SQLite]
        ↕ saveDB() 觸發
      database.db（磁碟）
```

**無 ORM**：維持現有直接 SQL 查詢方式，不引入 Prisma、Drizzle 等 ORM（遵循 Principle V）。

---

## 時區處理規則（憲章 Principle IV）

1. 所有 `*_at` 時間戳以 ISO 8601 UTC 字串儲存
2. API 回應中的時間戳格式：`YYYY-MM-DDTHH:mm:ss.sssZ`
3. 「今日」判斷依據 `users.timezone`（IANA 識別字，預設 `Asia/Taipei`）
4. TWSE 市場時間例外：鎖定 `Asia/Taipei`（FR-014 例外條款）
