---
description: "股票投資（006-stock-investments）任務分解"
---

# Tasks: 股票投資（Stock Investments）

**Input**: 設計文件位於 `/specs/006-stock-investments/`
**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/stock-investments.openapi.yaml](./contracts/stock-investments.openapi.yaml)、[quickstart.md](./quickstart.md)

**Scope**: 6 個 user story（P1×3 + P2×2 + P3×1）／**37 base FR + 2 sub-FR（`a` 後綴：FR-024a / FR-035a）= 39 FR**／**4 輪 19 條 Clarification**／7 SC（其中 SC-007 屬 post-launch retention，不在 build-time 驗證範疇）。spec.md「Out of Scope」段落另列 7 項排除事項，不納入本任務清單。

**Tests**: 既有專案無自動化測試框架（與 001 / 002 / 003 / 004 / 005 一致）；本功能不引入新測試 dependency。所有驗證走 [quickstart.md](./quickstart.md) 的可重現手動流程。**故任務清單不含 Tests 區塊。**

**Organization**: 任務以 user story 為主軸分組；Setup（Phase 1）與 Foundational（Phase 2）為跨 story 共用基礎設施；Phase 3–5 為三條 P1 user story（皆可獨立交付）；Phase 6–7 為 P2 user story；Phase 8 為 P3；Phase 9 為跨 story 文件／契約／驗證 Polish。

**Critical 限制（使用者明確要求）**: 本功能**不引入任何新 npm 套件**、**不引入新前端 CDN 資源**、**不引入新外部 API**、**不新增獨立服務**；所有任務皆於既有 stack（Node.js 24 + Express 5 + sql.js + Chart.js 4.5.1 + decimal.js）上實作。違反此原則的任務必須先回退並改寫。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可並行（不同檔案、不依賴未完成任務）
- **[Story]**: 對應 user story（US1, US2, US3, US4, US5, US6）
- 每筆任務含具體檔案路徑

---

## Phase 1: Setup（共享基礎設施）

**Purpose**: 確認分支與既有 stack 就緒；本功能完全沿用 001 / 002 / 003 / 004 / 005 既有依賴，故無需 `npm install` 或 CDN 變動。

- [ ] T001 確認當前 branch 為 `006-stock-investments`、且 working tree 乾淨；若不是則 `git checkout 006-stock-investments && git status` 驗證。
- [ ] T002 確認 `package.json` / `package-lock.json` 與 005 完全一致（不新增任何 dependency）；以 `git diff main -- package.json package-lock.json` 應為 0 行差異作為驗收。
- [ ] T003 [P] 對 `database.db` 手動備份為 `database.db.bak.before-006`（即使 migration 自動備份，本機開發再手動拷一份）。
- [ ] T004 [P] 在 [.env.example](../../.env.example) 新增 `TWSE_MAX_CONCURRENCY=5` 範例條目（含繁體中文註解「TWSE 並發查詢上限，預設 5；管理員可調節以避免被 rate limit」）。對應 FR-034、Pass 4 Q3。

**Checkpoint**: 環境就緒，無依賴變動，可進入 Foundational。

---

## Phase 2: Foundational（阻塞先決條件）

**Purpose**: 跨 user story 共用的 schema 變更、後端共用 helper、前端共用 helper、CSS 基礎類別；US1 ~ US6 任一 story 啟動前皆需本階段完成。

**⚠️ CRITICAL**: 本階段未完成前，不可開始任何 user story 任務。

### Schema 變更（initDatabase 區塊，[server.js:880-950](../../server.js#L880)）

- [ ] T010 在 [server.js](../../server.js) `initDatabase()` 內既有 `ALTER TABLE stocks ADD COLUMN stock_type` 附近（約行 893）新增 `try { db.run("ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0"); } catch (e) {}`（冪等模式）。對應 [data-model.md §2.1](./data-model.md)、Pass 1 Q2。
- [ ] T011 在 [server.js](../../server.js) `initDatabase()` 內新增兩個 ALTER：`try { db.run("ALTER TABLE stock_transactions ADD COLUMN recurring_plan_id TEXT"); } catch (e) {}` 與 `try { db.run("ALTER TABLE stock_transactions ADD COLUMN period_start_date TEXT"); } catch (e) {}`（冪等模式）。對應 [data-model.md §2.2](./data-model.md)、Pass 3 Q5。
- [ ] T012 在 [server.js](../../server.js) `initDatabase()` 內 T011 後續新增 partial unique index：`db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_tx_recurring_idem ON stock_transactions (user_id, recurring_plan_id, period_start_date) WHERE recurring_plan_id IS NOT NULL AND period_start_date IS NOT NULL")`。對應 [data-model.md §2.3](./data-model.md)、Pass 3 Q5。
- [ ] T013 在 [server.js](../../server.js) `initDatabase()` 結束前新增 schema 驗證 query：(a) `SELECT COUNT(*) FROM stocks WHERE delisted IS NULL` 應為 0；(b) `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_stock_tx_recurring_idem'` 應返回 1 row；任一驗證失敗時 `console.warn` 但不中斷啟動（與 005 既有 migration 驗證 pattern 一致）。對應 [data-model.md §4](./data-model.md)。

### 後端共用 helper

- [ ] T014 [P] 新增 [lib/twseFetch.js](../../lib/twseFetch.js)（純 JS、無新 npm）：匯出 `fetchWithRetry(url, options, retries=2)`（指數退避 1s/2s）、`chunk(arr, size)`、`fetchAllWithLimit(items, fetcher)`（依 env var `TWSE_MAX_CONCURRENCY` 預設 5 分批）、`inferStockType(symbol)`（00xx 4–5 碼 → 'etf' / 6 碼以上或結尾字母 → 'warrant' / 其餘 → 'stock'）四個函式。對應 [research.md §6 + §9](./research.md)、Pass 3 Q1、Pass 4 Q3。
- [ ] T015 [P] 在 [server.js](../../server.js) 既有股票 helper 區塊（約 [server.js:7700-7800](../../server.js#L7700)）新增 `getSharesAtDate(userId, stockId, date)` 函式：`SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date <= ?`，回傳整數。對應 FR-013、Pass 3 Q2、[research.md §4](./research.md)。
- [ ] T016 [P] 在 [server.js](../../server.js) `getSharesAtDate` 附近新增 `validateChainConstraint(userId, stockId, txDate, txType, txShares, excludeTxId=null)` 函式：模擬「插入 / 修改」一筆交易後，掃 `≥ txDate` 的所有交易（排除 excludeTxId）並滾動計算每筆之後的累計持有；任一時點 < 0 則回傳 `{ ok: false, conflictDate, expectedShares }`，否則 `{ ok: true }`。對應 FR-013、Pass 3 Q2 + Pass 4 Q2。
- [ ] T017 在 [server.js](../../server.js) audit 既有 `calcStockFee(amount, shares, settings)` 與 `calcStockTax(amount, stockType, settings)` 兩個 helper 是否符合 `max(⌊amount × rate⌋, minValue)` 規則（**先 floor 再 max**）；若實作為 `Math.max(Math.round(...), min)` 或反向順序則修正為 `Math.max(Math.floor(amount * rate), min)`。修正後新增單元測試文檔註釋（不引入測試框架，純註釋）：`// FR-011 Pass 2 Q5: max(floor(金額 × 0.1425%), 整股 20 / 零股 1)`。對應 FR-011、FR-012、Pass 2 Q5。
- [ ] T018 在 [server.js](../../server.js) audit 既有 TWSE 查價 helper（如 `fetchTwseStockPrice`、`updateUserStockPrices` 等），確認所有 fetch 呼叫皆改為 `fetchWithRetry()`（T014）；若無歷史股價查詢 helper 則新增 `fetchTwseStockDay(symbol, date)`（呼叫 `https://www.twse.com.tw/exchangeReport/STOCK_DAY?date=YYYYMMDD&stockNo=X`，解析 response 取該日收盤價）。對應 [research.md §5 + §6](./research.md)、Pass 3 Q3、Pass 4 Q3。

### 前端共用 helper

- [ ] T019 [P] 在 [app.js](../../app.js) 既有 chart helper 區塊附近新增 `colorizePL(value)` helper：回傳 `{ className, symbol }` 三段式 — `value > 0` → `{ className: 'pl-positive', symbol: '▲' }`、`value < 0` → `{ className: 'pl-negative', symbol: '▼' }`、`value === 0 || value === null` → `{ className: 'pl-zero', symbol: '' }`。對應 FR-003、FR-004、FR-029、Pass 4 Q4。
- [ ] T020 [P] 在 [app.js](../../app.js) 既有 helper 區塊附近新增 `formatStaleQuoteBadge(updatedAt)` helper：input ISO timestamp，回傳 `{ text, className }` — 距今 ≤ 24 小時 → `{ text: '<HH:MM>', className: '' }`，> 24 小時 → `{ text: '<N 天前>', className: 'stale-quote' }`（CSS 類別觸發橘色 ⚠ 警示）。對應 FR-004、Pass 1 Q5。
- [ ] T021 [P] 在 [app.js](../../app.js) 既有 helper 區塊附近新增 `validateStockSymbol(symbol)` helper：純前端 regex 驗證 `/^[0-9A-Za-z]{1,8}$/`，回傳 boolean。對應 FR-008、Pass 3 Q4。
- [ ] T022 [P] 在 [app.js](../../app.js) 新增 `inferStockTypeFrontend(symbol)` helper（與 T014 同邏輯，前端版本）：純 JS regex，回傳 `'stock' | 'etf' | 'warrant'`。對應 Pass 3 Q1。

### CSS 基礎類別（[style.css](../../style.css)）

- [ ] T023 [P] 在 [style.css](../../style.css) 新增基礎類別：
  - `.pl-positive { color: var(--color-positive); }` / `.pl-negative { color: var(--color-negative); }` / `.pl-zero { color: var(--color-neutral-text); }`（三段式顯色，**Pass 4 Q4**）
  - `.stale-quote { color: var(--color-warning); }`（24 小時陳舊資料 ⚠ 警示）
  - `.delisted-badge { background: var(--color-negative-bg); color: var(--color-negative); padding: 2px 6px; border-radius: 4px; font-size: 12px; }`（已下市標示）
  - `.modal-blocking { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; pointer-events: auto; }`（同步除權息阻擋式 Modal）
  - `.progress-bar { height: 8px; background: var(--color-bg-subtle); border-radius: 4px; overflow: hidden; }` + `.progress-bar__fill { height: 100%; background: var(--color-accent); transition: width 200ms; }`

**Checkpoint**: schema 變更落定（3 ALTER + 1 partial unique index）；後端 4 個 helper（fetchWithRetry / chunk / fetchAllWithLimit / inferStockType / getSharesAtDate / validateChainConstraint / fetchTwseStockDay）+ 前端 4 個 helper（colorizePL / formatStaleQuoteBadge / validateStockSymbol / inferStockTypeFrontend）就緒；CSS 5 個基礎類別就緒；可同時啟動 US1 ~ US6。

---

## Phase 3: User Story 1 — 開啟股票頁立即掌握目前持倉與報酬率（Priority: P1）🎯 MVP 之一

**Goal**: 使用者開啟股票頁可立即看見投資組合總覽卡（總市值 / 總成本 / 總損益 / 整體報酬率）與每檔持股的個股卡片（8 欄位 + 三段式顯色 + 24 小時 stale 標示 + 已下市 badge）。

**Independent Test**: [quickstart.md US1](./quickstart.md) — 投資組合總覽 4 數字、個股卡片 8 欄位、三段式顯色、24 小時 stale ⚠、已下市 badge。

### 後端 — `/api/stocks` GET 重構（[server.js:7960-8024](../../server.js#L7960)）

- [ ] T030 [US1] 在 [server.js](../../server.js) `/api/stocks` GET handler 改寫 FIFO 計算段（[server.js:7966-7991](../../server.js#L7966)）：將 `lots[i].price` / `lots[i].fee` / `remaining` / `sellRevenue` / `sellCost` / `realizedPL` 全部改為 `Decimal` 物件（沿用既有 `decimal.js` 依賴與 [lib/moneyDecimal.js](../../lib/moneyDecimal.js) pattern）；手續費分攤改為 `feeUsed = lot.fee.times(used).div(lot.shares)` 保留全精度；累計階段全程 Decimal 操作；**僅最後 response 階段** 透過 `.toNumber()` + `Math.round()` 轉為整數。對應 FR-030、SC-004、Pass 4 Q1、[research.md §2](./research.md)。
- [ ] T031 [US1] 在 [server.js](../../server.js) `/api/stocks` GET handler T030 後續：response 從 `res.json(result)` 改為 `res.json({ stocks: result, portfolioSummary: {...} })`；`portfolioSummary` 計算如下：
  ```js
  const totalMarketValue = result.reduce((s, x) => s + (x.marketValue || 0), 0);
  const totalCost = result.reduce((s, x) => s + (x.totalCost || 0), 0);
  const totalPL = totalMarketValue - totalCost;
  const totalReturnRate = totalCost > 0 ? Math.round(totalPL / totalCost * 10000) / 100 : null;
  ```
  注意：`delisted = 1` 的股票**仍**納入 portfolioSummary（凍結價格仍是該檔目前的市值代表）。對應 FR-003、Pass 2 Q4、[research.md §8](./research.md)。
- [ ] T032 [US1] 在 [server.js](../../server.js) `/api/stocks` GET handler T031 後續：每檔 stock response 補欄位：`delisted: !!s.delisted`、`lastQuotedAt: s.updated_at`（沿用既有 `updated_at`，不新增 schema 欄位）、`priceSource`（從既有 fetchTwseStockPrice 邏輯 propagate；若 baseline 未保留 source 資訊則先回傳 'realtime' / 'close' / 't+1' 之一基於當前時間判斷）。對應 FR-004、FR-005、Pass 1 Q5。

### 前端 — 股票頁渲染（[app.js](../../app.js) 既有股票頁區塊）

- [ ] T033 [US1] 在 [app.js](../../app.js) 既有 `renderStocksPage()` 或同等股票頁渲染函式改寫：response 解構從 `const stocks = await API.get('/api/stocks')` 改為 `const { stocks, portfolioSummary } = await API.get('/api/stocks')`；新增「投資組合總覽卡」DOM 渲染：4 個彙整數字（總市值 / 總成本 / 總損益 / 整體報酬率），損益與報酬率套用 `colorizePL()`（T019）；`portfolioSummary.totalReturnRate === null` 時顯示「—」。對應 FR-003、Pass 2 Q4、Pass 4 Q4。
- [ ] T034 [US1] 在 [app.js](../../app.js) `renderStocksPage()` T033 後續：個股卡片 DOM 渲染補欄位 — 「最後查價時間」標示套 `formatStaleQuoteBadge(s.lastQuotedAt)`（T020），>24 小時加 ⚠ 橘色；資料來源（即時／收盤／T+1）顯示於價格旁；`s.delisted === true` 時加 `<span class="delisted-badge">（已下市）</span>`（T023 CSS）；損益與報酬率套 `colorizePL()`（三段式顯色）。對應 FR-004、Pass 1 Q5、Pass 1 Q2、Pass 4 Q4。
- [ ] T035 [US1] 在 [app.js](../../app.js) `renderStocksPage()` T034 後續：篩選 `stocks.filter(s => s.totalShares > 0)` 為個股卡片渲染清單（持股 = 0 的不出現於卡片列表，但保留於後端的「實現損益」「交易紀錄」資料源）；下市但仍持有 > 0 股仍顯示。對應 FR-004。

### 樣式（[style.css](../../style.css)）

- [ ] T036 [P] [US1] 在 [style.css](../../style.css) 新增「投資組合總覽卡」與「個股卡片」樣式：`.portfolio-summary` 容器（grid 4 欄）+ 數字字體（同既有 KPI 卡尺寸）；`.stock-card` 樣式（含 `.stock-card__symbol` / `.stock-card__name` / `.stock-card__quote-time` 子元素）；沿用既有設計 token（`--color-accent` / `--color-card-bg` 等），**不**引入新色票。

**Checkpoint**: 使用者開啟股票頁 → 投資組合總覽卡顯示 4 個彙整數字（金額加權報酬率）+ 個股卡片顯示 8 欄位 + 24 小時 stale ⚠ + 已下市 badge + 三段式顯色全套用；US1 已可獨立交付。

---

## Phase 4: User Story 2 — 紀錄一筆股票買賣並即時看到費用試算（Priority: P1）🎯 MVP 之一

**Goal**: 使用者於交易 Modal 輸入代號 → 自動 TWSE 查價 + 自動判定 stockType；輸入股數 / 單價 → 費用摘要（成交金額 / 手續費 / 證交稅 / 總成本／淨收入）即時試算；買入 / 賣出按鈕配色即時切換；賣出時鏈式約束驗證。

**Independent Test**: [quickstart.md US2](./quickstart.md) — 即時費用試算 < 200ms、買賣顏色切換、stockType 自動判定 + 覆寫、賣出鏈式約束 reject、ETF 證交稅 0.1%、零股最低手續費 1 元。

### 後端 — `/api/stock-transactions` POST / PUT 補強（[server.js:8240-8295](../../server.js#L8240)）

- [ ] T040 [US2] 在 [server.js](../../server.js) `/api/stock-transactions` POST handler 新增賣出鏈式約束驗證：當 `req.body.type === 'sell'` 時，先呼叫 `getSharesAtDate(userId, stockId, txDate)`（T015），若 < `req.body.shares` 則 `return res.status(400).json({ error: '賣出股數不可超過 ' + txDate + ' 當下持有 (' + currentShares + ' 股)' })`；通過後呼叫 `validateChainConstraint(userId, stockId, txDate, 'sell', txShares)`（T016），若 `!ok` 則 `return res.status(400).json({ error: '此交易會造成 ' + conflictDate + ' 持有量為負 (預期 ' + expectedShares + ' 股)' })`。對應 FR-013、Pass 3 Q2。
- [ ] T041 [US2] 在 [server.js](../../server.js) `/api/stock-transactions` PUT handler（[server.js:8284-8290](../../server.js#L8284)）改寫為「atomic delete + insert」模擬：包 SQL transaction（`db.run('BEGIN')`）→ 讀舊紀錄 → 呼叫 `validateChainConstraint(userId, stockId, newDate, newType, newShares, excludeTxId=req.params.id)`（T016 接受 excludeTxId）→ 若 reject 則 `db.run('ROLLBACK')` + 回 400；通過則 UPDATE + `db.run('COMMIT')`。對應 FR-037、Pass 4 Q2、[research.md §10](./research.md)。
- [ ] T042 [US2] 在 [server.js](../../server.js) `/api/stocks` POST handler（[server.js:8026-8038](../../server.js#L8026)）補：若 `req.body.stockType` 未指定（`undefined` 或非 ['stock', 'etf', 'warrant']），呼叫 `inferStockType(symbol)`（[lib/twseFetch.js](../../lib/twseFetch.js) T014）作為預設值；response 補回傳 `{ id, stockType }` 兩欄。對應 FR-001、Pass 3 Q1。
- [ ] T043 [US2] 在 [server.js](../../server.js) FR-014 自動新增股票路徑（[server.js:8168 + 8210](../../server.js#L8168)）— 即 stock-transactions / stock-dividends POST 時若 stockId 不存在時自動 INSERT stocks — 補：INSERT 時 `inferStockType(symbol)` 作為 stock_type 欄位值（替換目前硬編 'stock'）。對應 FR-014、Pass 3 Q1。
- [ ] T044 [US2] 在 [server.js](../../server.js) 既有 `/api/stocks/quote` 或同等 TWSE 查價代理端點補：呼叫前以 `^[0-9A-Za-z]{1,8}$` 正則驗證 `req.query.symbol`（後端二次驗證，FR-008 要求前後端皆驗）；不通過回 `400 { error: '股票代號格式不正確' }`。若該端點不存在則新增 `app.get('/api/stocks/quote', ...)` 包裝既有 `fetchTwseStockPrice`（透過 T018 保證走 `fetchWithRetry`）。對應 FR-008、Pass 3 Q4。

### 前端 — 股票交易 Modal（[app.js](../../app.js) 既有 Modal 區塊）

- [ ] T050 [US2] 在 [app.js](../../app.js) 股票交易 Modal 渲染函式新增 stockType 下拉：HTML `<select id="txStockType"><option value="stock">一般股票（賣出證交稅 0.3%）</option><option value="etf">ETF（賣出證交稅 0.1%）</option><option value="warrant">權證（賣出證交稅 0.1%）</option></select>`；輸入代號 + debounce 500ms 後呼叫 `inferStockTypeFrontend(symbol)`（T022）並 `select.value = inferred`；使用者可手動覆寫送出。對應 Pass 3 Q1。
- [ ] T051 [US2] 在 [app.js](../../app.js) 股票交易 Modal symbol 輸入框補強：`oninput` 加 `validateStockSymbol(value)`（T021）— 不通過則阻擋 debounce 觸發 + 顯示紅色提示「代號格式不正確（限 1–8 字 ASCII 數字 / 字母）」；通過則 debounce 500ms 後 fetch `/api/stocks/quote?symbol=`。對應 FR-008、Pass 3 Q4、FR-007。
- [ ] T052 [US2] 在 [app.js](../../app.js) 股票交易 Modal 費用摘要區塊：將既有費用試算（若有）改為依「股數變更」「單價變更」「買賣切換」「stockType 切換」四個事件 listener 觸發；計算 `成交金額 = shares × price`、`手續費 = max(Math.floor(amount × 0.1425%), shares >= 1000 ? 20 : 1)`、`證交稅 = type === 'sell' ? max(Math.floor(amount × taxRate), 1) : 0`（taxRate 依 stockType：stock 0.3% / etf 0.1% / warrant 0.1%）、`總成本（買）= amount + fee`、`淨收入（賣）= amount − fee − tax`。確保 < 200ms 即時更新（**SC-002**）。對應 FR-009、FR-011、FR-012、Pass 2 Q5。
- [ ] T053 [US2] 在 [app.js](../../app.js) 股票交易 Modal 買賣切換按鈕：`onclick` 切換時即時變化按鈕配色（買入綠 / 賣出紅，CSS class toggle `.btn-buy` / `.btn-sell`）+ 同時觸發 T052 費用摘要重算（賣出多顯示證交稅、總額顯示「淨收入」label）。對應 FR-009、Acceptance Scenario US2.6。
- [ ] T054 [US2] 在 [app.js](../../app.js) 股票交易 Modal 送出 handler：捕捉後端 400 錯誤訊息（鏈式約束、整數檢查、必填等）並顯示於 Modal 底部紅色提示區；不關閉 Modal、保留輸入值供使用者修正。對應 FR-013、Pass 3 Q2。

### 樣式（[style.css](../../style.css)）

- [ ] T055 [P] [US2] 在 [style.css](../../style.css) 新增交易 Modal 樣式：`.btn-buy`（綠色背景）/ `.btn-sell`（紅色背景）+ 切換時 200ms 過渡；`.fee-summary`（費用摘要區塊 grid 排版）；`.fee-summary__error`（紅色錯誤訊息區塊）。

**Checkpoint**: 使用者新增交易 → 代號自動查價 + 自動判定 stockType + 即時費用試算 + 買賣切換顏色 + 賣出鏈式約束 reject 全套用；US2 已可獨立交付。

---

## Phase 5: User Story 3 — 記錄股利並支援自動同步除權息（Priority: P1）🎯 MVP 之一

**Goal**: 使用者新增股利時，純股票股利不寫帳戶；含股票股利時系統寫入合成 $0 交易維持 FIFO 佇列；點「同步除權息」按鈕觸發阻擋式 Modal + 進度條 + 取消按鈕；刪除股利時連動刪除合成交易與退回帳戶餘額。

**Independent Test**: [quickstart.md US3](./quickstart.md) — 純股票股利寫入 + 帳戶餘額不變、同步除權息阻擋 Modal、刪股利連動刪合成交易。

### 後端 — `/api/stock-dividends` POST / DELETE 補強（[server.js:8328-8385](../../server.js#L8328)）

- [ ] T060 [US3] 在 [server.js](../../server.js) `/api/stock-dividends` POST handler 改寫：(a) accountId 改為條件 required — 僅當 `cashDividend > 0` 時必填；純股票股利時 accountId 可為 null / undefined，寫入 stock_dividends.account_id 為 NULL；(b) 若 `stockDividendShares > 0`，同 transaction 內額外 `INSERT INTO stock_transactions (id, user_id, stock_id, date, type, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, ?, 'buy', ?, 0, 0, 0, NULL, ?, ?)`，note 採 `'股票股利配發 | ' + (req.body.note || '')` 作為辨識簽名。對應 FR-015、FR-016、Pass 1 Q1、Pass 2 Q2、Pass 2 Q3、[research.md §3](./research.md)。
- [ ] T061 [US3] 在 [server.js](../../server.js) `/api/stock-dividends/:id` DELETE handler 改寫為連動處理：(a) 先 `SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?` 讀舊 row（含 stock_id / date / cash_dividend / stock_dividend_shares / account_id / note）；(b) 若 `stock_dividend_shares > 0`，`DELETE FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND price = 0 AND type = 'buy' AND note LIKE '%股票股利配發%' AND ABS(shares - ?) < 0.001`；(c) 若 `cash_dividend > 0` 且 `account_id IS NOT NULL`，找出 baseline 寫入的對應 transactions row（依 account_id + date + amount + note 含「股利」關鍵字）並刪除；(d) 最後 `DELETE FROM stock_dividends WHERE id = ?` + `saveDB()`；response 補 `linkedTransactionDeleted: boolean` 表示是否連動刪除合成交易。對應 FR-018、Pass 2 Q3、[research.md §3](./research.md)。

### 後端 — 同步除權息按年份拆段端點

- [ ] T062 [US3] 在 [server.js](../../server.js) 既有同步除權息邏輯（[server.js:7720-7780](../../server.js#L7720)）抽出為共用 helper `syncDividendsForYear(userId, year)`：returns `{ year, added, skipped, failed, details: [...] }`；內部沿用 baseline TWT49U + TWT49UDetail 邏輯；`fetch` 改用 `fetchWithRetry`（T014）。對應 FR-025、FR-026、FR-027、[research.md §7](./research.md)。
- [ ] T063 [US3] 在 [server.js](../../server.js) 新增 `app.post('/api/stock-dividends/sync', (req, res) => { ... })` 端點：query `?year=YYYY`（驗證 2010 ≤ year ≤ 2099）→ 呼叫 `syncDividendsForYear(req.userId, year)` → response 包 `{ year, added, skipped, failed, details }`。同步寫入 stock_dividends 時亦遵 T060 規則寫合成交易（若有股票股利）。對應 [contracts/stock-investments.openapi.yaml `/api/stock-dividends/sync`](./contracts/stock-investments.openapi.yaml)、Pass 2 Q1。
- [ ] T064 [US3] 在 [server.js](../../server.js) 既有單一同步端點（如 `POST /api/stock-dividends/sync-all`，若有）保留為手動觸發 alias：內部呼叫多年份的 `syncDividendsForYear` 並合併彙總；亦可保留為向後兼容入口。

### 前端 — 股利 Modal（[app.js](../../app.js)）

- [ ] T070 [US3] 在 [app.js](../../app.js) 股利 Modal 渲染：accountId 下拉的 `required` 屬性改為 conditional — 監聽 `cashDividend` 輸入：值 > 0 時加 `required`、= 0 時移除；送出前驗證 `if (cashDividend > 0 && !accountId) return showError('入款帳戶為必填');`。對應 FR-015、Pass 2 Q2。
- [ ] T071 [US3] 在 [app.js](../../app.js) 股利 Modal symbol 輸入：套用 T021 + T022 同 US2 邏輯（debounce + 自動查名稱 + 不自動填股利金額；FR-007 + Pass 3 Q1 + Pass 3 Q4）。

### 前端 — 同步除權息阻擋式 Modal

- [ ] T072 [US3] 在 [app.js](../../app.js) 新增 `runSyncDividendsModal()` 函式：(a) 計算年份範圍 — 查使用者最早交易日（從現有 stock_transactions data 或新增 `/api/stocks/earliest-date` 端點），若無則用今年；(b) 渲染阻擋式 Modal HTML：`<div class="modal-blocking"><div class="modal-blocking__content"><h3>同步除權息</h3><div class="progress-bar"><div class="progress-bar__fill" style="width: 0%"></div></div><div id="syncStage">準備中...</div><button id="syncCancel">取消</button></div></div>`；(c) `let aborted = false; document.getElementById('syncCancel').onclick = () => { aborted = true; };`；(d) `for (const year of years) { if (aborted) break; updateStage('正在同步 ' + year + ' 年...'); const result = await fetch('/api/stock-dividends/sync?year=' + year).then(r => r.json()); accumulate(result); updateProgress((++done / years.length) × 100); }`；(e) 完成或 abort 後關閉 Modal + toast 顯示彙總（新增 N / 跳過 M / 失敗 K）。對應 FR-027、Pass 2 Q1、[research.md §7](./research.md)。
- [ ] T073 [US3] 在 [app.js](../../app.js) 股利紀錄頁的「同步除權息」按鈕 onclick 改為呼叫 `runSyncDividendsModal()`（T072）；取代既有單次 fetch 行為。

### 樣式

- [ ] T074 [P] [US3] 在 [style.css](../../style.css) 補同步 Modal 子元素樣式：`.modal-blocking__content`（白底卡片、padding 24px、圓角）、`.modal-blocking__content h3`（標題字號）、`.modal-blocking__content #syncStage`（當前階段文字）、`.modal-blocking__content #syncCancel`（取消按鈕邊框樣式）。

**Checkpoint**: 使用者新增股利 / 同步除權息 / 刪除股利 全套用 spec 行為（純股票股利不寫帳戶 / 阻擋式 Modal + 取消 / 連動刪除）；US3 已可獨立交付。

---

## Phase 6: User Story 4 — 設定定期定額並由系統自動於登入時產生交易（Priority: P2）

**Goal**: 使用者建立定期定額排程後，系統於每次登入時自動 server-side 觸發 `processStockRecurring(userId)`；補產生迴圈每期使用該期應觸發日的歷史股價；多裝置同時登入透過 partial unique index + INSERT OR IGNORE 達成 idempotency。

**Independent Test**: [quickstart.md US4](./quickstart.md) — 排程建立、長期未登入補產生、多裝置 race 不重複扣款、預算不足跳過、週末順延。

### 後端 — `processStockRecurring` 共用 helper

- [ ] T080 [US4] 在 [server.js](../../server.js) 既有 `/api/stock-recurring/process` POST handler（[server.js:7894-7950](../../server.js#L7894)）抽出 helper：將內部主邏輯抽為 `async function processStockRecurring(userId) { ... return { generated, skipped, postponed }; }`，POST handler 改為僅呼叫該 helper 並回傳 result。對應 FR-020、[research.md §5](./research.md)。
- [ ] T081 [US4] 在 [server.js](../../server.js) `processStockRecurring(userId)` T080 後續：補產生迴圈每期改用「該期應觸發日的歷史股價」 — 對每個 `actualDate`（順延後）呼叫 `await fetchTwseStockDay(symbol, actualDate)`（T018）取得當日收盤價；查詢失敗則該期跳過、累計到 `lastSummary.failed` 並 update `last_generated = scheduledDate`，不阻擋後續期數處理。對應 FR-021、Pass 3 Q3、[research.md §5](./research.md)。
- [ ] T082 [US4] 在 [server.js](../../server.js) `processStockRecurring(userId)` T081 後續：INSERT stock_transactions 時加 `recurring_plan_id` + `period_start_date` 兩欄（值為 `r.id` 與 `scheduledDate`）；改用 `INSERT OR IGNORE INTO stock_transactions (..., recurring_plan_id, period_start_date) VALUES (..., ?, ?)`；race 時後到的 session 因 partial unique index 安靜跳過。對應 FR-024a、Pass 3 Q5、[data-model.md §2.3](./data-model.md)。
- [ ] T083 [US4] 在 [server.js](../../server.js) login handler 成功路徑（簽好 JWT cookie 之後、回 response 之前）插入 `setImmediate(() => processStockRecurring(req.userId).catch(e => console.warn('processStockRecurring failed:', e.message)))`；不阻擋 login response。對應 FR-020、Pass 3 Q3、[research.md §5](./research.md)。

### 前端 — 定期定額 Tab（[app.js](../../app.js) 既有區塊）

- [ ] T084 [US4] 在 [app.js](../../app.js) 既有 `renderStockRecurring()` 函式（若有）或股票頁的「定期定額」Tab 補欄位顯示：每筆排程顯示「最近執行紀錄」摘要（`last_generated` 日期 + 預算不足 / 順延 / 歷史股價失敗 等跳過原因）。資料源：`/api/stock-recurring` GET response 已含 `last_generated`；若需 `last_summary` 則於後端補（沿用 baseline 既有欄位即可）。對應 FR-019、FR-021。

**Checkpoint**: 排程設定 + 登入自動觸發 + 多裝置 idempotency + 歷史股價補產生 全套用；US4 已可獨立交付。

---

## Phase 7: User Story 5 — 檢視 FIFO 實現損益並了解每筆賣出的真實獲利（Priority: P2）

**Goal**: 使用者點「實現損益」Tab，頂部彙總卡顯示 4 個數字（總實現損益 / 整體報酬率金額加權 / 今年實現損益 / 已實現筆數），下方表格列出每筆賣出交易的 8 欄位（日期 / 股票 / 股數 / 賣出均價 / 成本均價 / 手續費+稅 / 實現損益 / 報酬率）。

**Independent Test**: [quickstart.md US5](./quickstart.md) — FIFO 計算正確（成本均價、實現損益、報酬率）、彙總卡 4 數字、空狀態文案、未賣出剩餘部位平均成本以 FIFO 剩餘批次計算。

### 後端 — 新端點 `GET /api/stock-realized-pl`

- [ ] T090 [US5] 在 [server.js](../../server.js) 新增 `app.get('/api/stock-realized-pl', (req, res) => { ... })` 端點：(a) 對使用者所有 stocks 跑一次 FIFO 計算（沿用 `/api/stocks` 內既有 FIFO 邏輯，可抽出為 helper `calcFifoForStock(stock, txs)` 共用）；(b) 對每筆 sell transaction 產出 RealizedPLEntry（含 transactionId / sellDate / stockId / symbol / name / shares / sellPrice / costPrice / feeAndTax / realizedPL / returnRate）；(c) 計算 RealizedPLSummary（totalRealizedPL / overallReturnRate 金額加權 / ytdRealizedPL / count）；(d) response `{ entries: [...], summary: {...} }`。所有計算採 `decimal.js` 全精度，僅最終整數化（同 T030 pattern）。對應 FR-029、FR-030、FR-032、Pass 2 Q4、Pass 4 Q1、[research.md §2 + §8](./research.md)、[contracts/stock-investments.openapi.yaml `/api/stock-realized-pl`](./contracts/stock-investments.openapi.yaml)。

### 前端 — 實現損益 Tab

- [ ] T091 [US5] 在 [index.html](../../index.html) 股票頁區塊新增「實現損益」Tab 容器：`<div id="page-stock-realized-pl"></div>` + Tab 切換 button（沿用既有 Tab UI 樣式）。
- [ ] T092 [US5] 在 [app.js](../../app.js) 新增 `renderStockRealizedPL()` 函式：`const { entries, summary } = await API.get('/api/stock-realized-pl')`；渲染彙總卡（4 數字 + 三段式顯色 by `colorizePL()`）+ 表格（8 欄位，預設依 sellDate desc 排序）；空狀態文案「尚無已實現損益紀錄」。對應 FR-029、FR-032、Pass 4 Q4。
- [ ] T093 [US5] 在 [app.js](../../app.js) 表格欄位 sortable：點擊欄位 header 切換排序方向；客戶端排序（不重新呼叫後端）；維護 `sortBy` / `sortDir` 狀態。對應 FR-032。

### 樣式

- [ ] T094 [P] [US5] 在 [style.css](../../style.css) 新增實現損益 Tab 樣式：`.realized-pl-summary`（4 欄 grid 同投資組合總覽卡）+ `.realized-pl-table`（8 欄表格，沿用既有 `.table` 樣式）+ `.realized-pl-empty`（空狀態文案置中）。

**Checkpoint**: 實現損益 Tab 完整顯示彙總 + 表格 + sortable + 空狀態；US5 已可獨立交付。

---

## Phase 8: User Story 6 — 一鍵批次更新所有持股的最新股價（Priority: P3）

**Goal**: 使用者點「批次更新股價」按鈕 → Modal 列出所有持股 + 「標為已下市」checkbox + 「從證交所取得最新股價」按鈕；並發查詢受 `TWSE_MAX_CONCURRENCY` 限制 + 失敗指數退避重試 2 次；使用者可手動覆寫個別股價。

**Independent Test**: [quickstart.md US6](./quickstart.md) — 並發控制（DevTools 觀察分批請求）、失敗重試、手動覆寫不被自動帶入蓋掉、下市 checkbox 凍結價格 + 後續跳過查價。

### 後端 — `/api/stocks/batch-price` 補強（[server.js:8053-8063](../../server.js#L8053)）

- [ ] T100 [US6] 在 [server.js](../../server.js) `/api/stocks/batch-price` POST handler 改寫：(a) body 改為 `{ updates: [{ stockId, currentPrice, delisted? }, ...] }`；(b) 對每筆 update：若 `delisted === true` → `UPDATE stocks SET delisted = 1, current_price = ?, updated_at = ?`（凍結當下價格）；`delisted === false` → `UPDATE stocks SET delisted = 0, current_price = ?, updated_at = ?`；省略 delisted → 僅 update current_price + updated_at（向後兼容）；(c) response 補 `{ updated: <筆數> }`。對應 FR-035、FR-035a、Pass 1 Q2、[contracts/stock-investments.openapi.yaml `/api/stocks/batch-price`](./contracts/stock-investments.openapi.yaml)。
- [ ] T101 [US6] 在 [server.js](../../server.js) 既有 `updateUserStockPrices(userId)` 或同等 TWSE 並發查價函式：(a) 加 `WHERE delisted = 0` 過濾（不對下市股票送 TWSE 請求）；(b) 改用 `fetchAllWithLimit(stocks, fetcher)`（T014）執行並發 + 重試。對應 FR-035a、Pass 4 Q3、[research.md §6 + §12](./research.md)。

### 前端 — 批次更新 Modal

- [ ] T110 [US6] 在 [app.js](../../app.js) 既有 `renderBatchPriceModal()` 或同等批次更新 Modal 渲染函式：每列加 `<input type="checkbox" class="delisted-toggle">` 預填 `s.delisted ? 'checked' : ''`；onclick 時即時 toggle 該列「標為已下市」狀態；送出時 body 包 `{ updates: [{ stockId, currentPrice, delisted }] }`。對應 FR-035a、Pass 1 Q2。
- [ ] T111 [US6] 在 [app.js](../../app.js) 批次更新 Modal「從證交所取得最新股價」按鈕：點下後 fetch `/api/stocks/batch-fetch`（若無此端點則新增為 `app.post('/api/stocks/batch-fetch', ...)` 沿用 T101 邏輯）；response 為每檔最新股價 + 來源（即時 / 收盤 / T+1）+ 取得時間；前端逐列回填輸入框並右側顯示來源 + 時間；查詢失敗的個別股票顯示「查詢失敗」並保留原值。對應 FR-034、Pass 4 Q3。
- [ ] T112 [US6] 在 [app.js](../../app.js) 批次更新 Modal「確認」按鈕：以使用者輸入值（手動覆寫優先）為準包 `{ updates: [...] }` POST 至 `/api/stocks/batch-price`；成功後 close Modal + 重新整理股票頁所有市值 / 損益 / 報酬率。對應 FR-035、Acceptance Scenario US6.3。

### 樣式

- [ ] T120 [P] [US6] 在 [style.css](../../style.css) 新增批次更新 Modal 樣式：`.batch-price-row`（每列 grid 排版含 stockId / 輸入框 / delisted checkbox / source label）、`.batch-price-row__source`（價格來源 + 時間小字）、`.batch-price-row__failed`（查詢失敗紅色提示）。

**Checkpoint**: 批次更新 Modal 完整支援並發查價 + 失敗重試 + 手動覆寫 + 下市標記；US6 已可獨立交付。

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 跨 user story 文件、契約、版本、驗證；不改業務邏輯。

- [ ] T130 [P] 同步更新根目錄 [openapi.yaml](../../openapi.yaml)：`info.version` 從 `4.26.0` 提升至 `4.27.0`；merge 本功能 [contracts/stock-investments.openapi.yaml](./contracts/stock-investments.openapi.yaml) 的所有 paths / schemas / parameters；確認 `openapi: 3.2.0` 字串完全相等；新端點皆有 `security: [cookieAuth: []]`。對應憲章 Principle II。
- [ ] T131 [P] 同步更新 [changelog.json](../../changelog.json)：新增 `4.27.0` 條目，繁體中文 `title` + `changes[].text` 列出主要變更（投資組合總覽 + portfolioSummary、實現損益 Tab、同步除權息阻擋式 Modal、下市標記、登入時自動排程、idempotency 唯一鍵、FIFO decimal.js 全精度、19 條 clarification 對應的 FR 補強）。對應憲章 Development Workflow §2。
- [ ] T132 [P] 同步更新 [SRS.md](../../SRS.md)：補登 `GET /api/stock-realized-pl` 與 `POST /api/stock-dividends/sync` 兩個新端點於 §3.3；補登 `stocks.delisted` 與 `stock_transactions.recurring_plan_id` / `period_start_date` 三個新欄位於 §3.2 schema 區段。對應憲章 Development Workflow §1。
- [ ] T133 執行 [quickstart.md](./quickstart.md) 完整人工驗證：依序跑 US1 ~ US7（Edge Case）所有步驟與邊界驗證；於 quickstart.md 末尾的「整體驗收 Checklist」表格逐項打勾；任一項失敗則回到對應 user story 的 task 修復後再驗。對應 SC-001 ~ SC-006（SC-007 為 post-launch retention，不在本驗證範疇）。
- [ ] T134 驗證「零新依賴」原則：`git diff main -- package.json package-lock.json` 應為 0 行差異；`grep -r 'cdn\.\|<script src=' index.html` 與 main 比對應為 0 行差異；`grep -rn 'require\|import.*from' lib/twseFetch.js` 應僅包含 `const fetch = global.fetch || ...`（無新 npm import）。對應 plan.md 限制原則。
- [ ] T135 在 server.js 啟動 log 確認：startup 期間 console 應有 `processStockRecurring` 進入點訊息（首次登入觸發 hook 時印出）；並確認 [data-model.md §4 驗證 query](./data-model.md) 的 `idx_stock_tx_recurring_idem` 索引存在訊息為 「OK」。

**Checkpoint**: 文件 / 契約 / 版本同步完成，quickstart 全綠，零新依賴驗證通過；本功能可進入 PR review + merge dev。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 — T001 ~ T004 可立即開始（T003 / T004 可並行於 T001 / T002 之後）。
- **Foundational (Phase 2)**: 依賴 Setup 完成 — **阻塞所有 user stories**。T010 ~ T013 schema 變更須序列（同檔案 server.js initDatabase 區塊）；T014 ~ T018 後端 helper 可並行（T014 為新檔、T015 / T016 / T017 / T018 為 server.js 不同函式區塊）；T019 ~ T022 前端 helper 可並行；T023 CSS 可獨立並行。
- **User Stories (Phase 3 ~ 8)**: 皆依賴 Foundational 完成；US1 / US2 / US3（皆 P1）可並行交付（不同 server.js 區塊 / 不同 Modal）；US4 / US5 / US6 同樣可並行。
- **Polish (Phase 9)**: 依賴所有 user story 完成；T130 ~ T132 可並行（不同檔案）；T133 ~ T135 須序列（驗證流程）。

### User Story Dependencies

- **US1**: Foundational 完成後立即可開始。**無**對其他 user story 的依賴（可獨立交付）。
- **US2**: Foundational 完成後立即可開始。`T044 /api/stocks/quote` 可能與 US1 / US3 共享端點，但不衝突（讀路徑無 race）。
- **US3**: Foundational 完成後立即可開始。**無**對 US1 / US2 的依賴；可單獨開發股利相關功能。
- **US4**: Foundational 完成後立即可開始。`T080 ~ T083` 全部位於 server.js login handler + recurring 區塊，與其他 user story 不衝突。
- **US5**: Foundational 完成後立即可開始。新端點 `/api/stock-realized-pl` 為新檔位置，無衝突。
- **US6**: Foundational 完成後立即可開始。`/api/stocks/batch-price` 修改與 US1 的 `/api/stocks` GET 無 race（不同 handler）。

### Within Each User Story

- 後端 schema / helper 變更先行；端點補強次之；前端渲染最後。
- 樣式（CSS）任務皆標 [P] — 不依賴前端 JS 變更，但需與對應 JS 任務同 PR 出貨以避免「裸 CSS class 無 DOM」狀態。

### Parallel Opportunities

- Phase 1: T003 / T004 並行於 T001 / T002 之後。
- Phase 2: T014 / T015 / T016 / T017 / T018 / T019 / T020 / T021 / T022 / T023 大致可並行（不同檔案 / 不同函式區塊）。
- Phase 3 ~ 5（三條 P1 user story）可由 3 位開發者同時推進（不同 Modal / 不同端點 / 不同 Tab）。
- Phase 9: T130 / T131 / T132 並行（不同檔案）。

---

## Parallel Example: User Story 1（單人逐 task）

```bash
# US1 Backend（同檔 server.js 不同區塊，須序列）：
T030 → T031 → T032

# US1 Frontend（同檔 app.js 同函式，須序列）：
T033 → T034 → T035

# US1 樣式（獨立檔案，可並行於後端 / 前端）：
T036 [P]
```

## Parallel Example: 跨 user story 並行（多人）

```bash
# Foundational 完成後 3 位開發者同時推進三條 P1：
Dev A: Phase 3 (US1) — T030 ~ T036
Dev B: Phase 4 (US2) — T040 ~ T055
Dev C: Phase 5 (US3) — T060 ~ T074
```

---

## Implementation Strategy

### MVP First（US1 + US2 + US3）

1. 完成 Phase 1: Setup（4 tasks）。
2. 完成 Phase 2: Foundational（14 tasks，阻塞所有 user story）。
3. 完成 Phase 3: US1（7 tasks，投資組合總覽 + 個股卡片 + 三段式顯色）→ **STOP & VALIDATE**：依 [quickstart.md US1](./quickstart.md) 全綠才進下一階段。
4. 完成 Phase 4: US2（11 tasks，交易 Modal + 鏈式約束）→ **STOP & VALIDATE**。
5. 完成 Phase 5: US3（10 tasks，股利 + 同步除權息）→ **STOP & VALIDATE**。
6. **MVP 達成**：6 個 user story 中的 3 條 P1 完整可用，可考慮 demo / pre-release。

### Incremental Delivery

7. Phase 6: US4（4 tasks，定期定額登入觸發 + idempotency） → 驗證。
8. Phase 7: US5（5 tasks，實現損益 Tab） → 驗證。
9. Phase 8: US6（6 tasks，批次更新 Modal） → 驗證。
10. Phase 9: Polish（6 tasks，文件 / 契約 / 版本 / quickstart 全跑）→ release。

### 風險點

- **T030 FIFO decimal.js 重構**（US1）：影響範圍最廣（baseline `/api/stocks` GET 內聯實作），需仔細手算驗證 SC-004 ≤ 1 元誤差。
- **T080 ~ T083 登入時觸發排程**（US4）：login handler 為熱路徑，setImmediate fire-and-forget 必須完整 catch 錯誤；需確認對 login UX 零影響。
- **T060 ~ T064 同步除權息合成交易**（US3）：deletion cascade 邏輯複雜（依 note 簽名匹配），需 quickstart 邊界驗證連動正確。

---

## Notes

- [P] tasks = 不同檔案、不依賴未完成任務。
- [Story] 標籤對應 user story，便於 traceability。
- 每個 user story 應可獨立完成與測試（隨 Foundational 完成解鎖）。
- 提交頻率：每完成一個 task 或邏輯群組即 commit，避免大批一次 commit。
- 任何 checkpoint 皆可停下來獨立驗證 user story。
- **避免**：模糊任務、同檔衝突、跨 story 依賴破壞獨立性。
- **使用者明確要求遵守**：本任務清單**不引入任何新 npm 套件 / CDN / 外部 API / 獨立服務**；任一 task 違反此原則必須先回退並改寫。

---

## Task Count 摘要

| Phase | 任務數 | 範圍 |
|-------|------|------|
| Phase 1: Setup | 4 | 環境就緒（T001 ~ T004） |
| Phase 2: Foundational | 14 | Schema + 共用 helper + CSS（T010 ~ T023） |
| Phase 3: US1（P1） | 7 | 投資組合總覽 + 個股卡片（T030 ~ T036） |
| Phase 4: US2（P1） | 11 | 交易 Modal + 鏈式約束（T040 ~ T055） |
| Phase 5: US3（P1） | 10 | 股利 + 同步除權息（T060 ~ T074） |
| Phase 6: US4（P2） | 5 | 排程登入觸發 + idempotency（T080 ~ T084） |
| Phase 7: US5（P2） | 5 | 實現損益 Tab（T090 ~ T094） |
| Phase 8: US6（P3） | 6 | 批次更新 Modal（T100 ~ T120） |
| Phase 9: Polish | 6 | 文件 + 契約 + 驗證（T130 ~ T135） |
| **Total** | **68** | **39 FR / 19 Clarification 全覆蓋** |
