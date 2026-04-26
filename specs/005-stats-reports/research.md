# Phase 0 研究紀錄：統計報表

**Branch**: `005-stats-reports` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔記錄 Phase 0 對 [plan.md](./plan.md) 內 10 大技術決策的調研結果。所有 NEEDS CLARIFICATION 已於 spec 三輪 `/speckit.clarify` 解決（共 10 條 Q/A），本階段聚焦在「如何在既有 stack 上落地、為何不引入新依賴」。

使用者明示限制：**使用專案現有的技術方案，不可以新增技術規格**。本計畫嚴守此限制 — 不引入任何新 npm 套件、不引入新前端 CDN 資源、不新增獨立服務或 cron worker、不新增資料庫引擎。

---

## 1. 既有實作 baseline 盤點

### 決策

直接在 `server.js` 與 `app.js` 既有的 dashboard / reports / scheduled-mail 路由與 render 函式上擴充；**不**新增獨立模組、**不**抽出 `lib/statsReporter.js` 或 `lib/scheduleEngine.js`。

### 理由

baseline 已涵蓋本功能約 60% 表面：

- **後端統計查詢已成熟**：
  - `GET /api/dashboard`（server.js:6654）：回 `income / expense / net / todayExpense / catBreakdown / recent`，但**寫死 `thisMonth()`**，未支援月份切換。
  - `GET /api/reports?type=&from=&to=`（server.js:6690）：回 `categoryBreakdown`（已含 `parentId / parentName / parentColor` 父子映射）、`dailyMap`、`monthlyMap`，已具備本功能所需的雙圓餅資料源。
- **信件排程已在執行**：
  - `system_settings.report_schedule_freq / hour / weekday / day_of_month / last_run / last_summary / user_ids` 七個欄位（server.js:4265）。
  - `getReportSchedule()` / `shouldRunSchedule()` / `runScheduledReportNow()` / `checkAndRunSchedule()`（每 5 分鐘）已就緒（server.js:4265-4474）。
  - `buildUserStatsReport(userId, freq)`（server.js:3743）已組合 daily/weekly/monthly 報告資料。
  - `renderStatsEmailHtml(displayName, email, stats)`（server.js:3909）已輸出 HTML + table-based 三色英雄區、3 欄 KPI、儲蓄率進度條、分類顏色長條、近 5 筆交易、CTA、股票投資 4 列。
  - `updateUserStockPrices(userId)`（server.js:4287）已有「即時 → STOCK_DAY → TPEX」三段策略。
  - `twParts(ts)`（server.js:4324）已存在；`shouldRunSchedule()` 已用 UTC+8 自然時區比對。
- **寄信通道已就位**：
  - `sendStatsEmail({ to, subject, html })`（server.js:115）：先 SMTP（nodemailer transporter）→ 否則 Resend SDK；兩者皆未設定回 `null`。但**僅有「設定缺失」fallback，無「執行期錯誤」fallback**（FR-021 round 1 Q3 要求補強）。
- **前端 Chart.js 已載入**：
  - `index.html:14` `<script src="...chart.js@4.5.1" integrity="sha512-..." crossorigin="anonymous">`（已 SRI 鎖版本）。
  - `app.js:1078` `renderDashboard()` 已呼叫 `/api/dashboard`，並有 `renderDashPie / renderDashAssetAllocationPie / renderDashRecent` 等繪圖函式；`renderReports()`（app.js:1911）對應統計報表頁。
- **OpenAPI 契約根目錄已存在**：`openapi.yaml`（v4.25.0，`openapi: 3.2.0`）涵蓋既有端點。

剩餘 40% 落差皆為 spec 三輪釐清產生的具體要求（月份切換、雙圓餅「（其他）」節點、點擊跳轉、Session 狀態、多筆排程、執行期 fallback、對比 pill 同型前一段）— 詳見 §2 至 §10。

### 替代方案

- **`lib/statsReporter.js` 模組化抽出** — 否決。`buildUserStatsReport` + `renderStatsEmailHtml` 已是純函式（無副作用），抽出 require 開銷大於收益；003 / 004 同類擴充亦未抽出。
- **獨立 cron worker（如 BullMQ + Redis）** — 否決。違反「不新增技術棧」約束；單節點 sql.js 無 IPC 必要；`setInterval(checkAndRunSchedule, 5 min)` 在現有部署已驗證可用。
- **GraphQL 統一報表查詢** — 否決。違反「不新增技術棧」；現有 REST + 純 query string 滿足六種期間預設與自訂期間。

---

## 2. 儀表板月份切換器與 KPI 重算（FR-001、Round 1 Q1）

### 決策

`GET /api/dashboard` 端點新增 `yearMonth` 查詢參數（格式 `YYYY-MM`，未提供時預設為當前台灣時區月份）；後端依該月份重算 `income / expense / net / catBreakdown / recent`。前端 `renderDashboard()` 增加月份切換器（重用 004 的月份 nav 樣式），切換時 `await API.get('/api/dashboard?yearMonth=' + ym)` 重新拉、重新繪。

### 理由

- 與 004「歷史月份預算進度即時重算」原則一致 — 兩功能共用同一月份切換器，後端皆即時重算（無快照）。
- `thisMonth()` 改為 `yearMonth || thisMonth()`，邏輯改動最小。
- `catBreakdown` SQL 已為動態 `date LIKE '<月份>%'`，僅需替換月份字串。
- `recent` 限制為 5 筆且依交易日期由新到舊（FR-007）— 當切換到歷史月份時，「最近 5 筆交易」MUST 限縮至該月份內（與 KPI 同步），避免使用者切到 3 月卻看到 4 月的交易。

### 替代方案

- **新增 `/api/dashboard/:yearMonth`** — 否決。Express 路由參數會與既有 `/api/dashboard` 衝突；query string 形式更貼近既有 `/api/budgets?yearMonth=` 慣例。
- **前端自行依 client-side 篩選** — 否決。`recent` 必須在後端 LIMIT 5，否則需要拉整月所有交易再前端切；浪費頻寬。

---

## 3. 資產配置圓餅圖資料來源（FR-004、Round 1 Q2、Round 2 Q1）

### 決策

**完全不在 `/api/dashboard` 端點重新計算資產配置**。前端 `renderDashAssetAllocationPie()` 改為呼叫**既有的** `/api/accounts`（取餘額；外幣帳戶以歷史交易累計本幣金額，與 002 / 004 預算口徑同源）與 `/api/stocks`（取 `current_price` 快取，**不**主動觸發查價）；前端組裝 TWD 等值資產配置陣列，再丟給 Chart.js 繪圖。

### 理由

- Round 1 Q2 鎖定「外幣帳戶餘額採歷史交易累計本幣金額」— `accounts.balance` 計算邏輯已在 server.js `calcBalance()` 內以同口徑實作（基於 `transactions.twd_amount`），**無需後端再加一個彙整端點**。
- Round 2 Q1 鎖定「儀表板**不**主動查價，讀取 `stocks.current_price` 快取」— `GET /api/stocks` 直接回該欄位，無需新端點。
- 前端組裝可避免「重複端點」與「重複 SQL」 — 現有 `app.js:1095` 已示範同模式（dashboard 上方「總資產卡」即用此方式）。

### 替代方案

- **新增 `GET /api/dashboard/assets`** — 否決。等於把現有 `/api/accounts` + `/api/stocks` 的資料合併成一份，違反 DRY；也增加端點維護成本。
- **後端 SQL 直接 join `accounts × stocks`** — 否決。SQL join 跨表混合單位（金額 vs 持股數）反而難讀；現有 `calcBalance()` 已涵蓋餘額計算。

---

## 4. 圓餅圖「（其他）」虛擬子分類節點（FR-013、Edge Cases、Round 3 Q1）

### 決策

後端 `/api/dashboard` 與 `/api/reports` 皆需在回應中**明確標記**「父分類本身有交易但無子分類細項」的部分為虛擬節點：在 `categoryBreakdown` / `catBreakdown` 陣列中，當某筆交易的 `category_id` 為父分類（`parent_id IS NULL`）時，**不**將其當作該父分類的內圈節點，而是組成一個 `parentId = <該父分類 id>`、`isOtherGroup = true`、`name = '（其他）'` 的虛擬子分類節點，與真實子分類同列、同色階規則排序。

### 理由

- Round 3 Q1 鎖定「外圈以『（其他）』虛擬子分類群組呈現」 — 為了讓前端 `drawDashboardExpenseDualPie()` 能用統一邏輯處理（外圈一律掃 `parentId` 已知的節點），後端 MUST 把這類節點轉為「假子分類」結構，而非保留原始「父分類自身金額」結構。
- 排序鍵保持「父總額 desc → 同父下子總額 desc」 — 「（其他）」當成子節點與真實子分類同樣比較，邏輯一致。
- 「金額 MUST 不重複計入」 — 後端建構時，父分類本身的交易**只**計入 `parentTotal`（用於內圈父分類弧度）和**該虛擬子節點的 `total`**（用於外圈），不重複加到「父分類自身」的內圈節點。

### 替代方案

- **前端推導虛擬節點** — 否決。前端需知道 `parent_id IS NULL` 與 leaf-only 原則的細節；後端集中產出更易維護。
- **不額外處理，前端自行決定怎麼畫** — 否決。會導致儀表板與統計頁、不同瀏覽器版本的 Chart 渲染順序不一致，違反 SC-003「100% 穩定一致」。

---

## 5. 統計報表頁圖表互動與 Session 狀態（FR-008 ~ FR-015a、Round 1 Q5、Round 3 Q2）

### 決策

純前端事項（無後端契約變更）：

- **Session 內保留期間／類型**：`reportsState = { period, type, customStart, customEnd }` 模組級變數（不寫 localStorage、不寫 cookie）；登入流程進入時於 `App` IIFE 內初始化為 `{ period: 'thisMonth', type: 'expense', customStart: '', customEnd: '' }`；切換時更新該變數並 re-render，但不持久化；登出時整個 `App` IIFE 重載（既有行為），自然回到預設。
- **點擊跳轉交易列表**：`renderReportsPie()` / `renderDashPie()` 在 Chart.js `onClick` callback 內擷取被點擊的 segment 的 `categoryId`（內圈為父、外圈為子或「（其他）」虛擬節點），呼叫 `navigateToTransactions({ categoryId, type, from, to, isOtherGroup })`；該函式 push 篩選 state 後切到「交易列表」頁，列表頁讀 state 並 set filter UI。
- **資產配置圓餅點擊**：點擊「股票市值」扇區呼叫 `navigateToStocks()`；點擊某帳戶扇區呼叫 `navigateToTransactions({ accountId })`。
- **空狀態統一**：`renderReportsPie / renderTrendLine / renderDailyBar` 三個函式皆共用 `renderEmptyState(canvasEl, '此期間無資料')` helper；任一函式收到空陣列即清 canvas 並繪製 placeholder，避免殘影。

### 理由

- Round 1 Q5 鎖定「Session-scoped、跨 Session 重置、不新增 user preferences 欄位」 — IIFE 模組級變數最輕量，無需後端、無需 schema、無需 localStorage。
- Round 3 Q2 鎖定「點擊跳轉交易列表」 — Chart.js 4.x 原生 `onClick` callback 可精準回 segment index，再以 dataset metadata 對應回 categoryId；現有交易列表頁已有 filter state，本決策不增加新表單元件。

### 替代方案

- **以 URL hash 記錄統計頁狀態** — 否決。會與既有 hash-based 路由（如 `#dashboard`）打架；且 hash 持久化超出 round 1 Q5 的「跨 Session 重置」要求。
- **儲存於 user preferences DB 欄位** — 否決。違反 round 1 Q5 明示「不新增 per-user 偏好欄位」。

---

## 6. 信件排程：單一 system_settings → 多筆 report_schedules 表（Round 2 Q2、Round 2 Q3）

### 決策

**新增 `report_schedules` 表**（schema 詳見 [data-model.md §1](./data-model.md)）；**逐步遷移**既有 `system_settings.report_schedule_*` 欄位至新表，但**不刪除舊欄位**（向後相容、回滾安全）。

新表一筆一個排程（`(id, user_id, freq, hour, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at)`）。`(user_id, freq)` **不**設唯一鍵（Round 2 Q2 明示）；`id` 為唯一識別。

Migration 步驟（於 `initDatabase()` 啟動冪等執行）：
1. `CREATE TABLE IF NOT EXISTS report_schedules (...)`。
2. 讀取 `system_settings.report_schedule_*` 與 `report_schedule_user_ids` JSON 陣列。
3. 若舊 `freq != 'off'` 且 `user_ids` 陣列非空，且 `report_schedules` 表內**完全沒有**該 `(user_id, freq)` 配對的列，則為每個 user_id 建立一筆 row（id 為 uid()、enabled=1、繼承 hour/weekday/day_of_month、last_run = system_settings.report_schedule_last_run、last_summary = system_settings.report_schedule_last_summary）。
4. **保留** `system_settings.report_schedule_*` 欄位不動（migration 二次執行時 step 3 條件「完全沒有該配對」自動阻止重複插入）；首版上線後若觀察 OK，再於 006 或更晚版本以 PR 移除舊欄位。

`checkAndRunSchedule()` 改寫為：迭代 `SELECT id FROM report_schedules WHERE enabled = 1`，每筆呼叫舊 `shouldRunSchedule()` 改造版（傳 schedule row 而非 singleton config）→ 觸發後 update 該 row 的 `last_run` / `last_summary`。

### 理由

- Round 2 Q2 鎖定「`(user_id, frequency)` 不唯一、可多筆並存」— 必須拋棄 singleton schedule 結構。
- Round 2 Q3 鎖定「停用→啟用不補寄」— 用 `enabled` 欄位（0/1）而非「刪除排程」表達啟用狀態，配合 `last_run` 不變即可達成「重新啟用後從下次自然觸發點開始」（既有 `shouldRunSchedule(): schedule.lastRun < periodStart` 邏輯天然滿足，停用期間 `last_run` 保留為停用前的值，重新啟用時若 periodStart 已超過 last_run 則下次觸發點觸發；停用期間漏的觸發點全被略過）。
- 保留舊欄位等於「漸進式 migration」— 即使啟動失敗回滾，舊排程資料未動，業務不中斷。

### 替代方案

- **完全 drop 舊欄位、強制 migration** — 否決。回滾無路；單節點 sql.js 無 transaction-level migration 支援，啟動中斷會壞資料。
- **每筆排程獨立 cron 計時器** — 否決。`setInterval` 數量隨 schedule 數量線性增長；單一 `checkAndRunSchedule` + 5 分鐘 tick 已足以覆蓋每日／每週／每月需求。

---

## 7. 寄信通道執行期 fallback（FR-021、Round 1 Q3）

### 決策

`sendStatsEmail({ to, subject, html })` 改寫為：

```javascript
async function sendStatsEmail({ to, subject, html }) {
  const smtp = getSmtpSettingsRaw();
  const hasSmtp = !!(smtp.host && smtp.port);
  const client = getResendClient();
  const hasResend = !!(client && RESEND_FROM_EMAIL);
  if (!hasSmtp && !hasResend) return null;  // 兩者皆未設定（既有行為）

  // 先試 SMTP（若已設定）
  if (hasSmtp) {
    try {
      const transporter = getSmtpTransporter();
      const from = smtp.from || smtp.user || 'noreply@localhost';
      const info = await transporter.sendMail({ from, to, subject, html });
      return { provider: 'smtp', id: info.messageId };
    } catch (smtpErr) {
      // 執行期錯誤 → 若有 Resend 則自動退回（FR-021 Round 1 Q3）
      if (!hasResend) throw smtpErr;
      // 落到下方 Resend 區塊
    }
  }

  // Resend 區塊（無 SMTP，或 SMTP 執行期失敗）
  const result = await client.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html });
  if (result?.error) {
    const err = new Error(result.error.message || 'Resend 寄送失敗');
    err.provider = 'resend';
    throw err;
  }
  return { provider: 'resend', id: result?.data?.id || '' };
}
```

呼叫端 `runScheduledReportNow()` 內 `try { await sendStatsEmail(...) } catch (e) { failed++; failures.push(...) }` 已能捕捉到「兩通道都掛」的情境；只需確認 `failures` 訊息含 `provider` 區分（既有 `failures.push` 會記 e.message）。

### 理由

- Round 1 Q3 鎖定「通道級 fallback、不重試、Resend 也失敗就放棄」— 上述邏輯完全對應：執行期錯誤觸發 fallback；fallback 也失敗就 throw 給上層；上層 `runScheduledReportNow` 既有 try/catch 接住 → `failed++` → `last_summary` 累加 → 不再重試。
- 不需要佇列、不需要持久化「待重試」狀態 — Round 1 Q3 明示「不引入重試佇列、不於下次觸發補寄」。

### 替代方案

- **重試 3 次再退回 Resend** — 否決。違反 Round 1 Q3「不重試」約束。
- **Resend → SMTP 反向 fallback** — 否決。違反 Round 1 Q3「SMTP 優先」約束；FR-021 也明示優先 SMTP。

---

## 8. KPI ▲▼ pill 對比窗口（FR-018、Round 1 Q4）

### 決策

`buildUserStatsReport(userId, freq)` 內：

- 既有 `prevMonth = prevMonthOf(month)` 對比 — **僅用於 `freq === 'monthly'`**。
- 新增 daily 模式：對比「昨日 vs 前日」；用 `taipeiTime.todayInTaipei()` 推算前日字串作為 `=` 比對。
- 新增 weekly 模式：對比「上週 vs 上上週」；以 `period.start`（上週一）回推 7 天作為上上週起點。

`renderStatsEmailHtml()` 內 `renderChangePill(stats.incomeChangePct, ...)` 不變（純比較顯示），只是傳入的 `incomeChangePct` 在 `buildUserStatsReport` 計算時改用對應的「同型前一段」基準值。

新增欄位 `stats.compareLabel`（如「對比昨日」「對比上週」「對比上月」），於信件 KPI 區塊小字呈現，避免使用者看到「-15%」卻不知對比哪段。

### 理由

- Round 1 Q4 鎖定「同型前一段」對比 — 每日 → 前一日、每週 → 上週、每月 → 上月。
- 既有 `renderChangePill()` 純粹依百分比決定 ▲ / ▼ / 顏色，無需知道對比窗口；只需在 `buildUserStatsReport` 計算對比基準時改寫。

### 替代方案

- **每日信仍對比上月** — 否決。違反 Round 1 Q4。
- **完全移除對比 pill** — 否決。spec 明示要保留 ▲▼ pill。

---

## 9. 圓餅圖排序與聚合粒度（FR-013、FR-014）

### 決策

**排序**：後端 `/api/dashboard` 與 `/api/reports` 皆 SQL 即排序（`ORDER BY parent_total DESC, sub_total DESC`），前端 `buildSortedCategoryRows()`（既有 helper, app.js）保證內外圈順序一致；「（其他）」虛擬節點以子節點規則參與排序。

**折線/長條聚合粒度**：純前端決定，由 `buildAggregationGranularity(from, to)` helper 根據區間天數選擇：
- `≤ 31 天` → 日聚合（X 軸顯示 `MM-DD`）
- `≤ 92 天`（近 3 個月）→ 日聚合（仍可讀，X 軸標籤改為 7 天間隔）
- `93 ~ 366 天`（近 6 個月、今年）→ 週聚合（X 軸顯示 `MM-DD（週起點）`）
- `> 366 天`（自訂跨年）→ 月聚合（X 軸顯示 `YYYY-MM`）

聚合不需後端支援 — 後端 `/api/reports` 已回 `dailyMap`（`{ 'YYYY-MM-DD': total }`）；前端依粒度規則 reduce 成週／月 bucket。

### 理由

- 排序由 SQL 決定保證 stable — 同一筆 query 兩次回傳順序必然相同。
- 聚合在前端決定避免後端多一個 query string 參數（保持 `/api/reports` 簡潔）；資料量天花板（一個使用者 1 年 ~ 366 個 daily key）對前端 reduce 完全不成負擔。

### 替代方案

- **後端 `/api/reports?granularity=daily|weekly|monthly`** — 否決。增加後端複雜度；前端反正要拿 dailyMap 來繪「每日長條圖」（FR-014 兩圖共資料源）。
- **使用者可手動切換粒度** — 否決。FR-014 明示「使用者不得手動切換粒度」。

---

## 10. OpenAPI 3.2.0 契約同步（憲章 Principle II）

### 決策

新增 `specs/005-stats-reports/contracts/stats-reports.openapi.yaml`（本功能子契約）；同步更新根目錄 `openapi.yaml`：

- `/api/dashboard` 補 `yearMonth` query parameter；response schema 補 `categoryBreakdown[].isOtherGroup` 欄位。
- `/api/reports` response schema 補 `categoryBreakdown[].isOtherGroup`、`categoryBreakdown[].parentId`、`categoryBreakdown[].parentName`、`categoryBreakdown[].parentColor` 等既有欄位（之前可能未完整宣告）。
- 新增 `/api/admin/report-schedules`（複數）GET / POST、`/api/admin/report-schedules/{id}` PUT / DELETE / 觸發、`/api/admin/report-schedules/{id}/run-now` POST 等端點對應多筆排程設計（取代 round 1 設計的 `/api/admin/report-schedule` singleton）。
- 既有 `/api/admin/report-schedule`（單數）端點**保留**為 deprecated alias（向後相容），直接讀取舊 `system_settings.report_schedule_*` 欄位 — 但 PUT 行為改為「同步寫入新表的對應 rows」（即把 userIds list 拆成多筆 daily/weekly/monthly schedule）。

`info.version` 由 `4.25.0` → `4.26.0`（MINOR：新增端點，非破壞性）。

所有路徑遵守 Principle III 斜線規範；`run-now` 為子資源段，無冒號。

### 理由

- 憲章 Principle II 明示「新端點 MUST 與實作同 PR 更新契約」。
- 保留 deprecated alias 避免破壞既有前端管理頁 UI（`renderAdminSchedule()` 呼叫 `/api/admin/report-schedule`）；前端會於同 PR 切換到新端點，但舊端點仍可 round-trip。

### 替代方案

- **直接 break 舊端點、強制前端同 PR 改** — 否決。增加 PR 風險；deprecated alias 是 1 行 `app.use('/api/admin/report-schedule', forwardToReportSchedules)`，成本極低。
- **不新增子契約、只改根目錄** — 否決。004 已建立「per-feature contracts」慣例，本功能照此 pattern。

---

## 11. 違反 Constitution 風險回顧

| Principle | 風險點 | 結論 |
| --- | --- | --- |
| I. 繁體中文文件 | 所有衍生文件以繁體中文撰寫 | ✅ 無違反 |
| II. OpenAPI 3.2.0 | 新增 `/api/admin/report-schedules` 等端點 | ✅ 將於 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) 與 `openapi.yaml` 同 PR 更新；`openapi: 3.2.0` 字串保留 |
| III. Slash-Style HTTP Path | 新增端點均為斜線路徑（`/api/admin/report-schedules/{id}/run-now`） | ✅ 無冒號；多字動詞 kebab-case `run-now` |
| Development Workflow | 已建立 `005-stats-reports` 分支；契約與實作同 PR | ✅ 無違反 |

無 Complexity Tracking 條目需要登記。

---

## 12. 開放議題（不阻擋計畫）

以下事項已明確 Deferred 至後續迭代，不在本計畫的 Phase 1 設計範圍：

1. **管理員預覽信件 / 模擬寄送 UI** — 既有 `/api/admin/test-email`（寄給管理員自己）已涵蓋驗證需求；管理員預覽他人信件屬 001 user-permissions 範疇。
2. **排程刪除後歷史寄送紀錄是否 cascade** — 本版採「不刪 last_summary（保留為歷史摘要文字）；刪除 row 後 last_summary 隨 row 一併消失」最簡單策略；若未來需要「跨 schedule 刪除仍保留審計」再規劃 audit 表。
3. **TWSE 查價限速與重試** — 沿用 `updateUserStockPrices()` 既有實作，本功能不調整其重試策略。
4. **大量使用者排程 scale**（如 > 100 排程）— 預期不會發生；若達該量級，可改 `setInterval` 為基於 `last_run` 的 delta-loop（不在本版範圍）。
