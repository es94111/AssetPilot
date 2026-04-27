# Phase 0 研究：資料匯出匯入（Data Export / Import）

**Branch**: `007-data-export-import` | **Date**: 2026-04-27
**對應**: [spec.md](./spec.md)、[plan.md](./plan.md)

## 0. 研究範圍

本檔記錄為實作 007 規格而做的「不引入新技術棧」前提下的技術選型決策。每一節對應一個原本可能引入新依賴／新架構的決策點，最終結論皆為 **沿用既有 baseline，以純 JS 補齊缺口**。

| # | 主題 | 對應 FR | 結論 |
|---|---|---|---|
| 1 | CSV 解析與組裝 | FR-001~005、FR-006a、FR-014b、FR-015 | 純 JS；前端解析 + JSON body 上傳沿用 |
| 2 | 進度回饋通道 | FR-014d、SC-002 | Short polling（前端 1s setInterval + 後端 Map）|
| 3 | 匯入互斥鎖 | FR-014c | 純記憶體 Set；server 重啟自動清空 |
| 4 | 原子性 + DB transaction | FR-014a | 既有 sql.js `BEGIN / COMMIT / ROLLBACK` 模式 |
| 5 | 轉帳配對演算法 | FR-012 | 兩階段：分組 + 順序兩兩配對 + 剩餘 warnings |
| 6 | 重複偵測 hash | FR-014、FR-023a | 純字串拼接 + JS Set |
| 7 | Formula Injection 防護 | FR-005、SC-003 | 純字串前綴單引號 |
| 8 | ISO 4217 白名單 | FR-030 | 純 JS 陣列字面量（~180 條）|
| 9 | 手動匯率 ±20% 警告 | FR-033a | 純前端 UI 比對（後端不阻擋）|
| 10 | 整檔備份 / 還原 / 自動回滾 | FR-024~026b | 既有 `db.export()` + `fs.copyFileSync` 模式擴充 |
| 11 | 稽核日誌寫入 + 清理 | FR-042~046b | 沿用既有 `registerAuditPruneJob()` 模式 |
| 12 | API 授權頁 | FR-036~038 | 純前端頁面 + 靜態 JSON 資料來源 |

---

## 1. CSV 解析與組裝

**決策**：保留既有 client-side parse + JSON body upload 模型；不引入 csv-parser / papa-parse / multer。

**Rationale**：
- 既有 `app.js` 內 client-side parser 已運作且已被 002（交易匯入）使用 1+ 年；行為穩定。
- 切換成 server-side multipart 需引入 `multer`（新依賴）+ 改寫前端 FormData 上傳；改動面遠超「補強」範圍。
- 25 MB JSON body 上限（`csvImportJsonParser`）已涵蓋使用者預期最大量；上限以 row 數（20000）為主，與檔案 size 雙重保護。
- Formula Injection 防護於匯出時做（FR-005）；匯入時遇 `'=...'` 視為一般文字（已預先 escape 過）— 與規格 Edge Cases「匯入時如使用者**未**清除前置單引號則照原文存入」一致。

**Alternatives 考慮**：
- Server-side multipart + multer：被拒絕（新依賴；整改量大；未解決 25 MB row count 雙重限制問題）。
- WebSocket-based streaming upload：被拒絕（新技術棧；單體應用無此需求）。

**實作細節**：
- 前端解析時**僅讀第一行欄位名稱**做欄位對應（不依靠位置）；未識別欄位 silent drop（FR-006a）。
- 必要欄位：交易為「日期 + 類型 + 金額」；分類為「類型 + 分類名稱」；股票交易為「日期 + 股票代號 + 類型 + 股數 + 成交價」；股利為「日期 + 股票代號」（cash + stock 二選一）。
- 必要欄位缺失：前端 reject + 不上傳；伺服端再次驗證做雙保險（防 cli / curl 直送）。
- 伺服端結構化日誌 `console.log(JSON.stringify({ event: 'csv_unknown_columns', userId, action, columns }))` 紀錄被忽略的欄位名（FR-006a）。

---

## 2. 進度回饋通道

**決策**：採 short polling — 前端 `setInterval(1000)` 輪詢 `GET /api/imports/progress`；後端以 `Map<userId, ProgressEntry>` 即時更新；匯入完成後 entry 留 5 秒（讓前端最後一輪可讀到 100% 狀態）後 delete。

**Rationale**：
- SSE（Server-Sent Events）需多個邊界處理：`text/event-stream` mime、`flushHeaders()`、Express 5 流式 response、瀏覽器 EventSource API；皆為 baseline 不存在的代碼路徑，引入會擴大改動面與測試面。
- WebSocket 需新增 `ws` 或 `socket.io` 依賴 — 違反「不新增 npm 套件」硬約束。
- Long-polling（hold connection）會阻塞 sql.js 主執行緒；sql.js 為單執行緒同步 API，匯入過程中 server 已 busy，無法響應 long-poll。
- Short polling 1 秒間隔對個人記帳工具的 UX 已足夠（SC-002 要求每 500 筆更新一次，1000 筆 / 30 秒匯入意味每 1.5 秒就 advance 500 筆，1 秒輪詢足以「跟得上」）；網路成本極低（每秒 1 個 GET，response 約 100 bytes）。

**Alternatives 考慮**：
- SSE：被拒絕（邊界處理多、與 sql.js 同步 API 配合不佳）。
- WebSocket：被拒絕（新依賴）。
- 不做進度回饋僅顯示 spinner：被拒絕（spec FR-014d 明確規定 phase 標籤與 processed/total）。

**實作細節**：
- `importProgress.set(userId, { processed, total, phase, startedAt, completedAt: null })`；`phase` 列舉值：`parsing`／`validating`／`writing`／`pairing`／`finalizing`；每處理 500 筆 set 一次。
- 完成時 set `completedAt = Date.now()`；setTimeout 5 秒後 `delete(userId)`（讓最後一輪 polling 可讀到 100%）。
- 前端 import 流程：上傳 → 啟動 polling → 收到 `{ active: false }` 或 progress.completedAt 存在 → 停止 polling、顯示完成 Modal。
- 中斷處理：使用者離開頁面（`beforeunload`）或網路中斷視為放棄（依 FR-014a 整批 rollback）；後端透過 try/finally 釋放 importLock；importProgress 在 5 秒後自動清除。

---

## 3. 匯入互斥鎖

**決策**：純記憶體 `Set<userId>` lock；server 重啟自動清空（不持久化）。

**Rationale**：
- 單體應用單一 Node process — 模組級 Set 即可保證「同 process 內」的原子性。
- 多實例部署（理論上的橫向擴充）目前不在 scale 範圍（< 1000 使用者，單機 Docker）；需要 Redis-backed lock 時再升級。
- Server 重啟若 lock 殘留，使用者將永遠無法匯入；記憶體 Set 在 process exit 時自動清空，避免此問題。
- 客戶端與伺服端 Lock 雙重防護：前端按下「上傳」按鈕後立即 disable（避免重複點擊），後端 acquireImportLock 為 server-side 真實互斥（防 cli / curl 直送）。

**Alternatives 考慮**：
- DB-backed lock（一張 `import_locks` 表）：被拒絕（server crash 時 lock 殘留問題依然存在；需要額外 cleanup job；複雜度高於需求）。
- Redis lock（SETNX + TTL）：被拒絕（新依賴、新基礎設施）。
- 不做 server-side lock 僅前端 disable：被拒絕（FR-014c 明示 server-side 鎖）。

**實作細節**：
```javascript
const importLocks = new Set();
function acquireImportLock(userId) {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}
function releaseImportLock(userId) {
  importLocks.delete(userId);
}
```

---

## 4. 原子性 + DB transaction

**決策**：沿用 sql.js 既有 `db.run('BEGIN'); try { ... db.run('COMMIT') } catch { db.run('ROLLBACK') }` 模式；自動建立缺項 + 寫入交易 + 寫入 linked_id 全包覆於同一 transaction。

**Rationale**：
- 既有 transfer handler（[server.js:6624](../../server.js#L6624)）已使用此 pattern；模式驗證成熟。
- sql.js 為記憶體 SQLite — `BEGIN/COMMIT` 為純記憶體 op，效能極高（無磁碟 fsync）；rollback 也是記憶體回退無風險。
- saveDB() 於 COMMIT 之後呼叫（既有 pattern）；rollback 不呼叫 saveDB() — 持久化到 `database.db` 的內容永遠是最後一個成功 commit 的狀態。

**實作細節**：
```javascript
db.run('BEGIN');
try {
  // 1. 自動建立分類 / 帳戶
  // 2. 寫入交易 + 配對 linked_id
  // 3. 寫入稽核日誌
  db.run('COMMIT');
  saveDB();
} catch (e) {
  try { db.run('ROLLBACK'); } catch {}
  // 寫入失敗稽核日誌（result: 'failed', metadata.failure_stage）
  return res.status(500).json({ error: '匯入失敗', message: e.message, failedAt: ... });
}
```

**邊界情境**：
- 使用者離開頁面 → fetch 中斷 → server side handler `req.on('aborted', ...)` 不主動 rollback（既有 baseline 也未做此處理）；但因為整個寫入在單一 transaction 內，server side handler 完整跑完才 COMMIT，因此「中斷」實質意味著 connection 斷掉時 handler 仍在跑 → 跑完後 res.send 失敗（client 看不到結果）→ 但 data 已 commit。**改善**：handler 開頭加 `let aborted = false; req.on('aborted', () => { aborted = true })`；在每個 phase 結束後檢查若 aborted 則 throw 進入 ROLLBACK 流程。

---

## 5. 轉帳配對演算法

**決策**：兩階段配對 — (1) 按 `${date}|${amount}` 分組；(2) 組內依 CSV 原始 row 順序，將 transfer_out / transfer_in 兩 list 兩兩配對（第 N 筆 out ↔ 第 N 筆 in）；(3) 剩餘單側候選列入 `warnings`。

**Rationale**：
- 帳戶感知配對（試圖匹配 from_account_id / to_account_id）需 CSV 提供額外欄位或更複雜推測；spec Q2 明確採「順序兜底」決策。
- 順序配對符合使用者直覺：CSV 行順序通常反映時間順序，行對行配對最易理解。
- 多餘候選列入 warnings 而非 errors — 仍寫入為單向交易，不阻擋整批匯入（FR-012 後半段 + Edge Cases）。

**實作細節**：
```javascript
const groupMap = new Map(); // key: "YYYY-MM-DD|amount", value: { outs: [], ins: [] }
rows.forEach((row, idx) => {
  if (row.dbType === 'transfer_out' || row.dbType === 'transfer_in') {
    const key = `${row.date}|${row.amount}`;
    if (!groupMap.has(key)) groupMap.set(key, { outs: [], ins: [] });
    const grp = groupMap.get(key);
    if (row.dbType === 'transfer_out') grp.outs.push({ idx, row, txId: uid() });
    else grp.ins.push({ idx, row, txId: uid() });
  }
});
const warnings = [];
groupMap.forEach((grp, key) => {
  const pairs = Math.min(grp.outs.length, grp.ins.length);
  for (let i = 0; i < pairs; i++) {
    // 寫 outs[i] 與 ins[i]，兩者 linked_id 互指
  }
  // 剩餘
  for (let i = pairs; i < grp.outs.length; i++) warnings.push({ row: grp.outs[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉入' });
  for (let i = pairs; i < grp.ins.length; i++) warnings.push({ row: grp.ins[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉出' });
});
```

**Edge Cases**：
- 同 (date, amount) 多對轉帳：以 CSV 順序 1-1 / 2-2 / 3-3 配對 — 結果與「使用者預期是按 CSV 順序」一致。
- 無對應轉入的轉出：寫為單向 transfer_out 紀錄（linked_id = ''）、進 warnings。

---

## 6. 重複偵測 hash

**決策**：純字串拼接成 key，存入 JS Set；匯入前先一次性 SELECT 既有資料 build set，逐筆 row 寫入時先檢 set + 寫入後 add 至 set。

**Rationale**：
- 純字串 key 已足夠唯一（spec Q1 已明示六欄／四欄）；無需 hash function（SHA-256 等）。
- JS Set lookup O(1)；對 5000 筆現有資料 + 1000 筆匯入 row 而言，總 lookup 次數 6000，效能極優。
- 不依賴 DB unique constraint：既有 transactions 表無對應 unique index，且新增 unique index 屬「動既有 schema」風險；走應用層判定最小擾動。

**實作細節**：
```javascript
function makeTxHash(row) {
  return [row.date, row.dbType, row.categoryId || '', row.amount, row.accountId || '', row.note || ''].join('');
}
const existingTxHashes = new Set();
queryAll("SELECT date, type, category_id, amount, account_id, note FROM transactions WHERE user_id = ?", [userId])
  .forEach(t => existingTxHashes.add([t.date, t.type, t.category_id || '', t.amount, t.account_id || '', t.note || ''].join('')));
const batchHashes = new Set();
rows.forEach(row => {
  const h = makeTxHash(row);
  if (existingTxHashes.has(h) || batchHashes.has(h)) {
    skipped++;
    return;
  }
  batchHashes.add(h);
  // ... 寫入
});
```

**為何用 ``（Start of Heading 控制字元）**：作為分隔符避免使用者 note 含 `|` / `,` 等常見字元造成 hash 碰撞；`` 在使用者輸入中極度罕見。

---

## 7. Formula Injection 防護

**決策**：以 `=` / `+` / `-` / `@` 開頭的字串前置 `'`（單引號）；於 CSV 組裝前套用，所有匯出端點共用 helper。

**Rationale**：
- OWASP Formula Injection cheatsheet 推薦做法 — Excel / Numbers / LibreOffice / Google Sheets 皆以 `'` 為「視為文字」前綴。
- 純字串操作（`String.prototype.startsWith`）— 無需新依賴。
- 僅對「字串型」欄位套用（備註、分類名、帳戶名、股票名）；數字 / 日期 / 列舉值（類型）原樣輸出。

**實作細節**：
```javascript
function formulaInjectionEscape(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return "'" + value;
  return value;
}
function csvCell(value) {
  const s = formulaInjectionEscape(String(value ?? ''));
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
```

**驗證樣本**（SC-003）：
- `=SUM(A1)` → `'=SUM(A1)`
- `+CMD|'/c calc'!A1` → `'+CMD|'/c calc'!A1`（含單引號需 csvCell 雙引號包覆 + 內部雙引號加倍）
- `-2+5+cmd|...` → `'-2+5+cmd|...`
- `@SUM(A1)` → `'@SUM(A1)`

---

## 8. ISO 4217 白名單

**決策**：純 JS 陣列字面量 `lib/iso4217.js` export `ISO_4217_CODES` ~180 條 + `isValidCurrency(code)` 函式。

**Rationale**：
- 不引入 currency.js / iso-4217 npm 套件 — 違反「不新增依賴」硬約束。
- ISO 4217 主要流通幣別約 180 條，純字面量約 5 KB（unminified），可接受。
- 白名單以「靜態資料檔」維護（FR-030）— 新增／移除代碼不需重新部署應用（雖然在 Node.js 是 module-level constant，但人工編輯 + restart 即可）。
- 即使通過白名單，仍可能於呼叫 exchangerate-api.com 時收到 unsupported（如某些罕見幣別 API 不支援）— 該情境照原有錯誤處理（US5 Acceptance #5）。

**Alternatives 考慮**：
- 即時查 API 是否支援：被拒絕（新增一輪外部呼叫成本；違背「白名單為靜態」設計）。
- 無白名單僅 regex `^[A-Z]{3}$`：被拒絕（FR-030 明確要求 ISO 4217 校驗）。
- 引入 currency-list npm：被拒絕（新依賴）。

**實作細節**：
```javascript
// lib/iso4217.js
'use strict';
const ISO_4217_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  // ... 約 180 條
  'TWD', 'USD', 'EUR', 'JPY', 'KRW', 'GBP', 'HKD', 'SGD', 'THB', 'MYR',
];
const ISO_4217_SET = new Set(ISO_4217_CODES);
function isValidCurrency(code) {
  return typeof code === 'string' && ISO_4217_SET.has(code.toUpperCase());
}
module.exports = { ISO_4217_CODES, isValidCurrency };
```

---

## 9. 手動匯率 ±20% 警告

**決策**：純前端 UI 比對 — 後端 `PUT /api/exchange-rates` 不阻擋偏離值（僅檢空值 / 非數字 / `≤ 0`）；前端 onChange 偵測偏離 ±20% 顯示黃色警告，提供「確認儲存」按鈕。

**Rationale**：
- spec Q19 明確「僅警告不拒絕」；強硬阻擋會干擾使用者「我真的要鎖定一個非市場價」的合法情境（如鎖定特定歷史成交匯率）。
- 比對基準採「前端 fxCache 內最近一次 `is_manual = false` 紀錄」— 已有 `GET /api/exchange-rates` 端點回傳 rate_to_twd 欄位 + is_manual 欄位（既有），前端可直接比對。
- 純前端實作 — 不需新增 API；後端僅維持原硬性檢查（空值 / 非數字 / `≤ 0` rejection）。

**實作細節**：
- 前端「編輯匯率」UI 加 `<input type="number" min="0.000001">` + onChange listener。
- 偵測偏離邏輯：
  ```javascript
  function checkRateDeviation(newRate, currency) {
    const auto = currentRates.find(r => r.currency === currency && r.is_manual === 0);
    if (!auto) return null; // 無基準，略過
    const dev = Math.abs(newRate - auto.rate_to_twd) / auto.rate_to_twd;
    if (dev > 0.20) return { deviation: dev, suggestedRate: auto.rate_to_twd };
    return null;
  }
  ```
- UI 顯示：`<div class="rate-deviation-warning">⚠️ 目前即時匯率為 32.4500，您輸入 39.0000 偏離 20.2%，請確認</div>` + 「確認儲存」按鈕 enable。

---

## 10. 整檔備份 / 還原 / 自動回滾

**決策**：沿用既有 `db.export()` + `fs.writeFileSync` + `new SQL.Database(...)` 模式；新增 `backups/` 子目錄、`pruneBeforeRestoreBackups()`、自動回滾 try/catch。

**Rationale**：
- sql.js `db.export()` 回傳 `Uint8Array` 為記憶體 SQLite 完整快照 — 無需新增 sqlite3 / better-sqlite3。
- `fs.writeFileSync` / `fs.readdirSync` / `fs.unlinkSync` 為 Node.js 內建 — 無新依賴。
- 自動回滾流程驗證：
  1. 寫入 `backups/before-restore-{ts}.db`（成功 → continue；失敗 → 拒絕還原並告警）。
  2. 嘗試替換主資料庫（`db.close()` → `db = new SQL.Database(uploadedBuffer)` → `saveDB()` → `initDB()`）。
  3. 任一步驟失敗 → 進入 catch → 讀取 `backups/before-restore-{ts}.db` → 寫回 `DB_PATH` → `db = new SQL.Database(beforeBuffer)` → `initDB()` → response 422 `{ error: 'RESTORE_FAILED_ROLLED_BACK', ... }`。
  4. 自動回滾本身失敗（極端）→ console.error + UI 顯示「主資料庫狀態未知」+ list 可用備份檔路徑供管理員手動處置。

**實作細節**：
```javascript
const BACKUPS_DIR = path.join(__dirname, 'backups');
function ensureBackupsDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
function pruneBeforeRestoreBackups() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('before-restore-') && f.endsWith('.db'))
    .map(f => ({ name: f, path: path.join(BACKUPS_DIR, f), mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // 新 → 舊
  const NOW = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const toDelete = [];
  files.forEach((f, i) => {
    if (i >= 5 || (NOW - f.mtime) > NINETY_DAYS) toDelete.push(f);
  });
  toDelete.forEach(f => {
    try {
      fs.unlinkSync(f.path);
      console.log(JSON.stringify({ event: 'before_restore_pruned', file: f.name, mtime: new Date(f.mtime).toISOString() }));
    } catch (e) {
      console.error(JSON.stringify({ event: 'before_restore_prune_failed', file: f.name, error: String(e) }));
    }
  });
}
```

**檔名格式變更說明**：
- 舊：`asset_backup_<isoTime>.db` → 新：`assetpilot-backup-{YYYYMMDDHHmmss}.db`（spec FR-024）。
- 舊：`<DB_PATH>.backup_<isoTime>` → 新：`backups/before-restore-{YYYYMMDDHHmmss}.db`（spec FR-026）。
- 變更影響：僅生成檔名變更，無 client 訂閱此檔名格式；既有舊備份檔不刪除（與新檔並存）。

---

## 11. 稽核日誌寫入 + 清理

**決策**：新表 `data_operation_audit_log` + `writeOperationAudit()` helper + 沿用既有 `registerAuditPruneJob()` 的 setInterval 24h 模式（[server.js:4832](../../server.js#L4832)）擴充清理範圍。

**Rationale**：
- spec FR-046a 要求「每日午夜清理」— 既有 `registerAuditPruneJob` 採「啟動後 5 秒先跑一次 + 每 24 小時跑一次」pattern（不嚴格在午夜跑，但效果等價：每日清理一次）；沿用避免新引入 cron 套件（如 node-cron）。
- 寫入失敗 try/catch 不阻擋主操作（FR-044）— 配合 server log 確保事後可補登。
- 稽核日誌**不含明文敏感資料**（FR-046）— metadata 欄位僅紀錄筆數、檔案大小、失敗原因等元資料；CSV 內容、密碼、token 不入庫。

**實作細節**：
```javascript
function writeOperationAudit({ userId, role, action, ipAddress, userAgent, result, isAdminOperation, metadata }) {
  try {
    const id = uid();
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO data_operation_audit_log
       (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, userId, role, action, ipAddress || '', userAgent || '', timestamp, result, isAdminOperation ? 1 : 0, JSON.stringify(metadata || {})]
    );
    saveDB();
  } catch (e) {
    console.error(JSON.stringify({
      event: 'audit_write_failed',
      userId, action, result, error: String(e)
    }));
  }
}
```

**清理 job 擴充**：
```javascript
function registerAuditPruneJob() {
  function tick() {
    // ... 既有 login_audit_logs 清理邏輯
    // 新增：data_operation_audit_log 清理
    const setting = queryOne("SELECT value FROM system_settings WHERE key = 'audit_log_retention_days'");
    const retention = setting?.value || '90';
    if (retention === 'forever') return; // 跳過清理
    const days = parseInt(retention, 10);
    if (!days || days <= 0) return;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    db.run("DELETE FROM data_operation_audit_log WHERE timestamp < ?", [threshold]);
    saveDB();
  }
  setTimeout(tick, 5000); // 啟動 5 秒後跑一次
  setInterval(tick, 24 * 60 * 60 * 1000); // 每 24 小時
}
```

**權限與查詢**：
- `GET /api/admin/data-audit`：`adminMiddleware`；query 支援 `user_id` / `action` / `result` / `start` / `end` / `page` / `pageSize`；預設 `pageSize = 50`、按 `timestamp DESC`。
- `GET /api/user/data-audit`：一般 `authMiddleware`；query 同上但 `user_id` 強制為 `req.userId`（後端覆寫，防止跨使用者查詢）。
- `GET /api/admin/data-audit/export`：產 CSV（同欄位）。
- `POST /api/admin/data-audit/purge`：清空（`DELETE FROM data_operation_audit_log`）；二次確認由前端 Modal 處理，後端僅檢 RBAC。
- `PUT /api/admin/data-audit/retention`：body `{ retention_days: 30 | 90 | 180 | 365 | 'forever' }`；UPDATE system_settings；觸發 tick() 立即重新評估（可選）。

---

## 12. API 授權頁

**決策**：純前端頁面 + 一份靜態 JSON `lib/external-apis.json`；新增 `GET /api/external-apis` 端點讀取靜態 JSON 回傳。

**Rationale**：
- spec FR-038 要求「未來新增第三方服務時可快速擴充」— 採 JSON 資料來源即可（編輯 JSON + restart server），不需修改 UI 元件。
- 公開端點（無需認證）— 該頁面不含敏感資料，且某些情境（未登入時看 footer 連結）可能跳轉至此頁；附 `Cache-Control: public, max-age=3600` 降低伺服器負擔。
- IPinfo `IP address data is powered by IPinfo` 字樣為合規要求（IPinfo Terms of Service），**必須**顯示在頁面上。

**實作細節**：
```json
[
  {
    "name": "exchangerate-api.com",
    "description": "全球即時匯率（基礎貨幣 TWD）",
    "url": "https://www.exchangerate-api.com",
    "attribution": null,
    "supportsFree": true,
    "supportsPaid": true
  },
  {
    "name": "IPinfo",
    "description": "IP 位址地理位置查詢（登入稽核國家欄位）",
    "url": "https://ipinfo.io/lite",
    "attribution": "IP address data is powered by IPinfo",
    "supportsFree": true,
    "supportsPaid": false
  },
  {
    "name": "TWSE 台灣證券交易所",
    "description": "股票即時報價、除權息資料、股票名稱查詢",
    "url": "https://openapi.twse.com.tw",
    "attribution": null,
    "supportsFree": true,
    "supportsPaid": false
  },
  {
    "name": "Google Identity Services",
    "description": "Google SSO 登入",
    "url": "https://developers.google.com/identity/gsi/web",
    "attribution": null,
    "supportsFree": true,
    "supportsPaid": false
  },
  {
    "name": "Resend",
    "description": "Email 寄送（管理員資產統計報表）",
    "url": "https://resend.com",
    "attribution": null,
    "supportsFree": true,
    "supportsPaid": true
  }
]
```

**伺服端實作**：
```javascript
const externalApisData = require('./lib/external-apis.json');
app.get('/api/external-apis', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ apis: externalApisData });
});
```

**前端整合**：
- 側邊欄新增「API 使用與授權」連結（icon: ⓘ）。
- 頁面內容：列表渲染每條目（name + description + url 連結 + attribution badge if exists）。
- IPinfo 條目特別處理：若 `attribution` 非空，顯示為紅色 badge / footer 字樣 — 確保符合合規要求。

---

## 結論

本計畫所有技術決策皆**沿用既有 baseline**，**無任何新依賴／新外部服務／新基礎設施**，符合使用者「不可以新增任何技術規格」的硬約束。所有缺口以純 JS（regex、Set、Map、字串拼接、fs、JSON）補齊，符合單體應用「最小擾動」原則。

下一步：[data-model.md](./data-model.md) 定義新表 schema + 既有表變更（**無**）；[contracts/data-export-import.openapi.yaml](./contracts/data-export-import.openapi.yaml) 定義 15 個新端點 + 6 個既有端點變更。
