---
description: "實作任務清單：交易與帳戶（002-transactions-accounts）"
---

# Tasks：交易與帳戶（Transactions & Accounts）

**Input**：`/specs/002-transactions-accounts/` 下的設計文件
**Prerequisites**：

- [plan.md](./plan.md)（必要）
- [spec.md](./spec.md)（必要 — 6 個 User Story、20 條 Clarification）
- [research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)、[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml)（補充）

**Tests**：本功能規格**未要求**自動化測試框架；驗收以
[quickstart.md](./quickstart.md) 的手動 + `curl` 驗證流程為準（與 001
一致）。下列任務不含 test task；若後續改採 TDD，請於對應 phase 追加
`[P] [US?]` test task 於實作任務之前。

**Organization**：按 User Story 分組，使每個 story 可獨立實作、獨立
驗證、獨立合併。MVP 範圍 = Phase 3 (US1) + Phase 4 (US2)；spec.md
明確標示兩者皆為 P1。

## Format：`[ID] [P?] [Story] Description with file path`

- **[P]**：可與同 phase 其他 `[P]` 任務並行（不同檔案、不互相阻擋）
- **[Story]**：`[US1]`..`[US6]` 對應 spec.md 的使用者故事；
  Setup／Foundational／Polish 不帶 story 標籤
- 所有路徑以 repo root 為基準

## Path Conventions

本專案為 **single-project**（單體 Express + SPA；與 001 一致）：

- 後端：`server.js`（所有 API、中介層、背景排程）+ 本功能新增 `lib/*`
  純函式工具
- 前端：`index.html`、`app.js`、`style.css`（SPA，無打包）
- 契約：根目錄 `openapi.yaml`（全站）+ 本功能子契約
  `specs/002-transactions-accounts/contracts/transactions.openapi.yaml`
- 資料：`database.db`（sql.js 持久化）
- 環境：`.env`、`.env.example`（沿用 001 變數，不新增）

---

## Phase 1：Setup（共用基礎設施）

**Purpose**：新增本功能依賴與 `lib/*` 目錄骨架；不接 API 路由、不
接 DB schema。

- [ ] T001 於 `package.json` `dependencies` 新增 `"decimal.js": "^10.4.3"`；執行 `npm install` 驗證 `node_modules/decimal.js` 存在；確認 `package-lock.json` 同步更新（FR-022a）
- [ ] T002 [P] (a) 建立 `lib/` 目錄與三檔骨架；`lib/moneyDecimal.js` 寫入同構雛型 `// 同構模組（前後端共用），實作見 T016\nconst __exports = {};\nif (typeof module !== 'undefined' && module.exports) module.exports = __exports;\nif (typeof window !== 'undefined') window.moneyDecimal = __exports;`；`lib/taipeiTime.js` 與 `lib/exchangeRateCache.js` 寫入 `module.exports = {};` 與檔頭一行 zh-TW 註解標註「server-only」；`server.js` 暫不 require，避免破壞既有啟動。(b) 於 `index.html` `<head>` 加入 `decimal.js` CDN + SRI：`<script src="https://cdn.jsdelivr.net/npm/decimal.js@10.4.3/decimal.min.js" integrity="sha384-<hash>" crossorigin="anonymous" defer></script>`（hash 以 `curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A` 產生並記入 HTML 註解；版本鎖 `10.4.3` 與 T001 後端 `package.json` 一致避免 round 漂移）；前端載入後 `window.Decimal` 可用，供 T016 `lib/moneyDecimal.js` 之同構檔頭從 `window.Decimal` 取得 Decimal 建構式
- [ ] T003 [P] 於 `.env.example` 確認 `EXCHANGE_RATE_API_KEY=free` 已存在（沿用 001）；若缺則補上一行附 zh-TW 註解「全球即時匯率（exchangerate-api.com）；free 方案 1500 req/月」

---

## Phase 2：Foundational（所有 Story 的阻擋前置）

**Purpose**：Clarification 帶出的跨故事共用能力與 schema migration。
**此 phase 未完成前不得進入任何 User Story 實作**——其中 T010~T013 為
DB schema、T014~T017 為共用工具、T018~T020 為共用中介層／helper。

**⚠️ CRITICAL**：T010~T013 涉及 `database.db` 結構變更；任一失敗將
影響後續所有 story。必須依編號序實作，且每步完成後執行 self-test。

### 2.1 資料庫 schema 與 migration（CT-1）

- [ ] T010 於 `server.js` `initDatabase()` 段（既有 `accounts` 與 `transactions` `CREATE TABLE` 區段，可用編輯器搜尋 `CREATE TABLE IF NOT EXISTS accounts` / `CREATE TABLE IF NOT EXISTS transactions` anchor 定位）下方緊接「002 schema migration」註解區塊；於該區塊**啟動前**執行 `fs.copyFileSync('./database.db', './database.db.bak.' + Date.now())`（僅當 `database.db` 存在時），並 `console.log('[migration 002] backup → ', backupPath)`（[plan.md](./plan.md) CT-1 / [data-model.md](./data-model.md) §3.1）
- [ ] T011 於 `server.js initDatabase()` 對 `accounts` 補欄位（[data-model.md](./data-model.md) §3.2 A 節）：依序 `ALTER TABLE accounts ADD COLUMN category TEXT NOT NULL DEFAULT 'cash'`、`ADD COLUMN overseas_fee_rate INTEGER DEFAULT NULL`、`ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`，三句各包 try-catch ignore（已存在則略過）；緊接執行 `UPDATE accounts SET category = CASE account_type WHEN '銀行' THEN 'bank' WHEN '信用卡' THEN 'credit_card' WHEN '現金' THEN 'cash' WHEN '虛擬' THEN 'virtual_wallet' ELSE 'cash' END WHERE category = 'cash' OR category IS NULL`，再 `UPDATE accounts SET updated_at = COALESCE(strftime('%s', created_at) * 1000, 0) WHERE updated_at = 0`
- [ ] T012 於 `server.js initDatabase()` 對 `transactions` 補欄位（[data-model.md](./data-model.md) §3.2 B 節）：`ALTER TABLE transactions ADD COLUMN to_account_id TEXT DEFAULT NULL`、`ADD COLUMN twd_amount INTEGER NOT NULL DEFAULT 0`，各包 try-catch ignore；補完後執行 `UPDATE transactions SET updated_at = COALESCE(updated_at, created_at, 0) WHERE updated_at IS NULL OR updated_at = 0`；接著重建索引：`CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC)`、`idx_tx_user_acct(user_id, account_id)`、`idx_tx_user_type(user_id, type)`、`idx_tx_linked(linked_id)`、`idx_tx_user_cat(user_id, category_id)`
- [ ] T013 於 `server.js initDatabase()` 完成型別 migration（REAL→INTEGER／REAL→TEXT；[data-model.md](./data-model.md) §3.3）：以 sentinel 偵測 `SELECT typeof(amount) FROM transactions LIMIT 1`，若回傳 `'real'` 則執行重建表流程：`BEGIN`→`CREATE TABLE transactions_new (...新 schema...)`→`INSERT INTO transactions_new SELECT id, user_id, account_id, to_account_id, type, CAST(ROUND(amount) AS INTEGER), currency, CAST(fx_rate AS TEXT), CAST(ROUND(fx_fee) AS INTEGER), CAST(ROUND(amount * fx_rate + fx_fee) AS INTEGER), date, category_id, note, exclude_from_stats, linked_id, created_at, updated_at FROM transactions`→`DROP TABLE transactions`→`ALTER TABLE transactions_new RENAME TO transactions`→重建 5 條索引→`COMMIT`；對 `accounts` 同樣以 sentinel 偵測 `initial_balance` 型別後重建（保留所有欄位 + `CAST(ROUND(initial_balance) AS INTEGER)`）；任一步驟拋例外整批 rollback 並 `console.error('[migration 002] FAILED, restore from ' + backupPath)`，process.exit(1)
- [ ] T014 [P] 於 `server.js initDatabase()` 對 `exchange_rates` 重構（[data-model.md](./data-model.md) §3 / §2.3）：偵測 `PRAGMA table_info(exchange_rates)` 內有 `user_id` 欄位則重建——`CREATE TABLE exchange_rates_new (currency TEXT PRIMARY KEY, rate_to_twd TEXT NOT NULL, fetched_at INTEGER NOT NULL, source TEXT NOT NULL DEFAULT 'exchangerate-api')`→`INSERT INTO exchange_rates_new (currency, rate_to_twd, fetched_at, source) SELECT currency, CAST(rate_to_twd AS TEXT), MAX(updated_at), 'legacy' FROM exchange_rates GROUP BY currency`→`DROP TABLE exchange_rates`→`RENAME`；既有 `exchange_rate_settings` 表保留不動
- [ ] T015 [P] 於 `server.js initDatabase()` 新增 `user_settings` 表（[data-model.md](./data-model.md) §2.4）：`CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT PRIMARY KEY, pinned_currencies TEXT NOT NULL DEFAULT '["TWD"]', updated_at INTEGER NOT NULL)`；建立後執行 self-test：`SELECT COUNT(*) FROM transactions WHERE typeof(amount) != 'integer' OR amount <= 0`（期望 0）、`SELECT COUNT(*) FROM accounts WHERE updated_at <= 0`（期望 0），任一失敗 `console.warn('[migration 002] self-test fail')` 但不 exit（依 [data-model.md](./data-model.md) §3.4 政策）；最後呼叫 `saveDB()`

### 2.2 共用工具函式（`lib/*`）

- [ ] T016 [P] 完成 `lib/moneyDecimal.js`（[research.md](./research.md) §2.3；**同構模組**——前後端共用，見 [plan.md](./plan.md) Project Structure §Structure Decision 2）：實作 `SMALLEST_UNIT_BY_CURRENCY = { TWD: 1, USD: 100, EUR: 100, GBP: 100, CNY: 100, SGD: 100, HKD: 100, JPY: 1, KRW: 1, BHD: 1000, KWD: 1000, OMR: 1000, JOD: 1000 }`、`getSmallestUnit(currency)`（含 `Intl.NumberFormat` fallback）、`computeTwdAmount(amountInt, fxRateStr, fxFeeInt)`（內部以 `new Decimal(amountInt).times(fxRateStr).plus(fxFeeInt).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()` 回傳整數）、`formatForDisplay(amountInt, currency)`（依 minor unit 格式化字串）。**同構 export 樣式**：(a) **檔頭**——`const Decimal = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('decimal.js') : window.Decimal;`（後端走 npm 包；前端從 `window.Decimal` 取得，需 T002 已於 index.html 載入 decimal.js CDN）。(b) **檔尾**——以 UMD 樣式同時暴露：`const __exports = { SMALLEST_UNIT_BY_CURRENCY, getSmallestUnit, computeTwdAmount, formatForDisplay }; if (typeof module !== 'undefined' && module.exports) { module.exports = __exports; } if (typeof window !== 'undefined') { window.moneyDecimal = __exports; }`。前端使用方式：`window.moneyDecimal.computeTwdAmount(amount, fxRate, fxFee)`；後端：`const moneyDecimal = require('./lib/moneyDecimal'); moneyDecimal.computeTwdAmount(...)`。**禁止前端重寫一份簡化版本**——T123 / T125 須直接呼叫 `window.moneyDecimal.*`
- [ ] T017 [P] 完成 `lib/taipeiTime.js`（[research.md](./research.md) §2.2）：實作並 export `todayInTaipei()`（回傳 `'YYYY-MM-DD'` 字串、用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' })`）、`isFutureDate(dateStr)`（`String(dateStr) > todayInTaipei()`）、`isValidIsoDate(s)`（regex `^\d{4}-\d{2}-\d{2}$` + `Date.parse` 驗證）
- [ ] T018 [P] 完成 `lib/exchangeRateCache.js`（[research.md](./research.md) §3.3）：模組頂層宣告 `const inFlight = new Map()` 與 `const cache = new Map()`、`const TTL_MS = 30 * 60 * 1000`；export `getRate(currency)`（async；先查 cache，命中且未過期回 `{ rate, cached: true, source }`；否則查 `inFlight`；都無則呼叫 `fetchAndCache(currency)`）、`fetchAndCache(currency)`（呼叫 `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/TWD`、`AbortController` 2 秒 timeout、單次重試、成功時 `rateToCurrency = conversion_rates[currency]`、`rateToTwd = new Decimal(1).dividedBy(rateToCurrency).toFixed(8)`、寫入 `cache` 與 DB `exchange_rates` upsert）、`primeFromDb()`（啟動時呼叫一次，從 DB 載入既有匯率到 cache）；錯誤時拋 `RateApiError`
- [ ] T019 於 `server.js` 檔頭 require 區段加入 `const moneyDecimal = require('./lib/moneyDecimal');`、`const taipeiTime = require('./lib/taipeiTime');`、`const fxCache = require('./lib/exchangeRateCache');`；於 `initDatabase()` 末尾呼叫 `fxCache.primeFromDb()` 暖機 cache

### 2.3 共用中介層與 helper

- [ ] T020 於 `server.js` 既有 middleware 區段（鄰近 `authMiddleware`）新增三層元件（[research.md](./research.md) §8、[plan.md](./plan.md) §5）：(a) **底層通用 helper** `ownsResource(table, idColumn, idValue, userId)` — 執行 `SELECT * FROM <table> WHERE <idColumn> = ? AND user_id = ? LIMIT 1`；回傳 row 物件或 `null`；本 helper 為 IDOR 唯一資料存取點，禁止其他 handler 直接以 `WHERE id = ?` 不帶 user_id 查詢屬於使用者的資源。(b) `requireOwnedAccount(req, res, next)` — 呼叫 `ownsResource('accounts', 'id', req.params.accountId, req.userId)`；若回傳 `null` 即 `res.status(404).json({ error: 'NotFound' })`；非 null 時 `req.account = row` 後 next。(c) `requireOwnedTransaction(req, res, next)` — 呼叫 `ownsResource('transactions', 'id', req.params.txId, req.userId)`；同樣 null 回 404、非 null 設 `req.tx = row` 後 next（內部不再額外驗 `account_id` 屬同 user，因 `transactions.user_id` 已驗）。其他需要驗證所有權的資源（如 `user_settings`，PK 即 `user_id`）統一沿用 `ownsResource('user_settings', 'user_id', req.userId, req.userId)` 介面，不另外寫一份新邏輯
- [ ] T021 [P] 於 `server.js` 工具函式區新增 `assertOptimisticLock(table, idColumn, idValue, expectedUpdatedAt)`（[research.md](./research.md) §5）：`SELECT updated_at FROM <table> WHERE <idColumn> = ? LIMIT 1`；不存在則 throw `{ status: 404, error: 'NotFound' }`；不符則 throw `{ status: 409, error: 'OptimisticLockConflict', serverUpdatedAt: row.updated_at, message: '此筆已被其他裝置修改，請重新整理後再操作' }`；通過則 return。`idColumn` 參數讓 `accounts.id` / `transactions.id` 與 `user_settings.user_id` 等 PK 名稱不同的資源共用同一介面（與 T020 `ownsResource` 對齊）。Caller 使用模式：`try { assertOptimisticLock('accounts', 'id', accountId, expected_updated_at); } catch (e) { return res.status(e.status).json(e); }`；user_settings 改用 `assertOptimisticLock('user_settings', 'user_id', userId, expected_updated_at)`
- [ ] T022 [P] 於 `server.js` 既有 `createDefaultsForUser(userId)` 函式（搜尋 `function createDefaultsForUser` anchor 定位）末尾新增三段 INSERT（FR-002 / FR-020a；[data-model.md](./data-model.md) §2.1, §2.4）：(a) 預設「現金」帳戶 — `INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, created_at, updated_at) VALUES (?, ?, '現金', 'cash', 0, 'TWD', 'fa-wallet', 0, NULL, NULL, ?, ?)`；(b) 預設 `user_settings` — `INSERT INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, '["TWD"]', ?)`；(c) `saveDB()` 已由外層呼叫，此處不重複；測試方式：刪除測試 user 後以 `/api/auth/register` 重新註冊，DB 應同步出現上述兩列

**Checkpoint**：Foundational 完成後，以下行為應可驗證：

- 啟動服務 log 含 `[migration 002] backup →`、`[migration 002] self-test ...`
- `node -e "require('./lib/moneyDecimal').computeTwdAmount(10000, '0.2103', 31)"` 回傳 `2134`
- `node -e "console.log(require('./lib/taipeiTime').todayInTaipei())"` 回傳當下台灣日期
- 新註冊使用者於 `accounts` 表自動有「現金」帳戶、`user_settings` 有 `["TWD"]`
- `/api/accounts/<他人 id>` 等任何衍生路徑均回 404（驗證 `requireOwnedAccount`）

---

## Phase 3：User Story 1 — 建立帳戶並記下第一筆收入或支出（Priority: P1）🎯 MVP

**Goal**：新使用者完成註冊後可看到預設「現金」帳戶；可新增第二個帳戶；
可新增第一筆收入／支出，並看到帳戶餘額即時反映。

**Independent Test**（spec.md US1）：全新使用者註冊後，(1) 自動擁有
「現金」帳戶、(2) 能新增第二個銀行帳戶、(3) 以任一帳戶記一筆支出、
(4) 兩個帳戶的餘額都與「初始餘額 + 收入 − 支出」的即時計算一致。

**對應 FR**：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、FR-007、
FR-007a、FR-010、FR-011、FR-013、FR-014、FR-014a、FR-018、FR-022a、
FR-060。

### Implementation — 後端 Accounts CRUD

- [ ] T030 [US1] 於 `server.js` 路由區末尾新增 `POST /api/accounts`（FR-001；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `createAccount`）：套用 `authMiddleware`；body 驗證 `name`（trim、長度 1~64）、`category`（enum `bank|credit_card|cash|virtual_wallet`）、`currency`（regex `^[A-Z]{3}$`）、`initialBalance`（整數）、`excludeFromTotal`（boolean，預設 false）、`linkedBankId`（僅 credit_card 可填，且必須是同 user 的 bank 帳戶；以 SELECT 驗證）、`overseasFeeRate`（僅 credit_card 可填，0~1000）；驗證通過後 `INSERT INTO accounts ... values ...`，`created_at = updated_at = Date.now()`；回 201 + 完整 Account 物件（key 採 camelCase 轉換）
- [ ] T031 [US1] 於 `server.js` 新增 `GET /api/accounts`（FR-003）：套 `authMiddleware`；`SELECT * FROM accounts WHERE user_id = ? ORDER BY category, created_at`；回 `{ accounts: [...] }`，欄位 camelCase
- [ ] T032 [US1] 於 `server.js` 新增 `GET /api/accounts/:accountId`：套 `authMiddleware` + `requireOwnedAccount`；額外計算 `currentBalance`（FR-007 / FR-007a）— 呼叫共用函式 `computeAccountBalance(accountId, userId)`（於同檔工具函式區實作；公式 `initialBalance + Σ income.twd_amount − Σ expense.twd_amount + Σ transfer_in.twd_amount − Σ transfer_out.twd_amount`，但**全程使用原幣 amount**而非 twd_amount，因 spec 帳戶餘額為原幣顯示；故公式應為 `initialBalance + SUM(CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount WHEN 'transfer_in' THEN amount WHEN 'transfer_out' THEN -amount END) FROM transactions WHERE account_id = ? AND user_id = ? AND date <= ?`，date 為 `taipeiTime.todayInTaipei()`）
- [ ] T033 [US1] 於 `server.js` 新增 `PATCH /api/accounts/:accountId`（FR-005、FR-014a）：套 `authMiddleware` + `requireOwnedAccount`；body 取 `expected_updated_at` → 呼叫 `assertOptimisticLock('accounts', 'id', req.params.accountId, expected_updated_at)`；若 body 含 `currency` 且 `req.account.currency !== currency`，先檢查 `SELECT COUNT(*) FROM transactions WHERE account_id = ? OR to_account_id = ?`，> 0 即 422 `{ error: 'CurrencyLocked', message: '此帳戶已有交易紀錄，無法變更幣別；如需不同幣別請新增帳戶' }`；通過後 UPDATE 同樣以 camelCase 對 snake_case 對應，`updated_at = Date.now()`；回 200 + 更新後完整 Account
- [ ] T034 [US1] 於 `server.js` 新增 `DELETE /api/accounts/:accountId`（FR-006、FR-014、FR-014a）：套 `authMiddleware` + `requireOwnedAccount`；body 取 `expected_updated_at` 並呼叫 `assertOptimisticLock('accounts', 'id', req.params.accountId, expected_updated_at)`；查 `SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?`；c > 0 即 422 `{ error: 'AccountInUse', referenceCount: c, message: '請先處理該帳戶上的 N 筆交易（可批次移到其他帳戶或刪除）' }`；通過則 `DELETE FROM accounts WHERE id = ? AND user_id = ?` + `saveDB()`；回 204 no content

### Implementation — 後端 Transaction CRUD（單筆）

- [ ] T035 [US1] 於 `server.js` 新增 `POST /api/transactions`（FR-010、FR-011、FR-013、FR-022a；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `createTransaction`）：套 `authMiddleware`；body 接受 `accountId`、`type`（限 `income`/`expense`，禁 `transfer_*`，回 422 + `'TransferEndpointRequired'`）、`amount`（integer ≥ 1）、`currency`（regex）、`fxRate`（非 TWD 必填、TWD 強制覆寫為 `'1'`）、`fxFee`（非 0 僅信用卡 + 非 TWD 可填，其餘強制 0）、`date`（呼叫 `taipeiTime.isValidIsoDate(date)`）、`categoryId`、`note`（trim ≤ 200）、`excludeFromStats`；以 `requireOwnedAccount` 邏輯（手動 SELECT 一次以取得 `req.body.accountId` 對應的 account）驗證 account 屬於 user；以 `categoryId` 驗證屬於同 user（categories.user_id）；後端計算 `twd_amount = moneyDecimal.computeTwdAmount(amount, fxRate, fxFee)`，**忽略前端任何 `twdAmount` 欄位**；`INSERT` 並 `saveDB()`；回 201 + 完整 Transaction
- [ ] T036 [US1] 於 `server.js` 新增 `GET /api/transactions/:txId`（FR-014a 樂觀鎖讀取支援）：套 `authMiddleware` + `requireOwnedTransaction`；直接回 `req.tx`（已由 middleware 帶入 + camelCase 轉換）
- [ ] T037 [US1] 於 `server.js` 新增 `PATCH /api/transactions/:txId`（FR-014、FR-014a）：套 `authMiddleware` + `requireOwnedTransaction`；body 取 `expected_updated_at` → 呼叫 `assertOptimisticLock('transactions', 'id', req.params.txId, expected_updated_at)`；可改欄位限 `amount`、`currency`、`fxRate`、`fxFee`、`date`、`categoryId`、`accountId`、`note`、`excludeFromStats`（**禁** type 變更、禁 transfer_* 之 PATCH——若 `req.tx.type` 為 transfer_*，回 422 `{ error: 'TransferImmutable', message: '轉帳交易僅能整對刪除，無法逐筆編輯欄位（請改用刪除後重建）' }`）；改 currency／amount/fxRate/fxFee 則重算 `twd_amount`；UPDATE 後 `updated_at = Date.now()` 並 `saveDB()`；回 200 + 更新後 Transaction
- [ ] T038 [US1] 於 `server.js` 新增 `DELETE /api/transactions/:txId`（FR-014、FR-014a；FR-015 連動由 US3 處理但 base 邏輯於此實作）：套 `authMiddleware` + `requireOwnedTransaction`；body 取 `expected_updated_at` → 呼叫 `assertOptimisticLock('transactions', 'id', req.params.txId, expected_updated_at)`；包 `BEGIN`：若 `req.tx.linked_id !== ''` 則同 transaction 內 `DELETE FROM transactions WHERE (id = ? OR id = ?) AND user_id = ?`（`req.tx.id` + `req.tx.linked_id`），否則 `DELETE FROM transactions WHERE id = ? AND user_id = ?`；`COMMIT` + `saveDB()`；回 204

### Implementation — 前端 Account & Transaction 主流程

- [ ] T040 [US1] 於 `app.js` 帳戶管理頁元件區段（搜尋既有 `function renderAccounts` 或類似 anchor）新增以「`category` tab」分頁的列表（FR-003）：四個 tab 順序 `cash` / `bank` / `credit_card` / `virtual_wallet`，徽章顯示各 tab 帳戶數；每列顯示 `icon + name + currentBalance + currency`，餘額 = 0 顯示 `$0`；對 `excludeFromTotal === true` 的帳戶於列右上角加灰色虛線外框 + 「已排除」徽章（FR-004）
- [ ] T041 [US1] 於 `app.js` 新增「新增帳戶」按鈕與 Modal（FR-001）：表單欄位 — 名稱（input text）、類別（select 四選一）、幣別（select；US5 之前先 hardcode `['TWD','USD','JPY','EUR']`，US5 / T080 改為 pinned 動態列表）、初始餘額（number；前端以 `Number(parseFloat(input)) | 0` 取整 → 後端會再次驗證）、圖示（FontAwesome class input）、是否計入總資產（checkbox，預設勾選）；類別 = `credit_card` 時動態顯示 `linkedBankId`（依當前 user 的 bank 帳戶填 select）與 `overseasFeeRate`（預設 1.5，範圍 0–10，前端轉成千分點整數送出，例如 1.5 → 150）；送出呼叫 `POST /api/accounts`；成功後關閉 Modal、重新載入列表；錯誤訊息以 toast 顯示
- [ ] T042 [US1] 於 `app.js` 新增「編輯帳戶」Modal（FR-005、FR-014a）：開啟時 `GET /api/accounts/:id` 取得 `updated_at`，存於 `dialog.dataset.expectedUpdatedAt`；提交 PATCH 時帶 `expected_updated_at: Number(dialog.dataset.expectedUpdatedAt)`；若該帳戶 `referenceCount > 0`（先 GET 計算或前端依快取交易判斷），currency 欄位 `disabled` + tooltip「此帳戶已有交易，幣別無法變更」；後端回 422 `CurrencyLocked` 時前端顯示同訊息；409 `OptimisticLockConflict` 時提示「此筆已被其他裝置修改，請重新整理後再操作」並阻擋強制覆寫
- [ ] T043 [US1] 於 `app.js` 新增「刪除帳戶」二次確認 Modal（FR-006、FR-014）：先 `GET` 取 `updated_at`；若 referenceCount > 0 則禁止觸發刪除（按鈕 disabled，附訊息「此帳戶有 N 筆交易，請先處理」）；確認後 `DELETE` 帶 `expected_updated_at`；422 `AccountInUse` 顯示 `referenceCount`
- [ ] T044 [US1] 於 `app.js` 交易頁主體新增「新增交易」Modal（FR-010、FR-011、FR-013、FR-018）：表單欄位 — 類型（radio：支出紅／收入綠／轉帳藍 [按鈕配色由 US3 接續]，US1 先實作支出+收入）、帳戶（select，依當前 accounts）、金額（number ≥ 1）、日期（date input，預設 `taipeiTime.todayInTaipei()`，允許未來）、分類（select，[optgroup] 父→子，FR-012）、備註（textarea，maxlength 200）、是否計入統計（checkbox，預設勾選 → 送 `excludeFromStats: false`）；前端送出時將金額依當前選定 `currency` 乘以最小單位倍率（呼叫 `window.moneyDecimal.getSmallestUnit`，同構模組，T016 / T002；US1 階段尚無外幣，固定走 `1`）；送出後 `POST /api/transactions`；成功則關 Modal、列表前置插入該筆
- [ ] T045 [US1] 於 `app.js` 交易列表元件新增類型色標（FR-018）：支出 `#ef4444` + 「-」前置、收入 `#10b981` + 「+」前置、轉帳 `#3b82f6` + 「⇄」icon；於列表標題列以同色標例顯示三色 legend；於 `style.css` 新增 `.tx-type-expense`、`.tx-type-income`、`.tx-type-transfer` class
- [ ] T046 [US1] 於 `app.js` 列表呈現「未來」分區（FR-013）：載入後將 `date > taipeiTime.todayInTaipei()` 的列另放於頂部 `<section aria-label="未來交易">`，灰底 + 「未來」徽章；今天／過往交易置於下方 `<section aria-label="歷史交易">`；分區之間以 `<hr>` 與標題分隔
- [ ] T047 [US1] 於 `app.js` 儀表板總資產卡（FR-004、FR-007）：`GET /api/accounts` 後將 `excludeFromTotal === false` 的帳戶 `currentBalance` 依 `currency` 對 TWD 換算（US5 之前先以「同 currency 即直接累加、跨幣別暫不換算（過渡作法）」處理）後加總；卡片左側顯示 TWD 等值總額；右下角註明「已排除 N 個帳戶」（N = excludeFromTotal=true 的帳戶數）
- [ ] T048 [US1] 於 `app.js` 帳戶管理頁與儀表板均加入「金額為 0／負數」的 UI 阻擋（FR-011 / spec US1 Acceptance #4）：交易 Modal 金額 input 設 `min="1"`、`step="1"`；前端 submit 前以 `if (Number(amount) <= 0) toast('金額必須大於 0')` 阻擋送出；後端 T035 的 422 訊息以同樣 wording 顯示

**Checkpoint（MVP US1 驗收）**：依 [quickstart.md](./quickstart.md) §1 執行：

- §1.1 預設「現金」帳戶可見、餘額 $0、圖示／類別／幣別正確
- §1.2 新增「台新銀行」後列表多一列，餘額 $50,000
- §1.3 新增 $120 支出後，列表最上方有該筆，現金餘額顯示 -$120
- §1.4 金額 0 / -100 前後端皆拒絕
- §1.5 未來日期交易出現在「未來」分區、不影響當前餘額／總資產
- §7.1 兩分頁編輯同筆 → 第二次送出收 409
- §7.2 b@ex.com 對 a 的交易呼叫 GET / PATCH / DELETE 全回 404

---

## Phase 4：User Story 2 — 查看交易列表與帳戶即時餘額（Priority: P1）🎯 MVP

**Goal**：使用者可以在交易頁看到日期排序的交易列表、用篩選器收斂結果、
切換每頁筆數（含自訂）、以 URL 分享當前視圖；儀表板總資產可正確區分
排除帳戶。

**Independent Test**（spec.md US2）：建立 60 筆測試資料後，(1) 每頁 20
時正確顯示分頁器、(2) 篩選「支出」+「餐飲」類時僅剩對應筆數、
(3) 帳戶切換時列表即時更新、(4) 儀表板總資產等於所有計入帳戶餘額
之加總。

**對應 FR**：FR-018、FR-050、FR-051、FR-052。

### Implementation — 後端列表

- [ ] T050 [US2] 於 `server.js` 新增 `GET /api/transactions`（FR-050、FR-051、FR-052）：套 `authMiddleware`；接受 query `dateFrom`/`dateTo`（驗 `isValidIsoDate`）、`type`（enum `income|expense|transfer|future|all`）、`categoryId`、`accountId`、`keyword`（trim、lowercase）、`sort`（regex `^(date|amount|account|category|type)_(asc|desc)$`，預設 `date_desc`）、`page`（≥1）、`pageSize`（1~500，超過 400 `PageSizeOutOfRange`）
- [ ] T051 [US2] 於 T050 路由內組裝 SQL（FR-050）：`WHERE user_id = ?` 起手，多條件 AND；`type = 'transfer'` 展開為 `type IN ('transfer_in','transfer_out')`；`type = 'future'` 加 `date > ?`（today）；`type = 'all'` 不附條件；`keyword` 走 `LOWER(note) LIKE LOWER(?)` 搭 `'%' + keyword + '%'`；`sort=account` 走 `JOIN accounts a ON a.id = transactions.account_id` 排 `a.name`；`sort=category` 走 `JOIN categories c ON c.id = transactions.category_id` 排 `c.name`；其餘三種直接欄位排序；最後 `ORDER BY <field> <dir> LIMIT ? OFFSET ?`
- [ ] T052 [US2] 於 T050 路由補 total count：`SELECT COUNT(*) FROM transactions WHERE <相同條件，不含 ORDER/LIMIT>`；回 `{ items, total, page, pageSize }`；items 內 transfer 的 `linkedId` 照原值回傳（前端用以視覺成對標示，FR-018 / spec US2 Acceptance #3）

### Implementation — 前端列表、篩選、分頁、排序

- [ ] T060 [US2] 於 `app.js` 交易頁建構頂端篩選列（FR-050）：UI 由左到右 — 日期區間 picker（兩個 date input）、類型 dropdown（含「全部 / 收入 / 支出 / 轉帳 / 未來」）、分類 dropdown（依 categories tree 渲染 optgroup）、帳戶 dropdown、搜尋 input（placeholder「搜尋備註…」）；任一欄位變更時 `debounce 250ms` 後重新呼叫 `GET /api/transactions`；URL `history.replaceState` 同步參數
- [ ] T061 [US2] 於 `app.js` 表頭加入排序切換（FR-050）：5 個可排序表頭欄位（`date`、`amount`、`account`、`category`、`type`），各欄旁顯示 `▲▼` 小箭頭；點擊切換 ASC↔DESC；切換時將 `sort=<field>_<dir>` 寫入 URL query（與 T060 共用 `history.replaceState`）；初始載入時讀 URL 反向還原狀態（FR-052）
- [ ] T062 [US2] 於 `app.js` 分頁器（FR-051）：每頁筆數 select 顯示 10 / 20 / 50 / 100 / 自訂；自訂選項展開一個 number input（min=1 max=500），失焦或按 Enter 觸發送出；輸入 > 500 顯示 inline error「每頁最多 500 筆」並阻擋送出；上一頁／下一頁 + 跳頁輸入；參數同寫 URL（`page`、`pageSize`）
- [ ] T063 [US2] 於 `app.js` 儀表板總資產卡擴充以對應 spec US2 Acceptance #5（FR-004）：「已排除」帳戶以「灰色虛線外框 + 已排除徽章」呈現於帳戶清單；總資產卡明確顯示「總資產 $X，已排除 N 個帳戶（餘額共 $Y）」；點擊「已排除 N」展開該 N 個帳戶清單

**Checkpoint（MVP US2 驗收）**：依 [quickstart.md](./quickstart.md) §2 執行：

- §2.1 60 筆測試資料 — 每頁 20、共 3 頁、預設 `date DESC`
- §2.2 自訂每頁 37 筆生效、501 阻擋
- §2.3 搜尋 `咖啡` 命中 12 筆、前後空白同樣命中
- §2.4 排序 10 種組合可切換、URL 還原
- §2.5 「已排除」帳戶不影響月支出統計

---

## Phase 5：User Story 3 — 以轉帳記錄信用卡消費與繳款（Priority: P2）

**Goal**：使用者可在轉帳 Modal 完成「銀行 → 信用卡」這類資金流動，
產生 transfer_out + transfer_in 對；其中任一被刪除時另一半同步消失；
轉帳兩列不計入支出／收入統計。

**Independent Test**（spec.md US3）：(1) 信用卡記 $3,000 支出 → 餘額
-$3,000；(2) 新增銀行 → 信用卡 $3,000 轉帳 → 信用卡餘額 $0、銀行
-$3,000、月支出統計**不增加**；(3) 刪除 transfer_in 那一半 →
transfer_out 同步消失、餘額同步回復。

**對應 FR**：FR-003（信用卡分組 + 一鍵還款）、FR-015、FR-016。

### Implementation — 後端

- [ ] T070 [US3] 於 `server.js` 新增 `POST /api/transfers`（FR-015；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `createTransfer`）：套 `authMiddleware`；body `fromAccountId`、`toAccountId`、`amount`（≥1）、`date`、`note`；同筆檢查：`SELECT id, currency FROM accounts WHERE id IN (?, ?) AND user_id = ?`；若 rows.length !== 2 即 404 NotFound；若 `from.currency !== to.currency` 即 422 `{ error: 'CrossCurrencyTransfer', message: '跨幣別請分開記一筆支出 + 一筆收入' }`；通過後包 `BEGIN`：產 `linkedId = uuid()`、`outId = uuid()`、`inId = uuid()`；`INSERT` 兩列 — out 的 account_id = from、type='transfer_out'、linked_id = inId；in 的 account_id = to、to_account_id = from、type='transfer_in'、linked_id = outId；兩列共用 amount/currency/fxRate=`'1'`/fxFee=0/twd_amount=amount（同幣別）/date/note；`COMMIT` + `saveDB()`；回 201 `{ transferOut, transferIn }`
- [ ] T071 [US3] 於 `server.js` `computeAccountBalance` 補轉帳語意（已於 T032 公式涵蓋 transfer_in/out，本任務僅做 sanity test）：寫一段啟動 self-check `SELECT account_id, type, COUNT(*) FROM transactions WHERE type IN ('transfer_in','transfer_out') GROUP BY account_id, type` 確保 in/out 數量平衡，不平衡則 `console.warn('[transfer] orphan detected at account=' + account_id)`
- [ ] T072 [US3] 於 `server.js` 月支出／分類統計／預算進度／儀表板支出收入彙總等所有統計查詢 SQL（搜尋 anchor：`/api/dashboard/monthly-expense`、`/api/dashboard/category-stats`、`/api/budgets/progress`、相關 `SUM(amount)` / `SUM(twd_amount)` aggregate handler）追加雙條件過濾 `AND type IN ('income','expense') AND exclude_from_stats = 0`（**同時涵蓋 FR-016 + FR-017**）：(a) **FR-016**：transfer_in/out 兩列均不得計入支出／收入；(b) **FR-017**：使用者於單筆交易勾選「不計入統計」（`exclude_from_stats = 1`）的交易亦不得進入任何統計報表（但仍影響帳戶餘額，由 T032 `computeAccountBalance` 處理時不過濾此旗標）；本任務需逐一審視每個統計 SQL 並補上雙條件，不可只改一處

### Implementation — 前端

- [ ] T080 [US3] 於 `app.js` 交易 Modal 補轉帳分支（FR-015）：類型選「轉帳」時欄位切換為「來源帳戶 / 目標帳戶 / 金額 / 日期 / 備註」；`from === to` 或 `from.currency !== to.currency` 時送出按鈕 `disabled` 並顯示 inline 訊息「跨幣別請分開記一筆支出 + 一筆收入」；送出呼叫 `POST /api/transfers`；成功後列表自動插入兩列並以 `linkedId` 視覺成對標示（spec US2 Acceptance #3）
- [ ] T081 [US3] 於 `app.js` 列表「刪除轉帳」二次確認（FR-015 / spec US3 Acceptance #2）：當被刪交易 `linkedId !== ''` 時，Modal 訊息為「這是一組轉帳，對應的另一半將一併刪除」；確認後 `DELETE /api/transactions/:id`（後端 T038 已實作連動刪除）
- [ ] T082 [US3] 於 `app.js` 帳戶管理頁信用卡分組與「一鍵還款」捷徑（FR-003 / spec US3 Acceptance #4）：信用卡 tab 內依各信用卡 `linkedBankId` 分組（同銀行的卡放一組）；每張信用卡列右側顯示「還款」按鈕，點擊開啟轉帳 Modal 並預填「目標 = 此信用卡 / 金額 = 該卡 currentBalance 取絕對值」（餘額 -$3,000 → 預填 $3,000）；使用者只需選來源銀行送出

**Checkpoint**：依 [quickstart.md](./quickstart.md) §3 執行：

- §3.2 信用卡記 $3,000 支出 → 餘額 -$3,000、月支出 +$3,000
- §3.3 銀行 → 信用卡 $3,000 轉帳 → 信用卡 $0、銀行 -$3,000、月支出**不變**
- §3.4 一鍵還款 Modal 預填正確
- §3.5 刪除 transfer_in → transfer_out 同步消失
- §3.6 跨幣別轉帳 UI disabled、curl 繞過回 422

---

## Phase 6：User Story 4 — 批次處理多筆交易（Priority: P2）

**Goal**：使用者可勾選多筆交易執行批次刪除／批次變更分類／批次變更
帳戶／批次變更日期；上限 500 筆；任一失敗整批 rollback；批次刪除遇
轉帳時連動另一半。

**Independent Test**（spec.md US4）：建 50 筆 → (1) 全選後出現批次操作
列、(2) 批次刪除含 10 筆轉帳 → 對應另一半也消失、(3) 勾選 20 筆批次
變更分類 → 所選 20 筆全部改、其他不受影響。

**對應 FR**：FR-040、FR-041、FR-042、FR-043、FR-044、FR-045、FR-012
（自訂下拉避開 optgroup 渲染缺陷）。

### Implementation — 後端

- [ ] T090 [US4] 於 `server.js` 新增 `POST /api/transactions:batch-update`（FR-043、FR-044、FR-045；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `batchUpdateTransactions`）：套 `authMiddleware`；body `{ ids: string[], patch: { categoryId?, accountId?, date? }, expected_updated_at?: { id: epochMs } }`；`ids.length` 0 或 > 500 即 400 `BatchTooLarge`；包 `BEGIN`：先 `SELECT id, user_id, updated_at, type FROM transactions WHERE id IN (...)`；驗證每列 user_id === req.userId（不符 throw 404）；若有 `expected_updated_at` 對應，逐筆比對 updated_at（不符 throw 409 `OptimisticLockConflict` + 首筆失敗 id）；patch 內若含 `accountId` 驗證該 account 屬同 user（不符 422 `AccountForeign`）；若含 `categoryId` 驗證 category 屬同 user（不符 422 `CategoryForeign`）；通過則 `UPDATE transactions SET <patch fields>, updated_at = ? WHERE id IN (...) AND user_id = ?`；`COMMIT` + `saveDB()`；回 200 `{ affectedIds: ids, affectedCount: ids.length }`；任一驟失敗 `ROLLBACK` 並回對應 status code
- [ ] T091 [US4] 於 `server.js` 新增 `POST /api/transactions:batch-delete`（FR-042、FR-044、FR-045；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `batchDeleteTransactions`）：套 `authMiddleware`；body `{ ids: string[], expected_updated_at?: { id: epochMs } }`；`ids.length` 0 或 > 500 即 400；包 `BEGIN`：`SELECT id, user_id, linked_id FROM transactions WHERE id IN (...)`；驗證 user_id 全屬 req.userId（不符 404）；若有 `expected_updated_at` 對應逐筆比對；計算 `allIdsToDelete = Set(ids ∪ ids.flatMap(id => row.linkedId).filter(Boolean))`；`DELETE FROM transactions WHERE id IN (...) AND user_id = ?`；`COMMIT` + `saveDB()`；回 200 `{ affectedIds: [...allIdsToDelete], affectedCount }`；任一失敗 ROLLBACK + 對應 status

### Implementation — 前端

- [ ] T100 [US4] 於 `app.js` 交易列表新增 checkbox 列（FR-040）：每列前置 `<input type="checkbox" data-id>`；表頭一個總 checkbox（依當前頁面顯示筆數判斷 全選 / 半選 / 未選；半選用 `el.indeterminate = true` + `aria-checked='mixed'`）；勾選 / 取消觸發 ARIA live 區公告「已選 N」（FR-041 / [research.md](./research.md) §7.2）
- [ ] T101 [US4] 於 `app.js` 紫色批次操作列（FR-041）：當選取數 > 0 時於頁面底部 fixed 列顯示「已選 N」+ 按鈕「批次刪除」、「批次變更分類」、「批次變更帳戶」、「批次變更日期」；500 筆上限：當 N === 500 時所有未選 checkbox `disabled`、操作列右側顯示「已達單次上限 500，請分批處理」（FR-044）
- [ ] T102 [US4] 於 `app.js` 「批次變更分類」自訂下拉（FR-012、FR-043）：以 `<button> + popover` 實作，內容為 categories tree（父分類 → 子分類），每筆前置 6px 色點（`category.color`）；選定後送 `POST /api/transactions:batch-update` body `{ ids, patch: { categoryId } }`；成功後列表 N 列分類欄即時重繪、其他列不受影響
- [ ] T103 [US4] 於 `app.js` 「批次變更帳戶」與「批次變更日期」按鈕（FR-043）：帳戶為 select，日期為 date input；送出同呼叫 `:batch-update` 路由；UI 處理同 T102
- [ ] T104 [US4] 於 `app.js` 「批次刪除」二次確認 Modal（FR-042 / spec US4 Acceptance #4）：先計算 `transferCount = 選中筆數中 linked_id !== '' 的筆數`、`extraDeleteCount = transferCount`（每組轉帳會帶走一半）；Modal 訊息「共 N 筆含 T 組轉帳對；對應另一半將一併刪除，實際將刪除 N + T 筆」；確認後 `POST /api/transactions:batch-delete`；回應 `affectedIds` 用以從前端列表移除所有受影響列
- [ ] T105 [US4] 於 `app.js` 批次操作失敗 UX（FR-045）：API 回 4xx 時 toast 顯示「本次批次操作未生效，{error.message}」；不顯示「N 筆成功 M 筆失敗」之混合結果

**Checkpoint**：依 [quickstart.md](./quickstart.md) §4 執行：

- §4.1 全選 / 半選 / 取消全選 表頭狀態正確
- §4.2 批次變更分類 20 筆 → 即時重繪、其他不受影響
- §4.3 批次刪除 3 筆（含 1 筆轉帳）→ Modal 顯示「實際 4 筆」→ 4 筆同時消失
- §4.4 501 筆 curl 繞過回 400；含過期 expected_updated_at 的混合請求回 409 + 整批不生效

---

## Phase 7：User Story 5 — 外幣交易與自動匯率（Priority: P2）

**Goal**：使用者切換交易幣別時系統自動填入即時匯率；信用卡帳戶自動
追加海外刷卡手續費；匯率與費率固化於交易、跨使用者共用快取
（5 分鐘 dedup + 30 分鐘 cache）；API 失敗走 fallback 鏈。

**Independent Test**（spec.md US5）：(1) Modal 切 JPY → 2 秒內填入匯率；
(2) 信用卡帳戶顯示 1.5% 手續費可調整；(3) 儲存後 fx_rate 持久化；
(4) 系統當前匯率變動不影響歷史交易 TWD 等值；(5) 5 分鐘內第二次查詢
< 100ms。

**對應 FR**：FR-020、FR-020a、FR-021、FR-022、FR-022a、FR-023、FR-024。

### Implementation — 後端

- [ ] T110 [US5] 於 `server.js` 新增 `GET /api/exchange-rates/:currency`（FR-020、FR-023、FR-024；[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) `getExchangeRate`）：套 `authMiddleware`；驗證 currency `^[A-Z]{3}$`；呼叫 `fxCache.getRate(currency)`；成功回 200 `{ currency, rateToTwd, fetchedAt, source, cached }`；失敗（外部 API + 無快取）回 503 `{ error: 'RateUnavailable', message: '匯率暫不可用，請手動輸入' }`
- [ ] T111 [US5] [P] 於 `server.js` 新增 `GET /api/user/settings/pinned-currencies`：套 `authMiddleware`；`SELECT pinned_currencies, updated_at FROM user_settings WHERE user_id = ?`；JSON.parse 後回 `{ pinnedCurrencies: [...], updatedAt }`
- [ ] T112 [US5] [P] 於 `server.js` 新增 `PUT /api/user/settings/pinned-currencies`：套 `authMiddleware`；body `{ pinnedCurrencies: string[] minItems 1 maxItems 50, expected_updated_at }`；驗證每筆 `^[A-Z]{3}$`、必含 `'TWD'`（避免使用者誤刪）；以 `ownsResource('user_settings', 'user_id', req.userId, req.userId)` 取得 row（無則 404 NotFound）→ 呼叫 `assertOptimisticLock('user_settings', 'user_id', req.userId, expected_updated_at)` 驗版本（T021 已支援 PK 欄位名稱參數，無需 inline 比對）；UPDATE 後 `updated_at = Date.now()`；回 200 + 新狀態（含新 `updatedAt` 給前端供下次 PATCH 樂觀鎖使用）
- [ ] T113 [US5] 於 T035（`POST /api/transactions`）與 T037（`PATCH /api/transactions/:txId`）邏輯加入信用卡海外手續費預設邏輯（FR-021）：**API contract**：body 僅接受 `fxFee`（TWD 最小單位整數），**不接受 `fxFeeRate`**（費率僅為前端 UI 計算工具，提交前必須換算為 fxFee 整數送出）。後端流程：`req.account.category === 'credit_card' && currency !== 'TWD'` 時，若 body `fxFee` 缺失或為 `null`（**注意：明確的 `0` 不算缺失，代表使用者勾選「不收手續費」**）則由後端計算預設值 `defaultFeeRate = req.account.overseas_fee_rate ?? 150`（千分點，未設 fallback 1.5%）→ `fxFee = moneyDecimal.computeTwdAmount(amount, fxRate, 0).times(defaultFeeRate).dividedBy(1000).toDecimalPlaces(0, ROUND_HALF_UP).toNumber()`；若 body 提供 `fxFee`（含 0）則**直接採用該數值，不回算費率、不再呼叫公式**——前端必須事先以共用公式計算正確 fxFee；覆寫結果**不回寫** `accounts.overseas_fee_rate`（FR-021）；API 回應將最終採用的 `fxFee` 與 `fxRate` 一併回給前端，前端可選擇從 `fxFee / computeTwdAmount(amount, fxRate, 0)` 反算費率顯示

### Implementation — 前端

- [ ] T120 [US5] 於 `app.js` 新增「設定 → 常用幣別」頁（FR-020a）：列出當前 `pinnedCurrencies`、可拖拉排序、每列一個刪除按鈕（最少保留 TWD，刪 TWD 鈕 disabled）；底部「新增常用幣別」按鈕展開 input + 「新增」鈕，輸入規則 `^[A-Z]{3}$`（前端 `toUpperCase()` + regex 驗）；送出呼叫 `PUT /api/user/settings/pinned-currencies`
- [ ] T121 [US5] 於 `app.js` 交易 Modal 幣別下拉改為動態（FR-020a）：載入時呼叫 `GET /api/user/settings/pinned-currencies` 填入 select；下拉底部固定一個 `<option>` 「＋ 新增其他幣別」，選擇時開啟 inline input 輸入任意 ISO 4217 → 送出時先 `PUT pinned-currencies`（將該代碼加入 list）→ 再選回該幣別繼續送出該筆交易
- [ ] T122 [US5] 於 `app.js` 交易 Modal 切幣別後自動匯率填入（FR-020、SC-003）：使用者切幣別至非 TWD 時呼叫 `GET /api/exchange-rates/:currency`；若 200 則填入 `fxRate` 欄位（read-only，但提供「鎖頭」icon 點擊解鎖以手動調整）；同時 TWD 等值顯示欄位呼叫 **`window.moneyDecimal.computeTwdAmount(amount, fxRate, 0)`**（同構模組，與後端 T035 / T113 共用單一公式，見 T016；T002 已於 index.html 載入 decimal.js CDN + lib/moneyDecimal.js）即時更新；若 503 顯示「匯率暫不可用，請手動輸入」、`fxRate` 欄位轉為一般輸入
- [ ] T123 [US5] 於 `app.js` 信用卡海外手續費 UI（FR-021；對齊 T113 API contract）：`accounts[selectedId].category === 'credit_card' && currency !== 'TWD'` 時，Modal 顯示「海外刷卡手續費」區塊，包含**兩個雙向綁定欄位**：(a) 費率（百分比 `number`，預設值 `account.overseasFeeRate / 100`，例：千分點 150 → 1.5%；範圍 0~10）；(b) 金額 fxFee（TWD 整數，由費率推算）。**雙向綁定公式**：`fxFee = window.moneyDecimal.computeTwdAmount(amount, fxRate, 0) × rate / 100`，整數採 `ROUND_HALF_UP`；前端**必須**直接呼叫 `window.moneyDecimal.computeTwdAmount`（同構模組，T016 / T002；嚴禁於 `app.js` 重寫一份簡化版本造成公式漂移）。費率輸入時即時重算金額；金額輸入時反算費率（顯示用）。「不收手續費」checkbox：勾選 → 費率與金額同步歸 0、兩欄位 disabled；解除 → 還原成預設費率重算。**送 API 時：表單只送 `fxFee` 數值（不送費率欄位）**，T113 後端會直接採用；若使用者完全沒動過此區塊（含 default 值），仍送出 fxFee 計算結果，**不依賴後端預設邏輯**（避免前端顯示與後端最終值差異）
- [ ] T124 [US5] 於 `app.js` 切幣別重置 UX（spec.md Edge Cases）：使用者由 TWD 切非 TWD → 顯示 fxRate / fxFee 欄位；切回 TWD → 自動將 fxRate 設 `'1'`、fxFee 設 0、隱藏兩欄；歷史交易詳情頁顯示 fxRate 為唯讀（FR-022）
- [ ] T125 [US5] 於 `app.js` 儀表板總資產卡關閉 T047 過渡實作（FR-004、FR-007、FR-020）：載入 `GET /api/accounts` 後，對於 `excludeFromTotal === false` 且 `currency !== 'TWD'` 的每個帳戶並行呼叫 `GET /api/exchange-rates/:currency`（命中 cache 即無延遲，符合 SC-003 的 < 100ms），取得 `rateToTwd` 後用 **`window.moneyDecimal.computeTwdAmount(currentBalance, rateToTwd, 0)`**（同構模組，T016 / T002；與後端公式一致）計算 TWD 等值；非 TWD 幣別匯率呼叫採 `Promise.all(currencies.map(c => fetch(...)))` 並行（避免序列化拖慢儀表板載入）；最終總資產 = Σ TWD 帳戶 currentBalance + Σ 非 TWD 帳戶 TWD 等值；卡片左側顯示 `window.moneyDecimal.formatForDisplay(total, 'TWD')`；非 TWD 帳戶於帳戶清單列上以 tooltip 顯示原幣與 TWD 等值（兩段以 `window.moneyDecimal.formatForDisplay(currentBalance, account.currency)` 與 `formatForDisplay(twdEquivalent, 'TWD')` 串接，例：`USD $50.00 → TWD $1,500`、`JPY ¥10,000 → TWD $2,103`，符號隨幣別動態）；若任一幣別匯率取得失敗（503 RateUnavailable）則該帳戶以「匯率暫不可用」灰底提示，總資產卡右下角加註「N 種幣別匯率暫不可用，未計入總額」並僅加總成功換算的部分；本任務同時修正 T047 註解中「過渡作法」字樣，改為「跨幣別 TWD 換算由 T125 接手」

**Checkpoint**：依 [quickstart.md](./quickstart.md) §5 執行：

- §5.1 切 JPY 2 秒內填入匯率
- §5.2 信用卡 + USD → 自動加 1.5% 手續費（可調整／可清零）
- §5.3 兩個使用者同時間切 JPY，第二者命中 cache、後端不重打 API；30 分鐘後重新呼叫
- §5.4 API 失敗 + 無 cache → 503 + 手動輸入仍可儲存
- §5.5 系統匯率改變後，歷史交易 TWD 等值不變
- §5.6 多幣別帳戶（TWD + USD + JPY）儀表板總資產 = TWD 餘額 + USD × USD/TWD + JPY × JPY/TWD；切換匯率後 reload，總資產重算（驗證 T125 對齊 FR-004）

---

## Phase 8：User Story 6 — 電子發票 QR 掃描自動填單（Priority: P3）

**Goal**：行動裝置使用者可於交易 Modal 觸發相機掃描財政部電子發票
QRCode，自動填入金額／日期／店家；不支援相機時 fallback 上傳圖片；
解析失敗不破壞已填欄位。

**Independent Test**（spec.md US6）：(1) 行動瀏覽器掃描 → 3 秒內欄位
填入；(2) 桌面瀏覽器顯示「上傳圖片」fallback；(3) 解析失敗時欄位
保留。

**對應 FR**：FR-030、FR-031、FR-032。

### Implementation — 純前端

- [ ] T130 [US6] 於 `index.html` `<head>` 新增 jsQR fallback CDN + SRI（[research.md](./research.md) §6.2）：`<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js" integrity="sha384-<hash>" crossorigin="anonymous" defer></script>`；hash 以 `curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A` 產生並記入註解
- [ ] T131 [US6] 於 `app.js` 交易 Modal 新增「掃描發票」按鈕（FR-030）：點擊時偵測 `'BarcodeDetector' in window` → 是則開啟相機預覽（`navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`），對 video frame 反覆 `detector.detect()`；不是則顯示 `<input type="file" accept="image/*" capture="environment">` 上傳介面；使用者拒絕鏡頭授權時亦切換 fallback
- [ ] T132 [US6] 於 `app.js` 實作財政部電子發票左碼 parser（FR-031）：解析左碼前 38 字元 — 發票字軌（2 中文 + 8 數字）、發票日期（民國年 3 數字 + 月 2 數字 + 日 2 數字 → 轉西元）、隨機碼（4 數字）、銷售額 8 位（16 進位轉 10 進位 → 元）、總計 8 位（同前）、買方統編（8 位）、賣方統編（8 位）；成功後呼叫 Modal 表單填入：金額（總計）、日期（轉 ISO `YYYY-MM-DD`）、備註（`賣方統編：{8 數字}`，使用者可手動改名）；分類與帳戶留空待使用者補選
- [ ] T133 [US6] 於 `app.js` 解析失敗訊息（FR-032）：parser 例外或不符長度 / 格式 → 顯示 toast「無法解析電子發票 QRCode」；**不**清空使用者已手動填入的欄位（驗證：先手動填金額 999 → 上傳壞圖 → 確認金額仍為 999）；若 QR 解析出金額為 0（退換貨發票），仍填入但標 inline 警告「金額為 0，可能為退貨發票，請手動調整」（spec.md Edge Cases）

**Checkpoint**：依 [quickstart.md](./quickstart.md) §6 執行 — 桌面 fallback、行動主路徑、解析失敗保留欄位三項。

---

## Phase 9：Polish & Cross-Cutting Concerns

**Purpose**：跨多個 user story 的契約／文件／驗證收尾；不接新功能。

- [ ] T140 [P] 於根目錄 `openapi.yaml` 同步本功能新增的所有端點（憲章 Principle II）：將 [contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml) 內 9 個端點群（Accounts CRUD、Transactions CRUD、Batch、Transfers、ExchangeRates、UserSettings）依其 schema/path 整段插入；schemas 整段插入 `components.schemas`；確保 `info.version` bump（依憲章規則 #3，新增端點屬 minor，例：`0.42.0` → `0.43.0`）；以 `python -c "import yaml; d=yaml.safe_load(open('openapi.yaml','r',encoding='utf-8')); assert d['openapi']=='3.2.0'"` 驗證 literal string；以 `npx @redocly/cli lint openapi.yaml` 通過
- [ ] T141 [P] 執行子契約 lint：`npx @redocly/cli lint specs/002-transactions-accounts/contracts/transactions.openapi.yaml`，無 error；若有 warning（如 missing example）以 inline 補上
- [ ] T142 [P] 更新 `changelog.json`：`currentVersion` 由 `4.22.0` bump 至 `4.23.0`（屬 minor — 新增功能）；新增一筆 `releases[0]` entry，`title` 為「002-transactions-accounts：交易與帳戶」、`changes[].text` 以 zh-TW 列出本功能 8 大類交付項（accounts CRUD、transactions CRUD、批次操作、轉帳、自動匯率、海外手續費、QR 掃描、樂觀鎖／IDOR）；`date` 為實作合併日（如 2026-04-25）
- [ ] T143 [P] 更新 `SRS.md` 版本歷史：於最新一節新增 4.23.0 條目對應交付重點（同 changelog 八項摘要）；於 §3.3「API 端點」表格新增 9 個端點群；於 §4「資料模型」補上 accounts/transactions 新欄位、user_settings 新表
- [ ] T144 於 `app.js` 與 `index.html` 對 a11y 補強（[research.md](./research.md) §7.2）：批次操作列加 `<div role="status" aria-live="polite">` 通報「已選 N」變更；半選 checkbox 設 `aria-checked="mixed"`；「未來」與「歷史交易」分區以 `<section aria-label="...">` 包覆；以 Chrome devtools Lighthouse a11y 分數 ≥ 95 為驗收基準
- [ ] T145 於 `app.js` 紫色批次操作列色彩驗證（[research.md](./research.md) §7.2）：`style.css` 主色 `#7c3aed` 配白字 `#ffffff`，以 contrast checker 確認 ≥ 4.5:1 (WCAG AA)；同時新增 `.future-badge`（灰底）、`.excluded-badge`（灰虛線外框）兩個 class
- [ ] T146 執行 [quickstart.md §9](./quickstart.md) v3.x → v4 升級驗證：本機 `cp database.db database.db.bak.before-002` → `git checkout 002-transactions-accounts` → `npm install` → `npm start` → 觀察 server log 出現 `[migration 002]` 系列訊息 → 開儀表板核對既有帳戶餘額／既有交易列表完全一致；失敗則依 [quickstart.md §9.2](./quickstart.md) 回滾並修正 T010~T015
- [ ] T147 完整跑一次 [quickstart.md](./quickstart.md) §1~§10 全 11 節驗收 checklist；任一未通過項目於本任務內回頭修正對應 Story task；通過後將 quickstart.md §11 完成度清單全勾選並於 PR 描述貼上截圖
- [ ] T148 於 PR 描述以繁體中文撰寫遷移指引（憲章 Development Workflow Gate）：(a) 提醒 reviewer 先備份 `database.db`、(b) 列出新增 dependency `decimal.js`、(c) 列出 schema 變更（CT-1 摘要）、(d) 列出新增端點清單（9 群）、(e) 提示既有外幣交易（若有）的 INTEGER 換算規則、(f) 標明 quickstart 跑過、redocly lint 通過、Lighthouse a11y 分數
- [ ] T149 [P] 於 server.js 啟動 log 統一附加版本標籤：`console.log('[startup] AssetPilot v4.23.0 / feature 002-transactions-accounts ready')`，方便 Zeabur／Docker 容器日誌追蹤上線版本
- [ ] T150 [P] 於 [quickstart.md](./quickstart.md) 末尾新增 `§10 效能與壓測量測腳本`（對應 SC-002 / SC-003 / SC-004 / SC-005）：(a) **SC-002 餘額更新 P95 < 1 s** — 提供 bash 腳本：先建一個帳戶與 1,000 筆種子交易，然後 `for i in $(seq 1 100); do curl -s -w '%{time_total}\n' -o /dev/null -X POST $URL/api/transactions ...; curl -s -w '%{time_total}\n' -o /dev/null $URL/api/accounts/$ACCT; done | sort -n | awk 'NR==int(NR*0.95)+1'`；(b) **SC-003 匯率 P95 < 2 s / cache hit < 100 ms** — bash for-loop：第 1 次呼叫 `GET /api/exchange-rates/JPY`（cold miss、量測 P95）→ 後 99 次（hot cache、量測 P95）；(c) **SC-004 100 組轉帳無 orphan** — bash for-loop：100 次 `POST /api/transfers`，結束後 `sqlite3 database.db "SELECT linked_id, COUNT(*) c FROM transactions WHERE type IN ('transfer_in','transfer_out') GROUP BY linked_id HAVING c != 2"` 期望 0 row；(d) **SC-005 批次 100 筆 P95 < 3 s** — 預先建 100 筆交易，連發 5 次 `POST /api/transactions:batch-update body { ids: [100], patch: { categoryId } }` 取 P95；於 T147 acceptance 段加入「跑過 §10 並截圖 P95 數值，確認四項皆符合 spec SC 上限」之 checklist 項目

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup（T001~T003）**：無相依，可立即開始；T001 必須先於 T016
  （decimal.js 為其依賴）。
- **Phase 2 Foundational（T010~T022）**：依賴 Phase 1 完成；**阻擋所有
  user story**。內部執行順序：
  - T010 → T011 / T012 / T013 → T014 / T015（schema 流；T011/T012/T013/T014/T015 中 T011~T015 部分 [P] 但本檔 T013 必須在 T011/T012 之後因為對 transactions/accounts 重建表）。**保守作法：T010→T011→T012→T013→T014/T015 可 [P]**。
  - T016 / T017 / T018 [P] 三個 lib 檔可並行。
  - T019 必須在 T016~T018 之後（require 三個模組）。
  - T020 / T021 / T022 在 T019 之後可 [P]。
- **Phase 3~8 User Stories**：所有 stories 依賴 Phase 2 完成；同層各
  story 可由不同開發者並行（人力允許時）；建議優先序：US1（MVP）
  → US2（MVP）→ US3 → US4 → US5 → US6。
- **Phase 9 Polish**：需所有預定 stories 完成後執行；T140~T143、T149、T150 可 [P]（互不修改同檔）。

### User Story Dependencies

- **US1（P1）**：依 Foundational 完成；無對其他 story 之依賴。
- **US2（P1）**：依 Foundational 完成；列表 SQL 與 US1 的 `POST /api/transactions` 互不阻擋（GET / POST 為不同路由）；前端列表元件可獨立於 US1 的 Modal。
- **US3（P2）**：依 US1 完成（T038 連動刪除已實作 base 邏輯）；信用卡分組需要 `accounts.category` 與 `linked_bank_id` 欄位（已於 Foundational 補齊）。
- **US4（P2）**：依 US1 + US2 完成（批次操作建立在交易列表上）；可與 US3 並行。
- **US5（P2）**：依 US1 完成（單筆交易 + Modal 已存在）；T113 補強既有 `POST /api/transactions` 行為；T125 修改 US1 的 T047 儀表板總資產卡（兩者皆動 `app.js` 同 component，需於 T125 開動前先確認 T047 已 merge）；可與 US3、US4 並行。
- **US6（P3）**：依 US1 完成；純前端任務，可與 US3、US4、US5 並行。

### Within Each User Story

- 後端任務 → 前端任務（後端契約先穩定）；
- 同 phase 內標 [P] 者可並行（不同檔案、不互相依賴）；
- 每 story 完成後執行 quickstart 對應章節 checkpoint，通過才推進下一 story。

### Parallel Opportunities

- **Setup**：T002 / T003 [P] 可並行（T001 為 npm install 序列前置）。
- **Foundational lib 群**：T016 / T017 / T018 [P] 可並行；T021 / T022 [P] 可並行。
- **Polish**：T140 / T141 / T142 / T143 / T149 / T150 [P] 可並行（各動不同檔案；T140~T143 動 openapi.yaml/changelog.json/SRS.md，T149 動 server.js startup log，T150 動 quickstart.md）。
- **Stories**：在多人協作時，US3 / US4 / US5 / US6 完全可由不同開發者
  並行（互不修改同一檔案區段；US4 / US5 共動 `app.js` 不同 component
  區，需 git merge 處理 conflict）。

---

## Parallel Example：Phase 2 Foundational

```bash
# Foundational lib 群（T016/T017/T018 可並行；不同檔）：
Task: "完成 lib/moneyDecimal.js（T016）"
Task: "完成 lib/taipeiTime.js（T017）"
Task: "完成 lib/exchangeRateCache.js（T018）"

# Foundational middleware／helper（T021/T022 可並行；不同檔/不同函式）：
Task: "於 server.js 新增 assertOptimisticLock helper（T021）"
Task: "於 server.js 既有 createDefaultsForUser 末尾新增三段 INSERT（T022）"
```

## Parallel Example：US1 內部

```bash
# 後端 Accounts CRUD 完成後，US1 前端任務可並行（不同 app.js 區段，merge 風險極低）：
Task: "T040 帳戶管理頁 tabs 列表"
Task: "T044 交易 Modal（type 限 income/expense）"
Task: "T047 儀表板總資產卡"
```

---

## Implementation Strategy

### MVP First（US1 + US2 = P1×2）

1. 完成 **Phase 1 Setup**（T001~T003）。
2. 完成 **Phase 2 Foundational**（T010~T022；schema migration 為關鍵
   步驟，必須先在本機備份、self-test 通過再進下一階段）。
3. 完成 **Phase 3 US1**（T030~T048）。
4. 完成 **Phase 4 US2**（T050~T063）。
5. **STOP and VALIDATE**：以 [quickstart.md §1~§2](./quickstart.md)
   獨立驗收 US1+US2；功能可上線即視為 MVP。
6. 上 staging／demo。

### Incremental Delivery

1. Setup + Foundational → MVP base ready（不可獨立上線，但是後續所有
   功能的前置）。
2. + US1 → 帳戶 + 單筆交易（demo 可用）。
3. + US2 → 列表 / 篩選 / 分頁 / 排序（demo 可用）。
4. + US3 → 轉帳（demo 可用 — 信用卡情境完整）。
5. + US4 → 批次操作（demo 可用 — 重度使用者）。
6. + US5 → 外幣 + 自動匯率（demo 可用 — 跨國情境）。
7. + US6 → 電子發票掃描（demo 可用 — 行動端最低摩擦）。
8. Polish → 文件 / 契約 / a11y。

### Parallel Team Strategy

3 人團隊建議分工：

1. 共同完成 **Phase 1 + Phase 2**（嚴禁分工，schema migration 為
   bottleneck）。
2. 進入 stories 後：
   - Dev A：US1 → US3（Account / Transaction / Transfer 後端 + 前端）
   - Dev B：US2 → US4（List / Pagination / 批次操作）
   - Dev C：US5 → US6（外幣匯率 + QR 掃描）
3. 每完成一個 story 即 push 至 feature branch，由 reviewer 跑對應
   quickstart 章節驗收。
4. 全部 stories 完成後共同進入 Phase 9 Polish。

---

## Notes

- `[P]` tasks = 不同檔案、不互相依賴
- `[Story]` 標籤對應 spec.md user story 用於 traceability
- 每 user story 應可獨立完成、獨立驗證
- 每 task 完成或邏輯區塊完成即 commit（依 001 的細粒度策略）
- 在任一 checkpoint 停下驗證 story 獨立性，避免後續 story 依賴隱式
- 避免：模糊任務、同檔衝突、跨 story 隱式依賴
- **CT-1 風險**：T010~T015 為 schema migration，誤改可能損毀歷史
  資料；實作時務必先 `cp database.db database.db.bak.<ts>` 並 self-test
  通過再進入下一 task。
