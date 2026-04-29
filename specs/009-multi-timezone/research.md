# 技術研究：多時區支援

**Feature**: 009-multi-timezone
**Date**: 2026-04-29
**輸入**: [spec.md](./spec.md)

本研究旨在解決計畫階段五個關鍵未知，並為實作選定具體方案。每節以「Decision / Rationale / Alternatives considered」格式呈現。

---

## R1：Node.js 內建 ICU 是否覆蓋全 IANA tz database

### Decision
依賴 Node.js ≥ 14（LTS）內建的 `full-icu`，不額外引入第三方時區庫（`luxon`、`date-fns-tz`、`dayjs/plugin/timezone`）。

### Rationale
- 自 Node.js v14 起，官方 LTS 版本預設綁定 `full-icu`（小型化的 ICU 已不是 default），覆蓋約 600 個 IANA 時區與所有歷史 DST 規則。
- `Intl.DateTimeFormat(..., { timeZone })`、`Date.toLocaleString(..., { timeZone })` 已可滿足本功能所有需求：
  - 取得「使用者本地當天 YYYY-MM-DD」：`Intl.DateTimeFormat('en-CA', { timeZone, year, month, day }).format(now)`
  - 取得「使用者本地 ISO 月份 YYYY-MM」：上式 `.slice(0,7)`
  - 計算「使用者本地某時刻對應的 UTC ms」：以 `Intl.DateTimeFormat` 反推 + 二分校正，或直接使用 `formatToParts` 解析。
- 既有 `lib/taipeiTime.js` 即用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })`，已驗證在生產環境穩定。
- 部署 Docker base image 為 `node:20-alpine`，自 v18 起 alpine 也預設 full-icu。

### Alternatives considered
- **luxon**: 功能完整但增加 70KB+ 依賴、學習成本，且其 `setZone` 仍底層呼叫 ICU，無新能力。
- **dayjs + plugin/timezone + plugin/utc**: 體積較小但 API 鬆散、tz plugin 仍需 ICU；複雜度 vs 收益不對等。
- **moment-timezone**: 已 deprecated，不考慮。
- **自己打包 IANA tz database**: 維護負擔過高，且重複 ICU 的工作。

### 驗證項
- `Intl.supportedValuesOf('timeZone').length` 在容器內 ≥ 400（若 < 400 表示 ICU 縮水，build fail）。
- 新增單元測試：`Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', ... })` 可正確輸出。

---

## R2：DST 邊界對「使用者當地當月」邏輯的影響

### Decision
所有「當地某日／某月」邏輯一律以 `Intl.DateTimeFormat('en-CA', { timeZone })` 直接格式化「當下 UTC 瞬時」，**不**手動加減偏移量。DST 由 ICU 處理。

### Rationale
- `transactions.date` 為「當地自然日字串」，DST 不影響其格式（仍 `YYYY-MM-DD`）。
- `monthInUserTz(now)` 的回傳僅取決於「now 的瞬時值落在使用者時區的哪個自然月」，DST 不影響月份歸屬（DST 切換永遠在同一個自然月內，不跨月）。
- 月度郵件「本地 1 號 00:00」邏輯：
  - 以 `Intl.DateTimeFormat` 取得「now 在使用者時區下的 year/month/day/hour/minute」。
  - 條件：`day == 1 AND hour == 0 AND minute < 心跳間隔`。
  - DST 跳過的 02:30 不會干擾此判斷（00:00 永遠存在）。
  - DST 重複的 01:30 也不會（00:00 永遠唯一）。
- 風險場景：少數時區（如 `America/Asuncion`）DST 切換落在 23:00→00:00，可能造成「該日 00:00 出現兩次」。對策：以 `(user_id, year_month)` 為 dedup 鍵的 `monthly_report_send_log`（見 data-model.md），首次成功寫入後第二次嘗試 `INSERT OR IGNORE` 即不重寄。

### Alternatives considered
- **手動以 UTC offset 計算**：需自己維護 IANA 規則，遇 DST 失誤難察覺。
- **將 user.timezone 限制為「無 DST」白名單**：產品價值倒退，拒絕。

### 驗證項
- 單元測試 5 組：`America/Los_Angeles`（春→夏跳過 02:00→03:00、秋→冬重複 01:00→01:00 兩次）、`Asia/Taipei`（無 DST 對照組）、`Pacific/Auckland`（南半球反向）、`America/Asuncion`（深夜切換）、`Europe/London`。
- 每組測試「跨 DST 邊界當天的 todayInUserTz / monthInUserTz / 月初 00:00 觸發」均行為正確。

---

## R3：排程器心跳間隔取捨（1min vs 5min vs 15min）

### Decision
**5 分鐘**心跳；月度排程觸發判斷以「`now 在使用者時區下的 day == 1 AND hour == 已設定 hour AND minute < 5`」為條件，輔以 dedup log 確保不重寄。

### Rationale
| 心跳間隔 | 寄送延遲（最壞） | CPU 成本（每次掃 N 個 user） | 與既有實作衝突 |
|---|---|---|---|
| 1 min | < 1 min | 24× / 5min | 既有排程器可能不是 1min 顆粒，需改 setInterval |
| 5 min | < 5 min | 12× / hour，N=10000 → 33 reads/s | 與既有 setInterval 顆粒一致或可微調 |
| 15 min | < 15 min | 4× / hour | 月度郵件「半夜 00:15 才到」對使用者體感較差 |

- 5 分鐘對「月初 00:00」場景的延遲最壞 4:59，使用者體感為「凌晨剛過就收到」；對 N=10k 規模 SQLite 單機可承受。
- 既有 `report_schedules` 在 `server.js:5293` 的 daily/weekly 邏輯也可沿用 5 分鐘心跳改寫。
- SC-003 要求 95% ≤ 30 分鐘延遲，5 分鐘心跳可達 100%。

### Alternatives considered
- **每分鐘心跳 + 加快寄送速度**：對單機 SQLite 過度浪費 IO；信箱 throttling 更可能成為瓶頸。
- **依「下次該寄」事件驅動排程**：實作複雜度高、需考慮 process restart 後重建事件、與既有輪詢邏輯衝突。

### 驗證項
- 整合測試：將伺服器時鐘快進至 PST 1 號 00:00，5 分鐘內必觸發；同一帳號於同一 year_month 第二次觸發必跳過。
- SC-003 抽樣指標：在預備環境跑 100 個假帳號分別設不同時區，記錄實際送達延遲。

---

## R4：Express middleware 注入 user.timezone 的效率

### Decision
在 JWT 驗證 middleware 之後緊接一個 `attachUserTimezone` middleware：對「需要時區感知」的 API 路由，於 `req` 上掛 `req.userTimezone`（字串）；同 request 範圍內快取，避免重複 SELECT。

### Rationale
- 既有 `server.js` 已有 JWT middleware 解析 `req.userId`；在其後加 `req.userTimezone = SELECT timezone FROM users WHERE id = ?` 即可。
- better-sqlite3 的 prepared statement + WAL 在單機 1k req/s 下 1 次 SELECT 約 30µs，可忽略。
- 對 `/api/users/me` 等只需要回傳 user 物件的端點，可一次 SELECT 全 user，順帶取 timezone。
- 不放在 JWT decode 階段：避免在不需要 timezone 的端點（如 `/api/healthz`、`/api/login`）多做查詢。
- 將 `lib/userTime.js` 的 `todayInUserTz(tz)` 設計為「直接接受 tz 字串」而非「接受 userId 自動查表」，呼叫端用 `todayInUserTz(req.userTimezone)`，可獲得：
  - 純函式更易單元測試
  - 同一 request 多次呼叫不重複查表
  - 排程器掃 user 時能批次傳 tz 字串

### Alternatives considered
- **每次呼叫 lib/userTime 都 SELECT**：浪費；同 request 內多處呼叫會放大成本。
- **將 timezone 寫進 JWT payload**：JWT 過期前修改時區會失效；需登出登入才生效，違反 SC-006「1 秒內反映」。
- **Redis 快取 user.timezone**：本專案無 Redis，不為此功能引入新基礎設施。

### 驗證項
- 效能基準：對隨機選取的 5 個時區感知端點，加入 middleware 前後 p95 延遲差 < 1ms。
- 單元測試：`todayInUserTz('America/Los_Angeles')` 在 mock now 下回傳預期字串。

---

## R5：時區自動偵測與「既有使用者 vs 新使用者」分流

### Decision
- **新使用者**（註冊或 OAuth 第一次登入）：前端在註冊／首次登入完成後立即送出 `PATCH /api/users/me/timezone`，將瀏覽器偵測到的 IANA 字串寫入；伺服器側允許「初次寫入」覆寫預設值。
- **既有使用者**：登入流程不主動覆寫；前端登入後比對 `currentUser.timezone` 與 `Intl.DateTimeFormat().resolvedOptions().timeZone`，若不同則彈出一次性確認對話框（dismiss 後 7 天內不再顯示，使用 `localStorage.tzPromptDismissedUntil`）。

### Rationale
- 出差／VPN／伺服器代理可能讓瀏覽器回報非「使用者真實時區」，自動覆寫會傷既有使用者體驗。
- 區分「新／既有」可由 `users.timezone == 'Asia/Taipei'` 結合 `users.created_at` 判斷，但更明確的做法是：前端先呼叫 `GET /api/users/me`，若 timezone 為 NULL 或預設且 `prompted == false`，才走偵測流程。
- 7 天靜默期由 `localStorage` 提供，避免每次登入打擾。

### Alternatives considered
- **永遠以瀏覽器時區覆寫**：既有 Asia/Taipei 使用者出差到日本登入會被改成 Asia/Tokyo，回國後又被改回，破壞 SC-001 regression-free。
- **完全不自動偵測**：使用者必須手動找到設定，95% 不會做，P2 形同失效。
- **以 IP 地理位置推測**：本專案無 IP 地理庫；瀏覽器偵測足夠。

### 驗證項
- 整合測試：以新註冊帳號 + 不同瀏覽器 tz 設定，驗證寫入正確 IANA。
- 整合測試：既有 `Asia/Taipei` 帳號 + 瀏覽器 tz 為 `America/New_York`，驗證僅彈窗、未自動覆寫；點「不要」後 7 天內不再彈。

---

## R6：DB 升級策略

### Decision
沿用既有 idempotent `ALTER TABLE ... ADD COLUMN` 模式（見 `server.js:895-940`）：
- `ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'` 包在 try/catch；既有列自動套用 default。
- 新增 `monthly_report_send_log` 表用 `CREATE TABLE IF NOT EXISTS`。
- 不需要 PRAGMA user_version 跳號（本專案沒採用此機制）。
- 升級失敗時保留 `database.db.bak.<ts>.before-009` 備份（既有 `migration 002` 已示範該模式）。

### Rationale
- 維持與專案其他 migration 一致。
- SQLite 不支援 ALTER COLUMN，但本功能只是 ADD COLUMN，無需重建表。
- NOT NULL DEFAULT 對 ALTER 既有列：SQLite 自 v3.32（2020）起允許此語法（better-sqlite3 嵌入版本 ≥ 此），既有列自動填 default。

### Alternatives considered
- **重建 users 表**：過度；ADD COLUMN 即足夠。
- **引入 knex/prisma migrations**：逾越本功能範圍；本專案至今無 migration framework，逐步增量遷移已穩定。

### 驗證項
- 升級後 `PRAGMA table_info(users)` 應含 `timezone` 欄位、`notnull=1`、`dflt_value='Asia/Taipei'`。
- `SELECT COUNT(*) FROM users WHERE timezone IS NULL` 應為 0。

---

## 待解決事項

無。所有 spec 層面的 NEEDS CLARIFICATION 已於 spec.md 階段消化；技術選型於本研究皆有明確 Decision。
