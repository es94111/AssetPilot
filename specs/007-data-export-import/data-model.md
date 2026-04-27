# 資料模型：資料匯出匯入（Data Export / Import）

**Branch**: `007-data-export-import` | **Date**: 2026-04-27
**對應**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)

## 0. 摘要

本功能對 schema 的影響極小：
- **新增 1 張表**：`data_operation_audit_log`（稽核日誌）+ 3 個索引。
- **新增 1 張表**：`system_settings`（系統設定 KV；冪等建立，本計畫主要用於 `audit_log_retention_days`）。
- **既有表完全不變更**：`transactions` / `categories` / `accounts` / `stocks` / `stock_transactions` / `stock_dividends` / `exchange_rates` / `users` / `login_audit_logs` 等皆無 ALTER。

**新增記憶體資料結構（不入 DB）**：
- `importLocks: Set<string>` — 每使用者匯入互斥鎖。
- `importProgress: Map<string, ImportProgressEntry>` — 進度回饋（short polling）。

**語彙統一說明**：本檔（含 plan / research / data-model / contract）與 spec 對「分類層級」採同義異稱：
- spec 與 CSV 欄位名為「**上層分類**」（zh-TW 自然用詞）。
- research / data-model / 程式碼識別字使用「**父分類** / `parent_id`」（沿用既有 003-categories 的 DB 欄位名）。
- 三者指**同一概念** — 即 `categories.parent_id` 欄位所表達的「分類樹中的上一層」。閱讀時可自由替換。

**新增檔案系統路徑**：
- `backups/before-restore-{YYYYMMDDHHmmss}.db` — 還原前自動備份。
- `backups/assetpilot-backup-{YYYYMMDDHHmmss}.db` — 管理員下載格式（不存於伺服器，僅響應檔名）。

---

## 1. 新增資料表

### 1.1 `data_operation_audit_log`（稽核日誌）

**對應 FR**：FR-042、FR-043、FR-044、FR-045、FR-046、FR-046a、FR-046b。

**用途**：紀錄所有匯出／匯入／備份／還原操作的行為元資料；不存原始資料。

**Schema**：

```sql
CREATE TABLE IF NOT EXISTS data_operation_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  result TEXT NOT NULL,
  is_admin_operation INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_data_audit_user_time
  ON data_operation_audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_data_audit_time
  ON data_operation_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_data_audit_action
  ON data_operation_audit_log(action);
```

**欄位語意**：

| 欄位 | 型別 | 約束 | 說明 |
|---|---|---|---|
| `id` | TEXT | PK | UUID/ULID（沿用既有 `uid()` helper） |
| `user_id` | TEXT | NOT NULL | 觸發操作的使用者 ID（即使是管理員操作，也記管理員自己的 user_id） |
| `role` | TEXT | NOT NULL | 列舉值：`'user'` 或 `'admin'`（操作當下的角色快照） |
| `action` | TEXT | NOT NULL | 列舉值：見下表「`action` 列舉值」 |
| `ip_address` | TEXT | — | 發起操作的 IP 位址（採 `req.ip` 或 `X-Forwarded-For`，與既有 login_audit_logs 一致） |
| `user_agent` | TEXT | — | HTTP `User-Agent` header；最多 500 字（過長者 truncate） |
| `timestamp` | TEXT | NOT NULL | UTC ISO 8601（含時區 `Z`），如 `2026-04-27T13:25:08.123Z` |
| `result` | TEXT | NOT NULL | 列舉值：`'success'` / `'failed'` / `'rolled_back'` |
| `is_admin_operation` | INTEGER | 0 或 1 | 1 = 管理員專屬操作（`download_backup` / `restore_backup`），0 = 一般使用者亦可呼叫的操作 |
| `metadata` | TEXT | JSON | 包含：`rows`（匯入／匯出筆數）、`byteSize`（檔案位元組數）、`failure_stage`（失敗階段）、`failure_reason`（失敗原因簡述）、`backup_path`（備份檔路徑，用於 restore_backup 紀錄）、`unknown_columns`（被忽略的 CSV 額外欄位）等元資料；**MUST NOT** 包含明文 CSV 內容、密碼、token |

**`action` 列舉值**（FR-043）：

| Action | 端點 | role |
|---|---|---|
| `export_transactions` | `GET /api/transactions/export` | user |
| `import_transactions` | `POST /api/transactions/import` | user |
| `export_categories` | `GET /api/categories/export` | user |
| `import_categories` | `POST /api/categories/import` | user |
| `export_stock_transactions` | `GET /api/stock-transactions/export` | user |
| `import_stock_transactions` | `POST /api/stock-transactions/import` | user |
| `export_stock_dividends` | `GET /api/stock-dividends/export` | user |
| `import_stock_dividends` | `POST /api/stock-dividends/import` | user |
| `download_backup` | `GET /api/database/export` | admin |
| `restore_backup` | `POST /api/database/import` | admin |
| `restore_failed` | `POST /api/database/import`（失敗自動回滾觸發） | admin |

**metadata JSON 規範**（依 action 不同而異）：

```jsonc
// 匯出（export_*）
{ "rows": 1200, "byteSize": 145678, "dateFrom": "2026-01-01", "dateTo": "2026-04-27" }

// 匯入（import_*）成功
{ "rows": 1000, "imported": 950, "skipped": 30, "errors": 20, "warnings": 5,
  "unknown_columns": ["手動分類"] }

// 匯入失敗 rollback
{ "rows": 1000, "result": "failed", "failure_stage": "writing",
  "failure_reason": "DB transaction failed: SQLITE_CONSTRAINT" }

// download_backup
{ "byteSize": 52428800, "filename": "assetpilot-backup-20260427132508.db" }

// restore_backup 成功
{ "byteSize": 52428800, "before_restore_path": "backups/before-restore-20260427132508.db" }

// restore_failed
{ "result": "rolled_back", "failure_stage": "replace_main_db",
  "failure_reason": "EACCES: permission denied",
  "before_restore_path": "backups/before-restore-20260427132508.db" }
```

**Index 設計理由**：
- `(user_id, timestamp DESC)`：最常見的「我的操作紀錄」分頁查詢，user_id 過濾後依時間倒序分頁。
- `(timestamp DESC)`：管理員「全部稽核日誌」分頁查詢，無 user_id 過濾時走此 index。
- `(action)`：管理員依特定 action 過濾（如「只看 download_backup」）。

**保留期限**：依 `system_settings.audit_log_retention_days` 動態決定，預設 90 天；`registerAuditPruneJob()` 每日 tick 時清理超期紀錄；設定為 `'forever'` 時跳過清理（FR-046a）。

---

### 1.2 `system_settings`（系統設定 KV）

**對應 FR**：FR-046a。

**用途**：存放系統級設定（非使用者個人設定），如稽核日誌保留天數。本計畫採 KV 模型，為日後其他系統設定保留擴充空間。

**Schema**：

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES ('audit_log_retention_days', '90', strftime('%s','now') * 1000);
```

**欄位語意**：

| 欄位 | 型別 | 約束 | 說明 |
|---|---|---|---|
| `key` | TEXT | PK | 設定鍵；本計畫使用 `'audit_log_retention_days'` |
| `value` | TEXT | NOT NULL | 設定值；以字串儲存便於日後支援多型別 |
| `updated_at` | INTEGER | — | 最後更新 epoch ms |

**已知 keys**：

| Key | 合法值 | 預設 | 說明 |
|---|---|---|---|
| `audit_log_retention_days` | `'30'` / `'90'` / `'180'` / `'365'` / `'forever'` | `'90'` | 稽核日誌保留天數；`'forever'` 跳過自動清理 |

**讀寫端點**：
- `GET /api/admin/data-audit/retention` → `{ retention_days: '90' }`
- `PUT /api/admin/data-audit/retention` body `{ retention_days: '180' }` → 200

**RBAC**：管理員專屬。

**冪等性**：`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` — 重複啟動不重置設定。

---

## 2. 既有資料表（不變動清單）

下列既有資料表於本功能**完全不變動**（無 ALTER、無新增欄位、無新增 index、無 schema 修改）：

- `users`
- `transactions`（雖然匯入會大量寫入，但 schema 不變）
- `categories`
- `accounts`
- `budgets`
- `recurring`
- `stocks`
- `stock_transactions`
- `stock_dividends`
- `stock_settings`
- `stock_recurring`
- `exchange_rates`（is_manual 欄位 006 已新增，本計畫沿用）
- `exchange_rates_global`（fxCache 共用快取表，005 既有）
- `exchange_rate_settings`
- `passkey_credentials`
- `login_audit_logs`
- `login_attempt_logs`

**為何不對既有表加 unique index**：
- 重複偵測（FR-014、FR-023a）走應用層判定（hash + Set），不依賴 DB unique constraint。
- 加 unique index 屬「動既有 schema」風險：
  - 既有資料若已存在重複（歷史寫入），新增 unique 會失敗。
  - 既有 transactions 表因業務行為允許「同日同類同金額多筆」（如同一天多次飲食消費），unique constraint 設計困難。
- 走應用層判定可由匯入 handler 完全掌握「重複略過」語意，而不影響其他寫入路徑。

---

## 3. 記憶體資料結構（不入 DB）

### 3.1 `importLocks`（匯入互斥鎖）

```typescript
const importLocks: Set<string>; // userId
```

**生命週期**：
- 進入匯入端點開頭呼叫 `acquireImportLock(userId)` → 若已存在則回 409。
- 成功匯入或失敗 rollback 後於 try/finally 呼叫 `releaseImportLock(userId)`。
- Server 重啟自動清空（process exit）。

**為何不持久化**：server crash 時 lock 殘留會永遠卡住該使用者；記憶體清空為自然恢復機制。

### 3.2 `importProgress`（進度回饋）

```typescript
type ImportPhase = 'parsing' | 'validating' | 'writing' | 'pairing' | 'finalizing';

interface ImportProgressEntry {
  processed: number;
  total: number;
  phase: ImportPhase;
  startedAt: number;       // epoch ms
  completedAt: number | null; // null 表示進行中
}

const importProgress: Map<string, ImportProgressEntry>; // userId
```

**生命週期**：
- 匯入開始 → `set(userId, { processed: 0, total: rows.length, phase: 'parsing', startedAt: Date.now(), completedAt: null })`。
- 每處理 500 筆 → `set(userId, { ..., processed, phase })` 更新。
- 完成 → `set(userId, { ..., processed: total, completedAt: Date.now() })` → setTimeout 5 秒後 `delete(userId)`。
- 失敗 rollback → `set(userId, { ..., phase: 'finalizing', completedAt: Date.now() })` + setTimeout 5 秒 delete。

**讀取端點**：`GET /api/imports/progress`
- 若 `importProgress.has(userId)` → 回 `{ active: true, ...entry }`。
- 否則 → 回 `{ active: false }`。

---

## 4. 檔案系統路徑

### 4.1 `backups/` 子目錄

**建立**：執行期 `fs.mkdirSync(BACKUPS_DIR, { recursive: true })`（每次還原時冪等）。
**.gitignore / .dockerignore**：本計畫加入 `backups/` 一行。
**內容**：
- `before-restore-{YYYYMMDDHHmmss}.db`（自動備份；保留 5 份 + 90 天）
- 管理員下載的 `assetpilot-backup-{YYYYMMDDHHmmss}.db` **不存於此**（HTTP response 直接 stream 給 client；伺服器不留檔）。

### 4.2 檔名格式規範

| 檔名 | 格式 | 何時產生 | 保留 |
|---|---|---|---|
| `assetpilot-backup-{YYYYMMDDHHmmss}.db` | `YYYYMMDDHHmmss` 為 14 位數字 | 管理員下載備份時於 response Content-Disposition 指定 | 不存於 server（client 端保管） |
| `before-restore-{YYYYMMDDHHmmss}.db` | 同上 | 管理員上傳還原檔通過驗證後、覆寫主 DB 前 | 最近 5 份 + 90 天（取較嚴格者） |

**timestamp 來源**：`new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)` — 例：`2026-04-27T13:25:08.123Z` → `20260427132508`。

---

## 5. 與既有資料的關聯

### 5.1 與 `login_audit_logs` 的關係

`login_audit_logs` 與本計畫新增的 `data_operation_audit_log` 為**獨立表**，互不重疊：
- `login_audit_logs`：紀錄登入／登出事件（FR-024 既有）。
- `data_operation_audit_log`：紀錄匯出／匯入／備份／還原事件（FR-042 本計畫）。

兩者**不合併**的理由：
- 欄位語意不同（login 紀錄 login_method、is_admin_login；data 紀錄 action、result、metadata 等）。
- 保留期限可能不同（管理員可分別配置）。
- 查詢介面分離（login 為「登入紀錄」分頁、data 為「操作紀錄」分頁）。

但**清理 job 統一**：`registerAuditPruneJob()` 同一個 setInterval 內依序清理兩張表，避免重複建立 timer。

### 5.2 與 `exchange_rates` 的關係

匯率相關操作（手動編輯 / 自動更新）**不寫入** `data_operation_audit_log`：
- spec FR-042 列舉的 actions 僅含匯出／匯入／備份／還原；匯率不在範圍內。
- 匯率變動已透過既有 `exchange_rates.updated_at` 與 `is_manual` 欄位提供必要追蹤。

---

## 6. 資料量估算

| 表 / 結構 | 預期資料量 | 儲存大小（粗估） |
|---|---|---|
| `data_operation_audit_log` | 單使用者每日 ~5 筆（重度使用者）；1000 使用者 × 365 天 × 5 = ~180 萬筆／年 | ~500 bytes/row × 180 萬 = 900 MB／年（保留 90 天 = 約 225 MB） |
| `system_settings` | < 100 keys（為長期擴充保留） | < 10 KB |
| `importLocks` | < 10（並行匯入使用者數，記憶體） | 數 KB |
| `importProgress` | 同上 | 數 KB |
| `backups/before-restore-*.db` | 最多 5 份 × 50 MB = 250 MB | 250 MB |

**結論**：總體儲存衝擊 < 1 GB，符合單機部署規模；保留 90 天即 ~225 MB 為主要負擔，必要時管理員可調為 30 天降至 ~75 MB。

---

## 7. Migration / 升級策略

本功能**無破壞性 migration**：
- 新表採 `CREATE TABLE IF NOT EXISTS` — 既有部署 restart 後自動建立、不影響既有資料。
- 新 index 採 `CREATE INDEX IF NOT EXISTS` — 同上。
- `system_settings` 表初始化採 `INSERT OR IGNORE` — 既有部署若手動建表並設過值，不被覆寫。
- 既有表完全無 ALTER，無回退風險。

**部署檢核清單**（[quickstart.md](./quickstart.md) §1）：
1. Restart server → 確認 server log 無錯誤。
2. 連線 sql.js DB → `SELECT name FROM sqlite_master WHERE type = 'table'` → 確認 `data_operation_audit_log` 與 `system_settings` 存在。
3. `SELECT * FROM system_settings WHERE key = 'audit_log_retention_days'` → 應回 `90`。
4. `mkdir -p backups/` → 確認目錄存在（或讓 server 自動建立）。
5. `.gitignore` / `.dockerignore` → 確認 `backups/` 已加入。
