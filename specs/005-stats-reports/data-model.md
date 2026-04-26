# Phase 1 資料模型：統計報表

**Branch**: `005-stats-reports` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔記錄本功能對 `database.db`（sql.js）的 schema 變更。本功能**只新增 1 張表（`report_schedules`）**、**不變更任何既有表**、**不引入任何新 npm 套件**；既有的 transactions / accounts / stocks / categories / budgets 結構完全不動，本功能於這些既有資料上做純讀取查詢。所有 schema 變更皆於 `initDatabase()` 啟動冪等執行（同 002 / 003 / 004 模式）。

---

## 1. 新增表：`report_schedules`

```sql
CREATE TABLE IF NOT EXISTS report_schedules (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL,
  freq            TEXT    NOT NULL,                  -- 'daily' | 'weekly' | 'monthly'
  hour            INTEGER NOT NULL DEFAULT 9,        -- 0~23 台灣時區小時
  weekday         INTEGER NOT NULL DEFAULT 1,        -- 0~6（0=週日，6=週六）；僅 freq='weekly' 用
  day_of_month    INTEGER NOT NULL DEFAULT 1,        -- 1~28；僅 freq='monthly' 用
  enabled         INTEGER NOT NULL DEFAULT 1,        -- 0=停用、1=啟用
  last_run        INTEGER NOT NULL DEFAULT 0,        -- epoch ms；上次成功觸發開始時間
  last_summary    TEXT    NOT NULL DEFAULT '',       -- 上次觸發的人類可讀摘要
  created_at      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_user
  ON report_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq
  ON report_schedules(enabled, freq);                -- checkAndRunSchedule 主 query
```

| 欄位 | 規格對應 | 備註 |
| --- | --- | --- |
| `id` | Round 2 Q2 | UUID 字串（`uid()`），單一識別、`(user_id, freq)` 不為唯一鍵 |
| `user_id` | FR-016 | 該排程對應的使用者；不設 FOREIGN KEY（與既有表慣例一致） |
| `freq` | FR-016 | 列舉 `daily / weekly / monthly`；不接受 `off`（停用以 `enabled=0` 表達，而非 `freq='off'`） |
| `hour` | FR-022 | 台灣時區小時；0~23 |
| `weekday` | FR-022 | 0~6；僅 `freq='weekly'` 時生效，否則欄位仍存但不參與判斷 |
| `day_of_month` | FR-022 | 1~28（避開月底回退複雜性，與既有 `system_settings.report_schedule_day_of_month` clamp 一致） |
| `enabled` | FR-024a Round 2 Q3 | 0/1；停用→啟用時 `last_run` 不變，下次自然觸發點開始（不補寄） |
| `last_run` | FR-022, SC-004 | epoch ms；存的是「該次觸發的 startedAt」，與既有 `runScheduledReportNow` 慣例一致 |
| `last_summary` | SC-004 | 摘要含使用者數量、寄送結果、失敗原因 prefix；最大長度由 SQLite TEXT 不限 |
| `created_at` / `updated_at` | — | epoch ms；002 既有慣例 |

### 唯一性約束

**刻意不設** `(user_id, freq)` 唯一鍵 — 依 Round 2 Q2 答案，同一使用者可有多筆同頻率排程並存。

### 狀態轉換

```
建立 (POST) → enabled=1, last_run=0, last_summary=''
            ↓
            ↓ 排程觸發成功
enabled=1, last_run=<startedAt>, last_summary='2026-04-25 09:30 排程：寄送 1 / 失敗 0...'
            ↓
            ↓ 管理員手動停用
enabled=0, last_run=<前次值不變>, last_summary=<前次值不變>
            ↓
            ↓ 管理員重新啟用
enabled=1, last_run=<前次值不變> ← FR-024a 不補寄關鍵：last_run 保留，shouldRunSchedule 比對 periodStart 仍生效
            ↓
            ↓ 刪除 (DELETE)
row 消失
```

---

## 2. 不變動的既有表（純讀取）

本功能僅對下列既有表做 `SELECT` 查詢，**不**做 `ALTER` / `DROP` / 結構變更：

### 2.1 `transactions`（讀取）
- 用於 `/api/dashboard?yearMonth=` 的 income / expense / net 彙整、catBreakdown、recent。
- 用於 `/api/reports?type=&from=&to=` 的 categoryBreakdown / dailyMap / monthlyMap。
- 用於信件「交易紀錄」區塊（每日明細 / 每週彙總 / 每月彙總）。
- 共用既有索引：`idx_transactions_user_date`（已存在）、`idx_transactions_user_type_date`（已存在）。

### 2.2 `accounts` + `calcBalance()`（讀取，但 `/api/accounts` response 加 `twdAccumulated` 計算欄位）
- 表結構**不**變動（無 ALTER）。
- `/api/accounts` (GET) response **新增** `twdAccumulated` 計算欄位（T015；屬 Foundational phase）；計算邏輯為 `SUM(transactions.twd_amount × sign)`（`income / transfer_in = +1`、`expense / transfer_out = -1`）；外幣帳戶 `initial_balance` **不**納入此累計（依 spec round 4 釐清，因無對應 twd_amount 歷史值）。
- 既有 `balance` 欄位（由 `calcBalance(accId, initialBalance, userId, accountCurrency)` 計算之原幣餘額）**保留不動**；其他頁面（帳戶管理頁、交易輸入頁）仍使用此欄位。
- 儀表板「資產配置圓餅圖」（FR-004、T027）MUST 讀取 `twdAccumulated` 而非 `balance × cachedExchangeRates`；統計頁、信件等其他功能不使用 `twdAccumulated`（不必要計算開銷由 GET 端點承擔，但每使用者帳戶數通常 < 30 故可忽略）。
- 詳見 [contracts/stats-reports.openapi.yaml#components/schemas/AccountWithTwdAccumulated](./contracts/stats-reports.openapi.yaml)。

### 2.3 `stocks`（讀取）
- 用於儀表板「資產配置圓餅圖」的「股票市值」分布；前端呼叫 `/api/stocks` 取 `current_price`（既有快取欄位）；本功能**不**主動觸發查價（Round 2 Q1）。
- 用於信件「股票投資」區塊的成本／市值／未實現損益／報酬率 4 列；後端 `buildUserStatsReport` 已實作累計邏輯（buy / sell 平均成本法）。

### 2.4 `stock_transactions`（讀取）
- 用於信件「股票投資」區塊的成本計算（`buildUserStatsReport` 內既有 buy/sell 累計）。

### 2.5 `categories`（讀取 + LEFT JOIN）
- 用於圓餅圖父子分類映射；現有 `/api/dashboard` 與 `/api/reports` 已 `LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN categories p ON c.parent_id = p.id`。

### 2.6 `budgets`（讀取）
- 儀表板「當月預算進度條」沿用 004 既有 `/api/budgets?yearMonth=` 端點。

### 2.7 `system_settings`（讀寫，但不變更結構）
- `smtp_host / smtp_port / smtp_secure / smtp_user / smtp_password / smtp_from`：寄信通道設定（既有）。
- `report_schedule_freq / hour / weekday / day_of_month / last_run / last_summary / user_ids`：**保留**為 deprecated 兼容欄位（見 §3 Migration）。

---

## 3. Migration 步驟與回滾

### 3.1 升級腳本（`initDatabase()` 內冪等執行）

```javascript
// 步驟 1：建立 report_schedules 表（IF NOT EXISTS，可重複執行）
db.run(`CREATE TABLE IF NOT EXISTS report_schedules (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL,
  freq            TEXT    NOT NULL,
  hour            INTEGER NOT NULL DEFAULT 9,
  weekday         INTEGER NOT NULL DEFAULT 1,
  day_of_month    INTEGER NOT NULL DEFAULT 1,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_run        INTEGER NOT NULL DEFAULT 0,
  last_summary    TEXT    NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL DEFAULT 0
)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq ON report_schedules(enabled, freq)`);

// 步驟 2：從 system_settings 一次性遷移既有 singleton 排程（僅當 report_schedules 表為空時執行；冪等防重）
const existing = queryOne("SELECT COUNT(*) as cnt FROM report_schedules");
if (existing && existing.cnt === 0) {
  const sys = queryOne(`SELECT report_schedule_freq, report_schedule_hour, report_schedule_weekday,
    report_schedule_day_of_month, report_schedule_user_ids, report_schedule_last_run,
    report_schedule_last_summary FROM system_settings WHERE id = 1`);
  const oldFreq = sys?.report_schedule_freq;
  const oldUserIds = parseUserIdList(sys?.report_schedule_user_ids);
  if (oldFreq && oldFreq !== 'off' && oldUserIds.length > 0) {
    const now = Date.now();
    for (const uid of oldUserIds) {
      // 僅當 user 仍存在
      if (queryOne("SELECT id FROM users WHERE id = ?", [uid])) {
        db.run(
          `INSERT INTO report_schedules (id, user_id, freq, hour, weekday, day_of_month,
             enabled, last_run, last_summary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [
            generateUid(), uid, oldFreq,
            sys.report_schedule_hour ?? 9,
            sys.report_schedule_weekday ?? 1,
            sys.report_schedule_day_of_month ?? 1,
            sys.report_schedule_last_run ?? 0,
            sys.report_schedule_last_summary ?? '',
            now, now,
          ]
        );
      }
    }
    saveDB();
    console.log('[migration 005] 已將 singleton 排程遷移為多筆 report_schedules');
  }
}
```

### 3.2 不刪除舊欄位

`system_settings.report_schedule_*` 欄位**保留** — 既有的 deprecated alias 端點 `GET/PUT /api/admin/report-schedule`（單數）仍能透過讀寫這些欄位 round-trip；同時於該端點的 PUT handler 內加上「同步寫入 `report_schedules` 表」的二次邏輯（見 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml)）。

### 3.3 回滾策略

若新表上線後出現問題，可：
1. `DELETE FROM report_schedules` 清空（既有 singleton 排程仍能運作，因為 `system_settings.report_schedule_*` 未動）。
2. `DROP TABLE IF EXISTS report_schedules` 完全移除。
3. 還原 `server.js` 至 Migration 前版本。

無資料損失風險，因為 migration 為一次性 INSERT，不修改 `system_settings`、不修改任何業務資料。

---

## 4. 不變動的相關 schema 確認

為避免漏網，以下既有 schema 經盤點確認**不需**為本功能新增欄位：

| Schema | 是否需新增欄位？ | 說明 |
| --- | --- | --- |
| `users` | ❌ | 排程的「使用者偏好」由 `report_schedules.user_id` FK 表達；不在 user 表上加欄位 |
| `transactions` | ❌ | 既有 `exclude_from_stats` 欄位已可控制是否計入統計（FR-001 ~ FR-007、FR-019） |
| `categories` | ❌ | 既有 `parent_id` / `name` / `color` 已足夠支援父子雙圓餅與「（其他）」虛擬節點 |
| `accounts` | ❌ | 既有 `balance` 計算邏輯（`calcBalance()`）已涵蓋外幣帳戶累計本幣金額（Round 1 Q2） |
| `stocks` | ❌ | 既有 `current_price` 快取欄位已足夠支援儀表板讀取（Round 2 Q1） |
| `stock_transactions` | ❌ | 既有欄位已足夠支援成本／市值計算 |
| `budgets` | ❌ | 沿用 004 既有結構 |
| `recurring` | ❌ | 沿用 004 既有結構（與本功能無直接交互） |

---

## 5. 索引策略確認

新表的索引：

| Index | 用途 | 預期 query |
| --- | --- | --- |
| PK `id` | 單筆 CRUD | `WHERE id = ?` |
| `idx_report_schedules_user` | 管理員 UI 列出某使用者的所有排程 | `WHERE user_id = ?` |
| `idx_report_schedules_enabled_freq` | `checkAndRunSchedule` 5 分鐘 tick 主 query | `WHERE enabled = 1` 然後 in-memory 過濾 freq+hour |

既有表的索引**不需新增** — `/api/dashboard?yearMonth=` 與 `/api/reports?from=&to=` 皆使用既有 `idx_transactions_user_date` / `idx_transactions_user_type_date`，效能已足夠（單使用者單月最多 ~ 數百筆交易，掃描成本可忽略）。

---

## 6. 資料量估算

| 表 | 預期資料量上限 | SC 衝擊 |
| --- | --- | --- |
| `report_schedules` | 單一使用者最多 ~ 10 筆（同頻率多筆並存的合理上限）；全系統 ~ 1000 筆 | 無；`idx_enabled_freq` 已涵蓋主 query |
| `transactions`（讀取） | 單一使用者單年 ~ 數千筆；6 個月區間查詢 ~ 數百筆 LEFT JOIN | SC-001 2 秒目標下，sql.js 在記憶體查詢可在 < 50ms 內完成 |
| `stocks`（讀取） | 單一使用者 ~ 10~50 檔 | 無壓力 |
| `accounts`（讀取） | 單一使用者 ~ 10~30 個 | 無壓力 |

無 scale 風險。
