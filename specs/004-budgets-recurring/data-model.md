# Phase 1 資料模型：預算與固定收支

**Branch**: `004-budgets-recurring` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔記錄本功能對 `database.db`（sql.js）的 schema 變更：表結構（升級後）、索引、唯一性約束、migration 步驟與回滾策略。所有 schema 變更皆於 `initDatabase()` 啟動冪等執行（同 002 / 003 模式）。

---

## 1. 升級後表結構

### 1.1 `budgets`（migration：REAL → INTEGER）

```sql
CREATE TABLE IF NOT EXISTS budgets (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  category_id TEXT,                                -- NULL 代表「整月總支出預算」
  amount      INTEGER NOT NULL,                    -- 本幣（TWD）正整數，FR-003
  year_month  TEXT    NOT NULL,                    -- 'YYYY-MM' 格式
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_budgets_unique_cat
  ON budgets(user_id, year_month, category_id)
  WHERE category_id IS NOT NULL;                   -- FR-002 同月同分類唯一性
CREATE UNIQUE INDEX idx_budgets_unique_total
  ON budgets(user_id, year_month)
  WHERE category_id IS NULL;                       -- FR-002 同月「整月總」唯一性
CREATE INDEX idx_budgets_user_month
  ON budgets(user_id, year_month);                 -- GET /api/budgets?yearMonth= 加速
```

| 欄位 | 規格對應 | 備註 |
| --- | --- | --- |
| `id` | — | UUID 字串（沿用 `uid()`） |
| `user_id` | FR-002 | 多租戶 scoping |
| `category_id` | FR-001, FR-004 | NULL = 整月總；非 NULL = 必為子分類（leaf-only，於 POST handler 驗證 `parent_id != ''`） |
| `amount` | FR-003 | INTEGER；< 1 拒絕 |
| `year_month` | FR-007, FR-009a | 任意 YYYY-MM；不限制範圍 |
| `created_at` / `updated_at` | — | epoch ms；002 既有慣例 |

### 1.2 `recurring`（migration：REAL → INTEGER／TEXT、+2 欄）

```sql
CREATE TABLE IF NOT EXISTS recurring (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL,
  type             TEXT    NOT NULL,               -- 'income' | 'expense'，建立後不可變
  amount           INTEGER NOT NULL,               -- 本幣（TWD）正整數
  category_id      TEXT,
  account_id       TEXT,
  frequency        TEXT    NOT NULL,               -- 'daily'|'weekly'|'monthly'|'yearly'
  start_date       TEXT    NOT NULL,               -- 'YYYY-MM-DD'
  note             TEXT    NOT NULL DEFAULT '',
  is_active        INTEGER NOT NULL DEFAULT 1,
  last_generated   TEXT,                           -- 'YYYY-MM-DD' 或 NULL
  currency         TEXT    NOT NULL DEFAULT 'TWD',
  fx_rate          TEXT    NOT NULL DEFAULT '1',   -- decimal 字串（002 慣例）
  needs_attention  INTEGER NOT NULL DEFAULT 0,     -- FR-024：分類/帳戶被刪自動置 1
  updated_at       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_recurring_user_active
  ON recurring(user_id, is_active);                -- 產生流程主 query
CREATE INDEX idx_recurring_user_attn
  ON recurring(user_id, needs_attention);          -- 列表頁需處理篩選
```

| 欄位 | 規格對應 | 備註 |
| --- | --- | --- |
| `type` | FR-011 | 建立後不可變（與 003 對 categories.type 對稱） |
| `amount` | FR-011, FR-016 | INTEGER（TWD）；外幣以 `convertToTwd` 折算後存 |
| `frequency` | FR-011, FR-022 | 四值列舉；月底回退由 `getNextRecurringDate` 處理 |
| `start_date` | FR-014, FR-021a | YYYY-MM-DD；編輯此欄會觸發 `last_generated = NULL` |
| `last_generated` | FR-013, FR-015, FR-021a/b, FR-029 | 條件式更新，only-if-newer |
| `currency` / `fx_rate` | FR-016 | `fx_rate` TEXT decimal 字串；產生衍生交易時帶入 |
| `needs_attention` | FR-024, FR-024a, FR-024b | 0/1；FR-024 偵測；FR-024b 編輯儲存清除 |

### 1.3 `transactions`（ALTER：+2 欄、+2 索引）

```sql
-- 新增欄位（002 重建後表已存在，僅 ALTER）
ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT NULL;

-- 並發冪等保護（FR-028）
CREATE UNIQUE INDEX idx_tx_source_scheduled
  ON transactions(source_recurring_id, scheduled_date)
  WHERE source_recurring_id IS NOT NULL;

-- 反查加速（FR-025/027 來源 chip 顯示與 LEFT JOIN）
CREATE INDEX idx_tx_source ON transactions(source_recurring_id);
```

| 欄位 | 規格對應 | 備註 |
| --- | --- | --- |
| `source_recurring_id` | FR-025, FR-027 | NULL 表示「非配方產出之一般交易」；非 NULL 但 LEFT JOIN 為 NULL 表示「來源配方已刪除」 |
| `scheduled_date` | FR-028, Key Entities | 該筆衍生交易應產生的日期（與 `date` 欄位通常相同；分離欄位是為了未來擴充「延後產出」用） |

---

## 2. 衍生資料：`DashboardBudgetProgress`

非 SQL 表，由 `GET /api/budgets?yearMonth=YYYY-MM` 即時計算：

```javascript
const used = queryOne(`
  SELECT COALESCE(SUM(twd_amount), 0) AS used
  FROM transactions
  WHERE user_id = ? AND type = 'expense'
    AND date LIKE ?
    AND exclude_from_stats = 0
    ${b.category_id ? 'AND category_id = ?' : ''}
`, b.category_id ? [userId, b.year_month + '%', b.category_id] : [userId, b.year_month + '%'])?.used || 0;
```

回應整形（前端可即時計算 `pct` 並決定配色 class）：

```json
{
  "id": "bgt_xyz",
  "categoryId": "cat_abc",
  "yearMonth": "2026-04",
  "amount": 3000,
  "used": 2400,
  "createdAt": 1714000000000,
  "updatedAt": 1714000000000
}
```

---

## 3. Migration 步驟（initDatabase 啟動執行）

### 3.1 `transactions` ALTER

```javascript
try { db.run("ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
try { db.run("ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_source_scheduled
  ON transactions(source_recurring_id, scheduled_date)
  WHERE source_recurring_id IS NOT NULL`);
db.run("CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(source_recurring_id)");
```

冪等：`ALTER` 對已存在欄位拋錯被 catch；`CREATE INDEX IF NOT EXISTS` 內建冪等。

### 3.2 `budgets` REAL → INTEGER 重建（沿用 002 模式）

```javascript
const budgetAmtInfo = queryOne("SELECT typeof(amount) AS t FROM budgets LIMIT 1");
const needsBudgetRebuild = budgetAmtInfo && String(budgetAmtInfo.t).toLowerCase() === 'real';
if (needsBudgetRebuild) {
  console.log('[migration 004] 重建 budgets 表（REAL → INTEGER）');
  // 自動備份
  fs.copyFileSync(DB_FILE, `${DB_FILE}.bak.${Date.now()}.before-004`);
  db.run('BEGIN');
  try {
    db.run(`CREATE TABLE budgets_new (
      id          TEXT    PRIMARY KEY,
      user_id     TEXT    NOT NULL,
      category_id TEXT,
      amount      INTEGER NOT NULL,
      year_month  TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT 0,
      updated_at  INTEGER NOT NULL DEFAULT 0
    )`);
    db.run(`INSERT INTO budgets_new (id, user_id, category_id, amount, year_month, created_at, updated_at)
            SELECT id, user_id, category_id,
                   CAST(ROUND(COALESCE(amount, 0)) AS INTEGER),
                   year_month,
                   ?, ?
            FROM budgets`, [Date.now(), Date.now()]);
    db.run("DROP TABLE budgets");
    db.run("ALTER TABLE budgets_new RENAME TO budgets");
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

// 唯一性與索引（rebuild 後重建；既有 budgets 也補建）
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_cat
  ON budgets(user_id, year_month, category_id) WHERE category_id IS NOT NULL`);
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_total
  ON budgets(user_id, year_month) WHERE category_id IS NULL`);
db.run(`CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, year_month)`);
```

### 3.3 `recurring` REAL → INTEGER／TEXT 重建 + 補欄位

```javascript
const recAmtInfo = queryOne("SELECT typeof(amount) AS t FROM recurring LIMIT 1");
const recFxInfo = queryOne("SELECT typeof(fx_rate) AS t FROM recurring LIMIT 1");
const needsRecRebuild = (recAmtInfo && String(recAmtInfo.t).toLowerCase() === 'real')
                     || (recFxInfo && String(recFxInfo.t).toLowerCase() === 'real');
if (needsRecRebuild) {
  console.log('[migration 004] 重建 recurring 表（REAL → INTEGER/TEXT + 補欄位）');
  fs.copyFileSync(DB_FILE, `${DB_FILE}.bak.${Date.now()}.before-004-rec`);
  db.run('BEGIN');
  try {
    db.run(`CREATE TABLE recurring_new (
      id               TEXT    PRIMARY KEY,
      user_id          TEXT    NOT NULL,
      type             TEXT    NOT NULL,
      amount           INTEGER NOT NULL,
      category_id      TEXT,
      account_id       TEXT,
      frequency        TEXT    NOT NULL,
      start_date       TEXT    NOT NULL,
      note             TEXT    NOT NULL DEFAULT '',
      is_active        INTEGER NOT NULL DEFAULT 1,
      last_generated   TEXT,
      currency         TEXT    NOT NULL DEFAULT 'TWD',
      fx_rate          TEXT    NOT NULL DEFAULT '1',
      needs_attention  INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL DEFAULT 0
    )`);
    db.run(`INSERT INTO recurring_new
            (id, user_id, type, amount, category_id, account_id, frequency, start_date, note,
             is_active, last_generated, currency, fx_rate, needs_attention, updated_at)
            SELECT id, user_id, type,
                   CAST(ROUND(COALESCE(amount, 0)) AS INTEGER),
                   category_id, account_id, frequency, start_date, COALESCE(note, ''),
                   COALESCE(is_active, 1), last_generated,
                   COALESCE(currency, 'TWD'),
                   CAST(COALESCE(fx_rate, 1) AS TEXT),
                   0,                                      -- needs_attention 全部從 0 起
                   ?
            FROM recurring`, [Date.now()]);
    db.run("DROP TABLE recurring");
    db.run("ALTER TABLE recurring_new RENAME TO recurring");
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
db.run(`CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring(user_id, is_active)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_recurring_user_attn ON recurring(user_id, needs_attention)`);
```

### 3.4 既有衍生交易的 `source_recurring_id` 不回填

升級前透過舊 `/api/recurring/process` 產出的歷史交易：`note` 欄含 ` (自動)` 後綴標記但無 `source_recurring_id`。本計畫**不**回填這些歷史交易（不破壞 FR-021c「不溯及既往」精神，且 ` (自動)` 後綴已足以讓使用者辨識歷史紀錄）。前端對 `source_recurring_id IS NULL` 的衍生交易視同一般交易，不顯示來源 chip。

### 3.5 Self-test

```javascript
const badBudgetAmt = queryOne("SELECT COUNT(*) AS c FROM budgets WHERE typeof(amount) != 'integer' OR amount <= 0")?.c || 0;
if (badBudgetAmt > 0) console.warn(`[migration 004] self-test fail: ${badBudgetAmt} 筆 budgets.amount 非正整數`);
const badRecAmt = queryOne("SELECT COUNT(*) AS c FROM recurring WHERE typeof(amount) != 'integer' OR amount <= 0")?.c || 0;
if (badRecAmt > 0) console.warn(`[migration 004] self-test fail: ${badRecAmt} 筆 recurring.amount 非正整數`);
const badFxRate = queryOne("SELECT COUNT(*) AS c FROM recurring WHERE typeof(fx_rate) != 'text'")?.c || 0;
if (badFxRate > 0) console.warn(`[migration 004] self-test fail: ${badFxRate} 筆 recurring.fx_rate 非 text`);
```

### 3.6 回滾計畫

每次 rebuild 前自動備份至 `database.db.bak.<timestamp>.before-004` / `before-004-rec`。若啟動失敗：

1. 停止服務（`docker compose stop` 或 `pm2 stop`）。
2. `cp database.db.bak.<timestamp>.before-004 database.db`。
3. revert 本 PR 至 003 commit 並重啟。

歷史備份保留 7 天後可手動清除（沿用 002 / 003 約定）。

---

## 4. 關聯與整合性

| 來源表 | 關聯 | 說明 |
| --- | --- | --- |
| `budgets.category_id` → `categories.id` | nullable FK（無 SQL 約束，應用層 `assertOwned` 驗證） | NULL = 整月總；leaf-only（FR-004） |
| `recurring.category_id` → `categories.id` | nullable FK | 被刪除時觸發 `needs_attention = 1`（FR-024） |
| `recurring.account_id` → `accounts.id` | nullable FK | 被刪除時觸發 `needs_attention = 1`（FR-024） |
| `transactions.source_recurring_id` → `recurring.id` | nullable FK（partial unique 與 `scheduled_date`） | LEFT JOIN 為 NULL 即顯示「來源配方已刪除」（FR-027） |

**無 ON DELETE CASCADE**：sql.js 預設不啟用 FK；本計畫一律走應用層驗證以保留 003 既有的「刪分類前先驗證無交易」嚴格行為（避免 cascade 誤刪歷史紀錄）。

---

## 5. 狀態機

### 5.1 RecurringTransaction 狀態流轉

```
建立 (is_active=1, needs_attention=0)
        │
        ├──► toggle ──► is_active=0（停用，產生流程跳過）
        │                     │
        │                     └─► toggle ──► is_active=1
        │
        ├──► 分類/帳戶被刪 ──► is_active=1, needs_attention=1
        │                              │
        │                              └─► 編輯改選有效項並儲存 ──► needs_attention=0
        │                                  （產生流程下次登入恢復）
        │
        └──► 刪除 ──► 紀錄消失；歷史衍生交易保留
```

### 5.2 Budget 狀態流轉

預算為「無狀態」資料：建立、編輯（金額）、刪除三個操作；無啟用／停用、無凍結；歷史月份預算 `used` 即時重算（FR-007）。

---

## 6. 索引設計總結

| 索引 | 目的 | 預期 query |
| --- | --- | --- |
| `idx_budgets_unique_cat` | FR-002 同月同分類唯一性 | INSERT 時 sql 自動驗 |
| `idx_budgets_unique_total` | FR-002 同月「整月總」唯一性 | 同上 |
| `idx_budgets_user_month` | `GET /api/budgets?yearMonth=` | `WHERE user_id = ? AND year_month = ?` |
| `idx_recurring_user_active` | `processRecurringForUser` 主 query | `WHERE user_id = ? AND is_active = 1` |
| `idx_recurring_user_attn` | 列表頁需處理篩選（前端篩選；非必須索引） | `WHERE user_id = ? AND needs_attention = 1` |
| `idx_tx_source_scheduled` | FR-028 並發冪等保護（partial unique） | `INSERT INTO transactions ... (source_recurring_id, scheduled_date)` 時 sql 自動驗 |
| `idx_tx_source` | FR-025 LEFT JOIN 與來源反查 | `LEFT JOIN recurring ON r.id = t.source_recurring_id` |

---

## 7. 容量估算（百人級使用者）

| 表／索引 | 筆數估算 | 大小估算 |
| --- | --- | --- |
| `budgets` | 100 user × 12 月 × 16 預算 ≈ 20K 筆 | < 2 MB |
| `recurring` | 100 user × 30 配方 ≈ 3K 筆 | < 1 MB |
| `transactions` 衍生子集合 | 100 user × 30 配方 × 12 月 ≈ 36K 筆／年 | < 10 MB／年（隨總交易表一同成長） |
| `idx_tx_source_scheduled` | 等同上述衍生子集合 | partial index，僅覆蓋有 `source_recurring_id` 的行 |

sql.js 記憶體模型在這個量級完全無壓力（既有 transactions 全表已 > 100K 筆量級的部署仍順暢）。

---

詳細的 endpoint 行為見 [contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml)；驗證流程見 [quickstart.md](./quickstart.md)。
