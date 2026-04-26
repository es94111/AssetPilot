# Specification Analysis Report — 006-stock-investments

**Generated**: 2026-04-26
**Scope**: Cross-artifact consistency analysis across `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/stock-investments.openapi.yaml`, and `.specify/memory/constitution.md` v1.2.0
**Mode**: READ-ONLY — no files modified.

---

## Findings Table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | HIGH | spec.md FR-001 (L176); tasks.md T014 (L54) | FR-001 規定 ETF 為「開頭 00 且為**4 碼純數字**」，但範例列出 `00878`（5 碼）。T014 自行擴充為「00xx **4–5 碼** → ETF」，但 spec 未同步更新。 | 修正 spec FR-001 為「開頭 00 且為 4–5 碼純數字（如 0050、0056、00878）→ ETF」，與 T014 / `inferStockType` 實作對齊。 |
| I2 | Inconsistency | HIGH | tasks.md T111; contracts/stock-investments.openapi.yaml | T111 引用 `/api/stocks/batch-fetch` 端點（「若無則新增」），但 OpenAPI 契約完全未宣告該端點。違反憲章 Principle II rule #2「new endpoints MUST be added to the contract in the same PR」。 | 在 contracts/stock-investments.openapi.yaml 補上 `/api/stocks/batch-fetch` POST 定義，或將 T111 改為複用既有 `/api/stocks/batch-price` 路徑。 |
| G1 | Coverage Gap | HIGH | spec.md FR-017; tasks.md (none) | FR-017 要求「依代號/名稱下拉搜尋 + checkbox 多選 + 批次刪除 + 每頁筆數可選（10/20/50/100/自訂）+ 伺服器端分頁」。tasks.md 無任何任務 (T030 ~ T135) 處理交易/股利清單頁面的搜尋、分頁或多選 UI 與後端 list endpoint 分頁參數。 | 新增 Phase 4/5 任務：(a) `/api/stock-transactions` 與 `/api/stock-dividends` GET 補 query params `page` / `pageSize` / `search` 並回 `{data, total, page, totalPages}`；(b) 前端列表頁加搜尋下拉 + 分頁 + 多選 UI。或於 tasks.md 明示「沿用 baseline」並 traceability 註記。 |
| G2 | Coverage Gap | HIGH | spec.md FR-018; tasks.md (none) | FR-018「批次刪除 MUST 經過二次確認對話框，列出將刪除的筆數」。Phase 3–9 無任何任務建立此 confirmation modal。 | 新增任務（US3 phase 或 polish 階段）：在交易/股利列表頁批次刪除按鈕 onclick 開啟二次確認 Modal，顯示待刪筆數，使用者確認後才呼叫 DELETE。 |
| I3 | Inconsistency | MEDIUM | tasks.md T072; contracts/stock-investments.openapi.yaml | T072 條件式提到 `/api/stocks/earliest-date` 端點（「若無則新增」），但契約未宣告。同樣違反契約優先原則。 | 若實作確需該端點則補入契約；否則前端改以已載入的 stock_transactions 資料於客戶端推算最早日期。 |
| I4 | Inconsistency | MEDIUM | tasks.md T064 | T064 提到「既有單一同步端點（如 `POST /api/stock-dividends/sync-all`，若有）保留為手動觸發 alias」— 此 `/sync-all` 路徑未在契約宣告，且名稱與既有 baseline 不確定。 | 確認 baseline 是否已有 `/sync-all`；若有則同步入契約，若無則刪除 T064 或改寫為「手動觸發改透過前端逐年呼叫 `/api/stock-dividends/sync` 達成」。 |
| I5 | Inconsistency | MEDIUM | plan.md L217; tasks.md T030, T090 | plan.md 宣告「`lib/moneyDecimal.js` 新增 `calcFifoLots(transactions, dividendShares)` 函式」，但 T030 採用「inline 重構 FIFO 段為 Decimal」、T090 提到「可抽出為 `calcFifoForStock(stock, txs)` 共用」。函式名稱不一致且未明確抽出至 `lib/`。 | 對齊 plan.md 與 tasks.md：(a) 確認最終函式名（採 `calcFifoLots` 或 `calcFifoForStock` 一致）；(b) 在 T030 後新增「將 FIFO 邏輯抽出至 `lib/moneyDecimal.js`」子任務；(c) T090 改為呼叫該共用 helper。 |
| I6 | Inconsistency | MEDIUM | contracts/stock-investments.openapi.yaml L215; spec.md FR-014, US2.2 | OpenAPI `POST /api/stocks` requestBody `required: [symbol, name]`，但 FR-014 + US2.2 規定 TWSE 查詢失敗時系統可自動以「（未命名）」建立持倉（`name` 由伺服器補齊）。契約強制 `name` 為必填與規格預期不一致。 | 將 `name` 由 `required` 中移除（保持為選填），契約 description 補「省略時伺服器以 TWSE 查詢結果自動填入；查詢失敗以『（未命名）』為 placeholder」。 |
| G3 | Coverage Gap | MEDIUM | spec.md FR-001 末段 | FR-001「後續修改持股類型 MUST 觸發該檔所有未實現 / 已實現損益重算（因稅率變動會影響歷史 FIFO 計算）」。tasks.md 無任務涵蓋 stock-type 修改路徑（無 PUT `/api/stocks/{id}` 任務、無 trigger 重算）。 | 新增任務：(a) `/api/stocks/{id}` PUT 端點補 stockType 修改入口；(b) 修改後不需顯式重算（FR-002 動態計算原則 + T030 已採每次 GET 重算 → 自然反映），但需在 spec/plan 註明此「動態計算 = 修改即生效」對應方式，避免實作者誤建立快照表。 |
| G4 | Coverage Gap | MEDIUM | spec.md FR-014; tasks.md T043 | FR-014 規定 TWSE 查詢失敗時「以『（未命名）』與股價 0 建立並允許後續批次更新」。T043 僅補 `inferStockType` 自動判定，未明示「（未命名）」fallback 路徑。 | 在 T043 描述補「TWSE 查詢失敗時 `name` 預設為『（未命名）』、`current_price` 預設為 0」；或新增獨立子任務記錄此 fallback 行為。 |
| G5 | Coverage Gap | MEDIUM | spec.md Edge Cases L162 | Edge Case「歷史代號改名」要求「同步時系統 MUST 以最新查到的名稱更新 `stocks.name` 欄位」。tasks.md 無任務涵蓋 TWSE 查價成功後的 `stocks.name` 自動 sync 路徑（既有 baseline 是否有？未驗證）。 | 在 T101 / T018 audit 既有 TWSE 查價 helper：成功取回 name 時 `UPDATE stocks SET name = ? WHERE id = ? AND name <> ?`；若 baseline 已有則於 T018 註明「audit 確認」即可。 |
| A1 | Ambiguity | MEDIUM | spec.md FR-007; Edge Cases L160 | FR-007 規定查詢失敗顯示紅色提示「找不到此股票代號」，但 Edge Case 區分兩種失敗：(a) 「TWSE API 暫時失敗（首次新增情境）」與 (b) 「無效代號 9999」。spec/UI 未指明 UI 是否區別這兩種紅色提示文案；亦未說明「TWSE 服務 5xx」與「symbol not found 但 API 200」的後端判斷邏輯。 | 補 spec 微調：失敗類型分流 — TWSE 5xx / network → 「股價服務暫時無法回應」（黃色 ⚠）；TWSE 200 但無此代號 → 「找不到此股票代號」（紅色 ✗）。前端 fetch wrapper 依 status code 與 response body 判斷。 |
| G6 | Coverage Gap | LOW | contracts/stock-investments.openapi.yaml | 契約未宣告 `DELETE /api/stock-transactions/{id}` 或批次刪除端點，但 FR-017 明示「checkbox 多選 + 批次刪除」implies DELETE endpoint 存在。 | 補契約 DELETE `/api/stock-transactions/{id}` 與（若採批次）`POST /api/stock-transactions/batch-delete`（slash-only kebab-case，符合 Principle III）。 |
| G7 | Coverage Gap | LOW | spec.md FR-005; contracts schema PriceSource | OpenAPI `PriceSource` enum 含 `frozen`（用於下市股票），但 spec FR-005 三段策略僅列即時/收盤/T+1。`frozen` 未在 spec 文字明確列舉。 | 在 FR-005 或 FR-035a 補一句「下市股票價格來源標記為 `frozen`，不再進行 TWSE 查價」。 |
| A2 | Ambiguity | LOW | spec.md SC-005; tasks.md T081 | SC-005「排程觸發 ≤ 3 秒（持股 < 50、排程 < 20）」未涵蓋「長期未登入補產生」情境（T081）。若使用者 5 年未登入、20 筆排程，每筆每月補 → 60 期 × 20 = 1200 次 TWSE STOCK_DAY 歷史查詢，遠超 3 秒。 | 在 SC-005 註明：「3 秒上限僅針對單期觸發；長期未登入補產生採非同步 fire-and-forget（setImmediate），不阻擋 login response」。或於 plan.md 設專屬 SC 量測補產生情境。 |
| U1 | Underspecification | LOW | spec.md SC-007 | SC-007 自行標註「post-launch user retention metric，本功能 build-time 不直接驗收」— 已知缺口，但仍列於 Measurable Outcomes 段落，可能引發 reviewer 期待 build-time 驗證。 | 將 SC-007 移至 Spec.md「Out of Scope（驗收範疇）」或新增「Post-Launch Metrics」段落，避免與其他可驗收 SC 混雜。 |

**Total findings**: 16（HIGH × 4、MEDIUM × 8、LOW × 4）

---

## Coverage Summary Table

> 僅列出**有疑慮**的需求；未列出者視為已被 task 覆蓋。

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001（類型自動判定） | 部分 | T014, T042, T043 | 自動判定 OK；末段「修改類型觸發重算」無任務（G3） |
| FR-014（TWSE 失敗自動以「（未命名）」建立） | 部分 | T043 | 未明示 fallback name（G4） |
| FR-017（搜尋/多選/分頁） | ❌ 缺 | — | 完全無任務（G1） |
| FR-018（批次刪除二次確認） | 部分 | T030, T031（FIFO 重算）/ T061（連動） | 二次確認 Modal 缺任務（G2） |
| Edge Case 歷史代號改名 | ❌ 缺 | — | 無 stocks.name 自動 sync 任務（G5） |
| SC-005 排程觸發 ≤ 3s | 部分 | T080–T083 | 長期未登入補產生情境未涵蓋（A2） |
| SC-007 90% 用戶 30s 內判斷盈虧 | N/A | — | 自承 post-launch retention，build-time 不驗收（U1） |
| 其餘 33 條 base FR + 2 sub-FR + 5 SC | ✅ | — | 完整覆蓋於 Phase 1–9 任務 |

---

## Constitution Alignment Issues

| Principle | Status | Note |
|-----------|--------|------|
| I — 繁體中文文件 | ✅ Pass | 所有 spec / plan / tasks / data-model / quickstart / contracts 主體皆 zh-TW；技術名詞例外條款適用。 |
| II — OpenAPI 3.2.0 契約 | ⚠️ Partial | `openapi: 3.2.0` 字串正確；但 **I2 / I3 / I4 / G6** 顯示部分 task 引用的端點未在契約宣告，違反「contract-first PR」rule #2。 |
| III — Slash-Style HTTP Path | ✅ Pass | 所有路徑 `/api/...` 純斜線；`{id}` 為合法路由參數；無冒號自訂方法。 |
| Workflow — 版本 / 契約同步 | ✅ Pass | plan.md 已宣告 `info.version 4.26.0 → 4.27.0`、changelog/SRS 同 PR 更新；T130–T132 包含此義務。 |

---

## Unmapped Tasks

無 — 所有 68 個任務皆對應至 spec 中的至少一條 FR 或 SC。

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Functional Requirements (base) | 37 |
| Sub-FR (`a` 後綴) | 2 (FR-024a, FR-035a) |
| **Total FR** | **39** |
| Total Success Criteria | 7 (含 1 條 post-launch 排除驗收) |
| Total Tasks | 68 |
| Tasks marked [P]（並行） | 27 |
| FR Coverage（≥ 1 task） | ~90%（37/39 完整、2 條部分缺口：FR-017 / FR-018 二次確認） |
| Ambiguity Count | 2 (A1, A2) |
| Duplication Count | 0 |
| Coverage Gap Count | 7 (G1–G7) |
| Inconsistency Count | 6 (I1–I6) |
| Underspecification Count | 1 (U1) |
| **Critical Issues Count** | **0**（無憲章 MUST 違反；HIGH 級為契約／spec 一致性問題，不阻塞 implement） |

---

## Next Actions

**整體判斷**：無 CRITICAL 或憲章 MUST 違反，**可進入 `/speckit.implement` 階段**，但建議先處理 4 個 HIGH 級問題以避免實作期間返工：

### 建議優先處理（implement 前）

1. **修正 I1**：spec.md FR-001 文字 4 碼 → 4–5 碼（一行修改）。
2. **修正 I2**：將 T111 的 `/api/stocks/batch-fetch` 補入 `contracts/stock-investments.openapi.yaml` 並同步至根目錄 `openapi.yaml`，或 T111 改用既有 `/api/stocks/batch-price` 路徑（GET 變體）。
3. **補強 G1 + G2**：在 tasks.md Phase 4 / Phase 5 補列表頁分頁與批次刪除二次確認 Modal 任務（5–8 個 task），或於 plan.md 明示「沿用 baseline 既有列表 UI 與分頁實作，本功能不變動」。

### 可在 implement 期間並行解決

4. I3 / I4 / I5 / I6 / G3 / G4 / G5 / G6 / G7 / A1 / A2 / U1 — 屬一致性微調與註解補強，可於對應 Phase 任務內順手修正並透過 review 把關。

### 推薦命令序列

```text
# 1. 修正 spec 微調
/speckit.specify with refinement
   - 修正 FR-001 「4 碼純數字」→「4–5 碼純數字」
   - FR-014 補 fallback name「（未命名）」明示
   - 拆分 SC-007 至獨立 Post-Launch Metrics 段落
   - FR-005 補 frozen 第四種來源標記
   - FR-007 區分 TWSE 5xx / 找不到 兩種失敗類型

# 2. 修正契約缺項
手動編輯 specs/006-stock-investments/contracts/stock-investments.openapi.yaml
   - 補 /api/stocks/batch-fetch POST
   - 補 DELETE /api/stock-transactions/{id} （與批次端點，若採用）
   - POST /api/stocks 將 name 由 required 移除
   - 確認 /api/stocks/earliest-date 與 /api/stock-dividends/sync-all 是否需要

# 3. 補強任務清單
/speckit.tasks
   - 在 Phase 4 / 5 補入 FR-017 列表頁分頁 + 搜尋 + 多選 任務
   - 補 FR-018 批次刪除二次確認 Modal 任務
   - 補 FR-001 修改持股類型路徑（PUT /api/stocks/{id}）

# 4. 進入實作
/speckit.implement
```

---

## Remediation Offer

是否需要我針對 Top 4 HIGH 級問題（I1 / I2 / G1 / G2）提供具體的編輯建議（具體應修改的行號與替換文字）？回覆「yes」我將產出可直接套用的 patch 草案（仍由你決定是否套用，本指令不會自動修改任何檔案）。

---

**Report version**: 1.0
**Analysis basis**: spec.md（4 輪 19 條 Clarification 完整）+ plan.md（含 12 大塊技術決策）+ tasks.md（68 任務 / 9 Phase）+ data-model.md（3 ALTER + 1 partial unique index）+ contracts（OpenAPI 3.2.0，1 新端點 + 6 修改端點）+ constitution v1.2.0
