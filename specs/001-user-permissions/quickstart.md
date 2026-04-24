# Phase 1 快速驗證：使用者與權限

**功能**：使用者與權限（001-user-permissions）
**階段**：Phase 1（Quickstart）
**日期**：2026-04-24

本文件提供實作完成後可**手動重現**的最短驗證流程，用以逐項檢驗 Clarification
所帶出的新行為。不依賴任何測試框架；所有步驟皆以 `curl` 或瀏覽器完成。

## §1. 前置準備

### 1.1 環境變數（`.env`）

```ini
# 必要
JWT_SECRET=<32+ 位亂碼；可用 `openssl rand -hex 32`>
JWT_EXPIRES=7d                       # FR-004 預設

# Google OAuth（FR-010 / FR-011）
GOOGLE_CLIENT_ID=<Google Cloud Console 取得>
GOOGLE_CLIENT_SECRET=<同上>
GOOGLE_OAUTH_REDIRECT_URIS=https://app.your-domain.tld/api/auth/google,http://localhost:3000/api/auth/google
# └ FR-011：逗號分隔；必須與 Google Cloud Console > OAuth 2.0 Client > Authorized redirect URIs 完全一致
# └ `app.your-domain.tld` 為範例佔位；部署時請替換為實際對外網域（與 APP_HOST 一致）

# 其他（與本功能無關，依需要保留）
APP_HOST=app.your-domain.tld         # 實際部署時請替換為真實網域
PORT=3000
```

### 1.2 啟動

```bash
npm install
node server.js
# 啟動 log 應包含：
#   [Audit Prune] registered; next run in 24h
#   [OAuth] redirect_uri whitelist: 2 entries
```

## §2. P1 — Email 帳密註冊與登入（FR-001 / FR-002 / FR-004）

### 2.1 註冊（Email 會被正規化）

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"  Alice@EX.com  ","password":"Str0ng!Pass","displayName":"Alice"}'
```

**預期**：
- HTTP 200，回傳 `{ user: { email: "alice@ex.com", isAdmin: true, ... }, currentLogin: {...} }`
  - Email 已 `trim + lowercase`（FR-001）。
  - `isAdmin: true`（第一位使用者自動為管理員，FR-030）。
- `Set-Cookie: authToken=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`（FR-004）。

### 2.2 Email 正規化生效驗證（同帳號不同大小寫）

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ALICE@ex.COM","password":"Another1!","displayName":"Dup"}'
```

**預期**：HTTP 409 `{ error: "email_in_use" }`。

### 2.3 登入 + Token Version 遞增驗證（FR-005）

```bash
# (1) 登出（token_version ← +1）
curl -b cookies.txt -X POST http://localhost:3000/api/auth/logout

# (2) 以舊 cookie 打 /api/auth/me → 應回 401
curl -i -b cookies.txt http://localhost:3000/api/auth/me
# 預期：HTTP 401
```

## §3. P2 — 管理員政策（FR-031 / FR-032 / FR-035 / FR-036）

### 3.1 切換公開註冊與白名單（萬用字元）

```bash
# 以管理員 cookie 更新設定
curl -b cookies.txt -X PUT http://localhost:3000/api/admin/system-settings \
  -H 'Content-Type: application/json' \
  -d '{
    "publicRegistration": true,
    "allowedRegistrationEmails": ["bob@example.com", "*@partner.com"]
  }'
```

**驗證白名單**：

| 註冊 Email              | 預期結果        | 說明                         |
| ----------------------- | --------------- | ---------------------------- |
| `bob@example.com`       | ✅ 200          | 完全比對                     |
| `BOB@EXAMPLE.COM`       | ✅ 200          | Email 正規化後比對           |
| `carol@example.com`     | ❌ 403          | 不在白名單                   |
| `eve@partner.com`       | ✅ 200          | `*@partner.com` 通配         |
| `eve@PARTNER.com`       | ✅ 200          | 通配大小寫不敏感             |
| `eve@otherpartner.com`  | ❌ 403          | domain 不相等                |

### 3.2 管理員刪除使用者（混合策略 FR-035）

```bash
# 先製造目標使用者 + 幾筆成功與失敗登入
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"bob@example.com","password":"wrong"}' \
  -H 'Content-Type: application/json'
# → 失敗（寫 login_attempt_logs）

curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"bob@example.com","password":"correctPW1!"}' \
  -H 'Content-Type: application/json'
# → 成功（寫 login_audit_logs + login_attempt_logs is_success=1）

# 管理員刪除
curl -b cookies.txt -X DELETE http://localhost:3000/api/admin/users/<userId>
```

**驗證**：

```sql
-- 應為 0
SELECT COUNT(*) FROM login_audit_logs WHERE user_id = '<userId>';

-- 應為 0（is_success=1 的嘗試也被硬刪；依 FR-035 與 SC-008 要求）
SELECT COUNT(*) FROM login_attempt_logs WHERE user_id = '<userId>' AND is_success = 1;

-- 失敗嘗試應保留但 user_id 為空字串，email 為 SHA-256 hex
SELECT user_id, email, is_success FROM login_attempt_logs
 WHERE ip_address IN (...被刪使用者曾用過的 IP...);
-- user_id = ''，email 類似 'a1b2c3...'（64 hex 字元）
```

### 3.3 無法使系統無管理員（FR-036）

```bash
# 以唯一管理員身分嘗試刪除自己
curl -b cookies.txt -X DELETE http://localhost:3000/api/admin/users/<selfId>
```

**預期**：HTTP 400 `{ error: "last_admin_protected" }`。

#### 3.3.1 SC-004 壓測：1000 次嘗試刪除最後管理員應全數 400（對應 [analyze-01.md](./analyze-01.md) C3）

```bash
# 以唯一管理員 cookies.txt 連續嘗試 1000 次
fail=0
for i in $(seq 1 1000); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -b cookies.txt \
    -X DELETE http://localhost:3000/api/admin/users/<selfId>)
  if [ "$code" != "400" ]; then
    fail=$((fail + 1))
    echo "[iter $i] unexpected code: $code"
  fi
done
echo "失敗次數：$fail／1000"
```

**預期**：`失敗次數：0／1000`。  
**理由**：FR-036「無法使系統無管理員」為永久性不可違反的 invariant，SC-004 要求
1000 次嘗試皆被阻擋（不得有任何競態條件導致漏洞）。若 `fail > 0` 視為 P0 阻擋合併。

## §4. P3a — Google SSO 與 `redirect_uri` 白名單（FR-011）

### 4.1 合法 redirect_uri

```bash
# 1) 先取得 state
curl -c cookies.txt http://localhost:3000/api/auth/google/state
# → {"state":"<uuid>"}

# 2) 模擬交換（正常情境由 Google 導回）
curl -b cookies.txt -X POST http://localhost:3000/api/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"code":"<google_code>","redirect_uri":"http://localhost:3000/api/auth/google","state":"<uuid>"}'
```

**預期**：HTTP 200，發出 `authToken` Cookie；若 `code` 無效，回 400
`invalid_code`；`redirect_uri` 正確時絕對不會得到 `invalid_redirect_uri`。

### 4.2 非白名單 redirect_uri（攻擊模擬）

```bash
curl -i -X POST http://localhost:3000/api/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"code":"xxx","redirect_uri":"https://evil.example/callback","state":"<uuid>"}'
```

**預期**：
- HTTP 400 `{ error: "invalid_redirect_uri" }`。
- 後端**不會**向 Google 換 token（觀察 log 無外呼）。
- `login_attempt_logs` 應新增一筆 `failure_reason = 'invalid_redirect_uri'`。

## §5. P3b — Passkey usernameless（FR-021）

### 5.1 註冊一組 Passkey

1. 以 Chrome 登入系統 → 進入「帳號設定 → Passkey」。
2. 點「新增 Passkey」，命名 `MacBook Touch ID`。
3. 完成 Touch ID 驗證。
4. 清單應顯示該 Passkey 名稱與建立時間。

### 5.2 登入頁直接 Passkey 登入（不先輸入 Email）

1. 登出。
2. 開啟登入頁，**不填 Email**，點「使用 Passkey 登入」。
3. 瀏覽器列出可用 Passkey → 選擇 → 完成驗證。

**預期**：無須輸入 Email，即可進入儀表板；後端透過 `userHandle` 完成帳號查找。

## §6. P2 — 登入稽核與 90 天清除（FR-046）

### 6.1 模擬時間跳過（使用伺服器時間偏移）

```bash
# 將採用時間快轉 100 天
curl -b cookies.txt -X PUT http://localhost:3000/api/server-time/offset \
  -H 'Content-Type: application/json' \
  -d '{"offsetMs":8640000000}'   # 100*86400*1000
```

### 6.2 觸發或等待 pruneAuditLogs

```bash
# 以 SQL 直接插入一筆 91 天前的測試紀錄後，觀察是否被清
# （若伺服器有管理介面「立即清除」按鈕更佳）
```

**預期**：
- `SELECT COUNT(*) FROM login_audit_logs WHERE login_at < adoptedNow - 90d` = 0。
- 伺服器 log 顯示 `[Audit Prune] removed N rows`。
- SC-009 成立。

## §7. P3c — 伺服器時間 NTP（FR-053 / FR-055）

### 7.1 合法查詢（僅預覽）

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/server-time/ntp \
  -H 'Content-Type: application/json' \
  -d '{"host":"time.google.com","apply":false}'
```

**預期**：HTTP 200，回傳 `deltaMs` 與 `applied: false`；`server_time_offset` 不變。

### 7.2 SSRF 防護（私有網段）

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/api/server-time/ntp \
  -H 'Content-Type: application/json' \
  -d '{"host":"10.0.0.1"}'

curl -i -b cookies.txt -X POST http://localhost:3000/api/server-time/ntp \
  -H 'Content-Type: application/json' \
  -d '{"host":"[::1]"}'
```

**預期**：兩者皆 HTTP 400 `{ error: "invalid_ntp_host" }`。

## §8. 速率限制兩桶驗證（FR-007）

```bash
# 快速打 21 次 login
for i in $(seq 1 21); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"nobody@ex.com","password":"wrong"}'
done
# 預期：前 20 次 HTTP 401，第 21 次 HTTP 429。

# 同時 /privacy 應仍可存取（不同桶）
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/privacy
# 預期：HTTP 200
```

若同 IP 再連續請求 `/privacy` 21 次，第 21 次才會 429，且不影響此時
`/api/auth/login` 是否解封（兩桶獨立）。

## §9. Rollback 與事故復原

若 Email 正規化 migration 造成使用者衝突，可：
1. 停機。
2. 以 `database.db` 的 `.bak` 備份還原（Docker compose 掛載 `./data`）。
3. 將 `package.json` 回退至實作此功能前的 tag。
4. 由衝突 Email 手動合併帳號後再啟動新版。

## §10. 完成勾選單

- [ ] §2 註冊 Email 已 trim + lowercase；重複大小寫回 409。
- [ ] §2 登出後舊 Cookie 失效（token_version 遞增）。
- [ ] §3.1 白名單完全比對 + 通配 + 大小寫不敏感皆如預期。
- [ ] §3.2 刪除使用者後業務資料與成功登入紀錄全數消失，失敗紀錄匿名化保留。
- [ ] §3.3 無法自刪最後管理員。
- [ ] §4.1 合法 redirect_uri 通過；§4.2 非白名單 redirect_uri 回 `invalid_redirect_uri`。
- [ ] §5.2 登入頁 Passkey 登入不需先輸入 Email。
- [ ] §6 伺服器 log 出現 `[Audit Prune] removed N rows`。
- [ ] §7.2 私有網段 NTP 目標被拒。
- [ ] §8 兩桶速率限制互不干涉。
