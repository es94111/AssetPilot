---
description: "Task list for feature 007 — 資料匯出匯入"
---

# Tasks：資料匯出匯入（Data Export / Import）

**Input**: Design documents from `specs/007-data-export-import/`
**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml)

**Tests**：本功能 spec 與 plan 皆**未要求**自動化測試（沿用 001~006 baseline 的「手動驗證 + DevTools」模式）；驗證以 [quickstart.md](./quickstart.md) 為劇本。本檔不含 test 任務。

**Organization**：依 spec.md 的 7 個 user story 分階段；每階段可獨立交付與獨立驗證。

## Format：`[ID] [P?] [Story?] Description`

- **[P]**：可平行（不同檔案、無未完成依賴）
- **[Story]**：對應 spec.md 之 user story（US1 ~ US7）
- 路徑為相對於 repo root 的具體檔案／程式區塊

## Path Conventions

沿用單體結構：
- 後端：單一 `server.js`（既有），於指定行區塊插入或改寫；輔助模組於 `lib/`。
- 前端：單一 `app.js` + `index.html` + `style.css`（既有）。
- 衍生：`backups/`（執行期建立、加入 ignore）。
- 契約：`openapi.yaml`（根目錄；同 PR 更新）+ `specs/007-data-export-import/contracts/`（feature contract）。

---

## Phase 1：Setup（共用基礎設施）

**Purpose**：新增 schema、靜態資料、ignore 規則；不依賴 server.js 內邏輯，可獨立並先行完成。

- [X] T001 [P] 於 [server.js](../../server.js) `initDB()` 內新增 `data_operation_audit_log` 表與 3 個索引（依 [data-model.md §1.1](./data-model.md)）；採 `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`；插入位置與既有 `login_audit_logs`（[server.js:549](../../server.js#L549)）同區塊
- [X] T002 [P] 於 [server.js](../../server.js) `initDB()` 內新增 `system_settings` 表（依 [data-model.md §1.2](./data-model.md)）；`INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('audit_log_retention_days', '90', ...)`；插入位置同 T001
- [X] T003 [P] 新增 [lib/iso4217.js](../../lib/iso4217.js)：純 JS 模組，export `ISO_4217_CODES`（~180 條主要流通幣別陣列字面量）+ `isValidCurrency(code)` 函式；不引入新依賴
- [X] T004 [P] 新增 [lib/external-apis.json](../../lib/external-apis.json)：5 條目（exchangerate-api、IPinfo、TWSE、Google Identity Services、Resend）；IPinfo 的 `attribution` 欄位固定為字串 `"IP address data is powered by IPinfo"`；schema 依 [contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml) `ExternalApiEntry`
- [X] T005 [P] 於 [.gitignore](../../.gitignore) 加入一行 `backups/`
- [X] T006 [P] 於 [.dockerignore](../../.dockerignore) 加入一行 `backups/`

---

## Phase 2：Foundational（阻塞前置）

**Purpose**：所有 user story 共用的後端 helper／module-level state；在進入任何 user story 實作前必須完成。

**⚠️ CRITICAL**：未完成本 phase 前，US1 ~ US7 的後端任務不應開始。

- [X] T007 於 [server.js](../../server.js) 模組頂層（既有 `const fxCache = require(...)` 區塊附近）新增 module-level state：`const importLocks = new Set()` 與 `const importProgress = new Map()`；同位置新增 `const BACKUPS_DIR = path.join(__dirname, 'backups')`
- [X] T008 於 [server.js](../../server.js) helper 區塊新增 `acquireImportLock(userId)` 與 `releaseImportLock(userId)` 兩個函式（依 [research.md §3](./research.md)）
- [X] T009 於 [server.js](../../server.js) helper 區塊新增 `writeOperationAudit({ userId, role, action, ipAddress, userAgent, result, isAdminOperation, metadata })` 函式（依 [research.md §11](./research.md)）；寫入失敗 try/catch 不阻擋主操作（FR-044）；附 `console.error` 結構化 log；**`metadata` 採白名單欄位制（FR-046 防外洩）**：函式內以 const 宣告允許 keys = `['rows', 'imported', 'skipped', 'errors', 'warnings', 'byteSize', 'dateFrom', 'dateTo', 'failure_stage', 'failure_reason', 'unknown_columns', 'backup_path', 'before_restore_path', 'filename', 'filterParams']`（共 15 條，**其中 `filterParams` 為未來擴充佔位欄**：保留供日後 export 端點將 query 條件序列化記錄使用，目前 11 個 action 皆未填此鍵；該欄位列入白名單以避免日後新增使用者時還需再修改 helper）；對 metadata 物件做 `Object.keys` 過濾、僅保留白名單內的 key 後再 `JSON.stringify` 寫入；其餘 key silent drop 並 `console.warn(JSON.stringify({ event: 'audit_metadata_dropped_keys', dropped }))` 以利日後新增白名單；嚴禁傳入 CSV 內容、密碼 / token / cookie / 任何使用者資料明文
- [X] T010 [P] 於 [server.js](../../server.js) helper 區塊新增 CSV 組裝 helper：`formulaInjectionEscape(value)`、`csvCell(value)`、`buildCsv(headers, rows)`（依 [research.md §7](./research.md)）；以 UTF-8 BOM 開頭
- [X] T011 [P] 於 [server.js](../../server.js) helper 區塊新增驗證 helper：`isValidIso8601Date(s)`（regex `^\d{4}-\d{2}-\d{2}$` + `Date.parse` 二次校驗）、`isValidHexColor(s)`（regex `^#[0-9A-Fa-f]{6}$`）
- [X] T012 [P] 於 [server.js](../../server.js) helper 區塊新增 hash helper：`makeTxHash(date, type, categoryId, amount, accountId, note)`、`makeStockTxHash(date, symbol, type, shares, price, accountId)`、`makeDividendHash(date, symbol, cashDividend, stockDividend)`；分隔符採 ``（依 [research.md §6](./research.md)）
- [X] T013 [P] 於 [server.js](../../server.js) helper 區塊新增備份檔 helper：`ensureBackupsDir()`、`pruneBeforeRestoreBackups()`（依 [research.md §10](./research.md)）；`pruneBeforeRestoreBackups()` 結構化 log 事件 `before_restore_pruned`
- [X] T014 擴充既有 `registerAuditPruneJob()`（[server.js:4832](../../server.js#L4832)）：(a) tick() 內新增「依 `system_settings.audit_log_retention_days` 值清理 `data_operation_audit_log`」邏輯；`forever` 跳過清理；保留既有 `login_audit_logs` 清理；(b) **改寫排程模式為「次日午夜 setTimeout cascade」**（FR-046a「每日午夜（伺服器時區）」明文要求；不可用 `setInterval(tick, 24*3600*1000)` 因會自啟動時刻起每 24h 觸發、非午夜對齊）；落地參照 [research.md §11](./research.md) 的 `scheduleNextMidnightTick()` 範本：啟動 5 秒先跑一次清理 stale 紀錄、之後每日午夜 cascade 觸發
- [X] T015 [P] 於 [server.js](../../server.js) 模組頂層引入 `const { isValidCurrency } = require('./lib/iso4217')` 與 `const externalApisData = require('./lib/external-apis.json')`（依賴 T003、T004）
- [X] T016 [P] 於 [app.js](../../app.js) 新增前端 helper 區塊（既有 IIFE 內）：`pollImportProgress()`（setInterval 1s）、`stopImportPolling()`、`renderProgressBar({ processed, total, phase })`、`showImportCompleteModal({ imported, skipped, errors, warnings })`

**Checkpoint**：完成 T007 ~ T016 後，所有 user story 後端／前端工作可並行展開。

---

## Phase 3：User Story 1 — 交易記錄一次匯出成 CSV（Priority: P1）🎯 MVP

**Goal**：使用者能於「資料匯出」頁匯出全部或日期範圍內的交易為 UTF-8 BOM CSV，含 Formula Injection 防護、ISO 8601 日期、父子分類「>」格式、轉帳獨立成行。

**Independent Test**：[quickstart.md §2](./quickstart.md) — 5,000 筆交易匯出 ≤ 5 秒（SC-001）；含 `=SUM` 等公式字串前置單引號（SC-003）。

### Implementation for User Story 1

- [X] T017 [US1] 於 [server.js](../../server.js) 既有股票相關區塊（[server.js:8400](../../server.js#L8400) 附近）新增 `app.get('/api/transactions/export', authMiddleware, ...)` handler：(a) 接收 query `dateFrom` / `dateTo`；(b) `SELECT` 交易 + JOIN categories（含父分類 name 解析「父 > 子」）+ JOIN accounts；(c) 用 T010 的 `buildCsv()` 組 CSV（欄位順序：日期、類型、分類、金額、帳戶、備註）；(d) 類型轉中文（expense→支出 / income→收入 / transfer_out→轉出 / transfer_in→轉入）；(e) `Content-Disposition: attachment; filename="transactions-{YYYYMMDD}.csv"`、`Content-Type: text/csv; charset=utf-8`；(f) response 後呼叫 T009 的 `writeOperationAudit({ action: 'export_transactions', result: 'success', metadata: { rows, byteSize, dateFrom, dateTo } })`
- [X] T018 [US1] 於 [app.js](../../app.js) 移除既有 client-side 交易 CSV 組裝（[app.js:6628](../../app.js#L6628)）；改為 `fetch('/api/transactions/export?dateFrom=...&dateTo=...')` → `response.blob()` → trigger download；保留既有「資料匯出」頁 UI（日期範圍選擇 + 匯出按鈕）

**Checkpoint**：US1 可獨立驗證 — 匯出檔可用 Excel 開啟、中文無亂碼、Formula Injection 防護生效、稽核日誌出現對應紀錄。

---

## Phase 4：User Story 2 — CSV 把交易記錄一次貼回系統（Priority: P1）

**Goal**：使用者上傳 CSV → 系統解析、預覽、自動建立缺項對話框、轉帳兩兩配對、原子化寫入、進度回饋；完成顯示「成功 N／略過 M／錯誤 K」+ warnings 清單。

**Independent Test**：[quickstart.md §3](./quickstart.md) — 1,000 筆 + 100 對轉帳 ≤ 30 秒（SC-002）；重複匯入冪等（SC-009）；互斥鎖回 409；ISO 8601 嚴格驗證；整批 rollback。

### Implementation for User Story 2

- [X] T019 [US2] 於 [server.js](../../server.js) 改寫 `POST /api/transactions/import`（[server.js:6456](../../server.js#L6456)）為原子化版本：(a) 開頭呼叫 T008 `acquireImportLock(userId)` → 失敗即回 HTTP 409 `{ error: 'IMPORT_IN_PROGRESS' }`；(b) try/finally 包覆，finally 內 `releaseImportLock(userId)`；(c) `importProgress.set(userId, { processed: 0, total: rows.length, phase: 'parsing', startedAt: Date.now(), completedAt: null })`；(d) 階段切換時更新 `phase`、每處理 500 筆更新 `processed`
- [X] T020 [US2] 於 [server.js](../../server.js) 同 handler 內新增 ISO 8601 嚴格驗證（FR-014b）：每行用 T011 `isValidIso8601Date()` 檢查日期；不通過則計入 errors 含 row 行號 + reason `'日期格式必須為 YYYY-MM-DD'`
- [X] T021 [US2] 於 [server.js](../../server.js) 同 handler 內新增六欄重複偵測（FR-014）：用 T012 `makeTxHash()` 建 existing set + batch set；命中即 skipped++、不寫入
- [X] T022 [US2] 於 [server.js](../../server.js) 同 handler 內**重寫**轉帳配對（FR-012）：(a) 按 `${date}|${amount}` 分組為 `groupMap: Map`；(b) 組內 outs / ins 兩 list 以 CSV 順序兩兩配對寫 `linked_id`；(c) 剩餘列入 `warnings: [{ row, type: 'unpaired_transfer', reason }]`；(d) 替換既有 `pendingTransferOut` 邏輯
- [X] T023 [US2] 於 [server.js](../../server.js) 同 handler 內以 `db.run('BEGIN'); try { ... db.run('COMMIT'); saveDB() } catch { db.run('ROLLBACK'); ... }` 包覆「自動建立缺項 + 寫入交易 + 寫入 linked_id」三階段（FR-014a）；rollback 時 response 500 含 `failedAt` 欄位指出 CSV 行號或階段名稱
- [X] T024 [US2] 於 [server.js](../../server.js) 同 handler response 前呼叫 `writeOperationAudit()`：成功 `result: 'success'` + `metadata: { rows, imported, skipped, errors, warnings, unknown_columns }`；失敗 `result: 'failed'` + `metadata.failure_stage` / `failure_reason`
- [X] T025 [US2] 於 [server.js](../../server.js) 同 handler response shape 補 `warnings` 欄位 + `errors[].row` 欄位（依 [contracts ImportSummary](./contracts/data-export-import.openapi.yaml)）
- [X] T026 [US2] 於 [server.js](../../server.js) 既有股票相關區塊新增 `app.get('/api/imports/progress', authMiddleware, ...)` handler：讀 `importProgress.get(userId)` → 有則回 `{ active: true, ...entry }`、無則 `{ active: false }`；entry 在 completedAt 後 5 秒由 setTimeout `delete(userId)`
- [X] T027 [US2] 於 [server.js](../../server.js) 同 handler 內加入 CSV 額外欄位 silent drop 邏輯（FR-006a）：解析 row 時偵測未識別 key、`console.log(JSON.stringify({ event: 'csv_unknown_columns', userId, action, columns }))`；response 含 `unknownColumns` 陣列
- [X] T028 [US2] 於 [app.js](../../app.js) 既有 import 流程：(a) 上傳前先 `fetch('/api/imports/progress')` 檢查 active；active 則禁用上傳按鈕並提示；(b) 上傳後啟動 T016 的 `pollImportProgress()`；(c) 接收 409 `IMPORT_IN_PROGRESS` 顯示對應 toast；(d) 完成 Modal 改用 T016 的 `showImportCompleteModal()` 含 warnings 清單；(e) 接收 500 with `failedAt` 顯示「整批 rollback、失敗位置：X」訊息；(f) **保留既有「前 10 筆預覽 Modal」（FR-007）**：本次 refactor 僅替換進度與完成階段 UI，**不變動**檔案上傳後 → 解析 → 預覽 Modal → 使用者「確認匯入」流程，避免 silent regression；(g) **編碼 fallback（FR Edge Case「編碼非 UTF-8」）**：FileReader.readAsText 預設 `'utf-8'`；若解碼結果含 `�` 替代字元 > 0.1% 比例，自動重試 `readAsText('big5')`；兩者皆失敗（仍含 � > 0.1% 或無法解析為 CSV）則 toast 提示「檔案編碼非 UTF-8 / Big5，請以 UTF-8 重新存檔後再上傳」並中止解析；不引入新依賴（FileReader 為瀏覽器內建）

**Checkpoint**：US2 可獨立驗證 — 1000 筆 + 100 對轉帳匯入 ≤ 30 秒、進度條每 500 筆 advance、互斥鎖、原子性、重複偵測冪等。

---

## Phase 5：User Story 3 — 匯出與匯入分類結構 CSV（Priority: P2）

**Goal**：使用者能匯出 / 匯入分類結構（含父子順序與顏色）；hex 顏色嚴格驗證；唯一鍵類型 + 名稱、重複略過。

**Independent Test**：[quickstart.md §4](./quickstart.md) — 33 筆分類匯出再匯入；重複匯入全部「略過」；`#F53` 與 `red` 歸為錯誤。

### Implementation for User Story 3

- [X] T029 [US3] 於 [server.js](../../server.js) 新增 `app.get('/api/categories/export', authMiddleware, ...)` handler：(a) `SELECT * FROM categories WHERE user_id = ? ORDER BY parent_id IS NULL DESC, sort_order`；(b) 父分類在前、子分類在後；(c) 欄位順序：類型、分類名稱、上層分類、顏色；(d) 顏色輸出 `#RRGGBB`（既有資料若為 3 碼短寫，匯出端 normalize 為 6 碼）；(e) Formula Injection escape；(f) `writeOperationAudit({ action: 'export_categories', ... })`
- [X] T030 [US3] 於 [server.js](../../server.js) 新增 `app.post('/api/categories/import', authMiddleware, ...)` handler：(a) 用 T008 acquireImportLock；(b) 用 T011 `isValidHexColor()` 驗證每行顏色，不通過列入 errors（reason `'顏色格式必須為 #RRGGBB'`）；(c) 全 DB transaction 包覆；(d) 先建父分類後建子分類（不論 CSV 內順序）；(e) 唯一鍵 `(type, name)`、重複略過；(f) 進度回饋；(g) `writeOperationAudit({ action: 'import_categories', ... })`；(h) response shape 同 ImportSummary
- [X] T031 [US3] 於 [app.js](../../app.js) 移除既有 client-side 分類 CSV 組裝（[app.js:6665](../../app.js#L6665)）；改為 `fetch('/api/categories/export')` → blob → download
- [X] T032 [US3] 於 [app.js](../../app.js) 改寫既有分類匯入流程（[app.js:6712](../../app.js#L6712) 附近）：原本多次 POST `/api/categories` → 改為單次 POST `/api/categories/import` 帶 rows 陣列；接收 ImportSummary 顯示「成功 / 略過 / 錯誤」彙總

**Checkpoint**：US3 可獨立驗證 — 父子順序正確、重複匯入冪等、顏色驗證生效。

---

## Phase 6：User Story 4 — 匯出與匯入股票交易、股利 CSV（Priority: P2）

**Goal**：兩份獨立 CSV（股票交易 + 股利）匯出匯入；持倉缺項自動建立；name 為代號的舊資料以 CSV name 自動修正；股利現金股利 > 0 時帳戶必填；純股票股利合成 $0 買進交易帳戶推導。

**Independent Test**：[quickstart.md §5](./quickstart.md) — 100 筆交易 + 30 筆股利匯入；3 檔名稱被 UPDATE；重複匯入「略過」；現金股利 > 0 帳戶留空歸錯誤。

### Implementation for User Story 4

- [X] T033 [US4] 於 [server.js](../../server.js) 新增 `app.get('/api/stock-transactions/export', authMiddleware, ...)` handler：(a) `SELECT st.*, s.symbol, s.name AS stock_name, a.name AS account_name FROM stock_transactions st JOIN stocks s ON ... LEFT JOIN accounts a ON ...`；(b) 欄位順序：日期、股票代號、股票名稱、類型、股數、成交價、手續費、交易稅、帳戶、備註；(c) 類型輸出中文（buy→買進 / sell→賣出）；(d) Formula Injection escape；(e) `writeOperationAudit({ action: 'export_stock_transactions', ... })`
- [X] T034 [US4] 於 [server.js](../../server.js) 新增 `app.get('/api/stock-dividends/export', authMiddleware, ...)` handler：(a) `SELECT sd.*, s.symbol, s.name AS stock_name`；(b) 欄位順序：日期、股票代號、股票名稱、現金股利、股票股利、帳戶、備註；(c) 帳戶欄位：現金股利 > 0 時填入款帳戶名稱（從 transactions 表 `WHERE note LIKE '%股利%'` 等推導；或於 stock_dividends 表結構未持久化帳戶資訊時，以 spec 規範的「現金股利入款交易」對應 account_name 反查）；(d) `writeOperationAudit({ action: 'export_stock_dividends', ... })`
- [X] T035 [US4] 於 [server.js](../../server.js) 改寫 `POST /api/stock-transactions/import`（[server.js:8495](../../server.js#L8495)）：(a) 加入 acquireImportLock + finally release；(b) 進度回饋；(c) ISO 8601 嚴格；(d) 六欄重複偵測（日期+代號+類型+股數+成交價+帳戶）；(e) 全 DB transaction 包覆；(f) 保留既有「name 為 symbol 時 UPDATE」邏輯（FR-021）；(g) `writeOperationAudit({ action: 'import_stock_transactions', ... })`
- [X] T036 [US4] 於 [server.js](../../server.js) 改寫 `POST /api/stock-dividends/import`（[server.js:8538](../../server.js#L8538)）：(a) 同上互斥鎖 + 進度 + ISO 8601 + transaction；(b) 加入「現金股利 > 0 時 `accountName` 必填」驗證；不通過列入 errors（reason `'現金股利 > 0 時必填帳戶'`）；(c) **FR-023 合成 $0 買進交易（必須）**：每行若 `stockDividend > 0`，於同一 DB transaction 內 `INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, 'buy', ?, ?, 0, 0, 0, ?, '[SYNTH] 股票股利配發 ' || COALESCE(?, ''), ?)`；先寫合成交易再寫 stock_dividends；audit 既有非匯入路徑 `POST /api/stock-dividends`（006 已實作）的相同邏輯並複用 helper（如有）；無既有 helper 則於本任務內 inline；(d) 純股票股利（cashDividend = 0、stockDividend > 0、accountName 空）合成 $0 買進交易的 `account_id` 推導（FR-023b）：(d1) 查 `SELECT account_id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' ORDER BY date DESC LIMIT 1`；(d2) 若無，查使用者唯一證券帳戶；(d3) 若有多個證券帳戶且該股票無歷史，列入 errors（reason `'純股票股利合成交易無法判定所屬帳戶，請於 CSV 帳戶欄位明示'`）；若 CSV `accountName` 有填值（即使現金股利 = 0），直接以該帳戶為合成交易的 `account_id`（顯式優先於推導）；(e) 四欄重複偵測（日期+代號+現金股利+股票股利）；(f) `writeOperationAudit({ action: 'import_stock_dividends', ... })`
- [X] T037 [US4] 於 [app.js](../../app.js) 移除既有股票交易 client-side CSV 組裝（[app.js:4749](../../app.js#L4749)）；改為 fetch 端點下載
- [X] T038 [US4] 於 [app.js](../../app.js) 移除既有股利 client-side CSV 組裝（[app.js:4763](../../app.js#L4763)）；改為 fetch 端點下載
- [X] T039 [US4] 於 [app.js](../../app.js) 既有股利匯入 UI（CSV 解析）補上「帳戶」欄位對應（CSV 第 6 欄）；上傳前 client-side 預檢「現金股利 > 0 但帳戶空」並紅字提示；伺服端再次驗證為最終防線

**Checkpoint**：US4 可獨立驗證 — 兩份 CSV 獨立匯入；持倉缺項自動建立；name 修正；FR-023b 三條件推導；FR-019 帳戶必填邏輯。

---

## Phase 7：User Story 5 — 全球即時匯率自動更新（Priority: P2）

**Goal**：ISO 4217 白名單前置驗證；30 分鐘跨使用者快取；is_manual = false 才被自動更新覆寫；手動編輯 ±20% 偏離 UI 警告。

**Independent Test**：[quickstart.md §6](./quickstart.md) — `XYZ` 拒絕；30 分鐘內第二次按按鈕命中快取；USD 39.00（實際 32.45）顯示偏離警告。

### Implementation for User Story 5

- [X] T040 [US5] 於 [server.js](../../server.js) `PUT /api/exchange-rates`（[server.js:5556](../../server.js#L5556)）handler 開頭加入 `if (!isValidCurrency(currency)) return res.status(400).json({ error: '不是有效的 ISO 4217 幣別代碼' })`（FR-030）；保留既有空值 / 非數字 / `≤ 0` 拒絕邏輯
- [X] T041 [P] [US5] 於 [server.js](../../server.js) `GET /api/exchange-rates/:currency`（[server.js:5623](../../server.js#L5623)）handler 開頭加入同樣的 ISO 4217 前置驗證（FR-030 二次防線）
- [X] T042 [P] [US5] Audit 既有 [lib/exchangeRateCache.js](../../lib/exchangeRateCache.js)：確認 30 分鐘 TTL（1800000 ms）與 `exchange_rates_global` 共用快取邏輯運作（FR-032）；若 TTL 不正確則修正（為純常數調整、無新依賴）；`UI 顯示「上次取得時間」精確到秒` 由前端 T044 處理
- [X] T043 [P] [US5] 於 [app.js](../../app.js) 既有「匯率設定」頁區塊內以 module-level `const ISO_4217_CODES = [...]` array literal 形式 hardcode 副本（內容與後端 [lib/iso4217.js](../../lib/iso4217.js) 一致；置於 IIFE 內既有匯率相關 helper 區塊頂部）；「+ 新增幣別」UI 改用 `<select>` 下拉選單渲染所有白名單值；亦支援自由輸入後即時比對；非白名單即時拒絕並提示「不是有效的 ISO 4217 幣別代碼」。**為何採前端 hardcode 而非新增 `GET /api/iso4217` 端點**：白名單為純靜態資料（~180 條 ASCII，~1KB minified），加端點意味多一支 fetch / 多一輪 HTTP round-trip / OpenAPI 條目；hardcode 為最小擾動；後端 / 前端兩份副本同步維護由 PR review 把關（兩份檔案 grep 內容比對即可）
- [X] T044 [US5] 於 [app.js](../../app.js) 「匯率設定」頁編輯匯率欄位 onChange：(a) 硬性檢查空值 / 非數字 / `≤ 0` → 直接拒絕；(b) 與 fxCache 內最近一次 `is_manual = false` 紀錄比對（既有 `GET /api/exchange-rates` 已回傳 is_manual）；(c) 偏離 ±20% 顯示黃色警告（`.rate-deviation-warning`）含建議值與「確認儲存」按鈕；(d) 無比對基準時略過 ±20% 警告
- [X] T045 [P] [US5] 於 [style.css](../../style.css) 新增 `.rate-deviation-warning` 樣式（黃色背景、警告圖示）
- [X] T046 [P] [US5] 於 [app.js](../../app.js) 「匯率設定」頁 UI 確認「上次取得時間」顯示精確到秒（FR-031）：既有 timestamp 為 epoch ms，顯示時用 `new Date(ms).toISOString().slice(0, 19).replace('T', ' ')` 或 `toLocaleString` 精確到秒

**Checkpoint**：US5 可獨立驗證 — ISO 4217 拒絕 `XYZ`；快取命中 ≤ 100 ms；±20% 警告生效但允許覆寫。

---

## Phase 8：User Story 6 — 管理員整檔備份／還原（Priority: P3）

**Goal**：管理員可下載 / 還原；下載前確認 Modal；還原前自動寫入 `backups/before-restore-{ts}.db`；還原失敗自動回滾；保留 5 份 + 90 天清理；一般使用者隱藏入口。

**Independent Test**：[quickstart.md §7](./quickstart.md) — 50 MB DB 還原 ≤ 60 秒（SC-006）；模擬還原失敗自動回滾；`backups/` 列表 + 路徑遍歷防護。

### Implementation for User Story 6

- [X] T047 [US6] 於 [server.js](../../server.js) `GET /api/database/export`（[server.js:8830](../../server.js#L8830)）改檔名格式為 `assetpilot-backup-{YYYYMMDDHHmmss}.db`（FR-024）：將 `new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)` 改為 `new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)`；handler 末段呼叫 `writeOperationAudit({ action: 'download_backup', isAdminOperation: true, role: 'admin', metadata: { byteSize, filename } })`
- [X] T048 [US6] 於 [server.js](../../server.js) `POST /api/database/import`（[server.js:8845](../../server.js#L8845)）改寫：(a) `requiredTables` 加入 `'stocks'`（FR-025）；(b) 通過驗證後呼叫 T013 `ensureBackupsDir()` + 寫 `backups/before-restore-{ts}.db`（取代既有 `DB_PATH + '.backup_<ts>'`，FR-026）；(c) 替換主資料庫 try/catch 失敗時讀 before-restore 檔回寫 + 重新 `new SQL.Database()`，response 422 `{ error: 'RESTORE_FAILED_ROLLED_BACK', beforeRestorePath, ... }`（FR-026a）；(d) 雙重失敗 response 500 `{ error: 'RESTORE_FAILED_DB_UNKNOWN', availableBackups: [...] }`；(e) 寫入新檔後呼叫 T013 `pruneBeforeRestoreBackups()`；(f) 三條路徑分別呼叫 `writeOperationAudit({ action: 'restore_backup' / 'restore_failed', result: 'success' / 'failed' / 'rolled_back', ... })`
- [X] T049 [P] [US6] 於 [server.js](../../server.js) 新增 `app.get('/api/admin/backups', adminMiddleware, ...)` handler：列出 `backups/` 內 `before-restore-*.db` 與（若有）`assetpilot-backup-*.db` 名單；每項回 `{ filename, sizeBytes, mtime, kind }`；`totalSizeBytes` 加總
- [X] T050 [P] [US6] 於 [server.js](../../server.js) 新增 `app.delete('/api/admin/backups/:filename', adminMiddleware, ...)` handler：以 `path.basename(req.params.filename)` 強制扁平化防路徑遍歷；regex 驗證 `^(before-restore-|assetpilot-backup-)\d{14}\.db$`；存在則 `fs.unlinkSync()` + 回 200；否則 404
- [X] T051 [US6] 於 [app.js](../../app.js) 既有「下載備份」按鈕：插入確認 Modal 流程 — 按下後先 open Modal（含 FR-024a 警示文字）；點「確認下載」才 trigger `window.location = '/api/database/export'`；點「取消」不下載
- [X] T052 [P] [US6] 於 [app.js](../../app.js) 既有「還原資料庫」流程：接收 422 `RESTORE_FAILED_ROLLED_BACK` 顯示「還原失敗，已自動回復至還原前狀態，請檢查 server 日誌」；接收 500 `RESTORE_FAILED_DB_UNKNOWN` 顯示「主資料庫狀態未知，請聯繫管理員」+ 列出 availableBackups
- [X] T053 [P] [US6] 於 [app.js](../../app.js) 新增管理員「自動備份清單」頁面：fetch `/api/admin/backups` 渲染 list（含 mtime、size、kind）；每項一個「刪除」按鈕（二次確認後 DELETE）
- [X] T054 [P] [US6] 於 [index.html](../../index.html) 插入「下載備份確認 Modal」DOM 與「自動備份清單」區塊容器
- [X] T055 [P] [US6] 於 [style.css](../../style.css) 新增 `.modal-confirm-warning` 樣式（紅色強調警示框）

**Checkpoint**：US6 可獨立驗證 — 一般使用者看不見入口；下載前 Modal；還原失敗自動回滾；保留 5 份 + 90 天；路徑遍歷防護。

---

## Phase 9：User Story 7 — API 使用與授權資訊頁（Priority: P3）

**Goal**：側邊欄獨立頁面集中列出 5+ 條外部 API；IPinfo 顯示 `IP address data is powered by IPinfo`；資料以 JSON 驅動，新增條目不需改 UI 元件。

**Independent Test**：[quickstart.md §8](./quickstart.md) — 5 條目齊全、IPinfo 字樣顯示、編輯 JSON 新增第 6 條目重啟後立即可見。

### Implementation for User Story 7

- [X] T056 [US7] 於 [server.js](../../server.js) 新增 `app.get('/api/external-apis', ...)` handler（無 authMiddleware；公開端點）：回 `{ apis: externalApisData }`（依賴 T015 引入的 `externalApisData`）；附 header `Cache-Control: public, max-age=3600`
- [X] T057 [P] [US7] 於 [app.js](../../app.js) 新增「API 使用與授權」頁面：fetch `/api/external-apis` → 渲染條目列表；IPinfo 條目（`attribution` 非空）強制顯示為紅色 / 顯眼 badge；每項官方連結 `target="_blank" rel="noopener"`
- [X] T058 [P] [US7] 於 [index.html](../../index.html) 新增側邊欄「API 使用與授權」入口連結 + 對應頁面容器 `<section id="page-external-apis"></section>`

**Checkpoint**：US7 可獨立驗證 — 5 條目顯示、IPinfo 字樣存在、新增第 6 條目（編輯 JSON + restart）即可見。

---

## Phase 10：稽核日誌查詢 UI（橫切，整合所有 user story）

**Purpose**：FR-045 / FR-046a / FR-046b 要求的查詢介面 — 管理員「稽核日誌」分頁、一般使用者「我的操作紀錄」分頁、保留期設定、清空、CSV 匯出。本 phase 不屬任一 user story（橫切於 US1-US7 寫入的稽核紀錄之上），但需於前 9 個 phase 完成後才有真實資料可查。

- [X] T059 [P] 於 [server.js](../../server.js) 新增 `app.get('/api/admin/data-audit', adminMiddleware, ...)`：query `user_id`、`action`（comma-separated）、`result`、`start`、`end`、`page`（default 1）、`pageSize`（default 50, max 200）；走 `idx_data_audit_user_time` / `idx_data_audit_time` index；response `{ data, total, page, totalPages }`
- [X] T060 [P] 於 [server.js](../../server.js) 新增 `app.get('/api/user/data-audit', authMiddleware, ...)`：強制覆寫 `user_id = req.userId`（防跨使用者查詢）；其餘 query 同 T059；response 同上
- [X] T061 [P] 於 [server.js](../../server.js) 新增 `app.get('/api/admin/data-audit/export', adminMiddleware, ...)`：產 CSV，欄位 id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata；檔名 `audit-log-{YYYYMMDDHHmmss}.csv`；Formula Injection escape
- [X] T062 [P] 於 [server.js](../../server.js) 新增 `app.post('/api/admin/data-audit/purge', adminMiddleware, ...)`：執行 `DELETE FROM data_operation_audit_log` + saveDB；回 `{ ok: true, deleted }`
- [X] T063 [P] 於 [server.js](../../server.js) 新增 `app.get('/api/admin/data-audit/retention', adminMiddleware, ...)`：`SELECT value FROM system_settings WHERE key = 'audit_log_retention_days'` → 回 `{ retention_days }`
- [X] T064 [P] 於 [server.js](../../server.js) 新增 `app.put('/api/admin/data-audit/retention', adminMiddleware, ...)`：body `{ retention_days }`，enum 驗證 `['30', '90', '180', '365', 'forever']`；UPDATE system_settings + saveDB；回 `{ ok: true, retention_days }`
- [X] T065 於 [app.js](../../app.js) 新增管理員「稽核日誌」分頁：(a) 過濾表單（user_id / action 多選 / result / 時間區間）；(b) 列表（timestamp DESC、每頁 50）；(c) 每行可展開查看 metadata JSON 詳情（pretty print）；(d) 「匯出 CSV」按鈕；(e) 「清空全部」按鈕（含二次確認 Modal）；(f) 「保留天數」下拉（30/90/180/365/永久）+ 儲存按鈕
- [X] T066 [P] 於 [app.js](../../app.js) 新增一般使用者「我的操作紀錄」分頁：UI 同 T065 但不含 user_id 過濾、不含「清空」與「保留天數」設定；fetch `/api/user/data-audit`
- [X] T067 [P] 於 [index.html](../../index.html) 插入管理員「稽核日誌」分頁容器（位於管理員設定頁內）+ 一般使用者「我的操作紀錄」分頁容器（位於個人設定頁內）
- [X] T068 [P] 於 [style.css](../../style.css) 新增 `.audit-log-table` 與 `.audit-log-row-detail`（metadata JSON 展開區塊）樣式

**Checkpoint**：稽核日誌查詢 UI 完成 — 管理員可過濾、分頁、展開、匯出、清空、設定保留期；一般使用者僅見自己的紀錄。

---

## Phase 11：Polish & Cross-Cutting

**Purpose**：契約、版本、文件、回歸驗證。

- [X] T069 [P] 更新根目錄 [openapi.yaml](../../openapi.yaml)：(a) `info.version 4.27.0 → 4.28.0`；(b) 新增本 feature 的 15 個端點與 6 個既有端點變更（依 [contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml)）；(c) `components.schemas` 新增 `ImportSummary` / `ImportProgress` / `DataOperationAuditLog` / `ExternalApiEntry` / `BackupFileInfo`；(d) `components.responses` 新增 `ImportInProgress` / `PayloadTooLarge`
- [X] T070 [P] 更新 [changelog.json](../../changelog.json)：新增 4.28.0 條目（繁體中文）含本功能主要變更摘要（資料匯出匯入、稽核日誌、API 授權頁、ISO 4217 白名單）
- [X] T071 [P] 更新 [SRS.md](../../SRS.md)：補登 15 個新端點、`data_operation_audit_log` 與 `system_settings` 表、`backups/` 子目錄、ISO 4217 白名單功能；維持既有版本歷史格式
- [X] T072 [P] 更新 [.env.example](../../.env.example)：本功能無新環境變數，但確認 `EXCHANGE_RATE_API_KEY` 註解涵蓋付費 / 免費版說明（既有已有，僅 audit）
- [X] T073 執行 [quickstart.md](./quickstart.md) §1 部署檢核：restart server、確認新表存在、`audit_log_retention_days = '90'`、`backups/` 被 git/docker 忽略
- [X] T074 執行 [quickstart.md](./quickstart.md) §2 ~ §9 全部劇本：US1 ~ US7 + 稽核日誌查詢，逐項打勾完成清單（§12）
- [X] T075 執行 [quickstart.md](./quickstart.md) §10 效能驗證：SC-001（5000 筆匯出 ≤ 5 秒）、SC-002（1000 筆匯入 ≤ 30 秒）、SC-006（50 MB 還原 ≤ 60 秒）、SC-008（API 授權頁覆蓋 100% outbound HTTP client）
- [X] T076 執行 [quickstart.md](./quickstart.md) §11 回歸測試：001~006 既有功能（交易 CRUD、分類 reorder/restore-defaults、股票投資、匯率自動更新、登入/登出/Passkey/Google SSO）皆無破壞
- [X] T077 [P] 於 [openapi.yaml](../../openapi.yaml) `tags` 區塊新增本功能對應 tag（資料匯出 / 資料匯入 / 資料庫備份 / 稽核日誌 / 對外 API）
- [X] T078 跑 `npx @redocly/cli lint openapi.yaml` 驗證 OpenAPI 3.2.0 格式正確、無冒號路徑、無重複 schema（憲章 Principle II + III lint 要求）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**：無依賴 — 可立即開始（T001 ~ T006 全 [P]）。
- **Foundational (Phase 2)**：依賴 Setup — T007 必須先於 T008-T014；T015 依賴 T003、T004；T010-T013、T016 可並行。**完成後始可開始 user story 工作**。
- **User Stories (Phase 3-9)**：皆依賴 Foundational 完成後可並行。
- **Phase 10 (稽核日誌查詢 UI)**：依賴 Phase 2（T009 `writeOperationAudit`）+ 至少一個 user story 完成（才有資料可查）。
- **Phase 11 (Polish)**：依賴前 10 個 phase 全部完成。

### User Story Dependencies

- **US1 (P1)**：依賴 Foundational（T010 buildCsv、T009 writeOperationAudit）。
- **US2 (P1)**：依賴 Foundational（T008 lock、T009 audit、T011 ISO 8601、T012 hash、T016 前端 helper）；**與 US1 邏輯獨立**（不同 endpoint）。
- **US3 (P2)**：依賴 Foundational（T010、T011 hex 驗證、T009、T008）；獨立於 US1 / US2。
- **US4 (P2)**：依賴 Foundational + 既有 006 baseline；獨立於 US1 ~ US3。
- **US5 (P2)**：依賴 Foundational（T015 引入 isValidCurrency）；獨立於 US1 ~ US4。
- **US6 (P3)**：依賴 Foundational（T013 backups helper、T009、T015 確認 ensureBackupsDir 用於 path.join）；獨立於 US1 ~ US5。
- **US7 (P3)**：依賴 Foundational（T015 引入 externalApisData）；完全獨立。

### Within Each User Story

- 後端 endpoint 任務 → 前端整合任務（同 phase 內順序）。
- 不同檔案的並行任務以 [P] 標記。
- 同一檔案（如 server.js）的任務不可並行（避免衝突）。

### Parallel Opportunities

- **Phase 1**：T001-T006 全 [P]（不同檔案 / schema 區塊）。
- **Phase 2**：T010-T013 全 [P]、T015-T016 全 [P]（不同程式區塊）。
- **Phase 3-9**：US1 ~ US7 可由不同開發者並行；單一 user story 內 [P] 任務（如 T037-T038-T039 同 app.js 但不同函式）需依檔案實際衝突狀況判定。
- **Phase 10**：T059-T064（server.js 不同 endpoint）、T065-T068 之多項可並行。
- **Phase 11**：T069-T072 完全並行（不同檔案）；T077 在 T069 之後跑（同檔案）。

---

## Parallel Example：Phase 1 Setup 並行啟動

```bash
# 同時啟動以下 6 個任務（不同檔案）：
Task: "T001 新增 data_operation_audit_log 表於 server.js"
Task: "T002 新增 system_settings 表於 server.js（同 server.js 但不同 INSERT 區塊）"
Task: "T003 新增 lib/iso4217.js"
Task: "T004 新增 lib/external-apis.json"
Task: "T005 .gitignore 加入 backups/"
Task: "T006 .dockerignore 加入 backups/"

# 注意 T001 與 T002 同檔案，實務上仍序列；標 [P] 因兩者程式區塊獨立
# 嚴格序列 = T001 → T002（同檔不衝突也應審慎）
```

## Parallel Example：Phase 3 (US1) 完成後啟動 Phase 4 (US2) 與 Phase 5 (US3)

```bash
# 假設 3 名工程師
Developer A: Phase 4 — T019-T028（US2 交易匯入）
Developer B: Phase 5 — T029-T032（US3 分類匯出匯入）
Developer C: Phase 6 — T033-T039（US4 股票匯出匯入）
# 三者皆改 server.js 不同 endpoint 區塊與 app.js 不同函式區塊；
# 收尾 merge 時注意 server.js 行號 conflict（建議以 block comment marker 隔離）
```

---

## Implementation Strategy

### MVP 路徑（US1 + US2 完成即可發佈）

1. 完成 Phase 1（T001-T006）+ Phase 2（T007-T016）→ 基礎設施就緒
2. 完成 Phase 3（T017-T018）→ US1 交易匯出可用
3. 完成 Phase 4（T019-T028）→ US2 交易匯入可用 — **MVP 達成**：使用者能完整把交易資料帶走再帶回
4. **STOP 並驗證**：[quickstart.md §2、§3](./quickstart.md) — 5000 筆匯出 ≤ 5 秒、1000 筆匯入 ≤ 30 秒、互斥鎖、原子性、轉帳配對全通
5. （選擇）部署至 staging / 給 alpha 使用者

### 漸進式交付

1. MVP（US1 + US2）→ 部署 → 收 feedback
2. 加入 US3（分類）→ 部署 → 換新環境的使用者更滿意
3. 加入 US4（股票 / 股利）→ 部署 → 投資型使用者完整覆蓋
4. 加入 US5（匯率 ISO 4217 + 警告）→ 部署 → 多幣別使用者體驗強化
5. 加入 US6（整檔備份還原）→ 部署 → 災難復原能力
6. 加入 US7（API 授權頁）→ 部署 → 合規覆蓋
7. 加入 Phase 10（稽核日誌查詢 UI）→ 部署 → 透明度提升
8. Phase 11（Polish）→ 最終 PR merge

### 多人團隊並行策略

完成 Phase 1 + Phase 2 後，3 ~ 4 人可如下分工：

- 工程師 A：US1 + US2（P1，最高優先；含 server.js 主要 import 改寫）
- 工程師 B：US3 + US4（P2，分類 + 股票兩條獨立路徑）
- 工程師 C：US5 + US7（P2 / P3，匯率 + API 授權頁，前後端較輕）
- 工程師 D：US6（P3，後端備份還原 + 前端管理員 UI；獨立路徑風險最高，建議單獨負責）
- Phase 10（稽核日誌查詢 UI）由整合期任意工程師完成
- Phase 11 由 release manager 統籌

---

## Notes

- 所有 server.js 任務皆以「於既有檔案插入或改寫」為主；merge 時行號 conflict 風險高，建議以區塊 comment marker（如 `// ─── 007 feature: import progress ───`）隔離。
- 所有前端任務皆改既有 `app.js` / `index.html` / `style.css`；採同樣 marker 策略。
- 稽核日誌寫入（`writeOperationAudit`）穿插於 11 支端點（4 export + 4 import + download_backup + restore_backup + restore_failed），每支端點完成後立即補上呼叫，避免最後一次性整合遺漏。
- [P] 標記僅標示「理論上可平行」；同檔案不同區塊的 [P] 仍建議序列以避免 git conflict。
- 每完成一個 user story 後立即執行 [quickstart.md](./quickstart.md) 對應段，發現問題立即修，避免最終整合期的 bug 雪崩。
- 提交建議：每完成一組 [P] 任務或一個 phase 即 commit；不堆積大型 PR。
