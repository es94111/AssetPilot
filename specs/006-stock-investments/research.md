# Phase 0 研究紀錄：股票投資（Stock Investments）

**Branch**: `006-stock-investments` | **Date**: 2026-04-26 | **Plan**: [plan.md](./plan.md)

本檔記錄 Phase 0 對 [plan.md](./plan.md) 內 12 大技術決策的調研結果。所有 NEEDS CLARIFICATION 已於 spec 四輪 `/speckit.clarify` 解決（共 19 條 Q/A），本階段聚焦在「如何在既有 stack 上落地、為何不引入新依賴」。

使用者明示限制：**使用目前專案現有的技術規格，不要新增任何技術規格**。本計畫嚴守此限制 — 不引入任何新 npm 套件、不引入新前端 CDN 資源、不新增獨立服務或 cron worker、不新增資料庫引擎。

---

## 1. 既有實作 baseline 盤點

### 決策

直接在 `server.js` 與 `app.js` 既有的股票相關路由與 render 函式上擴充；**不**新增獨立模組、**不**抽出 `lib/stockFifo.js` 或 `lib/twseSync.js`（除一個 `lib/twseFetch.js` 小檔放入既有 `lib/` 同層位置 — 與 005 既有 `lib/moneyDecimal.js` 並列）。

### 理由

baseline 已涵蓋本功能約 **70% 表面**：

- 5 張既有表 — `stocks`（含 `stock_type`）、`stock_transactions`、`stock_dividends`、`stock_settings`（per-user 費率）、`stock_recurring`。
- FIFO 計算引擎（`/api/stocks` GET 內聯）已實作，但精度問題（採 `Number` + `Math.round`）；本計畫**改寫該段**為 `decimal.js` 全精度（沿用既有 `lib/moneyDecimal.js` helper pattern），不抽出新模組以避免破壞既有測試與 review path。
- TWSE 三段查價函式（`updateUserStockPrices()` / `fetchTwseStockPrice()` 等）已存在，本計畫於上層加並發控制與重試包裝（`fetchWithRetry()`）— 包裝在 `lib/twseFetch.js` 是因為相同 helper 會被三個情境共用（批次更新、同步除權息、排程補產生），抽出一檔比三處複製更清晰。
- 自動同步除權息邏輯已實作（`TWT49U` + `TWT49UDetail`），本計畫拆為按年份端點，前端逐年呼叫；**不重寫核心同步邏輯**，僅在路由層拆段。
- 排程處理 `processStockRecurring()` 已有 `while` 迴圈補產生，本計畫補強「歷史股價」與「idempotency 唯一鍵」，**不重寫迴圈骨架**。

### 拒絕的替代方案

- **抽出 `lib/stockFifo.js`** — 增加 review surface；`/api/stocks` GET 內聯實作為 baseline，跨檔案重構與本功能「最小擾動」原則衝突；FIFO 邏輯 ≤ 50 行，不必獨立檔案。
- **重寫整個股票模組** — 違反「surgical changes」治理原則（CLAUDE.md §3）；19 條 clarification 多為行為精修而非架構翻新。

---

## 2. FIFO 引擎精度升級（decimal.js）

### 決策

`/api/stocks` GET 內 FIFO 段（[server.js:7966-7991](../../server.js#L7966)）改寫為使用 `decimal.js`：
- `lots[i].price` / `lots[i].fee` / `remaining` / `sellRevenue` / `sellCost` 全部改為 `Decimal` 物件。
- 手續費分攤 `feeUsed = lot.fee.times(used).div(lot.shares)` 保留全精度（不 `Math.round`）。
- `realizedPL` / `totalCost` / `marketValue` / `estimatedProfit` 累計皆為 `Decimal`。
- **僅最後 response 階段** 透過 `.toNumber()` + `Math.round()` 轉為整數呈現（個股卡片市值、實現損益等）。

### 理由

- 滿足 spec Pass 4 Q1（FIFO 批次內部全精度 + 顯示時取整）與 SC-004（≤ 1 元誤差）。
- decimal.js 已是 baseline 依賴（`package.json` 已宣告）；本決策**不引入新 npm**。
- 與既有 005 `lib/moneyDecimal.js` 風格一致（Decimal-first、僅介面層轉 Number）。

### 拒絕的替代方案

- **per-share cost 直接四捨五入到整數**（spec Q1 Option A）— 累積誤差可能 > 1 元，違反 SC-004。
- **手續費獨立記錄不分攤至批次**（spec Q1 Option D）— 偏離台灣券商實務與 spec 已定 FR-030(a) 文意。

---

## 3. 股票股利合成 $0 交易紀錄

### 決策

**寫入時**：`POST /api/stock-dividends`（手動）與 `POST /api/stock-dividends/sync` 內，若 `stock_dividend_shares > 0`：同 transaction 內 `INSERT INTO stock_transactions (id, user_id, stock_id, date, type='buy', shares=配發股數, price=0, fee=0, tax=0, account_id=NULL, note='股票股利配發 | ' || 原備註, created_at=Date.now())`。

**刪除時**：`DELETE /api/stock-dividends/:id` 連動刪除 — 依 `(user_id, stock_id, date, price=0, note LIKE '%股票股利配發%')` 五元組精確匹配（夠唯一，不會誤刪人工 $0 交易，因 note 簽名）。

**FIFO 自然處理**：合成的 $0 cost lot 進入 lots 佇列；後續賣出時 FIFO 會先扣 $0 batch（若早於現金買入）或最後扣（若晚），對應 spec Pass 1 Q1（賣出時全額視為已實現獲利、與台灣稅法一致）。

### 理由

- 解決 baseline 缺陷：目前直接 `totalShares += stock_dividend_shares`（[server.js:7993](../../server.js#L7993)）但 `lots[]` 不增加；後續若該檔賣出 ≥ 原始買入股數，FIFO 會 `lots.shift()` 過早變空、剩餘股數實際無 cost lot 可扣，計算行為未定義。
- 寫入合成 transaction 是「同一交易表內的一致 source of truth」，符合 FR-002「衍生數值動態計算」原則。
- 不新增欄位 / 不新增 type 列舉，最小擾動 baseline schema。

### 拒絕的替代方案

- **新增 `stock_transactions.type='dividend_share'` 列舉值** — 違反「最小擾動 baseline」；現有 type CHECK 為 `('buy', 'sell')`，新增列舉需 ALTER TABLE 重建約束（sql.js 不支援 DROP CONSTRAINT，需 rebuild table）。`type='buy' + price=0 + note 簽名` 等價且零 schema 風險。
- **新增 `stock_transactions.linked_dividend_id` 外鍵** — 增加 schema；連動刪除可由 note 簽名 + (stock_id, date, shares) 充分匹配。

---

## 4. 賣出鏈式約束驗證

### 決策

新增 helper `getSharesAtDate(userId, stockId, date)`：
```
SELECT COALESCE(SUM(CASE WHEN type='buy' THEN shares ELSE -shares END), 0) AS shares
FROM stock_transactions
WHERE user_id = ? AND stock_id = ? AND date <= ?
```

`POST /api/stock-transactions` 與 `PUT /api/stock-transactions/:id` 為 type='sell' 時：
1. 第一段檢查：`getSharesAtDate(userId, stockId, txDate) >= sellShares`，否則回 `400 { error: '賣出股數不可超過 YYYY-MM-DD 當下持有 (X 股)' }`。
2. 第二段檢查（鏈式約束）：模擬插入該筆賣出後，掃 `≥ txDate` 的所有交易並滾動計算每筆之後的累計持有，若任一時點 < 0 則回 `400 { error: '此交易會造成 YYYY-MM-DD 持有量為負 (預期 X 股)' }` 並指出衝突日期。

### 理由

- 滿足 Pass 3 Q2（以該交易日當下為基準 + 任一時點 ≥ 0 約束）。
- SQL 滾動計算對 < 5000 筆交易的個人帳戶在毫秒級內完成，不影響 SC-002（200ms）。
- 純後端驗證，前端 Modal 只需顯示後端 error message 即可。

### 拒絕的替代方案

- **僅以「今日持有」判定**（spec Q2 Option B）— 阻擋歷史補錄能力；使用者實務上有「今天才想到要補登去年的賣出」場景。
- **不驗證鏈式約束**（spec Q2 Option D）— 允許資料 inconsistency；後續任何「重算 FIFO」會出現負股數而崩潰。

---

## 5. 登入時 server-side 觸發排程

### 決策

在既有 login handler 成功路徑（驗證通過 + JWT 簽好之後、回 response 之前）插入 `setImmediate(() => processStockRecurring(userId).catch(noop))`：
- `setImmediate` 確保排程處理**不阻擋 login response**；error 一律 swallow（不影響登入體驗）。
- `processStockRecurring(userId)` 為共用 helper（既有 `/api/stock-recurring/process` POST 內邏輯抽出 + 補強）。

「補強」內容：
- 補產生迴圈每期改用「該期應觸發日的歷史股價」 — 透過既有 TWSE `STOCK_DAY` 歷史 API 查詢（baseline 已有 `fetchTwseStockDay(symbol, date)` 形式 helper；若無則於 `lib/twseFetch.js` 新增）。
- INSERT `stock_transactions` 時補 `recurring_plan_id` 與 `period_start_date`，採 `INSERT OR IGNORE`（依 partial unique index 自動去重）。
- 歷史股價查詢失敗時該期跳過（不阻擋後續期數），於 `last_generated` 與 `last_summary` 累計失敗原因。

### 理由

- 滿足 FR-020（登入時觸發、不引入獨立 cron）+ Pass 3 Q3（全補使用歷史股價）+ Pass 3 Q5（多裝置 idempotency）。
- 沿用既有 005 「登入時觸發」pattern；無新增 worker。
- `setImmediate` + swallow error 保證對 login UX 零影響（與 SC-005「不阻擋使用者操作 UI」一致）。

### 拒絕的替代方案

- **保持前端主動 POST `/api/stock-recurring/process`** — 違反 FR-020「server-side 自動觸發」要求；使用者忘記點按鈕就會漏期。
- **獨立 cron / setInterval tick** — 違反 spec Assumptions「不引入獨立 cron 服務」與使用者「零新依賴」要求。

---

## 6. TWSE 並發控制與重試

### 決策

新增 `lib/twseFetch.js`（純 JS、無新 npm）：
```js
async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); // 1s / 2s
    }
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const TWSE_MAX_CONCURRENCY = parseInt(process.env.TWSE_MAX_CONCURRENCY || '5', 10);

async function fetchAllWithLimit(items, fetcher) {
  const results = [];
  for (const batch of chunk(items, TWSE_MAX_CONCURRENCY)) {
    const r = await Promise.all(batch.map(it => fetcher(it).catch(e => ({ error: e }))));
    results.push(...r);
  }
  return results;
}
```

套用情境：
- `POST /api/stocks/batch-price`（批次更新所有持股）。
- `POST /api/stock-dividends/sync?year=YYYY`（單年份內處理多筆股票股利明細）。
- `processStockRecurring()` 補產生時的歷史股價查詢。
- 交易 / 股利 Modal 自動回填查價（單筆，不適用並發但仍走 fetchWithRetry）。

### 理由

- 滿足 FR-034 + Pass 4 Q3（並發 5 + 重試 2 次指數退避）。
- 純 JS helper、無新 npm、無新 CDN。
- env var `TWSE_MAX_CONCURRENCY` 提供管理員調節（如 TWSE 抗議高並發時可降）。

### 拒絕的替代方案

- **不限並發**（spec Q3 Option B）— 50 檔同時送 → TWSE rate limit 觸發 → 大量失敗。
- **並發 = 1（純序列化）**（spec Q3 Option C）— 50 檔 ≈ 50 秒，違反 SC-001 / SC-003。
- **`p-limit` npm 套件** — 違反「零新依賴」原則；30 行純 JS 即可達同效果。

---

## 7. 同步除權息阻擋式 Modal

### 決策

**後端**：`POST /api/stock-dividends/sync?year=YYYY` 接受年份參數，僅同步該年份的除權息：
- 既有同步邏輯內聯改為「依 query year 篩選」並回傳 `{ year, added, skipped, failed, details: [...] }`。
- 不引入 SSE / WebSocket / job queue；保持 RESTful 同步請求。

**前端**：
- 點下「同步除權息」按鈕 → 開啟阻擋式 Modal（`<div class="modal-blocking">` + 進度條 + 取消按鈕）。
- 計算年份範圍（使用者最早交易日年份 → 今年）。
- `for (const year of years)`：`await fetch('/api/stock-dividends/sync?year=' + year)`；每個 await 之間檢查 `aborted` flag，若 true 則 break。
- 進度條 = `(完成年份 / 總年份) × 100%`；當前處理階段顯示「正在同步 YYYY 年（X/Y 檔）」。
- 完成或取消後 Modal 自動關閉，toast 顯示彙總（三年數字加總）。

### 理由

- 滿足 Pass 2 Q1（阻擋式 Modal + 進度條 + 取消按鈕；同步式 API 呼叫不引入 job queue）。
- 按年份拆段每段 ≤ 10 秒，滿足使用者體感「進度持續推進」。
- 取消行為由前端 `aborted` flag + 跳出迴圈實現；後端不需取消邏輯（每年份是獨立 transaction）。

### 拒絕的替代方案

- **單一同步式呼叫無進度回饋**（baseline 行為）— 違反 Pass 2 Q1。
- **SSE / WebSocket 推進度** — 引入新基礎設施複雜度；對 30 秒以內的操作過度設計。

---

## 8. 整體報酬率金額加權公式

### 決策

`/api/stocks` GET response 補 `portfolioSummary`：
```js
const totalMarketValue = result.reduce((s, x) => s + (x.marketValue || 0), 0);
const totalCost = result.reduce((s, x) => s + (x.totalCost || 0), 0);
const totalPL = totalMarketValue - totalCost;
const totalReturnRate = totalCost > 0 ? (totalPL / totalCost) * 100 : null;
res.json({ stocks: result, portfolioSummary: { totalMarketValue, totalCost, totalPL, totalReturnRate } });
```

新增 `GET /api/stock-realized-pl`：
```js
// 對每筆 sell transaction 計算 realizedCost / realizedPL（sell 級 FIFO）
// 累計：totalRealizedPL / totalRealizedCost / ytdRealizedPL / count
const overallReturnRate = totalRealizedCost > 0 ? (totalRealizedPL / totalRealizedCost) * 100 : null;
```

前端：
- 讀 `portfolioSummary.totalReturnRate === null` → 顯示「—」；否則顯示百分比與三段顯色。
- 已實現損益 Tab 直接渲染 `/api/stock-realized-pl` 的 entries + summary。

### 理由

- 滿足 Pass 2 Q4（金額加權法，非簡單平均）。
- 後端聚合避免前端重算（一致 source of truth）。
- `totalCost = 0` / `totalRealizedCost = 0` 時為 `null` 而非 `0%`，前端可區分「沒資料」與「打平」。

### 拒絕的替代方案

- **前端聚合每檔 returnRate 簡單平均** — 違反 Pass 2 Q4（金額加權）；100 元賠 50% + 1,000,000 元賺 5% 會被誤算為 −22.5%。
- **時間加權 IRR / TWR** — 計算複雜度高（需要逐日 cash flow 序列）；個人記帳工具不需此精度。

---

## 9. 股票類型自動判定

### 決策

`lib/twseFetch.js` 加 helper：
```js
function inferStockType(symbol) {
  const s = String(symbol || '').trim().toUpperCase();
  // ETF: 開頭 00 + 4 碼純數字（00xx, 00xxx）
  if (/^00\d{2,3}$/.test(s)) return 'etf';
  // 權證: 6 碼以上 OR 結尾含字母
  if (s.length >= 6 || /[A-Z]/.test(s)) return 'warrant';
  // 一般: 預設
  return 'stock';
}
```

套用：
- `POST /api/stocks` 與 `POST /api/stock-transactions`（FR-014 自動新增情境）：若 body 未指定 `stockType`，伺服器以 `inferStockType(symbol)` 預設值寫入。
- 前端股票交易 Modal：輸入代號 → debounce 後本地呼叫 `inferStockType()` → 下拉選單預選 → 使用者可手動覆寫再送出。

### 理由

- 滿足 Pass 3 Q1（系統自動判定 + Modal 顯示 + 允許覆寫）。
- 純 JS regex，無新依賴。
- 涵蓋台股實況：00xx ETF（0050、0056、00878）、6 碼以上權證（04XXXW、03XXXP）、其餘 4 碼一般股票。

### 拒絕的替代方案

- **全靠使用者手動下拉**（spec Q1 Option A）— 額外點擊步驟；多數使用者不知道 0050 是 ETF（雖然懂股票的人都知道，但 fast-path 仍然不必要）。
- **依 TWSE 名稱關鍵字判定**（spec Q1 Option C）— 「ETF」字樣不一定出現於名稱（如「元大台灣 50」）；判斷不穩定。

---

## 10. 修改交易 = atomic delete + insert + 鏈式約束

### 決策

`PUT /api/stock-transactions/:id` 改寫為：
1. 開啟 SQL transaction（既有 sql.js 用 `BEGIN` / `COMMIT` / `ROLLBACK`）。
2. 讀取舊交易（拿 stock_id、type、date、shares）。
3. 模擬「刪除舊 + 插入新」的雪花狀態：在記憶體計算「若刪舊 + 插新後」≥ 舊 date 與新 date 的所有時點累計持有量。
4. 若任一時點 < 0 → ROLLBACK + 回 `400 { error: '修改會造成 YYYY-MM-DD 持有量為負' }`。
5. 通過 → 執行 `UPDATE stock_transactions SET ... WHERE id = ?`（單筆 UPDATE 等價於 atomic delete + insert，不必拆兩 SQL）+ COMMIT。

### 理由

- 滿足 FR-037 + Pass 4 Q2（atomic delete + insert + 鏈式約束驗證）。
- 一個 UPDATE 等價於 delete + insert（id 不變，但所有可變欄位重寫）；模擬則在記憶體比較。
- 透過 SQL transaction 保證原子性 — race 中失敗則回滾。

### 拒絕的替代方案

- **二次確認對話框**（spec Q2 Option B）— 無謂的 UX 阻力；使用者修改本就是有意操作。
- **限制只能改 note**（spec Q2 Option C）— 違反 FR-037 即時反映變動原則；強迫使用者刪除重建是體驗倒退。

---

## 11. TWSE 代號驗證（ASCII 防注入 + 存在性）

### 決策

前後端皆套：
```js
const SYMBOL_REGEX = /^[0-9A-Za-z]{1,8}$/;
function validateSymbol(s) {
  return typeof s === 'string' && SYMBOL_REGEX.test(s);
}
```

前端 Modal 輸入時：
- 首先 client-side validate；不通過則阻擋送出。
- 通過則 debounce 500ms 後 fetch `/api/stocks/quote?symbol=` 查價。
- 後端 `/api/stocks/quote`（既有或新增）首先 validate；不通過回 `400`；通過後送 TWSE 三段查價。
- 找到 → 綠色提示「✓ <名稱> <類型> $<價>」；找不到 → 紅色提示「找不到此股票代號」。

### 理由

- 滿足 FR-008 + Pass 3 Q4（最小防注入正則 + TWSE 存在性為主）。
- ASCII + 長度 1–8 限制覆蓋所有合法台股代號形式（4 碼一般、5 碼 00xxx ETF、6 碼權證）；多餘字元（中文、特殊符號、空白、SQL / XSS 字元）一律拒絕。
- 後端再驗一次符合 FR-008「前端與後端皆驗證」要求。

### 拒絕的替代方案

- **嚴格代號規則正則**（spec Q4 Option A）— 需要隨 TWSE 規範變動更新；ETF 槓桿 / 反向 / 期貨類代號形式多變，硬編規則維護成本高。
- **無格式驗證、單靠 TWSE 查價失敗**（spec Q4 Option B 反向）— 暴露注入風險；惡意輸入可能造成查價子系統故障。

---

## 12. 下市股票標記與處理

### 決策

`stocks` 加 `delisted INTEGER DEFAULT 0` 欄位（ALTER TABLE 冪等）：
```sql
ALTER TABLE stocks ADD COLUMN delisted INTEGER DEFAULT 0;
```

- `POST /api/stocks/batch-price` body 接受 `{ updates: [{ stockId, currentPrice, delisted }, ...] }`：
  - `delisted === true` → `UPDATE stocks SET delisted = 1, current_price = ? WHERE ...`（凍結價格為當下值）。
  - `delisted === false` → `UPDATE stocks SET delisted = 0 WHERE ...`（解除標記，恢復查價）。
  - 未指定 `delisted` → 不變動 `delisted` 欄位（向後兼容既有呼叫）。
- 所有 TWSE 查價情境（自動回填、批次更新、同步除權息、排程補產生）皆 `WHERE delisted = 0` 過濾或於 helper 內 `if (stock.delisted) return`。
- 個股卡片：`delisted === 1` 時 UI 顯示「（已下市）」紅色 badge；market value 仍以凍結價格計算。

### 理由

- 滿足 Pass 1 Q2（手動標記，系統不嘗試自動偵測）。
- 單一 `delisted` 旗標夠用；無需新增 delisted_date 欄位（凍結時間隱含於 `updated_at`）。
- `WHERE delisted = 0` 為單一閘門，所有查價路徑統一過濾，不漏網。

### 拒絕的替代方案

- **自動偵測（連續 N 個交易日查價失敗即標記）**（spec Q2 Option A）— 偽陽性風險高（例如 TWSE 連續維護）；違反「使用者掌握資料」原則。
- **不另外處理**（spec Q2 Option C）— 個股卡片永遠「查詢失敗」；體驗劣化。

---

## 摘要：本計畫的 12 個技術決策對 19 條 Clarification 的覆蓋

| # | Clarification | 對應技術決策 |
|---|---|---|
| Pass 1 Q1 | 股票股利合成交易成本 = $0 | §3 |
| Pass 1 Q2 | 下市股票手動標記 | §12 |
| Pass 1 Q3 | 批次刪除追溯 FIFO 全量重算 | §1（baseline 動態計算自然支援） |
| Pass 1 Q4 | 權證到期手動 $0 賣出 | §1（無新邏輯，FR-013 鏈式約束自然處理） |
| Pass 1 Q5 | 過期 `current_price` fallback + ⚠ 標示 | §1 + plan §11 |
| Pass 2 Q1 | 同步除權息阻擋式 Modal | §7 |
| Pass 2 Q2 | 純股票股利 accountId 選填 | §3（dividend POST 條件 required） |
| Pass 2 Q3 | 刪股利連動刪合成交易 + 退帳戶 | §3 |
| Pass 2 Q4 | 整體報酬率金額加權公式 | §8 |
| Pass 2 Q5 | 手續費先 floor 再 max | baseline `calcStockFee` audit |
| Pass 3 Q1 | 類型自動判定 + 覆寫 | §9 |
| Pass 3 Q2 | 賣出鏈式約束驗證 | §4 |
| Pass 3 Q3 | 長期未登入補產生使用歷史股價 | §5 |
| Pass 3 Q4 | TWSE 存在性 + 防注入正則 | §11 |
| Pass 3 Q5 | 多裝置 idempotency 唯一鍵 | §5 + data-model.md |
| Pass 4 Q1 | FIFO decimal.js 全精度 | §2 |
| Pass 4 Q2 | 修改交易 = atomic delete + insert | §10 |
| Pass 4 Q3 | TWSE 並發 5 + 重試 2 次 | §6 |
| Pass 4 Q4 | 損益 = 0 灰色三段式顯色 | plan §12（純 CSS） |
