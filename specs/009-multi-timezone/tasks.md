# Tasks: 多時區支援（Multi-Timezone Support）

**Input**: 設計文件 [specs/009-multi-timezone/](.) — `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/multi-timezone.openapi.yaml`、`quickstart.md`
**Branch**: `009-multi-timezone`
**Tests**: 含。Spec SC-001 / SC-003 / SC-004 / SC-005 明文要求自動化 regression 測試 0 失敗、自動掃描器 fail build；本 task list 將測試任務直接內嵌各 user story 區塊。

**組織原則**: 以 user story 為主軸切 phase；P1 完成即可獨立部署成 MVP，P2 / P3 為加值增量。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可並行（不同檔案、無前置）
- **[Story]**：US1 / US2 / US3 對應 spec 中的 P1 / P2 / P3 user stories
- 每個任務含明確檔案路徑

---

## Phase 1: Setup（共用前置）

**Purpose**: 開發環境就緒檢查、測試夾具。

- [X] T001 環境檢查：本機 Node `Intl.supportedValuesOf('timeZone').length` = **418**（≥ 400 ✓）；6 組關鍵時區（Asia/Taipei、America/Los_Angeles、Europe/London、Asia/Tokyo、Pacific/Auckland、America/Asuncion）全部可解析。
- [X] T002 [P] [Dockerfile](../../Dockerfile) base image 為 `node:24-alpine`（比規格設定的 `node:20-alpine` 更新；node 24 LTS 預設 full-icu），ICU 涵蓋達標，**無需調整**。

---

## Phase 2: Foundational（阻塞前置 — 所有 user story 啟動前必須完成）

**⚠️ CRITICAL**: 任何 user story 工作開始前必須完成本階段；憲章修訂亦在此完成以避免後續違憲。

### 憲章 / 治理

- [X] T003 升級憲章 v1.2.0 → v1.3.0：在 [.specify/memory/constitution.md](../../.specify/memory/constitution.md) 頂部新增 Sync Impact Report；新增 `IV. Time & Timezone Discipline — NON-NEGOTIABLE`（後端一律 UTC ISO 8601 `Z`，使用者「當地」一律 per-user IANA，TWSE 等市場時間例外於源碼註解標明）；修訂 FR-007a 為「per-user `users.timezone`，預設 `Asia/Taipei`」；更新 footer `Version: 1.3.0`、`Last Amended: 2026-04-29`

### DB Schema Migration

- [X] T004 [P] users.timezone 欄位（NOT NULL DEFAULT 'Asia/Taipei'）+ NULL/empty 補刀，已加於 [server.js](../../server.js) 既有 migration 區塊
- [X] T005 [P] monthly_report_send_log 表 + UNIQUE(user_id, year_month) + idx，已加於同區塊
- [X] T006 升級備份：條件式（僅當 timezone 欄位尚未存在時）複製 `database.db.bak.<ts>.before-009`，已驗證產生檔案 `database.db.bak.1777460698999.before-009`

### 後端工具層

- [X] T007 新增 [lib/userTime.js](../../lib/userTime.js)，匯出純函式：
  - `isValidIanaTimezone(tz)`（基於 `Intl.supportedValuesOf('timeZone')`，明確拒絕 `''`、`null`、`'PST'`、`'UTC+8'`）
  - `todayInUserTz(tz)`：回 `'YYYY-MM-DD'`
  - `monthInUserTz(tz, dateOrNull)`：回 `'YYYY-MM'`
  - `isFutureDateForTz(tz, dateStr)`：回 boolean
  - `partsInTz(tz, msOrDate)`：回 `{ year, month, day, hour, minute, weekday }`（scheduler 使用）
  - `toIsoUtc(value)`：接受 `number`/`string`/`Date` → 一律 `'YYYY-MM-DDTHH:mm:ss.sssZ'`；無毫秒輸入補 `.000`；非 `Z` 結尾或含偏移視為違規（throw）
  - `isValidIsoDate(s)`：沿用既有 `lib/taipeiTime.js` 邏輯
  - `__nowMs()` / `__setNowMs(ms|null)`：測試 hook，預設讀 `process.env.FAKE_NOW`（ISO 字串）→ ms，否則 `Date.now()`
- [X] T008 改寫 [lib/taipeiTime.js](../../lib/taipeiTime.js) 為 thin wrapper：每個既有匯出函式內部呼叫 `lib/userTime.js` 的對應函式並固定傳 `'Asia/Taipei'`；保留既有 `module.exports` shape 維持向後相容
- [X] T009 採「實作建議」路徑：於 [server.js](../../server.js) 既有 `authMiddleware` 函式內部，將其原本 `SELECT token_version FROM users` 擴成 `SELECT token_version, timezone FROM users`，並於成功路徑補 `req.userTimezone = user.timezone || 'Asia/Taipei';`。零額外 SELECT；公開端點不經 authMiddleware 自然無 timezone 注入。

### Foundational 測試

- [X] T010 [P] [tests/lib/userTime.test.js](../../tests/lib/userTime.test.js) 完成；50/50 pass。覆蓋 7 個純函式：
  - `isValidIanaTimezone`：正例 5 組（`Asia/Taipei`、`America/Los_Angeles`、`Europe/London`、`Pacific/Auckland`、`UTC`）／反例 4 組（`'PST'`、`'UTC+8'`、`''`、`null`）
  - `todayInUserTz`：5 組 DST 邊界（PST 春跳、PST 秋重、Pacific/Auckland 南半球、Asia/Taipei 對照、America/Asuncion 深夜切換）下與 `Intl.DateTimeFormat` 結果一致
  - `monthInUserTz`：跨月（PST 4-30 23:30 → `'2026-04'`；同瞬時 PST 5-1 00:30 → `'2026-05'`）、跨年（Asia/Taipei 12-31 23:30 → `'2026-12'`；同瞬時 1-1 00:30 → `'2027-01'`）、不傳 `dateOrNull` 時等同 `now()`
  - `isFutureDateForTz`：3 組（過去日 → false、當天 → false、未來日 → true）；每組於 PST + Asia/Taipei 兩時區交叉驗證「跨日臨界」行為
  - `partsInTz`：對相同 ms 與 `Intl.DateTimeFormat.formatToParts` 拆解結果完全一致；包含 `weekday` 0–6 對應驗證
  - `toIsoUtc`：接受 ms / Date / `'2026-04-29 07:30:00'`（無 T、無 Z）／ `'2026-04-29T07:30:00.000Z'`（已是 `.sssZ`）／ `'2026-04-29T07:30:00Z'`（無毫秒，補 `.000`）5 種輸入皆輸出合法 `.sssZ`；對 `'2026-04-29T07:30:00+08:00'`、`'invalid'`、`null`、`undefined` 擲錯
  - `isValidIsoDate`（沿用既有 `lib/taipeiTime.js` 邏輯，re-export）：合法 `'2026-04-29'` → true；月日越界 `'2026-02-30'`、`'2026-13-01'`、`'2026-04-31'` → false；非 ISO 格式 `'2026/04/29'`、`'04-29-2026'`、`'2026-4-29'` → false；非字串 `null`、`undefined`、`20260429` → false
- [X] T011 [P] [tests/migration/migration-009.test.js](../../tests/migration/migration-009.test.js) 完成；11/11 pass。`npm run test:tz` 一併跑兩支測試。

**Checkpoint**: Foundation ready — user story 可開始平行進行。

---

## Phase 3: User Story 1（P1）— 非台灣使用者的「自然日」正確歸屬 🎯 MVP

**Goal**: 美國 PST 使用者於當地 23:30 記帳，被歸入當地當日／當月；既有 Asia/Taipei 使用者完全不變（regression-free）。

**Independent Test**: 將測試帳號 `timezone` 設為 `America/Los_Angeles`，於 `FAKE_NOW=2026-04-30T06:30:00Z` 新增 `date=2026-04-29` 支出 → 出現於「今日」、不出現於「未來」；快進到 `FAKE_NOW=2026-04-30T07:30:00Z` → 「今日」改為 PST 4-30，原交易進「昨日」。

### 測試（先寫，初次必失敗）

- [ ] T012 [P] [US1] 撰寫 [tests/integration/legacy-taipei-regression.test.js](../../tests/integration/legacy-taipei-regression.test.js)：admin（`Asia/Taipei`）對「餘額／預算／月份報表／未來日驗證／定期交易展開」全部端點打一輪，response payload 與升級前 baseline 完全一致（snapshot 比對）
- [ ] T013 [P] [US1] 撰寫 [tests/integration/pst-natural-day.test.js](../../tests/integration/pst-natural-day.test.js)：模擬 PST 23:30 / 00:30 / 月底跨月三個時間點，分別驗證「今日／本月／餘額（未來日不計）」歸屬
- [ ] T014 [P] [US1] 撰寫 [tests/integration/iso-utc-output.test.js](../../tests/integration/iso-utc-output.test.js)：對隨機抽樣的 10 個有 `*_at` 回應欄位的端點，斷言全部回應字串符合 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`

### 後端：替換既有「Asia/Taipei 寫死」呼叫點

- [ ] T015 [US1] 在 [server.js](../../server.js) 約 `:6541-6542`（餘額計算 — FR-007）改 `taipeiTime.todayInTaipei()` → `userTime.todayInUserTz(req.userTimezone)`
- [ ] T016 [US1] 在 [server.js](../../server.js) 約 `:6661`（餘額另一處）同 T015 替換
- [ ] T017 [US1] 在 [server.js](../../server.js) 約 `:6732`（交易日期驗證）改 `taipeiTime.isValidIsoDate(date)` 保留，但若呼叫處有 `isFutureDate(date)` 則改為 `userTime.isFutureDateForTz(req.userTimezone, date)`
- [ ] T018 [US1] 在 [server.js](../../server.js) 約 `:7875、:7938`（定期交易展開的 ISO 日驗證）做同 T017 替換
- [ ] T019 [US1] 在 [server.js](../../server.js) 約 `:8042-8060`（定期交易展開）改 `taipeiTime.todayInTaipei()` → per-schedule 的 `userTime.todayInUserTz(...)`。**注意**：此函式於 scheduler context 執行，**無 `req.userTimezone`**，必須從 user 表取出。具體做法：
  1. 將既有 `queryAll("SELECT * FROM recurring_schedules WHERE ...")` 改為 JOIN：`SELECT s.*, u.timezone AS user_timezone FROM recurring_schedules s JOIN users u ON s.user_id = u.id WHERE u.is_active = 1 AND <既有條件>`
  2. for-each row 內：
     - `const todayS = userTime.todayInUserTz(row.user_timezone);`
     - `while (scheduledDate <= todayS) { ... }` 既有展開迴圈不變
  3. 若展開過程需驗證 `scheduledDate` 為合法 ISO 日期，續用 `userTime.isValidIsoDate(scheduledDate)`（無時區依賴）
  4. 同步檢查 `:7875、:7938` 周邊的「定期交易展開的 ISO 日驗證」（已於 T018 處理 `isFutureDateForTz`）— 確認本 task 與 T018 不重複改動同一行
- [ ] T020 [US1] 在 [server.js](../../server.js) 新增 `transactions` POST/PATCH handler 內部「未提供 `date` 時的預設」改為 `userTime.todayInUserTz(req.userTimezone)`（搜尋 `el('txDate').value` 對應後端）
- [ ] T021 [US1] 將 [server.js](../../server.js) 所有 timestamp 性質欄位回應統一以 `userTime.toIsoUtc()` 包裝。**做法（兩階段）**：
  - **T021a：列舉**。執行 `grep -nE 'res\.json|JSON\.stringify' server.js`，再對結果交叉 `grep -nE 'created_at|updated_at|last_login_at|last_run|sent_at|timestamp|expires_at|deleted_at'`，於 PR 描述（或本 task 上方註解）列出**完整端點 + 行號清單**（約估 20–40 處）
  - **T021b：逐一替換**。針對 T021a 清單，將原始值（可能是 SQLite 字串、Unix ms、Date 物件）改為 `userTime.toIsoUtc(value)`；若該回應結構為陣列，於 `.map(row => ({ ..., created_at: userTime.toIsoUtc(row.created_at) }))` 包裝
  - **驗證**：T021 完成後，T053（自動掃描器）必須 0 違例；若 T053 仍 fail，補回 T021a 漏列的端點再修
- [ ] T022 [US1] 月度報表郵件信件內所有「時間／日期」字串改以 `userTime.partsInTz(user.timezone, ms)` 格式化（移除任何 `Asia/Taipei` 寫死於信件模板的邏輯，但保留台股相關段落如有的話依 FR-014 例外）

### 前端：「今天」字串改為 user.timezone（提早做以對齊後端，避免請求／回應不對稱）

- [ ] T023 [US1] 在 [app.js](../../app.js) `:393-405`（既有 `todayInTaipei`）新增 `getUserTz()` 與 `todayInUserTz()` 工具；保留 `todayInTaipei()` 為 alias 直接呼叫 `todayInUserTz()` 以避免一次性大量改名
- [ ] T024 [US1] 在 [app.js](../../app.js) `:8320` 將 `el('txDate').value = todayInTaipei()` 改為 `el('txDate').value = todayInUserTz()`

### TWSE 例外註解（FR-014）

- [ ] T025 [US1] 在 [lib/twseFetch.js](../../lib/twseFetch.js) 內所有「市場開盤判斷」的 `Asia/Taipei` 寫死處加註解 `// FR-014: TWSE 市場時間鎖 Asia/Taipei，與 users.timezone 無關`；同樣在 [server.js](../../server.js) `:8351` 周邊「台股交易時間」判斷加註解

**Checkpoint**: P1 通過 — 既有 Asia/Taipei 使用者 100% 行為不變（T012），PST 場景正確歸屬（T013），ISO UTC 格式統一（T014）。可獨立 demo / 部署 MVP。

---

## Phase 4: User Story 2（P2）— 自動偵測並可手動調整時區

**Goal**: 註冊／首次登入時自動偵測瀏覽器 tz；既有使用者一次性提示（7 天靜默）；個人設定頁可手動覆寫；變更寫稽核。

**Independent Test**: 新瀏覽器（系統 tz `Europe/London`）註冊 → `GET /api/users/me` 回 `Europe/London`；既有 `Asia/Taipei` 帳號 + 瀏覽器 `America/New_York` → 登入彈一次性 modal，按「不要」7 天內不再彈；設定頁改 `Asia/Tokyo` → 立即生效；非法 tz `'PST'` PATCH → 400；資料庫稽核紀錄存在。

### 測試

- [ ] T026 [P] [US2] 撰寫 [tests/integration/users-me.test.js](../../tests/integration/users-me.test.js)：未登入 → 401；登入 → 200 含 `timezone`、`created_at` 為 `.sssZ` 字串
- [ ] T027 [P] [US2] 撰寫 [tests/integration/timezone-patch.test.js](../../tests/integration/timezone-patch.test.js)：合法 IANA → 200；非法（`'PST'`、`'UTC+8'`、`''`、缺欄位、`null`）→ 400 + 原值不變；no-op（同值）→ 200 不寫 audit
- [ ] T028 [P] [US2] 撰寫 [tests/integration/timezone-audit.test.js](../../tests/integration/timezone-audit.test.js)：每次成功變更後 `data_operation_audit_log` 多一列，`action='user.timezone.update'`、metadata JSON 含 `from`/`to`/`source`

### 後端 API

- [ ] T029 [US2] 在 [server.js](../../server.js) 新增 `app.get('/api/users/me', requireAuth, ...)` handler（schema 見 [contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)）；boolean 欄位（`has_password`、`is_admin`、`is_active`）以 JS boolean 回；`*_at` 一律過 `userTime.toIsoUtc()`
- [ ] T030 [US2] 在 [server.js](../../server.js) 新增 `app.patch('/api/users/me/timezone', requireAuth, ...)` handler：(a) 驗證 `userTime.isValidIanaTimezone(timezone)` 否則 400 `ValidationError field=timezone`；(b) 讀舊值 `prev`；若同值直接回 200 + 完整 user（no-op，不寫 audit）；(c) UPDATE + `users.updated_at`；(d) 寫 `data_operation_audit_log` 一列；(e) 回完整 user 物件（與 GET /me 結構一致）。
  - **關於 audit 寫入**：本專案**沒有** `writeAuditLog` helper（已驗證 — 其他 handler 直接寫 INSERT，例 `server.js:2829`）。本 task 不抽 helper，沿用既有風格直接 INSERT：
    ```js
    db.run(
      "INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        crypto.randomUUID().replace(/-/g, ''),
        req.userId,
        'user',
        'user.timezone.update',
        req.ip || '',
        req.get('user-agent') || '',
        new Date().toISOString(),
        'success',
        0,
        JSON.stringify({ from: prev, to: timezone, source: src }),
      ]
    );
    ```
  - **ID 生成方式**：沿用既有 [server.js:1806](../../server.js#L1806) 慣例 `crypto.randomUUID().replace(/-/g, '')`；不引入 `uuid` package。
  - `src` 規則：`source === 'manual' || source === 'auto-detect' ? source : 'manual'`（白名單防注入）
- [ ] T031 [US2] 在 [server.js](../../server.js) 註冊 / OAuth callback handler：保留既有預設 `'Asia/Taipei'` 寫入；不在後端做自動偵測（前端負責）

### 前端：登入後流程與設定頁

- [ ] T032 [US2] 在 [app.js](../../app.js) 加全域工具：`getUserTz()`、`formatLocalDateTime(isoString, options?)`（用 `Intl.DateTimeFormat(undefined, { timeZone: getUserTz(), ... })`）、`formatLocalDate(isoString)`、`getCurrentBrowserTz()`
- [ ] T033 [US2] 在 [app.js](../../app.js) 登入後流程：呼叫 `GET /api/users/me`，將回應寫入 `currentUser`；於 `currentUser` 賦值處加 timezone fallback `'Asia/Taipei'`
- [ ] T034 [US2] 在 [app.js](../../app.js) 加「既有使用者首次登入提示」邏輯（依 FR-010 (b) 三條件 AND 判斷）；按「是」→ `PATCH /api/users/me/timezone { timezone, source: 'auto-detect' }` + 清除 `localStorage.tzPromptDismissedUntil`；按「不要」→ 寫 `localStorage.tzPromptDismissedUntil = Date.now() + 7 * 86400_000`
- [ ] T035 [US2] 在 [app.js](../../app.js) 加「新註冊／OAuth 完成」流程：在註冊成功 callback 內 `PATCH /api/users/me/timezone { timezone: getCurrentBrowserTz(), source: 'auto-detect' }`（一次性，無需 prompt）
- [ ] T036 [US2] 在 [index.html](../../index.html) 個人設定頁新增「時區」區塊（與「主題模式」相鄰位置）：標籤、目前設定顯示、搜尋下拉、即時預覽（「現在當地時間：…」）、儲存按鈕
- [ ] T037 [US2] 在 [app.js](../../app.js) 個人設定頁時區下拉資料源：`Intl.supportedValuesOf('timeZone')`；若不支援則 fallback 10 項白名單（`Asia/Taipei`、`Asia/Tokyo`、`Asia/Shanghai`、`Asia/Singapore`、`Europe/London`、`Europe/Paris`、`America/New_York`、`America/Los_Angeles`、`Australia/Sydney`、`UTC`）
- [ ] T038 [US2] 在 [app.js](../../app.js) 設定頁儲存按鈕呼叫 `PATCH /api/users/me/timezone { timezone, source: 'manual' }`；成功後更新 `currentUser.timezone` 並重新渲染所有時間欄位（不需 reload，達成 SC-006）
- [ ] T039 [US2] 在 [app.js](../../app.js) 替換所有「時間／日期顯示」呼叫處：原 `new Date(x).toLocaleString()` / `toLocaleDateString()` 改為 `formatLocalDateTime(x)` / `formatLocalDate(x)`；列出搜尋詞 `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` 一一替換
- [ ] T040 [US2] 在 [style.css](../../style.css) 補時區下拉的視覺樣式（搜尋輸入框 + 即時預覽區塊）

**Checkpoint**: P2 通過 — 自動偵測 + 提示 + 手動覆寫 + 稽核全鏈路 OK；P1 與 P2 皆獨立可用。

---

## Phase 5: User Story 3（P3）— 月度報表郵件依使用者本地時區寄送

**Goal**: 月度報表在使用者當地 1 號 00:00 後 ≤ 5 分鐘觸發；不重寄；失敗保留 audit 不自動重試。

**Independent Test**: PST 使用者於 `FAKE_NOW=2026-05-01T07:00:00Z`（PDT 月初 00:00）+ `SCHEDULER_TICK_MS=10000` → ≤10 秒內 `monthly_report_send_log` 多一列；下個 tick 不重寄；切到 `FAKE_NOW=2026-04-30T16:00:00Z`（台北月初）→ 對 admin 觸發、PST 不觸發。

### 測試

- [ ] T041 [P] [US3] 撰寫 [tests/integration/monthly-report-pst.test.js](../../tests/integration/monthly-report-pst.test.js)：模擬 PST 月初觸發、台北未觸發
- [ ] T042 [P] [US3] 撰寫 [tests/integration/monthly-report-dedup.test.js](../../tests/integration/monthly-report-dedup.test.js)：同一 user × year_month 二次 INSERT → SQLITE_CONSTRAINT_UNIQUE，scheduler 跳過不寄
- [ ] T043 [P] [US3] 撰寫 [tests/integration/monthly-report-dst.test.js](../../tests/integration/monthly-report-dst.test.js)：在 PST 秋季 DST 重複 01:00 場景下，確認月初 00:00 仍只觸發一次（DST 重複不在 00:00）
- [ ] T044 [P] [US3] 撰寫 [tests/integration/monthly-report-failed.test.js](../../tests/integration/monthly-report-failed.test.js)：mock 寄信失敗 → `send_status='failed'` + `error_message`；下個 tick 不重試（FR-018）

### 後端排程器

- [ ] T045 [US3] 在 [server.js](../../server.js) 約 `:5293` 周邊改寫 scheduler tick：(a) 環境變數 `SCHEDULER_TICK_MS`（預設 `5 * 60 * 1000`）；(b) 取所有 `enabled=1` 的 `report_schedules` JOIN `users (is_active=1)` 一次撈；(c) 對每筆 row 計算 `local = userTime.partsInTz(user.timezone, userTime.__nowMs())`；(d) `matchesTrigger(sch, local)` 判斷
- [ ] T046 [US3] 在 [server.js](../../server.js) scheduler 的 monthly 分支：先 `INSERT INTO monthly_report_send_log (id, user_id, year_month, schedule_id, sent_at_utc) VALUES (...)`；catch `SQLITE_CONSTRAINT_UNIQUE` → 跳過；其他錯誤 → throw 至上層 try/catch；INSERT 成功才呼叫既有 `sendMonthlyReportEmail(user, ym, schedule)`；寄送失敗 → `UPDATE monthly_report_send_log SET send_status='failed', error_message=?`
- [ ] T047 [US3] 在 [server.js](../../server.js) scheduler 的 daily/weekly 分支：保留既有 `last_run` 比對邏輯，但 `local.hour` / `local.weekday` 改自 `userTime.partsInTz(user.timezone, ...)`，**不**透過 `data_operation_audit_log` 相關欄位
- [ ] T048 [US3] 在 [server.js](../../server.js) scheduler 既有測試入口（如 `POST /api/admin/test-schedule`）保留；確認其呼叫路徑不繞過 `monthly_report_send_log` 去重（測試觸發也吃 UNIQUE 約束）

**Checkpoint**: P3 通過 — 月度郵件 per-user 觸發、不重寄、失敗不重試。三個 user stories 獨立可用。

---

## Phase 6: Polish & Cross-Cutting Concerns

### 文件 & 契約同步（憲章 II / Development Workflow）

- [ ] T049 [P] 將 [contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml) 之 `paths` 與 `components.schemas.User` / `UpdateTimezoneRequest` / `ValidationError` 併入根 [openapi.yaml](../../openapi.yaml)；確保 `info.version` 升 minor、`openapi: 3.2.0` 字串完全相等不變
- [ ] T050 [P] 跑 `npx @redocly/cli lint openapi.yaml` 必須 0 errors（FR-017）；如有警告於 PR 描述列出並判斷可接受性
- [ ] T051 [P] 在 [changelog.json](../../changelog.json) 新增版本 `4.33.0`：`title=多時區支援`，`changes[].text` 至少 4 點（per-user `users.timezone`、後端 ISO 8601 UTC 統一、月度郵件 per-user 觸發、憲章 v1.3.0）；標 `breaking: true`
- [ ] T052 [P] 在 [SRS.md](../../SRS.md) 版本歷史新增 `4.33.0` 條目；FR-007a 段落改寫為 per-user

### 自動化驗證

- [ ] T053 撰寫 [tools/check-iso-utc-format.js](../../tools/check-iso-utc-format.js)：對 dev server 隨機抽 1000 個 `*_at` 欄位回應做 regex 驗證 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`，違例 fail；於 `npm run check:iso` 暴露（SC-004）
- [ ] T054 在 `package.json` `scripts` 加 `"check:iso": "node tools/check-iso-utc-format.js"`；於 CI（如有）加入該檢查
- [ ] T055 跑既有完整測試套件（`npm test` 或專案 runner），確認 0 regression（SC-001）

### 跨瀏覽器與 quickstart 走查

- [ ] T056 [P] 跨瀏覽器 tz 矩陣手測：在 6 個系統 tz（`UTC`、`Asia/Taipei`、`America/Los_Angeles`、`Europe/London`、`Asia/Tokyo`、`Pacific/Auckland`）下用 Chrome DevTools 鎖時區，登入同一帳號 → UI 行為一致（依 user.timezone）；記錄結果於 [quickstart.md §5D](./quickstart.md#5)（SC-005）
- [ ] T057 跑完整 [quickstart.md §1~§7](./quickstart.md) walkthrough；任一步驟異常即回頭定位 task ID

### Memory / Constitution 收尾

- [ ] T058 確認 [.specify/memory/constitution.md](../../.specify/memory/constitution.md) Sync Impact Report 的 propagation checklist 全勾；plan / spec / tasks / contracts 已對齊
- [ ] T059 PR 描述（繁中）列出遷移指南：DB 升級語句、API 新增、憲章 v1.3.0 摘要、breaking change 影響面（即「行為對既有 Asia/Taipei 使用者完全不變」）

### 規格驗收增補（補足 analyze-01.md G1 / G2）

- [ ] T060 FR-015 歷史不變式驗證（資料完整性）：升級前以 `sqlite3 database.db` 取得 baseline `SELECT COUNT(*) AS c, MIN(date) AS mn, MAX(date) AS mx, SUM(LENGTH(date)) AS slen FROM transactions`；升級執行 migration 後再次查詢；三組數值 + `slen` 必須完全相同（證明既有列無任何 `date` 欄位變動）。將兩次查詢的結果寫入 PR 描述附錄。亦可改寫為 [tests/integration/transactions-historical-immutable.test.js](../../tests/integration/transactions-historical-immutable.test.js) 自動化版本：以記憶體 SQLite 跑 migration 前後比對
- [ ] T061 SC-003 SLA 取樣統計（≤ 30 分鐘 P95 達成驗證）：撰寫 [tools/sla-monthly-report.js](../../tools/sla-monthly-report.js)：
  1. 於測試 DB 建 100 個假帳號分布於 ≥ 10 個時區（PST / EST / UTC / Europe/London / Asia/Taipei / Asia/Tokyo / Asia/Singapore / Pacific/Auckland / America/Asuncion / America/Sao_Paulo），每帳號 `report_schedules.freq='monthly'`、`hour=0`、`day_of_month=1`
  2. 以 `FAKE_NOW` 推進覆蓋整個月份（每分鐘 step），實際跑 scheduler tick
  3. 對每筆 `monthly_report_send_log`，計算 `sent_at_utc - 該使用者當地 1 號 00:00 UTC` 差距（分鐘）
  4. 輸出統計：min / P50 / P95 / max；P95 必須 ≤ 30 分鐘（SC-003）；建議 ≤ 5 分鐘（與 5 分鐘心跳一致）
  5. 提供 `npm run check:sla` 暴露

---

## Dependencies & Execution Order

### Phase 依賴

- **Phase 1 (Setup)**：無依賴，可立即開始。
- **Phase 2 (Foundational)**：依賴 Phase 1；阻塞所有 user story。
- **Phase 3 (US1)**：依賴 Phase 2；MVP 核心。
- **Phase 4 (US2)**：依賴 Phase 2；可在 US1 完成後並行（多人團隊）或串行（單人）。
- **Phase 5 (US3)**：僅依賴 Phase 2（migration + `lib/userTime.js` 的 `partsInTz` / `monthInUserTz`）。**不**依賴 Phase 4 任何任務 — US3 排程器寫的是 `monthly_report_send_log`，不寫 `data_operation_audit_log`，與 PATCH 時區的 audit 流程無關。
- **Phase 6 (Polish)**：依賴所有 user story 完成。

### User Story 內部依賴

- US1：T012-T014（測試）寫於程式碼前；T015-T022（後端替換）→ T023-T024（前端 today 對齊）→ T025（TWSE 註解）。
- US2：T026-T028（測試）→ T029-T030（後端 API）→ T031（既有註冊不擾動）→ T032-T040（前端）。
- US3：T041-T044（測試）→ T045-T046（scheduler monthly 分支）→ T047（daily/weekly 對齊）→ T048（test entry 對齊）。

### Parallel 機會

- **Phase 1**：T002 [P] 可與 T001 並行（不同檔案）。
- **Phase 2**：T004、T005、T010、T011 皆 [P]，可同時動工；T007 須先於 T008、T009。
- **Phase 3 測試**：T012、T013、T014 [P] 一起寫（不同檔案）；後端 T015-T022 大致循序（同一檔 `server.js` 為主，避免合併衝突）。
- **Phase 4 測試**：T026、T027、T028 [P]；前端 T032-T040 多在同一個 `app.js` 內，建議循序。
- **Phase 5 測試**：T041-T044 [P]；scheduler T045-T048 同 `server.js` 區塊，建議循序。
- **Phase 6**：T049-T052 [P]、T056 [P]、T060 [P]（與 T053 不同檔案）、T061（依賴 T045–T046 scheduler 已完成）；其餘為驗收門檻順序。

---

## Parallel Example: User Story 1

```bash
# 同時開三條測試（不同檔案，互不依賴）
Task: 撰寫 tests/integration/legacy-taipei-regression.test.js
Task: 撰寫 tests/integration/pst-natural-day.test.js
Task: 撰寫 tests/integration/iso-utc-output.test.js

# 後端 server.js 的多處替換建議「同一個 PR / commit 內順序處理」
# 因為都改同一檔，並行會引發 merge conflict
```

---

## Implementation Strategy

### MVP First（只交付 US1）

1. Phase 1 + Phase 2（含憲章修訂與 DB migration）。
2. Phase 3（US1）— PST 自然日歸屬、既有 Asia/Taipei regression-free。
3. **STOP and VALIDATE**：跑 T012-T014 測試 + 手動驗證 [quickstart.md §3](./quickstart.md#3)。
4. 可選擇性 demo / 部署成 MVP（提示「自動偵測未上線，需手動 PATCH 設定時區」）。

### Incremental Delivery

1. Foundation → Phase 2 完成 → 後端時區運算就緒。
2. + US1（P1）→ 內部使用者已可手動切時區看到正確結果。
3. + US2（P2）→ 註冊 / 登入流程自動化、設定頁可改。
4. + US3（P3）→ 月度郵件對齊使用者時區。
5. + Polish → 文件 / OpenAPI / changelog 完備，PR 可合併。

### 單人連續實作建議路徑

`T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012-T014（測試）→ T015 → T016 → T017 → T018 → T019 → T020 → T021a → T021b → T022 → T023 → T024 → T025 → T026-T028（測試）→ T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041-T044（測試）→ T045 → T046 → T047 → T048 → T049 → T050 → T051 → T052 → T053 → T054 → T055 → T056 → T057 → T058 → T059 → T060 → T061`

---

## Notes

- `[P]` = 不同檔案、無前置；`[Story]` = 對應 user story（追溯性）。
- 每個 user story 獨立可測；MVP（US1）即可獨立部署。
- 所有 task 引用之檔案路徑皆相對於 repo root；測試檔案路徑採 `tests/...`，若專案尚無此資料夾，第一個測試 task 同步建立。
- 提交建議：每個 task 或同一個 user story 的小批 task 一個 commit；commit 訊息前綴用 `feat(009): T0XX - 描述`。
- 任何 task 推進過程發現 spec 模糊或衝突，停下來修 spec / plan，再回來繼續（CLAUDE.md「Think Before Coding」）。
- 避免：跨 user story 的隱含依賴（例：US1 的測試引用 US2 的 GET /me API）— 若 US1 階段需要 user 物件取 timezone，於測試 fixture 直接 INSERT `users.timezone` 即可，不依賴 P2 端點。
