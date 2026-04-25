# Quickstart：交易與帳戶手動驗證流程

**Branch**：`002-transactions-accounts` ｜ **Date**：2026-04-25
**對象**：開發者於本機完成 002 實作後，依本文件逐步操作即可驗收所有
規格主路徑與 8 項 SC（Success Criteria）。

> **前置**：001-user-permissions 已完成且使用者可以註冊／登入。
> 本機 Node.js 24+、`npm install` 已執行（含本功能新增的 `decimal.js`）。

---

## §0 環境準備

```bash
# 1. 確認 .env 內含
EXCHANGE_RATE_API_KEY=your_api_key   # 沿用 001；free 方案 1500 req/月
JWT_SECRET=...                       # 001 已設

# 2. 啟動服務（HTTPS 本機）
npm start                            # 監聽 https://localhost:3000

# 3. 測試帳號
# 以瀏覽器至 https://localhost:3000，註冊新使用者 a@example.com / Pa$$w0rd!
```

---

## §1 US1（P1, MVP）：建立帳戶與第一筆收入支出

### 1.1 確認預設「現金」帳戶（FR-002）

1. 註冊完成後進入儀表板。
2. **預期**：左側「帳戶管理」分區顯示：
   - 帳戶名稱：`現金`
   - 餘額：`$0`
   - 圖示：`fa-wallet`（錢包圖示）
   - 類別：`現金`
   - 幣別：`TWD`
   - 是否計入總資產：`是`

### 1.2 新增銀行帳戶

1. 點「新增帳戶」按鈕 → 開啟 Modal。
2. 填入：
   - 名稱：`台新銀行`
   - 初始餘額：`50000`
   - 圖示：`fa-university`
   - 類別：`銀行`
   - 幣別：`TWD`
3. 送出。
4. **預期**：列表新增 `台新銀行 $50,000`。

### 1.3 新增第一筆支出

1. 進入「交易」頁，點「新增交易」。
2. 填入：類型 `支出` / 分類 `餐飲 → 午餐` / 金額 `120` / 日期 `今天` /
   帳戶 `現金` / 備註 `麥當勞`。
3. 送出。
4. **預期**：
   - 列表最上方顯示 `2026-04-25 支出 -$120 現金 餐飲>午餐 麥當勞`。
   - 「現金」帳戶餘額變為 `-$120`。

### 1.4 邊界：金額 0 與負值

1. 重開新增 Modal，金額輸入 `0` → 送出。
2. **預期**：前端阻擋；訊息「金額必須大於 0」。
3. 同步以 curl 繞過前端驗證：

   ```bash
   curl -X POST https://localhost:3000/api/transactions \
     -H 'Content-Type: application/json' --cookie "token=<JWT>" \
     -d '{"accountId":"<id>","type":"expense","amount":0,"currency":"TWD","date":"2026-04-25"}' -k
   ```

   **預期**：HTTP `400`、body 含 `"error":"ValidationError","field":"amount"`。

### 1.5 未來日期：FR-013 + FR-007（不影響當下餘額）

1. 新增交易：金額 `5000`、日期 = 下個月 5 日（如 `2026-05-05`）、
   分類 `購物 → 家電`、帳戶 `台新銀行`。
2. **預期**：
   - 列表「未來」分區顯示該筆。
   - 「台新銀行」帳戶餘額仍為 `$50,000`（未變動）。
   - 儀表板「總資產」仍為 `$50,000 - $120 = $49,880`（未來那筆不計入）。
3. 將電腦時間調至 `2026-05-05` 後重整頁面（或於 DB 直接修改該筆 `date`
   為昨天驗證），餘額才會反映 `-$5,000`。

✅ **SC-001**：以碼錶計時 1.1~1.3 流程，預期 < 60 秒。
✅ **SC-002**：餘額更新延遲（按下送出 → 列表刷新）目視 < 1 秒。

---

## §2 US2（P1, MVP）：交易列表、篩選、分頁、排序

### 2.1 建立 60 筆測試資料

於開發者主控台執行：

```js
// 於瀏覽器 DevTools console（已登入）
for (let i = 0; i < 60; i++) {
  await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      accountId: '<現金 id>',
      type: i % 2 === 0 ? 'expense' : 'income',
      amount: 100 + i,
      currency: 'TWD',
      date: '2026-04-25',
      categoryId: '<餐飲 id>',
      note: i % 5 === 0 ? '咖啡' : `測試 ${i}`,
    }),
  });
}
```

### 2.2 分頁（FR-051）

1. 開啟交易頁，預設每頁 20、共 3 頁、依 `date DESC` 排序。
2. 切「每頁 50」→ 共 2 頁、第 2 頁顯示 10 筆。
3. 切「每頁自訂 = 37」→ 共 2 頁、第 2 頁顯示 23 筆。
4. 自訂輸入 `501` → 前端阻擋並提示「每頁最多 500 筆」。
5. curl 繞過前端：`GET /api/transactions?pageSize=501` → `400 PageSizeOutOfRange`。

### 2.3 篩選與關鍵字（FR-050）

1. 搜尋欄輸入 `咖啡` → 列表僅留下 12 筆（i = 0, 5, 10, ..., 55）。
2. 搜尋欄輸入 `  咖啡  `（前後空白）→ 同樣 12 筆（FR-050 trim）。
3. 搜尋欄輸入 `KAFI` → 0 筆（規格只搜備註）；改 `咖啡` 含中文部分匹配
   驗證 case-insensitive（混入 `Coffee` 備註後再驗）。
4. 篩選類型 `轉帳` → 列表僅 transfer_in/out（轉帳資料先建於 §3）。

### 2.4 排序狀態與 URL 還原（FR-050 + FR-052）

1. 點「金額」欄表頭切 ASC → URL 變為 `...?sort=amount_asc`。
2. 複製 URL、開新瀏覽器分頁貼上 → 排序與分頁狀態完整還原。
3. 嘗試 10 種組合：`date_asc`、`date_desc`、`amount_asc`、`amount_desc`、
   `account_asc`、`account_desc`、`category_asc`、`category_desc`、
   `type_asc`、`type_desc`，每種排序均應作用。

### 2.5 儀表板總資產與排除（FR-004）

1. 編輯「台新銀行」帳戶 → 開啟「不計入總資產」開關。
2. 回儀表板：總資產卡顯示「已排除 1 個帳戶」、僅加總「現金」餘額。
3. **同時驗證**：月支出統計仍包含台新銀行所屬交易（FR-004 已釐清「僅
   影響總資產卡」）。

✅ **SC-007**：URL 還原成功；複製到無痕視窗（重新登入後）狀態一致。

---

## §3 US3（P2）：信用卡轉帳

### 3.1 建立信用卡帳戶

1. 新增帳戶：類別 `信用卡`、名稱 `台新無限卡`、初始餘額 `0`、
   幣別 `TWD`、海外刷卡手續費率 `1.5%`。
2. 編輯該帳戶 → `linked_bank_id` 連結到「台新銀行」。

### 3.2 信用卡消費

1. 新增交易：類型 `支出`、帳戶 `台新無限卡`、金額 `3000`、
   日期 今天、分類 `購物 → 家電`。
2. **預期**：信用卡餘額 `-$3,000`、月支出統計 `+$3,000`。

### 3.3 還款轉帳（FR-015）

1. 新增交易：類型 `轉帳`、來源 `台新銀行`、目標 `台新無限卡`、
   金額 `3000`、日期 今天。
2. **預期**：
   - `transactions` 表新增 2 列、共享 `linked_id`。
   - 信用卡餘額 `$0`、銀行餘額減 `-$3,000`。
   - 月支出統計**不變**（FR-016 排除 transfer_*）。

### 3.4 一鍵還款捷徑（FR-003）

1. 帳戶頁信用卡分組顯示 `台新無限卡 餘額 -$3,000` 與「還款」按鈕。
2. 點按鈕 → 開啟轉帳 Modal、預填「目標 = 台新無限卡 / 金額 = $3,000」。
3. 選來源 `台新銀行` → 送出。

### 3.5 刪除一半（FR-015）

1. 列表選 `transfer_in`（信用卡那筆）→ 刪除。
2. **預期**：二次確認 Modal 提示「對應 transfer_out 將一併刪除」。
3. 確認 → 兩筆同時消失；兩個帳戶餘額同步回復。

✅ **SC-004**：以 100 組轉帳壓測（DevTools script 跑一輪）後查
`SELECT type FROM transactions WHERE linked_id NOT IN (...)` 應為 0 筆孤兒。

### 3.6 跨幣別禁止（FR-015）

1. 新增 `美金活存` 帳戶（USD）。
2. 開轉帳 Modal：來源 `台新銀行`（TWD）/ 目標 `美金活存`（USD）→
   送出按鈕 disabled、提示「跨幣別請分開記一筆支出 + 一筆收入」。
3. curl 繞過：`POST /api/transfers` → `422 CrossCurrencyTransfer`。

---

## §4 US4（P2）：批次操作

### 4.1 全選與半選

1. 列表載入 50 筆，點表頭全選 → 全部勾選、紫色批次操作列「已選 50」。
2. 取消其中 5 筆 → 表頭 `aria-checked="mixed"`、批次列「已選 45」。

### 4.2 批次變更分類（FR-043）

1. 勾選 20 筆 → 點「批次變更分類」→ 自訂下拉（含色點 + 父子分區）。
2. 選 `娛樂 → 電影` → 套用。
3. **預期**：選中的 20 筆「分類」欄即時重繪、其他不受影響。

### 4.3 批次刪除（含轉帳）（FR-042）

1. 勾選 3 筆，含 1 筆 transfer_in。
2. 點「批次刪除」→ 確認 Modal「共 3 筆含 1 組轉帳（連動另一半，
   實際刪除 4 筆）」。
3. 確認 → 4 筆同時消失。

### 4.4 批次上限與原子性（FR-044, FR-045）

1. 嘗試勾選 501 筆 → 前端阻擋第 501 個 checkbox、提示「已達單次上限 500」。
2. curl 繞過：`POST /api/transactions:batch-delete` body `{ "ids": [501 筆] }`
   → `400 BatchTooLarge`。
3. 構造一筆 `expected_updated_at` 不符的 ids（含 1 筆過期）一起送出 →
   `409 OptimisticLockConflict`、整批不生效（驗證 atomic）。

✅ **SC-005**：100 筆批次刪除 P95 < 3 秒（瀏覽器 Performance tab 量測）。

---

## §5 US5（P2）：外幣與匯率

### 5.1 切幣別自動匯率（FR-020）

1. 新增交易 Modal：類型 `支出` / 帳戶 `美金活存`（已建於 3.6）。
2. 切幣別 → 帳戶 currency 為 USD；自動呼叫匯率 API。
3. **預期**：`fxRate` 欄位 2 秒內填入（如 `0.0303`）；TWD 等值欄即時
   計算（金額 100 USD → TWD `$3,300` 等）。

### 5.2 信用卡海外手續費（FR-021）

1. 切類型 `信用卡帳戶`（先建一張 USD 信用卡，`overseas_fee_rate = 150`）。
2. 切幣別 USD、金額 `100`。
3. **預期**：UI 顯示「海外刷卡手續費 1.5% = TWD `$50`」（可手動
   覆寫至 `0` 驗證）。

### 5.3 匯率快取（FR-023）

1. DevTools Network tab 觀察。
2. A 使用者首次切 JPY → 看到 `GET /api/exchange-rates/JPY` →
   後端對外打 `https://v6.exchangerate-api.com/...`。
3. 5 分鐘內 B 使用者也切 JPY → 後端**不重複呼叫外部**（檢查 server log
   看 `[fx-cache HIT]`）；回應 < 100ms。
4. 等 30 分鐘後再切 JPY → 後端重新呼叫（cache 過期）。

### 5.4 匯率 API 失敗 fallback（FR-024）

1. 暫時將 `EXCHANGE_RATE_API_KEY` 改為錯誤值、重啟。
2. 切幣別 → 後端走快取（若有）；無快取則回 `503` + 提示「匯率暫不可
   用，請手動輸入」。
3. 手動輸入後仍可儲存。

### 5.5 已儲存交易匯率固化（FR-022, SC-006）

1. 完成一筆 USD 交易、記下其 `fxRate`（如 `0.0303`）。
2. 模擬匯率變動：直接於 DB 改 `exchange_rates.rate_to_twd` 為 `0.0500`。
3. 重整列表 → 該筆原幣 ¥10,000、`fxRate` 仍為 `0.0303`、TWD 等值不變。

---

## §6 US6（P3）：電子發票 QR 掃描

### 6.1 桌面瀏覽器 fallback

1. 桌面 Chrome 開新增交易 Modal → 「掃描發票」按鈕。
2. **預期**：因 `BarcodeDetector` 不存在 → 改顯示「上傳圖片」介面。
3. 上傳一張含財政部電子發票 QR 的圖片 → 解析、自動填入金額／日期／
   店家統編。

### 6.2 行動瀏覽器主路徑

1. 以手機 Chrome（Android）開啟同一頁。
2. 點「掃描發票」→ 授權鏡頭 → 對準 QR → 3 秒內欄位自動填入。

### 6.3 解析失敗

1. 上傳一張無 QR 的圖片 → 提示「無法解析電子發票 QRCode」。
2. **驗證**：使用者已手動填入的金額／備註不被清空（FR-032）。

---

## §7 樂觀鎖／IDOR 安全測試

### 7.1 樂觀鎖衝突（FR-014a）

1. 開兩個瀏覽器分頁，分別編輯同一筆交易。
2. 在 A 分頁送出（成功）→ 切到 B 分頁送出（其 `expected_updated_at`
   為更新前的舊值）。
3. **預期**：B 分頁收到 `409 OptimisticLockConflict`、UI 提示「此筆
   已被其他裝置修改，請重新整理後再操作」、不允許強制覆寫。

### 7.2 IDOR（FR-060）

1. 以 a@ex.com 登入，記下其交易 ID `tx-A`。
2. 以另一帳號 b@ex.com 登入。
3. curl `GET /api/transactions/tx-A`（cookie 為 b 的 token）。
4. **預期**：`404 Not Found`（不是 403、不洩漏存在性）。
5. 以同樣手法測 `PATCH`、`DELETE`、`/api/accounts/...`、批次操作 `ids`
   含他人 ID → 全部 `404`。

---

## §8 帳戶刪除引用檢查（FR-006, SC-008）

1. 嘗試刪除「現金」帳戶（仍有交易引用）→ `422 AccountInUse`、
   `referenceCount: <筆數>`、UI 提示「請先處理該帳戶上的 N 筆交易
   （可批次移到其他帳戶或刪除）」。
2. 刪除一個無交易引用的全新帳戶 → 成功（204）。

✅ **SC-008**：100% 拒絕含引用之刪除請求；錯誤訊息明確。

---

## §9 既有 v3.x 資料庫升級（CT-1）

> 若 reviewer 由 main branch checkout 後切到本功能 branch，
> `database.db` 內已有舊格式（REAL 欄位）的資料。

### 9.1 升級流程

1. **備份**：服務啟動前 `cp database.db database.db.bak.before-002`。
2. 啟動 002 程式碼 → server log 應顯示：

   ```text
   [migration] backup → database.db.bak.<ts>
   [migration] accounts: REAL→INTEGER + add columns category/overseas_fee_rate/updated_at
   [migration] transactions: REAL→INTEGER (amount/fx_fee), REAL→TEXT (fx_rate), add to_account_id/twd_amount
   [migration] exchange_rates: rebuild (drop user_id; PK=currency)
   [migration] user_settings: created
   [migration] self-test PASSED
   ```

3. 開儀表板 → 既有帳戶餘額**完全不變**（驗證 migration 無誤）。
4. 既有交易詳情頁 → `fxRate` 顯示為 `1`、TWD 等值 = `amount`（TWD 交易
   無誤）。

### 9.2 失敗回滾

1. 若任一 self-test 失敗 → server log 顯示 `[migration] FAILED`、
   提示備份檔位置。
2. 停服務、`cp database.db.bak.<ts> database.db`、checkout main → 重啟
   恢復 v3.x 狀態。

---

## §10 OpenAPI 契約驗證

```bash
# 驗證本功能子契約
npx @redocly/cli lint specs/002-transactions-accounts/contracts/transactions.openapi.yaml

# 驗證根契約已同步加入新端點
npx @redocly/cli lint openapi.yaml

# 兩份 openapi 字串檢查
grep '^openapi:' openapi.yaml
grep '^openapi:' specs/002-transactions-accounts/contracts/transactions.openapi.yaml
# 兩者皆應為 `openapi: 3.2.0`
```

---

## §11 完成度清單

實作完成後逐一勾選：

- [ ] §1 US1（FR-001~FR-007）：預設帳戶、新增帳戶、新增收支、邊界。
- [ ] §2 US2（FR-018, FR-050~FR-052）：列表、篩選、分頁、排序、URL 還原。
- [ ] §3 US3（FR-015, FR-016）：信用卡消費、轉帳、刪除連動、跨幣別禁止。
- [ ] §4 US4（FR-040~FR-045）：批次選取、變更、刪除、上限、原子性。
- [ ] §5 US5（FR-020~FR-024）：自動匯率、海外費、快取、失敗 fallback、固化。
- [ ] §6 US6（FR-030~FR-032）：QR 掃描、上傳 fallback、解析失敗。
- [ ] §7（FR-014a, FR-060）：樂觀鎖衝突、IDOR 防線。
- [ ] §8（FR-006, SC-008）：帳戶刪除引用檢查。
- [ ] §9（CT-1）：v3.x → v4 migration、self-test、回滾驗證。
- [ ] §10：契約 lint pass、`openapi: 3.2.0` 字串字面相等。
- [ ] `changelog.json` 已加入 002 release entry。
- [ ] `SRS.md` 版本歷史已更新。
- [ ] 根目錄 `openapi.yaml` 已同步本功能新增的所有端點。
