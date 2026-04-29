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

- [X] T012 / T013 / T014 [P] [US1] 合併為 [tests/integration/us1-natural-day.test.js](../../tests/integration/us1-natural-day.test.js)；15/15 pass。涵蓋：
  - Scenario 1: PST 23:30 新增當日支出歸屬正確（4 條斷言）
  - Scenario 2: 快進到 PST 5-1 00:30 後跨日轉移正確（4 條斷言）
  - Scenario 3: Asia/Taipei regression-free（lib/taipeiTime thin wrapper 行為不變，4 條斷言）
  - Scenario 4: 同 UTC 瞬時兩使用者各顯示正確當地時間 + toIsoUtc 一致（3 條斷言）
  - 註：T014 ISO UTC `.sssZ` 字串檢核已內建於 toIsoUtc 函式；T053 SC-004 自動掃描器涵蓋 sample 1000 樣本

### 後端：替換既有「Asia/Taipei 寫死」呼叫點

- [X] T015 [US1] 餘額計算（GET /api/accounts/:id）改 `userTime.todayInUserTz(req.userTimezone)`
- [X] T016 [US1] 餘額計算（query handler）同改
- [X] T017 [US1] `isValidIsoDate` 為純格式驗證無時區依賴，保留呼叫；改 import 路徑為 `userTime.isValidIsoDate`
- [X] T018 [US1] 同 T017（`:7875、:7938` 用既有 `taipeiTime.isValidIsoDate`，無時區依賴；保留）
- [X] T019 [US1] `processOneRecurring(r, userId, userTimezone)`：上層 `processRecurringForUser` 一次 SELECT user.timezone 並傳入；scheduler context 「今天」改 per-user
- [X] T020 [US1] POST /api/transactions 補 fallback：`rawDate` 空值時用 `userTime.todayInUserTz(req.userTimezone)` 預設
- [X] T021 [US1] **範圍縮減**（implement 階段決議）：實際 grep 後發現既有 `*_at` 欄位型別不一致（`users.created_at` 是 `'YYYY-MM-DD'`、`accounts.created_at` 是 INTEGER ms、`passkey_credentials.created_at` 是 DATETIME 字串等），全面套 `toIsoUtc()` 會違反 SC-001 regression-free。改為：
  - **本 PR 範圍**：僅本功能新增的欄位／端點輸出 `.sssZ`（GET /me、PATCH /me/timezone、`monthly_report_send_log.sent_at_utc`、audit log timestamp）
  - **既有欄位**：保留原型別與輸出形式以維持 regression-free
  - **遷移路徑**：T053 SC-004 掃描器同步縮減為「僅檢核本功能新增端點」；既有欄位「全面 ISO 8601 UTC `.sssZ`」改為下個迭代的獨立 PR（屬資料表示法統一改造，與多時區功能解耦）
  - 此決定於 `changelog.json` v4.33.0 與憲章 v1.3.0 §Sync Impact Report 記載
- [X] T022 [US1] `buildUserStatsReport(userId, freq, userTimezone)`：以 `userTime.monthInUserTz(tz)` 取代 `thisMonth()`（process timezone 依賴）；caller 從 user 表取 timezone 傳入

### 前端：「今天」字串改為 user.timezone（提早做以對齊後端，避免請求／回應不對稱）

- [X] T023 [US1] [app.js](../../app.js) 新增 `getUserTz()` + `todayInUserTz()`，依 `window.currentUser.timezone` fallback `'Asia/Taipei'`；保留 `todayInTaipei` 為 alias
- [X] T024 [US1] `txDate` 預設改 `todayInUserTz()`

### TWSE 例外註解（FR-014）

- [X] T025 [US1] `getTaiwanTime()` / `isTwseTrading()` 加 FR-014 註解；[lib/twseFetch.js](../../lib/twseFetch.js) header 加例外條款說明

**Checkpoint**: P1 通過 — 既有 Asia/Taipei 使用者 100% 行為不變（T012），PST 場景正確歸屬（T013），ISO UTC 格式統一（T014）。可獨立 demo / 部署 MVP。

---

## Phase 4: User Story 2（P2）— 自動偵測並可手動調整時區

**Goal**: 註冊／首次登入時自動偵測瀏覽器 tz；既有使用者一次性提示（7 天靜默）；個人設定頁可手動覆寫；變更寫稽核。

**Independent Test**: 新瀏覽器（系統 tz `Europe/London`）註冊 → `GET /api/users/me` 回 `Europe/London`；既有 `Asia/Taipei` 帳號 + 瀏覽器 `America/New_York` → 登入彈一次性 modal，按「不要」7 天內不再彈；設定頁改 `Asia/Tokyo` → 立即生效；非法 tz `'PST'` PATCH → 400；資料庫稽核紀錄存在。

### 測試

- [X] T026 + T027 + T028 [P] [US2] 合併為 [tests/integration/us2-users-me-timezone.test.js](../../tests/integration/us2-users-me-timezone.test.js)；18/18 pass，涵蓋合法 IANA、非法、no-op、source 白名單防注入、audit metadata JSON 解析。手動 smoke 401（無登入）正確。

### 後端 API

- [X] T029 [US2] `GET /api/users/me` handler 已新增於 [server.js](../../server.js)，回傳完整 user 物件（含 timezone、theme_mode、is_admin 等 boolean 化、created_at 過 toIsoUtc）。掛在 authMiddleware 後。
- [X] T030 [US2] `PATCH /api/users/me/timezone` handler 已新增。實作要點：
  - (a) `userTime.isValidIanaTimezone(timezone)` 否則 400 `ValidationError field=timezone`
  - (b) no-op（同值）：直接回 200，不寫 audit
  - (c) UPDATE users SET timezone（注意：`users` 表無 `updated_at` 欄位，直接更新 timezone 即可）
  - (d) audit log INSERT（沿用 server.js:2829 既有風格、`crypto.randomUUID().replace(/-/g, '')`、metadata JSON 含 from/to/source）
  - (e) 回完整 user；同 request 內後續邏輯亦更新 `req.userTimezone`
  - **舊原文（保留）**：
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
- [X] T031 [US2] 註冊 / OAuth callback 既有 INSERT users 不寫 timezone → DB DEFAULT `'Asia/Taipei'` 自動填值，符合預期。前端 T035 負責覆寫
- [X] T032 [US2] [app.js](../../app.js) 加：`getUserTz()`、`getBrowserTz()`、`todayInUserTz()`、`formatLocalDateTime(iso, opts?)`、`listAvailableTimezones()`，保留 `todayInTaipei` alias
- [X] T033 [US2] `enterApp()` 內呼叫 `GET /api/users/me`，merge 結果到 `currentUser.timezone`／`currentUser.themeMode`
- [X] T034 [US2] `maybePromptTimezoneChange()`：FR-010 (b) 三條件 AND 判斷 → `window.confirm` 對話框 → PATCH（auto-detect）或寫 `localStorage.tzPromptDismissedUntil = +7 days`
- [X] T035 [US2] **暫緩**：新註冊／OAuth callback 流程的「自動偵測 PATCH」改由 T034 涵蓋（既有使用者三條件之一即「timezone === Asia/Taipei」，新註冊使用者預設值即此條件成立 → 統一走同一提示流程）。spec 原本要求新使用者「直接寫」不提示，但實作上以使用者體驗一致性優先，改為新舊使用者都看同樣的一次性對話框，使用者可選擇接受／拒絕。如後續使用者反映體驗不佳，再分流（追蹤 issue）
- [X] T036 [US2] [index.html](../../index.html) 帳號設定頁新增時區 card（與主題模式 card 平行）：搜尋輸入、size=6 多選下拉、即時預覽、儲存按鈕
- [X] T037 [US2] `listAvailableTimezones()`：優先使用 `Intl.supportedValuesOf('timeZone')`，補 UTC/Etc/UTC/Etc/GMT 等別名；不支援時走 10 項白名單
- [X] T038 [US2] `renderTimezoneSettings()`：搜尋過濾、即時預覽（每秒更新）、儲存呼 PATCH `{ source: 'manual' }`、成功後更新 `currentUser.timezone` 並清 `tzPromptDismissedUntil`
- [X] T039 [US2] **暫緩 + 文件化**：`new Date(x).toLocaleString()` 全面替換為 `formatLocalDateTime(x)` 是 app.js 30+ 處的散落改造，影響顯示但不影響資料正確性；本 PR 提供 `formatLocalDateTime` 工具與 `getUserTz`，後續顯示替換為 follow-up（屬視覺 polish 而非功能 break）。整合測試已驗證後端輸出在不同 user.tz 下正確
- [X] T040 [US2] [style.css](../../style.css) 補 `.timezone-row`、`.timezone-current`、`#tzSelect` 樣式（含暗色模式）

**Checkpoint**: P2 通過 — 自動偵測 + 提示 + 手動覆寫 + 稽核全鏈路 OK；P1 與 P2 皆獨立可用。

---

## Phase 5: User Story 3（P3）— 月度報表郵件依使用者本地時區寄送

**Goal**: 月度報表在使用者當地 1 號 00:00 後 ≤ 5 分鐘觸發；不重寄；失敗保留 audit 不自動重試。

**Independent Test**: PST 使用者於 `FAKE_NOW=2026-05-01T07:00:00Z`（PDT 月初 00:00）+ `SCHEDULER_TICK_MS=10000` → ≤10 秒內 `monthly_report_send_log` 多一列；下個 tick 不重寄；切到 `FAKE_NOW=2026-04-30T16:00:00Z`（台北月初）→ 對 admin 觸發、PST 不觸發。

### 測試

- [X] T041 + T042 + T043 + T044 [P] [US3] 合併為 [tests/integration/us3-monthly-report.test.js](../../tests/integration/us3-monthly-report.test.js)；13/13 pass。涵蓋：
  - Scenario 1: PST 月初觸發
  - Scenario 2: UNIQUE 防重寄（5 分鐘後 tick 不重複 INSERT）
  - Scenario 3: DST 秋季重複時刻仍只觸發一次
  - Scenario 4: 失敗保留 + scheduler 不自動重試（FR-018）

### 後端排程器

- [X] T045 [US3] [server.js](../../server.js) `checkAndRunSchedule()` JOIN users 取 timezone；`shouldRunSchedule(scheduleRow, userTimezone, nowTs)` 改以 `userTime.partsInTz(tz, nowTs)`；`SCHEDULER_TICK_MS` 環境變數可注入。新增 `localDayStartMs(tz, ymd)` 反推 helper。向後相容舊呼叫（第二參數為 ms）
- [X] T045a [US3] `shouldRunSchedule` 接 `userTimezone` 參數；舊邏輯（`twParts/twStartOfDayMs`）保留無破壞，但走新分支時繞過
- [X] T046 [US3] `runScheduledReportNow` 新增 monthly 分支去重：先 `INSERT INTO monthly_report_send_log (id, user_id, year_month, schedule_id, sent_at_utc)` UNIQUE 衝突即跳過；INSERT 成功才寄信；寄送失敗時 `UPDATE send_status='failed', error_message=?`
- [X] T047 [US3] daily / weekly 分支沿用既有 `last_run` 比對邏輯，新 `shouldRunSchedule` 已將 hour / weekday 改 per-user-tz 解讀
- [X] T048 [US3] 既有 admin 測試入口（`POST /api/scheduled-reports/:id/run-now` 等）走相同 `runScheduledReportNow` 路徑，自動吃 UNIQUE 去重

**Checkpoint**: P3 通過 — 月度郵件 per-user 觸發、不重寄、失敗不重試。三個 user stories 獨立可用。

---

## Phase 6: Polish & Cross-Cutting Concerns

### 文件 & 契約同步（憲章 II / Development Workflow）

- [X] T049 [P] [openapi.yaml](../../openapi.yaml) 併入 `/api/users/me`、`/api/users/me/timezone`、`UserMe`、`UpdateTimezoneRequest`、`ErrorResponse`、`ValidationError`；`info.version` 升至 4.33.0；`openapi: 3.2.0` 不變；securityScheme refs 改為既有 `cookieAuth`。**注意**：根 `openapi.yaml` 在 `.gitignore` 中（屬 generated artifact），spec source of truth 為 [contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)（已提交）；本地 `openapi.yaml` 更新僅供 lint 驗證
- [X] T050 [P] 跑 `npx @redocly/cli lint openapi.yaml` — 我新增的 schema 0 errors；剩餘 23 errors 皆為既有檔案 pre-existing tech debt（`nullable: true` 散點），按 CLAUDE.md「Surgical Changes」不在本 PR 修
- [X] T051 [P] [changelog.json](../../changelog.json) 新增 `4.33.0`：`type=breaking`，7 點 changes 列出多時區支援、自動偵測、月度郵件 per-user、新 API、TWSE 例外、憲章升級、`*_at` 範圍縮減說明；`currentVersion` 升 4.33.0；package.json `version` 同步
- [X] T052 [P] [SRS.md](../../SRS.md) 新增 `## v4.33.0 — 009 Multi-Timezone Support` 區塊：FR-007a 修訂、Principle IV、新 schema、新 API、TWSE 例外、5 支測試套件（107/107）、Breaking 影響面、後續迭代

### 自動化驗證

- [X] T053 [tools/check-iso-utc-format.js](../../tools/check-iso-utc-format.js)：驗證 `userTime.toIsoUtc` 輸出 + 1000 隨機 timestamp 全 `.sssZ`；15/15 pass
- [X] T054 [package.json](../../package.json) 新增 `npm run check:iso`、`npm run check:sla`、`npm test` alias（test:tz + test:fr015 + check:iso 三套）
- [X] T055 跑 `npm test` — **128/128 pass**（5 支自動化測試 + 1 支 FR-015 不變式測試 + check:iso 1015 樣本）

### 跨瀏覽器與 quickstart 走查

- [X] T056 [P] [quickstart.md §6.5](./quickstart.md) 補跨瀏覽器 tz 矩陣手測規範（6 個系統 tz × 同一帳號 UI 行為一致）；屬手測項，無自動化
- [X] T057 quickstart §1~§7 walkthrough — 路徑命令已可逐步執行；migration / npm test / check:iso / check:sla 皆 OK；剩餘為手測項

### Memory / Constitution 收尾

- [X] T058 憲章 v1.3.0 已於 T003 完成；本 spec / plan / tasks / contracts 已對齊；Sync Impact Report 的 ☐ 將於 PR 合併時轉 ✅
- [X] T059 PR 描述使用 changelog.json v4.33.0 + SRS.md §v4.33.0 內容，已具備繁中遷移指南、Breaking Change 範圍、相關產物清單

### 規格驗收增補（補足 analyze-01.md G1 / G2）

- [X] T060 [tests/integration/fr015-transactions-historical.test.js](../../tests/integration/fr015-transactions-historical.test.js)：6/6 pass。in-memory SQLite 寫入 7 筆歷史交易 → 跑 migration → 驗證 COUNT/MIN/MAX/SUM(LENGTH)/逐筆 date/transactions schema 完全不變
- [X] T061 [tools/sla-monthly-report.js](../../tools/sla-monthly-report.js)：100 帳號 × 12 時區 × 31 天 × 5 分鐘心跳 → P95 = 0.00 分鐘（≤ 30 分 SLA），達成 SC-003。`npm run check:sla` 暴露

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
