# 實作計畫：資料匯出匯入（Data Export / Import）

**Branch**: `007-data-export-import` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/007-data-export-import/spec.md`

## Summary

本計畫將 007 規格（**7 個 user story（P1×2 + P2×3 + P3×2）／46 base FR + 11 sub-FR（`a`~`d` 後綴）= 57 FR／18 條 Clarification／9 SC**）落地至既有單體應用。**完全不引入新技術棧**：沿用 001 / 002 / 003 / 004 / 005 / 006 已建立的 Node.js 24+、Express 5、單一 `server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`）、sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI 3.2.0 契約、`decimal.js`、既有 fxCache（`lib/exchangeRateCache.js`）、既有 TWSE 三段查價模組（`lib/twseFetch.js`）、既有 25 MB CSV JSON parser（`csvImportJsonParser`）、`CSV_IMPORT_MAX_ROWS = 20000` 上限、既有 `login_audit_logs` 表結構為新稽核表參考；本功能**不引入任何新 npm 套件、不引入新前端 CDN 資源、不引入新外部 API、不新增獨立服務或 cron worker**（使用者明確要求：「根據目前專案現有的技術規格，不可以新增任何技術規格」）。

既有實作（baseline）已涵蓋本功能約 **40% 表面**，本計畫主要工作為**將 18 條 clarification 的明確規範補入既有實作**，並修補 spec 與 baseline 之間的行為差異 + 新增 spec 中 baseline 完全未實作的部分（稽核日誌、API 授權頁、純伺服端匯出、轉帳配對演算法重寫、互斥鎖、進度回饋、ISO 4217 白名單、管理員下載確認彈窗、自動回滾還原、`before-restore` 保留策略、自動清理 cron）。

- **Baseline 已實作（需補強）**：
  - `POST /api/transactions/import`（[server.js:6456](../../server.js#L6456)）— 已有「自動建立缺項」與「轉帳兩兩配對」雛型，但**(a)** 配對演算法不支援多重候選消歧（FR-012），**(b)** 未包單一 DB transaction（FR-014a），**(c)** 未做 ISO 8601 嚴格驗證（FR-014b），**(d)** 未做六欄重複略過（FR-014），**(e)** 未做互斥鎖（FR-014c），**(f)** 未推送進度（FR-014d），**(g)** 未防 Formula Injection（FR-005），**(h)** 未做未知欄位 silent drop（FR-006a），**(i)** 未寫稽核日誌（FR-042~044）。
  - `POST /api/stock-transactions/import`（[server.js:8495](../../server.js#L8495)）— 已有「找或建立股票」雛型，但**(a)** 未做六欄重複略過（FR-023a），**(b)** 未包 DB transaction（FR-014a），**(c)** 名稱更新邏輯與 spec FR-021「`name` 欄位仍是代號才更新」一致（保留現狀），**(d)** 未做 ISO 8601 嚴格驗證（FR-014b），**(e)** 未做互斥鎖（FR-014c），**(f)** 未推送進度（FR-014d），**(g)** 未寫稽核日誌（FR-042~044）。
  - `POST /api/stock-dividends/import`（[server.js:8538](../../server.js#L8538)）— 已實作但**(a)** 完全未處理 `accountName`／`account` 欄位（FR-019、FR-023b），**(b)** 未做四欄重複略過（FR-023a），**(c)** 未做 ISO 8601 嚴格驗證，**(d)** 未做互斥鎖、未寫稽核日誌、未推送進度。
  - `GET /api/database/export` + `POST /api/database/import`（[server.js:8830](../../server.js#L8830)、[server.js:8845](../../server.js#L8845)）— 已驗證 SQLite header 與必要表（users / transactions / accounts / categories），備份目前資料庫至 `DB_PATH + '.backup_<ts>'`；但**(a)** 檔名格式為 `asset_backup_<ts>.db` 與 spec `assetpilot-backup-{YYYYMMDDHHmmss}.db` 不符（FR-024），**(b)** 未做下載前確認彈窗（FR-024a），**(c)** 必要表清單未含 stocks（FR-025），**(d)** 備份檔放在 `DB_PATH + '.backup_<ts>'` 而非 `backups/before-restore-{timestamp}.db` 子目錄（FR-026），**(e)** 還原失敗未自動回滾（FR-026a），**(f)** 無保留 5 份／90 天清理策略（FR-026b），**(g)** 一般使用者 RBAC 已套（管理員 only），未變動，**(h)** `.gitignore` 已含 `*.bak`（涵蓋部分），但需明示 `backups/` 資料夾排除（FR-028），**(i)** 未寫稽核日誌（FR-042~044）。
  - 匯率（`/api/exchange-rates`、`POST /api/exchange-rates/refresh`，[server.js:5531](../../server.js#L5531)~5650）— 已有 fxCache 跨使用者快取（`exchange_rates_global` 表 + `lib/exchangeRateCache.js`）、`is_manual` 欄位、`auto_update` 開關、付費版 API key 切換；但**(a)** 30 分鐘 TTL 需 audit `exchangeRateCache.js` 確認，**(b)** 無 ISO 4217 白名單前置驗證（FR-030），**(c)** 手動編輯無 ±20% 警告（FR-033a），**(d)** 「上次取得時間」精確到秒需 audit UI 顯示，**(e)** 匯率不在稽核表範圍內（spec FR-042 列舉項皆為匯出／匯入／備份／還原）。
  - 前端匯出（`app.js`：交易 [L6628](../../app.js#L6628)、分類 [L6665](../../app.js#L6665)、股票交易 [L4749](../../app.js#L4749)、股利 [L4763](../../app.js#L4763)）— **皆為純前端 client-side CSV 組裝**；本計畫改為「**前端發 GET 至伺服器、伺服器產 CSV stream 回傳**」以集中 Formula Injection 防護、ISO 8601 / hex 強制格式、稽核日誌寫入；前端僅保留下載觸發按鈕。

- **Baseline 未實作（本計畫補強）**：
  1. **稽核表 `data_operation_audit_log`**（FR-042~046b）— 全新表 + 寫入 helper `writeOperationAudit()` + 兩個查詢端點 + 一個保留期設定端點 + 一個保留期清理 cron tick + 「我的操作紀錄」分頁。
  2. **每使用者匯入互斥鎖**（FR-014c）— 純記憶體 `Set<userId>` + 進入 try / finally 釋放；server 重啟自動清空（無持久化需求）。
  3. **進度回饋通道**（FR-014d）— 採 short polling 簡化模型：匯入時先建立 `import_progress` 記憶體 `Map<userId, {processed, total, phase, startedAt}>`，後端每 500 筆更新一次；前端輪詢新端點 `GET /api/imports/progress` 每 1 秒讀取。**不採 SSE**（避免新增 mime / EventSource 邊界處理，符合「不新增技術規格」）。
  4. **CSV 格式嚴格驗證**（FR-014b、FR-015 顏色、FR-019 帳戶）— 純 regex（`^\d{4}-\d{2}-\d{2}$` + `Date.parse` 二次校驗、`^#[0-9A-Fa-f]{6}$`）。
  5. **重複偵測 hash key**（FR-014、FR-023a）— 以「日期 + 類型 + 分類 + 金額 + 帳戶 + 備註」六欄字串拼接（分隔符 ``）為 key；匯入前先查詢既有資料 + 已寫入本批的 set，命中則 skipped++。
  6. **轉帳配對演算法**（FR-012）— 改寫既有 `pendingTransferOut` 為「按日期 + 金額分組、組內以 CSV 順序兩兩配對、剩餘列入 warnings」三步驟。
  7. **`/api/transactions/export`、`/api/categories/export`、`/api/stock-transactions/export`、`/api/stock-dividends/export`** — 全新四支伺服端 GET 端點，產 CSV stream（`Content-Type: text/csv; charset=utf-8`、Content-Disposition `attachment; filename=...`、UTF-8 BOM 開頭）。
  8. **`/api/categories/import`** — 全新伺服端 POST 端點（baseline 為純前端 + 多次 POST `/api/categories`，不符 FR-014a 原子性）。
  9. **下載備份確認彈窗**（FR-024a）— 純前端 Modal；後端不變但檔名改為 `assetpilot-backup-{YYYYMMDDHHmmss}.db`。
  10. **還原前自動備份至 `backups/before-restore-{timestamp}.db`**（FR-026）— 後端建立 `backups/` 資料夾（若不存在），寫入備份。
  11. **還原失敗自動回滾**（FR-026a）— `try { 替換 db } catch { fs.copyFileSync(beforeRestorePath, DB_PATH); db = new SQL.Database(...) }` 模式；雙重失敗時於 server log + UI 同時顯示錯誤。
  12. **`before-restore-*.db` 保留 5 份 + 90 天清理**（FR-026b）— 每次寫入新檔後 `fs.readdirSync('backups')` 過濾排序、刪除超出限制者；管理員介面新增「自動備份清單」。
  13. **必要資料表清單擴充**（FR-025）— `requiredTables` 加入 `stocks`（既有為 `users / transactions / accounts / categories`）。
  14. **ISO 4217 白名單**（FR-030）— 新增 `lib/iso4217.js` 匯出 ~180 個代碼陣列；`PUT /api/exchange-rates` 與 `GET /api/exchange-rates/:currency` 前置驗證。
  15. **手動匯率 ±20% 警告**（FR-033a）— 純前端 UI 警告（後端不阻擋）；前端比對 `is_manual = false` 紀錄與 fxCache 快取項取得即時值。
  16. **API 授權頁**（FR-036~038）— 純前端頁面 + 一份靜態 JSON `lib/external-apis.json`（IPinfo 條目含 `IP address data is powered by IPinfo` 字樣）；不變更後端。
  17. **稽核日誌保留期設定**（FR-046a）— 新增 `system_settings` 鍵 `audit_log_retention_days`（值：30/90/180/365/'forever'，預設 90）；既有 `registerAuditPruneJob()`（[server.js:4832](../../server.js#L4832)）擴充清理範圍至 `data_operation_audit_log`。
  18. **稽核日誌查詢端點**（FR-045、FR-046b）— `GET /api/admin/data-audit`（管理員，含 user_id/action/時間/result 過濾）+ `GET /api/user/data-audit`（一般使用者，固定以登入者 ID 過濾）。
  19. **稽核日誌清空與 CSV 匯出**（FR-046a）— `GET /api/admin/data-audit/export` 產 CSV、`POST /api/admin/data-audit/purge` 清空。
  20. **`.gitignore` / `.dockerignore` 補規則**（FR-028）— 加入 `backups/` 路徑（既有 `*.bak`、`*.db.bak`、`*.backup_*` 涵蓋部分但子目錄需明示）。

本計畫的工作可拆為 **10 大塊技術決策**（每一塊對應規格的若干 FR；落地細節見 [research.md](./research.md)）：

1. **Schema 補強**（[data-model.md](./data-model.md)）：
   - 新增表 `data_operation_audit_log`（10 欄；含 metadata JSON）+ 三個索引（`user_id` / `timestamp DESC` / `action`）。
   - 新增 `system_settings` 表（若不存在；採 KV 模型）並寫入 `audit_log_retention_days = '90'` 預設。本表已於 005 / 006 規格未引入；本計畫採 `CREATE TABLE IF NOT EXISTS` 冪等建立。
   - 既有表（transactions / categories / accounts / stocks / stock_transactions / stock_dividends / exchange_rates / users）**完全不變更**。

2. **稽核日誌寫入 helper**（FR-042~044）：
   - 於 server.js 新增 `writeOperationAudit({ userId, role, action, ipAddress, userAgent, result, isAdminOperation, metadata })` 函式；參數 `metadata` 為 plain object，內部 `JSON.stringify` 寫入；寫入失敗 try/catch 不阻擋主操作（FR-044）。
   - 所有匯出／匯入／備份／還原端點（共 11 支）於 response 前呼叫該 helper。

3. **匯入互斥鎖 + 進度回饋**（FR-014c、FR-014d）：
   - `const importLocks = new Set()` 模組級 Set；`acquireImportLock(userId)` / `releaseImportLock(userId)` 兩個 helper；try/finally 釋放鎖；server 重啟自動清空。
   - `const importProgress = new Map()` 模組級 Map；key 為 userId、value 為 `{ processed, total, phase, startedAt, completedAt }`；匯入過程每 500 筆 `set(userId, {...})`；前端輪詢 `GET /api/imports/progress` 取得目前狀態（無進行中時回 `{ active: false }`）。
   - 第二個並行請求 → `acquireImportLock` 失敗 → 回 HTTP 409 `{ error: 'IMPORT_IN_PROGRESS' }`。

4. **CSV 解析強化**（FR-006a、FR-014b、FR-015）：
   - 既有匯入採 client-side parse + JSON body 上傳模型（rows 陣列已預解析）；本計畫**保持此模型不變**（避免引入 multer / busboy 等新依賴）。
   - 前端解析時依「第一行欄位名稱」做欄位對應（既有實作已部分對應），未識別欄位 silent drop；伺服端再次驗證必要欄位是否齊全（缺則 400）。
   - 伺服端對每筆 row 執行：
     - 日期：regex `^\d{4}-\d{2}-\d{2}$` + `Date.parse` 不為 NaN 才合法；其他格式直接列為 errors。
     - 顏色（分類匯入）：regex `^#[0-9A-Fa-f]{6}$`。
     - 金額：`Number.parseFloat` + 有限值 + > 0。
     - 帳戶（股利匯入）：現金股利 > 0 時 必填，否則可空（FR-019）。

5. **轉帳配對演算法**（FR-012）：
   - 重寫 `/api/transactions/import` 中段：先按 `${date}|${amount}` 分組，每組分轉出 / 轉入兩 List；以 CSV 順序兩兩配對寫 `linked_id`；剩餘列入 `warnings: [{ row, type: 'unpaired_transfer', reason }]`。
   - 寫入順序：先寫所有交易（含轉帳），最後一輪 UPDATE `linked_id`；所有寫入包覆於同一 DB transaction（FR-014a）。

6. **重複偵測 hash key**（FR-014、FR-023a）：
   - 交易匯入：`makeTxHash(date, type, categoryId, amount, accountId, note)` 字串 join；查詢既有交易得 set + 寫入時新增本批 set。
   - 股票交易匯入：`makeStockTxHash(date, symbol, type, shares, price, accountId)`。
   - 股利匯入：`makeDividendHash(date, symbol, cashDividend, stockDividend)`。
   - 命中即 skipped++ 不寫入。

7. **匯出端點群（純伺服端）**（FR-001~005、FR-015、FR-018、FR-019）：
   - 新增 4 個 GET 端點：
     - `GET /api/transactions/export?dateFrom=&dateTo=` → 匯出交易 CSV。
     - `GET /api/categories/export` → 匯出分類 CSV（含父子順序：父在前、子在後）。
     - `GET /api/stock-transactions/export?dateFrom=&dateTo=` → 匯出股票交易 CSV。
     - `GET /api/stock-dividends/export?dateFrom=&dateTo=` → 匯出股利 CSV（含帳戶欄位）。
   - 共用 helper `formulaInjectionEscape(value)`：以 `=` / `+` / `-` / `@` 開頭的字串前置 `'`；非字串原樣輸出；於 CSV row 組裝前套用。
   - 共用 helper `csvCell(value)`：含逗號 / 引號 / 換行的字串以雙引號包覆；雙引號內部加倍。
   - response header：`Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment; filename="..._<YYYYMMDD>.csv"`、body 開頭加 UTF-8 BOM (`﻿`)。
   - 匯出後同步呼叫 `writeOperationAudit({ action: 'export_*', result: 'success', metadata: { rows, byteSize } })`。

8. **管理員備份／還原強化**（FR-024、FR-024a、FR-025、FR-026、FR-026a、FR-026b、FR-027、FR-028）：
   - **下載端點**：`/api/database/export` 改檔名為 `assetpilot-backup-{YYYYMMDDHHmmss}.db`（一行字串 format 改動）；保留現有 magic header / RBAC；前端按下「下載備份」時先 open 確認 Modal，按下「確認下載」才觸發 GET（純前端 modal）；伺服端不需改動 RBAC（既有 `isUserAdmin(req.userId)` 維持）。
   - **還原端點**：`/api/database/import` 行為改寫：
     - 必要表清單擴充 `users / transactions / accounts / categories / stocks`（加 stocks）。
     - 通過驗證後，於 `backups/` 子目錄寫入 `before-restore-{timestamp}.db`（`fs.mkdirSync('backups', { recursive: true })`、`fs.writeFileSync(...)`）。
     - 替換主資料庫 try/catch：失敗時呼叫 `restoreFromBackup(beforeRestorePath)` 將 `before-restore-{timestamp}.db` 內容寫回 `DB_PATH` + 重新 `new SQL.Database()`；雙重失敗則拋例外、UI 顯示 `"還原失敗，主資料庫狀態未知，請聯繫管理員"`。
     - 寫入新檔後立即呼叫 `pruneBeforeRestoreBackups()`：列出 `backups/before-restore-*.db`、按 mtime 排序、保留最近 5 份且 mtime 距今 ≤ 90 天的、其餘 `fs.unlinkSync()`；刪除事件 `console.log` 結構化 log + 寫稽核日誌。
   - **管理員備份清單端點**：新增 `GET /api/admin/backups`（列出 `backups/` 內 `before-restore-*.db` 與 `assetpilot-backup-*.db` 名單 + 大小 + mtime）+ `DELETE /api/admin/backups/:filename`（管理員手動刪除，路徑遍歷防護以 `path.basename` 強制扁平化）。
   - **`.gitignore` / `.dockerignore`**：加入 `backups/` 一行（既有 `*.bak` 規則僅涵蓋根目錄 `*.bak` 檔，未涵蓋子目錄內的 `.db`，需明示）。

9. **匯率 ISO 4217 白名單 + ±20% 警告**（FR-030、FR-033a）：
   - 新增 `lib/iso4217.js`：純 JS 模組 export `const ISO_4217_CODES = ['USD', 'EUR', 'JPY', ...]`（~180 條）+ `isValidCurrency(code)` 函式。
   - 既有 `PUT /api/exchange-rates`（[server.js:5556](../../server.js#L5556)）與 `GET /api/exchange-rates/:currency` 加入前置驗證 → 非白名單即 400 `{ error: '不是有效的 ISO 4217 幣別代碼' }`。
   - 前端「新增幣別」UI 改用下拉選單（白名單值清單）；輸入值即時比對。
   - **±20% 警告**：純前端 UI（手動編輯欄位 onChange 時，與 fxCache 內最近一次 `is_manual = false` 紀錄比對；偏差 > 20% 顯示黃色警告含建議值；提供「確認儲存」按鈕；後端不變）。

10. **API 授權頁 + UI 整合**（FR-036~038）：
    - 新增 `lib/external-apis.json`（靜態資料；含 5 條目 + 各自 attribution）。
    - 新增端點 `GET /api/external-apis`（讀取靜態 JSON 回傳；無需認證；附 cache-control `max-age=3600`）。
    - 前端側邊欄新增「API 使用與授權」入口；頁面 fetch 該端點並渲染條目；IPinfo 條目顯示 `IP address data is powered by IPinfo` 字樣。

不引入新依賴的關鍵驗證：
- CSV 解析 / 組裝 / Formula Injection 防護皆為純 JS（`String.prototype.startsWith`、`replace`、template literal）；不引入 csv-parser / papa-parse 等。
- 進度回饋採 short polling（前端 setInterval 1s、後端純 Map）；不引入 SSE 或 WebSocket（新依賴）。
- 互斥鎖採 `Set<userId>`；server 重啟自動清空，不需 Redis / DB lock。
- 稽核日誌清理沿用既有 `registerAuditPruneJob()` 的 setInterval 24h 模式（[server.js:4832](../../server.js#L4832)），不新增 cron worker。
- 還原備份檔以 `fs.readdirSync` + `fs.unlinkSync` 純 JS 處理；不引入 fs-extra。
- ISO 4217 為純 JS array literal；不引入 currency.js 等。

## Technical Context

**Language/Version**: Node.js 24.x（既有 `package.json` `engines.node: ">=24.0.0"`，不變）。
**Primary Dependencies**：
- Backend：Express 5.2.1、sql.js 1.14.1、decimal.js 10.4.3、jsonwebtoken 9.0.2、bcryptjs 3.0.3、helmet 8.1.0、express-rate-limit 8.4.0、cookie-parser 1.4.7、cors 2.8.5、nodemailer 8.0.5、resend 6.12.2、@passwordless-id/webauthn 2.3.5、adm-zip 0.5.17、dotenv 17.4.2。**全部既有，本功能不變更 `package.json`**。
- Frontend：純 vanilla JS（IIFE 模組化）、Chart.js 4.5.1（CDN with SRI integrity）、decimal.js 10.4.3（CDN）；無框架、無打包工具。**全部既有，本功能不新增 CDN 條目**。
**Storage**：sql.js 記憶體執行 + `database.db` 檔案持久化（既有）；本功能新增 1 張表（`data_operation_audit_log`）+ 1 張表 `system_settings`（若不存在；冪等 `CREATE TABLE IF NOT EXISTS`）+ 3 個 index；既有所有表完全不變更。`backups/` 子目錄為新檔案系統路徑（`fs.mkdirSync({ recursive: true })`）。
**Testing**：手動驗證 + DevTools Network 面板（與 001 / 002 / 003 / 004 / 005 / 006 一致；無自動化測試框架）；以 [quickstart.md](./quickstart.md) 為驗證劇本。
**Target Platform**：自架 Linux 伺服器（Docker）+ Cloudflare 反向代理；瀏覽器端為 Chrome / Edge / Firefox 桌面版。
**Project Type**：單體 web service（單一 `server.js` + 根目錄 SPA）。
**Performance Goals**：
- SC-001：5,000 筆交易匯出（從點擊到下載開始）≤ 5 秒（90 百分位）。
- SC-002：1,000 筆交易（含 100 對轉帳）匯入（從上傳完成到顯示彙總）≤ 30 秒（90 百分位）；進度文字至少每 500 筆更新一次。
- SC-005：匯率快取命中（30 分鐘內第二次請求）≤ 100 ms。
- SC-006：50 MB SQLite 資料庫還原 ≤ 60 秒；`backups/before-restore-*.db` 100% 存在。
**Constraints**：
- 不新增 npm 依賴（使用者明確要求）。
- 不新增前端 CDN 資源。
- 不新增外部 API（沿用既有 exchangerate-api.com / ipinfo / TWSE / Google / Resend）。
- 不新增獨立服務或 cron worker（稽核日誌清理沿用 005 既有 `registerAuditPruneJob()` 的 setInterval 模式）。
- 不刪除任何既有表 / 欄位（嚴守憲章 backward compatibility）。
- 進度回饋採 short polling（不引入 SSE）。
- 匯入採同步阻塞（不引入背景 job 架構）。
**Scale/Scope**：個人記帳工具，預期使用者數 < 1000；單次匯入上限 20000 筆 / 25 MB；單檔備份 ≤ 100 MB。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.2.0：

- **[I] 繁體中文文件規範 Gate**：本計畫及其衍生產出（`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/**`、未來的 `tasks.md`）皆以繁體中文（zh-TW）撰寫；原始碼識別字、外部 API/函式庫名稱（Express、sql.js、decimal.js、exchangerate-api.com、IPinfo、TWSE 端點名）、環境變數鍵（`EXCHANGE_RATE_API_KEY`、`TWSE_MAX_CONCURRENCY`）、commit message 前綴（`feat:` / `fix:` / `docs:`）不在此限。
  - **檢核結果**：✅ 通過。本檔案、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md) 主體皆為繁體中文；技術名詞與環境變數依例外條款保留英文。

- **[II] OpenAPI 3.2.0 契約 Gate**：
  - 本計畫新增端點：
    - `GET /api/transactions/export`（純伺服端產 CSV）
    - `GET /api/categories/export`（純伺服端產 CSV）
    - `POST /api/categories/import`（原子化匯入分類）
    - `GET /api/stock-transactions/export`（純伺服端產 CSV）
    - `GET /api/stock-dividends/export`（純伺服端產 CSV）
    - `GET /api/imports/progress`（short polling 進度查詢）
    - `GET /api/admin/data-audit`（管理員稽核日誌列表）
    - `GET /api/user/data-audit`（一般使用者「我的操作紀錄」）
    - `GET /api/admin/data-audit/export`（管理員匯出稽核日誌 CSV）
    - `POST /api/admin/data-audit/purge`（管理員清空稽核日誌）
    - `PUT /api/admin/data-audit/retention`（管理員設定保留天數）
    - `GET /api/admin/data-audit/retention`（讀取目前保留天數設定）
    - `GET /api/admin/backups`（列出備份檔清單）
    - `DELETE /api/admin/backups/:filename`（管理員手動刪除備份檔）
    - `GET /api/external-apis`（API 使用與授權清單）
  - 修改既有端點：
    - `POST /api/transactions/import` 補欄位（mutex 409、進度回饋、ISO 8601 嚴格、原子性）；response shape 補 `warnings`；錯誤項補 `row`。
    - `POST /api/stock-transactions/import` 同上。
    - `POST /api/stock-dividends/import` 同上 + 必填 `accountName`（現金股利 > 0 時）。
    - `POST /api/database/import` 補 `before-restore` 自動備份說明 + 自動回滾 422 錯誤碼。
    - `GET /api/database/export` 檔名格式變更（`assetpilot-backup-{YYYYMMDDHHmmss}.db`）。
    - `PUT /api/exchange-rates` 補 ISO 4217 白名單驗證 400 錯誤碼。
  - 已於 [contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml) 宣告 `openapi: 3.2.0`。
  - 根目錄 `openapi.yaml` 將於同 PR 同步更新（version `4.27.0` → `4.28.0`，MINOR 非破壞性 — 僅新增端點與補欄位）。
  - 共用 schema：`ImportSummary` / `ImportProgress` / `DataOperationAuditLog` / `ExternalApiEntry` / `BackupFileInfo` 以 `components.schemas` + `$ref` 表達；不重複內聯。
  - 認證：除 `GET /api/external-apis` 為公開（cache-able）外，所有新端點皆需登入，已宣告 `security: [cookieAuth: []]`；管理員端點 metadata 標記 `x-required-role: admin`。
  - **檢核結果**：✅ 通過。

- **[III] Slash-Style HTTP Path Gate**：
  - 本計畫新增的所有 HTTP 路徑：
    - `/api/transactions/export`
    - `/api/categories/export`
    - `/api/categories/import`
    - `/api/stock-transactions/export`
    - `/api/stock-dividends/export`
    - `/api/imports/progress`
    - `/api/admin/data-audit`
    - `/api/admin/data-audit/export`
    - `/api/admin/data-audit/purge`
    - `/api/admin/data-audit/retention`
    - `/api/user/data-audit`
    - `/api/admin/backups`
    - `/api/admin/backups/:filename`（Express 路由參數，合法）
    - `/api/external-apis`
  - **無**任何冒號自訂方法（如 `/api/data-audit:purge`）；**無**駝峰或底線。
  - 多字動詞使用 kebab-case（`data-audit` / `external-apis`）。
  - **檢核結果**：✅ 通過。

- **Development Workflow Gate**：
  - 已建立功能分支 `007-data-export-import`（透過 `speckit.git.feature` hook）。
  - 預計同步更新 `changelog.json`（新增 4.28.0 條目）與 `SRS.md`（補登新端點與 `data_operation_audit_log` 表）。
  - 無破壞性變更（既有匯入端點皆向後兼容；新增欄位有預設值；所有變動皆為「新增」或「行為強化」非「移除」；備份檔名格式變更屬內部生成檔名，無對外 client 訂閱）。
  - API 變更於同一 PR 更新契約：`openapi.yaml` 與 [contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml) 同步維護。
  - **檢核結果**：✅ 通過。

無 Constitution 違反項目；**Complexity Tracking 表格留空**。

### Post-Design 重新檢核（Phase 1 完成後）

- [I]：✅ 所有 Phase 1 衍生文件以繁體中文撰寫；OpenAPI 描述以中文撰寫；技術名詞例外條款適用。
- [II]：✅ [contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml) `openapi: 3.2.0` 字串完全相等；新端點皆有 `security`（公開的 `/api/external-apis` 例外明示宣告）；共用 schema 以 `$ref` 表達。
- [III]：✅ 全檔案路徑斜線；`{filename}` 為路由參數宣告（合法）；無冒號自訂方法。
- Workflow：✅ 計畫與契約同 PR 出貨。

## Project Structure

### Documentation (this feature)

```text
specs/007-data-export-import/
├── plan.md                                    # 本檔（/speckit.plan 產出）
├── research.md                                # Phase 0 產出
├── data-model.md                              # Phase 1 產出
├── quickstart.md                              # Phase 1 產出
├── contracts/
│   └── data-export-import.openapi.yaml        # Phase 1 產出（openapi: 3.2.0）
├── checklists/                                # /speckit.checklist 產出（既有；本計畫不變動）
├── spec.md                                    # /speckit.specify + /speckit.clarify 產出（18 條）
└── tasks.md                                   # 由 /speckit.tasks 產出（非本指令）
```

### Source Code (repository root)

```text
（既有單體結構，本功能無新增資料夾、無新增頂層檔案；新增者皆位於既有資料夾）

server.js                                      # ~ 8,942 行單檔；本功能改動範圍：
                                               #  - L393~L407（CSV 上傳上限定義不變；本計畫沿用）
                                               #  - L549~L560（既有 login_audit_logs 表結構為新表參考）
                                               #  - 新增 CREATE TABLE IF NOT EXISTS data_operation_audit_log + 3 個 index
                                               #  - 新增 CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)
                                               #    + INSERT OR IGNORE INTO system_settings (key, value) VALUES ('audit_log_retention_days', '90')
                                               #  - L4832 ~ L4870（registerAuditPruneJob）擴充清理範圍至 data_operation_audit_log
                                               #  - L5531 ~ L5650（exchange_rates 端點）補 ISO 4217 白名單驗證
                                               #  - L6456 ~ L6586（/api/transactions/import）改寫：
                                               #     - 包覆於 db.run('BEGIN') ... 'COMMIT' / ROLLBACK
                                               #     - 加入 acquireImportLock(userId)（409 IMPORT_IN_PROGRESS）
                                               #     - 加入 importProgress.set(...) 每 500 筆推送
                                               #     - 加入 ISO 8601 嚴格驗證
                                               #     - 加入六欄重複偵測 hash + skipped++
                                               #     - 重寫轉帳配對：按 (date, amount) 分組 + 順序兩兩配對 + 剩餘列入 warnings
                                               #     - 加入 writeOperationAudit({ action: 'import_transactions', ... })
                                               #  - L8495 ~ L8535（/api/stock-transactions/import）同上強化
                                               #  - L8538 ~ L8571（/api/stock-dividends/import）同上強化 + 加入 accountName 必填邏輯
                                               #  - L8830 ~ L8843（/api/database/export）改檔名為 assetpilot-backup-{YYYYMMDDHHmmss}.db
                                               #     + 加入 writeOperationAudit({ action: 'download_backup', isAdminOperation: true, ... })
                                               #  - L8845 ~ L8897（/api/database/import）改寫：
                                               #     - requiredTables 加 stocks
                                               #     - 備份目錄改為 backups/before-restore-{ts}.db
                                               #     - 替換失敗 try/catch 自動回滾
                                               #     - pruneBeforeRestoreBackups()
                                               #     - writeOperationAudit({ action: 'restore_backup', ... }) 含 success/failed/rolled_back
                                               #  - 新增（接續既有區塊）：
                                               #    - GET /api/transactions/export?dateFrom=&dateTo=
                                               #    - GET /api/categories/export
                                               #    - POST /api/categories/import
                                               #    - GET /api/stock-transactions/export
                                               #    - GET /api/stock-dividends/export
                                               #    - GET /api/imports/progress
                                               #    - GET /api/admin/data-audit
                                               #    - GET /api/admin/data-audit/export
                                               #    - POST /api/admin/data-audit/purge
                                               #    - GET /api/admin/data-audit/retention
                                               #    - PUT /api/admin/data-audit/retention
                                               #    - GET /api/user/data-audit
                                               #    - GET /api/admin/backups
                                               #    - DELETE /api/admin/backups/:filename
                                               #    - GET /api/external-apis
                                               #  - 新增模組級 helper：
                                               #    - importLocks: Set<string>（user_id）
                                               #    - importProgress: Map<string, { processed, total, phase, startedAt, completedAt }>
                                               #    - acquireImportLock(userId) / releaseImportLock(userId)
                                               #    - writeOperationAudit({ ... })
                                               #    - formulaInjectionEscape(value) / csvCell(value)
                                               #    - isValidIso8601Date(s) / isValidHexColor(s)
                                               #    - makeTxHash / makeStockTxHash / makeDividendHash
                                               #    - pruneBeforeRestoreBackups()

lib/
├── exchangeRateCache.js                       # 既有；本功能不變動（30 分鐘 TTL audit + UI 顯示秒精確）
├── moneyDecimal.js                            # 既有；本功能不變動
├── taipeiTime.js                              # 既有；本功能不變動
├── twseFetch.js                               # 既有；本功能不變動
├── iso4217.js                                 # 新增（純 JS）：
│                                              #  - export const ISO_4217_CODES = ['USD', 'EUR', 'JPY', ...] (~180)
│                                              #  - export function isValidCurrency(code) { ... }
└── external-apis.json                         # 新增（靜態資料）：
                                               #  - 5 條目（exchangerate-api、IPinfo、TWSE、Google Identity、Resend）
                                               #  - IPinfo 條目 attribution 字串為 'IP address data is powered by IPinfo'
                                               #  - 結構：[{ name, description, url, attribution? }]

backups/                                       # 新增子目錄（執行期 fs.mkdirSync({ recursive: true })）
                                               #  - 用於存放 before-restore-{timestamp}.db 自動備份
                                               #  - .gitignore / .dockerignore 加入此目錄

app.js                                         # ~ 8,600 行單檔；本功能改動範圍：
                                               #  - 移除既有 client-side 匯出實作（交易 L6628 / 分類 L6665 / 股票交易 L4749 / 股利 L4763）
                                               #    改為 fetch GET 端點 → 觸發 download（沿用既有 downloadCsv 工具但接收伺服器回傳 Blob）
                                               #  - 既有匯入流程：
                                               #     - 上傳前先檢查 /api/imports/progress；若 active 則禁用按鈕
                                               #     - 上傳後啟動 setInterval 每 1 秒輪詢 /api/imports/progress 更新進度條
                                               #     - 完成（active = false）停止輪詢、顯示完成 Modal（含 warnings 列表）
                                               #  - 下載備份按鈕加入確認 Modal（FR-024a 警告字串）
                                               #  - 還原失敗 422 自動回滾 → UI 顯示對應訊息
                                               #  - 匯率設定頁：新增幣別改下拉選單（白名單）；手動編輯欄位 onChange 偏離 ±20% 顯示黃色警告
                                               #  - 新增「API 使用與授權」頁面（fetch /api/external-apis 渲染）
                                               #  - 新增管理員「自動備份清單」頁面（fetch /api/admin/backups 渲染 + 手動刪除）
                                               #  - 新增管理員「稽核日誌」分頁（過濾 / 分頁 / 詳情展開 / CSV 匯出 / 清空 / 保留天數設定）
                                               #  - 新增一般使用者「我的操作紀錄」分頁（同管理員 UI 但僅顯示自己的紀錄）

index.html                                     # 新增頁面區塊：
                                               #  - 「API 使用與授權」頁面容器
                                               #  - 管理員「稽核日誌」分頁容器（位於管理員設定頁內）
                                               #  - 管理員「自動備份清單」分頁容器
                                               #  - 一般使用者「我的操作紀錄」分頁容器（位於個人設定頁內）
                                               #  - 「下載備份」前的確認 Modal
                                               #  - 「匯入進度條」Modal（顯示 phase + processed/total）

style.css                                      # 新增：
                                               #  - .modal-confirm-warning（下載備份 / 清空稽核日誌 確認 Modal）
                                               #  - .audit-log-table（稽核日誌列表表格）
                                               #  - .audit-log-row-detail（metadata JSON 展開區塊樣式）
                                               #  - .progress-bar / .progress-bar-fill（既有 006 已新增則重用）
                                               #  - .rate-deviation-warning（手動匯率 ±20% 警告色塊）

openapi.yaml                                   # 同 PR 更新：
                                               #  - info.version 4.27.0 → 4.28.0
                                               #  - 新增 15 個端點（見 Constitution Check Gate II）
                                               #  - 修改 6 個既有端點（見 Constitution Check Gate II）
                                               #  - 新增共用 schema：ImportSummary / ImportProgress / DataOperationAuditLog
                                               #    / ExternalApiEntry / BackupFileInfo

changelog.json                                 # 同 PR 新增 4.28.0 條目（繁體中文描述）

SRS.md                                         # 同 PR 補登新端點、新表 data_operation_audit_log、
                                               #  新增 system_settings 表、backups/ 子目錄

CLAUDE.md                                      # 同 PR 更新「目前進行中的功能規劃」指向本計畫

.gitignore                                     # 同 PR 加入 backups/ 一行

.dockerignore                                  # 同 PR 加入 backups/ 一行
```

**Structure Decision**：沿用 001 ~ 006 的單體結構（單一 `server.js` + 根目錄 SPA）。本功能**不新增**任何頂層資料夾（`backups/` 為執行期生成、列入忽略清單），**不新增**任何 npm 套件，**不抽出**新後端模組（除既有 `lib/` 下新增兩支靜態資料 `lib/iso4217.js` 與 `lib/external-apis.json`，與 005 / 006 的 `lib/exchangeRateCache.js` / `lib/twseFetch.js` 同層）；spec/plan/research/data-model/quickstart/contracts 衍生物落在 `specs/007-data-export-import/` 既有 Spec-Kit 結構下。前端 SPA 仍為單一 `app.js`；既有 client-side 匯出函式重構為「呼叫伺服端 GET」薄包裝，新頁面（API 授權、稽核日誌、自動備份清單、我的操作紀錄）以 `<section>` 區塊插入既有 SPA、沿用既有 router pattern。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

無違反項目；本表格留空。
