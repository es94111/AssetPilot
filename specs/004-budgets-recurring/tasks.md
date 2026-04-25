---
description: "預算與固定收支（004-budgets-recurring）任務分解"
---

# Tasks: 預算與固定收支（Budgets & Recurring Transactions）

**Input**: 設計文件位於 `/specs/004-budgets-recurring/`
**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml)、[quickstart.md](./quickstart.md)

**Scope**: 5 user story／**29 base FR + 6 sub-FR（`a/b/c` 後綴：FR-009a / 021a / 021b / 021c / 024a / 024b）= 35 FR + OUT-001/002/003**／10 Clarification（3 輪）／8 SC（其中 SC-007 屬 post-launch retention，不在 build-time 驗證範疇）。

**Tests**: 既有專案無自動化測試框架（與 001 / 002 / 003 一致）；本功能不引入新測試 dependency。所有驗證走 [quickstart.md](./quickstart.md) 的可重現手動流程。**故任務清單不含 Tests 區塊。**

**Organization**: 任務以 user story 為主軸分組；Setup（Phase 1）與 Foundational（Phase 2）為跨 story 共用基礎設施。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可並行（不同檔案、不依賴未完成任務）
- **[Story]**: 對應 user story（US1, US2, US3, US4, US5）
- 每筆任務含具體檔案路徑

---

## Phase 1: Setup（共享基礎設施）

**Purpose**: 確認分支與既有 stack 就緒；本功能完全沿用 001 / 002 / 003 既有依賴，故無需 `npm install` 或 CDN 變動。

- [X] T001 確認當前 branch 為 `004-budgets-recurring`、且 working tree 乾淨；若不是則 `git checkout 004-budgets-recurring && git status` 驗證。
- [X] T002 確認 `package.json` / `package-lock.json` 與 003 完全一致（不新增任何 dependency）；以 `git diff main -- package.json package-lock.json` 應為 0 行差異作為驗收。
- [X] T003 [P] 對 `database.db` 手動備份為 `database.db.bak.before-004`（即使 migration 自動備份，本機開發再手動拷一份）。

**Checkpoint**: 環境就緒，無依賴變動，可進入 Foundational。

---

## Phase 2: Foundational（阻塞先決條件）

**Purpose**: Schema migration 與產生流程核心函式；**所有 user story 皆依賴此階段完成**。

**⚠️ CRITICAL**: 本階段未完成前，任何 user story 任務不得開始。

### 資料層 migration

- [X] T010 在 [server.js](../../server.js) 的 `initDatabase()` 函式中（建議插在現有 002 / 003 migration 區塊之後）新增 `transactions` 表 ALTER：`ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT NULL` 與 `ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT NULL`，兩條皆以 `try { ... } catch (e) { /* ignore */ }` 包覆以保冪等。對應 [data-model.md §3.1](./data-model.md)。
- [X] T011 在 [server.js](../../server.js) `initDatabase()` 中緊接 T010 之後新增兩條索引：partial unique `idx_tx_source_scheduled ON transactions(source_recurring_id, scheduled_date) WHERE source_recurring_id IS NOT NULL` 與普通 `idx_tx_source ON transactions(source_recurring_id)`，皆採 `CREATE … IF NOT EXISTS` 寫法。對應 FR-028。
- [X] T012 在 [server.js](../../server.js) `initDatabase()` 中新增 `budgets` 表 REAL → INTEGER 重建 migration 區塊：偵測 `typeof(amount) = 'real'` 才觸發；rebuild 前自動備份至 `database.db.bak.<timestamp>.before-004`；以 `db.run('BEGIN' / 'COMMIT' / 'ROLLBACK')` 包裹；新表含 `created_at INTEGER NOT NULL DEFAULT 0` / `updated_at INTEGER NOT NULL DEFAULT 0`。對應 [data-model.md §3.2](./data-model.md)、CT-2。
- [X] T013 在 [server.js](../../server.js) T012 之後補建 budgets 唯一索引：`idx_budgets_unique_cat`（partial WHERE category_id IS NOT NULL）、`idx_budgets_unique_total`（partial WHERE category_id IS NULL）、`idx_budgets_user_month`（普通）；皆 `CREATE … IF NOT EXISTS`。對應 FR-002。
- [X] T014 在 [server.js](../../server.js) `initDatabase()` 中新增 `recurring` 表 REAL → INTEGER／TEXT + 補欄位 rebuild migration：偵測 `amount` 或 `fx_rate` 任一為 REAL 即觸發；rebuild 前自動備份至 `database.db.bak.<timestamp>.before-004-rec`；以 BEGIN / COMMIT / ROLLBACK 包裹；新表含 `needs_attention INTEGER NOT NULL DEFAULT 0` 與 `updated_at INTEGER NOT NULL DEFAULT 0`；INSERT 時 `CAST(ROUND(COALESCE(amount, 0)) AS INTEGER)` 與 `CAST(COALESCE(fx_rate, 1) AS TEXT)`。對應 [data-model.md §3.3](./data-model.md)、CT-2。
- [X] T015 [P] 在 [server.js](../../server.js) T014 之後補建 recurring 索引：`idx_recurring_user_active ON recurring(user_id, is_active)`、`idx_recurring_user_attn ON recurring(user_id, needs_attention)`，皆 `CREATE … IF NOT EXISTS`。
- [X] T016 [P] 在 [server.js](../../server.js) `initDatabase()` 結尾新增 self-test 三條：`budgets.amount` 全為 INTEGER 且 > 0、`recurring.amount` 全為 INTEGER 且 > 0、`recurring.fx_rate` 全為 TEXT；不通過時 `console.warn` 但不 throw。對應 [data-model.md §3.5](./data-model.md)。

### 產生流程核心函式

- [X] T020 在 [server.js](../../server.js) 取代既有 `getNextDate()`（行 6117）為 `getNextRecurringDate(prevIsoDate, freq)` 新版本：daily / weekly 維持簡單加日；monthly 採「先決定下月份、再 `min(原日, 該月最後一日)`」避免 JS `setMonth(+1)` overflow；yearly 對 `2/29` 做平年回退至 `2/28`；返回 `YYYY-MM-DD` 字串。對應 FR-022、[research.md §2](./research.md)。
- [X] T021 在 [server.js](../../server.js) 新增 `processOneRecurring(r, userId)` 函式：(a) lazy 偵測 `r.category_id` 與 `r.account_id` 是否仍存在，不存在即 `UPDATE recurring SET needs_attention = 1` 並 return 0；(b) 進入產生迴圈，計算下一個 `scheduledDate`（依 FR-014 首產日邏輯與 FR-022 月底回退）；(c) `INSERT INTO transactions (..., source_recurring_id, scheduled_date, ...)` 包在 `try / catch`，捕捉 `UNIQUE constraint failed` 錯誤後略過該日期繼續；(d) `UPDATE recurring SET last_generated = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)` 條件式推進；(e) 迴圈直到 `scheduledDate > taipeiTime.todayInTaipei()` 為止；(f) 返回此次產出筆數。對應 FR-013 ~ FR-015、FR-022、FR-023、FR-028、FR-029、[research.md §4 §6](./research.md)。
- [X] T022 在 [server.js](../../server.js) 新增 `processRecurringForUser(userId, opts = { maxSync: 30 })` 函式：(a) `queryAll("SELECT * FROM recurring WHERE user_id = ? AND is_active = 1 AND needs_attention = 0", [userId])`；(b) 迴圈呼叫 `processOneRecurring(r, userId)` 並累加 `generated`；(c) 達 `maxSync` 上限時以 `setImmediate(() => processRecurringForUser(userId, { maxSync: Infinity }))` 推背景續跑；(d) `if (generated > 0) saveDB()`；(e) `console.log` 補 `[004-recurring] generated=${generated} elapsed=${elapsed}ms userId=${userId}`；(f) 返回 generated。對應 FR-012、SC-003、SC-004、CT-3、[research.md §3](./research.md)。
- [X] T023 在 [server.js](../../server.js) 三個登入 handler 中緊接 `backfillDefaultsForUser(user.id)` 之後（行 2522 / 2986 / 3075）插入 `try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }`；錯誤吞噬不阻擋登入成功。對應 FR-012。

**Checkpoint**: Schema 已升級、產生流程已就緒，可同時啟動 5 個 user story。

---

## Phase 3: User Story 1 — 設定月度預算並在儀表板看到剩餘空間（Priority: P1）🎯 MVP 之一

**Goal**: 使用者可為任意月份建立／編輯／刪除「整月總支出預算」或「分類預算」，儀表板即時呈現四段配色進度條，支援月份切換器、歷史月份即時重算。

**Independent Test**: [quickstart.md §2](./quickstart.md) — 建立兩種粒度預算、驗證唯一性錯誤、套用四段配色（綠／中性／黃／紅）、月份切換、歷史月份即時重算、PATCH 編輯金額。

### 後端

- [X] T030 [US1] 在 [server.js](../../server.js) 取代既有 `app.get('/api/budgets', …)`（行 5995）：將 `used` 計算改用 `SUM(twd_amount)`（INTEGER）而非 `SUM(amount)`（REAL），並補 `exclude_from_stats = 0` 條件；回應整形補 `createdAt` / `updatedAt` 欄位。每次查詢僅回傳 `WHERE year_month = ?` 該月，**不**做跨月聚合或 `LAG()` 結轉計算（FR-009 不結轉的程式碼層保證）。對應 FR-005、FR-007、FR-009、FR-010。
- [X] T031 [US1] 在 [server.js](../../server.js) 取代既有 `app.post('/api/budgets', …)`（行 6012）：(a) 補 `amount` 必為正整數（`Number.isInteger(amount) && amount >= 1`）拒絕回 `400`；(b) 補 `categoryId` 若非 NULL 須為 leaf-only（`assertOwned('categories', ...)` + `parent_id != ''`）；(c) `yearMonth` 格式驗證 `^\d{4}-(0[1-9]|1[0-2])$`；(d) 既有 upsert 行為改為「同 (user_id, year_month, category_id) 已存在則回 `409 Conflict` 訊息『該月份此分類已存在預算，請改為編輯既有預算』」；(e) 新建時補 `created_at` / `updated_at` 欄位寫入。對應 FR-001 ~ FR-004、FR-009a。
- [X] T032 [US1] 在 [server.js](../../server.js) 新增 `app.patch('/api/budgets/:id', …)`：僅接受 `amount` 欄位變更；正整數驗證同 T031；`UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`；不存在或不屬於該使用者回 `404`。對應 FR-008、契約 `paths./api/budgets/{id}.patch`。
- [X] T033 [P] [US1] 在 [server.js](../../server.js) 既有 `app.delete('/api/budgets/:id', …)`（行 6027）已正確；本任務僅補回應 `{ ok: true }` 是否一致並驗證 IDOR 守則（`AND user_id = ?` 已存在）。

### 前端

- [X] T034 [US1] 在 [app.js](../../app.js) `renderBudget()`（約行 2598）改寫進度條 class 邏輯：新增 `budgetBarClass(pct)` 函式，依 `< 0.5 / 0.5–0.79 / 0.8–0.99 / >= 1.0` 回 `budget-bar--green / --neutral / --yellow / --red`；對每筆預算 row 渲染時套用對應 class；超支時百分比文字額外套 `budget-bar__pct--red` class。對應 FR-006、Edge Case「進度條配色閾值臨界」。
- [X] T035 [US1] 在 [app.js](../../app.js) `renderBudget()` 新增月份切換器：HTML 中加入 `<button id="budgetMonthPrev">‹</button> <span id="budgetMonthLabel">YYYY-MM</span> <button id="budgetMonthNext">›</button>`；JavaScript 維護當前檢視月份 `state.budgetMonth`（預設取當月 YYYY-MM）；切換時 `await API.get('/api/budgets?yearMonth=' + state.budgetMonth)` 並重繪；無預算時顯示空狀態 + 「新增預算」入口。**前置**：若 `lib/taipeiTime.js` 無 `monthInTaipei(date)` 函式（僅有 `todayInTaipei`），先在該檔補一個 helper：`function monthInTaipei(date) { return todayInTaipei(date).slice(0, 7); }` 並 export；屬同檔擴充、不引入新 dependency。對應 FR-007、FR-023、Acceptance Scenario US1.6。
- [X] T036 [US1] 在 [app.js](../../app.js) 預算編輯對話框新增「編輯既有預算」流程：點擊既有預算的 ✎ 按鈕呼叫 `API.patch('/api/budgets/' + id, { amount: newAmount })`；儲存成功後重抓 `GET /api/budgets?yearMonth=...` 即時刷新進度條。對應 FR-008。
- [X] T037 [US1] 在 [app.js](../../app.js) 新增預算對話框中分類下拉的 leaf-only 篩選：迭代 `state.categories` 時跳過 `parent_id === ''` 的父分類本身、僅以群組標題形式呈現（`<optgroup label="餐飲">`）並列出其子分類為可選 `<option>`。對應 FR-004。
- [X] T038 [P] [US1] 在 [style.css](../../style.css) 新增四個 class：`.budget-bar { transition: background-color .25s ease, color .25s ease; }`、`.budget-bar--green { background: #22c55e; }`、`.budget-bar--neutral { background: #94a3b8; }`、`.budget-bar--yellow { background: #eab308; }`、`.budget-bar--red { background: #ef4444; color: #fff; }`、`.budget-bar__pct--red { color: #ef4444; font-weight: 700; }`；以及月份切換器 nav 樣式 `.budget-month-nav { display: flex; ... }`。對應 FR-006、[research.md §5](./research.md)。
- [X] T039 [P] [US1] 在 [index.html](../../index.html) 預算頁的容器 div 補上 `<div class="budget-month-nav" id="budgetMonthNav">` 區塊（讓 T035 注入內容），並補上 `<div id="budgetList" data-month="">` 屬性以利後續切換時 update。

**Checkpoint**: US1 完整可獨立驗證 — quickstart.md §2 全部步驟通過；切換月份、四段配色、唯一性錯誤、PATCH 編輯金額皆運作。

---

## Phase 4: User Story 2 — 設定固定收支配方並讓系統自動產生交易（Priority: P1）🎯 MVP 之一

**Goal**: 使用者建立固定收支配方後，登入時自動補產出至今日為止的所有應產交易；外幣帶入配方匯率；月底回退正確；並發冪等。

**Independent Test**: [quickstart.md §3](./quickstart.md) — 起始日為過去日期補產出、起始日為今日的首產日邏輯、外幣配方、每月 31 號 → 2 月 28 回退、並發冪等（兩 tab 同時登入）、停用配方略過。

### 後端

- [X] T040 [US2] 在 [server.js](../../server.js) 取代既有 `app.post('/api/recurring', …)`（行 6043）：(a) 補 `amount` 為正整數驗證；(b) `frequency` 列舉值驗證（`daily/weekly/monthly/yearly`）；(c) `startDate` 以 `taipeiTime.isValidIsoDate()` 驗；(d) `currency` / `fxRate` 沿用 002 既有 `convertToTwd` 處理；(e) INSERT 時 `amount` 寫入 `converted.twdAmount`（INTEGER）、`fx_rate` 寫入字串、補 `created_at` 與 `updated_at`、`needs_attention = 0`。對應 FR-011、FR-014、FR-016、FR-017。
- [X] T041 [US2] 在 [server.js](../../server.js) 取代既有 `app.get('/api/recurring', …)`（行 6034）：回應每筆配方加上 `needsAttention`（boolean，自 `recurring.needs_attention`）與 `nextDate`（呼叫 `getNextRecurringDate(r.last_generated || r.start_date, r.frequency)`，但若 `last_generated` 為 NULL 則 `nextDate = r.start_date`）；其餘欄位整形不變。對應 FR-018、FR-019、FR-024a、契約 `RecurringTransaction.nextDate` / `needsAttention`。
- [X] T042 [US2] 在 [server.js](../../server.js) 取代既有 `app.post('/api/recurring/process', …)`（行 6088–6115）：handler body 改為 `try { const generated = processRecurringForUser(req.userId, { maxSync: Infinity }); res.json({ generated }); } catch (e) { console.error('[004-recurring]', e); res.status(500).json({ error: '產生流程失敗' }); }`；舊內聯邏輯已抽到 T021/T022。對應 FR-012、契約 `paths./api/recurring/process.post`。
- [X] T043 [US2] 確認 [app.js](../../app.js) 行 554 既有 client-side `await API.post('/api/recurring/process', {})` **保留**作為 backup（登入後前端再打一次無傷，因 FR-028 唯一鍵保證冪等；但可選擇移除以減少冗餘 RTT）。**決議：保留**（與 stock-recurring 同 client trigger 維持對稱）。

### 前端

- [X] T044 [US2] 在 [app.js](../../app.js) `renderRecurring()` 補三日期顯示：每張卡片內容渲染 `<div class="recurring-dates">起始 ${startDate} · 上次 ${lastGenerated || '—'} · 下次 ${nextDate || '—'}</div>`。對應 FR-018、Acceptance Scenario US3.1。**註**：FR-018 邏輯上隸屬 US3，但「列表頁基線資訊」必須與 US2 配方 CRUD 同期落地（沒有日期顯示則 US2 無從驗證自動產生結果）；故此項提前於 US2 phase 實作。US3 phase 只新增警示色階（T050），不改本任務的 markup。
- [X] T045 [US2] 在 [app.js](../../app.js) 配方新增／編輯對話框：金額輸入欄位設 `<input type="number" min="1" step="1">` 不接受小數；分類下拉沿用 leaf-only 邏輯（與 T037 一致）；幣別下拉與匯率欄位沿用 002 既有 `recurringForm.fxRate` 處理；submit 前前端再做一次 `Number.isInteger(amount) && amount >= 1` 檢查避免 round-trip。對應 FR-011、FR-016。

**Checkpoint**: US2 完整可獨立驗證 — quickstart.md §3 全部步驟通過；長時間未登入後再登入會補產出全部交易，每筆帶 `source_recurring_id` 與 `scheduled_date`；並發兩 tab 不重複產出。

---

## Phase 5: User Story 3 — 在固定收支列表上一眼看出哪一筆待執行（Priority: P2）

**Goal**: 列表卡片顯示三個關鍵日期 + 備註；啟用且下次產生日逾期 → 黃色「待執行」警示；停用即使逾期不顯示警示。

**Independent Test**: [quickstart.md §4](./quickstart.md) — 啟用 + 已過下次產生日 → 黃色預警 + 「（待執行）」字樣；停用 + 逾期 → 灰階不警示；備註直接顯示。

### 前端

- [X] T050 [US3] 在 [app.js](../../app.js) `renderRecurring()` 卡片渲染加色階分流邏輯：`if (!isActive) → 'recurring-card--inactive'`；`else if (needsAttention) → 'recurring-card--attention'`（紅／橘色階，US4 處理）；`else if (nextDate && nextDate < taipeiTime.todayInTaipei()) → 'recurring-card--pending'`（黃色預警）；`else → 'recurring-card--normal'`。並在 `recurring-card--pending` 卡片的下次產生日後綴 `<span class="recurring-pending-tag">（待執行）</span>`。對應 FR-019、Acceptance Scenarios US3.1 ~ US3.4。
- [X] T051 [P] [US3] 在 [app.js](../../app.js) `renderRecurring()` 中卡片 HTML 補 `<div class="recurring-note">${escHtml(r.note)}</div>` 區塊（僅 `r.note` 不為空字串時渲染）；不需展開即可看見。對應 FR-018。
- [X] T052 [P] [US3] 在 [style.css](../../style.css) 新增 recurring 卡片色階：`.recurring-card--normal { background: var(--card-bg); }`、`.recurring-card--pending { background: #fef9c3; border-left: 4px solid #eab308; }`（黃色預警）、`.recurring-card--inactive { background: var(--card-bg); opacity: 0.55; filter: grayscale(40%); }`、`.recurring-pending-tag { color: #b45309; font-weight: 600; margin-left: 4px; }`、`.recurring-note { color: var(--text-secondary); font-size: 0.9em; margin-top: 4px; }`。

**Checkpoint**: US3 完整可獨立驗證 — quickstart.md §4 全部步驟通過。

---

## Phase 6: User Story 4 — 編輯固定收支時對已刪除的分類／帳戶防呆（Priority: P2）

**Goal**: 配方原綁定的分類／帳戶被刪除時自動標 `needs_attention`、卡片紅／橘色階凸顯；編輯對話框佔位下拉防靜默清空；改選有效項並儲存後旗標清除。

**Independent Test**: [quickstart.md §5](./quickstart.md) — 刪分類後登入觸發 `needs_attention = 1`；卡片紅／橘色階；編輯對話框佔位「（原分類已刪除）」；不改任何欄位儲存被拒；改選有效子分類儲存後旗標清除、視覺立即恢復。

### 後端

- [X] T060 [US4] 確認 T021 `processOneRecurring` 已實作 lazy 偵測（已於 Foundational 階段完成）；本任務驗證實作正確：撰寫一段臨時 SQL `UPDATE recurring SET needs_attention = 0; DELETE FROM categories WHERE id = '<test>'; ` 後手動觸發 `processRecurringForUser` → `recurring.needs_attention` 應變為 1。對應 FR-024。
- [X] T061 [US4] 在 [server.js](../../server.js) `app.put('/api/recurring/:id', …)`（行 6059）handler 新增 placeholder 拒絕邏輯：若 `req.body.categoryId === '__deleted_category__'` 或 `req.body.accountId === '__deleted_account__'` 則回 `400 Bad Request` 訊息「請先選擇有效分類／帳戶」。對應 FR-020。

### 前端

- [X] T062 [US4] 在 [app.js](../../app.js) 配方編輯對話框開啟邏輯（搜 `openRecurringEditDialog` 或對應函式）：(a) 拉 `state.categories` 與 `state.accounts`；(b) 若 `r.category_id` 不在 `state.categories` 中（被刪除）→ 在分類 select 頂部插入 `<option value="__deleted_category__" selected style="color: #94a3b8; font-style: italic;">（原分類已刪除）</option>`；(c) 對 `account_id` 同樣處理插入 `__deleted_account__` 佔位；(d) submit handler 在送出前檢查若 `categoryId === '__deleted_category__'` 或 `accountId === '__deleted_account__'` 則 alert 提示並阻止送出。對應 FR-020、Acceptance Scenarios US4.1 ~ US4.4。
- [X] T063 [US4] 在 [app.js](../../app.js) `renderRecurring()` 卡片渲染加 `needs_attention` 處理（補 T050 中的 `recurring-card--attention` 分支）：渲染 `⚠ 需處理：原分類／帳戶已刪除，請重新指定` 文案於卡片頂部。對應 FR-024a。
- [X] T064 [P] [US4] 在 [style.css](../../style.css) 新增 `.recurring-card--attention { background: #fee2e2; border-left: 4px solid #ef4444; }`（紅／橘色階，與黃色 `--pending` 視覺可區分）；`.recurring-attention-text { color: #991b1b; font-weight: 600; margin-bottom: 4px; }`。對應 FR-024a、[research.md §6](./research.md)。

**Checkpoint**: US4 完整可獨立驗證 — quickstart.md §5 全部步驟通過。

---

## Phase 7: User Story 5 — 維護現有預算與固定收支（Priority: P2）

**Goal**: 編輯起始日 / 週期 / 業務欄位皆有正確 `last_generated` 處理（FR-021a/b/c）；衍生交易帶 `source_recurring_id` 並在交易列表顯示「來源配方」chip；刪除配方不連帶刪除歷史。

**Independent Test**: [quickstart.md §6](./quickstart.md) — 編輯起始日重置 `last_generated` 並依新起始日首產；編輯週期保留 `last_generated`；編輯業務欄位不溯及既往；刪除衍生交易不被補回；刪除配方後歷史保留並顯示「（來源配方已刪除）」灰字。

### 後端

- [X] T070 [US5] 在 [server.js](../../server.js) 取代既有 `app.put('/api/recurring/:id', …)`（行 6059）：(a) 先 `queryOne` 取舊配方資料；(b) `oldStartDate = old.start_date`、`oldFrequency = old.frequency`；(c) 計算 `newLastGenerated = (newStartDate !== oldStartDate) ? null : old.last_generated`（FR-021a / FR-021b 分支邏輯）；(d) 計算 `newNeedsAttention = 0`（一律清除，因新欄位皆已驗有效；FR-024b）；(e) `UPDATE recurring SET amount=?, category_id=?, account_id=?, frequency=?, start_date=?, note=?, currency=?, fx_rate=?, last_generated=?, needs_attention=?, updated_at=? WHERE id=? AND user_id=?`；(f) **嚴格不**對 `transactions` 表觸發任何 UPDATE（FR-021c 程式碼層護欄）；(g) `currency` / `fx_rate` 變更後，下次新產出之衍生交易使用新值，歷史衍生交易不變（FR-016 與 FR-021c 之自然延伸）。對應 FR-021a、FR-021b、FR-021c、FR-024b、FR-016。
- [X] T071 [US5] 在 [server.js](../../server.js) `processOneRecurring`（T021 內）的 `INSERT INTO transactions` SQL 補 `source_recurring_id` 與 `scheduled_date` 兩個 placeholder 與對應參數（值即為 `r.id` 與當次 `nextDate`）。對應 FR-025、FR-028。
- [X] T072 [US5] 在 [server.js](../../server.js) 取代既有 `app.get('/api/transactions', …)`（既有 transactions list query）：將 SELECT 改為 `SELECT t.*, COALESCE(NULLIF(r.note, ''), '（未命名配方）') AS source_recurring_name FROM transactions t LEFT JOIN recurring r ON r.id = t.source_recurring_id AND r.user_id = t.user_id WHERE t.user_id = ? AND ...`；`COALESCE + NULLIF` 處理 `recurring.note` 為空字串的情境（避免 chip 顯示「📌 來自配方：」尾段空白）；當 `r.id` 不存在時 `source_recurring_name` 為 NULL（前端 T074 退化為「（來源配方已刪除）」）。回應整形補 `sourceRecurringId: t.source_recurring_id`、`sourceRecurringName: t.source_recurring_name`、`scheduledDate: t.scheduled_date`。對應 FR-025、FR-027、[research.md §7](./research.md)。
- [X] T073 [US5] 同樣補 [server.js](../../server.js) 既有 `app.get('/api/transactions/:id', …)`（單筆查詢）的 LEFT JOIN 與 `COALESCE(NULLIF(r.note, ''), '（未命名配方）')` 整形（與 T072 一致）。

### 前端

- [X] T074 [US5] 在 [app.js](../../app.js) 交易列表渲染（搜 `renderTransactions` 或對應函式）：每筆交易行末附 chip — 若 `tx.sourceRecurringName` 非 null `→ <a class="tx-source-chip" data-recurring-id="${tx.sourceRecurringId}">📌 來自配方：${escHtml(tx.sourceRecurringName)}</a>`（點擊跳轉至 `/recurring`）；若 `tx.sourceRecurringId` 非 null 但 `tx.sourceRecurringName` 為 null `→ <span class="tx-source-chip tx-source-chip--orphan">（來源配方已刪除）</span>`（純文字、不可點）；其他不渲染 chip。對應 FR-025、FR-027。
- [X] T075 [P] [US5] 在 [app.js](../../app.js) 交易編輯對話框補同款 chip（與 T074 一致）；FR-026 字面要求對衍生交易的編輯權限與一般交易相同，故 chip 為純資訊展示，不影響任何欄位 disabled 狀態。
- [X] T076 [P] [US5] 在 [style.css](../../style.css) 新增 chip 樣式：`.tx-source-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; background: var(--chip-bg, #e0e7ff); color: var(--chip-fg, #3730a3); cursor: pointer; }`、`.tx-source-chip--orphan { background: #f3f4f6; color: #6b7280; cursor: default; font-style: italic; }`。

**Checkpoint**: US5 完整可獨立驗證 — quickstart.md §6 全部步驟通過；歷史衍生交易在配方更名／刪除後 UI 行為正確。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨 user story 的契約、版本、文件同步收尾；不改業務行為。

- [X] T090 [P] 同步更新根目錄 [openapi.yaml](../../openapi.yaml)：(a) 新增 `paths./api/budgets/{id}.patch` 條目；(b) `Budget` schema `amount` 由 `number` 改為 `integer minimum: 1`；(c) `RecurringTransaction` schema 補 `needsAttention: boolean`、`nextDate: string format date nullable: true`、`updatedAt: integer`；(d) `Transaction` schema 補 `sourceRecurringId: string nullable: true`、`sourceRecurringName: string nullable: true`、`scheduledDate: string format date nullable: true`；(e) `info.version` `4.24.0` → `4.25.0`。對應憲章 Principle II 規則 #2、[contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml)。
- [X] T091 [P] 在 [changelog.json](../../changelog.json) 頂部新增 `4.25.0` 條目：`type: "new"`；`title: "預算與固定收支重整（004-budgets-recurring）：四段配色 / 月份切換器 / 配方來源追溯 / 並發冪等保護"`；`changes` 陣列 zh-TW 條列：(a) `tag: "warning"` 「schema migration：budgets / recurring 表 REAL → INTEGER 重建；transactions 表新增 source_recurring_id / scheduled_date；啟動時自動備份 database.db.bak.<ts>.before-004」、(b) `tag: "feature"` 多條（PATCH /api/budgets/{id}、四段配色、月份切換器、待執行黃色 / 需處理紅橘色階、來源 chip、登入時自動觸發產生流程）、(c) `tag: "fix"` 「每月 31 號遇 2 月正確回退至月底（既有實作會 overflow 至下月初）」。同步更新 `currentVersion` 為 `"4.25.0"`。
- [X] T092 [P] 在 [SRS.md](../../SRS.md) 版本歷史區段新增 `4.25.0` 條目，內容與 T091 對應；同步檢查 `§3.3 端點列舉` 是否需補 `PATCH /api/budgets/{id}`（若有則加入）。
- [X] T093 執行 `npx @redocly/cli lint openapi.yaml` 與 `npx @redocly/cli lint specs/004-budgets-recurring/contracts/budgets-recurring.openapi.yaml`，預期 0 error；任一錯誤須在本任務內修正。對應憲章 Principle II 規則 #1（lint 強制）。
- [X] T094 在 PR 中執行三條 grep 驗證程式碼層護欄並截圖記入 PR 描述：(a) `grep -nE "UPDATE\s+transactions" server.js` — 驗證 `app.put('/api/recurring/:id', …)` handler 範圍內**無**任何 `UPDATE transactions` SQL（FR-021c 不溯及既往）；(b) `grep -nE "DELETE\s+FROM\s+recurring|UPDATE\s+recurring.*last_generated" server.js` — 驗證 `app.delete('/api/transactions/:id', …)` handler 範圍內**無**對 `recurring` 表的反向變更（FR-026 衍生交易刪除不影響配方）；(c) `grep -nE "year_month\s*[<>]|LAG\s*\(|LEAD\s*\(" server.js` — 驗證預算查詢無跨月聚合或結轉計算（FR-009）。
- [X] T095 依 [quickstart.md](./quickstart.md) §2 ~ §9 全流程逐項手動驗證；任一步驟失敗即回到對應 user story 任務修補；通過後在 PR 描述附 DevTools Network 截圖（重點：登入後 `[004-recurring] generated=N elapsed=Tms` console 輸出、`POST /api/budgets` 回 INTEGER amount、PATCH 回 `{ ok: true }`）。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴，可立即開始。
- **Foundational (Phase 2)**: 依賴 Setup 完成；**阻塞所有 user story**。
  - T010 ~ T016（schema migration）必須序列執行（同一檔案 `server.js` 的 initDatabase 區塊）。
  - T020（`getNextRecurringDate`）獨立可平行；T021（`processOneRecurring`）依賴 T020；T022（`processRecurringForUser`）依賴 T021；T023（登入 hook）依賴 T022。
- **User Stories (Phase 3 ~ 7)**: 全部依賴 Foundational 完成；US1 ~ US5 之間**互相獨立**，可平行（若有多名開發者）；單人實作建議依 P1 → P2 順序：US1 → US2 → US3 → US4 → US5。
- **Polish (Phase 8)**: 依賴所有所需 user story 完成。

### User Story Dependencies

- **US1（P1，預算 + 儀表板）**：可在 Foundational 完成後立即開始，無對其他 story 的依賴。
- **US2（P1，產生流程 + 配方 CRUD）**：可在 Foundational 完成後立即開始，無對其他 story 的依賴。
- **US3（P2，列表三日期 + 待執行警示）**：可在 Foundational 完成後立即開始（不依賴 US1 / US2 完成；只是視覺擴充 `renderRecurring()`，但 `nextDate` 計算依賴 T041）。實務上會在 US2 之後做。
- **US4（P2，需處理視覺 + 佔位下拉）**：依賴 T021（`processOneRecurring` 自動標 `needs_attention`）已於 Foundational 完成；其餘任務皆獨立。
- **US5（P2，編輯分支 + 來源 chip）**：依賴 T021（`processOneRecurring` 寫入 `source_recurring_id` / `scheduled_date`）已於 Foundational 完成；T070 PUT handler 改寫獨立。

### Within Each User Story

- 後端任務（API endpoint）先於前端渲染任務 — 前端需要新欄位（如 `needsAttention` / `nextDate` / `sourceRecurringName`）才能渲染。
- CSS 任務（標 [P]）與 JS 任務獨立，可並行；但建議先寫 JS 確認 class 名稱後再補 CSS。
- 同一檔案內的多個任務（如 [server.js](../../server.js) 的 T030 / T031 / T032）若改動互不重疊區段可並行；改同一函式（如 T070 改 `app.put('/api/recurring/:id')`）必須序列。

### Parallel Opportunities

- **Setup**: T003 [P]。
- **Foundational**: T015 / T016 [P]（不同 SQL 區段、彼此獨立）；T020 獨立可在 schema migration 進行時平行寫。
- **US1**: T033 / T038 / T039 [P]（不同檔案）。
- **US2**: T044 / T045 [P]（前端不同對話框）。
- **US3**: T051 / T052 [P]（[app.js](../../app.js) 的不同區塊 + [style.css](../../style.css)）。
- **US4**: T064 [P]（[style.css](../../style.css) 獨立）。
- **US5**: T075 / T076 [P]（[app.js](../../app.js) 不同區塊 + [style.css](../../style.css)）。
- **Polish**: T090 / T091 / T092 [P]（不同檔案）。

---

## Parallel Example: User Story 1

```bash
# T030 完成後（GET /api/budgets 整形含 createdAt/updatedAt），可同時啟動：
Task: "T034 [US1] 在 app.js renderBudget() 改寫 budgetBarClass(pct) 與 row class 套用"
Task: "T038 [P] [US1] 在 style.css 新增四段配色 class"
Task: "T039 [P] [US1] 在 index.html 預算頁補 budget-month-nav 容器"

# 三條並行；T035 月份切換器依賴 T030 / T034 / T039 → 序列。
```

---

## Implementation Strategy

### MVP First（US1 + US2）

004 的 P1 包含兩條獨立 user story；建議：

1. 完成 Phase 1: Setup（T001 ~ T003）。
2. 完成 Phase 2: Foundational（T010 ~ T023）— **阻塞所有 story**。
3. 完成 Phase 3: US1（T030 ~ T039）— 預算 + 儀表板可運作。
4. **STOP and VALIDATE**: [quickstart.md §2](./quickstart.md) 通過。
5. 完成 Phase 4: US2（T040 ~ T045）— 配方 + 自動產生可運作。
6. **STOP and VALIDATE**: [quickstart.md §3](./quickstart.md) 通過。
7. **MVP 完成**：可發布 dev branch 預覽版本。

### Incremental Delivery

8. 完成 Phase 5: US3（T050 ~ T052）— 待執行警示。
9. 完成 Phase 6: US4（T060 ~ T064）— 需處理視覺 + 佔位下拉。
10. 完成 Phase 7: US5（T070 ~ T076）— 編輯分支邏輯 + 來源 chip。
11. 完成 Phase 8: Polish（T090 ~ T095）— 契約、版本、文件、quickstart 全流程驗證。

每個 user story 完成後皆可獨立 demo / deploy，不需等所有 P2 都完成。

### Parallel Team Strategy（多人協作）

- **Dev A**：Foundational（T010 ~ T023）→ US1 後端（T030 ~ T033）+ Polish 契約（T090, T093）。
- **Dev B**：US1 前端（T034 ~ T039）+ US3 前端（T050 ~ T052）+ US4 前端（T062 ~ T064）。
- **Dev C**：US2 後端（T040 ~ T043）+ US5 後端（T070 ~ T073）+ Polish changelog/SRS（T091, T092）。
- **All**：Phase 8 quickstart 驗證（T095）共同進行。

---

## Notes

- **零新依賴**：所有任務皆於既有 stack 上實作；不允許 `npm install` 任何套件、不允許新增 CDN 資源、不允許新增外部 API。違反此原則的任務必須先回退並改寫。
- **[P] 標記**：不同檔案 + 無未完成依賴；同檔案不同函式且互不干擾亦可標 [P]。
- **[US?] 標記**：對應 [spec.md](./spec.md) 的 5 條 user story；Setup / Foundational / Polish 不帶 [US?]。
- **每個 user story 皆可獨立完成、獨立驗證**：US3 / US4 / US5 不依賴 US1 / US2 完成，但業務上有意義的順序仍是 US1 → US2 → US3 → US4 → US5。
- **驗證方式**：每完成一個 task 後在 [quickstart.md](./quickstart.md) 對應段落手動驗證；通過後勾選任務 checkbox。
- **Commit 粒度**：建議 task 完成即 commit；commit message 含 task ID（如 `feat(004): T030 GET /api/budgets used 改用 twd_amount 整數彙整`），便於 reviewer 追溯。
- **Constitution Gate**：T093（OpenAPI lint）+ T094（不溯及既往護欄驗證）為憲章 Principle II / III 與 spec FR-021c 的最終 gate；任一失敗 PR 不得 merge。
- **避免**：模糊任務（「優化 budget」）、跨 story 依賴破壞獨立性、未標明檔案路徑的描述。
