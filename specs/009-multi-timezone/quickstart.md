# Quickstart：多時區支援本地驗證指南

**Feature**: 009-multi-timezone
**目標讀者**: 實作工程師 / 驗收人員 / Code Reviewer
**前置**: Node.js ≥ 20、本地已能 `npm start` 啟動 `server.js`、`database.db` 已存在或可重建。

---

## 0. 環境檢查

```bash
# Node 內建 ICU 是否覆蓋常見時區（必須 ≥ 400）
node -e "console.log(Intl.supportedValuesOf('timeZone').length)"

# 必為以下時區可被解析（任一錯誤即停止）
node -e "
  ['Asia/Taipei','America/Los_Angeles','Europe/London','Asia/Tokyo','Pacific/Auckland','America/Asuncion']
    .forEach(tz => new Intl.DateTimeFormat('en-CA',{timeZone:tz}).format(new Date()) && console.log('✓', tz));
"
```

若顯示數字過小或某時區擲錯，先處理 base image ICU 問題再進行下方驗證。

---

## 1. DB Migration 自我驗證

啟動伺服器後，DB 應自動套用本功能 migration。手動驗證：

```bash
# 1. users.timezone 欄位存在且 NOT NULL DEFAULT 'Asia/Taipei'
sqlite3 database.db "PRAGMA table_info(users);" | grep timezone
# 預期：4|timezone|TEXT|1|'Asia/Taipei'|0  （第 4 欄位置可能不同）

# 2. 既有使用者全部已有 timezone（無 NULL）
sqlite3 database.db "SELECT COUNT(*) FROM users WHERE timezone IS NULL OR timezone = '';"
# 預期：0

# 3. monthly_report_send_log 表存在
sqlite3 database.db ".schema monthly_report_send_log"
# 預期：見 data-model.md 對應 CREATE TABLE 內容

# 4. UNIQUE(user_id, year_month) 約束生效
sqlite3 database.db "
  INSERT INTO monthly_report_send_log (id,user_id,year_month,sent_at_utc) VALUES ('t1','user-x','2026-04','2026-04-29T00:00:00.000Z');
  INSERT INTO monthly_report_send_log (id,user_id,year_month,sent_at_utc) VALUES ('t2','user-x','2026-04','2026-04-29T00:00:01.000Z');
"
# 預期：第二行報 UNIQUE constraint failed
sqlite3 database.db "DELETE FROM monthly_report_send_log WHERE id IN ('t1','t2');"
```

---

## 2. 建立第二個非 Asia/Taipei 測試帳號

> 假設已有 admin 帳號 `admin@example.com`（密碼任意）、開發伺服器跑於 `http://localhost:3000`。

### 步驟 A：註冊 PST 測試使用者
```bash
# 用 curl 直接打 API（避開前端自動偵測，方便控制變因）
curl -i -c cookies.pst.txt -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"pst-tester@example.com","password":"Test1234!","display_name":"PST Tester"}'
```

### 步驟 B：將其時區改為 America/Los_Angeles
```bash
curl -i -b cookies.pst.txt -X PATCH http://localhost:3000/api/users/me/timezone \
  -H "Content-Type: application/json" \
  -d '{"timezone":"America/Los_Angeles"}'
# 預期：200，回傳 User 物件 timezone=America/Los_Angeles
```

### 步驟 C：驗證 GET /api/users/me
```bash
curl -s -b cookies.pst.txt http://localhost:3000/api/users/me | jq .timezone
# 預期："America/Los_Angeles"

curl -s -b cookies.pst.txt http://localhost:3000/api/users/me | jq .created_at
# 預期：以 Z 結尾的 ISO 8601 字串，例如 "2026-04-29T07:30:00.000Z"
```

### 步驟 D：負面測試（無效時區）
```bash
curl -i -b cookies.pst.txt -X PATCH http://localhost:3000/api/users/me/timezone \
  -H "Content-Type: application/json" \
  -d '{"timezone":"PST"}'
# 預期：400, code=ValidationError, field=timezone

curl -i -b cookies.pst.txt -X PATCH http://localhost:3000/api/users/me/timezone \
  -H "Content-Type: application/json" \
  -d '{"timezone":"UTC+8"}'
# 預期：400

curl -i -b cookies.pst.txt -X PATCH http://localhost:3000/api/users/me/timezone \
  -H "Content-Type: application/json" \
  -d '{"timezone":""}'
# 預期：400

# 確認原值未被覆寫
curl -s -b cookies.pst.txt http://localhost:3000/api/users/me | jq .timezone
# 預期：仍為 "America/Los_Angeles"
```

---

## 3. 模擬 PST 23:30 場景（User Story 1）

### 方法：以 `FAKE_NOW` 環境變數覆寫伺服器時鐘

於 `server.js` 既有架構引入小型測試 hook（已隨本功能加入 `lib/userTime.js` 的 `__nowMs()` 注入點）。

```bash
# 重啟伺服器，將「現在」鎖定為 PST 2026-04-29 23:30 對應的 UTC 時刻
# America/Los_Angeles 在 2026-04-29 為 PDT (UTC-7)，23:30 PDT = 2026-04-30 06:30 UTC
FAKE_NOW=2026-04-30T06:30:00Z npm start
```

### 步驟 A：以 PST 帳號新增一筆當地當天交易
```bash
# date 欄位由前端送出；此處模擬前端已用 todayInUserTz('America/Los_Angeles') = '2026-04-29'
curl -i -b cookies.pst.txt -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":100,"category":"餐飲","account_id":"<pst-user-acct>","date":"2026-04-29","note":"PST 晚餐"}'
# 預期：200，回傳的 created_at 為 2026-04-30T06:30:00.000Z
```

### 步驟 B：驗證「今日支出」歸屬正確
```bash
# 「今日」應為 PST 當地的 2026-04-29
curl -s -b cookies.pst.txt "http://localhost:3000/api/transactions?date=2026-04-29" | jq '.[].note'
# 預期：包含 "PST 晚餐"
```

### 步驟 C：快進 1 小時（過了當地午夜）
```bash
# 重啟伺服器，鎖到 PST 2026-04-30 00:30
FAKE_NOW=2026-04-30T07:30:00Z npm start
```

```bash
# 「今日」應為 PST 2026-04-30，剛才那筆已不在「今日」
curl -s -b cookies.pst.txt "http://localhost:3000/api/transactions?date=2026-04-30" | jq '.[].note'
# 預期：不包含 "PST 晚餐"

curl -s -b cookies.pst.txt "http://localhost:3000/api/transactions?date=2026-04-29" | jq '.[].note'
# 預期：仍包含 "PST 晚餐"

# 月份小計（4 月）應仍包含該筆
curl -s -b cookies.pst.txt "http://localhost:3000/api/reports/monthly?year_month=2026-04" | jq '.total_expense'
# 預期：≥ 100
```

### 步驟 D：驗證 Asia/Taipei 對照組未受影響
```bash
# 以 admin（Asia/Taipei）執行同樣操作，行為與升級前完全一致
# （regression test 通過 = 此項手測可省略）
```

---

## 4. 月度報表郵件 per-user 觸發（User Story 3）

### 方法：縮短排程心跳 + FAKE_NOW

```bash
# 環境變數啟用「測試心跳模式」(每 10 秒觸發一次掃描，加速驗證)
SCHEDULER_TICK_MS=10000 FAKE_NOW=2026-05-01T07:00:00Z npm start
# America/Los_Angeles 在 2026-05-01 為 PDT (UTC-7)，
# 2026-05-01 07:00 UTC = 2026-05-01 00:00 PDT ← 觸發點
```

### 步驟 A：確認 PST 使用者收到信
```bash
# 約 10 秒後檢查 monthly_report_send_log
sqlite3 database.db "SELECT user_id, year_month, sent_at_utc, send_status FROM monthly_report_send_log WHERE year_month = '2026-04';"
# 預期：pst-tester user_id 對應 1 列，send_status='success'
# year_month 為 '2026-04'（上個月，符合「月初寄上月」）

# 檢查實際信件（依專案郵件設定，可能寄到 mailtrap / 開發收件箱）
```

### 步驟 B：再下一個 tick 不重寄
```bash
# 不重啟伺服器，等下一個 tick (10 秒後)
sqlite3 database.db "SELECT COUNT(*) FROM monthly_report_send_log WHERE user_id = '<pst-user-id>' AND year_month = '2026-04';"
# 預期：仍為 1
```

### 步驟 C：對比 Asia/Taipei 使用者的觸發時刻
```bash
# 重新啟動，鎖到台灣 2026-05-01 00:00
FAKE_NOW=2026-04-30T16:00:00Z SCHEDULER_TICK_MS=10000 npm start
# 預期：admin (Asia/Taipei) 觸發；pst-tester 不觸發（其當地仍為 4-30 09:00）
sqlite3 database.db "SELECT user_id, year_month FROM monthly_report_send_log ORDER BY sent_at_utc DESC LIMIT 5;"
```

---

## 5. 前端時區偵測與顯示（User Story 2）

### 步驟 A：自動偵測（新使用者）
1. 開啟 Chrome DevTools → Sensors → Location → Timezone：選 `America/New_York`
2. 清除 cookies，註冊新帳號
3. 註冊完成後 `GET /api/users/me` 應回 `timezone: "America/New_York"`

### 步驟 B：既有使用者的提示流程
1. 以既有 admin（`Asia/Taipei`）登入
2. 將瀏覽器 timezone 改為 `Asia/Tokyo`
3. 重新整理頁面 → 應彈出一次性確認對話框「是否將時區改為 Asia/Tokyo？」
4. 點「不要」
5. 24 小時內重新整理頁面 → 不再彈出
6. 預期 `localStorage.tzPromptDismissedUntil` 存有未來 7 天的 timestamp

### 步驟 C：設定頁手動覆寫
1. 個人設定頁 → 時區下拉
2. 選 `Pacific/Auckland`
3. 儲存
4. 任何「今天」邏輯立即採用新時區（不需登出登入）— 對應 SC-006

### 步驟 D：時間欄位顯示一致
1. 以同一帳號 + 不同瀏覽器 system tz（PST、Asia/Taipei、Europe/London）登入
2. 檢視同一筆交易的 `created_at` 顯示
3. 預期：三者顯示「同一個」當地時間（依 user.timezone 而非瀏覽器 tz），且該時間旁有 tz 標註（如 `(Pacific/Auckland)`）

---

## 6. 驗證 OpenAPI 與憲章

```bash
# OpenAPI lint（憲章 II）
npx @redocly/cli lint openapi.yaml
# 預期：0 errors

# 子 contract 也應為 3.2.0
grep "openapi: 3.2.0" specs/009-multi-timezone/contracts/*.yaml

# 憲章已升至 1.3.0 並包含 Principle IV
grep -E "Version.*1\.3\.0|Principle IV" .specify/memory/constitution.md
```

---

## 6.5 跨瀏覽器 tz 矩陣（SC-005，手測）

於 6 個典型瀏覽器系統時區下分別開啟同一帳號，驗證 UI 行為一致：

| 瀏覽器系統 tz | 期望行為 | 驗證方式 |
|---|---|---|
| `UTC` | UI 時間顯示與帳號 `timezone` 一致；非依瀏覽器 tz | 開 DevTools → Sensors → Timezone → `UTC`（或 `Etc/UTC`），重新整理頁面 |
| `Asia/Taipei` | 同上 | 同上 |
| `America/Los_Angeles` | 同上 | 同上 |
| `Europe/London` | 同上 | 同上 |
| `Asia/Tokyo` | 同上 | 同上 |
| `Pacific/Auckland` | 同上 | 同上 |

**驗證重點**：
1. 同一筆交易的 `created_at` 顯示應在 6 種瀏覽器 tz 下完全相同（依帳號 `timezone`）
2. 「今日支出」邊界應在 6 種瀏覽器 tz 下完全相同
3. 透過 `currentUser.timezone` 而非 `Intl.DateTimeFormat()` 系統 tz 控制顯示

如果發現某 tz 下行為偏離，問題可能出在：
- `formatLocalDateTime(...)` 未替換散落的 `new Date(x).toLocaleString()`（T039 暫緩項，後續 PR）
- `getUserTz()` fallback 順序錯（應 `currentUser.timezone || 'Asia/Taipei'`）

---

## 7. 回歸驗證（既有 Asia/Taipei 使用者，SC-001）

執行專案既有測試套件：

```bash
npm test  # 若存在
# 或
node test/run-all.js  # 若採用自製 runner
```

**預期**：所有既有 spec（001~008）對應的測試通過率為 100%；任何回歸即視為本功能 PR 阻擋條件。

額外手動驗證（admin / Asia/Taipei）：
- 登入後「今日支出」「本月小計」「未來交易」與升級前數值一致
- 既有 `report_schedules` 月度排程在台灣 1 號 00:00 仍觸發

---

## 8. 常見排錯

| 症狀 | 可能原因 | 處置 |
|---|---|---|
| `monthly_report_send_log` 每分鐘寄一次 | UNIQUE 約束未建或心跳間隔判斷錯誤 | 檢查 `data-model.md §3` schema；驗證 `local.minute < 5` 條件 |
| Asia/Taipei 使用者「今天」變動 1 天 | `lib/userTime.js` 預設 fallback 寫成 `Date.now()` 而非帶 tz | 改用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })` |
| 前端時區下拉表清單為空 | `Intl.supportedValuesOf` 舊瀏覽器不支援（< Chrome 99） | 提供白名單 fallback（10 個常用時區） |
| 升級後既有使用者 `timezone` 為 NULL | SQLite 版本 < 3.32 不支援 NOT NULL DEFAULT 套用既有列 | `UPDATE users SET timezone = 'Asia/Taipei' WHERE timezone IS NULL` 補刀 |
| TWSE 投資頁面在非台灣使用者顯示「閉市」誤判 | 誤把 `lib/twseFetch.js` 內部時間判斷改成 user.timezone | 還原該檔；FR-014 例外規則 |
