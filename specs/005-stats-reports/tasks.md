---
description: "統計報表（005-stats-reports）任務分解"
---

# Tasks: 統計報表（Statistics & Reports）

**Input**: 設計文件位於 `/specs/005-stats-reports/`
**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml)、[quickstart.md](./quickstart.md)

**Scope**: 3 user story／**26 base FR + 3 sub-FR（`a` 後綴：FR-011a / FR-015a / FR-024a）= 29 FR**／**11 Clarification（4 輪）**／7 SC（其中 SC-007 屬 post-launch retention，不在 build-time 驗證範疇）。spec.md「Out of Scope」段落另列 4 項排除事項（多幣別切換 / 自訂版位 / PDF 匯出 / 自助訂閱），不納入本任務清單。

**修補歷史**：本任務清單於 [analyze-01.md](./analyze-01.md) 跨產出物分析後，補入 Round 4 釐清（C3+C4 合併解決：`/api/accounts.twdAccumulated` 欄位）；同步補入：T015（Foundational `/api/accounts` 補欄位）、T064a（FR-023 資料時間註記）、T064b（FR-019 週末紫色 + Mon-Sun 起點）；T027 / T066 / T067 / T070 / T074 / T075 / T076 / T044 / T026 / T048 / T049 / T050 / T065 / T094 加入更精確的實作邊界。

**Tests**: 既有專案無自動化測試框架（與 001 / 002 / 003 / 004 一致）；本功能不引入新測試 dependency。所有驗證走 [quickstart.md](./quickstart.md) 的可重現手動流程。**故任務清單不含 Tests 區塊。**

**Organization**: 任務以 user story 為主軸分組；Setup（Phase 1）與 Foundational（Phase 2）為跨 story 共用基礎設施；Phase 3 / 4 為兩條 P1 user story（皆可獨立交付）；Phase 5 為 P2 user story；Phase 6 為跨 story 文件／契約／驗證 Polish。

**Critical 限制（使用者明確要求）**: 本功能**不引入任何新 npm 套件**、**不引入新前端 CDN 資源**、**不引入新外部 API**、**不新增獨立服務**；所有任務皆於既有 stack（Node.js 24 + Express 5 + sql.js + Chart.js 4.5.1 + decimal.js + nodemailer + resend）上實作。違反此原則的任務必須先回退並改寫。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可並行（不同檔案、不依賴未完成任務）
- **[Story]**: 對應 user story（US1, US2, US3）
- 每筆任務含具體檔案路徑

---

## Phase 1: Setup（共享基礎設施）

**Purpose**: 確認分支與既有 stack 就緒；本功能完全沿用 001 / 002 / 003 / 004 既有依賴，故無需 `npm install` 或 CDN 變動。

- [X] T001 確認當前 branch 為 `005-stats-reports`、且 working tree 乾淨；若不是則 `git checkout 005-stats-reports && git status` 驗證。
- [X] T002 確認 `package.json` / `package-lock.json` 與 004 完全一致（不新增任何 dependency）；以 `git diff main -- package.json package-lock.json` 應為 0 行差異作為驗收。
- [X] T003 [P] 對 `database.db` 手動備份為 `database.db.bak.before-005`（即使 migration 自動備份，本機開發再手動拷一份）。

**Checkpoint**: 環境就緒，無依賴變動，可進入 Foundational。

---

## Phase 2: Foundational（阻塞先決條件）

**Purpose**: 跨 user story 共用的後端輔助函式與前端 helpers；US1 與 US2 的圓餅圖渲染與點擊跳轉皆依賴本階段；US3 的部分整合（如圓餅圖點擊互動）亦間接依賴。

**⚠️ CRITICAL**: 本階段未完成前，不可開始任何 user story 任務。

### 後端共用 helper

- [X] T010 在 [server.js](../../server.js) 新增 `buildCategoryAggregateNodes(rows)` helper（建議插在 `/api/dashboard` 之前，約行 6650 處）：input 為已 LEFT JOIN `categories c ON t.category_id = c.id LEFT JOIN categories p ON c.parent_id = p.id` 的交易 row 陣列；output 為 `CategoryAggregateNode[]`（依 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#components/schemas/CategoryAggregateNode) 的 schema）。對於 `parent_id IS NULL`（即 `category_id` 指向父分類本身）的交易，MUST 聚合為一筆 `{ categoryId: null, name: '（其他）', color: <父分類色>, parentId: <父分類 id>, parentName: <父分類名>, parentColor: <父分類色>, total: <該群總額>, isOtherGroup: true }` 虛擬節點；金額**不**重複計入內圈父分類弧度（父分類本身的內圈金額 = 其下所有真實子分類 total + 該虛擬節點 total）。最終排序：先 `parent_total DESC`、再同父下 `total DESC`（Round 3 Q1、FR-013、[research.md §4](./research.md)）。對應 SC-003。
- [X] T011 [P] 在 [server.js](../../server.js) 既有 `prevMonthOf(month)` 附近新增兩個 helper：(a) `prevDayOf(isoDate)` 回傳 `YYYY-MM-DD` 前一日；(b) `weekRangeOf(isoDate)` 回傳 `{ start, end, prevStart, prevEnd }` 該日期所在週（週一起算）的 Mon-Sun 範圍與上一週範圍。沿用 `taipeiTime` 既有 helper，不引入新 dependency。對應 FR-018、Round 1 Q4、[research.md §8](./research.md)。

### 前端共用 helper

- [X] T012 [P] 在 [app.js](../../app.js) 新增 `renderEmptyState(canvasEl, label)` helper（建議放在既有 chart helper 區塊附近）：清空 canvas 後繪製簡單空狀態（中央文字 + 圖示），label 預設「此期間無資料」；給圓餅 / 折線 / 長條三種圖表共用以避免殘影。對應 FR-015、Edge Case「使用者於統計頁尚無任何資料的期間」。
- [X] T013 [P] 在 [app.js](../../app.js) 新增 `navigateToTransactions(opts)` helper：opts 為 `{ categoryId?: string|null, parentId?: string, isOtherGroup?: boolean, type?: 'expense'|'income', from?: string, to?: string, accountId?: string }`；行為為 push state 至既有「交易列表」頁的 filter 並切換頁面（重用既有交易列表 filter UI 與 `App.show('transactions')` 既有切頁邏輯）；isOtherGroup=true 時 filter 為「父分類 = parentId 且 category_id 為父分類本身（無子分類）」。對應 FR-015a、Round 3 Q2。
- [X] T014 [P] 在 [app.js](../../app.js) 新增 `navigateToStocks()` helper：切到既有「股票」頁（呼叫 `App.show('stocks')` 或同等既有頁面切換 API）。對應 FR-015a 資產配置「股票市值」扇區點擊跳轉行為。
- [X] T015 在 [server.js](../../server.js) `app.get('/api/accounts', ...)`（行 5242）改寫 response 整形：在現有 `balance`（原幣餘額）欄位旁**新增** `twdAccumulated` 欄位（不移除既有 `balance` — 向後相容）；計算邏輯為 `SUM(t.twd_amount × <符號>)` WHERE `account_id = ? AND user_id = ?`，符號規則：`income / transfer_in` 為正、`expense / transfer_out` 為負；**假設 `transactions.type` enum 僅此 4 種**（既有專案 schema 已驗證為此 4 種；若未來新增 `dividend / adjustment` 等類型需於該功能中另行決定符號，本 task 不處理）；外幣帳戶 `initial_balance` 不納入此累計（無對應 twd_amount）；TWD 帳戶因每筆 twd_amount = amount 自然包含 `initial_balance` 對應的歷史交易（若 `initial_balance != 0` 但無對應交易，前端需了解此值不會反映於 twdAccumulated；以系統慣例多數使用者初始餘額用一筆 income 交易記錄，故無實質落差）。同 PR 須更新 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#components/schemas/AccountWithTwdAccumulated) 與根目錄 [openapi.yaml](../../openapi.yaml) 之 `Account` schema 加入 `twdAccumulated` 欄位（憲章 Principle II 規則 #2）。對應 FR-004、FR-025、Round 4 釐清。

**Checkpoint**: 後端 `buildCategoryAggregateNodes` + `/api/accounts.twdAccumulated` 與前端 4 個 helper 就緒，可同時啟動 US1 / US2 / US3。

> **註（T015 定位）**：T015 不帶 `[Story]` 標籤，定位為跨 user story 共用基礎設施 — 雖然目前僅 US1 (T027) 直接消費 `twdAccumulated`，但屬跨頁基礎契約變更（影響根目錄 `openapi.yaml` 的 `Account` schema），故置於 Foundational phase 而非 US1 phase。

---

## Phase 3: User Story 1 — 登入後一眼掌握本月財務狀況（Priority: P1）🎯 MVP 之一

**Goal**: 使用者登入儀表板後可一目掌握所選月份的 KPI、支出分類圓餅、資產配置圓餅、預算進度、最近交易；月份切換器同步重算所有區塊；圓餅圖點擊跳轉至預先篩選的交易列表。

**Independent Test**: [quickstart.md §2](./quickstart.md) — 月份切換 KPI 重算、雙圓餅排序穩定性、「（其他）」虛擬節點呈現、無持股 / 有持股兩種資產配置切換、預算進度條沿用 004 配色、最近 5 筆交易跟隨月份。

### 後端

- [X] T020 [US1] 在 [server.js](../../server.js) `app.get('/api/dashboard', …)`（行 6654）改寫：(a) 接受 `req.query.yearMonth`（YYYY-MM 格式驗證 `/^\d{4}-(0[1-9]|1[0-2])$/`，未提供或格式錯誤時 fallback 為 `thisMonth()`）；(b) 把所有 `month + '%'` 替換為 `validatedYearMonth + '%'`；(c) `todayExpense` 仍以 `todayStr()` 計算（不隨切換器變化，永遠是當天）；(d) response body 新增 `yearMonth` 欄位回傳實際使用的月份。對應 FR-001、Round 1 Q1、[contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#paths/~1api~1dashboard)。
- [X] T021 [US1] 在 [server.js](../../server.js) `app.get('/api/dashboard', …)` T020 後續改寫：把既有的扁平 `catBreakdown` SQL 查詢結果改餵給 T010 的 `buildCategoryAggregateNodes(rows)`；response `catBreakdown` 從扁平結構改為 `CategoryAggregateNode[]`（含 isOtherGroup 虛擬節點）。確保前端可直接以此資料繪雙圓餅。對應 FR-002、FR-013、Round 3 Q1。
- [X] T022 [US1] 在 [server.js](../../server.js) `app.get('/api/dashboard', …)` T020 後續改寫：把 `recent` 查詢的 SQL `WHERE` 條件補上 `AND t.date LIKE ?`（對應所選月份），並 `ORDER BY t.date DESC, t.created_at DESC LIMIT 5`；確保切到歷史月份時「最近 5 筆」也限縮至該月內，與 KPI 同步（非全帳號最近 5 筆）。對應 FR-007、Round 1 Q1。

### 前端 — 儀表板月份切換

- [X] T023 [US1] 在 [app.js](../../app.js) `renderDashboard()`（行 1078）改寫：頂部新增月份切換器 UI，HTML 結構為 `<button id="dashMonthPrev">‹</button> <span id="dashMonthLabel">YYYY-MM</span> <button id="dashMonthNext">›</button>`；維護 `state.dashMonth = state.dashMonth || thisMonthTaipei()`；切換時 `await API.get('/api/dashboard?yearMonth=' + state.dashMonth)` 並重新呼叫 `renderDashBudget` / `renderDashPie` / `renderDashAssetAllocationPie` / `renderDashRecent`。對應 FR-001、Acceptance Scenario US1.1。
- [X] T024 [US1] 在 [app.js](../../app.js) `renderDashBudget(totalExpense)`（行 1153）改寫：呼叫端傳入 `state.dashMonth` 取代既有 `thisMonth()`；並把 `await API.get('/api/budgets?yearMonth=' + state.dashMonth)` 串接，確保預算進度條跟隨月份切換器（沿用 004 既有配色與行為，**不**重複定義）。對應 FR-006、Acceptance Scenario US1.5。

### 前端 — 支出分類圓餅（含「（其他）」節點 + 點擊跳轉）

- [X] T025 [US1] 在 [app.js](../../app.js) `renderDashPie(catBreakdown, useDualPie)`（行 1176）改寫：依 T021 後端新結構解讀 `isOtherGroup` flag；`drawDashboardExpenseDualPie()`（既有）需接受新結構，外圈對 `isOtherGroup=true` 的節點以「（其他）」label 與該父分類同色階規則排序；前 5 名排行（既有 `renderDashExpenseTop5()`）統計時需把虛擬節點納入但 label 顯示「（其他） — <父分類名>」。對應 FR-013、Round 3 Q1。
- [X] T026 [US1] 在 [app.js](../../app.js) `renderDashPie(...)` Chart.js options 新增 `onClick: (evt, items, chart) => { if (!items.length) return; const seg = chart.data.datasets[items[0].datasetIndex].metadata[items[0].index]; navigateToTransactions({ categoryId: seg.categoryId, parentId: seg.parentId, isOtherGroup: seg.isOtherGroup, type: 'expense', from: state.dashMonth + '-01', to: <月底日期> }); }`；同時於 `chart.data.datasets[*].metadata[*]` 注入 categoryId / parentId / isOtherGroup 三欄供 onClick 取用。**MUST** 採同 SPA 內 `App.show('transactions')` 切頁（**不**改 `history.pushState` 為新 URL），確保使用者按瀏覽器返回鈕時回到原儀表板的相同 month state（FR-015a Round 4 補充、A2）。對應 FR-015a、Round 3 Q2、Acceptance Scenario US1。

### 前端 — 資產配置圓餅（前端組裝 + 持股/帳戶前 5 名 + 點擊跳轉）

- [X] T027 [US1] 在 [app.js](../../app.js) `renderDashAssetAllocationPie(useDualPie)` 重寫：移除任何「呼叫後端 dashboard asset 端點」的假設；改為並行 `Promise.all([API.get('/api/accounts'), API.get('/api/stocks')])` 取現有資料；前端組裝資產配置陣列（每個帳戶一筆 `{ kind: 'account', name, twdValue: a.twdAccumulated, color }`，twdValue **MUST** 取自 T015 新增的 `twdAccumulated` 欄位，**不得**使用 `a.balance × cachedExchangeRates[currency]`（Round 1 Q2 / Round 4 約束）；所有持股聚合為 `{ kind: 'stock', name: '股票市值', twdValue: <Σ shares × current_price>, color }`，皆為 TWD 等值）；股票市值僅讀取 `current_price` 欄位，**不**主動觸發 `/api/stocks/batch-price` 或 TWSE 查價（Round 2 Q1）；若 `twdAccumulated` 為負值（例如該帳戶被刷爆過），於圓餅圖中以絕對值參與弧度計算但 tooltip 顯示原值含負號（避免圓餅消失但保留資訊真實性）。對應 FR-004、Round 1 Q2、Round 2 Q1、Round 4。
- [X] T028 [P] [US1] 在 [app.js](../../app.js) T027 後續：若 `stocks.length === 0` MUST 不渲染「持股前 5 名」與「帳戶前 5 名」兩欄列表（連標題都不出現）；若 `stocks.length >= 1`，於資產配置圓餅下方額外渲染兩欄列表（DOM 直渲），各顯示前 5 名（依 TWD 等值由高到低）；列表 row 點擊跳轉（持股 row → `navigateToStocks()`、帳戶 row → `navigateToTransactions({ accountId })`）。對應 FR-005、FR-015a。
- [X] T029 [US1] 在 [app.js](../../app.js) `renderDashAssetAllocationPie` Chart.js options 新增 `onClick`：點擊「股票市值」聚合扇區 → `navigateToStocks()`；點擊單一帳戶扇區 → `navigateToTransactions({ accountId })`。對應 FR-015a、Round 3 Q2。

### 前端 — 最近 5 筆交易

- [X] T030 [US1] 在 [app.js](../../app.js) `renderDashRecent(recent)` 確認接受後端 T022 改寫後的「該月份內」5 筆；無變更則保留現狀。對應 FR-007。

### 視圖層樣式與標記

- [X] T031 [P] [US1] 在 [index.html](../../index.html) 儀表板區塊（既有 `id="page-dashboard"` 區塊內）插入月份切換器 HTML 與「持股前 5 名」「帳戶前 5 名」兩個 `<div id="dashStockTop5"></div>` / `<div id="dashAccountTop5"></div>` 容器；列表內容由 JS 動態填入。
- [X] T032 [P] [US1] 在 [style.css](../../style.css) 新增月份切換器 nav 樣式（`.month-nav`, `.month-nav__btn`, `.month-nav__label`）、「（其他）」節點視覺標記（外圈 label 加 `*` 後綴或斜紋花色）、持股/帳戶前 5 名列表卡片樣式。

### 契約同步

- [X] T033 [P] [US1] 在根目錄 [openapi.yaml](../../openapi.yaml) 既有 `/api/dashboard` 路徑 entry 補：(a) `parameters[] = { in: query, name: yearMonth, schema: { type: string, pattern: ... }, required: false }`；(b) response schema 補 `yearMonth` 與 `catBreakdown[].isOtherGroup` / `parentId` / `parentName` / `parentColor` 欄位，與 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#components/schemas/DashboardResponse) 對齊。對應憲章 Principle II 規則 #2。

**Checkpoint**: US1 完整可交付；可獨立驗收（[quickstart.md §2](./quickstart.md)）。

---

## Phase 4: User Story 2 — 用「期間 + 類型」切換器深度分析（Priority: P1）🎯 MVP 之二

**Goal**: 統計報表頁工具列含期間選擇器（六種預設 + 自訂時間）與類型切換器（支出 / 收入）；切換即時重繪三個圖表（圓餅、折線、長條）；圓餅圖排序穩定、（其他）虛擬節點正確、空狀態統一；點擊圓餅扇區跳轉至預先篩選的交易列表；session 內保留切換狀態。

**Independent Test**: [quickstart.md §3](./quickstart.md) — 期間 / 類型即時重繪、自訂時間單側填入預設化、起始日 > 結束日拒絕、排序穩定性、（其他）節點呈現、Session 內保留 + 跨 Session 重置、點擊跳轉、三圖空狀態統一。

### 後端

- [X] T040 [US2] 在 [server.js](../../server.js) `app.get('/api/reports', …)`（行 6690）改寫：在處理 `from` / `to` 之前新增 validation：若兩者皆有提供且 `from > to`（字串比較 `YYYY-MM-DD` 即可，無需轉 Date），MUST 回 `400 { error: '起始日不可晚於結束日' }`；不靜默交換兩值。對應 FR-010。
- [X] T041 [US2] 在 [server.js](../../server.js) `app.get('/api/reports', …)` T040 後續改寫：把既有的扁平 `categoryBreakdown` 計算（行 6717 ~ 6746）改為呼叫 T010 的 `buildCategoryAggregateNodes(txs)`；response 中 `categoryBreakdown` 改為 `CategoryAggregateNode[]`（含 isOtherGroup 虛擬節點）。**保留**既有 `catMap` / `dailyMap` / `monthlyMap` / `total` 欄位以維持向後相容（前端折線/長條圖仍用 dailyMap）。對應 FR-013、Round 3 Q1。
- [X] T042 [US2] 在 [server.js](../../server.js) `app.get('/api/reports', …)` T040 後續改寫：response body 新增 `periodStart` / `periodEnd` 欄位；當 query 未提供 `from` / `to` 時，依 spec 預設邏輯（FR-009）以 `thisMonth()` 推得 `periodStart = YYYY-MM-01` / `periodEnd = thisMonthEnd()`（既有 helper 或新增小函式）；當 query 僅提供單側時，依 FR-010 自動補另一側（僅 `from` → `to = todayStr()`；僅 `to` → `from = <to 所屬月 1 號>`）。對應 FR-010、Acceptance Scenario US2.3。

### 前端 — 期間選擇器與類型切換器

- [X] T043 [US2] 在 [app.js](../../app.js) `renderReports()`（行 1911）區塊上方新增模組級狀態變數 `let reportsState = { period: 'thisMonth', type: 'expense', customStart: '', customEnd: '' };`（作用域於 `App` IIFE 內）；`App.show('reports')` 進入時讀取此 state 套用 UI；登入時或 IIFE 重載時自動回到預設值。對應 FR-011a、Round 1 Q5。
- [X] T044 [US2] 在 [app.js](../../app.js) `renderReports()` 內加入期間選擇器 UI bind：六個 segment button（本月 / 上月 / 近 3 個月 / 近 6 個月 / 今年 / 自訂時間）；選中「自訂時間」時顯示兩個 `<input type="date">` 起始 / 結束輸入；其他預設項點擊 → 計算對應 `from / to`（依台灣時區**送出當下**的日期重新計算，**不**快取上一次點擊的結果 — 例如使用者於 23:59 點「本月」，跨午夜後再次點「本月」時 from/to MUST 重新以新日期推算，符合 spec Edge Case「期間切換邊界」要求；分鐘級重繪由 button click handler 觸發，**不**做被動 setInterval 自動重繪以避免使用者意外）。對應 FR-009、FR-014、Edge Case「期間切換邊界」、A3。
- [X] T045 [US2] 在 [app.js](../../app.js) 自訂時間輸入處理：(a) 若僅填起始日（結束日空）→ `to = todayStr()`；(b) 僅填結束日（起始日空）→ `from = <該結束日所屬月份的 1 號>`；(c) 起始 > 結束 → 顯示 inline 提示「起始日不可晚於結束日」、不發 request、保持 UI 現狀。對應 FR-010。
- [X] T046 [US2] 在 [app.js](../../app.js) 類型切換器 UI bind：兩個 segment button（支出 / 收入）；切換時更新 `reportsState.type` 並立即觸發重抓重繪（**不**需「套用」按鈕）；無 debounce、< 300ms 即執行。對應 FR-008、FR-011、SC-002。
- [X] T047 [US2] 在 [app.js](../../app.js) 期間或類型任一變動時呼叫 `await API.get('/api/reports?type=' + reportsState.type + '&from=' + ... + '&to=' + ...)`；response 三圖（圓餅 / 折線 / 長條）平行重繪；切換期間以 `Promise` 取代回呼避免 race condition（後到的 response 覆蓋先到的）。對應 FR-008、FR-012。

### 前端 — 三個圖表

- [X] T048 [US2] 在 [app.js](../../app.js) `renderReportsPie(categoryBreakdown, useDualPie)` 改寫（既有函式或新建）：複用 `buildSortedCategoryRows()`（既有 helper）並加入對 `isOtherGroup` 的識別；雙圓餅模式下外圈包含「（其他）」虛擬節點與真實子分類同列；Chart.js options `onClick` callback 呼叫 `navigateToTransactions({ categoryId, parentId, isOtherGroup, type: reportsState.type, from, to })`。**MUST** 採同 SPA 內 `App.show('transactions')` 切頁，**不**改 URL；返回鈕回到統計頁 MUST 維持原 reportsState（period / type / customStart / customEnd）。對應 FR-013、FR-015a、Round 3 Q1、Round 3 Q2、Round 4 補充。
- [X] T049 [US2] 在 [app.js](../../app.js) 新增（或改寫既有）`renderTrendLine(dailyMap, from, to)` 折線圖：(a) 計算期間天數 `daysCount = diffDays(from, to)`；(b) 採以下**閾值表**（複製自 [research.md §9](./research.md)，inline 於本 task 以利實作者自封閉）：
   - `daysCount <= 31` → 日聚合（X 軸 `MM-DD`）
   - `daysCount <= 92` → 日聚合，X 軸標籤每 7 天稀疏化
   - `daysCount <= 366` → 週聚合（X 軸 `MM-DD（週起點）`）
   - `daysCount > 366` → 月聚合（X 軸 `YYYY-MM`）

   (c) X 軸 label 隨粒度變化；(d) 使用者**不得**手動切換粒度（無 UI 切換器）；(e) 空 dailyMap 即呼叫 `renderEmptyState`。對應 FR-014、FR-015、[research.md §9](./research.md)。
- [X] T050 [US2] 在 [app.js](../../app.js) 新增（或改寫既有）`renderDailyBar(dailyMap, from, to)` 長條圖：與 T049 採完全相同的閾值表（建議共用 `buildAggregationGranularity(daysCount)` helper 回傳 `'daily' | 'weekly' | 'monthly'`）；空 dailyMap 即呼叫 `renderEmptyState`。對應 FR-014、FR-015。
- [X] T051 [P] [US2] 確認 T048 / T049 / T050 三函式皆呼叫 `renderEmptyState(canvasEl, '此期間無資料')`（T012）以獲得三圖一致空狀態（無殘影）。對應 FR-015、Edge Case「使用者於統計頁尚無任何資料的期間」。

### 視圖層樣式與標記

- [X] T052 [P] [US2] 在 [index.html](../../index.html) 統計頁區塊（既有 `id="page-reports"`）插入工具列 HTML：`<div class="reports-toolbar">` 內含期間選擇器 segment buttons、自訂時間輸入容器（預設 hidden）、類型切換器 segment buttons；下方依序為 `<canvas id="reportsPie">`、`<canvas id="reportsTrend">`、`<canvas id="reportsBar">`。
- [X] T053 [P] [US2] 在 [style.css](../../style.css) 新增統計頁樣式：`.reports-toolbar`（fixed 頂端、響應式排版）、`.segment-btn` 與 `.segment-btn--active`、`.custom-period-inputs`、空狀態 `.chart-empty-state` 圖示與文案樣式。

### 契約同步

- [X] T054 [P] [US2] 在根目錄 [openapi.yaml](../../openapi.yaml) 既有 `/api/reports` 路徑 entry 補：(a) response schema 補 `categoryBreakdown[].isOtherGroup` / `parentId` / `parentName` / `parentColor` 欄位；(b) 補 `periodStart` / `periodEnd` 欄位；(c) `400` response 補 `Error` schema 對應 from > to 拒絕；與 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#components/schemas/ReportsResponse) 對齊。對應憲章 Principle II 規則 #2。

**Checkpoint**: US2 完整可交付；可獨立驗收（[quickstart.md §3](./quickstart.md)）。US1 + US2 共同構成本功能 P1 MVP（儀表板 + 統計頁深度分析）。

---

## Phase 5: User Story 3 — 透過排程信件接收每日／每週／每月帳務摘要（Priority: P2）

**Goal**: 管理員可為任意使用者建立多筆排程（同頻率可並存）；台灣時區排程觸發；寄送前更新股價；HTML 信件版面正確；對比 pill 隨頻率切換為「同型前一段」；SMTP / Resend 通道級 fallback；停用→啟用不補寄。

**Independent Test**: [quickstart.md §4](./quickstart.md) — 多筆排程並存、寄送前股價更新、信件版面（含 Outlook Desktop）、對比 pill 三種頻率、執行期 SMTP→Resend fallback、兩通道皆失敗回 503、台灣時區排程於 UTC 主機觸發、停用→啟用不補寄、持股快取為空時 `—` 呈現、使用者帳號停用略過。

### Foundational — Schema migration

- [X] T060 [US3] 在 [server.js](../../server.js) `initDatabase()` 函式中（建議插在現有 004 migration 區塊之後）新增 `report_schedules` 表 `CREATE TABLE IF NOT EXISTS`，schema 完全對應 [data-model.md §1](./data-model.md)（10 欄位）；新增兩個 `CREATE INDEX IF NOT EXISTS`（`idx_report_schedules_user`、`idx_report_schedules_enabled_freq`）。對應 [data-model.md §1 §3.1](./data-model.md)。
- [X] T061 [US3] 在 [server.js](../../server.js) `initDatabase()` 中緊接 T060 之後新增一次性 migration 區塊：偵測 `report_schedules` 表為空時，讀取既有 `system_settings.report_schedule_*` 欄位 + `report_schedule_user_ids` JSON 陣列；若舊 `freq != 'off'` 且 user_ids 非空，為每個有效 user_id 建立一筆 row（`enabled=1`、繼承 hour/weekday/day_of_month/last_run/last_summary）；migration 完成後 `console.log('[migration 005] 已將 singleton 排程遷移為多筆 report_schedules')`；冪等防重（再次啟動時表已非空，不重複插入）。對應 [data-model.md §3.1](./data-model.md)。

### 後端 — 排程引擎與寄信改寫

- [X] T062 [US3] 在 [server.js](../../server.js) 改寫 `sendStatsEmail({ to, subject, html })`（行 115）：先讀 SMTP 與 Resend 是否設定；若 SMTP 設定存在，`try { transporter.sendMail(...); return { provider: 'smtp', id }; } catch (smtpErr) { if (!hasResend) throw smtpErr; /* 落到 Resend 區塊 */ }`；Resend 區塊（無 SMTP 或 SMTP 執行期失敗時執行）保持既有寄送邏輯但 throw 錯誤含 `provider: 'resend'`；兩通道皆未設定仍回 `null`（既有行為）。**不**引入重試佇列、**不**於下次觸發補寄。對應 FR-021、Round 1 Q3、[research.md §7](./research.md)。
- [X] T063 [US3] 在 [server.js](../../server.js) 改寫 `buildUserStatsReport(userId, freq)`（行 3743）：依 freq 計算對比期間：(a) `daily` → 對比「昨日 vs 前日」（用 T011 `prevDayOf`）；(b) `weekly` → 對比「上週 vs 上上週」（用 T011 `weekRangeOf`）；(c) `monthly` → 維持現有 `prevMonthOf` 邏輯。response 物件補 `compareLabel` 欄位（'對比昨日' / '對比上週' / '對比上月'）。對應 FR-018、Round 1 Q4。
- [X] T064 [US3] 在 [server.js](../../server.js) `renderStatsEmailHtml(displayName, email, stats)`（行 3909）改寫：3 欄 KPI 區塊內每張卡的 `renderChangePill` 旁新增 `<div class="kpi-compare-label">` 顯示 `stats.compareLabel`（小字、灰色），讓使用者看到「+15% 對比上週」而非僅「+15%」。對應 FR-018、Round 1 Q4。
- [X] T064a [US3] 在 [server.js](../../server.js) `renderStatsEmailHtml(...)` 「股票投資」區塊每列補資料時間註記（FR-023 後半句）：(a) `buildUserStatsReport` 內讀取 `stocks.updated_at` 並計入 `stats.stockHoldingsList[].priceAsOf`（epoch ms 或 ISO 字串）；(b) `renderStatsEmailHtml` 中為每檔持股渲染列時，若 `priceAsOf` 早於本次寄送時間 12 小時，於該列右側補 `<span style="font-size:11px; color:#94a3b8;">資料: YYYY-MM-DD HH:MM</span>`（台灣時區格式化）；若 `priceAsOf` 在 12 小時內（即本次寄送前 `updateUserStockPrices` 成功更新過）則無需註記。**Edge case 處理**：若 `priceAsOf` 為 0 / NULL / 字串 `"0"`（從未成功更新過股價，例如新加入但 TWSE 查價持續失敗），則 (1) 該列價格欄位顯示「—」；(2) 資料時間欄位顯示「資料: —」（**MUST NOT** 顯示 `1970-01-01` 或 NaN-formatted 日期）；與 spec Assumptions「股價快取最小可用單位」一致。同時若整體無任何持股（`stockHoldings === 0`）則整段「股票投資」區塊不渲染（既有行為，無需改動）。對應 FR-023。
- [X] T064b [US3] 在 [server.js](../../server.js) `buildUserStatsReport(userId, freq)` 之 weekly 分支驗證 + 補強：(a) 確認 `getReportPeriod('weekly')` 回傳的 `period.start` 為**週一**（既有 baseline 應如此但需驗證；若是週日起則修正為週一）；(b) 在 `dailyBreakdown[]` 元素內保留 `weekday` 欄位（既有 0~6）；(c) `renderStatsEmailHtml` 內每日彙總列遇 `weekday === 0 || weekday === 6` 時套紫色 inline style（`style="color: #a855f7;"`，採 inline 而非 CSS class 以相容 Outlook Desktop 的 Word 渲染引擎）對應 FR-019「週末日期紫色標示」。**跨任務影響**：本任務修改 `getReportPeriod()` 與 `renderStatsEmailHtml()` 為跨入口共用 helper；MUST 同時驗證 deprecated singleton 端點 `POST /api/admin/report-schedule/run-now`（T075）與 admin 「測試信件」端點 `POST /api/admin/test-email`（既有）寄出的信件版面依然正確（Mon-Sun 起點 + 週末紫色顯示一致）；驗證劇本見 [quickstart.md §4.3](./quickstart.md)。對應 FR-019。
- [X] T065 [US3] 在 [server.js](../../server.js) 改寫 `shouldRunSchedule(scheduleRow, nowTs)`（行 4343）：input 從 singleton config 改為 `report_schedules` 表的 row（含 `freq / hour / weekday / day_of_month / enabled / last_run` 欄位）；`enabled = 0` 直接回 `false`（取代既有 `freq === 'off'` 判斷）；其餘邏輯（`twParts` 比對 hours / day / date、`last_run < periodStart`）保留。**重要**：T070 PUT 將 `enabled` 由 0 改為 1 時，**MUST NOT** 同時重置 `last_run`（保留前次值）；下次 cron tick 由本函式比對 `last_run < periodStart` 自然決定是否觸發 — 若 last_run 已超過本期 periodStart 則不觸發（即跳過停用期間漏掉的觸發點，FR-024a 不補寄關鍵）。對應 FR-022、FR-024a、Round 2 Q3、[research.md §6](./research.md)。
- [X] T066 [US3] 在 [server.js](../../server.js) 改寫 `runScheduledReportNow(scheduleId, triggeredBy = '排程')`（行 4365）：input 改為單一 `scheduleId`（而非 singleton 的 userIds 陣列）；流程：(a) `SELECT * FROM report_schedules WHERE id = ?`，不存在或 `enabled=0` 立即返回 `{ status: 'disabled' }`；(b) `SELECT id, email, display_name, is_active FROM users WHERE id = ?`；**(b.1)** 若 `user.is_active === 0`（FR-024）MUST 立即返回 `{ status: 'skipped', skipped: 1, reason: '使用者帳號已停用' }` 並 `UPDATE report_schedules SET last_summary = ? ... WHERE id = ?`（**不**更新 `last_run`，因為本次未執行寄送邏輯，下次自然觸發點仍應重試）；(c) `updateUserStockPrices(userId)`（既有，不變）；(d) `buildUserStatsReport(userId, schedule.freq)`；(e) `renderStatsEmailHtml`；(f) `sendStatsEmail`（含 T062 執行期 fallback）；**(f.1)** 若 `sendStatsEmail` 回傳 `null`（兩通道皆未設定，FR-021），MUST 視為 `failed`（**非** `skipped`），並於 `last_summary` 記錄「寄信服務未設定（SMTP / Resend 皆未配置）」prefix；caller (T072) 可由 result.status 判斷是否回 503；(g) `UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?`；(h) 整封 try/catch 拿錯誤訊息寫入 `last_summary`；(i) 既有「`isRunningSchedule` 全域 flag」改為 per-schedule flag map `runningSchedules.add(scheduleId)` / `runningSchedules.delete(scheduleId)`，避免單一排程卡住整個系統。對應 FR-021 ~ FR-024a、SC-004。
- [X] T067 [US3] 在 [server.js](../../server.js) 改寫 `checkAndRunSchedule()`（行 4460）：取代既有「讀 singleton getReportSchedule」邏輯；改為 `queryAll("SELECT id FROM report_schedules WHERE enabled = 1")`，迭代每筆呼叫 `shouldRunSchedule(row, serverNow())`，符合者觸發 `runScheduledReportNow(row.id, '排程').catch(err => console.error('[scheduled-report]', err))`。**並參照 T066 之 `runningSchedules` Set**（per-schedule lock）— 若 `runningSchedules.has(row.id)` 則 skip 該筆 row（避免兩個 cron tick 對同一 schedule 重複觸發）。**移除既有的全域 `isRunningSchedule` flag**（由 T066 取代）。對應 FR-022、Round 2 Q2、[research.md §6](./research.md)。

### 後端 — 新增端點

- [X] T068 [US3] 在 [server.js](../../server.js) 既有 admin 排程端點區塊新增 `app.get('/api/admin/report-schedules', adminMiddleware, …)`：接受可選 `?userId=` query；若提供則 `WHERE user_id = ?`，否則列全部；response 為 `ReportSchedule[]` 陣列；補 `lastRunText`（formatTwTime）、`createdAt` / `updatedAt` 欄位。對應 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#paths/~1api~1admin~1report-schedules/get)。
- [X] T069 [US3] 在 [server.js](../../server.js) 新增 `app.post('/api/admin/report-schedules', adminMiddleware, …)`：body 為 `ReportScheduleCreate`（userId 必填、freq 必填三選一、其餘有預設值）；驗證 userId 對應 user 存在；插入 row 後回 `201` + `ReportSchedule`。**不**檢查 `(user_id, freq)` 唯一性（Round 2 Q2 允許多筆並存）。對應 FR-016、Round 2 Q2。
- [X] T070 [US3] 在 [server.js](../../server.js) 新增 `app.put('/api/admin/report-schedules/:id', adminMiddleware, …)`：body 為 `ReportScheduleUpdate`（hour / weekday / day_of_month / enabled，皆可選）；userId 與 freq 不可變（任一試圖變動的欄位忽略並 log warning）；`enabled: false → true` 時 `last_run` **不**重置（保留前次值，FR-024a 不補寄關鍵）；**若 body 為空物件 `{}` 或所有欄位均為 undefined，回 `400 { error: '請至少更新一個欄位' }`**（避免 no-op PUT）；只有部分欄位提供時，僅 update 那些欄位（不寫 NULL 覆蓋既有值）；row 不存在回 `404`。對應 FR-024a、Round 2 Q3、U2。
- [X] T071 [US3] 在 [server.js](../../server.js) 新增 `app.delete('/api/admin/report-schedules/:id', adminMiddleware, …)`：`DELETE FROM report_schedules WHERE id = ?`；row 不存在回 `404`；成功回 `204`（無 body）。
- [X] T072 [US3] 在 [server.js](../../server.js) 新增 `app.post('/api/admin/report-schedules/:id/run-now', adminMiddleware, …)`：呼叫 T066 的 `runScheduledReportNow(req.params.id, '管理員手動')`；response body 為 `ReportScheduleRunResult`（含 status / sent / failed / skipped / priceUpdates / provider / reason）；若 schedule 不存在回 `404`。**MUST**（FR-021 不靜默吞錯）：若 T066 回傳之 result 顯示寄信服務未設定（透過 result.status === 'no_email_service' 或 last_summary prefix 判斷，見 T066 步驟 f.1），handler MUST 回 `503 { status: 'no_email_service', reason: '寄信服務未設定' }`，**不可**回 `200 { sent: 0 }` 偽裝成功。對應 FR-017、FR-021、Round 1 Q3。

### 後端 — Deprecated 兼容

- [X] T073 [US3] 在 [server.js](../../server.js) 既有 `app.get('/api/admin/report-schedule', ...)`（單數，行 4518）保留現狀（仍從 `system_settings.report_schedule_*` 讀）；於 response body 額外標 `deprecated: true` 警示欄位；既有前端 admin 頁可繼續使用。
- [X] T074 [US3] 在 [server.js](../../server.js) 既有 `app.put('/api/admin/report-schedule', ...)`（單數，行 4538）改寫：寫入 `system_settings` 後**額外**同步寫入 `report_schedules` 表 — 把 `req.body.userIds` 陣列拆成多筆對應 freq 的 schedule，採 **UPSERT 模式**（避免抹除既有 last_run 歷史）：對每筆 user_id，先 `SELECT id FROM report_schedules WHERE user_id = ? AND freq = ? LIMIT 1`；若存在則 `UPDATE report_schedules SET hour = ?, weekday = ?, day_of_month = ?, enabled = 1, updated_at = ? WHERE id = ?`（**保留** `last_run` / `last_summary` 不動）；若不存在才 `INSERT INTO report_schedules (...)`。同時對於不在新 userIds 列表中的舊 row（即「移除寄送對象」場景），執行 `UPDATE report_schedules SET enabled = 0 WHERE user_id = ? AND freq = ?`（停用而非刪除，保留歷史）。對應 FR-016、Round 2 Q2、M2。
- [X] T075 [US3] 在 [server.js](../../server.js) 既有 `app.post('/api/admin/report-schedule/run-now', ...)`（單數，行 4562）改寫：保留 `req.body.userIds` 覆寫支援；改為迴圈 `runScheduledReportNow(scheduleId, '管理員手動 (deprecated)')` 對所有匹配 user 的 enabled=1 schedules（聚合 sent / failed / skipped 後回單一 result）；舊 singleton 流程下沉為「迴圈所有匹配的多筆 schedule」。**若指定的 user 在 `report_schedules` 表中無任一 enabled=1 row**（例如管理員試圖 run-now 但該使用者尚未建立任何排程），MUST 在 result 中將該 user 計入 `skipped` 並於 `failures[]` 加 `<email>: 該使用者無啟用排程`，視為合理略過而非錯誤、回 `200`。對應 FR-016、U3。

### 前端 — 管理員排程列表 UI

- [X] T076 [US3] 在 [app.js](../../app.js) 新增 `renderAdminReportSchedules()` 函式：(a) **並行**呼叫 `Promise.all([API.get('/api/admin/report-schedules'), API.get('/api/admin/users')])` 同時取所有排程與使用者清單；(b) 以 `user_id` 為 key 在前端建立 `userMap = { id: { displayName, email } }` 映射；(c) 依 `user_id` 將排程群組為「卡片群」，每群顯示該使用者 displayName + email（從 userMap 查得，若 userMap 內無對應 entry 則顯示「（使用者已刪除）」）+ 該使用者的所有排程；(d) 每筆排程卡片含：頻率 label、hour / weekday / day_of_month、啟用 toggle（即時 PUT `enabled`）、編輯按鈕（開對話框）、刪除按鈕（confirm 後 DELETE）、「立即寄送」按鈕（POST `run-now`）、`lastRunText` + `lastSummary` 摘要區塊；(e) 頁首「新增排程」按鈕開對話框（選 user / freq / hour / weekday / day_of_month → POST）；(f) 新增第二筆相同 (freq + hour + weekday/dayOfMonth) 排程時 inline warning「此設定與既有排程重複，將寄送兩封內容相同的信」（M4，nice-to-have，可省略）。對應 FR-016 ~ FR-024a、U1。
- [X] T077 [US3] 在 [app.js](../../app.js) 排程編輯／新增對話框：UI 選項與 `ReportScheduleCreate` / `ReportScheduleUpdate` schema 對應；提交時呼叫對應 endpoint；成功後重新拉 `GET /api/admin/report-schedules` 重繪列表。對應 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#components/schemas)。
- [X] T078 [US3] 在 [app.js](../../app.js) 確認既有 admin 頁路由能切到 `renderAdminReportSchedules()`；保留既有 singleton form 為 fallback / debug 用，但預設顯示新列表 UI。

### 視圖層樣式與標記

- [X] T079 [P] [US3] 在 [index.html](../../index.html) 管理員區塊（既有 admin 頁）插入新列表容器 `<div id="adminReportSchedulesList"></div>` 與「新增排程」按鈕；保留既有 singleton form 容器（向後相容、可隱藏）。
- [X] T080 [P] [US3] 在 [style.css](../../style.css) 新增排程列表卡片樣式：`.schedule-card`、`.schedule-card__freq`、`.schedule-card__actions`、`.schedule-toggle`（啟用/停用 switch）、`.schedule-summary`（lastSummary 文字區）、kpi-compare-label 小字樣式（信件 KPI 對比 label）。

### 契約同步

- [X] T081 [P] [US3] 在根目錄 [openapi.yaml](../../openapi.yaml) 新增 `/api/admin/report-schedules` GET / POST、`/api/admin/report-schedules/{id}` PUT / DELETE、`/api/admin/report-schedules/{id}/run-now` POST 五個端點，與 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) 完全對齊；既有 `/api/admin/report-schedule`（單數）三個端點補 `deprecated: true` flag。所有路徑無冒號（憲章 Principle III）。

**Checkpoint**: US3 完整可交付；可獨立驗收（[quickstart.md §4](./quickstart.md)）。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文件、契約、版本、Constitution gate、quickstart 驗證；跨 user story 共用。

- [X] T090 在根目錄 [openapi.yaml](../../openapi.yaml) `info.version` 由 `4.25.0` 升至 `4.26.0`（MINOR 非破壞性 — 新增端點 + 既有端點僅補非必填欄位）；同步 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#info/version) `info.version` 亦為 `4.26.0`。**建議**：本 task 可在 Phase 2 Foundational 階段就先執行（與 T010 ~ T015 同期），不必等到所有 user story 完成才升 version；目的是在過渡期就讓兩份契約檔的 `info.version` 對齊，避免任何 user story 半完成時兩檔不一致（I1）。
- [X] T091 [P] 在 [changelog.json](../../changelog.json) `currentVersion` 設為 `4.26.0`；新增 `changes` 條目（繁體中文）涵蓋本功能主要變更：儀表板月份切換、雙圓餅「（其他）」虛擬節點、資產配置前 5 名列表、統計頁期間／類型切換器、Session 內保留、圓餅圖點擊跳轉、多筆排程並存模型、執行期 SMTP→Resend fallback、對比 pill 同型前一段、停用→啟用不補寄。
- [X] T092 [P] 在 [SRS.md](../../SRS.md) 版本歷史區段新增 `4.26.0` 條目，內容與 T091 對應；`§3.3 端點列舉` 補新增 `/api/admin/report-schedules` 系列五個端點。
- [X] T093 執行 OpenAPI lint 兩條：`npx @redocly/cli lint openapi.yaml` 與 `npx @redocly/cli lint specs/005-stats-reports/contracts/stats-reports.openapi.yaml`，預期 0 error；任一錯誤須在本任務內修正。對應憲章 Principle II 規則 #1。
- [X] T094 在 PR 中執行四條 grep 驗證程式碼層護欄並截圖記入 PR 描述：(a) `git diff main -- package.json package-lock.json` 應為 0 行差異（不新增 dependency）；(b) `grep -nE "from\s+['\"]chart\.js" index.html` 應僅有既有一行 CDN（不新增前端套件）；(c) `git diff main -- server.js | grep -nE "^\+.*app\.\w+\([^)]*:[^)]*['\"]"` 限縮在**本次新增**的 server.js 行範圍內，應為空（即不新增任何冒號式自訂方法路徑；既有 v4.21 前的 `:batch-delete` legacy 路徑於 server.js:3389 / 5964-5965 為向後相容 alias，**不**屬於本功能新增，因此 grep 用 git diff 限縮可避免誤報 I2）；(d) `grep -nE "/api/admin/report-schedules" specs/005-stats-reports/contracts/stats-reports.openapi.yaml openapi.yaml` 應在兩份檔案皆出現相同數量端點。對應憲章 Principle II / III。
- [X] T095 依 [quickstart.md](./quickstart.md) §2 ~ §6 全流程逐項手動驗證；任一步驟失敗即回到對應 user story 任務修補；通過後在 PR 描述附 DevTools Network 截圖（重點：`GET /api/dashboard?yearMonth=2026-03` 回 200 含 `yearMonth` 欄位、`POST /api/admin/report-schedules` 回 201、`POST /api/admin/report-schedules/:id/run-now` 回 `provider: 'smtp'` 或 `'resend'`、信件視覺截圖含 Outlook Desktop）。**SC-001 / SC-002 performance 量測**：於 quickstart.md §2（儀表板）與 §3（統計頁）各補一段 `performance.now()` 測量 — (a) SC-001：`renderDashboard()` 從月份切換 click 到所有 chart 完成 < 2000ms；(b) SC-002：`renderReports()` 從期間 / 類型 click 到三圖完成 < 1000ms。每項記錄至少 5 次切換的中位數於 PR 描述（無自動化框架，採 self-report 證據）。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴，可立即開始。
- **Foundational (Phase 2)**: 依賴 Setup 完成；**阻塞所有 user story**。
  - T010（後端 helper）獨立可寫；T011 獨立可寫。
  - T012 / T013 / T014（前端 helper）皆 [P]，互不依賴。
  - T015（`/api/accounts` 補 `twdAccumulated` 欄位）獨立可寫；US1 的 T027 依賴此欄位才能組裝資產配置 — 故 T015 為 Foundational。
- **User Stories (Phase 3 ~ 5)**: 全部依賴 Foundational 完成；US1 與 US2 之間**互相獨立**（皆 P1，可平行）；US3 與 US1 / US2 互相獨立（P2，建議在 US1+US2 完成後實作）。
- **Polish (Phase 6)**: 依賴所有 user story 完成。

### User Story Dependencies

- **US1（P1，儀表板）**：可在 Foundational 完成後立即開始。後端 T020 / T021 / T022 改 `/api/dashboard` 同一 handler，必須序列；前端 T023 ~ T032 內部依賴可參見下方「Within Each User Story」。
- **US2（P1，統計報表頁）**：可在 Foundational 完成後立即開始，無對其他 story 的依賴。後端 T040 / T041 / T042 改 `/api/reports` 同一 handler，必須序列；前端 T043 ~ T053 大部分可平行（不同函式）。
- **US3（P2，信件排程）**：可在 Foundational 完成後立即開始，無對其他 story 的依賴。內部依賴重：T060 ~ T067（schema migration + 引擎改寫）必須序列；T064 / T064a / T064b 三者均改寫 `renderStatsEmailHtml` / `buildUserStatsReport` 同一檔案，必須序列（T063 → T064 → T064a → T064b）；T068 ~ T072（新端點）可在 T067 完成後並行；T073 ~ T075（deprecated 兼容）依賴 T060 / T061。

### Within Each User Story

- 後端任務（API endpoint）先於前端渲染任務 — 前端需要新欄位（如 `yearMonth`、`isOtherGroup`、`compareLabel`）才能渲染。
- 同一檔案內的多個任務若改動互不重疊區段可並行；改同一函式（如 T020 / T021 / T022 改 `app.get('/api/dashboard', ...)`）必須序列。
- CSS 任務（標 [P]）與 JS 任務獨立，可並行；但建議先寫 JS 確認 class 名稱後再補 CSS。
- 契約同步任務（T033 / T054 / T081）可在後端任務完成後立即執行，與前端任務並行。

### Parallel Opportunities

- **Setup**: T003 [P]。
- **Foundational**: T011 [P]、T012 / T013 / T014 [P]（皆不同檔案/不同函式）。
- **US1**: T028 / T031 / T032 / T033 [P]（不同檔案）。
- **US2**: T051 / T052 / T053 / T054 [P]（不同檔案）。
- **US3**: T079 / T080 / T081 [P]（[index.html](../../index.html) / [style.css](../../style.css) / [openapi.yaml](../../openapi.yaml) 三檔）；T068 ~ T072 五個新端點 handler 在 T067 完成後可平行（不同 endpoint）。
- **Polish**: T091 / T092 [P]（[changelog.json](../../changelog.json) 與 [SRS.md](../../SRS.md) 不同檔）。

---

## Parallel Example: User Story 1

```bash
# T020 / T021 / T022（後端 /api/dashboard 同一 handler 序列）完成後，可同時啟動前端：
Task: "T023 [US1] 在 app.js renderDashboard() 新增月份切換器 UI"
Task: "T031 [P] [US1] 在 index.html 儀表板區塊插入月份切換器 + 持股/帳戶前 5 名容器"
Task: "T032 [P] [US1] 在 style.css 新增月份切換器與「（其他）」節點樣式"
Task: "T033 [P] [US1] 在 openapi.yaml 補 /api/dashboard yearMonth + isOtherGroup"

# 四條並行；T024 ~ T030（前端依賴 T023 的月份切換器 state）→ 序列。
```

## Parallel Example: User Story 3

```bash
# T067 完成（checkAndRunSchedule 改為迭代 schedules 表）後，可同時啟動五個新端點：
Task: "T068 [US3] GET /api/admin/report-schedules"
Task: "T069 [US3] POST /api/admin/report-schedules"
Task: "T070 [US3] PUT /api/admin/report-schedules/:id"
Task: "T071 [US3] DELETE /api/admin/report-schedules/:id"
Task: "T072 [US3] POST /api/admin/report-schedules/:id/run-now"

# 五條並行；T073 ~ T075（deprecated 兼容改寫）依賴 T060 ~ T067 → 序列。
```

---

## Implementation Strategy

### MVP First（US1 + US2）

005 的 P1 包含兩條獨立 user story；建議：

1. 完成 Phase 1: Setup（T001 ~ T003）。
2. 完成 Phase 2: Foundational（T010 ~ T014）— **阻塞所有 story**。
3. 完成 Phase 3: US1（T020 ~ T033）— 儀表板月份切換 + 雙圓餅 +「（其他）」+ 點擊跳轉 + 資產配置前端組裝。
4. **STOP and VALIDATE**: [quickstart.md §2](./quickstart.md) 通過。
5. 完成 Phase 4: US2（T040 ~ T054）— 統計頁期間/類型切換器 + 三圖 + 點擊跳轉 + Session 狀態。
6. **STOP and VALIDATE**: [quickstart.md §3](./quickstart.md) 通過。
7. **MVP 完成**：可發布 dev branch 預覽版本。

### Incremental Delivery

8. 完成 Phase 5: US3（T060 ~ T081）— 多筆排程模型 + 執行期 fallback + 對比 pill 同型前一段 + 管理員列表 UI。
9. 完成 Phase 6: Polish（T090 ~ T095）— 契約、版本、文件、grep gate、quickstart 全流程驗證。

每個 user story 完成後皆可獨立 demo / deploy，不需等所有 P2 都完成。

### Parallel Team Strategy（多人協作）

- **Dev A（後端）**：Foundational T010 / T011 → US1 後端 T020 ~ T022 → US2 後端 T040 ~ T042 → US3 後端 T060 ~ T075 → Polish T093 / T094。
- **Dev B（前端 — 儀表板與統計頁）**：Foundational T012 ~ T014 → US1 前端 T023 ~ T032 → US2 前端 T043 ~ T053 → Polish 部分手動驗證 T095。
- **Dev C（前端 admin + 文件）**：US3 前端 T076 ~ T080 → Polish T090 / T091 / T092。
- **All**：Phase 6 quickstart 驗證（T095）共同進行。

---

## Notes

- **零新依賴**：所有任務皆於既有 stack 上實作；不允許 `npm install` 任何套件、不允許新增 CDN 資源、不允許新增外部 API。違反此原則的任務必須先回退並改寫。T094 grep 驗證為最終 gate。
- **[P] 標記**：不同檔案 + 無未完成依賴；同檔案不同函式且互不干擾亦可標 [P]。
- **[US?] 標記**：對應 [spec.md](./spec.md) 的 3 條 user story；Setup / Foundational / Polish 不帶 [US?]。
- **每個 user story 皆可獨立完成、獨立驗證**：US1 / US2 / US3 互不依賴；業務上有意義的順序仍是 US1 → US2 → US3（P1 兩條先、P2 再）。
- **驗證方式**：每完成一個 task 後在 [quickstart.md](./quickstart.md) 對應段落手動驗證；通過後勾選任務 checkbox。
- **Commit 粒度**：建議 task 完成即 commit；commit message 含 task ID（如 `feat(005): T020 GET /api/dashboard 補 yearMonth query 參數`），便於 reviewer 追溯。
- **Constitution Gate**：T093（OpenAPI lint）+ T094（zero-new-deps + 斜線路徑護欄 grep）為憲章 Principle II / III 的最終 gate；任一失敗 PR 不得 merge。
- **避免**：模糊任務（「優化儀表板」）、跨 story 依賴破壞獨立性、未標明檔案路徑的描述。
