# Phase 0 研究紀錄：預算與固定收支

**Branch**: `004-budgets-recurring` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔記錄 Phase 0 對 [plan.md](./plan.md) 內 9 大技術決策的調研結果。所有 NEEDS CLARIFICATION 已於 spec 三輪 `/speckit.clarify` 解決，本階段聚焦在「如何在既有 stack 上落地、替代方案為何被否決」。

---

## 1. 既有實作 baseline 盤點

### 決策

直接在 `server.js` 與 `app.js` 既有的 budgets / recurring 路由與 render 函式上擴充；**不**建立新檔案、**不**抽出 `lib/recurringProcessor.js`。

### 理由

- `budgets` / `recurring` 表已存在且已有 CRUD（server.js:5995–6115），補強範圍 < 200 行，為單一邏輯維度；抽出獨立模組會徒增 require / module-export 樣板。
- `app.js` 既有 `renderBudget()`（行 2598+）與 `renderRecurring()` 屬同一頁面渲染家族，本功能擴充延續既有模式。
- 003 已驗證「在 server.js 內就地擴充」對於 ~ 200 行邏輯的可維護性是可接受的。

### 替代方案

- **`lib/recurringProcessor.js`** — 否決：體量不足、僅 4 處呼叫者（3 登入 handler + 1 手動端點），抽出後 require 開銷大於收益。
- **獨立服務（separate worker）** — 否決：違反「不新增技術棧」約束；單節點 sql.js 不適合 IPC。

---

## 2. 產生流程的時區與月底回退邏輯

### 決策

`processRecurringForUser` 內部以 `taipeiTime.todayInTaipei()`（既有，server.js:5337 / 5456 已使用）計算「今日」字串；`getNextRecurringDate(prevIsoDate, freq)` 函式新版本使用 JavaScript `Date` 但**不**依賴 `setMonth(+1)` 自動 overflow 行為，改採以下邏輯：

```javascript
function getNextRecurringDate(prevIsoDate, freq) {
  const [y, m, d] = prevIsoDate.split('-').map(Number);
  if (freq === 'daily') {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') {
    let nm = m + 1, ny = y;
    if (nm > 12) { nm = 1; ny = y + 1; }
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate(); // 0 = 上月最後一日
    const day = Math.min(d, lastDay);
    return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    const ny = y + 1;
    // 處理 2/29 → 2/28 平年回退
    if (m === 2 && d === 29) {
      const isLeap = (ny % 4 === 0 && ny % 100 !== 0) || (ny % 400 === 0);
      const day = isLeap ? 29 : 28;
      return `${ny}-02-${String(day).padStart(2, '0')}`;
    }
    return `${ny}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}
```

使用 `Date.UTC(...)` 避免 Node 程序時區漂移（在 Asia/Taipei 部署中 Date 物件預設為 +08:00，但容器若部署於 UTC 機房則 `setMonth` 在邊界日會跨日）。`taipeiTime.todayInTaipei()` 已將「今日」鎖定在台北時區，此函式只負責「給定日期 +1 個週期」之純算術，無時區語意，UTC 計算最穩。

### 理由

- 既有 `getNextDate()`（server.js:6117）使用 `d.setMonth(d.getMonth() + 1)`：JavaScript 行為是當原日期為 1/31 + 1 month → 「3/3」（因 2/31 不存在，自動 overflow 三日）；違反 FR-022「回退至該月最後一天」。
- 替換後對 1/31 → 2/28（或 2/29 閏年）正確，5/31 → 6/30，2/29 → 隔年 2/28（平年）皆符合 FR-022 字面要求。
- 純 JS 算術，零依賴；`taipeiTime.todayInTaipei()` 既有可重用，無需引入 `luxon` / `dayjs`。

### 替代方案

- **`luxon` / `dayjs`** — 否決：違反「不新增技術棧」；單一時區（Asia/Taipei）不需重型時間庫。
- **保留 `setMonth(+1)` overflow 行為** — 否決：違反 FR-022 字面要求；使用者「每月 31 號」配方在 2 月會少產一筆。

---

## 3. 登入時機觸發 `processRecurringForUser` 的同步／非同步策略

### 決策

**混合策略：同步處理前 30 筆，超過則 `setImmediate` 背景續跑**。

```javascript
function processRecurringForUser(userId, opts = {}) {
  const maxSync = opts.maxSync ?? 30;
  let generated = 0;
  const start = Date.now();
  const recs = queryAll(
    "SELECT * FROM recurring WHERE user_id = ? AND is_active = 1 AND needs_attention = 0",
    [userId]
  );
  for (const r of recs) {
    if (generated >= maxSync) {
      // 達同步上限：剩餘交給背景
      setImmediate(() => processRecurringForUser(userId, { maxSync: Infinity }));
      break;
    }
    generated += processOneRecurring(r, userId);
  }
  if (generated > 0) saveDB();
  console.log(`[004-recurring] generated=${generated} elapsed=${Date.now() - start}ms userId=${userId}`);
  return generated;
}
```

登入 handler 三處呼叫（server.js:2522 / 2986 / 3075 緊接 `backfillDefaultsForUser`）：

```javascript
try { processRecurringForUser(user.id); } catch (e) { console.error('[004-recurring]', e); }
```

### 理由

- SC-003 要求 P95 ≤ 500ms 在補 ≤ 30 筆時；同步處理 30 筆於 sql.js 記憶體 + decimal.js 計算下 < 100ms。
- SC-004 要求 > 30 筆時不阻塞登入頁面；`setImmediate` 把剩餘工作推到當前 event loop 後續跑，HTTP response 已先送出。
- FR-028 唯一鍵保證即使 setImmediate 與下次登入在 race 也不會重複產出；FR-029 條件式 `last_generated` 推進保證不會回退覆蓋。
- 與 003 `backfillDefaultsForUser` 同款 try/catch 包裹，產生失敗不擋登入成功（spec.md edge case「產生流程中途失敗」）。

### 替代方案

- **純同步（無上限）** — 否決：違反 SC-004。
- **純非同步 fire-and-forget** — 否決：使用者登入後立即進儀表板會看到舊資料 → 閃爍 → 顯示新資料，違反 SC-006 即時性。
- **WebSocket / Server-Sent Events 推進度** — 否決：複雜度爆炸、違反「不新增技術棧」。
- **client polling（前端定時打 `/api/recurring/process`）** — 否決：耗網路、違反 FR-012 server-side 觸發語意。

---

## 4. `(source_recurring_id, scheduled_date)` 唯一性的並發冪等保證

### 決策

SQLite **partial unique index** + 應用層 `try/catch` 重複錯誤 + 條件式 `last_generated` 推進。

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_source_scheduled
  ON transactions(source_recurring_id, scheduled_date)
  WHERE source_recurring_id IS NOT NULL;
```

```javascript
try {
  db.run(
    "INSERT INTO transactions (id, user_id, type, amount, ..., source_recurring_id, scheduled_date, ...) VALUES (?, ?, ?, ?, ..., ?, ?, ...)",
    [...params, r.id, scheduledDate, ...]
  );
  db.run(
    "UPDATE recurring SET last_generated = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)",
    [scheduledDate, r.id, scheduledDate]
  );
} catch (e) {
  // SQLITE_CONSTRAINT_UNIQUE：另一個並發 session 已產出該日期；略過繼續
  if (/UNIQUE constraint failed/i.test(String(e?.message || e))) {
    // 仍要把 last_generated 條件式推進，避免無限迴圈
    db.run(
      "UPDATE recurring SET last_generated = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)",
      [scheduledDate, r.id, scheduledDate]
    );
    continue;
  }
  throw e; // 其他錯誤往外拋
}
```

### 理由

- sql.js 內部單執行緒序列寫入，但跨 session（多 tab、多裝置）的 process-level 並發仍可能在「讀完 last_generated → 計算 nextDate → 嘗試 INSERT」三步中交錯。
- partial unique index 是**資料層**保證，無需應用層鎖；對「nullable + unique」用 partial 而非 full unique（避免 NULL × NULL 也視為重複）。
- 條件式 UPDATE 確保即使 INSERT 失敗（重複錯誤 = 對手已成功插入），`last_generated` 仍會推進，迴圈不無窮。

### 替代方案

- **應用層 `Map` 鎖（per-userId）** — 否決：(a) 跨 process（如未來水平擴展）失效；(b) 複雜度高；(c) 與 sql.js single-process 假設綁死，無未來路徑。
- **Redis 分散式鎖** — 否決：違反「不新增技術棧」。
- **單一 cron job 統一觸發** — 否決：違反 FR-012「登入時機」字面要求；使用者剛登入時不希望等下次 cron。

---

## 5. 預算進度條三段配色的前端落地

### 決策

純 CSS class + JavaScript 計算 `pct` 並切換 class。

```javascript
function budgetBarClass(pct) {
  if (pct >= 1.0) return 'budget-bar--red';
  if (pct >= 0.8) return 'budget-bar--yellow';
  if (pct >= 0.5) return 'budget-bar--neutral';
  return 'budget-bar--green';
}
```

```css
.budget-bar { transition: background-color .25s ease, color .25s ease; }
.budget-bar--green   { background: #22c55e; }   /* < 50% */
.budget-bar--neutral { background: #94a3b8; }   /* 50–79% */
.budget-bar--yellow  { background: #eab308; }   /* 80–99% */
.budget-bar--red     { background: #ef4444; color: #fff; } /* ≥ 100% */
.budget-bar--red .budget-bar__pct { color: #ef4444; font-weight: 700; }
```

### 理由

- 純前端事項；後端只需提供 `used` / `amount`。
- 閾值 50/80/100 為固定值（spec round 1 Q3 確認），不需後端設定欄位。
- `transition` 0.25s 讓使用者編輯預算或新增交易後切換顏色平滑。

### 替代方案

- **後端計算 `colorTier` 並回傳** — 否決：規則固定且純展示邏輯，不該佔用 API 表面。
- **三色硬切換無 transition** — 否決：跨閾值時視覺跳動較刺眼；transition 0.25s 為小成本提升。

---

## 6. 「需處理」狀態的偵測與清除時機

### 決策

`processRecurringForUser` 在每筆配方迴圈開頭 lazy 偵測：

```javascript
function processOneRecurring(r, userId) {
  // FR-024：偵測分類／帳戶是否仍存在
  if (r.category_id) {
    const cat = queryOne("SELECT id FROM categories WHERE id = ? AND user_id = ?", [r.category_id, userId]);
    if (!cat) {
      db.run("UPDATE recurring SET needs_attention = 1 WHERE id = ?", [r.id]);
      return 0;
    }
  }
  if (r.account_id) {
    const acct = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ?", [r.account_id, userId]);
    if (!acct) {
      db.run("UPDATE recurring SET needs_attention = 1 WHERE id = ?", [r.id]);
      return 0;
    }
  }
  // …實際產生迴圈
}
```

`PUT /api/recurring/{id}` 儲存成功時自動清除：

```javascript
// FR-024b：使用者重新指定有效分類／帳戶後立即清旗標
db.run(
  "UPDATE recurring SET category_id=?, account_id=?, ..., needs_attention = 0 WHERE id = ? AND user_id = ?",
  [...params, req.params.id, req.userId]
);
```

### 理由

- Lazy 偵測（產生流程開始前才檢查）避免「分類／帳戶被刪當下立即掃描所有 recurring 改 flag」的非必要寫入。
- 偵測點與 SELECT pattern 對齊既有 `assertOwned()`（server.js）。
- 儲存時清除旗標之後**不**立即觸發產生流程（FR-024b 明示），維持「產生 = 登入觸發」的單一進入點。

### 替代方案

- **Eager：刪分類／帳戶當下即掃描所有 recurring 改 flag** — 否決：刪除一個分類可能要 UPDATE 數十筆 recurring；違反「最小副作用」原則；既有刪分類 endpoint 不適合再多一段邏輯。
- **完全靠使用者手動標記** — 否決：違反 FR-024 自動標記要求。

---

## 7. `transactions.GET` 的 `sourceRecurringName` LEFT JOIN

### 決策

既有 `GET /api/transactions` query 改為：

```sql
SELECT t.*, r.note AS source_recurring_name
FROM transactions t
LEFT JOIN recurring r ON r.id = t.source_recurring_id AND r.user_id = t.user_id
WHERE t.user_id = ? AND ...
ORDER BY t.date DESC, t.created_at DESC
LIMIT ? OFFSET ?
```

回應欄位：

```json
{
  "id": "...",
  "amount": 50000,
  "sourceRecurringId": "rec_abc123",
  "sourceRecurringName": "每月薪資",
  "scheduledDate": "2026-04-05"
}
```

`sourceRecurringName` 為 null 時前端顯示「（來源配方已刪除）」灰字。

### 理由

- LEFT JOIN 對「來源配方已刪除」的衍生交易回 null（FR-027 字面行為）。
- 加入 `r.user_id = t.user_id` 條件防 IDOR 跨使用者撈 recurring。
- `recurring.note` 在當前 schema 中是配方的「使用者自填說明」（如「房東：王小明」），語意上接近「配方名稱」；本功能不再額外加 `recurring.name` 欄位避免 schema 蔓延。

### 替代方案

- **新增 `recurring.name` 欄位** — 否決：使用者既有 `note` 用法已覆蓋此語意（spec.md 「房東：王小明」範例即是把備註當作 label 使用）；多一欄位徒增 UI / migration 工作。
- **前端額外打 `GET /api/recurring/{id}` 補名** — 否決：每筆衍生交易都打一次 = N+1 query；違反 SC-006 即時性。
- **`r.id || ''`（不 LEFT JOIN，僅回 id）** — 否決：前端要顯示名稱仍需另外查 `/api/recurring`。

---

## 8. `recurring.amount` REAL → INTEGER 對外幣配方的折算策略

### 決策

INSERT / UPDATE 路徑由 002 既有的 `convertToTwd(amount, currency, fxRate, userId)` 處理：

```javascript
const converted = convertToTwd(amount, currency, fxRate, req.userId);
// converted = { twdAmount: 9600, currency: 'USD', fxRate: '32', originalAmount: 300 }
db.run(
  "INSERT INTO recurring (..., amount, currency, fx_rate, ...) VALUES (?, ?, ?, ?)",
  [..., converted.twdAmount, converted.currency, converted.fxRate, ...]
);
```

`recurring.amount` 永遠存 INTEGER（TWD 單位）；外幣資訊（`currency` + `fx_rate`）一併存表，產生衍生交易時由 `processOneRecurring` 重算 `original_amount`：

```javascript
const rOriginalAmount = converted.currency === 'TWD'
  ? converted.twdAmount
  : Number(moneyDecimal.divide(converted.twdAmount, converted.fxRate));
db.run(
  "INSERT INTO transactions (id, ..., amount, original_amount, currency, fx_rate, twd_amount, ...) VALUES (...)",
  [..., r.amount, rOriginalAmount, r.currency, r.fx_rate, r.amount, ...]
);
```

`twd_amount = amount`（因 `recurring.amount` 已存本幣 INTEGER），`original_amount` 為外幣金額（REAL，002 已存在）。

### 理由

- 與 002 已建立的「INTEGER 本幣 + TEXT decimal 匯率 + REAL original_amount」三元組對齊。
- 外幣配方 USD 300 + 匯率 32 → `recurring.amount = 9600`（本幣）、`fx_rate = '32'`、`currency = 'USD'`；自動產出之衍生交易帶入相同三元組（FR-016）。
- 使用者後續在交易編輯頁修改該筆匯率（FR-016 後半句）→ 觸發 002 既有 `moneyDecimal.computeTwdAmount()` 重算 `twd_amount`，與本配方 `recurring.amount` 不再連動（FR-021c 不溯及既往）。

### 替代方案

- **`recurring.amount` 存外幣原始金額（REAL）** — 否決：違反 002 INTEGER 慣例；報表彙整需來回換算徒增複雜度。
- **新增 `recurring.original_amount` 欄位** — 否決：外幣金額可由 `amount / fx_rate` 反推，不需冗餘儲存；多一欄位多一致性風險。

---

## 9. OpenAPI 3.2.0 契約更新範圍

### 決策

- 新增 `specs/004-budgets-recurring/contracts/budgets-recurring.openapi.yaml`（本功能子契約，宣告 `openapi: 3.2.0`）。
- 同步更新根目錄 `openapi.yaml`：
  - `info.version` `4.24.0` → `4.25.0`
  - 新增路徑 `/api/budgets/{id}` 的 PATCH 操作
  - 修改 `Budget` schema：`amount` 由 `number` 改為 `integer`
  - 修改 `Transaction` schema：補 `sourceRecurringId` / `sourceRecurringName` / `scheduledDate` 三欄
  - 修改 `RecurringTransaction` schema：補 `needsAttention` / `nextDate` / `updatedAt` 三欄
- **不**新增 `/api/recurring/sync`、`/api/recurring/status` 等別名端點，維持既有 6 個 recurring 路徑。

### 理由

- 憲章 Principle II 規則 #2：新／改端點須與實作同 PR 更新契約。
- 憲章 Principle III：所有新／既路徑皆 slash-only，無 `:verb` 待修。
- 不擴張 API 表面：產生流程觸發時機由「登入 handler 自動 + `/api/recurring/process` 手動」雙路覆蓋，無新增端點之必要。

### 替代方案

- **新增 `POST /api/recurring/sync`** — 否決：與既有 `POST /api/recurring/process` 重複；違反「URL 表面最小變動」。
- **`info.version` 主版本 bump 至 5.x** — 否決：本功能無破壞性 API 行為變更（schema 只新增欄位、沿舊端點），minor bump 合 SemVer。

---

## 10. 不溯及既往的 SQL 護欄

### 決策

`PUT /api/recurring/{id}` handler 嚴格僅 UPDATE `recurring` 表本身，**不**對 `transactions` 表觸發任何 UPDATE：

```javascript
app.put('/api/recurring/:id', (req, res) => {
  // …欄位驗證…

  // FR-021c 護欄：本 handler 中 SQL 嚴格僅 UPDATE recurring 表
  // **MUST NOT** 在此處 UPDATE transactions（即使 amount 改變、即使 fx_rate 改變）
  db.run(
    `UPDATE recurring
     SET amount=?, category_id=?, account_id=?, frequency=?, start_date=?,
         note=?, currency=?, fx_rate=?,
         last_generated=?,  -- FR-021a: 起始日變動則 NULL；FR-021b: 否則保留
         needs_attention=?, -- FR-024b: 重新指定有效分類/帳戶則 0
         updated_at=?
     WHERE id=? AND user_id=?`,
    [...params]
  );
  saveDB();
  res.json({ ok: true });
});
```

PR 階段以 `grep -nE "UPDATE\s+transactions" server.js` 在 PUT recurring handler 範圍內驗證為 0 筆 SQL 即視為 PASS。

### 理由

- FR-021c 與 spec round 3 Q1（答 A）的字面承諾。
- 簡單明確的程式碼層護欄，比文件約束更可靠；reviewer 一眼即可審查。

### 替代方案

- **加 trigger 自動同步歷史交易** — 否決：直接違反 FR-021c。
- **加註解但不加護欄** — 否決：未來迭代者可能誤加 UPDATE；缺少程式碼層保護。

---

## 結論

所有 9 項決策皆於既有技術棧上可實作，無新增 npm dependency / 前端 CDN / 外部 API；憲章三 Gate（zh-TW / OpenAPI 3.2.0 / slash-only）皆 PASS；三項 Complexity Tracking 條目（CT-1 transactions schema 擴充、CT-2 budgets/recurring REAL → INTEGER、CT-3 登入觸發延遲）為合理化必要設計，已於 plan.md 完整記錄。

下一步：Phase 1 產出 [data-model.md](./data-model.md)、[contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml)、[quickstart.md](./quickstart.md)。
