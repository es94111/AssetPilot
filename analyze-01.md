# Specification Analysis Report — 006-stock-investments (Round 2)

**Generated**: 2026-04-26
**Artifacts analyzed**: `spec.md`、`plan.md`、`tasks.md`、`contracts/stock-investments.openapi.yaml`、`data-model.md`、`.specify/memory/constitution.md` v1.2.0
**Scope**: 39 FR（37 base + FR-024a + FR-035a）／7 SC／19 Clarifications／75 tasks
**Mode**: READ-ONLY — no files modified.

> **Note**: 本報告為第二輪分析，前一輪（Round 1）的多數 HIGH 級發現（FR-017 列表分頁、FR-018 批次刪除二次確認、`/api/stocks/batch-fetch` 契約缺項、`POST /api/stocks` `name` required 等）已於 plan/tasks/contracts 修訂中解決。本輪聚焦於新發現的不一致與覆蓋缺口。

---

## Findings Table

| ID  | Category          | Severity | Location(s)                                                                              | Summary                                                                                                       | Recommendation                                                                                                                  |
|-----|-------------------|----------|------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| C1  | Constitution      | CRITICAL | `plan.md` L152；`tasks.md` T130；`contracts/...openapi.yaml` L4                           | `/api/stocks` GET response 由 array 改為 `{stocks, portfolioSummary}` 物件 — 屬 response-shape change（破壞性），但版本僅 MINOR `4.26.0 → 4.27.0` | 依憲章 Principle II Rule #3，response-shape change MUST 為 MAJOR bump（`4.26.0 → 5.0.0`）；或於 plan.md `Complexity Tracking` 表記錄豁免理由（同 PR 已修改唯一 consumer frontend、無外部 client）。**不可沉默地以 MINOR 出貨。** |
| C2  | Constitution      | CRITICAL | `tasks.md` T044 / T056 / T064 / T075；`contracts/...openapi.yaml`（缺）                   | 多個 HTTP 端點被 plan/tasks 引用但**未在 contract 宣告**：`GET /api/stocks/quote`（T044）、`GET /api/stock-transactions`（T056 補 page/pageSize/search query 與 `{data,total,page,totalPages}` response shape）、`GET /api/stock-dividends`（T075）、`POST /api/stock-dividends/sync-all`（T064 向後兼容） | 依憲章 Principle II Rule #2「new endpoints MUST be added to the contract in the same PR」— 將上述端點加入 `contracts/stock-investments.openapi.yaml` 與根目錄 `openapi.yaml`。`GET` query/response-shape 變更亦屬 breaking → 重新評估 C1 的版號 bump 等級 |
| S1  | Schema Drift      | HIGH     | `tasks.md` T042a；`plan.md` L42-46；`data-model.md` §2 (僅列 3 變更)                      | T042a 提出「`tax_auto_calculated boolean DEFAULT 1` 欄位（若 baseline 無則本 PR 補）」— 為第 4 個 schema 變更，但 `plan.md` 與 `data-model.md` 均只列 3 個 ALTER（delisted、recurring_plan_id、period_start_date）+ 1 partial unique index | 在 `data-model.md` 補 §2.4 明確記錄 `stock_transactions.tax_auto_calculated` 欄位（含 ALTER 冪等模式、預設值、向後兼容說明）；或將 T042a 改為以既有欄位推斷（如 `tax = 0 OR tax = max(floor(amount * rate), min)` 比對）避免新增 schema |
| S2  | Inconsistency     | HIGH     | `tasks.md` T091；`plan.md` L186                                                            | T091 要求「在 [index.html](../../index.html) 股票頁區塊新增『實現損益』Tab 容器」，但 `plan.md` Project Structure 段明確標示「`index.html` 既有，無變更」 | 二擇一：(a) 修正 plan.md Project Structure 段以反映新增 Tab 容器需修改 index.html；(b) 將 T091 改為純由 `app.js` 動態插入 DOM，維持 index.html 不變 |
| S3  | Inconsistency     | HIGH     | `spec.md` SC-003（L257）vs `spec.md` FR-034 末段（L232）vs `plan.md` L112                 | SC-003 規範「含 5 年歷史 + **20 檔**不同股票…30 秒內完成」，但 FR-034 註明「**50 檔**分 10 批 × 5 並發 ≈ 30 秒」 — 同 30 秒上限但檔數規模差距 2.5 倍 | 統一規模假設：若以 20 檔為驗收基準則 FR-034 註解應改為「20 檔 × 5 並發 ≈ 12 秒」；若以 50 檔為基準則 SC-003 數字應改為 50 檔 |
| A1  | Ambiguity         | HIGH     | `tasks.md` T032                                                                            | 「若 baseline 未保留 source 資訊則先回傳 'realtime' / 'close' / 't+1' 之一**基於當前時間判斷**」— 與 FR-005 規定「依該次查詢實際使用的端點分類」直接衝突，可能誤標 stale 資料的來源 | 不允許「基於當前時間猜測 priceSource」；MUST 由 TWSE 查價 helper 在每次查詢時回傳實際使用端點，並 propagate 至 `/api/stocks` GET response |
| A2  | Ambiguity         | MEDIUM   | `spec.md` FR-017                                                                            | 每頁筆數選單「10 / 20 / 50 / 100 與**自訂**」— 「自訂」未定義輸入範圍、最大值、是否持久化                                       | 補規範：自訂筆數 ∈ [1, 200]、不持久化（每次 session 重設為 20）；或設為 [1, 100] 與下拉一致                                                  |
| A3  | Ambiguity         | MEDIUM   | `spec.md` Edge Case「TWSE 休市日未快取」（L165）                                           | 「退回僅以週末（六、日）判斷」未涵蓋彈性放假日（如除夕、清明補假）— 與 FR-022 順延邏輯衝突風險                                | 補 Edge Case：明確說明若 holiday API 失敗，**該次登入排程**改用週末判斷可能會把彈性放假日視為交易日，並於該排程執行紀錄標示「使用降級判斷」 |
| U1  | Underspecification| HIGH     | `spec.md` FR-001 末段；`tasks.md` T042a                                                    | FR-001 規定「修改持股類型 MUST 觸發該檔所有未實現/已實現損益重算」— 但未定義「重算」的具體界線：是否包含歷史 sell 交易的 `tax` 欄位重寫？是否回溯到該檔最早交易日？T042a 自行擴充為「以 `tax_auto_calculated` 旗標標示自動 vs 手動覆寫」 | 在 spec FR-001 末段或 plan「股票類型自動判定」章節補：「重算範圍包括歷史 sell tax；僅 `tax_auto_calculated=1` 的歷史 tax 會被覆寫；`tax_auto_calculated=0`（手動覆寫）保留原值」 |
| U2  | Underspecification| MEDIUM   | `spec.md` FR-013 / FR-037                                                                  | 「鏈式約束」覆寫驗證僅針對 `type='sell'` 的 INSERT；但 PUT（修改既有交易）若由「賣出 → 買入」的 type 切換，spec 未明確規範是否觸發鏈式約束 | 補 FR-037：交易修改 type 切換（buy→sell 或 sell→buy）MUST 視為 atomic delete + insert 並重跑 FR-013 鏈式約束驗證；T041 task 描述未明示此 corner case |
| U3  | Underspecification| MEDIUM   | `spec.md` FR-016；`data-model.md` §3.1                                                     | 股票股利合成 $0 交易使用 `note LIKE '%股票股利配發%'` 慣例辨識 — 若使用者**手動建立**一筆 $0 買入交易並備註含「股票股利配發」，會被誤判為合成交易並於股利刪除時連動誤刪 | 改用更嚴格的辨識方式（如新增 `synthetic_dividend INTEGER DEFAULT 0` 欄位）或於 note 開頭加唯一 prefix（如 `[SYNTH]`），避免使用者輸入碰撞 |
| U4  | Underspecification| MEDIUM   | `spec.md` FR-020 / FR-021；`tasks.md` T081                                                 | 補產生迴圈中「歷史股價查詢失敗則該期跳過」— 未規範「跳過後使用者下次補登時是否會再嘗試」；可能造成永久遺漏該期               | 補 FR-021：跳過的期數 MUST 記錄於 `stock_recurring.last_summary` 之失敗清單；未產生交易代表該期可被使用者手動補單，系統不主動重試 |
| G1  | Coverage Gap      | HIGH     | `spec.md` FR-006（TSE/TPEX fallback）；`tasks.md`                                           | FR-006「TWSE API 失敗時 MUST 自動嘗試對應的 TPEX 端點」— 在 `tasks.md` 中**無**任何 task 明確覆蓋 TPEX 端點切換；T018 僅 audit「TWSE 查價 helper」 | 在 T018 acceptance 補一句「audit 確認上市 TWSE 失敗時 fall through 至 TPEX 等同端點（OTC 上櫃股票）」；或新增 T018a 獨立 audit task |
| G2  | Coverage Gap      | MEDIUM   | `spec.md` FR-028（除權息 API 結果快取 30 分鐘）                                            | 規範「除權息 API 結果 MUST 快取 30 分鐘」— 在 `tasks.md` 中無明確 task；T062 僅抽出 `syncDividendsForYear` helper 但未提到快取層 | 將「30 分鐘 TWSE TWT49U/Detail 快取」加入 T062 acceptance；或於 plan.md 補：若 baseline 已有快取則 audit 確認 30 分鐘 TTL 一致 |
| G3  | Coverage Gap      | MEDIUM   | `spec.md` FR-022 / FR-023 / FR-024                                                         | 「排程順延至下一個交易日」「TWSE 休市日 OpenAPI fallback」「停用→啟用不補產生」— 三條 FR 皆**僅依賴 baseline**，`tasks.md` 中無明確 audit task 確認未被改寫 | 補 audit 子任務：T080 在抽出 `processStockRecurring` 時 MUST 在 acceptance 段確認原邏輯保留 nextTwseTradingDay 順延 + holiday cache + disable→enable 不補產生三條行為 |
| G4  | Coverage Gap      | LOW      | `spec.md` SC-001 / SC-002 / SC-003                                                         | 三條效能 SC 僅由 T133「跑 quickstart」覆蓋；無明確的 perf benchmark 量測步驟                                          | 在 quickstart.md 各 user story 段或 T133 acceptance 補：以 DevTools Performance 量測 SC-001 ≤ 2s、SC-002 ≤ 200ms、SC-003 ≤ 30s 並截圖留證 |
| I1  | Inconsistency     | MEDIUM   | `spec.md` FR-029 vs FR-003                                                                  | FR-003 整體報酬率公式「Σ(各檔未實現損益) ÷ Σ(各檔 FIFO 成本基礎)」；FR-029 已實現報酬率公式「Σ(各筆已實現損益) ÷ Σ(各筆 FIFO 成本基礎)」— 兩者皆稱「金額加權」但分母語意不同（持倉剩餘 vs 已賣批次） | 不需改公式（兩者皆正確），但建議於 spec 補一句「FR-003 分母為持倉剩餘 FIFO 成本；FR-029 分母為已賣批次的 FIFO 成本（手續費分攤後）」消除讀者混淆 |
| I2  | Inconsistency     | LOW      | `spec.md` FR-018 末段；`plan.md` L60                                                        | FR-018「依 note 含『股利』關鍵字」找對應 `transactions` row；但 plan.md 採 `note LIKE '%股票股利%'` — 兩處關鍵字不一致 | 統一為 `note LIKE '%股利%'`（涵蓋現金股利與股票股利兩種寫入備註）或定義專用前綴（見 U3）                                          |
| I3  | Inconsistency     | LOW      | `tasks.md` T064 vs Constitution Principle II Rule #2                                       | T064 提到「若 baseline 存在 `/api/stock-dividends/sync-all` 端點則保留向後兼容…**不**將其加入 OpenAPI 契約」— 直接違反「handler 沒有對應 paths.* entry 是 Constitution 違規」 | 若該端點實際存在則 MUST 加入 contract（標 deprecated）；或在 T064 的 audit 階段確認該端點不存在再正式刪除 |
| D1  | Duplication       | LOW      | `spec.md` FR-013 vs FR-037 末段                                                            | FR-013 賣出鏈式約束 + FR-037 修改交易 atomic delete+insert（套用鏈式約束）— 描述重疊但分別出現於兩個 FR | 在 FR-037 末段加註「鏈式約束驗證沿用 FR-013 完整邏輯」；或將鏈式約束抽為獨立 FR-013a 被 FR-013 / FR-037 同時引用 |

**Total findings**: 20（CRITICAL × 2 / HIGH × 6 / MEDIUM × 8 / LOW × 4）

---

## Coverage Summary Table

> 僅列出**有疑慮**的需求；未列出者視為已被 task 完整覆蓋。

| Requirement Key | Has Task? | Task IDs                          | Notes                                                                  |
|-----------------|-----------|-----------------------------------|------------------------------------------------------------------------|
| FR-001 (末段：類型修改重算) | ⚠️ 部分 | T042a                          | U1：重算範圍未明確；S1：tax_auto_calculated 欄位未在 data-model 宣告 |
| FR-005 (priceSource)        | ⚠️ 部分 | T018, T032                     | A1：T032 fallback 邏輯與 FR-005 衝突 |
| FR-006 (TPEX fallback)      | ❌ 缺   | —                              | **G1：無明確 task；僅 audit T018 隱含覆蓋** |
| FR-013 (賣出鏈式約束 type 切換) | ⚠️ 部分 | T015, T016, T040, T041   | U2：buy↔sell type 切換 corner case 未明確 |
| FR-016 (合成 $0 交易辨識)    | ⚠️ 部分 | T060, data-model §3.1         | U3：`note LIKE` 辨識可能誤判使用者輸入 |
| FR-017 (自訂筆數)            | ⚠️ 部分 | T056, T058, T075, T077        | A2：「自訂」筆數範圍未定義 |
| FR-021 (跳過期數重試)        | ⚠️ 部分 | T081                           | U4：跳過期數無明確重試規範 |
| FR-022 (排程順延)            | ⚠️ 部分 | （隱含於 T080 抽出時保留 baseline） | **G3：無明確 audit task** |
| FR-023 (holiday cache)       | ⚠️ 部分 | （隱含於 baseline）             | **G3：holiday cache 無明確 audit task** |
| FR-024 (disable→enable)      | ⚠️ 部分 | （隱含於 baseline）             | **G3：disable→enable 不補產生無明確 audit task** |
| FR-028 (TWT49U 30 分鐘快取)  | ❌ 缺   | —                              | **G2：除權息 API 30 分鐘快取無明確 task** |
| Edge Case (TWSE 休市日)      | ⚠️ 部分 | （隱含於 baseline）             | A3：彈性放假日 fallback 行為未明 |
| SC-001 ~ SC-003 (perf)       | ⚠️ 部分 | T133 (quickstart 統一覆蓋)     | G4：無 perf benchmark 量測步驟 |
| 其餘 31 條 FR + SC-004~006   | ✅ 完整 | —                              | 完整覆蓋於 Phase 1–9 任務 |
| SC-007 (post-launch)         | N/A     | —                              | 自承 post-launch retention，build-time 不驗收 |

---

## Constitution Alignment Issues

依 `.specify/memory/constitution.md` v1.2.0：

| Principle | Status | Note |
|-----------|--------|------|
| I — 繁體中文文件 | ✅ Pass | 所有 spec / plan / tasks / data-model / quickstart / contracts 主體皆 zh-TW；技術名詞例外條款適用 |
| II — OpenAPI 3.2.0 契約 | ❌ **CRITICAL × 2 違反** | **C1**：`/api/stocks` GET response-shape change 屬 breaking 但版本僅 MINOR bump；**C2**：`/api/stocks/quote`、`GET /api/stock-transactions`（補 query/shape）、`GET /api/stock-dividends`、`/api/stock-dividends/sync-all` 等多個端點被 plan/tasks 引用但未於 contract 宣告 — 違反 Rule #2「new endpoints MUST be added in the same PR」與 Rule #3「response-shape change MUST bump version」 |
| III — Slash-Style HTTP Path | ✅ Pass | 所有路徑純斜線；`{id}` 為合法路由參數宣告；無冒號自訂方法 |
| Workflow — 版本/契約同步 | ⚠️ Partial | T130–T132 包含同步義務；但 C1 顯示版號 bump 級別錯誤 |

---

## Unmapped Tasks

無 — 所有 75 個任務皆對應至 spec 中的至少一條 FR / SC / Clarification / Edge Case。

---

## Metrics

| Metric                                  | Value                              |
|-----------------------------------------|------------------------------------|
| Total Functional Requirements (base)    | 37                                 |
| Sub-FR (`a` 後綴)                       | 2 (FR-024a, FR-035a)               |
| **Total FR**                            | **39**                             |
| Total Success Criteria                  | 7（含 SC-007 post-launch 排除）   |
| Total Tasks                             | 75                                 |
| Tasks marked [P]（並行）                | 約 30                              |
| FR Coverage（≥ 1 task 對應）            | 39/39 = **100%**（其中 5 條僅由 baseline 隱含覆蓋，需補 audit task） |
| FR Coverage（≥ 1 task 明確指派）        | 34/39 ≈ **87.2%**                  |
| Ambiguity Count                         | 3 (A1, A2, A3)                     |
| Duplication Count                       | 1 (D1)                             |
| Coverage Gap Count                      | 4 (G1–G4)                          |
| Inconsistency Count                     | 5 (S1, S2, S3, I1, I2)             |
| Underspecification Count                | 4 (U1, U2, U3, U4)                 |
| **Critical Issues Count**               | **2 (C1, C2 — 皆 Constitution Principle II 違反)** |

---

## Next Actions

由於存在 **2 條 CRITICAL 等級的憲章違反**（C1 + C2），**強烈建議在執行 `/speckit.implement` 前先解決**：

### 必做（CRITICAL — implement 前）

1. **解決 C2（端點未列契約）**
   - 將 `GET /api/stocks/quote`、`GET /api/stock-transactions`（補 query + response shape）、`GET /api/stock-dividends`（補 query + response shape）、`POST /api/stock-dividends/sync-all`（若存在；否則 T064 改寫）加入 `contracts/stock-investments.openapi.yaml`。
   - 同步更新根目錄 `openapi.yaml`（T130 範圍）。

2. **解決 C1（版號 bump 級別）**
   - response-shape change 為 breaking → bump 應為 `4.26.0 → 5.0.0`；或於 `plan.md` 新增 Complexity Tracking 條目記錄豁免理由（如「同 PR 已修改唯一 consumer frontend、無外部 client」）。
   - 建議命令：手動編輯 `plan.md` Constitution Check 段 + `contracts/stock-investments.openapi.yaml` `info.version`。

### 強烈建議（HIGH — implement 前處理可省返工）

3. **S1**：將 `stock_transactions.tax_auto_calculated` 補入 `data-model.md` §2.4，或將 T042a 改為以既有欄位推斷（避免新增 schema）。
4. **S2**：plan.md L186 「`index.html` 既有，無變更」與 T091 「新增 Tab 容器」二擇一統一。
5. **S3**：統一 SC-003 與 FR-034 的規模假設（20 檔 vs 50 檔）。
6. **A1**：移除 T032 的「基於當前時間判斷 priceSource」fallback；強制由 TWSE helper propagate 實際 source。
7. **G1**：補 task 確認 TPEX fallback 邏輯（FR-006）。
8. **U1**：明確 FR-001 末段「類型修改觸發重算」的具體界線。

### 可在 implement 期間並行解決（MEDIUM/LOW）

9. **A2 / A3 / U2 / U3 / U4 / G2 / G3 / G4 / I1 / I2 / I3 / D1** — 屬一致性微調與註解補強，可於對應 Phase 任務內順手修正並透過 review 把關；建議於完成後執行第三輪 `/speckit.analyze` 確認。

### 推薦命令序列

```text
# 1. 修正契約缺項（C1 + C2）
手動編輯 specs/006-stock-investments/contracts/stock-investments.openapi.yaml
  - 補 GET /api/stocks/quote
  - 補 GET /api/stock-transactions（query: page/pageSize/search；response: {data,total,page,totalPages}）
  - 補 GET /api/stock-dividends（同上）
  - 確認 /api/stock-dividends/sync-all 存在性，存在則補入並 mark deprecated
  - info.version: 4.26.0 → 5.0.0（或補 plan.md Complexity Tracking 豁免條目維持 4.27.0）

# 2. 修正 plan/data-model 一致性（S1, S2）
手動編輯 specs/006-stock-investments/data-model.md
  - §2.4 補 stock_transactions.tax_auto_calculated 欄位（含 ALTER 冪等模式）
手動編輯 specs/006-stock-investments/plan.md
  - Project Structure 段：「index.html 既有，無變更」 → 「index.html 新增實現損益 Tab 容器」（或 T091 改寫）

# 3. 修正 spec 數值與行為缺口（S3, A1, U1, G1）
/speckit.specify with refinement（或手動編輯 spec.md）
  - SC-003 / FR-034 統一為「20 檔 × 5 並發 ≈ 12 秒」或「50 檔 × 5 並發 ≈ 30 秒」
  - FR-001 末段補「重算範圍包括歷史 sell tax；tax_auto_calculated=0 者保留原值」
  - FR-005 / FR-006 補 audit 註明 TWSE 失敗時 fall through TPEX

# 4. 補強任務清單（G2, G3, U2, U3, U4）
/speckit.tasks（或手動補 task）
  - 補 FR-028 30 分鐘除權息快取 audit 任務
  - 補 FR-022 / FR-023 / FR-024 audit 任務於 T080 acceptance
  - 補 FR-013 type 切換 corner case 處理任務

# 5. 進入實作
/speckit.implement
```

---

## Remediation Offer

**是否要我針對 Top 5 issues（C1 / C2 / S1 / S2 / S3）產出具體的 patch 草案（diff/edit 建議，不會自動套用）？**

可單獨選擇處理某幾項，或全部一次處理：
- 回覆 `yes C1 C2`：產出契約修正 + 版號 bump diff
- 回覆 `yes S1 S2`：產出 plan/data-model 一致性修正 diff
- 回覆 `yes all`：全部 5 項
- 回覆 `no`：直接進入 `/speckit.implement`（**不建議**在 CRITICAL 未解決時執行）

---

**Report version**: 2.0
**Analysis basis**: spec.md（4 輪 19 條 Clarification 完整）+ plan.md（含 12 大塊技術決策）+ tasks.md（75 任務 / 9 Phase）+ data-model.md（3 ALTER + 1 partial unique index）+ contracts（OpenAPI 3.2.0，2 新端點 + 多個修改端點）+ constitution v1.2.0

---

## Resolution Log（2026-04-26）

以下逐項記錄 20 條 finding 的修復狀態（**全部已修復**）：

| ID  | Severity | Status | 修復摘要                                                                                       |
|-----|----------|--------|------------------------------------------------------------------------------------------------|
| C1  | CRITICAL | ✅ FIXED | `plan.md` Complexity Tracking 表格補豁免條目（response-shape change 維持 MINOR `4.27.0`，記錄理由：唯一 consumer 為同 PR `app.js`、無外部 client；憲章 Governance §4 允許之合規路徑） |
| C2  | CRITICAL | ✅ FIXED | `contracts/stock-investments.openapi.yaml` 補 3 個 GET 端點（`/api/stocks/quote`、`/api/stock-transactions`、`/api/stock-dividends`，含分頁 query + response shape）；補 `QuoteResult`、`StockTransactionListItem`、`StockDividendListItem` schema；T064 改寫：sync-all 若存在則刪除（不允許 contract 缺項） |
| S1  | HIGH     | ✅ FIXED | `data-model.md` 新增 §2.3 `tax_auto_calculated INTEGER DEFAULT 1` 完整規範；§5 摘要表補列；plan.md 工作清單補項目 19；新增 T011a 任務於 Foundational Phase |
| S2  | HIGH     | ✅ FIXED | `plan.md` Project Structure 段更新 `index.html` 為「新增實現損益 Tab 容器（`<div id="page-stock-realized-pl">` + Tab button），其餘區塊不變動」 |
| S3  | HIGH     | ✅ FIXED | `spec.md` FR-034 末段補規模假設說明：「SC-003 規模 20 檔 × 5 並發 ≈ 12 秒（遠低於 30 秒 budget）；50 檔僅作 worst case 內部容量計算參考，不作為 SC 驗收條件」 |
| A1  | HIGH     | ✅ FIXED | `tasks.md` T032 改寫：移除「基於當前時間判斷 priceSource」fallback；T018 補規範「helper MUST 回傳實際使用端點作為 priceSource」 |
| U1  | HIGH     | ✅ FIXED | `spec.md` FR-001 末段補完整重算範圍規則：(i) 未實現損益由 FR-002 動態計算；(ii) 歷史 sell tax 僅覆寫 `tax_auto_calculated=1` 的交易；保留手動覆寫值 |
| G1  | HIGH     | ✅ FIXED | `tasks.md` 新增 T018a：audit `fetchTwseStockPrice` / `fetchTwseStockDay` 內部 TPEX fallback 路徑（TSE 200-empty 或 5xx → TPEX）；驗收條件包含手動測試上櫃股票 `/api/stocks/quote?symbol=6488` |
| A2  | MEDIUM   | ✅ FIXED | `spec.md` FR-017 補規範：自訂筆數範圍 [1, 200]，超過上限阻擋送出，不持久化每次 session 重設 20；契約 GET 端點 `pageSize` schema `maximum: 200` |
| A3  | MEDIUM   | ✅ FIXED | `spec.md` Edge Case「TWSE 休市日未快取」補降級判斷標示規則：使用週末 fallback 時 MUST 於該排程「最近執行紀錄」標示「使用降級判斷」；STOCK_DAY 缺資料自動跳過提供 fail-safe |
| U2  | MEDIUM   | ✅ FIXED | `spec.md` FR-037 補「type 切換 corner case」段：buy↔sell 切換 MUST 視同 atomic delete+insert 並完整套用 FR-013 鏈式約束 |
| U3  | MEDIUM   | ✅ FIXED | `spec.md` FR-016 改採 `[SYNTH] 股票股利` 唯一前綴；plan.md 工作清單第 1 項已同步；`tasks.md` T060 / T061 改寫精確匹配；contract `StockTransactionListItem.note` 補規範說明 |
| U4  | MEDIUM   | ✅ FIXED | `spec.md` FR-021 補「跳過期數的處理規則」：累計記錄於 `last_summary` 失敗清單；系統不主動重試；使用者可手動補單 |
| G2  | MEDIUM   | ✅ FIXED | `tasks.md` T062 補 30 分鐘 in-memory cache audit / 補強規範（`Map<key, {data, expiresAt}>`，TTL 1800000ms） |
| G3  | MEDIUM   | ✅ FIXED | `tasks.md` T080 補「G3 補強」段：明確要求 audit 並保留 (a) FR-022 nextTwseTradingDay 順延；(b) FR-023 holiday cache + 24h fallback；(c) FR-024 disable→enable 不補產生 |
| I1  | MEDIUM   | ✅ FIXED | `spec.md` FR-003 與 FR-029 各自補「註」段落，明確區分分母語意（FR-003 = 持倉剩餘 FIFO 成本；FR-029 = 已賣批次 FIFO 成本） |
| D1  | LOW      | ✅ FIXED | `spec.md` FR-037 末段補引用「套用 FR-013 完整鏈式約束驗證」並列出兩階段驗證內容 |
| G4  | LOW      | ✅ FIXED | `tasks.md` 新增 T133a：DevTools Performance / Network 量測 SC-001 / SC-002 / SC-003 並截圖留證 |
| I2  | LOW      | ✅ FIXED | `spec.md` FR-016 + `tasks.md` T060 / T061 統一規範：合成交易 note 採 `[SYNTH] 股票股利` 前綴；現金股利 transactions row note 採 `[DIV-CASH]` 前綴；連動刪除以前綴精確匹配 |
| I3  | LOW      | ✅ FIXED | `tasks.md` T064 改寫：(a) grep 確認 baseline 是否存在 `/sync-all`；(b) 若不存在 → 完成；(c) 若存在 → 本 PR 一併刪除（避免 handler 無 contract 違反 Principle II） |

**修復檔案清單**：
- `specs/006-stock-investments/spec.md`（10+ 段補強）
- `specs/006-stock-investments/plan.md`（Complexity Tracking 豁免、Project Structure index.html、工作清單補 4 項、II Gate 端點清單）
- `specs/006-stock-investments/data-model.md`（§2.3 tax_auto_calculated、§5 摘要表）
- `specs/006-stock-investments/tasks.md`（新增 T011a / T018a / T133a；改寫 T012 / T013 / T018 / T032 / T060 / T061 / T062 / T064 / T080；更新 Phase 統計總任務數 75 → 78）
- `specs/006-stock-investments/contracts/stock-investments.openapi.yaml`（新增 3 GET 端點、3 schema、StockTransactionListItem 補 taxAutoCalculated 與 note SYNTH 規範）

**驗證建議**：可重新執行 `/speckit.analyze` 第三輪確認無新增 finding，再執行 `/speckit.implement`。
