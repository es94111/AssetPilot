# 實作計畫：統計報表（Statistics & Reports）

**Branch**: `005-stats-reports` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/005-stats-reports/spec.md`

## Summary

本計畫將 005 規格（3 user story／**26 base FR + 3 sub-FR（`a` 後綴：FR-011a / FR-015a / FR-024a）= 29 FR**／**11 Clarification（4 輪）**／7 SC）落地至既有單體應用。**完全不引入新技術棧**：沿用 001 / 002 / 003 / 004 已建立的 Node.js 24+、Express 5、單一 `server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`）、sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI 3.2.0 契約、Chart.js 4.5.1 CDN（已 SRI 鎖版）、`decimal.js`、`nodemailer`、`resend` SDK、`twParts()` / `taipeiTime` 等既有依賴；本功能**不引入任何新 npm 套件、不引入新前端 CDN 資源、不引入新外部 API、不新增獨立服務或 cron worker**（使用者明確要求）。

**Round 4 釐清補強**（2026-04-26 由 [analyze-01.md](./analyze-01.md) 跨產出物分析觸發）：spec 補入 `/api/accounts.twdAccumulated` 計算欄位設計（為 `SUM(transactions.twd_amount, signed by direction)`，外幣帳戶 `initial_balance` 不納入此累計）；解決儀表板資產配置 TWD 等值的單一資料來源問題。對應計畫變動：在 Phase 2 Foundational 新增 T015（`/api/accounts` 加 `twdAccumulated` 欄位）；在 Phase 5 US3 新增 T064a（FR-023 資料時間註記）與 T064b（FR-019 weekly Mon-Sun 起點 + 週末紫色驗證）；T027 / T066 / T065 / T067 / T070 / T074 / T075 / T076 / T044 / T026 / T048 / T049 / T050 / T090 / T094 共 14 處 task description 補強更精確的實作邊界。Tasks 總數由 65 → 68；FR coverage 由 93% → 100%。詳見 [tasks.md 修補歷史](./tasks.md) 與 [analyze-01.md Remediation Applied](./analyze-01.md)。

既有實作（baseline）已涵蓋本功能約 60% 表面：

- `GET /api/dashboard`（server.js:6654）：回 `income / expense / net / todayExpense / catBreakdown / recent`，但**寫死 `thisMonth()`**、`catBreakdown` 為扁平結構未明確標記「（其他）」虛擬節點。
- `GET /api/reports?type=&from=&to=`（server.js:6690）：回 `categoryBreakdown`（已含父子映射）、`dailyMap`、`monthlyMap`，**已具備本功能所需的雙圓餅資料源**；缺「（其他）」虛擬節點明確標記與 from > to 的拒絕。
- `system_settings.report_schedule_*` 七欄 + `getReportSchedule / shouldRunSchedule / runScheduledReportNow / checkAndRunSchedule`（server.js:4265-4474）已實作 singleton 排程；缺**多筆並存模型**（Round 2 Q2）與**執行期 fallback**（Round 1 Q3）。
- `buildUserStatsReport(userId, freq)`（server.js:3743）+ `renderStatsEmailHtml(...)`（server.js:3909）已輸出三色英雄區、3 欄 KPI、儲蓄率進度條、分類顏色長條、近 5 筆交易、CTA、股票投資 4 列；對比 pill 寫死「上月對比」（缺 Round 1 Q4 的「同型前一段」邏輯）。
- `updateUserStockPrices(userId)`（server.js:4287）已有「即時 → STOCK_DAY → TPEX」三段策略；本功能直接複用。
- 前端 `app.js:1078 renderDashboard()` + `app.js:1911 renderReports()` 已在；缺**月份切換器與儀表板綁定**、**Session 內保留期間/類型**（Round 1 Q5）、**圓餅圖點擊跳轉**（Round 3 Q2）、**「（其他）」虛擬節點繪製**、**對比 pill 同型前一段顯示 label**。

本計畫的工作可拆為 **10 大塊技術決策**（每一塊對應規格的若干 FR；落地細節見 [research.md](./research.md)）：

1. **`/api/dashboard?yearMonth=`**：新增 query parameter（FR-001、Round 1 Q1）；後端 `thisMonth()` 改為 `req.query.yearMonth || thisMonth()`；`catBreakdown` 改為包含「（其他）」虛擬節點明確標記（見決策 4）；`recent` 改為「該月份內前 5 筆」（取代「全帳號最近 5 筆」）。詳見 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#paths)。

2. **資產配置圓餅前端組裝**：**不**新增後端端點；前端 `renderDashAssetAllocationPie()` 改為呼叫既有 `/api/accounts` + `/api/stocks` 後在 client-side 組裝圓餅資料（Round 1 Q2、Round 2 Q1 — 不主動查價、用既有 `current_price` 快取）；新增「持股前 5 名」「帳戶前 5 名」兩個列表元件（DOM 直渲，無新依賴），條件是 `stocks.length > 0`（FR-005）。

3. **「（其他）」虛擬子分類節點**：後端 `/api/dashboard` 與 `/api/reports` 在彙整 `catBreakdown` / `categoryBreakdown` 時，把「`category_id` 指向父分類本身（`parent_id IS NULL`）」的交易聚合為一筆 `{ categoryId: null, name: '（其他）', parentId: '<父分類 id>', isOtherGroup: true, total: ... }`；既有「父分類本身的內圈節點」金額**只**包含其下所有子分類 + 「（其他）」節點之和（避免重複計入）。前端 `drawDashboardExpenseDualPie()` 與 `drawReportsDualPie()` 偵測 `isOtherGroup` flag 套用「（其他）」label；詳見 [data-model.md §1](./data-model.md) 不需 schema 變更。

4. **`/api/reports` 從/到日反向拒絕**：FR-010 要求 `from > to` MUST 拒絕；既有 server.js:6690 ~ 6716 兩個分支（`if (from && to) { … } else { … }`）改為「先 validate from <= to，否則 400 + Error schema」。

5. **多筆並存排程：新表 `report_schedules`**：依 [data-model.md §1](./data-model.md) 建立新表；`initDatabase()` 內加 migration 步驟把既有 `system_settings.report_schedule_*` + `report_schedule_user_ids` 一次性轉為多筆 row（僅當新表為空時執行；冪等防重）。`checkAndRunSchedule()` 改寫為迭代 `SELECT id FROM report_schedules WHERE enabled = 1`；`shouldRunSchedule()` 改造為接收 schedule row 而非 singleton config；`runScheduledReportNow(scheduleId)` 改造為單筆觸發（非全體）。

6. **執行期 SMTP → Resend fallback**：依 [research.md §7](./research.md#7-寄信通道執行期-fallbackfr-021round-1-q3) 改寫 `sendStatsEmail({ to, subject, html })`；SMTP throw 時自動 catch 並退回 Resend；兩通道皆 throw 時最終 throw 給 `runScheduledReportNow` 的 try/catch（既有 failed++ / failures.push 邏輯保留）；**不**重試、**不**補寄（Round 1 Q3）。

7. **對比 pill 同型前一段**：`buildUserStatsReport(userId, freq)` 內 `prevIncome` / `prevExpense` 計算改為依 freq 切換：
   - `freq === 'daily'`：對比「昨日 vs 前日」
   - `freq === 'weekly'`：對比「上週 vs 上上週」
   - `freq === 'monthly'`：對比「上月 vs 上上月」（既有行為）
   新增 `compareLabel` 欄位（「對比昨日」/「對比上週」/「對比上月」）並於 `renderStatsEmailHtml()` 信件 KPI 區塊小字呈現（Round 1 Q4）。

8. **新端點：`/api/admin/report-schedules` 系列**（多筆模式）：
   - `GET /api/admin/report-schedules?userId=` 列出（過濾選用 userId）。
   - `POST /api/admin/report-schedules` 新增，body 為 `ReportScheduleCreate`；同一 user_id + 同 freq 不檢唯一性。
   - `PUT /api/admin/report-schedules/{id}` 更新（不可改 userId / freq）。
   - `DELETE /api/admin/report-schedules/{id}` 刪除（cascade 抹除該 row 的 last_summary，不另留審計）。
   - `POST /api/admin/report-schedules/{id}/run-now` 立即觸發單筆。
   - 詳見 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml#paths) 路徑均為斜線、kebab-case。

9. **既有單數端點 deprecated 兼容**：`GET / PUT /api/admin/report-schedule`（單數）保留為 deprecated alias；GET 仍從 `system_settings.report_schedule_*` 讀；PUT handler 內**新增**「同步寫入 `report_schedules` 表」邏輯（把 userIds[] 拆成多筆對應 freq 的 schedule，去重以 `(user_id, freq)` 比對既有 row 避免重複）。`POST /api/admin/report-schedule/run-now` 同樣保留為 alias，內部呼叫所有 enabled = 1 的 schedule（仍走多筆迴圈）。

10. **前端 UX**：純 `app.js` + `index.html` + `style.css` 改動，無新 CDN：
    - **儀表板月份切換器**：複用 004 月份 nav 樣式；切換時 `await API.get('/api/dashboard?yearMonth=' + ym)`；同步觸發 `renderDashBudget` / `renderDashRecent` 重繪。
    - **統計頁 Session 狀態**：`reportsState = { period, type, customStart, customEnd }` 模組級變數；切換時呼叫 `await API.get('/api/reports?type=&from=&to=')` 重繪三圖；登出時 IIFE 重載自然回預設（不寫 localStorage）。
    - **圓餅圖點擊跳轉**：`Chart.js options.onClick = (evt, items) => navigate(...)`；前端 `navigateToTransactions({ categoryId, type, from, to, isOtherGroup, accountId })` helper 設置交易列表 filter state 並切頁。
    - **空狀態統一 helper**：`renderEmptyState(canvasEl, '此期間無資料')` 共用；圓餅 / 折線 / 長條三函式接到空陣列即呼叫此 helper。
    - **對比 label 小字**：信件 + 統計頁皆在 KPI pill 旁顯示 `compareLabel`。
    - **管理員排程 UI**：原 singleton form 改為列表（每筆一張卡片，含啟用 toggle / 編輯 / 刪除 / 立即寄送）；新增按鈕呼叫 `POST /api/admin/report-schedules`。

不引入新依賴的關鍵驗證：
- 多筆排程的 cron tick 仍用既有 `setInterval(checkAndRunSchedule, 5 * 60 * 1000)`，迭代開銷對 ~ 1000 筆排程亦在毫秒級。
- 圓餅圖點擊互動使用 Chart.js 4.x 原生 `options.onClick`（已可用，無新插件）。
- 月份切換器以既有 `<button>` + 內聯 SVG icon 實作（無 icon library）。

## Technical Context

**Language/Version**: Node.js 24.x（既有 `package.json` `engines.node: ">=24.0.0"`，不變）。
**Primary Dependencies**：
- Backend：Express 5.2.1、sql.js 1.14.1、nodemailer 8.0.5、resend 6.12.2、decimal.js 10.4.3、jsonwebtoken 9.0.2、bcryptjs 3.0.3、helmet 8.1.0、express-rate-limit 8.4.0、cookie-parser 1.4.7。**全部既有，本功能不變更 `package.json`**。
- Frontend：純 vanilla JS（IIFE 模組化）、Chart.js 4.5.1（CDN with SRI integrity）、decimal.js 10.4.3（CDN）；無框架、無打包工具。**全部既有，本功能不新增 CDN 條目**。
**Storage**：sql.js 記憶體執行 + `database.db` 檔案持久化（既有）；本功能新增 1 張表 `report_schedules`，不變動既有表。
**Testing**：手動驗證 + DevTools Network 面板（與 001/002/003/004 一致；無自動化測試框架）；以 [quickstart.md](./quickstart.md) 為驗證劇本。
**Target Platform**：自架 Linux 伺服器（Docker）+ Cloudflare 反向代理；瀏覽器端為 Chrome / Edge / Firefox 桌面版 + Outlook Desktop（信件視覺驗證）。
**Project Type**：單體 web service（單一 `server.js` + 根目錄 SPA）。
**Performance Goals**：
- SC-001：儀表板 ≤ 2 秒完整呈現。
- SC-002：統計頁切換期間／類型 ≤ 1 秒同步重繪（99%）。
- SC-004：排程信件預定觸發後 ≤ 5 分鐘完成寄送（含股價更新與 fallback）。
**Constraints**：
- 不新增 npm 依賴（使用者明確要求）。
- 不新增前端 CDN 資源。
- 不新增外部 API（沿用 TWSE 即時 + STOCK_DAY + TPEX 三段策略）。
- 不新增獨立服務（沿用 setInterval cron）。
- 不對既有 `transactions` / `accounts` / `stocks` / `budgets` / `categories` 表做 ALTER。
**Scale/Scope**：個人記帳工具，預期使用者數 < 1000；單使用者單年交易筆數 < 5000；排程總數 < 1000。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.2.0:

- **[I] 繁體中文文件規範 Gate**：本計畫及其衍生產出（`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**`、未來的 `tasks.md`）皆以繁體中文（zh-TW）撰寫；原始碼識別字、外部 API/函式庫名稱（Express、sql.js、nodemailer、Resend、Chart.js）、環境變數鍵（`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`SMTP_*`）、commit message 前綴（`feat:` / `fix:` / `docs:`）不在此限。
  - **檢核結果**：✅ 通過。本檔案、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md) 主體皆為繁體中文；技術名詞與環境變數依例外條款保留英文。

- **[II] OpenAPI 3.2.0 契約 Gate**：
  - 本計畫新增端點：`/api/admin/report-schedules` GET/POST、`/api/admin/report-schedules/{id}` PUT/DELETE、`/api/admin/report-schedules/{id}/run-now` POST。已於 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) 宣告 `openapi: 3.2.0`。
  - 修改既有端點：`/api/dashboard` 新增 `yearMonth` query parameter；`/api/reports` 補強 categoryBreakdown 結構；`/api/admin/report-schedule`（單數）標記為 `deprecated`。皆於同一檔案登記。
  - 根目錄 `openapi.yaml` 將於同 PR 同步更新（version `4.25.0` → `4.26.0`，MINOR 非破壞性 — 新增端點 + 既有端點僅補非必填欄位）。
  - 重複 schema：`CategoryAggregateNode` 於兩個端點共用，已以 `components.schemas` + `$ref` 表達。
  - 認證：所有新端點皆需管理員身分，已宣告 `security: [cookieAuth: []]`（與既有 admin endpoints 一致）。
  - **檢核結果**：✅ 通過。

- **[III] Slash-Style HTTP Path Gate**：
  - 本計畫新增的 HTTP 路徑：
    - `/api/admin/report-schedules`（複數資源名 + 斜線）
    - `/api/admin/report-schedules/{id}`（單筆）
    - `/api/admin/report-schedules/{id}/run-now`（多字動詞 kebab-case，子資源段表達）
  - **無**任何冒號（如 `/api/admin/report-schedules:run`）；**無**駝峰或底線（如 `runNow` 或 `run_now`）。
  - Express 路由參數宣告 `:id`（合法；不是路徑分隔符）。
  - **檢核結果**：✅ 通過。

- **Development Workflow Gate**：
  - 已建立功能分支 `005-stats-reports`（透過 `speckit.git.feature` hook 自動建立）。
  - 預計同步更新 `changelog.json`（新增 4.26.0 條目，包含每筆主要變更的繁體中文描述）與 `SRS.md`（補登 `/api/admin/report-schedules` 端點）。
  - 無破壞性變更（既有 `/api/admin/report-schedule` 單數端點以 `deprecated` 標記但保留 round-trip 行為，前端逐步切換至新複數端點）。
  - API 變更於同一 PR 更新契約：`openapi.yaml` 與 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) 同步維護。
  - **檢核結果**：✅ 通過。

無 Constitution 違反項目；**Complexity Tracking 表格留空**。

### Post-Design 重新檢核（Phase 1 完成後）

- [I]：✅ 所有 Phase 1 衍生文件以繁體中文撰寫，OpenAPI 描述以中文撰寫，技術名詞例外條款適用。
- [II]：✅ [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) `openapi: 3.2.0` 字串完全相等；新端點皆有 `security`、共用 schema 以 `$ref` 表達。
- [III]：✅ 全檔案路徑斜線；多字動詞 `run-now` 為 kebab-case；`{id}` 為路由參數宣告（合法）。
- Workflow：✅ 計畫與契約同 PR 出貨。

## Project Structure

### Documentation (this feature)

```text
specs/005-stats-reports/
├── plan.md                              # 本檔（/speckit.plan 產出）
├── research.md                          # Phase 0 產出
├── data-model.md                        # Phase 1 產出
├── quickstart.md                        # Phase 1 產出
├── contracts/
│   └── stats-reports.openapi.yaml       # Phase 1 產出（openapi: 3.2.0）
├── checklists/
│   └── requirements.md                  # /speckit.specify 產出
├── spec.md                              # /speckit.specify + 3 輪 /speckit.clarify 產出
└── tasks.md                             # 由 /speckit.tasks 產出（非本指令）
```

### Source Code (repository root)

```text
（既有單體結構，本功能無新增資料夾、無新增頂層檔案）

server.js                                # ~ 8,200 行單檔；本功能改動範圍：
                                         #  - L4193 ~ L4474（排程引擎重寫；新增多筆模式）
                                         #  - L3743 ~ L3907（buildUserStatsReport 對比 pill 同型前一段）
                                         #  - L3909 ~ L4192（renderStatsEmailHtml 補 compareLabel）
                                         #  - L115 ~ L134（sendStatsEmail 補執行期 fallback）
                                         #  - L6654 ~ L6687（/api/dashboard yearMonth 參數 + 「（其他）」節點）
                                         #  - L6690 ~ L6763（/api/reports from > to 拒絕 + 「（其他）」節點）
                                         #  - L4518 ~ L4572（既有 singleton 端點標 deprecated；同步寫入新表）
                                         #  - 新增（接續既有 admin 區塊）：
                                         #    - GET / POST /api/admin/report-schedules
                                         #    - PUT / DELETE /api/admin/report-schedules/:id
                                         #    - POST /api/admin/report-schedules/:id/run-now
                                         #  - initDatabase()：CREATE TABLE report_schedules + migration

app.js                                   # ~ 5,000 行單檔；本功能改動範圍：
                                         #  - L1078 ~ L1150（renderDashboard 月份切換器）
                                         #  - L1153 ~ L1174（renderDashBudget 隨月份切換）
                                         #  - L1176 ~ L1300（renderDashPie 點擊跳轉）
                                         #  - renderDashAssetAllocationPie（重寫為前端組裝、新增前 5 名列表）
                                         #  - L1911 ~（renderReports Session 狀態 + 點擊跳轉 + 自訂期間驗證）
                                         #  - 新增 navigateToTransactions / navigateToStocks helpers
                                         #  - 新增 renderEmptyState helper
                                         #  - 新增 renderAdminReportSchedules（取代既有 singleton form）

index.html                               # 既有，無變更（Chart.js / decimal.js CDN 已在）

style.css                                # 新增：月份切換器 nav、排程列表卡片、（其他）節點顏色標記、compareLabel 小字

openapi.yaml                             # 同 PR 更新：
                                         #  - info.version 4.25.0 → 4.26.0
                                         #  - 新增 /api/admin/report-schedules 系列端點（與本檔 contracts 對齊）
                                         #  - /api/dashboard 補 yearMonth query
                                         #  - /api/reports 補 categoryBreakdown isOtherGroup 欄位
                                         #  - /api/admin/report-schedule（單數）標 deprecated

changelog.json                           # 同 PR 新增 4.26.0 條目（繁體中文描述）

SRS.md                                   # 同 PR 補登新端點（依憲章 Workflow）

CLAUDE.md                                # 同 PR 更新「目前進行中的功能規劃」指向本計畫
```

**Structure Decision**：沿用 001 ~ 004 的單體結構（單一 `server.js` + 根目錄 SPA）。本功能**不新增**任何頂層資料夾、**不新增**任何 npm 套件、**不抽出**新模組（`buildUserStatsReport` / `renderStatsEmailHtml` / `runScheduledReportNow` 仍留在 server.js 內就地擴充）；spec/plan/research/data-model/quickstart/contracts 衍生物落在 `specs/005-stats-reports/` 既有 Spec-Kit 結構下。前端 SPA 仍為單一 `app.js`，本功能於既有 `renderDashboard` / `renderReports` 函式上擴充並新增 helper，不抽出 `js/` 資料夾。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

無違反項目。表格留空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |
