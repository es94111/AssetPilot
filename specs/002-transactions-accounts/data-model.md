# 資料模型：交易與帳戶

**Branch**：`002-transactions-accounts` ｜ **Date**：2026-04-25
**Scope**：本文件描述本功能涉及之 SQLite 資料表（透過 sql.js 執行）
schema、欄位語意、索引、狀態流與既有資料庫的 migration 步驟。

---

## §1 實體總覽（Key Entities）

| 實體 | 對應資料表 | 是否新增 | 簡述 |
| --- | --- | --- | --- |
| Account | `accounts` | 既有（補欄位） | 資金容器；一對多 transactions |
| Transaction | `transactions` | 既有（補欄位、改型別） | 資金流向事件 |
| ExchangeRate | `exchange_rates` | 既有（schema 重構） | 跨使用者共用匯率快取 |
| UserSettings | `user_settings` | **本功能新增** | 使用者偏好（pinned currencies） |
| Category | `categories` | 既有（不動） | 由 001 建立、本功能僅引用 |

外鍵關係（邏輯層；sql.js 不啟用 FK 強制）：

```text
users (id)
  ├── accounts (user_id)
  │     └── transactions (account_id)
  │           └── transactions (to_account_id)        ← transfer_in 用
  ├── transactions (user_id)                          ← 直接歸屬於使用者
  ├── user_settings (user_id, PK)
  └── categories (user_id)
        └── transactions (category_id)
```

---

## §2 資料表 schema

### 2.1 `accounts`（帳戶）

**最終 schema（migration 後）**：

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT PRIMARY KEY,                       -- UUID v4
  user_id            TEXT NOT NULL,                          -- FK → users.id
  name               TEXT NOT NULL,                          -- 允許同名（FR-001）
  category           TEXT NOT NULL DEFAULT 'cash',           -- enum: bank|credit_card|cash|virtual_wallet
  initial_balance    INTEGER NOT NULL DEFAULT 0,             -- 幣別最小單位整數（FR-022a）
  currency           TEXT NOT NULL DEFAULT 'TWD',            -- ISO 4217 三字母（FR-020a）
  icon               TEXT NOT NULL DEFAULT 'fa-wallet',      -- FontAwesome class
  exclude_from_total INTEGER NOT NULL DEFAULT 0,             -- 0/1（FR-004）
  linked_bank_id     TEXT DEFAULT NULL,                      -- 信用卡 → 還款銀行 accounts.id
  overseas_fee_rate  INTEGER DEFAULT NULL,                   -- 千分點整數（150 = 1.5%）；僅 credit_card 使用
  created_at         INTEGER NOT NULL,                       -- epoch ms（UTC）
  updated_at         INTEGER NOT NULL                        -- epoch ms；樂觀鎖比對用（FR-014a）
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_category ON accounts(user_id, category);
```

**欄位驗證規則**：

| 欄位 | 規則 |
| --- | --- |
| `name` | 必填、`trim()` 後長度 1~64；同 user 允許同名（FR-001 Clarification） |
| `category` | 必為 `bank`/`credit_card`/`cash`/`virtual_wallet` 其一；其他值回 `400` |
| `initial_balance` | 整數；範圍 -2^53 ~ 2^53；負值合法（FR-001） |
| `currency` | 必為三大寫字母 ISO 4217；後端不做白名單但須通過 `/^[A-Z]{3}$/`（FR-020a） |
| `exclude_from_total` | 必為 `0` 或 `1` |
| `linked_bank_id` | 僅當 `category = 'credit_card'` 時可填；填值時必須對應同 user 的 `bank` 帳戶 |
| `overseas_fee_rate` | 僅當 `category = 'credit_card'` 時可填；範圍 0~1000（即 0~10.00%）；NULL = 採全域預設 1.5% (FR-021) |

**狀態流**：帳戶為純 CRUD，無生命週期狀態；唯一限制是「已被任一
transaction 引用時禁止刪除（FR-006）、禁止改 currency（FR-005）」。

---

### 2.2 `transactions`（交易）

**最終 schema（migration 後）**：

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id                  TEXT PRIMARY KEY,                      -- UUID v4
  user_id             TEXT NOT NULL,                         -- FK → users.id
  account_id          TEXT NOT NULL,                         -- FK → accounts.id（資金來源）
  to_account_id       TEXT DEFAULT NULL,                     -- 僅 transfer_in 填；FK → accounts.id
  type                TEXT NOT NULL,                         -- enum: income|expense|transfer_out|transfer_in
  amount              INTEGER NOT NULL,                      -- 原幣最小單位整數（FR-022a）
  currency            TEXT NOT NULL DEFAULT 'TWD',           -- ISO 4217；通常 = 帳戶 currency
  fx_rate             TEXT NOT NULL DEFAULT '1',             -- decimal 字串；TWD 時為 '1'
  fx_fee              INTEGER NOT NULL DEFAULT 0,            -- TWD 元（FR-021）
  twd_amount          INTEGER NOT NULL,                      -- = round(amount × fx_rate + fx_fee)；TWD 元
  date                TEXT NOT NULL,                         -- 'YYYY-MM-DD'（Asia/Taipei；FR-013）
  category_id         TEXT DEFAULT NULL,                     -- FK → categories.id；transfer 兩列填 NULL
  note                TEXT NOT NULL DEFAULT '',              -- 上限 200 字（FR-011）
  exclude_from_stats  INTEGER NOT NULL DEFAULT 0,            -- 0/1（FR-017）
  linked_id           TEXT NOT NULL DEFAULT '',              -- 轉帳對的另一半 transactions.id
  created_at          INTEGER NOT NULL,                      -- epoch ms（UTC）
  updated_at          INTEGER NOT NULL                       -- epoch ms；樂觀鎖（FR-014a）
);

CREATE INDEX IF NOT EXISTS idx_tx_user_date  ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_acct  ON transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_type  ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_tx_linked     ON transactions(linked_id) WHERE linked_id != '';
CREATE INDEX IF NOT EXISTS idx_tx_user_cat   ON transactions(user_id, category_id);
```

**欄位驗證規則**：

| 欄位 | 規則 |
| --- | --- |
| `account_id` | 必須屬於 `req.userId`（IDOR 防線，FR-060） |
| `to_account_id` | 僅 `type = 'transfer_in'` 時填；必須屬於同 user；轉帳兩半 currency 必須相同（FR-015） |
| `type` | 四選一；`transfer_out`／`transfer_in` 必成對出現（共享 `linked_id`） |
| `amount` | 整數 > 0（FR-011，禁 0 與負）；單位為幣別最小單位 |
| `currency` | 三大寫字母；建立時須等於 account.currency（除非 type 屬 income/expense 且使用者主動切幣別） |
| `fx_rate` | decimal 字串；TWD 時必為 `'1'`；非 TWD 時必為合法 decimal 至少 8 位小數 |
| `fx_fee` | TWD 元整數，≥ 0；TWD 交易時必為 `0` |
| `twd_amount` | 後端計算後寫入；不接受前端覆寫；公式 `Decimal(amount).times(fx_rate).plus(fx_fee).toDecimalPlaces(0, ROUND_HALF_UP).toNumber()` |
| `date` | `/^\d{4}-\d{2}-\d{2}$/`；後端驗證 `Date.parse(...) > 0`；不設上下限（FR-013） |
| `note` | `trim()` 後 ≤ 200 字元；HTML escape 由前端處理 |
| `exclude_from_stats` | 0/1 |
| `linked_id` | `transfer_*` 必填、其他 type 必為 `''`（空字串，沿用 001 風格不用 NULL） |

**狀態流**：

```text
[create] ──> active ──[delete]──> (硬刪除，FR-014)
                │
                └──[edit]──> active'   （updated_at 變更；不保留歷史）
```

`transfer_out` ↔ `transfer_in` 為 1:1 鏡像；任一被刪除，另一半同
transaction 內被刪（`DELETE FROM transactions WHERE linked_id = ?
OR id = ?`）。

---

### 2.3 `exchange_rates`（匯率快取）

**最終 schema**：

```sql
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency           TEXT PRIMARY KEY,                       -- ISO 4217（如 'JPY'）
  rate_to_twd        TEXT NOT NULL,                          -- decimal 字串；'1 currency = X TWD'
  fetched_at         INTEGER NOT NULL,                       -- epoch ms（UTC）
  source             TEXT NOT NULL DEFAULT 'exchangerate-api'
);
```

**migration 重點**：

- 既有 schema 為 `(user_id, currency)` 複合 PK；本功能改為跨使用者
  共用、PK 僅 `currency`。
- 既有資料保留：取每使用者最新的一筆作為共用值（`SELECT currency,
  rate_to_twd, MAX(updated_at) FROM exchange_rates GROUP BY currency`），
  以新 schema 重建表。
- 既有 `rate_to_twd` 為 REAL，新 schema 為 TEXT；轉換時走
  `String(real)`，無精度損失（IEEE-754 double 仍可由 decimal.js
  讀回）。
- 並非每筆查詢都寫 DB：本功能主要使用記憶體 cache（見 research §3.3），
  DB 表僅作為冷啟動暖機 + 永續記錄，於匯率成功取得後 upsert 一筆。

### 2.4 `user_settings`（使用者偏好）

**新增 schema**：

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            TEXT PRIMARY KEY,                       -- FK → users.id
  pinned_currencies  TEXT NOT NULL DEFAULT '["TWD"]',        -- JSON array of ISO 4217
  updated_at         INTEGER NOT NULL                        -- epoch ms
);
```

**欄位語意**：

- `pinned_currencies`：FR-020a。儲存 JSON array 字串。後端讀取時
  `JSON.parse`，寫入時 `JSON.stringify`。長度建議 ≤ 30；後端強制
  ≤ 50（避免 abuse）。
- 預設值 `["TWD"]`：使用者首次開啟設定頁前已固定有 TWD。

**行為**：

- 使用者註冊成功（001 `createDefaultsForUser(userId)`）時 INSERT
  一筆 `(userId, '["TWD"]', Date.now())`。
- `GET /api/user/settings/pinned-currencies` 回應 `{ pinnedCurrencies: ["TWD", "USD"] }`。
- `PUT /api/user/settings/pinned-currencies` body
  `{ pinnedCurrencies: [...], expected_updated_at }`，覆寫整個 list。
- 不對 list 內的幣別代碼做白名單；只要符合 `^[A-Z]{3}$`。

---

### 2.5 `categories`（分類）

由 001-user-permissions `createDefaultsForUser()` 建立；本功能僅引用，
schema **不變**。摘錄關鍵欄位：

```text
id, user_id, name, parent_id, color, icon, sort_order, is_default
```

本功能查詢 `transactions JOIN categories` 時不要求 LEFT/INNER JOIN，
依 `category_id IS NULL`（轉帳）走分支處理。

---

## §3 Migration（v3.x → v4.22+）

### 3.1 流程總覽

```text
[1] 啟動服務 / initDatabase() ──┬─→ 既有 v3 表已存在
                                 │
[2] 偵測欄位／型別差異 ──────────┤
                                 │
[3] 自動備份 database.db.bak.<ts>
                                 │
[4] BEGIN TRANSACTION
   ├─ ALTER TABLE accounts ADD column...      （補欄位）
   ├─ ALTER TABLE transactions ADD column...
   ├─ rebuild table（REAL → INTEGER 須重建）
   ├─ data conversion 同上
   └─ CREATE TABLE user_settings IF NOT EXISTS
[5] COMMIT （任一步驟錯誤 → ROLLBACK + 還原備份檔）

[6] saveDB() 將最新 sql.js 寫回 database.db
```

### 3.2 SQL 步驟（依序執行；皆 `IF NOT EXISTS` / try-catch ignore）

```sql
-- A. accounts 補欄位
ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE accounts ADD COLUMN overseas_fee_rate INTEGER DEFAULT NULL;
ALTER TABLE accounts ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
-- 將既有 account_type 文字（'銀行','現金','信用卡','虛擬'）映射到 enum
UPDATE accounts SET category = CASE account_type
  WHEN '銀行' THEN 'bank'
  WHEN '信用卡' THEN 'credit_card'
  WHEN '現金' THEN 'cash'
  WHEN '虛擬' THEN 'virtual_wallet'
  ELSE 'cash'
END WHERE category IS NULL OR category = 'cash';
-- 注意：account_type 欄位不刪除（向後相容）；新邏輯只讀 category
UPDATE accounts SET updated_at = COALESCE(strftime('%s', created_at) * 1000, 0) WHERE updated_at = 0;

-- B. transactions 補欄位
ALTER TABLE transactions ADD COLUMN to_account_id TEXT DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN twd_amount INTEGER NOT NULL DEFAULT 0;
-- updated_at 既有，僅補預設
UPDATE transactions SET updated_at = COALESCE(updated_at, created_at, 0)
  WHERE updated_at IS NULL OR updated_at = 0;
```

### 3.3 REAL → INTEGER／TEXT 型別 migration

SQLite ALTER TABLE 不支援改欄位型別；採「重建表」模式：

```sql
-- transactions：REAL→INTEGER（amount, original_amount, fx_fee）／REAL→TEXT（fx_rate）
BEGIN;
  CREATE TABLE transactions_new (... 新 schema ...);
  INSERT INTO transactions_new SELECT
    id, user_id, account_id, to_account_id, type,
    CAST(ROUND(amount) AS INTEGER) AS amount,           -- REAL→INTEGER
    currency,
    CAST(fx_rate AS TEXT) AS fx_rate,                   -- REAL→TEXT
    CAST(ROUND(fx_fee) AS INTEGER) AS fx_fee,           -- REAL→INTEGER
    CAST(ROUND(amount * fx_rate + fx_fee) AS INTEGER) AS twd_amount,  -- 計算 twd_amount
    date, category_id, note, exclude_from_stats, linked_id, created_at, updated_at
  FROM transactions;
  DROP TABLE transactions;
  ALTER TABLE transactions_new RENAME TO transactions;
  -- 重建索引
  CREATE INDEX idx_tx_user_date ON transactions(user_id, date DESC);
  CREATE INDEX idx_tx_user_acct ON transactions(user_id, account_id);
  CREATE INDEX idx_tx_user_type ON transactions(user_id, type);
  CREATE INDEX idx_tx_linked    ON transactions(linked_id);
  CREATE INDEX idx_tx_user_cat  ON transactions(user_id, category_id);
COMMIT;

-- accounts：REAL→INTEGER（initial_balance）
BEGIN;
  CREATE TABLE accounts_new (... 新 schema ...);
  INSERT INTO accounts_new SELECT
    id, user_id, name, category,
    CAST(ROUND(initial_balance) AS INTEGER) AS initial_balance,
    currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate,
    COALESCE(strftime('%s', created_at) * 1000,
             (SELECT MIN(created_at) FROM transactions WHERE account_id = accounts.id),
             0) AS created_at,
    updated_at
  FROM accounts;
  DROP TABLE accounts;
  ALTER TABLE accounts_new RENAME TO accounts;
  CREATE INDEX idx_accounts_user ON accounts(user_id);
  CREATE INDEX idx_accounts_user_category ON accounts(user_id, category);
COMMIT;
```

### 3.4 Migration self-test

啟動成功後執行以下檢查（任一失敗 → log error 但不阻擋啟動，便於
開發者人工修復）：

| 檢查 | SQL | 期望結果 |
| --- | --- | --- |
| 所有 amount 為非負整數 | `SELECT COUNT(*) FROM transactions WHERE typeof(amount) != 'integer' OR amount <= 0;` | 0 |
| 所有 fx_rate 為合法 decimal 字串 | （Node 端 `decimal.js` 對每筆 try-catch parse） | 0 失敗 |
| 所有 transfer_out 都有對應 transfer_in | `SELECT id FROM transactions WHERE type = 'transfer_out' AND linked_id NOT IN (SELECT id FROM transactions WHERE type = 'transfer_in');` | 0 列 |
| 每使用者 pinned_currencies 至少含 TWD | Node 端逐筆 `JSON.parse` 檢查 | 全部 `includes('TWD')` |
| accounts.updated_at > 0 | `SELECT COUNT(*) FROM accounts WHERE updated_at <= 0;` | 0 |

### 3.5 回滾計畫

- migration 前自動產生備份：
  `fs.copyFileSync('./database.db', './database.db.bak.' + Date.now())`。
- 若 self-test 失敗或啟動拋例外，提示使用者：

  ```text
  [migration] FAILED at step <N>; rolled back in-memory tx.
  Backup at ./database.db.bak.1714003202000.
  Restore: stop service, cp database.db.bak.<ts> database.db, start service with previous version.
  ```

- migration 失敗不會自動還原檔案（避免覆寫使用者最新狀態）；由維運
  人員依上述指示處理。

---

## §4 Validation Rules（後端 contract）

| 場景 | 驗證點 | 失敗回應 |
| --- | --- | --- |
| 建立帳戶 | name 長度、category enum、currency 格式、overseas_fee_rate 範圍 | 400 + `error: 'ValidationError'` + `field: '<欄位>'` |
| 建立交易 | amount > 0、date 格式、type enum、account 屬於 user、category 屬於 user | 400/404 |
| 編輯帳戶 currency | 不可改（已有 transactions） | 422 + `error: 'CurrencyLocked'` |
| 刪除帳戶 | 無 transactions 引用 | 422 + `error: 'AccountInUse'` + `referenceCount` |
| 跨幣別轉帳 | from.currency === to.currency | 422 + `error: 'CrossCurrencyTransfer'` |
| 樂觀鎖 | expected_updated_at === DB updated_at | 409 + `error: 'OptimisticLockConflict'` + `serverUpdatedAt` |
| IDOR | account.user_id === req.userId | 404 + `error: 'NotFound'`（不洩露） |
| 批次操作筆數 | items.length ≤ 500 | 400 + `error: 'BatchTooLarge'` |
| 批次原子性 | 任一筆失敗 | rollback + 409/422/404（依首筆原因） |
| 自訂每頁筆數 | 1 ≤ pageSize ≤ 500 | 400 + `error: 'PageSizeOutOfRange'` |

---

## §5 索引與查詢計畫

主要 hot-path：

1. **交易列表分頁**：`SELECT ... FROM transactions
   WHERE user_id = ? AND date BETWEEN ? AND ? AND type = ?
   ORDER BY date DESC LIMIT ? OFFSET ?`
   → 走 `idx_tx_user_date`；type 篩選為 secondary filter（百筆級資料
   可接受；萬筆以上若效能不足，後續可加 `idx_tx_user_date_type`
   covering index，本 PR 不必）。

2. **帳戶餘額計算**：`SELECT type, SUM(amount), SUM(twd_amount)
   FROM transactions WHERE user_id = ? AND account_id = ?
   AND date <= ? GROUP BY type`
   → 走 `idx_tx_user_acct`；`date <= ?` 走 SQLite 的 between 範圍掃描。

3. **總資產卡**：與 (2) 類似但去除 `account_id` 條件、外加
   `JOIN accounts ON accounts.exclude_from_total = 0`。

4. **匯率查詢**：`SELECT rate_to_twd FROM exchange_rates WHERE currency = ?`
   → PK 直接命中。

5. **轉帳對查找**：`SELECT * FROM transactions WHERE linked_id = ?
   OR id = ?`
   → 走 `idx_tx_linked`（id 為 PK）。

6. **批次操作授權檢查**：`SELECT id, user_id FROM transactions
   WHERE id IN (?, ?, ..., ?) AND user_id = ?`
   → 走 PK 主索引；500 筆 IN clause 為 sql.js 可接受規模（< 50ms）。
