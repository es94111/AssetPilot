# Quickstart：資料匯出匯入（Data Export / Import）

**Branch**: `007-data-export-import` | **Date**: 2026-04-27
**對應**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)、[data-model.md](./data-model.md)

本檔案為手動驗證劇本，配合 [specs/006-stock-investments/quickstart.md](../006-stock-investments/quickstart.md) 既有 baseline 進行；所有步驟皆可於本機開發環境（`npm start` + `http://localhost:3000`）執行。

## 0. 前置條件

1. **環境**：Node.js ≥ 24、本機已可正常啟動 `npm start`、瀏覽器為 Chrome / Edge / Firefox 桌面版。
2. **既有資料**：建議先以一個既有測試帳號登入，並確認包含：
   - ≥ 5 筆收支交易、≥ 1 筆轉帳對。
   - ≥ 8 個分類（含子分類）。
   - 若驗證 US4：≥ 1 檔股票持倉、≥ 5 筆股票交易、≥ 2 筆股利紀錄。
3. **管理員帳號**：用於 US6 驗證；以資料庫升級邏輯預設第一位使用者為管理員。
4. **開發者工具**：DevTools Network 面板（觀察 short polling）、Console（觀察結構化 log）。

## 1. 部署檢核（schema 升級驗證）

```bash
# 1.1 啟動 server
npm start

# 1.2 觀察啟動 log；應看見既有 [startup] 行（版本號將於 PR 末段更新為 4.28.0）
# 應**無**任何 SQLITE_ERROR / table-related 錯誤

# 1.3 透過 sqlite3 CLI（或於管理員介面下載備份檔後本機開）確認新表存在
sqlite3 database.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('data_operation_audit_log', 'system_settings');"
# 應輸出：
# data_operation_audit_log
# system_settings

# 1.4 確認預設保留天數
sqlite3 database.db "SELECT key, value FROM system_settings WHERE key='audit_log_retention_days';"
# 應輸出：audit_log_retention_days|90

# 1.5 確認 backups/ 目錄被忽略
git check-ignore -v backups/before-restore-test.db
# 應輸出 .gitignore 規則命中
```

**Pass criteria**：1.1 ~ 1.5 全部通過、log 無錯誤、新表存在、預設值為 90、`backups/` 路徑被 git 忽略。

---

## 2. US1：交易匯出（P1）

**對應 FR**：FR-001 ~ FR-005、FR-014b、FR-042（export_transactions）。

### 2.1 全部交易匯出

1. 登入測試帳號 → 進入「資料匯出」頁。
2. 點選「匯出交易記錄」（不選日期範圍）→ 點「匯出」。
3. 觀察：瀏覽器自動下載 `transactions-{YYYYMMDD}.csv`。
4. 用 Excel 開啟（**重要**：以 Excel / Numbers 開啟才能驗證 BOM）。

**Pass criteria**：
- ✅ 第一行為標題列：`日期,類型,分類,金額,帳戶,備註`
- ✅ 中文不亂碼
- ✅ 子分類顯示為「父 > 子」格式（無子分類者僅父名）
- ✅ 類型為中文（支出 / 收入 / 轉出 / 轉入）
- ✅ 日期格式為 `YYYY-MM-DD`
- ✅ 轉出 / 轉入兩筆獨立成行

### 2.2 Formula Injection 防護驗證（SC-003）

1. 編輯既有交易：將備註改為 `=SUM(1+1)`、`+CMD|'/c calc'!A1`、`-2+5`、`@SUM(A1)` 四筆。
2. 重新匯出 CSV。
3. 用 Excel 開啟相應行。

**Pass criteria**：
- ✅ 四筆儲存格都顯示為**文字**，不執行公式運算
- ✅ 用文字編輯器（VS Code）打開 CSV，看到備註欄為 `'=SUM(1+1)`（前置單引號）

### 2.3 日期範圍匯出

1. 「資料匯出」頁選日期範圍 `2026-01-01 ~ 2026-03-31`。
2. 點「匯出」。

**Pass criteria**：
- ✅ 區間外的交易不出現於 CSV
- ✅ 檔名仍為 `transactions-{YYYYMMDD}.csv`（YYYYMMDD 為今日，非區間日期）

### 2.4 稽核日誌驗證

1. 登入管理員 → 進入「稽核日誌」分頁。
2. 過濾 `action = export_transactions`。

**Pass criteria**：
- ✅ 上述 2.1 / 2.3 兩次匯出皆有對應紀錄
- ✅ `result = success`、`metadata.rows`、`metadata.byteSize` 有值
- ✅ 一般使用者進入「我的操作紀錄」分頁亦能看見自己的兩筆紀錄

---

## 3. US2：交易匯入（P1）

**對應 FR**：FR-006 ~ FR-014d、FR-042（import_transactions）。

### 3.1 基本匯入 + 自動建立缺項

1. 用先前匯出的 CSV 為基礎，編輯成「1000 筆交易（含 50 對轉帳）+ 3 個全新分類 + 1 個全新帳戶」。
2. 進入「資料匯入」→ 上傳該 CSV。
3. 預期看到：
   - 前 10 筆預覽 Modal。
   - 「偵測到 3 個新分類、1 個新帳戶，是否自動建立？」對話框。
4. 點「建立並匯入」。
5. **同時**開啟 DevTools Network 面板觀察 `GET /api/imports/progress` 約每秒一次。

**Pass criteria**：
- ✅ 進度條每 1 秒更新一次，phase 依序為 `parsing → validating → writing → pairing → finalizing`
- ✅ progress text 顯示「已處理 X / 1000 筆」每約 500 筆 advance 一次（SC-002）
- ✅ 完成 Modal 顯示「成功 1000 / 略過 0 / 錯誤 0」+ warnings 為空陣列
- ✅ 50 對轉帳寫入相同 `linked_id`（透過 SQL `SELECT linked_id, COUNT(*) FROM transactions WHERE linked_id != '' GROUP BY linked_id` 應有 50 組各 2 筆）
- ✅ 3 個分類 + 1 個帳戶確實建立

### 3.2 互斥鎖驗證（FR-014c）

1. 開啟兩個瀏覽器分頁，皆登入同一帳號。
2. 分頁 A 上傳 5000 筆 CSV → 看到進度條啟動。
3. 立即於分頁 B 上傳另一份 CSV。

**Pass criteria**：
- ✅ 分頁 B 收到 HTTP 409，error = `IMPORT_IN_PROGRESS`
- ✅ 分頁 B UI 顯示「您已有匯入進行中，請稍候完成後再試」
- ✅ 分頁 A 完成後（或失敗 rollback 後），分頁 B 重試成功

### 3.3 重複偵測驗證（FR-014）

1. 用 3.1 建立的資料為 baseline。
2. 重新匯入**同一份 CSV**（不修改）。

**Pass criteria**：
- ✅ 完成 Modal 顯示「成功 0 / 略過 1000 / 錯誤 0」
- ✅ DB 內 transactions 數量未變（SC-009）

### 3.4 ISO 8601 嚴格驗證（FR-014b）

1. 編輯 CSV 一筆，將日期改為 `2026/03/15`（用 `/` 分隔）。
2. 上傳。

**Pass criteria**：
- ✅ 該筆歸為錯誤，原因為「日期格式必須為 YYYY-MM-DD」
- ✅ 其他合法行照常寫入

### 3.5 25 MB / 20000 筆上限驗證

1. 產生 28 MB CSV → 上傳。

**Pass criteria**：
- ✅ 拒絕並回應「檔案大小超過 25 MB 上限」（HTTP 413）

2. 產生 22000 筆 CSV → 上傳。

**Pass criteria**：
- ✅ 拒絕並回應「單次匯入上限 20000 筆，請拆分後再試」（HTTP 413）

### 3.6 原子性驗證（FR-014a）

1. 故意製造一筆會在「寫入階段」失敗的資料（例如分類 ID 引用不存在的 ID）。
   - 實務上不易構造 — 改以下列方法：於 server.js 開發環境暫時於 `db.run('INSERT INTO transactions ...')` 處加入 `if (idx === 500) throw new Error('test rollback')`。
2. 上傳 1000 筆 CSV。
3. 上傳完成後檢查 DB。

**Pass criteria**：
- ✅ DB 中**完全沒有**本次匯入的任何分類、帳戶、交易（整批 rollback）
- ✅ 稽核日誌有一筆 `result = failed`、`metadata.failure_stage = 'writing'`
- ✅ UI 顯示明確錯誤訊息與失敗位置

### 3.7 轉帳配對演算法（FR-012）

1. 編輯 CSV 加入下列三筆：
   ```csv
   2026-04-15,轉出,,1000,銀行A,
   2026-04-15,轉出,,1000,銀行A,
   2026-04-15,轉入,,1000,銀行B,
   ```
2. 上傳。

**Pass criteria**：
- ✅ 完成 Modal 顯示「警告 1 條：第 3 行 未找到對應轉入」（CSV 順序：第 2 筆轉出無配對）
- ✅ DB 中第一筆轉出與第三筆轉入有相同 linked_id
- ✅ 第二筆轉出 linked_id 為空字串

### 3.7b SC-004 量化驗證 — 100 對轉帳往返配對成功率

1. 產生包含 100 對轉帳的 CSV（200 筆）：每對採不同日期或不同金額以避免群組碰撞（如 `2026-01-01 / 1000`、`2026-01-02 / 2000` ...）；轉出 / 轉入兩端帳戶皆已存在。
2. 在新空白測試帳號下匯入該 CSV。
3. 統計 SQL：`SELECT COUNT(DISTINCT linked_id) FROM transactions WHERE user_id = ? AND linked_id != ''`。

**Pass criteria**（對應 SC-004 ≥ 99%）：
- ✅ 配對組數 ≥ 99（即 100 對中至少 99 對成功 linked_id 互指）
- ✅ `warnings` 陣列長度 ≤ 1（最多容許 1 對因群組碰撞 / Edge Case 列入未配對警告）

### 3.8 Idempotency / 進度回饋邊界

1. 進入匯入頁，無進行中匯入時呼叫 `GET /api/imports/progress`。

**Pass criteria**：
- ✅ 回 `{ active: false }`（HTTP 200）

### 3.9 網路中斷弱保證（FR-014a 取捨）

> **本計畫的弱保證**：使用者離開頁面或網路中斷時，後端 handler 仍會跑完當前匯入；若 commit 已完成則資料保留、UI 視為失敗、使用者重試會被 FR-014 重複偵測自動略過（SC-009 冪等性保證）。**不**實作 `req.on('aborted', ...)` 中斷檢查（避免 sql.js 同步 API 與異步事件混雜風險）。

1. 上傳 1000 筆 CSV → 進度條顯示「writing 階段、500 / 1000」時，於 DevTools Network 面板按「Offline」中斷網路。
2. 等待 30 秒後恢復網路、重新整理頁面。

**Pass criteria**：
- ✅ 視 commit 是否完成有兩種情境：
  - 情境 A（commit 在中斷前完成）：交易列表已含本批 1000 筆；重試上傳同一檔 → 顯示「成功 0 / 略過 1000 / 錯誤 0」（FR-014 冪等性）
  - 情境 B（commit 未完成 / handler 仍在跑）：rollback；交易列表無本批資料；重試上傳同一檔 → 全部成功
- ✅ 兩種情境最終結果一致（一份資料），無雙寫入

---

## 4. US3：分類匯出 / 匯入（P2）

**對應 FR**：FR-015 ~ FR-017、FR-042（export_categories / import_categories）。

### 4.1 匯出分類 CSV

1. 進入「資料匯出」→ 「分類結構」→ 匯出。
2. 用 Excel 開啟。

**Pass criteria**：
- ✅ 標題列：`類型,分類名稱,上層分類,顏色`
- ✅ 父分類「上層分類」為空字串、子分類為父名
- ✅ 父分類於子分類**之前**輸出
- ✅ 顏色欄位為 `#RRGGBB`（六位數 hex）

### 4.2 匯入分類 CSV（含父子順序）

1. 在新空白測試帳號下，上傳 4.1 匯出的 CSV。

**Pass criteria**：
- ✅ 完成 Modal 顯示「成功 N / 略過 0 / 錯誤 0」
- ✅ 父子關聯正確（UI 樹狀展示）
- ✅ 重新匯入同檔，全部「略過」

### 4.3 顏色格式驗證（FR-015）

1. 編輯 CSV：將某行顏色改為 `red`（CSS 名稱）、`#F53`（3 碼短寫）。
2. 上傳。

**Pass criteria**：
- ✅ 該兩行歸為錯誤，原因為「顏色格式必須為 #RRGGBB」

---

## 5. US4：股票交易 / 股利匯出匯入（P2）

**對應 FR**：FR-018 ~ FR-023b、FR-042（export_stock_* / import_stock_*）。

### 5.1 股票交易匯出 + 匯入

1. 進入「資料匯出」→ 「股票交易」→ 匯出。

**Pass criteria**：
- ✅ 標題列：`日期,股票代號,股票名稱,類型,股數,成交價,手續費,交易稅,帳戶,備註`
- ✅ 類型為中文「買進 / 賣出」
- ✅ 日期格式 `YYYY-MM-DD`

2. 在新空白帳號下匯入該 CSV。

**Pass criteria**：
- ✅ 既有持倉表中無對應 symbol → 自動建立
- ✅ 完成顯示「成功 N / 略過 0 / 錯誤 0」
- ✅ 重新匯入同檔，全部「略過」（六欄重複偵測）

### 5.2 股票名稱自動修正（FR-021）

1. 在持倉表中將某檔 stock 的 `name` 欄位手動 UPDATE 為 symbol（如 `2330`）。
2. 重新匯入該檔的股票交易 CSV（CSV 中名稱為「台積電」）。

**Pass criteria**：
- ✅ 該檔持倉的 name 被 UPDATE 為「台積電」
- ✅ 既有交易紀錄不變

### 5.3 股利匯入 — 帳戶必填邏輯（FR-019）

1. 編輯股利 CSV：
   ```csv
   日期,股票代號,股票名稱,現金股利,股票股利,帳戶,備註
   2026-04-01,2330,台積電,500,0,玉山銀行,
   2026-04-01,0050,元大台灣50,0,100,,
   2026-04-01,2454,聯發科,200,0,,
   ```
2. 上傳。

**Pass criteria**：
- ✅ 第 1 行成功（現金股利 500 入款至玉山銀行帳戶）
- ✅ 第 2 行成功（純股票股利、合成 $0 買進交易）— 帳戶為使用者唯一證券帳戶（FR-023b 路徑 2）；若使用者有多個證券帳戶且該股票無既有買進，則歸為錯誤
- ✅ 第 3 行歸為錯誤，原因為「現金股利 > 0 時必填帳戶」

---

## 6. US5：即時匯率自動更新（P2）

**對應 FR**：FR-029 ~ FR-035、FR-033a（不寫稽核日誌）。

### 6.1 ISO 4217 白名單驗證（FR-030）

1. 進入「匯率設定」→ 「+ 新增幣別」。
2. 嘗試輸入 `XYZ`（白名單外）。

**Pass criteria**：
- ✅ UI 立即拒絕並提示「不是有效的 ISO 4217 幣別代碼」
- ✅ 後端 `PUT /api/exchange-rates` body 含 currency=`XYZ` 時回 400

### 6.2 30 分鐘快取命中（FR-032、SC-005）

1. 使用者 A 按「立即取得即時匯率」→ 觀察 DevTools Network 面板出現 `GET https://v6.exchangerate-api.com/...`。
2. 5 分鐘後使用者 B（或同一 A）再按一次。

**Pass criteria**：
- ✅ 第二次**不**發 HTTP request 至外部
- ✅ UI 顯示「使用 N 分鐘前的快取」
- ✅ Response 時間 ≤ 100 ms

### 6.3 手動匯率 ±20% 警告（FR-033a）

1. 進入匯率設定 → 編輯 USD 為 39.00（假設目前自動匯率為 32.45）。

**Pass criteria**：
- ✅ UI 顯示黃色警告「目前即時匯率為 32.4500，您輸入 39.0000 偏離 20.2%，請確認」
- ✅ 「確認儲存」按鈕仍可按
- ✅ 按下後成功 PUT 並設 `is_manual = true`

2. 編輯 USD 為 0 或 -1。

**Pass criteria**：
- ✅ UI 立即拒絕（硬性檢查）
- ✅ 不送 PUT request

---

## 7. US6：管理員備份 / 還原（P3）

**對應 FR**：FR-024 ~ FR-028、FR-042（download_backup / restore_backup / restore_failed）。

### 7.1 下載備份確認彈窗（FR-024a）

1. 管理員登入 → 「系統設定」→ 「資料庫備份」 → 按「下載備份」。

**Pass criteria**：
- ✅ 彈出確認 Modal，含警示文字「此檔案包含明文敏感資料（含使用者密碼雜湊、session token 等）⋯」
- ✅ 點「取消」不下載
- ✅ 點「確認下載」後下載 `assetpilot-backup-{YYYYMMDDHHmmss}.db`（檔名格式 14 位數字時間戳）

### 7.2 一般使用者隱藏入口（FR-027）

1. 用一般（非管理員）帳號登入 → 進入「系統設定」。

**Pass criteria**：
- ✅ 不出現「資料庫備份」區塊
- ✅ 直接呼叫 `GET /api/database/export` 回應 403

### 7.3 還原驗證 + 自動備份（FR-025、FR-026）

1. 管理員上傳 7.1 取得的備份檔。

**Pass criteria**：
- ✅ Server log 出現 `before-restore-{ts}.db` 寫入紀錄
- ✅ `backups/` 目錄下出現該檔案
- ✅ Response 200，`beforeRestorePath = "backups/before-restore-{ts}.db"`
- ✅ 提示「還原完成，請重新登入」

2. 上傳格式錯誤檔（如 .txt）。

**Pass criteria**：
- ✅ 拒絕並回「檔案不是有效的 SQLite 資料庫」

3. 上傳合法 SQLite 但缺 `stocks` 表。

**Pass criteria**：
- ✅ 拒絕並列出缺少的資料表清單

### 7.4 還原失敗自動回滾（FR-026a）

1. 模擬還原中失敗（開發環境暫時於替換主庫程式碼處 `throw new Error('test')`）。
2. 上傳合法備份檔。

**Pass criteria**：
- ✅ 回 422，error = `RESTORE_FAILED_ROLLED_BACK`
- ✅ UI 顯示「還原失敗，已自動回復至還原前狀態，請檢查 server 日誌」
- ✅ 主資料庫 = 還原前狀態（透過 SELECT count 驗證資料一致）
- ✅ Server 結構化 log 含 failure_stage / failure_reason

### 7.5 `before-restore` 保留 5 份 + 90 天（FR-026b）

1. 連續觸發 7 次還原（產生 7 個 `before-restore-*.db`）。

**Pass criteria**：
- ✅ `backups/` 目錄僅保留最近 5 份
- ✅ 較舊 2 份已被 `fs.unlinkSync`（server log 含 `before_restore_pruned` 事件）

2. 管理員介面「自動備份清單」。

**Pass criteria**：
- ✅ 列出 5 個檔案 + 大小 + mtime
- ✅ 手動刪除其中一份成功（`DELETE /api/admin/backups/:filename`）
- ✅ 嘗試 `DELETE /api/admin/backups/../etc/passwd` 仍只刪 `etc/passwd` basename → 防路徑遍歷

### 7.6 `.gitignore` / `.dockerignore`（FR-028）

```bash
git status backups/
# 應顯示 nothing to commit（backups/ 被忽略）

# Dockerfile build 時亦不應 COPY backups/
docker build -t test . && docker run --rm test ls /app/backups
# 應為 No such file or directory（或 empty）
```

**Pass criteria**：
- ✅ `backups/` 不入 git stage
- ✅ Docker image 不含 backups

---

## 8. US7：API 使用與授權頁（P3）

**對應 FR**：FR-036 ~ FR-038。

1. 點擊側邊欄「API 使用與授權」→ 進入頁面。

**Pass criteria**：
- ✅ 至少 5 條目：exchangerate-api、IPinfo、TWSE、Google Identity Services、Resend
- ✅ IPinfo 條目顯示 `IP address data is powered by IPinfo` 字樣
- ✅ 每個條目的官方連結點擊後於新分頁開啟
- ✅ 編輯 `lib/external-apis.json` 新增第 6 條目並 restart server，前端立即看見新條目（不需修改前端 code）

---

## 9. 稽核日誌相關（FR-042 ~ FR-046b）

### 9.1 管理員稽核日誌分頁

1. 管理員 → 「稽核日誌」分頁。

**Pass criteria**：
- ✅ 列表預設按 timestamp 倒序、每頁 50 筆
- ✅ 過濾條件：user_id / action（多選）/ result / start / end 全部可用
- ✅ 點擊任一行展開可看 metadata JSON 詳情
- ✅ 「匯出 CSV」按鈕產出 `audit-log-{YYYYMMDDHHmmss}.csv`

### 9.2 一般使用者「我的操作紀錄」

1. 一般使用者登入 → 「個人設定」→ 「我的操作紀錄」分頁。

**Pass criteria**：
- ✅ 列表僅顯示自己的紀錄
- ✅ 嘗試直接呼叫 `GET /api/user/data-audit?user_id=other-user-id` 仍只返回自己的紀錄（後端強制覆寫 user_id）

### 9.3 保留期設定（FR-046a）

1. 管理員 → 設定保留天數為 30。

**Pass criteria**：
- ✅ `system_settings.audit_log_retention_days = '30'`
- ✅ 等待下一輪 prune tick（手動：`registerAuditPruneJob` 啟動 5 秒後第一次跑）→ 30 天前的紀錄被刪除

2. 改為 `forever`。

**Pass criteria**：
- ✅ 下一輪 tick 跳過清理（無 DELETE 執行）

### 9.4 清空稽核日誌（FR-046a）

1. 管理員 → 點「清空全部」。

**Pass criteria**：
- ✅ 二次確認 Modal
- ✅ 確認後 `data_operation_audit_log` 表為空

---

## 10. 端到端整合測試

### 10.1 SC-001：5,000 筆交易匯出 ≤ 5 秒

1. 預先寫入 5000 筆交易（透過匯入或既有資料）。
2. DevTools Performance 面板 → 點「匯出」→ 觀察「Time to first byte」。

**Pass criteria**：
- ✅ TTFB ≤ 5 秒（第 90 百分位需多次測試取樣）

### 10.2 SC-002：1,000 筆 + 100 對轉帳匯入 ≤ 30 秒

1. 預備 1000 筆 CSV（含 100 對轉帳）。
2. DevTools Network 面板 → 上傳 → 觀察 `/api/transactions/import` request duration。

**Pass criteria**：
- ✅ 完成時間 ≤ 30 秒（含 progress polling 的所有 round-trip）
- ✅ 進度文字至少更新 2 次（500 / 1000）

### 10.3 SC-006：50 MB DB 還原 ≤ 60 秒

1. 預備 50 MB 備份檔（可透過大量交易 + 匯出取得）。
2. 管理員上傳 → 觀察 response time。

**Pass criteria**：
- ✅ 還原完成時間 ≤ 60 秒
- ✅ `backups/before-restore-*.db` 100% 存在
- ✅ 還原後資料完整（隨機抽樣 10 筆交易與還原前一致）

### 10.4 SC-008：API 授權頁覆蓋率

```bash
# 找出 codebase 中所有 outbound HTTP client
grep -rn "fetch(\|axios\|got\|node-fetch\|http\.get\|https\.get" server.js lib/ | grep -v test
```

**Pass criteria**：
- ✅ 對應的所有外部服務皆已列於 `lib/external-apis.json`
- ✅ IPinfo `attribution` 字串完全相符 `IP address data is powered by IPinfo`

### 10.5 SC-007：首次使用者匯入 UAT（人工觀察）

> UX 衡量指標、難以程式化驗證；採人工 UAT 觀察。

1. 邀請一位**未接觸過本系統匯入功能**的測試者（家人 / 同事亦可）。
2. 給予一份 50 ~ 100 筆範例 CSV（含 1 個尚未建立的分類，以觸發「自動建立缺項」對話框）。
3. 觀察並計時：從進入匯入頁 → 上傳 → 解決缺項對話框 → 看到「成功 N」結果。

**Pass criteria**：
- ✅ ≤ 5 分鐘完成（spec SC-007）
- ✅ 觀察者無需開發者協助即可獨立完成（衡量教學門檻是否合理）

---

## 11. 回歸測試

驗證本功能**不破壞**既有 001~006 功能：

1. 既有交易 CRUD（建立 / 編輯 / 刪除）正常。
2. 既有分類 reorder / restore-defaults 正常。
3. 既有股票投資頁面（持倉、實現損益、批次更新股價）正常。
4. 既有匯率設定 / 自動更新 toggle 正常。
5. 既有登入 / 登出 / Passkey / Google SSO 正常。
6. **匯率相關 baseline 行為（FR-029 / FR-033 / FR-034 / FR-035）**：
   - 匯率設定頁基礎貨幣 TWD 不可刪除、不可修改（FR-029）。
   - 編輯既有自動匯率為手動值並按下「鎖定」→ `is_manual = 1`；下次自動更新觸發時該紀錄不被覆寫（FR-033）。
   - `EXCHANGE_RATE_API_KEY` 環境變數切換（`free` ↔ 付費 key）後 restart server，呼叫 `POST /api/exchange-rates/refresh` 路徑切換正確（透過 `lib/exchangeRateCache.js` 內部分流；FR-034）。
   - 模擬 exchangerate-api.com 不可達（如 `EXCHANGE_RATE_API_KEY=invalid` 或暫斷網路）→ UI 顯示明確錯誤訊息且既有匯率不被清空（FR-035）。

**Pass criteria**：✅ 上列 1-6 全部回歸通過、無 console error、UI 無破版。

---

## 12. 完成清單

以下檢核項目全部通過後，本功能可送 PR：

- [ ] §1 部署檢核：新表存在、預設值 90、`backups/` 被忽略
- [ ] §2 US1：交易匯出 + Formula Injection 驗證 + 日期範圍 + 稽核
- [ ] §3 US2：交易匯入 + 互斥鎖 + 重複偵測 + ISO 8601 + 上限 + 原子性 + 轉帳配對
- [ ] §4 US3：分類匯出匯入 + 顏色格式驗證
- [ ] §5 US4：股票交易匯入 + 名稱修正 + 股利帳戶必填邏輯
- [ ] §6 US5：ISO 4217 白名單 + 30 分鐘快取 + ±20% 警告
- [ ] §7 US6：下載確認 Modal + 一般使用者隱藏 + 還原驗證 + 自動回滾 + 保留策略
- [ ] §8 US7：API 授權頁
- [ ] §9 稽核日誌：管理員分頁 + 我的操作紀錄 + 保留期設定 + 清空
- [ ] §10 SC-001 / SC-002 / SC-006 / SC-008 效能與覆蓋
- [ ] §11 回歸測試
- [ ] `openapi.yaml` 更新至 4.28.0
- [ ] `changelog.json` 新增 4.28.0 條目
- [ ] `SRS.md` 補登新端點與新表
- [ ] `CLAUDE.md` 更新「目前進行中的功能規劃」
