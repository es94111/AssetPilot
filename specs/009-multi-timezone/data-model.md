# 資料模型：多時區支援

**Feature**: 009-multi-timezone
**Date**: 2026-04-29
**Storage**: SQLite（`database.db`）via better-sqlite3
**參照**: [spec.md](./spec.md)、[research.md](./research.md)

---

## 1. Schema 變更總表

| 物件 | 變更類型 | 說明 |
|---|---|---|
| `users` | ALTER (ADD COLUMN) | 新增 `timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'` |
| `monthly_report_send_log` | CREATE | 新表，per-user 月份寄送去重 |
| `report_schedules` | 行為變更，schema 不動 | `hour / day_of_month` 的時區解讀由 Asia/Taipei 改為 `users.timezone` |
| 其他既有表（`transactions`、`budgets`、`accounts` 等） | 不變 | `transactions.date` 語意改為「使用者當地自然日」，但欄位形式不變 |

---

## 2. `users` 表（既有 + 新欄位）

### 既有欄位（節錄）
| 欄位 | 型別 | 約束 | 用途 |
|---|---|---|---|
| `id` | TEXT | PK | UUID |
| `email` | TEXT | UNIQUE NOT NULL | 登入識別 |
| `password_hash` | TEXT | NOT NULL | bcrypt |
| `display_name` | TEXT | NOT NULL | 顯示名稱 |
| `created_at` | TEXT | — | ISO 8601 UTC（與 FR-003 一致） |
| `google_id` | TEXT | DEFAULT '' | OAuth 連動 |
| `has_password` | INTEGER | DEFAULT 0 | 是否設過密碼 |
| `avatar_url` | TEXT | DEFAULT '' | Google 頭像 |
| `theme_mode` | TEXT | DEFAULT 'system' | 深淺主題偏好 |
| `is_admin` | INTEGER | DEFAULT 0 | 管理員旗標 |
| `token_version` | INTEGER | DEFAULT 0 | JWT 撤銷用 |
| `is_active` | INTEGER | DEFAULT 1 | 帳號停用旗標 |

### 新增欄位（本功能）

| 欄位 | 型別 | 約束 | 預設 | 用途 |
|---|---|---|---|---|
| `timezone` | TEXT | NOT NULL | `'Asia/Taipei'` | 該使用者偏好時區（IANA） |

### 升級語句
```sql
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei';
```
（包在 try/catch；既有列自動套用 `'Asia/Taipei'`，無資料遷移成本。）

### 驗證規則
- 寫入路徑（`PATCH /api/users/me/timezone` handler）需呼叫 `lib/userTime.isValidIanaTimezone(value)`：
  - 非空字串
  - 必為 `Intl.supportedValuesOf('timeZone')` 列舉中的成員
- DB 層不加 CHECK 約束（避免 SQLite 升級時舊版本資料庫不支援）。

---

## 3. `monthly_report_send_log` 新表

### 設計目的
為「月度報表郵件 per-user 月份去重」提供獨立的事實表（source of truth）。即使 `report_schedules.last_run` 因排程器崩潰／時區變更而模糊，本表仍能確保 SC-003 的「每月一封不重寄」。

### Schema
```sql
CREATE TABLE IF NOT EXISTS monthly_report_send_log (
  id TEXT PRIMARY KEY,                           -- UUID
  user_id TEXT NOT NULL,                         -- FK → users.id
  year_month TEXT NOT NULL,                      -- 'YYYY-MM' 該使用者當地月份
  schedule_id TEXT,                              -- FK → report_schedules.id（nullable，便於管理員手動觸發）
  sent_at_utc TEXT NOT NULL,                     -- ISO 8601 UTC
  send_status TEXT NOT NULL DEFAULT 'success',   -- 'success' | 'failed'
  error_message TEXT DEFAULT '',
  UNIQUE(user_id, year_month)                    -- 去重核心
);

CREATE INDEX IF NOT EXISTS idx_monthly_report_send_log_user
  ON monthly_report_send_log(user_id, year_month DESC);
```

### 寫入邏輯（虛擬碼）
```js
// scheduler tick：對每個 user 計算其本地 year_month
const ym = monthInUserTz(user.timezone);
try {
  db.run(
    "INSERT INTO monthly_report_send_log (id, user_id, year_month, schedule_id, sent_at_utc) VALUES (?, ?, ?, ?, ?)",
    [uuid(), user.id, ym, schedule.id, new Date().toISOString()]
  );
  // INSERT 成功才實際送信；失敗（UNIQUE 衝突）即跳過此使用者
  await sendMonthlyReportEmail(user, ym);
} catch (e) {
  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // 已寄過，跳過
    return;
  }
  // 其他錯誤：標記 failed
  db.run("UPDATE monthly_report_send_log SET send_status = 'failed', error_message = ? WHERE user_id = ? AND year_month = ?", [...]);
}
```

> **關鍵不變式**：UNIQUE(user_id, year_month) 確保任一 (使用者, 月份) 至多一列；INSERT 成功 ⇔ 該使用者該月份是首次送信。

### 失敗重試
- `send_status = 'failed'` 列保留，下個 tick 不會自動重試（避免風暴）。
- 管理員可呼叫內部腳本／既有 `POST /api/admin/...` 手動清除 `failed` 列以觸發重寄（不在本功能 P3 範圍）。

### 與既有 `report_schedules.last_run` 的關係
- `report_schedules.last_run` 仍保留（既有 daily/weekly 也用它），語意改為「最近一次執行 timestamp」純資訊用。
- 月度報表的去重唯一以 `monthly_report_send_log` 為準；`last_run` 不再參與決策。

---

## 4. `report_schedules`（既有，行為變更）

### Schema（不變）
（節錄自 `server.js:753`）
```sql
CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  freq TEXT NOT NULL,           -- 'daily' | 'weekly' | 'monthly'
  hour INTEGER NOT NULL,        -- 0-23
  weekday INTEGER,              -- weekly: 0-6
  day_of_month INTEGER,         -- monthly: 1-31
  enabled INTEGER NOT NULL,
  last_run TEXT,
  last_summary TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### 行為變更（FR-006）
| 欄位 | 升級前語意 | 升級後語意 |
|---|---|---|
| `hour` | Asia/Taipei 的小時 | `users.timezone` 的小時 |
| `day_of_month` | Asia/Taipei 月份的某日 | `users.timezone` 月份的某日 |
| `weekday` | Asia/Taipei 週幾 | `users.timezone` 週幾 |

> **既有 Asia/Taipei 使用者影響**：因預設 `users.timezone = 'Asia/Taipei'`，行為不變（regression-free，符合 SC-001）。

### Scheduler 觸發判斷（升級後）
```js
// 每 5 分鐘心跳
for (const sch of queryAll("SELECT * FROM report_schedules WHERE enabled = 1")) {
  const user = queryOne("SELECT * FROM users WHERE id = ?", [sch.user_id]);
  if (!user || !user.is_active) continue;
  const tz = user.timezone;
  const local = getNowInTz(tz);  // { year, month, day, hour, minute, weekday }
  const matches =
    (sch.freq === 'daily' && local.hour === sch.hour && local.minute < 5) ||
    (sch.freq === 'weekly' && local.weekday === sch.weekday && local.hour === sch.hour && local.minute < 5) ||
    (sch.freq === 'monthly' && local.day === sch.day_of_month && local.hour === sch.hour && local.minute < 5);
  if (!matches) continue;
  if (sch.freq === 'monthly') {
    // 透過 monthly_report_send_log 去重
    const ym = `${local.year}-${String(local.month).padStart(2, '0')}`;
    if (alreadySent(user.id, ym)) continue;
    sendAndLog(user, sch, ym);
  } else {
    // daily/weekly 用既有 last_run 簡單去重
    if (Date.now() - new Date(sch.last_run).getTime() < 23 * 3600 * 1000) continue;
    runAndUpdateLastRun(user, sch);
  }
}
```

---

## 5. `transactions.date` 語意更新（不改 schema）

### Schema（不變）
- `transactions.date TEXT NOT NULL`（既有），格式 `YYYY-MM-DD`。

### 語意變更
| 升級前 | 升級後 |
|---|---|
| 「Asia/Taipei 的自然日」 | 「該交易所有人 (`transactions.user_id`) 於其 `users.timezone` 下的自然日」 |

### 歷史資料處理
- 既有列：視為以 `Asia/Taipei` 寫入，不重算。
- 新增 / 編輯交易：
  - 若請求未指定 `date`：後端用 `todayInUserTz(req.userTimezone)`。
  - 若請求指定 `date`：直接信任該值（合規格式即可）。
- 不變式：`transactions.date` 一律是字串，與「瞬時時間」無關；任何「未來日」判斷以該使用者時區的「今天」字串字典序比對。

---

## 6. User 物件 API schema（OpenAPI 同步點）

### 回傳結構（`GET /api/users/me`）
```yaml
type: object
required: [id, email, display_name, timezone, created_at]
properties:
  id: { type: string, format: uuid }
  email: { type: string, format: email }
  display_name: { type: string }
  timezone:
    type: string
    description: IANA tz database 識別碼，例如 Asia/Taipei、America/Los_Angeles
    example: Asia/Taipei
  has_password: { type: boolean }
  google_id: { type: string }
  avatar_url: { type: string }
  theme_mode: { type: string, enum: [system, light, dark] }
  is_admin: { type: boolean }
  is_active: { type: boolean }
  created_at: { type: string, format: date-time, description: ISO 8601 UTC }
  updated_at: { type: string, format: date-time, nullable: true }
```

### PATCH 請求（`PATCH /api/users/me/timezone`）
```yaml
type: object
required: [timezone]
properties:
  timezone:
    type: string
    description: 必須為 IANA tz database 合法識別碼
```

詳細 OpenAPI 3.2.0 文件見 [contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)。

---

## 7. 索引與效能

- `users.timezone` 不需單獨索引（每筆 user 僅 1 列；不會 WHERE timezone = X 大量查詢）。
- `monthly_report_send_log`：UNIQUE(user_id, year_month) 已為複合 index；外加 user-only ORDER BY 索引便於後台檢視。
- 預估：1 萬使用者 × 12 月 = 12 萬列／年，SQLite 完全可承受。

---

## 8. `data_operation_audit_log` 寫入規範（既有表，行為新增）

依 spec 之 FR-008 / Clarifications Q3，每次成功變更 `users.timezone` 必須寫入既有 `data_operation_audit_log` 一列：

| 欄位 | 值 |
|---|---|
| `user_id` | 變更者（即被變更帳號擁有者，本功能無管理員代為變更場景） |
| `role` | `'user'` |
| `action` | `'user.timezone.update'` |
| `metadata`（JSON 字串）| `{ "from": "<舊時區>", "to": "<新時區>", "source": "auto-detect" \| "manual" }` |
| `ip_address` / `user_agent` | 沿用既有 audit 寫入規則（從 req 取） |
| `timestamp` | ISO 8601 UTC（與 FR-003 一致） |

> `source` 由前端決定：「自動偵測流程觸發的 PATCH」傳 `auto-detect`；「設定頁手動變更」傳 `manual`。後端 schema 對 `source` 無約束（彈性欄位於 metadata），但前端 / API client 應遵守此 enum。

---

## 9. 不變式（Invariants）

1. **時區存在性**：每位 `is_active = 1` 的使用者必有非空 `timezone` 字串。
2. **時區合法性**：`timezone` ∈ `Intl.supportedValuesOf('timeZone')`。
3. **月度郵件唯一性**：`monthly_report_send_log.UNIQUE(user_id, year_month)` 保證 `(使用者, 月份)` 至多寄一封。
4. **失敗不重試**：`monthly_report_send_log.send_status = 'failed'` 列保留為事實紀錄，scheduler 不自動重試（FR-018）。
5. **歷史日期不可變**：升級不修改任何既有 `transactions.date` 值。
6. **TWSE 例外**：`lib/twseFetch.js` 內部「市場開盤判斷」永久使用 `Asia/Taipei`，與 `users.timezone` 無關。
7. **時區變更皆有跡可循**：每次 `users.timezone` 變更必有對應 `data_operation_audit_log` 一列。
8. **時間精度**：所有 API 出口的 `*_at` 字串以毫秒精度收尾（`.sssZ`）；無毫秒入庫的歷史值由 `toIsoUtc()` 工具補 `.000`。
