# 實作計畫：多時區支援（Multi-Timezone Support）

**Branch**: `009-multi-timezone` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 [specs/009-multi-timezone/spec.md](./spec.md)

## Summary

將系統時區從寫死 `Asia/Taipei`（憲章 1.2.0、FR-007a）升級為 per-user 可設定。後端時間以 UTC ms 儲存、API 以 ISO 8601 UTC 字串輸出（`Z` 結尾）；前端依 `users.timezone`（IANA 識別碼）顯示。`transactions.date` 維持 `YYYY-MM-DD` 字串但語意改為「使用者當地自然日」；月度報表郵件改 per-user 觸發；TWSE 台股交易時間例外保留 `Asia/Taipei`。Breaking change：需於同 PR 修訂憲章為 1.3.0。

技術取徑（詳見 [research.md](./research.md)）：
- 不引入第三方時區庫，全用 Node.js 內建 ICU（`Intl.DateTimeFormat`）。
- DB 升級走 idempotent `ALTER TABLE ... ADD COLUMN`，加新表 `monthly_report_send_log`（UNIQUE(user_id, year_month) 去重）。
- Express 加 `attachUserTimezone` middleware 注入 `req.userTimezone`，per-request 一次 SELECT。
- Scheduler 心跳 5 分鐘，per-user 比對「當地 hour=設定 hour AND minute<5」。
- 前端自動偵測（新使用者直接寫，既有者一次性提示，7 天內不重複）。

## Technical Context

**Language/Version**: Node.js ≥ 20（內建 full-icu），ECMAScript 2022。
**Primary Dependencies**: Express 4、better-sqlite3、jsonwebtoken、nodemailer（皆既有）。**不**引入新的時區套件。
**Storage**: SQLite（`database.db`，single-file，WAL 模式）。
**Testing**: 既有自製 runner（`node` 直接執行）；本功能新增 `lib/userTime.test.js`、`scheduler.test.js`、`migration-009.test.js`、整合測試（PST 場景）。
**Target Platform**: Linux 容器（`node:20-alpine`），單機部署。
**Project Type**: 單體 web 應用（`server.js` + 靜態前端 `app.js` / `index.html`），無 build step。
**Performance Goals**:
- 排程器心跳 5 分鐘；月度信件 SC-003 ≤ 30 分鐘延遲（實際 ≤ 5 分鐘）。
- `attachUserTimezone` middleware 增加 p95 延遲 < 1ms。
- 對 1 萬使用者，每分鐘 scheduler 掃 enabled rows 約 33 reads/s（SQLite WAL 可承受）。
**Constraints**:
- 既有 Asia/Taipei 使用者 100% regression-free（SC-001）。
- TWSE 台股交易時間判斷保持 Asia/Taipei（FR-014）。
- 不修改既有 `transactions.date` 歷史值（FR-015）。
- OpenAPI 字串 `openapi: 3.2.0` 不變（憲章 II）。
**Scale/Scope**:
- 既有 user 量級數百至數千，1 年內目標 < 1 萬。
- 觸碰檔案估計：`server.js`（多處）、`app.js`（多處）、`lib/taipeiTime.js`（轉為 deprecated wrapper）、`lib/userTime.js`（新）、`openapi.yaml`、`.specify/memory/constitution.md`、`changelog.json`、`SRS.md`。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

依 `.specify/memory/constitution.md` v1.2.0 評估：

### [I] 繁體中文文件規範 Gate — ✅ PASS
- `spec.md`、`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`tasks.md`（待產）皆以正體中文撰寫。
- `contracts/multi-timezone.openapi.yaml` 之 `description` 欄位為正體中文；OpenAPI key 名稱與 schema 識別字保留英文（屬「源碼識別字」例外）。
- 憲章本身（v1.3.0 修訂）為治理文件，依 v1.2.0 既有例外條款保留英文。

### [II] OpenAPI 3.2.0 契約 Gate — ✅ PASS（含實作約束）
- 本功能新增端點 `GET /api/users/me`、`PATCH /api/users/me/timezone`，已於 `contracts/multi-timezone.openapi.yaml` 描述，且 `openapi: 3.2.0` 完全相等。
- Phase 6 必須將同等 schema 併入根 `openapi.yaml` 並通過 `npx @redocly/cli lint`（FR-017）。
- `User` schema 重複處改以 `components.schemas.User` + `$ref`。
- 兩個端點皆需 `security: [{ jwtCookie: [] }]`，已於 contract 宣告。

### [III] Slash-Style HTTP Path Gate — ✅ PASS
- 路徑全為斜線：`/api/users/me`、`/api/users/me/timezone`，無冒號自訂方法。
- 多字段 `me/timezone` 為「子資源 + 動詞」結構，自然落於斜線風格；不需 kebab-case（`timezone` 為單字）。

### Development Workflow Gate — ✅ PASS（待 Phase 6/7 完成）
- ✅ 已建立 `009-multi-timezone` 分支。
- 待辦：Phase 6 將同步更新 `openapi.yaml`、`changelog.json`、`SRS.md`、`.specify/memory/constitution.md`。
- 待辦：PR 描述以正體中文列出遷移步驟（憲章 v1.3.0 變更、DB schema、新 API）。
- 待辦：API 變更與實作必須同 PR 提交（不分階段 PR）。

### ⚠ FR-007a 衝突（既有規範）— 已於 Complexity Tracking 處置
本計畫直接違反現行 FR-007a「鎖 UTC+8」實踐約束。處置方式：**同 PR 修訂憲章 v1.3.0**（rationale 見下方 Complexity Tracking）。在 PR review 前憲章變更必須先合併（或同步合併）才能視為 gate 通過。

## Project Structure

### Documentation (this feature)

```text
specs/009-multi-timezone/
├── plan.md                              # 本檔
├── research.md                          # Phase 0 產物
├── data-model.md                        # Phase 1 產物
├── quickstart.md                        # Phase 1 產物
├── contracts/
│   └── multi-timezone.openapi.yaml      # Phase 1 產物（OpenAPI 3.2.0）
├── checklists/
│   └── requirements.md                  # spec 階段產物
└── tasks.md                             # Phase 2 產物（/speckit.tasks 產生）
```

### Source Code（實際 repo 結構，本功能涉及檔案）

```text
.
├── server.js                            # 後端入口；Phase 1/2/3/4 主要修改點
├── app.js                               # 前端 SPA；Phase 5 修改點
├── lib/
│   ├── taipeiTime.js                    # 轉為 deprecated wrapper（內部呼叫 userTime）
│   ├── userTime.js                      # 【新】per-tz 工具
│   ├── twseFetch.js                     # 不變（FR-014 例外，加註解）
│   └── ...
├── index.html                           # Phase 5：個人設定頁加時區下拉
├── style.css                            # Phase 5：必要時調整設定頁版面
├── openapi.yaml                         # Phase 6 同步
├── changelog.json                       # Phase 6 版號（4.33.0 SemVer minor）
├── SRS.md                               # Phase 6 同步
└── .specify/memory/constitution.md      # Phase 0 → v1.3.0 修訂
```

**Structure Decision**: 維持單體 web 應用結構（無 build step、無 monorepo）。新工具放 `lib/userTime.js`；既有 `lib/taipeiTime.js` 改為純 re-export 的 thin wrapper（`todayInTaipei` 內部呼叫 `todayInUserTz('Asia/Taipei')`），避免一次性大規模 rename 帶來的 risk；後續可在獨立 PR 移除 wrapper。

---

## 階段（Phases）

> 各階段以「目標 / 變更檔案 / 驗證手段」描述。實際 task 拆分於 `/speckit.tasks` 產出 `tasks.md`。

### Phase 0：憲章修訂與相依性確認 ✓
**目標**：在開始實作前確保憲章 v1.3.0 草案就緒，避免「實作完成發現違憲必須回頭」。

**變更檔案**：
- `.specify/memory/constitution.md`：
  - 將 `Version: 1.2.0` 改為 `1.3.0`，**Last Amended** 改為 2026-04-29。
  - 新增頂部 Sync Impact Report：`1.2.0 → 1.3.0 (MINOR: principle added; FR-007a redefined)`。
  - 在 Core Principles 新增「IV. Time & Timezone Discipline — NON-NEGOTIABLE」：
    - 後端 timestamp 一律以 UTC ms 儲存、API 以 ISO 8601 UTC `Z` 字串輸出。
    - 「使用者當地某日／某月／某時刻」一律以 `users.timezone` + IANA 計算。
    - 例外：市場／法規／外部系統時區（如 TWSE 09:00–13:30 Asia/Taipei）必須在源碼加註解標明。
  - 修訂 FR-007a 條目（如出現於憲章相關章節）：「per-user `users.timezone`，預設 `Asia/Taipei`」。

**驗證**：
- `grep "Version.*1\.3\.0" .specify/memory/constitution.md` 命中。
- 憲章內無「鎖 UTC+8」字樣（除 TWSE 例外段落）。

**輸出**：憲章 v1.3.0（同 PR 合併，不另開 PR；憲章 §Governance 規範本就允許）。

---

### Phase 1：DB Schema Migration（憲章 §Development Workflow）

**目標**：完成 `users.timezone` 欄位、新增 `monthly_report_send_log` 表；既有列自動套用 `Asia/Taipei`，零人工資料遷移。

**變更檔案**：`server.js`（既有 migration 區塊內加新區段）。

**新增 migration 程式碼（idempotent）**：
```js
// ─── 009 feature: multi-timezone migration ───
try {
  db.run("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'");
  db.run("UPDATE users SET timezone = 'Asia/Taipei' WHERE timezone IS NULL OR timezone = ''");
} catch (e) { /* 欄位已存在則忽略 */ }

db.run(`CREATE TABLE IF NOT EXISTS monthly_report_send_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  schedule_id TEXT,
  sent_at_utc TEXT NOT NULL,
  send_status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT DEFAULT '',
  UNIQUE(user_id, year_month)
)`);
db.run("CREATE INDEX IF NOT EXISTS idx_monthly_report_send_log_user ON monthly_report_send_log(user_id, year_month DESC)");
```

**驗證**（[quickstart.md §1](./quickstart.md)）：
- `PRAGMA table_info(users)` 含 timezone 欄位。
- `SELECT COUNT(*) FROM users WHERE timezone IS NULL OR timezone = ''` = 0。
- UNIQUE 約束於重複 INSERT 觸發。

---

### Phase 2：後端 `lib/userTime.js`、改造既有呼叫點

**目標**：建立純函式時區工具；逐處替換 `lib/taipeiTime.js` 直接呼叫；保留 wrapper 以維持向後相容。

**變更檔案**：
- 新增 `lib/userTime.js`，匯出：
  - `isValidIanaTimezone(tz)`
  - `todayInUserTz(tz)`：回 `'YYYY-MM-DD'`
  - `monthInUserTz(tz, dateOrNull)`：回 `'YYYY-MM'`
  - `isFutureDateForTz(tz, dateStr)`：回 boolean
  - `partsInTz(tz, dateMs)`：回 `{ year, month, day, hour, minute, weekday }`（scheduler 使用）
  - `__setNowMs(ms | null)`、`__nowMs()`：測試 hook（讀環境變數 `FAKE_NOW`）
- `lib/taipeiTime.js` 改為 thin wrapper：
  ```js
  const userTime = require('./userTime');
  module.exports = {
    todayInTaipei: () => userTime.todayInUserTz('Asia/Taipei'),
    monthInTaipei: (d) => userTime.monthInUserTz('Asia/Taipei', d),
    isFutureDate: (s) => userTime.isFutureDateForTz('Asia/Taipei', s),
    isValidIsoDate: userTime.isValidIsoDate,
  };
  ```
- `server.js`：新增 `attachUserTimezone` middleware；於既有「依賴今天／當月」的 handler（如 `server.js:6541`、`6661`、`6732`、`7875`、`7938`、`8060`）改用 `req.userTimezone` + `userTime.todayInUserTz(...)`。

**單元測試**：`lib/userTime.test.js`
- 覆蓋 5 組 DST 邊界時區（見 research.md R2 驗證項）。
- `isValidIanaTimezone` 拒絕 `PST`、`UTC+8`、空字串、null。
- `partsInTz` 與 `Intl.DateTimeFormat` 結果一致。

**整合驗證**：
- 既有 admin（`Asia/Taipei`）所有 endpoint 行為不變（regression）。
- 將 admin timezone 改為 `America/Los_Angeles`，重打同樣 endpoint，餘額／預算邊界正確隨之變化。

---

### Phase 3：API 新增 + 既有端點時區改造

**目標**：實作 `GET /api/users/me`、`PATCH /api/users/me/timezone`；確保所有時間欄位 ISO 8601 UTC `Z` 字串。

**變更檔案**：`server.js`（新增 handler、可能調整既有 user-related handler 回傳結構）。

**新增 handler 範本**：
```js
app.get('/api/users/me', requireAuth, (req, res) => {
  const u = queryOne("SELECT * FROM users WHERE id = ?", [req.userId]);
  if (!u) return res.status(404).json({ error: 'User not found', code: 'NotFound' });
  res.json({
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    timezone: u.timezone,
    has_password: !!u.has_password,
    google_id: u.google_id || '',
    avatar_url: u.avatar_url || '',
    theme_mode: u.theme_mode || 'system',
    is_admin: !!u.is_admin,
    is_active: !!u.is_active,
    created_at: toIsoUtc(u.created_at),
    updated_at: u.updated_at ? toIsoUtc(u.updated_at) : null,
  });
});

app.patch('/api/users/me/timezone', requireAuth, (req, res) => {
  const { timezone, source } = req.body || {};
  if (!userTime.isValidIanaTimezone(timezone)) {
    return res.status(400).json({ error: '時區格式無效', code: 'ValidationError', field: 'timezone' });
  }
  const prev = queryOne("SELECT timezone FROM users WHERE id = ?", [req.userId])?.timezone || 'Asia/Taipei';
  if (prev === timezone) return res.json(/* 完整 user */);  // no-op
  db.run("UPDATE users SET timezone = ?, updated_at = ? WHERE id = ?",
    [timezone, new Date().toISOString(), req.userId]);
  // FR-008 / Clarifications Q3：寫稽核紀錄（沿用既有 server.js:2829 的直接 INSERT 風格，
  // 本專案無 writeAuditLog helper）
  const src = source === 'manual' || source === 'auto-detect' ? source : 'manual';
  db.run(
    "INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [
      uuid(),
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
  // 回傳完整 user，與 GET /me 一致
  ...
});
```

**`toIsoUtc(value)` 工具**（`lib/userTime.js`）：
- 接受 `number`（ms）、`string`（既有 timestamp 字串，可能是 ISO 或 sqlite default）、`Date`。
- 一律輸出 `'YYYY-MM-DDTHH:mm:ss.sssZ'`。
- 對既有非標準字串（如 `2026-04-29 07:30:00`）做容錯解析。

**抽查既有端點**：以 `grep` 找出所有 `JSON.stringify` / `res.json` 路徑中含 `created_at` / `updated_at` / `last_login_at` 等鍵；確認回傳值經 `toIsoUtc` 處理。

**驗證**：[quickstart.md §2](./quickstart.md) 完整流程；自動化檢核腳本掃 1000 個 timestamp 樣本（SC-004）。

---

### Phase 4：月度報表排程器改寫

**目標**：scheduler 心跳改 5 分鐘；月度排程透過 `monthly_report_send_log` 去重；daily/weekly 沿用 `last_run` 但時區改 per-user 解讀。

**變更檔案**：`server.js`（既有 `setInterval` 區塊，估約 `server.js:5293` 周邊）。

**核心邏輯**（pseudocode 見 [data-model.md §4](./data-model.md)）：
```js
function schedulerTick() {
  const nowMs = userTime.__nowMs();
  const schedules = queryAll("SELECT * FROM report_schedules WHERE enabled = 1");
  for (const sch of schedules) {
    const u = queryOne("SELECT * FROM users WHERE id = ? AND is_active = 1", [sch.user_id]);
    if (!u) continue;
    const local = userTime.partsInTz(u.timezone, nowMs);
    if (!matchesTrigger(sch, local)) continue;
    if (sch.freq === 'monthly') {
      const ym = `${local.year}-${String(local.month).padStart(2, '0')}`;
      const sentAt = new Date(nowMs).toISOString();
      try {
        db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, schedule_id, sent_at_utc) VALUES (?, ?, ?, ?, ?)",
          [uuid(), u.id, ym, sch.id, sentAt]);
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') continue;
        throw e;
      }
      // INSERT 成功 → 寄信
      sendMonthlyReportEmail(u, ym, sch).catch(err => {
        db.run("UPDATE monthly_report_send_log SET send_status='failed', error_message=? WHERE user_id=? AND year_month=?",
          [String(err.message).slice(0, 500), u.id, ym]);
      });
    } else {
      // daily/weekly 沿用 last_run 比對（時區仍以 user.timezone 解讀）
      runIfNotRecentlyRun(sch, u, nowMs);
    }
  }
}
setInterval(schedulerTick, Number(process.env.SCHEDULER_TICK_MS) || 5 * 60 * 1000);
```

**驗證**：[quickstart.md §4](./quickstart.md) 用 `FAKE_NOW` + `SCHEDULER_TICK_MS=10000` 模擬。

---

### Phase 5：前端時區偵測、設定頁、所有時間顯示重構

**目標**：滿足 FR-010 ~ FR-013、SC-005 / SC-006。

**變更檔案**：`app.js`、`index.html`、`style.css`。

**子任務**：
1. `app.js` 加全域工具：
   - `getUserTz()`：回 `currentUser.timezone || 'Asia/Taipei'`（fallback）。
   - `formatLocalDateTime(isoString)`：`Intl.DateTimeFormat(undefined, { timeZone: getUserTz(), ... }).format(new Date(isoString))`。
   - `todayInUserTz()`：替換既有 `todayInTaipei()`（保留別名一陣子）。
2. 登入後流程：
   - `GET /api/users/me` 取 `currentUser`。
   - 若 `currentUser.timezone` 為預設 `'Asia/Taipei'` 且瀏覽器偵測到不同時區：
     - 檢查 `localStorage.tzPromptDismissedUntil`；若已過期或未設，彈一次性 modal。
     - 若使用者點「是」：`PATCH /api/users/me/timezone`。
     - 若點「不要」：寫 `localStorage.tzPromptDismissedUntil = now + 7 days`。
   - 若 `currentUser` 為新建立帳號（前端可由註冊流程上下文判斷）：直接 `PATCH` 寫入瀏覽器偵測值。
3. 個人設定頁：
   - 新增「時區」區塊：搜尋下拉，列出 `Intl.supportedValuesOf('timeZone')`（若不支援，使用白名單 fallback 10 項）。
   - 顯示目前設定 + 即時預覽（「現在當地時間：YYYY-MM-DD HH:mm:ss」）。
   - 儲存呼叫 `PATCH /api/users/me/timezone`，成功後刷新所有時間顯示（不需 reload）。
4. 替換顯示路徑：所有 `new Date(x).toLocaleString()` 改 `formatLocalDateTime(x)`；交易表單 `txDate` 預設改 `todayInUserTz()`。

**驗證**：[quickstart.md §5](./quickstart.md)。

---

### Phase 6：OpenAPI 與憲章同步

**目標**：滿足憲章 II 與 §Development Workflow 的「contract-first / 同 PR 更新」要求。

**變更檔案**：`openapi.yaml`、`.specify/memory/constitution.md`（已於 Phase 0 完成草稿，Phase 6 確認終版）、`changelog.json`、`SRS.md`。

**步驟**：
1. 將 `contracts/multi-timezone.openapi.yaml` 的 paths/schemas 併入 `openapi.yaml`：
   - 新增 `paths./api/users/me`（GET）、`paths./api/users/me/timezone`（PATCH）。
   - 新增 / 替換 `components.schemas.User`（含 timezone 欄位）。
   - `info.version` 依語義升 minor（與本功能 SemVer 一致）。
2. 跑 `npx @redocly/cli lint openapi.yaml`（FR-017 / SC-006-ish），0 errors。
3. 確認 `openapi: 3.2.0` 字串完全相等。
4. `changelog.json`：新增版本（建議 `4.33.0`，SemVer minor，因 API 新增），`changes[].text` 列：
   - 新增多時區支援（per-user `users.timezone`）。
   - 後端時間統一 ISO 8601 UTC（Z）。
   - 月度報表郵件改 per-user 觸發。
   - 憲章升至 v1.3.0。
5. `SRS.md`：版本歷史新增條目；FR-007a 段落改寫。

---

### Phase 7：Regression 測試與驗收

**目標**：確保 SC-001（既有 Asia/Taipei 使用者完全無變化）。

**步驟**：
1. 跑既有完整測試套件（`npm test` 或專案 runner），0 失敗。
2. 手動冒煙清單（admin 帳號）：
   - 登入、登出
   - 新增交易（不指定 date → 應為台灣今天）、編輯、刪除
   - 餘額頁顯示、過去日 / 未來日交易區分
   - 月份報表畫面
   - 月度郵件排程（用 quickstart §4 方法）
3. 手動冒煙清單（PST 帳號）：
   - quickstart §3 全流程
   - quickstart §4 月度郵件 PST 觸發
4. 自動化掃描器：
   - 對所有 `/api/**` 端點隨機抽 1000 timestamp 欄位回應，驗證 100% 為合法 ISO 8601 UTC `Z`（SC-004）。
5. 跨瀏覽器 tz 矩陣：在 6 個瀏覽器系統 tz 下登入同一帳號，UI 行為一致（SC-005）。

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 違反現行 FR-007a「鎖 UTC+8」實踐約束（憲章 v1.2.0 暗含） | 多時區是國際化最低門檻；保留 FR-007a 等於拒絕讓非台灣使用者使用本產品 | 嘗試「保留 FR-007a 並只動 UI」會留下「後端今天 ≠ 前端今天」的內外不一致，比完整改造更危險 |
| 引入新表 `monthly_report_send_log`（增加一張關聯表） | UNIQUE(user_id, year_month) 為「每月一封」提供原子性保證；改用 `report_schedules.last_run` 比對需多重判斷且無法防止 process 崩潰／時區變更下的重寄 | 純 `last_run` 方案在 DST 重複時刻、time skew、process restart 等場景皆有重寄風險；新增單一表格成本低收益高 |
| 同 PR 修訂憲章 v1.2.0 → v1.3.0 | 憲章為 supremacy 文件，本功能必然觸及 FR-007a；按憲章 §Governance「Amendment procedure」與 §Development Workflow 「同 PR 更新契約」精神，於同 PR 修訂避免「先實作後補規」 | 拆兩個 PR（先憲章後實作）會造成憲章文字與 codebase 不一致期；對單人團隊冗餘 |
