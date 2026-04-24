# Phase 1 資料模型：使用者與權限

**功能**：使用者與權限（001-user-permissions）
**階段**：Phase 1（資料模型）
**日期**：2026-04-24

## 設計原則

- 本功能沿用既有資料表結構，**不新增資料表**；僅於 `users` 與
  `login_attempt_logs` 上擴充既有欄位的語意（見 §4）。
- 所有 DDL 以 sql.js 可理解的 SQLite 子集撰寫；型別一律使用 `TEXT`／
  `INTEGER`／`REAL`，避免 `BOOLEAN`／`JSON` 等非標準類型。
- Email 欄位一律儲存**正規化後**（`trim + lowercase`）字串；大小寫變異視為
  同一帳號（FR-001、FR-008）。

## §1. 實體對照（Spec ↔ 資料表）

| Spec 實體                   | 實際資料表                                   | 說明                                                  |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| User                        | `users`                                      | 身分主體                                              |
| Passkey                     | `passkey_credentials`                        | 與 `users` 一對多                                     |
| GoogleAccountLink           | `users.google_id`（欄位）                     | 既有實作為 1:1 欄位；Phase 0 §4 記載。                 |
| LoginAuditLog               | `login_audit_logs` + `login_attempt_logs`    | 兩表並存：成功 vs 含失敗嘗試                           |
| SystemSettings              | `system_settings`（單列）                     | —                                                     |
| RegistrationAllowlist       | `system_settings.allowed_registration_emails` | 以逗號／換行分隔字串儲存；讀取時 `.split(/[,\n]/)`      |

## §2. 資料表結構

### 2.1 `users`（使用者）

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,           -- UUID v4
  email           TEXT UNIQUE NOT NULL,       -- 正規化後（trim + lowercase）
  password_hash   TEXT NOT NULL,              -- bcryptjs；Google-only 帳號為隨機雜湊
  display_name    TEXT NOT NULL,
  created_at      TEXT,                       -- ISO 8601

  -- ALTER TABLE 升級欄位（存在於升級路徑上）
  google_id       TEXT    DEFAULT '',         -- Google `sub`；空字串表示未綁定
  avatar_url      TEXT    DEFAULT '',
  has_password    INTEGER DEFAULT 0,          -- 0=僅 Google 登入、1=有本機密碼
  theme_mode      TEXT    DEFAULT 'system',
  is_admin        INTEGER DEFAULT 0,          -- 0/1；FR-030 第一位註冊者自動設 1
  token_version   INTEGER DEFAULT 0           -- 登出/改密碼時 +1；JWT 驗證需相等
);
```

**關鍵邏輯**：
- FR-001：註冊、登入、管理員新增使用者 API 皆呼叫 `normalizeEmail()` 後再寫入／比對。
- FR-005：`token_version` 在（a）登出（b）使用者自行改密碼（c）管理員重設密碼
  三處同步遞增；JWT payload 帶 `tokenVersion`，`authMiddleware` 比對不符即 401。
- FR-030：第一位 `INSERT` 成功的使用者於啟動時被追認 `is_admin = 1`。
- FR-036：任何會使 `SUM(is_admin) = 0` 的操作皆在應用層拒絕，無 DB constraint。

### 2.2 `passkey_credentials`（Passkey 憑證）

```sql
CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id  TEXT PRIMARY KEY,         -- base64url
  user_id        TEXT NOT NULL,            -- FK users.id（應用層維護）
  public_key     TEXT NOT NULL,            -- COSE key、base64
  algorithm      TEXT NOT NULL,            -- 'ES256' / 'RS256'
  transports     TEXT DEFAULT '[]',        -- JSON 字串：['internal','hybrid',...]
  counter        INTEGER DEFAULT 0,
  device_name    TEXT DEFAULT '',          -- 使用者自訂名稱
  created_at     TEXT
);
```

**關鍵邏輯**：
- FR-021：usernameless discoverable credential——`user_id` 寫入 `userHandle`。
- FR-022：伺服器驗證 assertion 時比對 `origin` 白名單（由 `APP_HOST` 推導）。
- FR-035：使用者被刪除時，此表相關列一併 `DELETE WHERE user_id = ?`。

### 2.3 `login_audit_logs`（**成功**登入稽核）

```sql
CREATE TABLE IF NOT EXISTS login_audit_logs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  email           TEXT NOT NULL,              -- 正規化後
  login_at        INTEGER NOT NULL,           -- epoch ms
  ip_address      TEXT NOT NULL,
  login_method    TEXT DEFAULT 'password',    -- 'password' | 'google' | 'passkey'
  is_admin_login  INTEGER DEFAULT 0           -- 登入當下的 is_admin 值
);
CREATE INDEX IF NOT EXISTS idx_login_audit_user_time ON login_audit_logs(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_time ON login_audit_logs(login_at DESC);
```

**關鍵邏輯**：
- FR-040：每次登入成功寫入一筆。
- FR-042：使用者檢視自己最近 100 筆（`WHERE user_id = ? ORDER BY login_at DESC LIMIT 100`）。
- FR-043：管理員檢視自己管理員登入最近 200 筆、全站最近 500 筆。
- FR-035 / Q9：刪除使用者時 **硬刪** `WHERE user_id = ?` 的成功紀錄。
- FR-046 / Q1：每日 `DELETE WHERE login_at < (now - 90*86400000)`。

### 2.4 `login_attempt_logs`（登入**嘗試**稽核，含失敗）

```sql
CREATE TABLE IF NOT EXISTS login_attempt_logs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT DEFAULT '',            -- 空字串表示匿名化或登入失敗時找不到帳號
  email           TEXT NOT NULL,              -- 可為 SHA-256 雜湊（匿名化後）
  login_at        INTEGER NOT NULL,
  ip_address      TEXT NOT NULL,
  login_method    TEXT DEFAULT 'password',
  is_admin_login  INTEGER DEFAULT 0,
  is_success      INTEGER DEFAULT 0,          -- 0=失敗, 1=成功（與 audit_logs 互補，保留供全覽）
  failure_reason  TEXT DEFAULT ''             -- 'bad_password' | 'no_such_user' | 'invalid_redirect_uri' ...
);
CREATE INDEX IF NOT EXISTS idx_login_attempt_time ON login_attempt_logs(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempt_email_time ON login_attempt_logs(email, login_at DESC);
```

**關鍵邏輯**：
- FR-040：每次登入嘗試（含失敗）寫入一筆。
- FR-035 / Q9：刪除使用者時**不刪除**失敗紀錄（`is_success = 0`），改為
  `UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0`
  其中 `?` = `sha256(lower(email)).hex`。成功紀錄（`is_success = 1`）同步硬刪。
- FR-046 / Q1：每日清除 90 天前紀錄，與 `login_audit_logs` 同。

**Email 欄位雙語意**：
- 非匿名化：正規化後 Email（例如 `alice@example.com`）。
- 匿名化：SHA-256(email) 的 64 字元 hex 字串。
- 程式層以長度或 regex（`/^[0-9a-f]{64}$/`）判別顯示方式；UI 匿名化紀錄
  顯示為 `[已匿名化 #abc123]`（取雜湊前 6 碼）。

### 2.5 `system_settings`（系統設定）

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  id                              INTEGER PRIMARY KEY CHECK(id = 1),
  public_registration             INTEGER DEFAULT 1,   -- 0/1
  allowed_registration_emails     TEXT    DEFAULT '',  -- 逗號／換行分隔
  admin_ip_allowlist              TEXT    DEFAULT '',
  updated_at                      INTEGER DEFAULT 0,
  updated_by                      TEXT    DEFAULT '',

  -- SMTP 與報表排程（與本功能無關，保留於此僅為完整性）
  smtp_host                       TEXT    DEFAULT '',
  smtp_port                       INTEGER DEFAULT 587,
  smtp_secure                     INTEGER DEFAULT 0,
  smtp_user                       TEXT    DEFAULT '',
  smtp_password                   TEXT    DEFAULT '',
  smtp_from                       TEXT    DEFAULT '',
  report_schedule_freq            TEXT    DEFAULT 'off',
  report_schedule_hour            INTEGER DEFAULT 9,
  report_schedule_weekday         INTEGER DEFAULT 1,
  report_schedule_day_of_month    INTEGER DEFAULT 1,
  report_schedule_last_run        INTEGER DEFAULT 0,
  report_schedule_last_summary    TEXT    DEFAULT '',
  report_schedule_user_ids        TEXT    DEFAULT '',

  -- 伺服器時間
  server_time_offset              INTEGER DEFAULT 0    -- 毫秒；|value| 上限 ±10 年
);
```

**關鍵邏輯**：
- FR-031、FR-032：`allowed_registration_emails` 欄位存「原始使用者輸入」，
  比對時於應用層 `split(/[,\n]/).map(normalizeEmail)`；每一項再判 `*` 字元決定
  完全比對 vs `*@domain` 通配（大小寫不敏感，已 lowercase）。
- FR-052：`server_time_offset` 寫入前做 bounds check：`|offset| <= 10 * 365 * 86400 * 1000`。
- `public_registration = 0 AND allowed_registration_emails = ''` 時，註冊 API
  回傳 403 並寫入 `login_attempt_logs` 失敗原因 `registration_closed`。

## §3. 白名單比對演算法（FR-032）

```text
function matchAllowlist(email, raw):
    normalized := lowercase(trim(email))
    items := split(raw, /[,\n]/)
            .map(trim)
            .filter(non-empty)
            .map(lowercase)
    return items.some(item =>
        if item contains '*':
            // 只支援 '*@domain'；其他含 '*' 的形態視為不合法並忽略
            return item.startsWith('*@') AND normalized.endsWith(item.substring(1))
        else:
            return normalized == item
    )
```

範例：

| 白名單項目               | `alice@example.com` | `bob@example.com` | `carol@other.com` |
| ------------------------ | ------------------- | ------------------ | ------------------ |
| `alice@example.com`      | ✅                  | ❌                 | ❌                 |
| `*@example.com`          | ✅                  | ✅                 | ❌                 |
| `bob@example.com,*@other.com` | ❌             | ✅                 | ✅                 |

## §4. 升級路徑（Migration）

本功能導入時需執行的 **一次性** 資料轉換：

```sql
-- (M1) Email 正規化（FR-001 / Q8）
-- 風險：若現存資料大小寫不一致，UNIQUE(email) 可能衝突。
-- 做法：先挑出衝突候選（LOWER(email) 相同但 id 不同），保留 created_at 最早一筆。
-- 實作於 server.js 啟動 migration 段，以 JavaScript 迴圈處理：
--   SELECT id, LOWER(TRIM(email)) AS ne, email, created_at FROM users ORDER BY created_at ASC;
--   若新 email 已存在 → 保留舊列、刪新列並記 log；否則 UPDATE email = ne。

-- (M2) login_attempt_logs.email 允許 SHA-256
-- 無須 ALTER TABLE；欄位型別 TEXT 已相容。
-- 程式層改以「長度 + hex regex」判別。

-- (M3) 排程：每日清除 90 天前紀錄（FR-046）
-- 於 server.js 啟動時 registerAuditPruneJob()：setInterval(pruneAuditLogs, 24*3600*1000)；
-- 啟動後立即執行一次 pruneAuditLogs()。
```

升級**不可逆**（Email 正規化後原始大小寫不留存）；於 `changelog.json` 與
PR 描述中明確標示「使用者 Email 一律轉小寫」的相容性提醒。

## §5. 狀態流（重點 FR）

### 5.1 JWT 生命週期（FR-004、FR-005）

```
 Register/Login
      │
      ▼
 sign JWT { userId, tokenVersion }
      │
      ▼
 Set-Cookie: authToken (HttpOnly; Secure; SameSite=Strict; Max-Age=JWT_EXPIRES)
      │
      ▼
 每次請求進 authMiddleware：
    verify signature  →  查 DB token_version  →  比對 payload.tokenVersion
      │  不符                 │ 相等
      ▼                       ▼
    401              附 req.userId 繼續
```

撤銷事件：
- 登出 API：`UPDATE users SET token_version = token_version + 1 WHERE id = ?`、清除 Cookie。
- 使用者自改密碼 / 管理員重設：同上。
- 管理員刪除使用者：連同整列一併 `DELETE`；舊 JWT 在 `authMiddleware` 查不到列即 401。

### 5.2 使用者刪除（FR-035 / Q9）

```
 admin DELETE /api/admin/users/:id
      │
      ▼
 讀取目標 user：email, is_admin
      │
      ▼
 FR-036 檢查：若目標為最後一位 admin → 拒絕 400
      │
      ▼
 交易開始：
   DELETE FROM passkey_credentials        WHERE user_id = ?
   DELETE FROM transactions               WHERE user_id = ?
   DELETE FROM accounts                   WHERE user_id = ?
   DELETE FROM categories                 WHERE user_id = ?
   DELETE FROM budgets                    WHERE user_id = ?
   DELETE FROM recurring                  WHERE user_id = ?
   DELETE FROM stocks                     WHERE user_id = ?
   DELETE FROM stock_transactions         WHERE user_id = ?
   DELETE FROM stock_dividends            WHERE user_id = ?
   DELETE FROM stock_settings             WHERE user_id = ?
   DELETE FROM stock_recurring            WHERE user_id = ?
   DELETE FROM exchange_rate_settings     WHERE user_id = ?
   DELETE FROM login_audit_logs           WHERE user_id = ?      -- 成功紀錄硬刪
   UPDATE login_attempt_logs SET                                  -- 失敗紀錄匿名化
     user_id = '',
     email   = ?          -- sha256(lower(email)).hex
   WHERE user_id = ? AND is_success = 0
   DELETE FROM users                       WHERE id = ?
 交易提交 → saveDB()
```

### 5.3 稽核清除排程（FR-046 / Q1）

```
 server.js 啟動
      │
      ▼
 registerAuditPruneJob()：
   1. 立即執行 pruneAuditLogs()（避免重啟後日差過大）
   2. setInterval(pruneAuditLogs, 24h)

 pruneAuditLogs():
   threshold = serverTimeNow() - 90 * 86400 * 1000
   repeat up to N 批：
     affected1 = DELETE FROM login_audit_logs
                 WHERE id IN (
                   SELECT id FROM login_audit_logs
                   WHERE login_at < threshold LIMIT 5000
                 )
     affected2 = DELETE FROM login_attempt_logs WHERE ... LIMIT 5000
     若 affected1 + affected2 == 0 → break
   saveDB()；記 log 本次刪除數。
```

## §6. 常量與參數

| 常量                      | 值                        | 說明                          |
| ------------------------- | ------------------------- | ----------------------------- |
| `JWT_EXPIRES`             | `'7d'`                    | 預設；可由 env 覆寫           |
| `COOKIE_MAX_AGE`          | 7 × 86400 × 1000 ms       | 與 `JWT_EXPIRES` 對齊         |
| `PASSWORD_MIN_LEN`        | 8                         | FR-002                        |
| `RATE_LIMIT_WINDOW_MS`    | 15 × 60 × 1000 ms         | FR-007                        |
| `RATE_LIMIT_MAX`          | 20                        | FR-007；每桶每 IP             |
| `AUDIT_RETENTION_DAYS`    | 90                        | FR-046                        |
| `AUDIT_DISPLAY_USER`      | 100                       | FR-042                        |
| `AUDIT_DISPLAY_ADMIN_SELF`| 200                       | FR-043                        |
| `AUDIT_DISPLAY_ADMIN_ALL` | 500                       | FR-043                        |
| `PRUNE_BATCH`             | 5000                      | FR-046 / R3                   |
| `NTP_TIMEOUT_MS`          | 3000                      | FR-053                        |
| `SERVER_TIME_OFFSET_MAX`  | 10 × 365 × 86400 × 1000   | FR-052                        |
| `LOGIN_METHOD_ENUM`       | `password` / `google` / `passkey` | FR-040                    |

## §7. 索引總覽

- `users(email)`：`UNIQUE` 隱含索引。
- `login_audit_logs(user_id, login_at DESC)`：支援 FR-042 / FR-043 查詢。
- `login_audit_logs(login_at DESC)`：支援 FR-043 全站查詢與 FR-046 清除。
- `login_attempt_logs(login_at DESC)`、`login_attempt_logs(email, login_at DESC)`：
  支援 Email 搜尋攻擊軌跡與 FR-046 清除。
- `passkey_credentials(credential_id)`：`PRIMARY KEY`，登入查找用。

不新增額外索引。
