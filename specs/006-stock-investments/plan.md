# 實作計畫：股票投資（Stock Investments）

**Branch**: `006-stock-investments` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/006-stock-investments/spec.md`

## Summary

本計畫將 006 規格（**6 個 user story（P1×3 + P2×2 + P3×1）／37 base FR + 2 sub-FR（`a` 後綴：FR-024a / FR-035a）= 39 FR／4 輪 19 條 Clarification／7 SC**）落地至既有單體應用。**完全不引入新技術棧**：沿用 001 / 002 / 003 / 004 / 005 已建立的 Node.js 24+、Express 5、單一 `server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`）、sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI 3.2.0 契約、Chart.js 4.5.1（CDN，已 SRI 鎖版）、`decimal.js`、既有 TWSE 三段查價模組（`mis.twse.com.tw` / `STOCK_DAY` / `STOCK_DAY_ALL` / `TPEX`）、既有 `nextTwseTradingDay()` / `fetchTwseHolidaySet()` 等 utility；本功能**不引入任何新 npm 套件、不引入新前端 CDN 資源、不引入新外部 API、不新增獨立服務或 cron worker**（使用者明確要求：「使用目前專案現有的技術規格，不要新增任何技術規格」）。

既有實作（baseline）已涵蓋本功能約 **70% 表面**，本計畫主要工作為**將 19 條 clarification 的明確規範補入既有實作**並修補若干 spec 與 baseline 之間的行為差異：

- **Baseline 已實作**：
  - 5 張既有表 — `stocks`（含 `stock_type`）、`stock_transactions`、`stock_dividends`、`stock_settings`（per-user 費率）、`stock_recurring`（[server.js:883-949](../../server.js#L883)）。
  - FIFO 計算引擎（[server.js:7966-7991](../../server.js#L7966)）— 但目前用 `Number` 浮點，未用 `decimal.js`；手續費分攤採整數 `Math.round`，與 Pass 4 Q1（decimal.js 全精度）不符。
  - TWSE 三段查價（即時 / STOCK_DAY / TPEX）— 已存在 `updateUserStockPrices()`；但**並發無上限**、**失敗無重試**，與 Pass 4 Q3（並發上限預設 5 + 重試 2 次）不符。
  - `/api/stock-recurring/process` POST 端點（[server.js:7894-7950](../../server.js#L7894)）— 採 `while (scheduledDate <= todayS)` 迴圈補產生，符合 Pass 3 Q3「全補」決策；但**每期沿用 `current_price`**而非該期應觸發日的歷史股價，與 Pass 3 Q3 後半段不符；亦**由前端主動觸發**而非 FR-020 規定的「登入時 server-side 自動觸發」。
  - 自動同步除權息（[server.js:7720-7780](../../server.js#L7720)）— 已實作 `TWT49U` + `TWT49UDetail` 同步邏輯與「同除息日同股票跳過」去重；但**前端為純按鈕觸發無進度回饋**，與 Pass 2 Q1（阻擋式 Modal + 進度條 + 取消按鈕）不符。
  - 股利紀錄寫入帳戶餘額（已實作）— 但**未區分「純股票股利不寫帳戶」**，與 Pass 2 Q2 不符。
  - `calcStockFee()` / `calcStockTax()`（既有 helper）— 已用 `max(⌊金額 × 費率⌋, 最低值)` 模式（與 Pass 2 Q5 一致），但需 audit。
- **Baseline 未實作（本計畫補強）**：
  1. `stocks.delisted` 欄位 + 批次更新 Modal 的「標為已下市」checkbox（Pass 1 Q2）。
  2. **股票股利合成 $0 交易** — baseline 直接把 `stock_dividend_shares` 加到 `totalShares`（[server.js:7993](../../server.js#L7993)）但**未寫入 `stock_transactions`**，導致 FIFO 佇列缺乏該批 $0 cost lot；本計畫改為股利寫入時同步寫入合成 transaction（type='buy', price=0, shares=配發股數）（Pass 1 Q1 + Pass 2 Q3）。
  3. `stock_transactions.recurring_plan_id` + `period_start_date` 兩欄 + 唯一鍵 `(user_id, recurring_plan_id, period_start_date)` 用於 idempotency（Pass 3 Q5）。
  4. FR-013 賣出股數鏈式約束驗證（以該交易日當下持有為基準 + 任一時點持有 ≥ 0）（Pass 3 Q2）。
  5. FR-001 類型自動判定規則（00xx 4 碼 → ETF / 結尾字母或 6 碼以上 → 權證 / 其餘 → 一般）+ Modal 顯示並允許覆寫（Pass 3 Q1）。
  6. FR-008 代號驗證 — 改為「TWSE 查詢結果存在性」為主，前後端套 `^[0-9A-Za-z]{1,8}$` 防注入正則（Pass 3 Q4）。
  7. FR-005 過期 `current_price` fallback + ⚠ 24 小時 stale 標示（Pass 1 Q5）。
  8. FR-029 整體報酬率金額加權公式 + FR-003 持倉整體報酬率公式（Pass 2 Q4）。
  9. FR-027 同步除權息阻擋式 Modal + 進度條 + 取消按鈕（Pass 2 Q1）。
  10. FR-034 並發上限 `TWSE_MAX_CONCURRENCY` env var（預設 5）+ 指數退避重試 2 次（1s / 2s）（Pass 4 Q3）。
  11. FR-020 排程改為「登入時 server-side 觸發」（與 005 cron tick pattern 一致；目前由前端主動 POST，改為登入時 hook）。
  12. FR-021 補產生時每期使用「該期應觸發日的歷史股價」（透過既有 TWSE `STOCK_DAY` 歷史 API 查詢）。
  13. FR-030 FIFO 精度改用 `decimal.js` 全精度（per-share cost 保留小數，僅最終顯示時取整）（Pass 4 Q1）。
  14. FR-016 純股票股利不寫入帳戶餘額（區分現金股利金額 > 0 才寫帳戶）+ FR-015 入款帳戶 conditional required（Pass 2 Q2）。
  15. FR-018 股利刪除連動處理 — 刪股利時連動刪除合成 $0 交易 + 退回現金股利帳戶餘額（Pass 2 Q3）。
  16. UI：FR-003/FR-004/FR-029 損益 = 0 灰色顯示（三段式：綠 ▲ / 灰 / 紅 ▼）（Pass 4 Q4）。
  17. FR-029 「實現損益」獨立 Tab（baseline 無此 Tab）+ 彙總卡四個數字。
  18. FR-037 修改交易視為 atomic delete + insert（套用 FR-013 鏈式約束）（Pass 4 Q2）。

本計畫的工作可拆為 **12 大塊技術決策**（每一塊對應規格的若干 FR；落地細節見 [research.md](./research.md)）：

1. **Schema 補強**（[data-model.md](./data-model.md)）：
   - 為 `stocks` 加 `delisted INTEGER DEFAULT 0` 欄位（ALTER TABLE，冪等執行）。
   - 為 `stocks` 加 `last_quoted_at TEXT`（若不存在；目前用 `updated_at`，本計畫沿用、不新增）。
   - 為 `stock_transactions` 加 `recurring_plan_id TEXT`、`period_start_date TEXT` 兩欄；建唯一索引 `idx_stock_tx_idem (user_id, recurring_plan_id, period_start_date)` 僅當兩欄皆非空時生效（partial unique index，sql.js / SQLite 支援 `CREATE UNIQUE INDEX … WHERE`）。
   - 為 `stock_transactions` 補一個「股票股利合成交易」識別方式：採用 `note LIKE '%股票股利%'` 慣例（不引入新欄位、不變更 type 列舉，最小擾動 baseline）；spec 視為「`type='buy'` + `price=0` + 備註含『股票股利配發』」。

2. **股票類型自動判定**（FR-001 + Pass 3 Q1）：新增 helper `inferStockType(symbol)` 於 server.js；前端 Modal 輸入代號 → debounce 後呼叫 TWSE 查價 → 同步顯示自動判定的類型於下拉選單，使用者 MAY 覆寫。

3. **TWSE 代號格式驗證**（FR-008 + Pass 3 Q4）：前端與後端皆套 `^[0-9A-Za-z]{1,8}$` 正則（最小防注入 + ASCII 限制）；通過後送 TWSE 查價，**以查價結果是否成功**作為合法性最終判定（找不到 → 紅色提示「找不到此股票代號」；找到 → 綠色提示）。

4. **TWSE 查價並發 + 重試策略**（FR-034 + Pass 4 Q3）：
   - 新增 `lib/twseFetch.js` 內小型 helper `fetchWithRetry(url, options, retries=2)`（指數退避 1s/2s）— **位於既有 `lib/` 資料夾**（與 005 一致），不引入新 npm。
   - 並發控制以 `Promise.all` 配合 `chunk(arr, TWSE_MAX_CONCURRENCY)`（純 JS）；env var 預設 5。
   - 應用於：批次更新（`/api/stocks/batch-price`）、同步除權息（年份分批內部）、排程補產生（每期歷史股價查詢）、Modal 自動回填。

5. **股票股利合成交易寫入**（FR-016 + Pass 1 Q1 + Pass 2 Q3）：
   - `POST /api/stock-dividends` 與「同步除權息」寫入股利時，若 `stock_dividend_shares > 0`：同 transaction 內 `INSERT INTO stock_transactions (... type='buy', price=0, shares=配發股數, fee=0, tax=0, note='股票股利配發 + ' || 原備註, ...)`；spec 已定 type='buy'/price=0 等價於「股票股利」型。
   - `DELETE /api/stock-dividends/:id` 連動刪除：`DELETE FROM stock_transactions WHERE user_id=? AND stock_id=? AND date=? AND price=0 AND note LIKE '%股票股利配發%' AND ABS(shares - ?) < 0.001`（依 stock_id、date、shares 配發數匹配；夠唯一，不會誤刪）。
   - 退回現金股利帳戶餘額：baseline 透過寫入一筆 `transactions` 紀錄入帳，本計畫於刪除時連動刪除該對應 transaction（依 `note LIKE '%股票股利%'` 或新增 `linked_dividend_id` 欄位 — 採前者最小擾動）。

6. **賣出鏈式約束驗證**（FR-013 + Pass 3 Q2）：
   - 新增 helper `getSharesAtDate(userId, stockId, date)` — 計算該日當下累計持有（≤ date 的所有 buy + 股票股利配發 − sell）。
   - `POST /api/stock-transactions` 與 `PUT /api/stock-transactions/:id`（type='sell'）：先檢 該日持有 ≥ shares；通過後再檢「自該日起至今日的任一時點 ≥ 0」（透過 SQL 滾動計算所有 ≥ date 的交易），違反則 reject 並指出衝突日期。

7. **登入時自動觸發排程 + 補產生使用歷史股價**（FR-020 / FR-021 / FR-024a + Pass 3 Q3 + Pass 3 Q5）：
   - 在既有 login flow（[server.js login handler 區塊](../../server.js)）登入成功後**非同步**觸發 `processStockRecurring(userId)` 函式（不阻擋 login response，採 `setImmediate` fire-and-forget；錯誤不影響 login）。
   - 改寫既有 `/api/stock-recurring/process` POST 內邏輯（[server.js:7894-7950](../../server.js#L7894)）為共用 helper `processStockRecurring(userId)`：
     - 補產生迴圈時，每期從 TWSE `STOCK_DAY` 查詢該期應觸發日（順延後）的歷史收盤價；查詢失敗則該期跳過（不阻擋後續期數）。
     - INSERT 時加 `recurring_plan_id` + `period_start_date`，採 `INSERT OR IGNORE`；唯一鍵自然防止多裝置 race 重複扣款。
   - 保留 `/api/stock-recurring/process` POST 為「手動觸發」入口（向後兼容），同樣呼叫 `processStockRecurring(userId)`；但日常觸發改為登入 hook。

8. **同步除權息阻擋式 Modal**（FR-027 + Pass 2 Q1）：
   - **後端**：保留既有同步邏輯，但拆為「按年分段」端點 — `POST /api/stock-dividends/sync` 接受 query `?year=YYYY`；前端逐年呼叫並更新進度條。
   - **前端**：點下「同步除權息」按鈕 → 開啟阻擋式 Modal（CSS `.modal-blocking` 鎖頁面互動）→ 依使用者最早交易日 → 今日年份逐年呼叫；每年完成更新進度條（如「正在同步 2025 年（3/5 檔）」）。Modal 提供「取消」按鈕，按下後設 `aborted = true` 跳出迴圈、顯示部份完成 toast。
   - 完成後 Modal 自動關閉並 toast 顯示彙總（新增 N / 跳過 M / 失敗 K，三年數字加總）。

9. **整體報酬率金額加權公式**（FR-003 + FR-029 + Pass 2 Q4）：
   - `/api/stocks` response 加上 `portfolioSummary` 物件：`{ totalMarketValue, totalCost, totalPL, totalReturnRate }`；`totalReturnRate = round(totalPL / totalCost × 100, 2)`，`totalCost = 0` 時為 `null`（前端顯示「—」）。
   - 新增端點 `GET /api/stock-realized-pl`（已實現損益 Tab 資料源）：response 含每筆賣出的詳細 + 彙總 `{ totalRealizedPL, overallReturnRate, ytdRealizedPL, count }`；公式同金額加權。

10. **批次更新股價 Modal 補強**（FR-035a + Pass 1 Q2）：
    - Modal 每列加「標為已下市」checkbox（前端 `app.js`）。
    - 後端 `POST /api/stocks/batch-price` 接受 `{ updates: [{ stockId, currentPrice, delisted }, ...] }`；`delisted=true` 時設 `stocks.delisted=1` 並凍結 `current_price`；解除（false）則 `delisted=0`。
    - 所有 TWSE 查價路徑（自動回填、批次更新、同步除權息、排程補產生）皆 `WHERE delisted = 0` 過濾。

11. **24 小時陳舊資料 ⚠ 標示**（FR-004 + Pass 1 Q5）：
    - 個股卡片以 `(Date.now() - new Date(updatedAt).getTime()) > 86400000` 判斷套用 ⚠ 警示色（CSS `.stale-quote`）；不寫入後端、不變更 schema。

12. **損益 = 0 灰色 + ▲▼ 三段式顯色**（Pass 4 Q4）：
    - 既有顏色 helper（`positiveColor` / `negativeColor`）擴充 `neutralColor`（CSS `--color-neutral-text`）；UI 元件依 `value > 0 / === 0 / < 0` 三分支套色。

不引入新依賴的關鍵驗證：
- 所有 TWSE 查詢沿用既有 `lib/` 內既有 fetch helper；新增 `fetchWithRetry()` 為純 JS（無新 npm）。
- 並發控制以原生 `Promise.all` + `chunk()` 純 JS 實作。
- decimal.js 已在 baseline；FIFO 引擎重構為 decimal.js 全精度只是「換 API 型別」，不引入新依賴。
- 阻擋式 Modal 為純 CSS（`.modal-blocking { position: fixed; z-index: 9999; pointer-events: auto; }`）+ vanilla JS event handler；不引入新 UI library。

## Technical Context

**Language/Version**: Node.js 24.x（既有 `package.json` `engines.node: ">=24.0.0"`，不變）。
**Primary Dependencies**：
- Backend：Express 5.2.1、sql.js 1.14.1、decimal.js 10.4.3、jsonwebtoken 9.0.2、bcryptjs 3.0.3、helmet 8.1.0、express-rate-limit 8.4.0、cookie-parser 1.4.7、nodemailer 8.0.5、resend 6.12.2。**全部既有，本功能不變更 `package.json`**。
- Frontend：純 vanilla JS（IIFE 模組化）、Chart.js 4.5.1（CDN with SRI integrity）、decimal.js 10.4.3（CDN）；無框架、無打包工具。**全部既有，本功能不新增 CDN 條目**。
**Storage**：sql.js 記憶體執行 + `database.db` 檔案持久化（既有）；本功能於既有表 `stocks` / `stock_transactions` 補若干欄位（ALTER TABLE 冪等）+ 一個 partial unique index，**不新增任何表**。
**Testing**：手動驗證 + DevTools Network 面板（與 001 / 002 / 003 / 004 / 005 一致；無自動化測試框架）；以 [quickstart.md](./quickstart.md) 為驗證劇本。
**Target Platform**：自架 Linux 伺服器（Docker）+ Cloudflare 反向代理；瀏覽器端為 Chrome / Edge / Firefox 桌面版。
**Project Type**：單體 web service（單一 `server.js` + 根目錄 SPA）。
**Performance Goals**：
- SC-001：股票頁 ≤ 2 秒完整呈現（持股 ≤ 50 檔）。
- SC-002：交易 Modal 費用試算 ≤ 200ms 即時重算；TWSE 查價 ≤ 1.5 秒（90%）。
- SC-003：同步除權息 ≤ 30 秒（5 年歷史 + 20 檔）。
- SC-005：排程觸發 ≤ 3 秒（持股 < 50、排程 < 20，採非同步 fire-and-forget）。
**Constraints**：
- 不新增 npm 依賴（使用者明確要求）。
- 不新增前端 CDN 資源。
- 不新增外部 API（沿用 TWSE / TPEX 既有端點）。
- 不新增獨立服務或 cron worker（沿用登入時觸發 pattern）。
- 不刪除任何既有表 / 欄位（嚴守憲章 backward compatibility）。
**Scale/Scope**：個人記帳工具，預期使用者數 < 1000；單使用者持股 < 50 檔；單使用者交易筆數 < 5000；定期定額排程 < 20 筆。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.2.0:

- **[I] 繁體中文文件規範 Gate**：本計畫及其衍生產出（`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**`、未來的 `tasks.md`）皆以繁體中文（zh-TW）撰寫；原始碼識別字、外部 API/函式庫名稱（Express、sql.js、decimal.js、TWSE 端點名）、環境變數鍵（`TWSE_MAX_CONCURRENCY`）、commit message 前綴（`feat:` / `fix:` / `docs:`）不在此限。
  - **檢核結果**：✅ 通過。本檔案、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md) 主體皆為繁體中文；技術名詞與環境變數依例外條款保留英文。

- **[II] OpenAPI 3.2.0 契約 Gate**：
  - 本計畫新增端點：
    - `GET /api/stock-realized-pl`（已實現損益彙總 + 列表）
    - `POST /api/stock-dividends/sync`（單年份同步，前端逐年呼叫）
  - 修改既有端點：
    - `GET /api/stocks` 補 `portfolioSummary` 物件 + 補 `delisted` / `lastQuotedAt` 欄位
    - `POST /api/stocks` / `POST /api/stock-transactions` 補 `stockType` 自動判定回傳；POST /api/stocks 將 `name` 由 required 移除（FR-014 fallback 為「（未命名）」）
    - `PUT /api/stocks/:id` 補 stockType 修改入口（FR-001 末段；G3 修正）
    - `POST /api/stocks/batch-price` 補 `delisted` 欄位
    - `POST /api/stock-transactions` / `PUT /api/stock-transactions/:id` 補鏈式約束 400 錯誤訊息
    - `DELETE /api/stock-transactions/:id` 補列入契約（FR-017 + G6 修正）
    - `POST /api/stock-dividends` 補純股票股利情境（`accountId` 條件選填）
    - `DELETE /api/stock-dividends/:id` 補連動刪除說明
    - `POST /api/stock-recurring/process` 補 idempotency 行為（`recurring_plan_id` + `period_start_date`）
  - 新增列表頁分頁與批次刪除端點（FR-017 + FR-018；G1 / G2 修正）：
    - `GET /api/stock-transactions` 補 `page` / `pageSize` / `search` query + `{data, total, page, totalPages}` response
    - `GET /api/stock-dividends` 補同上 query + response
    - `POST /api/stock-transactions/batch-delete`、`POST /api/stock-dividends/batch-delete`
  - 新增批次查價 read-only 端點（FR-034；I2 修正）：
    - `POST /api/stocks/batch-fetch`（並發查 TWSE 但不寫入 DB；前端取得後讓使用者預覽 / 覆寫，最終透過 `batch-price` 寫入）
  - 已於 [contracts/stock-investments.openapi.yaml](./contracts/stock-investments.openapi.yaml) 宣告 `openapi: 3.2.0`。
  - 根目錄 `openapi.yaml` 將於同 PR 同步更新（version `4.26.0` → `4.27.0`，MINOR 非破壞性 — 僅新增端點與補欄位）。
  - 共用 schema：`PortfolioSummary` / `StockSummary` / `RealizedPLEntry` / `RealizedPLSummary` 以 `components.schemas` + `$ref` 表達；不重複內聯。
  - 認證：所有新端點皆需登入，已宣告 `security: [cookieAuth: []]`。
  - **檢核結果**：✅ 通過。

- **[III] Slash-Style HTTP Path Gate**：
  - 本計畫新增的 HTTP 路徑：
    - `/api/stock-realized-pl`（複數 + 斜線；無冒號）
    - `/api/stock-dividends/sync`（多字 sub-resource，但 `sync` 為單字無需 kebab-case）
  - **無**任何冒號自訂方法（如 `/api/stock-dividends:sync`）；**無**駝峰或底線。
  - Express 路由參數宣告 `:id`（合法；不是路徑分隔符）。
  - **檢核結果**：✅ 通過。

- **Development Workflow Gate**：
  - 已建立功能分支 `006-stock-investments`（透過 `speckit.git.feature` hook）。
  - 預計同步更新 `changelog.json`（新增 4.27.0 條目）與 `SRS.md`（補登新端點與 `stocks.delisted` 欄位）。
  - 無破壞性變更（既有 stock 相關端點皆向後兼容；新增欄位有預設值；新唯一索引為 partial 不影響舊資料）。
  - API 變更於同一 PR 更新契約：`openapi.yaml` 與 [contracts/stock-investments.openapi.yaml](./contracts/stock-investments.openapi.yaml) 同步維護。
  - **檢核結果**：✅ 通過。

無 Constitution 違反項目；**Complexity Tracking 表格留空**。

### Post-Design 重新檢核（Phase 1 完成後）

- [I]：✅ 所有 Phase 1 衍生文件以繁體中文撰寫；OpenAPI 描述以中文撰寫；技術名詞例外條款適用。
- [II]：✅ [contracts/stock-investments.openapi.yaml](./contracts/stock-investments.openapi.yaml) `openapi: 3.2.0` 字串完全相等；新端點皆有 `security`；共用 schema 以 `$ref` 表達。
- [III]：✅ 全檔案路徑斜線；`{id}` 為路由參數宣告（合法）；無冒號自訂方法。
- Workflow：✅ 計畫與契約同 PR 出貨。

## Project Structure

### Documentation (this feature)

```text
specs/006-stock-investments/
├── plan.md                                  # 本檔（/speckit.plan 產出）
├── research.md                              # Phase 0 產出
├── data-model.md                            # Phase 1 產出
├── quickstart.md                            # Phase 1 產出
├── contracts/
│   └── stock-investments.openapi.yaml       # Phase 1 產出（openapi: 3.2.0）
├── spec.md                                  # /speckit.specify + 4 輪 /speckit.clarify 產出（19 條）
└── tasks.md                                 # 由 /speckit.tasks 產出（非本指令）
```

### Source Code (repository root)

```text
（既有單體結構，本功能無新增資料夾、無新增頂層檔案）

server.js                                    # ~ 8,400 行單檔；本功能改動範圍：
                                             #  - L883 ~ L949（CREATE TABLE 區補 ALTER TABLE stocks ADD delisted；
                                             #    CREATE INDEX partial unique on (user_id, recurring_plan_id, period_start_date)；
                                             #    ALTER TABLE stock_transactions ADD recurring_plan_id / period_start_date）
                                             #  - L7818 ~ L7892（stock_recurring CRUD 不變）
                                             #  - L7894 ~ L7950（process 改為共用 helper processStockRecurring(userId)；
                                             #    每期改用歷史股價；INSERT 加 recurring_plan_id 兩欄；INSERT OR IGNORE）
                                             #  - L7960 ~ L8024（/api/stocks GET：FIFO 改 decimal.js 全精度；
                                             #    補 portfolioSummary；過濾 delisted 計算）
                                             #  - L8026 ~ L8070（/api/stocks POST/PUT/DELETE：補 stock_type 自動判定）
                                             #  - L8053 ~ L8063（/api/stocks/batch-price：接受 delisted 欄位）
                                             #  - L8240 ~ L8295（stock-transactions POST/PUT：賣出鏈式約束驗證；
                                             #    UPDATE 視為 atomic delete + insert）
                                             #  - L8328 ~ L8385（stock-dividends POST：純股票股利寫合成交易；
                                             #    DELETE：連動刪除合成交易 + 退帳戶餘額）
                                             #  - 新增（接續既有區塊）：
                                             #    - GET /api/stock-realized-pl
                                             #    - POST /api/stock-dividends/sync?year=YYYY
                                             #    - login handler 內 setImmediate(() => processStockRecurring(userId))
                                             #  - 既有 calcStockFee / calcStockTax 確認與 Pass 2 Q5 公式一致

lib/
├── moneyDecimal.js                          # 既有；本功能新增 calcFifoLots(transactions) 函式（T030 抽出）
│                                            #   - 匯出 { lots, totalShares, totalCost, realizedPL, sellEntries }
│                                            #   - 內部全程 Decimal 全精度；caller 自行決定取整時機
│                                            #   - /api/stocks GET 與 /api/stock-realized-pl GET 共用此 helper
├── twseFetch.js                             # 新增（位於既有 lib/，純 JS、不引入新 npm）：
│                                            #  - fetchWithRetry(url, options, retries=2) 指數退避 1s/2s
│                                            #  - chunk(arr, size) 純 JS
│                                            #  - inferStockType(symbol) 代號規則判定

app.js                                       # ~ 5,000 行單檔；本功能改動範圍：
                                             #  - 既有股票頁渲染函式擴充（持股總覽 + portfolioSummary）
                                             #  - 個股卡片補 ⚠ 24 小時 stale 標示與 last_quoted_at 顯示
                                             #  - 三段式顯色（綠 ▲ / 灰 / 紅 ▼）helper 套用
                                             #  - 交易 Modal 加 stockType 下拉（自動判定 + 覆寫）+ 即時費用試算
                                             #  - 股利 Modal accountId 條件 required（純股票股利時選填）
                                             #  - 批次更新 Modal 加「標為已下市」checkbox
                                             #  - 新增「實現損益」Tab + 渲染（呼叫 /api/stock-realized-pl）
                                             #  - 同步除權息按鈕改阻擋式 Modal + 進度條 + 取消按鈕
                                             #  - 代號輸入加防抖 debounce 500ms + 正則 ^[0-9A-Za-z]{1,8}$ 預過濾

index.html                                   # 既有，無變更

style.css                                    # 新增：
                                             #  - .modal-blocking（阻擋式 Modal 樣式）
                                             #  - .stale-quote（24 小時 ⚠ 警示色）
                                             #  - .pl-zero（損益 = 0 灰色）
                                             #  - .delisted-badge（已下市標示）
                                             #  - .progress-bar / .progress-bar-fill（同步進度條）

openapi.yaml                                 # 同 PR 更新：
                                             #  - info.version 4.26.0 → 4.27.0
                                             #  - 新增 /api/stock-realized-pl GET
                                             #  - 新增 /api/stock-dividends/sync POST
                                             #  - 補 portfolioSummary、delisted、lastQuotedAt 欄位
                                             #  - 補 stockType、recurring_plan_id 欄位

changelog.json                               # 同 PR 新增 4.27.0 條目（繁體中文描述）

SRS.md                                       # 同 PR 補登新端點與新欄位

CLAUDE.md                                    # 同 PR 更新「目前進行中的功能規劃」指向本計畫

.env.example                                 # 同 PR 新增 TWSE_MAX_CONCURRENCY=5 範例
```

**Structure Decision**：沿用 001 ~ 005 的單體結構（單一 `server.js` + 根目錄 SPA）。本功能**不新增**任何頂層資料夾、**不新增**任何 npm 套件、**不抽出**新模組（除既有 `lib/` 下新增小型 helper `lib/twseFetch.js` 一檔，與 005 的 `lib/moneyDecimal.js` 同層）；spec/plan/research/data-model/quickstart/contracts 衍生物落在 `specs/006-stock-investments/` 既有 Spec-Kit 結構下。前端 SPA 仍為單一 `app.js`，本功能於既有股票相關函式上擴充並新增「實現損益」Tab 渲染與同步進度 Modal。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

無違反項目。表格留空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |
