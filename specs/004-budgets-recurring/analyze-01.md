# Specification Analysis Report — 004-budgets-recurring

**Branch**: `004-budgets-recurring` | **Date**: 2026-04-25 | **Mode**: STRICTLY READ-ONLY
**Artifacts analysed**: [spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml)、[quickstart.md](./quickstart.md)、[.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.2.0）

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **I1** | Inconsistency | **HIGH** | plan.md（Project Structure / Source Code 章節 app.js 註解）vs tasks.md T043 | **Plan 說「移除原本 client-trigger `/api/recurring/process` 呼叫（app.js:554；改由 server-side 登入時觸發）」**；**Tasks T043 卻寫「**保留**作為 backup ... **決議：保留**」**。同一決策兩處互斥。 | 二擇一定案：(a) 與 server-side 觸發一致 → 修 T043 為「移除 app.js:554 的 client trigger」；(b) 與 stock-recurring 對稱 → 修 plan 註解為「保留 client trigger 作備援」。建議採 (b) 因冪等保護已在資料層、保留客戶端觸發是 zero-cost backup。 |
| **A1** | Ambiguity | **MEDIUM** | spec.md FR-021（行 165）vs Assumption（行 212）vs plan.md Constraints | FR-021 寫「（類型欄位的可變性依專案治理另議，預設不可變）」用 hedge 語氣；Assumption 與 plan Constraints 皆已明示「不可變」；hedging 句式造成讀者疑慮「是否真的不可變」。 | 將 FR-021 該括號改為「**MUST NOT** 變更類型欄位；變更類型須走刪除後重建流程（與 003-categories 對 `categories.type` 對稱治理）」。 |
| **A2** | Ambiguity | **MEDIUM** | spec.md FR-012（行 156）vs Assumptions（行 213）vs plan.md Phase 0 §3 | FR-012 規定「登入」**與**「背景排程觸發」兩個時機；Assumption 把「背景排程」推延為未來工作；plan 也明示 v1 僅 on-login。FR-012 字面承諾未在 v1 兌現。 | 兩種修法擇一：(a) 將 FR-012 改為「系統 MUST 在使用者登入時觸發；背景排程屬未來範疇（OUT-003）」並補 OUT-003 至 spec；(b) 增 OUT-003 條目「不做伺服器端 cron / worker 排程」並在 FR-012 加註「v1 僅 on-login，cron 屬未來」。建議 (b)。 |
| **D1** | Documentation | **LOW** | plan.md Summary、tasks.md 開頭 | 兩處皆寫「**33 base FR + 9 sub-FR = 36 FR**」；列舉的 sub-FR 為 6 條（009a / 021a / 021b / 021c / 024a / 024b）；實際 base = 29、sub = 6、總 = 35。算式本身（33+9 ≠ 36）不通；總數也與實況不符。 | 改為「**29 base FR + 6 sub-FR = 35 FR + OUT-001/002**」。 |
| **C1** | Coverage Gap | **LOW** | spec.md FR-009（行 149）| 「預算 MUST NOT 自動結轉至下個月；每月預算彼此獨立、不繼承不累計」— tasks.md 中**無**直接對應任務；目前以 FR-002 唯一性 + 月份綁定 query 隱式滿足。 | 在 T030（GET /api/budgets）任務描述補一句「每次查詢僅回傳 `WHERE year_month = ?` 該月，**不**做跨月聚合或 `LAG()` 結轉計算」作為驗收文字。 |
| **U1** | Underspecification | **MEDIUM** | spec.md FR-025（行 174）vs research.md §7 vs tasks.md T072 / T074 | FR-025 字面是「**配方名稱**」；研究與任務以 `recurring.note` 作為 name（無 `recurring.name` 欄位）。`note` 為空時 chip 顯示「📌 來自配方：」尾段空白，UX 不佳；spec / plan / tasks 皆未定義空 note 的 fallback。 | 三選一決策：(a) 落到 plan/tasks：T072 LEFT JOIN 改 `COALESCE(NULLIF(r.note, ''), '（未命名配方）')`；(b) 在 spec.md `RecurringTransaction` 新增 `name` 必填欄位（觸發 schema 變更）；(c) 前端 T074 對 `sourceRecurringName === ''` 顯示「📌 來自配方（未命名）」。建議 (a)：最小改動、對既有 note-only 模型相容。 |
| **U2** | Underspecification | **LOW** | tasks.md T035 | T035 使用 `taipeiTime.monthInTaipei(new Date())`；既有 `lib/taipeiTime.js` 僅暴露 `todayInTaipei`、`isValidIsoDate`，未確認 `monthInTaipei` 是否存在。若不存在須在本任務先補此 helper（屬無新增 dependency 但需擴充 lib）。 | T035 描述補：「若 `lib/taipeiTime.js` 無 `monthInTaipei` 函式，先補一個 `monthInTaipei(date)` helper 取 `todayInTaipei(date).slice(0, 7)`，僅本檔擴充、不引入新 dependency」。 |
| **I2** | Inconsistency | **LOW** | tasks.md Phase 4 T044 vs Phase 5 T050 | T044 [US2] 做「三日期卡片基本顯示」；T050 [US3] 做「色階分流邏輯（含 pending 黃色 + needsAttention 紅橘）」。spec 將「三日期顯示」歸 US3（「卡片同時顯示：起始日、上次產生日、下次產生日」於 US3 描述），但 tasks 把基本顯示拉到 US2。可能造成 US3 完成前 US2 已部分含 US3 內容、不純獨立。 | 可接受（基本資訊渲染屬列表頁基線、警示色才是 US3 增量）；若要嚴格獨立性可：把 T044 移到 [US3] 並標於 T050 之前，US2 phase 留空白。建議**維持現狀**並在 T044 末尾註記「此項邏輯上隸屬 US3 但出於 list 頁基線需求提前於 US2 phase 實作」。 |
| **I3** | Inconsistency | **LOW** | spec.md US1 Acceptance Scenarios（行 41–46）| Scenario 編號順序為 `1, 2, 3, 6, 4, 5`（第 4 個 bullet 是 #6）。是 round-2 clarify 補入時插隊造成的順序錯亂。 | 重新編號為 `1, 2, 3, 4, 5, 6`（純文字編輯，不改語意）。 |
| **U3** | Underspecification | **LOW** | spec.md FR-026 / FR-009 vs tasks.md | FR-026「刪除衍生交易 MUST NOT 連帶影響來源配方或其 `last_generated`」與 FR-009「不結轉」皆屬「不該發生的事」；tasks.md 沒有顯式驗證任務（僅 quickstart §6.4 / §2.x 手動驗證）。 | 在 T094（不溯及既往護欄 grep）旁補同款 grep：`grep -nE "DELETE\s+FROM\s+recurring|UPDATE\s+recurring.*last_generated" server.js` 驗證 `app.delete('/api/transactions/:id', ...)` handler 範圍內無此類 SQL。 |
| **U4** | Underspecification | **LOW** | spec.md SC-001 / SC-002 / SC-006 / SC-007 | 時間性 SC（90s / 120s / 200ms）僅依靠 quickstart §7 手動計時；SC-007（90% 留存）為 post-launch metric 無 build-time 驗證可能（已正確排除於 buildable 範疇）；SC-006 後端能精確驗，但前端 200ms 須含 render，缺指標收集機制。 | 屬既有專案無自動化測試框架慣例，不引入新基礎設施。建議在 quickstart §7 補一句「DevTools Performance 面板錄影前後頁；附 console.time / console.timeEnd 的 hand-written 標記點（不引入監控 stack）作為 SC-006 客觀驗證手段」。 |
| **D2** | Documentation | **LOW** | plan.md / tasks.md 多處（plan.md 提及 server.js 行號 5995、6012、6034、6043 等；tasks.md T030 / T031 / T032 同樣引用） | 依 003 已 squash merge 至 dev，server.js 後續 commit 可能造成行號漂移；以行號當錨點對 reviewer 有用，對未來迭代者價值衰減快。 | 任務 review 階段以「函式名 + grep pattern」當主要錨點（如「`app.get('/api/budgets', ...)` handler」），行號當輔助。實作時若行號已漂可直接搜函式簽章。**不需任何文件變動**，本項列為記錄性提示。 |
| **U5** | Underspecification | **LOW** | spec.md FR-009a / Plan / contracts | 任意月份開放（FR-009a）— 但「未來月份」上限未定。理論上可建立 9999-12 預算。spec / plan 未限制；contracts schema 用 regex `^[0-9]{4}-(0[1-9]|1[0-2])$` 接受 0001-9999。 | 屬合理預設（個人工具不需嚴格上限）。若要收緊可在 T031 補 server-side 檢查 `year >= 2000 && year <= 2099` 範圍。**建議不改**（接受 spec 的「不限制」字面要求）。 |
| **U6** | Underspecification | **LOW** | spec.md FR-016 / FR-021c | FR-016 規定「外幣配方產生交易時帶入配方當下匯率」；FR-021c 規定「配方匯率變更不溯及既往」。但若使用者將配方 currency 從 USD 改為 EUR — 是否觸發新匯率寫入下次衍生交易？plan / tasks 未明示。 | T070 PUT handler 描述已含 `currency` 與 `fx_rate` 在 UPDATE 欄位中；下次產生流程自動讀新值。**屬隱式正確行為**，可在 T070 末尾補一句「currency / fx_rate 變更後，下次新產出之衍生交易使用新值；歷史衍生交易不變（FR-021c）」明示。 |

---

## Coverage Summary（FR 與 buildable SC）

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 兩種粒度 | ✅ | T031 | POST validates 兩種模式 |
| FR-002 同月唯一性 | ✅ | T013, T031 | partial unique index + 409 訊息 |
| FR-003 正整數 TWD | ✅ | T031, T032, T038, T045 | 前後端共驗 |
| FR-004 leaf-only | ✅ | T031, T037 | server `parent_id != ''` + 前端 optgroup |
| FR-005 進度條顯示 | ✅ | T030, T034 | 含已用 / 預算 / % / 剩餘 |
| FR-006 四段配色 | ✅ | T034, T038 | JS class + CSS 四 class |
| FR-007 月份切換器 + 即時重算 | ✅ | T030, T035 | 後端不快取、前端 nav |
| FR-008 編輯/刪除 | ✅ | T032, T036, T033 | PATCH 端點 + UI |
| FR-009 不結轉 | ⚠ implicit | （建議補入 T030 描述） | 隱式滿足；見 C1 |
| FR-009a 任意月份 | ✅ | T012, T013（無範圍約束） | 隱式由 schema 設計 |
| FR-010 本幣彙整 | ✅ | T030 | `SUM(twd_amount)` |
| FR-011 配方欄位 | ✅ | T040, T045 | 8 欄位完整 |
| FR-012 登入觸發 | ✅ | T022, T023, T042 | server-side hook |
| FR-013 產到今日 | ✅ | T021 | `while scheduledDate <= today` |
| FR-014 首產日邏輯 | ✅ | T021（含 `start_date` 為首） | 隱含於 processOneRecurring |
| FR-015 last_generated 中途失敗 | ✅ | T021 | 條件式推進 |
| FR-016 外幣帶匯率 | ✅ | T040, T071 | convertToTwd + INSERT |
| FR-017 停用略過 | ✅ | T022 | `WHERE is_active = 1` |
| FR-018 三日期 + 備註 | ✅ | T044, T051 | 卡片渲染 |
| FR-019 待執行警示 | ✅ | T041, T050, T052 | nextDate 計算 + 黃色 class |
| FR-020 佔位下拉 | ✅ | T061, T062 | server reject + 前端插入 |
| FR-021 CRUD 不刪歷史 | ✅ | T070 | 含 DELETE 守則 |
| FR-021a 起始日 reset | ✅ | T070 | 條件分支 |
| FR-021b 週期保留 | ✅ | T070 | 條件分支 |
| FR-021c 不溯及既往 | ✅ | T070, T094 | 程式碼層護欄 + grep 驗證 |
| FR-022 月底回退 | ✅ | T020 | getNextRecurringDate 重寫 |
| FR-023 時區 | ✅ | T021, T022 | todayInTaipei usage |
| FR-024 自動標需處理 | ✅ | T021, T060 | lazy detect |
| FR-024a 紅橘色階 | ✅ | T050, T063, T064 | UI 三層分流 |
| FR-024b 儲存清旗標 | ✅ | T070 | UPDATE 含 needs_attention=0 |
| FR-025 source_id + chip | ✅ | T071, T072, T074 | + LEFT JOIN（U1：note 為空 fallback 待補）|
| FR-026 編輯/刪除權限同 | ✅ | T074, T075 | chip 純資訊 |
| FR-027 來源配方刪除退化 | ✅ | T072, T074 | LEFT JOIN null → 灰字 chip |
| FR-028 唯一鍵冪等 | ✅ | T011, T021 | partial unique + try/catch |
| FR-029 條件式推進 | ✅ | T021 | UPDATE WHERE last_generated < ? |
| OUT-001 不做智慧偵測 | n/a | — | 不在範圍 |
| OUT-002 不做推播通知 | n/a | — | 不在範圍 |
| SC-001 90s 預算設定 | ✅（手動）| quickstart §2 + T095 | 計時驗收 |
| SC-002 120s 配方設定 | ✅（手動）| quickstart §3 + T095 | 計時驗收 |
| SC-003 P95 ≤ 500ms | ✅ | T022（console.log）+ T095 | DevTools Network 量測 |
| SC-004 5s for >30 | ✅ | T022（setImmediate）+ quickstart §3.5 | 50 筆壓測 |
| SC-005 連登 10 次冪等 | ✅ | T011 + T021 + quickstart §3.5 SQL | 唯一鍵保護 |
| SC-006 P95 ≤ 200ms | ✅（手動）| quickstart §2.4 + T095 | DevTools Network |
| SC-007 90% 留存 | ⏭ post-launch | — | 排除（business KPI） |
| SC-008 0 筆靜默清空 | ✅ | T061, T062 + quickstart §5.2 | 拒絕佔位值 |

---

## Constitution Alignment Issues

**無違反**。三條 Principle 皆通過：

- **[I] 繁體中文文件規範**：✅ 所有 artifact 皆 zh-TW；識別字／套件名為例外，符合憲章字面允許範圍。
- **[II] OpenAPI 3.2.0 契約**：✅ [contracts/budgets-recurring.openapi.yaml](./contracts/budgets-recurring.openapi.yaml) `openapi: 3.2.0`；T090 計畫同步根目錄 `openapi.yaml` bump 4.24.0 → 4.25.0；T093 強制 `npx @redocly/cli lint` 0 error。
- **[III] Slash-Style HTTP Path**：✅ 新增 `PATCH /api/budgets/{id}` 為 slash；既有路徑（`/api/recurring/{id}/toggle`、`/api/recurring/process`）皆 slash-only；Express `:id` 為路由參數 sigil（憲章允許例外）。

---

## Unmapped Tasks

無。51 個任務皆對應至少一個 FR 或基礎設施（Setup / Foundational / Polish）。

---

## Metrics

| 指標 | 值 |
|---|---|
| Total Functional Requirements | **35**（29 base + 6 sub；OUT-001/002 不計） |
| Total Buildable Success Criteria | **7**（SC-007 為 post-launch 排除） |
| Total Tasks | **51** |
| FR Coverage（≥1 task） | **34 / 35 = 97%**（FR-009 為 implicit；C1 建議補述） |
| SC Coverage（buildable，≥1 task）| **7 / 7 = 100%** |
| Overall Coverage | **41 / 42 = 97.6%** |
| Ambiguity Count | **3**（A1, A2, U1）|
| Duplication Count | **0** |
| Inconsistency Count | **3**（I1 HIGH, I2 LOW, I3 LOW）|
| Underspecification Count | **6**（U1 ~ U6） |
| Documentation Issues | **2**（D1 計數錯誤、D2 行號漂移提示） |
| **Critical Issues** | **0** |
| **High Issues** | **1**（I1：plan vs tasks T043 互斥）|
| **Medium Issues** | **3**（A1, A2, U1）|
| **Low Issues** | **9** |

---

## Next Actions

**HIGH 級唯一一條（I1）必須在 `/speckit.implement` 前處理**：plan.md 與 tasks.md 對於「app.js:554 client-side `/api/recurring/process` 是否保留」的決策互斥。建議立即定案。

**MEDIUM 級三條建議在實作前處理**：
- **A1**（FR-021 type 不可變的 hedge 語句）— 5 分鐘 spec 修文。
- **A2**（FR-012 背景排程在 v1 兌現範圍）— 5 分鐘 spec 修文（補 OUT-003 或加註）。
- **U1**（`recurring.note` 為空時 chip 顯示空白）— 在 T072 加 COALESCE fallback 即可，5 分鐘 task 描述修文。

**LOW 級**屬文件清理或實作時可順手處理；不阻擋進入實作階段。

### 建議命令（依優先序）

1. **手動編輯 plan.md / tasks.md** 解決 I1（最快）；或：
   ```
   /speckit.specify  # 若 A2 想升級為新 OUT-003 條目
   ```
2. 解決 MEDIUM 後可進：
   ```
   /speckit.implement
   ```
3. 若仍有疑慮可：
   ```
   /speckit.analyze  # 重跑此分析驗證解決效果
   ```

---

## Remediation Offer

是否要我為 **I1 / A1 / A2 / U1** 四項提出具體的 patch（diff 形式）以便您 review 後手動套用？我**不會**自動修改任何檔案 —— 僅輸出建議文字，您決定是否採納。

回覆 `yes` 我便產出 patch；回覆 `no` 或繼續其他指令則跳過。
