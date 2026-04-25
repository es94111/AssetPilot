# Phase 0 Research：交易與帳戶

**Branch**：`002-transactions-accounts` ｜ **Date**：2026-04-25
**目的**：解析 spec 與 plan 內所有「NEEDS CLARIFICATION」與技術選型，
為 Phase 1（data-model / contracts / quickstart）提供決策依據。

---

## §1 整體 NEEDS CLARIFICATION 清單

`spec.md` 經四輪 `/speckit.clarify` 已將所有規格層 ambiguity 收斂為 20 條
Clarification（見 spec.md L12~L31）。本計畫 Technical Context 經審視後**沒
有未解的 NEEDS CLARIFICATION**——以下八項決策均於本研究文件直接拍板。

| # | 主題 | 決策 | 章節 |
| - | --- | --- | --- |
| 1 | Decimal 函式庫選型 | `decimal.js ^10.4.x` | §2 |
| 2 | 時區處理函式庫 | 不引入；用原生 `Intl.DateTimeFormat` | §2 |
| 3 | 匯率 API 重試／逾時策略 | 2s 連線逾時、單次重試、失敗走快取 fallback | §3 |
| 4 | 匯率快取去重實作 | `Map<currency, Promise>` in-flight + `Map<currency, {rate, expiresAt}>` cache | §3 |
| 5 | IPinfo / TWSE / Resend / Google IS 角色 | 002 不直接整合（屬 001／後續模組） | §4 |
| 6 | QR 解析函式庫 | `BarcodeDetector` 主、`jsQR` fallback CDN+SRI | §6 |
| 7 | 觀測性／a11y 基線 | 沿用 001（無新增）；批次操作列補 ARIA live | §7 |
| 8 | 測試策略 | 沿用 001：手動 quickstart + redocly lint，不引入測試框架 | §7 |

---

## §2 金額精度與時區

### 2.1 Decimal 函式庫選型

**決策**：採用 `decimal.js ^10.4.x`。

**理由**：

- 已是 npm 上 mature、零相依套件（17KB minified gzip），與既有
  bundle-less 架構相容。
- 支援所需的 `times`、`plus`、`round(places, ROUND_HALF_UP)` 等運算，
  API 直觀；有 [TC39 Decimal proposal](https://tc39.es/proposal-decimal/)
  方向相容性，未來語言原生 Decimal 落地時遷移成本低。
- FR-022a 公式 `twd_amount = amount × fx_rate + fx_fee` 中：`amount` 為
  整數（最小單位）、`fx_rate` 為 decimal 字串、`fx_fee` 為整數
  （TWD 元）；運算流程：

  ```js
  const Decimal = require('decimal.js');
  const amountInSmallestUnit = 10000;            // ¥10,000
  const fxRate = new Decimal('0.2103');          // JPY → TWD
  const fxFee = 31;                              // TWD 元
  const twdElem = new Decimal(amountInSmallestUnit)
    .times(fxRate)                               // ¥10,000 → TWD 元數值
    .plus(fxFee)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();                                 // 2134
  ```

**替代方案**：

| 替代 | 否決原因 |
| --- | --- |
| `big.js` | API 較陽春，缺少需要的 rounding 模式預設；`decimal.js` 為其「更完整版」共同作者所維護。 |
| `bignumber.js` | 主訴求是任意精度整數，金融場景過度通用、bundle 較大（30KB+）。 |
| 原生 `BigInt` + 自製 fixed-point 工具 | 需自寫四捨五入、字串解析；維護成本 vs 17KB dependency 不划算。 |

### 2.2 時區處理

**決策**：**不引入** `luxon` / `dayjs` / `date-fns-tz`；以原生
`Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' })` + 自製
`taipeiTime.js` 工具完成。

**理由**：

- 全系統時區單一固定為 `Asia/Taipei`（FR-007a），不需要泛時區轉換。
- Node.js 24+ 的 `Intl` 已支援所有主流時區（除非容器無 ICU；專案
  Dockerfile 沿用 `node:26-alpine`，已內建 full-icu）。
- 核心需求僅三個函式：
  - `todayInTaipei()` → `'YYYY-MM-DD'`（目前台灣日期字串）
  - `isFutureDate(dateStr)` → `boolean`（`dateStr > todayInTaipei()`）
  - `formatTaipeiDate(epochMs)` → `'YYYY-MM-DD'`（用於 log／比對）
- 引入 luxon（70KB+）為單一時區工具不符比例原則。

**實作骨架**（`lib/taipeiTime.js`）：

```js
const TPE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function todayInTaipei() {
  return TPE_FMT.format(new Date());          // 'YYYY-MM-DD'
}
function isFutureDate(dateStr) {
  return String(dateStr) > todayInTaipei();   // ISO 8601 字串可直接比較
}
module.exports = { todayInTaipei, isFutureDate };
```

**替代方案**：

| 替代 | 否決原因 |
| --- | --- |
| `luxon` | 體積偏大、API 偏全功能；本場景 overkill。 |
| `dayjs` + `dayjs/plugin/timezone` | 需要額外 plugin、SSR 重新初始化；複雜度與原生 Intl 相當但多了 dependency。 |
| 全系統儲存為 UTC、使用者時區由前端決定 | 違反 FR-007a「固定 Asia/Taipei」決策；多時區會讓「今天／未來」分區不確定。 |

### 2.3 各幣別最小單位定義

**決策**：以 hardcode 表加 `Intl.NumberFormat` 容錯。常用幣別與其
最小單位倍率：

| 幣別 | 最小單位 | 倍率 | 顯示範例 |
| --- | --- | ---: | --- |
| TWD | 元 | 1 | `$1,200` |
| USD / EUR / GBP / CNY / SGD / HKD | 分 | 100 | `$12.00` |
| JPY / KRW | 円 / 원 | 1 | `¥1,200` |
| BHD / KWD / OMR / JOD | 千分位 | 1000 | `0.123` |

**理由**：

- ISO 4217 定義之 minor unit 表為小型靜態資料，hardcode 較查 npm
  套件（如 `currency-codes`）更輕量。
- `Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits`
  可作為 hardcode 表外的 fallback（未列入表的小眾幣別）。

---

## §3 匯率 API 整合

### 3.1 對外服務契約

**API**：`https://v6.exchangerate-api.com/v6/{API_KEY}/latest/TWD`
（沿用 001 既有 `EXCHANGE_RATE_API_KEY`，免費方案 1500 req/月、僅
日更新）。

**Response 重點欄位**：

```json
{
  "result": "success",
  "time_last_update_unix": 1714003202,
  "base_code": "TWD",
  "conversion_rates": { "USD": 0.0303, "JPY": 4.7493, ... }
}
```

**注意**：此 API 以 TWD 為 base 時，`conversion_rates.JPY` 是
「1 TWD = 4.7493 JPY」；spec 需要「1 JPY = ? TWD」，故 fx_rate
= `1 / conversion_rates.JPY`（以 decimal.js 計算）。

### 3.2 重試與逾時

**決策**：

- 連線逾時 2 秒（`AbortController`）。
- 失敗最多重試 1 次（避免免費方案配額快速耗盡）。
- 兩次都失敗 → 走 fallback 鏈：(1) 30 分鐘內快取 → (2) 提示使用者
  手動輸入。
- 不阻擋儲存（FR-024 明訂）。

**理由**：

- 免費方案 1500 req/月、單使用者頻繁切換幣別需依靠快取（FR-023 跨
  使用者共用 30 分鐘快取）。
- 重試應限制單次：若外部 API 真壞，重試只會放大問題。

### 3.3 快取與 in-flight dedup

**決策**：以兩個 `Map` 完成（不引入 `node-cache` / Redis）。

```js
const inFlight = new Map();      // currency -> Promise<rate>
const cache = new Map();         // currency -> { rate, expiresAt }
const TTL_MS = 30 * 60 * 1000;   // 30 分鐘

async function getRate(currency) {
  const cached = cache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  if (inFlight.has(currency)) return inFlight.get(currency);

  const p = fetchAndCache(currency)
    .finally(() => inFlight.delete(currency));
  inFlight.set(currency, p);
  return p;
}
```

**理由**：

- spec FR-023 要求 5 分鐘 in-flight dedup + 30 分鐘 server cache；
  以 `inFlight` Map 達成「同幣別並發合併」、`cache` Map 達成「30
  分鐘內第二次查詢直接命中」。實際 5 分鐘參數其實由 in-flight 自動
  滿足（單一 promise 通常 < 5 秒），無需額外計時器。
- 單節點 sql.js 部署，不需要跨進程快取（Redis）。
- 重啟時快取清空可接受：spec 不要求持久化匯率快取（FR-022 要求
  匯率「儲存於交易」，與「跨使用者共用查詢快取」是兩件事）。

### 3.4 與既有 `exchange_rates` 表的對應

**現況**：server.js L619 既有 `exchange_rates` 表 PK 為
`(user_id, currency)`，仍是「每使用者一份」。

**決策**：002 改為「跨使用者共用」需求，故：

1. 不刪除既有表；僅 deprecate `user_id` 欄位（migration 內文以
   commen 標明），新查詢改走記憶體 cache。
2. 既有 `exchange_rate_settings` 表保留（屬使用者個人設定，例如
   是否自動更新），不改動。
3. 若日後需要服務重啟後仍命中快取，可於 `lib/exchangeRateCache.js`
   加入 DB 持久化層（將最近一次成功匯率寫入 `exchange_rates` 表，
   讀取時先讀 DB → 推進 memory cache）。本 PR 不實作此擴充。

---

## §4 IPinfo / TWSE / Resend / Google Identity Services 角色釐清

| 服務 | 規格中 references | 002 是否新增整合 | 既有 owner |
| --- | --- | --- | --- |
| IPinfo Lite | spec 未提及 | ❌ 否 | 001-user-permissions（登入稽核地理） |
| TWSE OpenAPI | spec 未提及 | ❌ 否 | 後續股票模組（既有 `stocks` 表，非 002 範圍） |
| Resend | spec 未提及 | ❌ 否 | 001（密碼重設信） |
| Google Identity Services | spec 未提及 | ❌ 否 | 001（Google SSO 登入） |

**理由**：使用者於 `/speckit.plan` 提供的 stack 字串列出了專案整體
所用技術棧，並非要求 002 全部整合。002 只負責交易與帳戶 CRUD、匯率，
其餘技術 002 不直接呼叫；但本計畫仍列入 Technical Context，便於
reviewer 理解整體環境。

若日後股票交易（TWSE）或外幣即時匯率報表納入 002 衍生需求，會於
新 feature spec 顯式建模，不在本計畫範圍。

---

## §5 樂觀鎖（Optimistic Locking）實作

### 5.1 對外契約

**決策**：所有 `PATCH` / `DELETE` 端點要求 `expected_updated_at`
（epoch ms 整數），於 request body 傳遞（不放 header，因 ETag/
If-Match 與 SPA fetch 工具相容性差）。

```http
PATCH /api/transactions/:id HTTP/1.1
Content-Type: application/json

{
  "expected_updated_at": 1714003202000,
  "amount": 12000,
  "note": "更正金額"
}
```

### 5.2 後端實作模式

```js
const row = queryOne('SELECT updated_at FROM transactions WHERE id = ? AND user_id = ?', [id, req.userId]);
if (!row) return res.status(404).json({ error: 'NotFound' });
if (row.updated_at !== body.expected_updated_at) {
  return res.status(409).json({
    error: 'OptimisticLockConflict',
    message: '此筆已被其他裝置修改，請重新整理後再操作',
    serverUpdatedAt: row.updated_at,
  });
}
const newUpdatedAt = Date.now();
db.run('UPDATE transactions SET ..., updated_at = ? WHERE id = ?', [newUpdatedAt, id]);
res.json({ ok: true, updated_at: newUpdatedAt });
```

**理由**：

- sql.js 為單節點同步呼叫，不存在 DB-side 行鎖；應用層樂觀鎖即可
  保證「兩裝置同時編輯」場景的衝突偵測。
- 不採 `version` 整數欄位（每次 +1），改用 `updated_at` epoch ms：
  - 既有 `transactions.updated_at` 欄位已存在（server.js L616），
    無需額外欄位。
  - `accounts` 表本不含 `updated_at`，本功能 migration 補欄位
    （見 [data-model.md §3](./data-model.md)）。
- ms 精度於同一筆同毫秒內被改兩次的場景極端罕見（人類操作通常
  間隔 > 100ms）；若真發生衝突，第二次仍會因 `expected_updated_at`
  不符被擋下。

---

## §6 QR 掃描元件選型（FR-030 ~ FR-032）

### 6.1 主方案：`BarcodeDetector` Web API

**決策**：行動瀏覽器優先使用 `BarcodeDetector`（Chrome Android、
Edge Android、Samsung Internet 已支援；iOS Safari 18+ 部分支援）。

```js
if ('BarcodeDetector' in window) {
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  // 對 video frame 反覆呼叫 detector.detect(videoEl)
}
```

### 6.2 Fallback：`jsQR`（CDN + SRI）

**決策**：當 `BarcodeDetector` 不存在或失敗，動態載入
`https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js`（SRI 已知
hash），以 canvas 取 pixel data 解析。

**理由**：

- iOS 桌面 Safari、舊 Android Chrome 仍需要 polyfill。
- jsQR 為純前端、純 JS、無依賴；體積 50KB，動態載入避免影響首屏。
- 與專案「外部資源以 SRI 掛載」原則一致。

### 6.3 財政部電子發票格式解析

**決策**：解析左碼（前 38 字元為發票基本資訊：發票號碼／日期／金額／
賣方統編／買方統編），右碼（明細）暫不解析（spec FR-031 只要求金額／
日期／店家寫入 note；店家以「賣方統編」反查需另一張表，本 PR 暫先
寫入「統編」字串並由使用者手動命名）。

**理由**：規格範圍縮小，避免引入賣方資料庫；後續可獨立 feature
擴充。

---

## §7 觀測性、a11y、測試策略

### 7.1 觀測性與 logging

**決策**：沿用 001 既有 `console.log` / `console.error` 風格；
不引入 `pino` / `winston`。

**理由**：

- 既有 server.js 全程使用原生 console；引入 logger framework 會擴
  散需重寫的範圍。
- Zeabur／Docker 部署時 stdout/stderr 已被平台收集。

**新增 log 點**：

- 匯率 API 失敗：`console.warn('[fx]', currency, err.message)`。
- migration 異常（REAL→INTEGER 轉換有非整數）：
  `console.warn('[migration]', txId, originalAmount)`。
- 樂觀鎖衝突：`console.info('[lock-conflict]', table, id, expected, actual)`。

### 7.2 a11y 基線

**決策**：沿用 001 既有規範；本功能新增 UI 元件補強：

- 批次操作列：`aria-live="polite"` 通報「已選 N 筆」變更。
- 表頭半選 checkbox：`aria-checked="mixed"`。
- 「未來」分區：`<section aria-label="未來交易">` 包覆。
- 紫色強調符合 WCAG AA 對比度（規格未指定具體色碼，於 style.css
  以 `#7c3aed` 加白字驗證對比度 ≥ 4.5:1）。

### 7.3 測試策略

**決策**：與 001 一致——不引入 jest / vitest，改以
[quickstart.md](./quickstart.md) 之手動 happy path + 邊界測試
checklist。

**理由**：

- 引入測試框架需要與既有 server.js（單檔 28 萬字元、無模組化）解
  耦，工作量大；且 spec 未要求自動化測試覆蓋率。
- `lib/*` 本可寫單元測試，但為避免 002 範圍蔓延，暫以「程式碼自
  documenting + 手動驗證」覆蓋。後續引入測試框架可作為獨立技術債
  feature。
- 契約合規以 `npx @redocly/cli lint specs/002-transactions-accounts/contracts/transactions.openapi.yaml`
  作為 CI 防線（可手動執行）。

---

## §8 安全與 IDOR 防線

**決策**（FR-060）：實作三層防線。

1. **`requireAuth` middleware**（既有，001 已實作）：驗證 JWT 有效。
2. **`requireOwnedAccount(req, res, next)` middleware**（**本功能新增**）：
   - 從路徑參數取 `accountId`，查 `SELECT user_id FROM accounts WHERE id = ?`。
   - 若行不存在 OR `user_id !== req.userId` → 一律 `404 Not Found`。
   - 將 `req.account = row` 暴露給 handler 使用。
3. **`requireOwnedTransaction(req, res, next)` middleware**：類似上者，
   外加檢查 `account_id` 對應帳戶亦屬同一使用者（防交叉 IDOR）。

**列表端點**：所有 `GET /api/accounts`、`GET /api/transactions` SQL
強制帶 `WHERE user_id = ?`；不接受任何 `user_id` 參數覆寫。

**轉帳端點**：`POST /api/transfers` 額外驗證 `body.fromAccountId`
與 `body.toAccountId` 都屬同一使用者，並比對 `currency` 相同
（FR-015）。

**回應策略**：無權／不存在皆回 `404`，不洩漏資源存在性，符合
OWASP API Top 10 A1。

---

## §9 風險登記

| 風險 | 嚴重度 | 緩解 |
| --- | --- | --- |
| REAL→INTEGER migration 對既有資料金額誤差 | 高 | 備份 `database.db.bak.<ts>`；migration 內每筆驗證 `Math.abs(rounded - original) < 0.01`，超出值 log + 跳過。 |
| `decimal.js` 引入導致 cold-start 時間 +50ms | 低 | 17KB dependency 影響可忽略；server start 一次性成本。 |
| `BarcodeDetector` 在 iOS Safari 16 不支援 | 中 | jsQR fallback 已涵蓋；對 iOS < 17 使用者的「掃描體驗」性能稍差但仍可用。 |
| 匯率 API 1500 req/月 配額耗盡 | 中 | 30 分鐘 server cache 已壓低呼叫頻率；極端情境（百人同時切多種幣別）走快取 + 手動輸入 fallback。 |
| 批次操作 500 筆同 transaction 對 sql.js 鎖時間 | 低 | sql.js 為單執行緒同步，500 筆 INSERT/UPDATE 預期 < 200ms；無外部用戶等待 lock 衝擊。 |

---

## §10 後續決策（不阻擋本 PR）

- 是否引入 jest 對 `lib/*` 寫單元測試 → 列入「技術債」未來 feature。
- 匯率 fallback 是否擴充為「使用者自選 fallback 數值」 → 列入後續
  「個人化偏好」feature。
- 賣方統編 → 店家名稱 mapping → 列入後續「電子發票進階解析」feature。
