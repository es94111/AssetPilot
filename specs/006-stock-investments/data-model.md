# Phase 1 資料模型：股票投資（Stock Investments）

**Branch**: `006-stock-investments` | **Date**: 2026-04-26 | **Plan**: [plan.md](./plan.md)

本檔記錄本功能對 `database.db`（sql.js）的 schema 變更。本功能**不新增任何表**、**不變更既有表結構**（僅以 ALTER TABLE 冪等補 3 個欄位 + 1 個 partial unique index）、**不引入任何新 npm 套件**。所有 schema 變更於 `initDatabase()` 啟動冪等執行（同 002 / 003 / 004 / 005 模式）。

---

## 1. 既有 5 張股票相關表（不變更）

baseline 已建立的 5 張表保留原有結構，本功能不變更 column / type / default：

| 表 | 用途 | 不變欄位 |
|---|---|---|
| `stocks` | 持股主檔（per-user） | id / user_id / symbol / name / current_price / updated_at / stock_type |
| `stock_transactions` | 買賣紀錄 | id / user_id / stock_id / date / type / shares / price / fee / tax / account_id / note / created_at |
| `stock_dividends` | 股利紀錄 | id / user_id / stock_id / date / cash_dividend / stock_dividend_shares / account_id / note / created_at |
| `stock_settings` | per-user 費率 | user_id / fee_rate / fee_discount / fee_min_lot / fee_min_odd / sell_tax_rate_stock / sell_tax_rate_etf / sell_tax_rate_warrant / sell_tax_min / updated_at |
| `stock_recurring` | 定期定額排程 | id / user_id / stock_id / amount / frequency / start_date / account_id / note / is_active / last_generated / created_at |

---

## 2. ALTER TABLE 變更（冪等補欄位）

### 2.1 `stocks.delisted`

```sql
ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0;
```

- **語意**：使用者於批次更新股價 Modal 手動標記的下市旗標（Pass 1 Q2）。
- **預設值**：`0`（false）；既有所有 row 自動以 0 填入。
- **影響範圍**：所有 TWSE 查價路徑（`updateUserStockPrices()`、`/api/stocks/batch-price`、交易 / 股利 Modal 自動回填、`processStockRecurring()`）皆於進入 TWSE 請求前 `if (stock.delisted) skip`。
- **冪等性**：以 `try/catch` 包覆 ALTER TABLE（同既有 `stock_type` 升級 pattern，server.js:893-895）；欄位已存在則靜默忽略。

### 2.2 `stock_transactions.recurring_plan_id` + `period_start_date`

```sql
ALTER TABLE stock_transactions ADD COLUMN recurring_plan_id TEXT;
ALTER TABLE stock_transactions ADD COLUMN period_start_date TEXT;
```

- **語意**：定期定額觸發產生的交易紀錄帶上來源排程 id 與排程期起始日（YYYY-MM-DD）；手動建立的交易此兩欄為 `NULL`。
- **預設值**：`NULL`（兩欄）；既有所有 row 自動以 NULL 填入，向後兼容。
- **用途**：與下方 partial unique index 配合提供 idempotency 保證（多裝置同時登入觸發排程不會重複扣款）。
- **冪等性**：try/catch 包覆。

### 2.3 `stock_transactions.tax_auto_calculated`

```sql
ALTER TABLE stock_transactions ADD COLUMN tax_auto_calculated INTEGER DEFAULT 1;
```

- **語意**：標示證交稅 `tax` 欄位是「系統依 FR-012 公式自動計算」（值 = 1）或「使用者手動覆寫」（值 = 0）；用於 FR-001 末段「修改持股類型 MUST 觸發該檔所有未實現 / 已實現損益重算」的稅額重算範圍判定（U1 / S1 補強）。
- **預設值**：`1`（自動計算）；既有所有 row 自動以 1 填入，向後兼容（baseline 既有交易若 tax 為手動輸入，理論上會被誤判為「自動」並於下次 stockType 修改時被覆寫；此 edge case 視為可接受，因為 baseline 階段尚無 stockType 修改入口，沒有實際觸發路徑）。
- **寫入規則**：
  - `POST /api/stock-transactions`：req.body 顯式提供 `tax` → `tax_auto_calculated = 0`；省略 `tax` 由系統計算 → `tax_auto_calculated = 1`。
  - `PUT /api/stock-transactions/{id}`：同上規則重新判定。
  - 股票股利合成 $0 交易：`tax_auto_calculated = 1`（系統強制 0，後續類型修改無實際影響因 buy 不課稅）。
- **重算範圍**：FR-001 末段觸發重算時，僅 `tax_auto_calculated = 1` 的歷史 sell 交易 tax 會被覆寫為新稅率值；`tax_auto_calculated = 0` 的手動覆寫值保留不動。
- **冪等性**：try/catch 包覆 ALTER TABLE。

### 2.4 partial unique index — 排程 idempotency

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_tx_recurring_idem
ON stock_transactions (user_id, recurring_plan_id, period_start_date)
WHERE recurring_plan_id IS NOT NULL AND period_start_date IS NOT NULL;
```

- **語意**：對「來自定期定額排程」的交易紀錄，同 `(user_id, recurring_plan_id, period_start_date)` 三元組僅允許一筆。
- **WHERE 子句**：partial index 僅當兩欄皆非 NULL 時生效；不影響手動建立的交易（兩欄為 NULL）— SQLite / sql.js 支援 `CREATE UNIQUE INDEX … WHERE …` 語法。
- **race 行為**：多裝置同時登入觸發 `processStockRecurring()` 時，後到的 `INSERT OR IGNORE` 會因 unique constraint 安靜跳過；每筆排程的每期最多寫入一筆交易（Pass 3 Q5）。
- **冪等性**：`CREATE UNIQUE INDEX IF NOT EXISTS` 語法本身冪等。

---

## 3. 既有表的「新行為」（無 schema 變更）

下列行為改變不需 schema 變更，但於語意層補強：

### 3.1 股票股利合成 $0 交易紀錄

`stock_dividends` 寫入時若 `stock_dividend_shares > 0`，同 transaction 內額外 INSERT 一筆 `stock_transactions`：
```js
// stock_dividends 寫入後立即執行
if (stockDividendShares > 0) {
  db.run(
    "INSERT INTO stock_transactions (id, user_id, stock_id, date, type, shares, price, fee, tax, account_id, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [uid(), userId, stockId, date, 'buy', stockDividendShares, 0, 0, 0, null, '股票股利配發 | ' + (note || ''), Date.now()]
  );
}
```

- **辨識**：以 `(stock_id, date, price=0, note LIKE '%股票股利配發%')` 四元組辨識，刪除股利時連動刪除（精確匹配，不誤刪人工 $0 交易）。
- **FIFO**：自然進入 lots 佇列為 $0 cost lot；後續賣出時依 FIFO 順序扣除（早於該日的買入先扣），對應 spec Pass 1 Q1（股票股利不計入取得成本）。
- **type 列舉**：使用既有 `'buy'`，**不**新增 `'dividend_share'` 列舉值（避免 ALTER CHECK 約束 — sql.js 不支援 DROP CONSTRAINT，需 rebuild table）。

### 3.2 純股票股利不寫入 `transactions` 餘額表

baseline 透過 `accountId` 寫入 `transactions` 帳戶交易增加帳戶餘額；本計畫補：
- `cash_dividend > 0` → 照舊寫入 `transactions`（帳戶餘額增加）。
- `cash_dividend === 0 && stock_dividend_shares > 0` → **不**寫入 `transactions`（純股票股利無 cash flow，Pass 2 Q2）；`stock_dividends.account_id` 允許 NULL。

### 3.3 刪除股利連動處理

`DELETE /api/stock-dividends/:id`：
1. 讀取要刪除的股利 row（含 `stock_id` / `date` / `cash_dividend` / `stock_dividend_shares` / `account_id` / `note`）。
2. 若 `stock_dividend_shares > 0`：
   ```sql
   DELETE FROM stock_transactions
   WHERE user_id = ? AND stock_id = ? AND date = ?
     AND price = 0 AND type = 'buy'
     AND note LIKE '%股票股利配發%'
     AND ABS(shares - ?) < 0.001
   ```
3. 若 `cash_dividend > 0` 且 `account_id`：
   - 找出 baseline 寫入的對應 `transactions` 紀錄（依 `account_id` + `date` + 金額 + note 含「股利」關鍵字）並刪除。
   - 帳戶餘額由動態計算自然反映（FR-002）。
4. 最後 `DELETE FROM stock_dividends WHERE id = ?` + `saveDB()`。

---

## 4. 既有資料一致性檢查（migration 驗證）

`initDatabase()` 在 ALTER TABLE 後執行下列驗證 query，若失敗則 log warn 但不中斷啟動（與既有 002 / 003 / 004 一致）：

### 4.1 `stocks.delisted` 預設值驗證

```sql
SELECT COUNT(*) FROM stocks WHERE delisted IS NULL;
```
預期 = 0；非 0 表示 ALTER 未生效或既有 row 未補預設值（極罕見，sqlite ALTER TABLE ADD COLUMN 會自動填 default）。

### 4.2 partial unique index 存在性

```sql
SELECT name FROM sqlite_master WHERE type='index' AND name='idx_stock_tx_recurring_idem';
```
預期返回 1 row；否則 log warn「partial unique index 未建立成功」。

---

## 5. Schema 變更摘要

| 項目 | 影響表 | 影響欄位 / 索引 | 風險 |
|---|---|---|---|
| 1 | `stocks` | `+delisted INTEGER DEFAULT 0` | 低（純新增、有預設） |
| 2 | `stock_transactions` | `+recurring_plan_id TEXT, +period_start_date TEXT` | 低（純新增、預設 NULL） |
| 3 | `stock_transactions` | `+tax_auto_calculated INTEGER DEFAULT 1` | 低（純新增、有預設；既有 row 視為自動計算，於下次 stockType 修改時可能覆寫） |
| 4 | `stock_transactions` | `+UNIQUE INDEX idx_stock_tx_recurring_idem` | 低（partial、僅對排程交易生效） |

**總計**：4 個 ALTER + 1 個 CREATE INDEX，**0 個新表**，**0 個刪除欄位**，**0 個變更既有欄位 type/default**。

backward compatibility 100% — 既有 stock 相關 API（`/api/stocks` GET、`/api/stock-transactions` POST 等）在不傳新欄位時行為完全等價於 baseline。
