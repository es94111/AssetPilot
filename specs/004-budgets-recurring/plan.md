# 實作計畫：預算與固定收支（Budgets & Recurring Transactions）

**Branch**: `004-budgets-recurring` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/004-budgets-recurring/spec.md`

## Summary

本計畫將 004 規格（5 user story／**33 base FR + 9 sub-FR（`a/b/c` 後綴：FR-009a / 021a / 021b / 021c / 024a / 024b）= 36 FR + OUT-001/002**／10 Clarification（3 輪）／8 SC）落地至既有單體應用。**完全不引入新技術棧**：沿用 001 / 002 / 003 已建立的 Node.js 24+、Express 5、單一 `server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`）、sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI 3.2.0 契約、`decimal.js` / `lib/moneyDecimal.js` / `lib/taipeiTime.js`、`lib/exchangeRateCache.js` 等既有依賴；本功能**不引入任何新 npm 套件、不引入新前端 CDN 資源、不引入新外部 API**。

既有實作（baseline）已涵蓋本功能約 50% 表面：

- `budgets` 表（server.js:666）：`id` / `user_id` / `category_id` / `amount(REAL)` / `year_month` 五欄；端點 `GET / POST / DELETE /api/budgets`（行 5995–6031）。
- `recurring` 表（server.js:674）：`id` / `user_id` / `type` / `amount(REAL)` / `category_id` / `account_id` / `frequency` / `start_date` / `note` / `is_active` / `last_generated` 共 11 欄 + ALTER 補上的 `currency` / `fx_rate`（行 796–797）；端點 `GET / POST / PUT / DELETE /api/recurring`、`PATCH /api/recurring/{id}/toggle`、`POST /api/recurring/process`（行 6034–6115）。
- 前端 `app.js`：`renderBudget()`（行 2598+）已實作預算管理頁與單級進度條；`renderRecurring()` 已實作配方列表；登入後 client-side 呼叫 `/api/recurring/process` 觸發產生（app.js:554）。
- `openapi.yaml`：`/api/budgets`、`/api/budgets/{id}`、`/api/recurring`、`/api/recurring/{id}`、`/api/recurring/{id}/toggle`、`/api/recurring/process` 路徑皆已登記（行 937–1061）。

本計畫的工作可拆為 **9 大塊技術決策**（每一塊對應規格的若干 FR；落地細節見 [research.md](./research.md)）：

1. **Schema 對齊 002 慣例（金額 REAL → INTEGER）**：`budgets.amount`、`recurring.amount`、`recurring.fx_rate`（REAL → TEXT）依 002 已建立的 decimal-string 慣例 migrate；新增 `recurring.needs_attention INTEGER DEFAULT 0`、`recurring.updated_at INTEGER`；新增 `transactions.source_recurring_id TEXT DEFAULT NULL`、`transactions.scheduled_date TEXT DEFAULT NULL`；建立 partial unique index `idx_tx_source_scheduled ON transactions(source_recurring_id, scheduled_date) WHERE source_recurring_id IS NOT NULL`（FR-028 並發冪等保護）；補 `idx_tx_source ON transactions(source_recurring_id)` 加速「來自配方」反查。詳見 [data-model.md §3 Migration](./data-model.md)。

2. **產生流程（核心邏輯）重寫**：取代既有 `/api/recurring/process`（為 client-trigger 設計）的弱保證實作，提煉為**伺服器側 `processRecurringForUser(userId)` 函式**，並複用 003 的 `backfillDefaultsForUser`「登入後同步呼叫」模式（server.js:2522 / 2986 / 3075）；`/api/recurring/process` 端點保留為手動觸發 fallback（呼叫同一函式）。產生流程關鍵改動（FR-013 ~ FR-015、FR-022、FR-023、FR-028、FR-029）：
   - **時區校正**：`todayStr()` 改用 `taipeiTime.todayInTaipei()`（FR-023），不再用 `new Date().toISOString()` UTC 字串。
   - **每月／每年月底回退**：`getNextDate()` 不再依賴 JavaScript `Date.setMonth(+1)` 自動 overflow（其會把 1/31 + 1 month 計為 3/3）；改為「先 `setDate(1)` 推進月份再 `setDate(min(originalDay, lastDayOfNewMonth))`」方式（FR-022）。
   - **冪等保護**：`INSERT INTO transactions … VALUES (..., ?, ?)` 把 `source_recurring_id` 與 `scheduled_date` 寫入；DB 唯一索引若拒絕，捕捉錯誤、跳過該日期、繼續迴圈。
   - **`last_generated` 條件式推進**：`UPDATE recurring SET last_generated = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)`（FR-029），避免並發 transaction 互相覆蓋造成回退。
   - **「需處理」自動標記**：迴圈中若偵測 `category_id` 或 `account_id` 已不存在於 `categories` / `accounts` 表，`UPDATE recurring SET needs_attention = 1 WHERE id = ?` 並 break 該配方迴圈（FR-024）。

3. **編輯既有配方的分支邏輯**（FR-021a / FR-021b / FR-021c）：`PUT /api/recurring/{id}` 需偵測欄位變動並決定 `last_generated` 處理：
   - 起始日變動 → `last_generated = NULL`（FR-021a）。
   - 起始日未動但週期變動 → 保留 `last_generated`（FR-021b）。
   - 起始日與週期皆未動（僅金額／分類／帳戶／備註／幣別／匯率變動）→ 保留 `last_generated`，且 **MUST NOT** 觸發任何歷史 `transactions` 行的 `UPDATE`（FR-021c：不溯及既往）。
   - 偵測欄位若來自佔位識別字（`__deleted_category__` / `__deleted_account__`）→ `400 Bad Request`（FR-020）。
   - 儲存時若 `needs_attention = 1` 且新欄位皆有效 → 同步清除旗標（FR-024b），但實際產生流程**不於儲存當下同步觸發**，等下次登入或排程觸發。

4. **預算端點補強**（FR-001 ~ FR-010、FR-009a）：
   - `GET /api/budgets?yearMonth=YYYY-MM` 已存在；`used` 計算改採 `twd_amount`（INTEGER）求和而非 `amount` REAL（FR-010：本幣彙整、外幣 × 該筆匯率）：`SUM(twd_amount) WHERE type='expense' AND date LIKE 'YYYY-MM%' AND exclude_from_stats = 0 [AND category_id = ?]`。
   - `POST /api/budgets` 既有 upsert 行為保留；補 `amount` 必為正整數（FR-003、`amount > 0 AND amount = ROUND(amount)`）；補拒絕負分類預算同月份多筆（既有 upsert 已隱含 FR-002 唯一性，但要在錯誤訊息中明示「該月份此分類已存在預算，請改為編輯既有預算」以支援獨立 PATCH）；不限制月份範圍（FR-009a）。
   - 新增 `PATCH /api/budgets/{id}` 用以**僅編輯金額**：與 POST 共用 amount 驗證；`year_month` 與 `category_id` 不接受變更（依 FR-008 字面僅金額可改；隱含禁止換月／換分類維度）。
   - `DELETE /api/budgets/{id}` 既有保留。

5. **進度條三段配色**（FR-006、Edge Cases 配色閾值臨界）：純前端事項；後端 `GET /api/budgets` 仍只回 `used` / `amount` / `category_id` / `year_month`；前端 `app.js` `renderBudget()` 計算 `pct = used / amount` 後依 `<50% / 50–79% / 80–99% / ≥100%` 套 CSS class（`budget-bar--green` / `--neutral` / `--yellow` / `--red`）；`style.css` 新增四個 class 與 hover 過渡。

6. **月份切換器與歷史月份即時重算**（FR-007）：前端 `app.js` 新增月份 nav（`<` 上月 / `2026-04` 月份顯示 / `>` 下月）；切換時 `await API.get('/api/budgets?yearMonth=' + ym)` 重新拉、重新繪；後端 `used` 永遠依當前資料庫即時計算（`yearMonth` 任意，無時間限制；不快取），與 FR-007 即時重算一致。

7. **「需處理」與「（待執行）」UX 分層**（FR-019、FR-024a）：
   - 後端 `GET /api/recurring` 回應每筆配方加上 `needsAttention`（boolean，自 `recurring.needs_attention`）與計算欄位 `nextDate`（伺服器計算，依 FR-013 / FR-022 規則）。
   - 前端 `renderRecurring()` 卡片渲染分流：
     - `is_active = 1` 且 `needs_attention = 1` → 紅／橘色階卡片 + ⚠ 文案「需處理：原分類／帳戶已刪除，請重新指定」。
     - `is_active = 1` 且 `needs_attention = 0` 且 `nextDate < today` → 黃色預警 + 「（待執行）」字樣。
     - `is_active = 0` → 灰階；不顯示任一警示。
   - 編輯對話框中遇到分類／帳戶已刪除 → 下拉頂部插入 `<option value="__deleted_category__">（原分類已刪除）</option>` 並 selected；submit handler 拒絕該值。

8. **「來自配方」UI 標籤**（FR-025 ~ FR-027）：
   - 後端 `GET /api/transactions` 回應每筆交易加上 `sourceRecurringId`（自 `transactions.source_recurring_id`）與 `sourceRecurringName`（LEFT JOIN `recurring.id` 取 `note` 或回 `null` 表示已刪除）。
   - 前端交易列表行末附 chip 元件：有 `sourceRecurringName` → 「📌 來自配方：<name>」可點擊跳轉至 `/recurring`；有 `sourceRecurringId` 但 `sourceRecurringName` 為 null → 純文字「（來源配方已刪除）」灰字、不可點。
   - 交易編輯頁同樣顯示此 chip；不阻擋任何欄位編輯（FR-026）。

9. **OpenAPI 3.2.0 契約同步**（憲章 Principle II）：
   - 新增 `contracts/budgets-recurring.openapi.yaml`（本功能子契約）。
   - 同步更新根目錄 `openapi.yaml`：`Transaction` schema 補 `sourceRecurringId` / `sourceRecurringName` / `scheduledDate` 三欄；`Budget` schema 改用 INTEGER amount；`RecurringTransaction` schema 補 `needsAttention` / `nextDate` / `updatedAt` 三欄；新增 `PATCH /api/budgets/{id}` 端點。
   - **不變動**端點：`POST /api/recurring/process` 沿用作為手動觸發 fallback；不新增 `POST /api/recurring/sync` 等別名，以維持 URL 表面最小變動（憲章 Principle III 已透過所有現有路徑驗證——皆為 slash-only，無 `:verb` 待修正）。

本計畫無新外部 API 整合；不呼叫任何 IPinfo / TWSE / Google Identity Services / Resend / exchangerate-api（後者僅在 002 既有路徑使用）。

| 端點 | 方法 | 對應 FR | 狀態 |
| --- | --- | --- | --- |
| `/api/budgets` | GET | FR-005, FR-007, FR-010 | 既有；`used` 計算改用 `twd_amount` 整數彙整 |
| `/api/budgets` | POST | FR-001, FR-002, FR-003, FR-004, FR-009a | 既有；補正整數驗證、明示唯一性錯誤訊息 |
| `/api/budgets/{id}` | PATCH | FR-008 | **新增**：僅編輯金額（year_month / category_id 不可變） |
| `/api/budgets/{id}` | DELETE | FR-008 | 既有 |
| `/api/recurring` | GET | FR-018, FR-019, FR-024a | 既有；回應補 `needsAttention` / `nextDate` |
| `/api/recurring` | POST | FR-011, FR-014, FR-016, FR-017 | 既有；驗證金額為正整數（TWD 維度）、`fx_rate` 改寫為 TEXT |
| `/api/recurring/{id}` | PUT | FR-021, FR-021a, FR-021b, FR-021c, FR-024b | 既有；新增「起始日變動則 reset last_generated」分支邏輯與 needs_attention 自動清除 |
| `/api/recurring/{id}` | DELETE | FR-021 | 既有；不連帶刪除歷史衍生交易（已符合） |
| `/api/recurring/{id}/toggle` | PATCH | FR-017 | 既有 |
| `/api/recurring/process` | POST | FR-012 ~ FR-015, FR-022, FR-023, FR-028, FR-029 | 既有；**核心重寫**為 `processRecurringForUser` 共用函式 + 登入時 server-side 自動觸發 |

實作順序：US1（FR-001 ~ FR-010、FR-009a；前端 三段配色 + 月份切換器）→ US2（FR-011 ~ FR-017、FR-022、FR-023、FR-028、FR-029；產生流程核心重寫）→ US3（FR-018, FR-019；卡片三日期 + 待執行）→ US4（FR-020, FR-024 ~ FR-024b；佔位下拉 + 需處理視覺）→ US5（FR-021 ~ FR-021c, FR-026, FR-027, FR-025；編輯分支邏輯 + 來源標籤）。對應 P1 → P1 → P2 → P2 → P2，詳見 tasks.md（Phase 2，本計畫不產出）。

## Technical Context

**Language/Version**：Node.js 24+（部署於 Zeabur 與 Docker；`package.json` 鎖定 `express ^5.2.1`、`sql.js ^1.14.1`、`decimal.js ^10.x`）。前端為瀏覽器原生 ES modules，無打包步驟（與 001 / 002 / 003 一致）。

**Primary Dependencies**：

- 後端（既有，本功能**完全不新增**）：`express`、`cookie-parser`、`cors`、`helmet`、`express-rate-limit`、`jsonwebtoken`、`bcryptjs`、`@passwordless-id/webauthn`、`sql.js`、`adm-zip`、`nodemailer`、`resend`、`dotenv`、`decimal.js`（002 引入；本功能於 `processRecurringForUser` 計算外幣 → twd_amount 時重用）。
- 前端（既有，本功能**完全不新增**）：原生 HTML / CSS / JavaScript（SPA）、Chart.js（既有）、Font Awesome 6 圖示（皆以 SRI 掛載）；`window.Decimal`（透過 `lib/moneyDecimal.js` 同構暴露）。
- 內部 lib（既有）：`lib/moneyDecimal.js`（FR-010 整數彙整與 FR-011 外幣 → 本幣換算）、`lib/taipeiTime.js`（FR-023 時區判定）、`lib/exchangeRateCache.js`（不直接調用，但 `recurring.fx_rate` 寫入時的 normalize 邏輯沿用 002 既有 `convertToTwd` 與 `normalizeCurrency`）。
- 外部 API：**無**。本功能不呼叫任何外部服務；既有 `recurring` 端點目前的 `convertToTwd` 內若觸發 fxCache lookup 屬 002 既有行為，本計畫不變動。

**Storage**：SQLite 透過 `sql.js` 於記憶體執行；持久化至 `./database.db`，`saveDB()` 在每次寫入後序列化覆寫。本功能涉及的資料表：

- `budgets`（**migration**：`amount REAL` → `INTEGER NOT NULL`、新增 `created_at INTEGER`、`updated_at INTEGER NOT NULL DEFAULT 0`、補唯一性約束 `UNIQUE(user_id, year_month, category_id)`，`category_id` 為 `NULL` 時透過 partial unique index 保證每月「整月總支出預算」至多一筆）。
- `recurring`（**migration**：`amount REAL` → `INTEGER NOT NULL`、`fx_rate REAL` → `TEXT NOT NULL DEFAULT '1'`、新增 `needs_attention INTEGER NOT NULL DEFAULT 0`、`updated_at INTEGER NOT NULL DEFAULT 0`）。
- `transactions`（**alter**：新增 `source_recurring_id TEXT DEFAULT NULL`、`scheduled_date TEXT DEFAULT NULL`；新增 partial unique index `idx_tx_source_scheduled` + 普通 index `idx_tx_source`）。

詳細 schema 與 migration 步驟見 [data-model.md](./data-model.md)。

**Testing**：與 001 / 002 / 003 相同——既有專案無自動化測試框架；本計畫不引入新測試 dependency，改以 [quickstart.md](./quickstart.md) 的可重現手動驗證流程為主，搭配 `npx @redocly/cli lint openapi.yaml` 在 CI／本機進行 schema lint。

**Target Platform**：Linux server（Zeabur／Docker／VPS）；HTTPS 環境；瀏覽器端僅需支援 ES modules、`fetch`、`Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' })`（已是 002 / 003 假設前提）。

**Project Type**：Web service（單體）——單一 `server.js` 同時服務 JSON API 與靜態資產，沒有獨立 SPA build。

**Performance Goals**（對應 SC-003 ~ SC-006）：

- 登入時 server-side `processRecurringForUser(userId)` P95 `< 500ms`，前提：當次需補產出 ≤ 30 筆（SC-003）。
- 對 `> 30 筆` 的長時間未登入情境，產生流程於 5 秒內完成或於背景非阻塞執行（SC-004）；具體做法：登入 handler 同步呼叫但設定 30 筆軟上限，超過則先返回登入成功、剩餘以 `setImmediate` 延後執行（同一 process 內仍序列、避免阻塞 HTTP 回應）。
- 預算進度條「已用金額」更新延遲 P95 `< 200ms`（SC-006）：交易新增／編輯／刪除後前端立即重抓 `GET /api/budgets`；後端查詢以 `idx_tx_user_date` + `idx_tx_user_cat` 既有索引處理，當月支出筆數通常 < 200，`SUM(twd_amount)` 在 sql.js 記憶體下毫秒級。
- `GET /api/recurring` P95 `< 200ms`：典型每使用者配方 < 30 筆、每筆計算 `nextDate` 為純 JS（FR-022 月底回退）。

**Constraints**：

- **零新依賴**（使用者輸入強制要求：「根據之前專案的技術規格，不可以新增技術規格」）：禁止新增任何 npm dependency、前端 CDN 資源、外部 API 整合；所有功能皆於既有 stack 上實作。
- **金額嚴格 INTEGER（TWD 維度）**：FR-003 預算金額為正整數（TWD 本幣）；`recurring.amount` migrate 為 INTEGER 後同樣不接受小數（外幣輸入時於前端／後端 `convertToTwd` 折算；折算結果 round 為整數寫入 `amount` 欄位、原始外幣金額寫入 `original_amount` 為與 002 慣例一致）；`recurring.fx_rate` migrate 為 TEXT decimal 字串。
- **時區嚴格 Asia/Taipei**：所有「今日／月份」判定一律 `taipeiTime.todayInTaipei()`、`taipeiTime.monthInTaipei(date)`；不接受 `new Date().toISOString()`（UTC 漂移）。
- **type 不可變**：`PUT /api/recurring/{id}` 一律不接受 `type` 欄位變更請求（與 003 對 `categories.type` 對稱治理）；後端 `UPDATE` SQL 不含 `type` 欄位。
- **不溯及既往（FR-021c）**：配方業務欄位變更**MUST NOT** 觸發任何歷史 `transactions` 行的 UPDATE；對應 PUT handler 中的 SQL 嚴格只動 `recurring` 表本身。
- **OpenAPI 3.2.0**：本功能新／改端點與 schema 同步寫入 `openapi.yaml` 與 `contracts/budgets-recurring.openapi.yaml`，憲章 Principle II。

**Scale/Scope**：單節點 sql.js；預估每使用者預算 < 20 筆／月（1 整月總 + ≤ 15 分類預算）、固定收支配方 < 30 筆；衍生交易（`source_recurring_id IS NOT NULL`）佔 transactions 全表約 10–30%；百人級使用者下：

- `budgets` 全表 ≈ 20 × 12 × 100 = 24,000 筆，可忽略。
- `recurring` 全表 ≈ 30 × 100 = 3,000 筆。
- `transactions` 衍生子集合 ≈ 30 × 12 × 100 = 36,000 筆／年；partial unique index `idx_tx_source_scheduled` 僅覆蓋有 `source_recurring_id` 的行，索引大小可控。

## Constitution Check

*GATE：Phase 0 研究前必過；Phase 1 設計後重測。*

Gates（憲章 v1.2.0）：

- **[I] 繁體中文文件規範 Gate**：✅ PASS
  - `spec.md`、本 `plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**` 皆以 zh-TW 撰寫。
  - 保留識別字（`source_recurring_id`、`scheduled_date`、`needs_attention`、`last_generated`、`year_month`、`twd_amount`、`processRecurringForUser`、`backfillDefaultsForUser`）、套件名（`sql.js`、`Express`、`decimal.js`）、HTTP 狀態碼為英文／符號，符合憲章例外條款。

- **[II] OpenAPI 3.2.0 契約 Gate**：✅ PASS
  - 本功能新增 `PATCH /api/budgets/{id}` 端點；對既有 `GET /api/budgets`、`GET /api/recurring`、`PUT /api/recurring/{id}`、`POST /api/recurring/process` 端點修改回應 schema（補 `needsAttention` / `nextDate` / `sourceRecurringId` / `sourceRecurringName` / `scheduledDate`）；皆於 [contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml) 宣告 `openapi: 3.2.0` 字串。
  - 同 PR 同步更新根目錄 `openapi.yaml`：(a) 新增 `PATCH /api/budgets/{id}` paths 條目、(b) `Transaction` schema 補三欄、(c) `Budget` schema 將 `amount` 由 `number` 改為 `integer`、(d) `RecurringTransaction` schema 補三欄；符合憲章 Principle II 規則 #2。
  - 共用 schemas（`Budget`、`RecurringTransaction`、`Transaction`、`Error`）以 `components.schemas` + `$ref` 表達；所有端點宣告 `security: [{ cookieAuth: [] }]`。
  - `info.version` 將自 `4.24.0`（003 已 bump 至此）bump 至 `4.25.0`（minor，新端點 + schema 欄位）。

- **[III] Slash-Style HTTP Path Gate**：✅ PASS
  - 本功能新增的所有端點皆採斜線形式：`PATCH /api/budgets/{id}`；無任何 `:verb` 冒號式路徑。
  - 既有受影響端點（`/api/budgets`、`/api/budgets/{id}`、`/api/recurring`、`/api/recurring/{id}`、`/api/recurring/{id}/toggle`、`/api/recurring/process`）皆已是 slash-only（已驗證 `openapi.yaml` 行 937–1061），無需遷移。
  - Express 路由參數宣告（`/api/budgets/:id`、`/api/recurring/:id`）屬規格允許之冒號用途。

- **Development Workflow Gate**：✅ PASS
  - 功能分支 `004-budgets-recurring` 已由 `create-new-feature.ps1` 建立（從 `dev` 開分支）。
  - 實作完成後將同步更新 `changelog.json` 新增 `4.25.0` release entry、`SRS.md` 版本歷史。
  - 含 schema migration（`budgets.amount` / `recurring.amount` REAL → INTEGER、`recurring.fx_rate` REAL → TEXT、新增 `needs_attention` / `updated_at` / `source_recurring_id` / `scheduled_date` 與 partial unique index）屬破壞性 schema 變更；PR 描述將以繁體中文列出遷移步驟（見 [data-model.md §3 Migration](./data-model.md) 與 [quickstart.md §5](./quickstart.md)）。
  - API schema 變更與實作於同一 PR 更新契約，禁止「先實作後補契約」順序。

無憲章違反；[Complexity Tracking](#complexity-tracking) 記錄三項風險（CT-1、CT-2、CT-3）以利審查。

## Project Structure

### Documentation (this feature)

```text
specs/004-budgets-recurring/
├── plan.md                            # 本檔（/speckit.plan 產出）
├── research.md                        # Phase 0：技術決策與替代方案
├── data-model.md                      # Phase 1：資料表 schema 與 migration
├── quickstart.md                      # Phase 1：最短驗證流程
├── contracts/
│   └── budgets-recurring.openapi.yaml # Phase 1：本功能子契約（openapi: 3.2.0）
├── checklists/
│   └── requirements.md                # /speckit.specify 產出
├── spec.md                            # /speckit.specify + 3 輪 /speckit.clarify
└── tasks.md                           # Phase 2（/speckit.tasks 尚未產生）
```

### Source Code (repository root)

沿用 001 / 002 / 003 既有單體結構；本功能不新增頂層目錄、不新增 `lib/` 子模組（既有 `lib/moneyDecimal.js` / `taipeiTime.js` / `exchangeRateCache.js` 直接重用），所有邏輯皆於 `server.js` 與 `app.js` 內就地擴充：

```text
/（repo root）
├── server.js                          # 既有；本功能於下列區段擴充：
│                                      #  - initDatabase()：budgets/recurring 表
│                                      #    REAL → INTEGER 重建（同 002 模式）；
│                                      #    transactions 表 ALTER 新增 source_recurring_id
│                                      #    與 scheduled_date；建立 partial unique index
│                                      #    idx_tx_source_scheduled 與 idx_tx_source
│                                      #  - 新函式 processRecurringForUser(userId)：
│                                      #    抽出原 /api/recurring/process handler 邏輯
│                                      #    至共用函式；補時區、月底回退、條件式
│                                      #    last_generated 推進、需處理偵測
│                                      #  - 新函式 getNextRecurringDate(prevDate, freq)：
│                                      #    取代舊 getNextDate；FR-022 月底回退邏輯
│                                      #  - 既有 /api/auth/login、/api/auth/google、
│                                      #    /api/auth/passkey/login 三個登入 handler 內
│                                      #    呼叫 processRecurringForUser 同步觸發
│                                      #    （仿 003 backfillDefaultsForUser pattern）
│                                      #  - /api/budgets：補 PATCH 端點、used 改 twd_amount
│                                      #  - /api/recurring*：PUT 加分支邏輯（FR-021a/b/c）、
│                                      #    GET 補 needsAttention/nextDate 欄位
│                                      #  - /api/transactions GET：JOIN recurring 補
│                                      #    sourceRecurringId/sourceRecurringName 欄位
├── app.js                             # 既有；本功能擴充：
│                                      #  - renderBudget()：四段配色 + 月份切換器
│                                      #  - renderRecurring()：三日期卡片 + 待執行/需處理
│                                      #    色階分層 + 編輯對話框佔位下拉
│                                      #  - 交易列表行末「📌 來自配方」chip
│                                      #  - 移除原本 client-trigger /api/recurring/process
│                                      #    呼叫（line 554；改由 server-side 登入時觸發）
├── index.html                         # 既有；補預算月份 nav 與 recurring 卡片新欄位
├── style.css                          # 既有；新增進度條四段配色 class、recurring
│                                      #  卡片紅／橘／黃色階、來源 chip 樣式
├── openapi.yaml                       # 全站契約；本 PR 同步更新（見 Constitution
│                                      #  Check [II]）
├── lib/
│   ├── moneyDecimal.js                # 重用（不修改）
│   ├── taipeiTime.js                  # 重用（不修改）
│   └── exchangeRateCache.js           # 重用（不修改）
├── database.db                        # sql.js 持久化檔（gitignore）
├── package.json / package-lock.json   # **不新增任何 dependency**
├── Dockerfile / docker-compose.yml    # 不變
└── .env / .env.example                # 不新增環境變數
```

**Structure Decision**：完全沿用 single-project monolith；本功能不抽出 `lib/` 模組。理由：

1. **既有 budgets / recurring CRUD 已在 server.js 內**（行 5995–6115）；新增 `PATCH /api/budgets/{id}` 仍歸於同一路由群，邏輯量約 + 50 行。
2. **`processRecurringForUser` 為函式抽取**（從既有 `/api/recurring/process` handler 提煉），仍宿於 `server.js`；不另設 `lib/recurringProcessor.js` 因其體量 < 100 行且僅一處呼叫者（登入 handler ×3 + 手動觸發端點 ×1）。
3. **前端 budget / recurring 頁面在 `app.js` 已存在**；視覺擴充屬同檔案延續（單體 SPA 慣例）。
4. **001 / 002 / 003 已決議不採 `backend/` `frontend/` 拆分**；本功能延續以保持結構一致。

倉庫根的 `backend/`、`frontend/` 目錄為早期實驗，本功能不納入範圍（同 001 / 002 / 003 決策）。

## Complexity Tracking

### CT-1：transactions 表新增 `source_recurring_id` / `scheduled_date` 欄位與 partial unique index

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| 既有 `transactions` 表（rebuild 後 schema：server.js:1030–1049）含 18 欄但無「來源配方追溯」與「應產生日期」欄位；本功能規格 FR-025 ~ FR-028 要求衍生交易持久記錄 `source_recurring_id` 並對 `(source_recurring_id, scheduled_date)` 維持唯一性以保並發冪等。SQLite 支援 `ALTER TABLE … ADD COLUMN`（3.x+），不必重建表；但仍屬 schema breaking change，且要建 partial unique index。 | FR-025 明確要求「衍生交易 MUST 在資料模型中持久記錄 `source_recurring_id`」；FR-028 / FR-029 把「並發冪等」決議落到資料層唯一鍵 + 條件式更新（spec round 2 Q1 答 B）。沒有此欄位，並發產生流程的去重保證無從實作。 | **替代 1：以 `transactions.note` 編碼**（如 `note = '[recurring:abc123:2026-04-05]' + 原備註`）— 否決：(a) 字串解析脆弱；(b) 無法建唯一索引；(c) 違反「來源 chip 點擊跳轉」的 UI 需求（需穩定 ID 而非字串拆解）。**替代 2：另建關聯表 `recurring_emissions(recurring_id, scheduled_date, transaction_id)`** — 否決：(a) 多一張表的 join 成本；(b) 對「LEFT JOIN recurring 取 sourceRecurringName」 query 多 hop；(c) 插入失敗時錯誤處理變複雜（要 rollback 兩張表）。**替代 3：純應用層分散式鎖（Redis）** — 否決：使用者輸入明確禁止新增技術棧。 |

**Migration 策略**（詳見 [data-model.md §3.1](./data-model.md)）：

1. **同 PR 完成 schema 擴充**：
   ```sql
   ALTER TABLE transactions ADD COLUMN source_recurring_id TEXT DEFAULT NULL;
   ALTER TABLE transactions ADD COLUMN scheduled_date TEXT DEFAULT NULL;
   CREATE UNIQUE INDEX idx_tx_source_scheduled
     ON transactions(source_recurring_id, scheduled_date)
     WHERE source_recurring_id IS NOT NULL;
   CREATE INDEX idx_tx_source ON transactions(source_recurring_id);
   ```
2. **既有衍生交易「補回」處理**：升級前透過舊 `/api/recurring/process` 產出的歷史交易在 `note` 欄位有 ` (自動)` 後綴標記但無 `source_recurring_id`；本計畫**不**回填——`source_recurring_id` 對既有資料保留 NULL，未來新產出始有值。FR-027 在 `source_recurring_id` 為 NULL 時不顯示來源 chip（與「非配方產出之一般交易」同等對待），UI 不會誤標。
3. **回滾計畫**：migration 前自動備份至 `database.db.bak.<timestamp>.before-004`；sql.js 失敗時可手動還原備份檔。

### CT-2：budgets / recurring 表 REAL → INTEGER 重建 migration

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| 既有 `budgets.amount` / `recurring.amount` 為 REAL（server.js:670, 678）；002 已對 `transactions.amount` / `accounts.initial_balance` 完成 REAL → INTEGER 遷移以杜絕浮點漂移（server.js:1024–1101）；本功能 FR-003 規格明確要求預算金額為「正整數」，且為了讓 `GET /api/budgets` 的 `used = SUM(twd_amount)` 與 `amount` 進行整數比較不產生 round error，必須對 budgets / recurring 也對齊整數慣例。SQLite 不支援 `ALTER COLUMN`，需以 002 同款「建新表 → 複製 → 改名」方式。 | 不對齊會產生兩個立即可見的問題：(a) `pct = used / amount` 在 `amount = 1000.0` / `used = 999` 時前端可能顯示 `99.90000000000001%`；(b) `amount > 0` 驗證對 `0.5` 等小數無法守住規格意圖。長期還會造成 reviewer 在 `decimal.js` 與 REAL 之間來回轉換、增加維護成本。 | **替代 1：保留 REAL，靠應用層 `Math.round`** — 否決：違反 002 已建立的整數慣例與憲章 Constitution Check 一致性；reviewer 看到同類型欄位混用會質疑。**替代 2：以 TEXT 儲存 decimal 字串** — 否決：和 002 對 `transactions.amount` 的 INTEGER 決策不一致（002 將 fx_rate 存 TEXT 但 amount 存 INTEGER；本功能與 amount 同型才一致）。**替代 3：等下一版專案重整** — 否決：`GET /api/budgets` 的 `used = SUM(twd_amount)`（INTEGER）與 `b.amount`（REAL）相比的混型運算正在發生，越早對齊風險越低。 |

**Migration 策略**（詳見 [data-model.md §3.2](./data-model.md)）：與 002 完全相同模式（建 `_new` 表 → INSERT … SELECT CAST(ROUND(...) AS INTEGER) → DROP 舊表 → RENAME），以 `db.run('BEGIN' / 'COMMIT' / 'ROLLBACK')` 包裹；偵測 `typeof(amount) = 'real'` 才觸發 rebuild（冪等）。`recurring.fx_rate` 同步 REAL → TEXT 沿用 002 對 `transactions.fx_rate` 的轉換語法。

### CT-3：登入 handler 內同步觸發 `processRecurringForUser` 的延遲影響

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| 003 已在 `/api/auth/login` / `/api/auth/google` / `/api/auth/passkey/login` 三個登入 handler 內同步呼叫 `backfillDefaultsForUser(user.id)`（server.js:2522 / 2986 / 3075），其 P95 ≤ 200ms。本功能要在同一處再加一段 `processRecurringForUser(user.id)` 同步呼叫，依 SC-003「P95 ≤ 500ms（補 ≤ 30 筆時）」可接受，但若使用者長時間未登入（補 > 30 筆）會超出 SC-003 範圍進入 SC-004 領域；此時直接同步阻塞 HTTP response 會延長登入時間、可能觸發前端 timeout。 | 規格 FR-012 / SC-004 明確要求「登入時機」觸發產生流程且「不阻塞登入頁面」；SC-005 要求並發冪等（隱含必須有去重）。同步觸發是最簡單的實作；非同步觸發則要解決「使用者剛登入卻看不到剛產的交易」的 UX 問題。 | **替代 1：純非同步（fire-and-forget）** — 否決：使用者登入後 1 秒內進入儀表板，預算進度條與交易列表會「先看到舊資料、再看到新資料」造成閃爍；違反 SC-006「P95 ≤ 200ms」精神。**替代 2：放棄登入觸發、僅靠手動 `/api/recurring/process` 端點** — 否決：違反 FR-012 字面要求；使用者 UX 倒退。**替代 3：分散式 worker / cron** — 否決：使用者輸入禁止新增技術棧；單節點 sql.js 也不適合 cron 模式。 |

**緩解策略**（詳見 [research.md §3](./research.md)）：

1. **30 筆軟上限**：`processRecurringForUser(userId, options = { maxSync: 30 })`；同步處理前 30 筆，達上限後將剩餘配方推入 `setImmediate(() => processRecurringForUser(userId, { resume: true }))` 在當前 event loop 結束後續跑（仍同 process 內，sql.js 串行寫入仍序列；FR-028 唯一鍵保護仍生效於背景補產）。
2. **登入 handler error swallow**：`try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }`；產生流程失敗不阻擋登入成功（與 003 backfill 同模式）。
3. **量化監控**：`console.log` 補 `[004-recurring] generated=N elapsed=Tms userId=...` 便於日後驗證 SC-003 / SC-004 是否達標；不引入額外 monitoring stack。
