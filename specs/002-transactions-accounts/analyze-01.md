# Specification Analysis Report — 002-transactions-accounts

**Run date**：2026-04-25
**Artifacts analysed**：
- `specs/002-transactions-accounts/spec.md`（6 US / 38 FR identifiers / 8 SC / 20 Clarifications）
- `specs/002-transactions-accounts/plan.md`
- `specs/002-transactions-accounts/tasks.md`（78 tasks across 9 phases）
- `specs/002-transactions-accounts/research.md`（cross-referenced for documented deferrals）
- `.specify/memory/constitution.md` v1.1.0

**Mode**：Read-only。本報告僅輸出發現項目與建議，未修改任何輸入文件。

---

## Findings Table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage Gap | **HIGH** | spec.md:220 (FR-017) ↔ tasks.md:201 (T072) | spec FR-017 規定 `exclude_from_stats=true` 之交易「不影響儀表板、分類統計、預算進度」，但 T072 只追加 `AND type IN ('income','expense')` 過濾 transfer，**未追加 `AND exclude_from_stats = 0`**。結果：欄位寫入可運作，但統計 SQL 仍會把被使用者標記排除的交易計入。 | T072 SQL 條件補上 `AND exclude_from_stats = 0`；於 quickstart 增加一筆 §3.x 驗收（建立 1 筆 expense 標記 exclude_from_stats=true → 月支出不增加）。 |
| I1 | Inconsistency | **HIGH** | spec.md:236 (FR-031) ↔ research.md:317 ↔ tasks.md:309 (T132) | spec FR-031 明文：「解析財政部電子發票**左右二維條碼**」「自動填入金額、日期、**店家名稱**」。research.md §6.3 已決定「右碼暫不解析、店家以**賣方統編字串**代填，使用者手動命名」；T132 與 research 對齊，但 spec.md 從未更新。三份文件互相矛盾。 | 三選一：(a) 更新 spec FR-031 與 US6 Acceptance #2，明確降級為「左碼解析 + 統編寫入備註，店家名稱由使用者手填」；(b) 補一條 task 解析右碼並查表得店家名稱；(c) 於 spec 加 Clarification 把右碼／店家名稱列為「Phase 2 範圍外」。建議採 (a)，與 research 一致。 |
| C2 | Coverage Gap | **HIGH** | tasks.md:133 (T047) | T047 註解明文「US5 之前先以『同 currency 即直接累加、跨幣別暫不換算（過渡作法）』處理」，但 US5 的 T110~T124 沒有任何任務回頭把儀表板總資產卡改為呼叫匯率快取做 TWD 換算。結果：跨幣別總資產卡將永遠呈現錯誤值（直接相加不同幣別）。 | 在 Phase 7 (US5) 末追加一條任務（如 T125）：「於 `app.js` 儀表板 `renderTotalAssets` 改用 `lib/exchangeRateCache` 快取的 `rateToTwd` 將每帳戶 currentBalance 換算為 TWD 後再加總；非 TWD 帳戶顯示原幣餘額 + TWD 等值兩列」。並於 quickstart §5.x 補驗收。 |
| C3 | Coverage Gap | MEDIUM | spec.md:269-274 (SC-002 ~ SC-005) | SC-002（餘額更新 P95<1s）、SC-003（匯率自動填入 P95<2s、cache 命中<100ms）、SC-004（100 組轉帳壓測無 orphan）、SC-005（批次 100 筆 P95<3s）均為**可量測**之 buildable 目標，但 tasks.md 未安排任何 benchmarking／load-test／PerfTimer 任務。tasks.md 開頭明示「不引入測試框架」，但量測工具與壓測腳本仍可獨立寫成 quickstart 章節。 | 兩選一：(a) 於 quickstart.md 補 §10.x 章節，提供 `curl + GNU time` 或 `autocannon` 一行式量測腳本，並列入 T147 驗收；(b) 將四項 SC 改為「Acceptance criterion，量測在 Phase 9 polish 之後手動驗證」並降級 wording。 |
| I2 | Inconsistency | MEDIUM | plan.md:181 ↔ tasks.md:320 (T140) | plan.md Constitution Check 段寫「`info.version` 起始 `0.1.0`；後續 breaking change 將 bump minor」；T140 卻寫「currentVersion 由 `4.22.0` bump 至 `4.23.0`」並把整個 openapi.yaml 視為從 4.22.0 起算。兩處對 `openapi.yaml` `info.version` 的初始值定義不同（`0.1.0` 還是已存在的 4.22.0？）。 | 釐清：本 PR 是**首次**為 `openapi.yaml` 寫入 `info.version` 還是延續 001 已存在的 4.22.0？若延續，則改 plan.md「起始 0.1.0」為「沿用既有 4.22.0，本 PR bump 至 4.23.0」；若獨立計版，則 T140 改為「`info.version` `0.1.0` → `0.2.0`」並與 changelog `currentVersion` 解耦。 |
| C4 | Coverage Gap | MEDIUM | spec.md:8 (commit message) ↔ spec.md (FR section) | spec.md 標頭與 commit message 統計為「34 FR」，實際 FR identifiers 共 **38**（含 FR-007a/014a/020a/022a 四個 `a` 後綴變體）。plan.md:8 同樣寫「34 FR」。這個小落差會干擾後續報表／檢核表計數。 | 統一定義：是否將 `a` 後綴計入 FR 總數？建議：spec.md 與 plan.md 改為「34 base FR + 4 `a`-suffix sub-FR = 38 total」並於開頭加一句註腳。 |
| I3 | Inconsistency | MEDIUM | tasks.md:201 (T072) | T072 直接寫死「既有 `server.js:3134` 與相關 dashboard SQL」。`server.js` 已 28 萬字元，行號隨 PR 演進極易飄移；任務文件變動成本高。 | 改為以 anchor 描述（如「既有 `app.get('/api/dashboard/monthly-expense', ...)` handler」）替代行號；其餘多處任務（T011 server.js:592、T012 server.js:602、T022 server.js:873）同樣處理。 |
| I4 | Inconsistency | MEDIUM | plan.md:38 ↔ tasks.md:82 (T020) ↔ tasks.md:272 (T112) | plan.md 規畫「`ownsResource(table, id, userId)` 通用 helper」；T020 卻為 accounts／transactions 各寫一個專屬 middleware（`requireOwnedAccount`、`requireOwnedTransaction`），無通用版。T112 自承「user_settings PK 即 user_id，需修改 helper 接受 PK 欄位名稱或寫一段 inline 比對」——亦即 T112 已預期會偏離 plan。 | 二選一：(a) 在 T020 同時抽出 `ownsResource(req, table, idColumn, idValue)` 通用 helper，三條 middleware 都改為呼叫它；(b) 更新 plan.md §5 IDOR 段落改寫為「per-resource middleware」，與 T020 對齊。建議 (a)，避免 T112 inline 比對破壞中介層一致性。 |
| C5 | Coverage Gap | MEDIUM | spec.md:227 (FR-021) ↔ tasks.md:273 (T113) | FR-021 規定「使用者可於當筆交易**手動覆寫**費率與金額」；T113 後端僅在「body 未提供 fxFee」時填入預設值，且註明「若 body 提供 fxFee 則直接使用」。**前端 T123** 顯示「(可調整)」並提供「不收手續費」勾選，但**未明確規範前端如何將「使用者覆寫的費率」獨立傳給後端**——T113 只接受 `fxFee`（金額），不接受費率欄位，故覆寫費率僅能間接表現為「先在前端套用後送出 fxFee 數字」。若前後端費率計算邏輯不一致將產生差異。 | T123 明文要求「前端使用 `lib/moneyDecimal.computeTwdAmount` 共用邏輯計算 fxFee 後送出」；或於 API contract 改 body 接受 `fxFee` 與 `fxFeeRate`（後端優先採 `fxFee`，僅在缺失時用 `fxFeeRate` 計算）。 |
| I5 | Inconsistency | LOW | tasks.md:67 (T011) ↔ data-model.md / plan.md | T011 migration `UPDATE accounts SET category = CASE account_type WHEN '銀行' THEN 'bank' …` 隱含現存 `accounts.account_type` 欄位，但 plan.md §Storage 與 data-model.md §3.2 A 節未明文記錄這個既有欄位的存在與值域（中文枚舉「銀行／信用卡／現金／虛擬」）。新進開發者讀 plan.md 看不出這條 migration 的依賴。 | data-model.md §3.2 A 節（既有 schema 描述）補一段：「`accounts.account_type` 為 v3.x 既有欄位，TEXT，值域 `'銀行' | '信用卡' | '現金' | '虛擬'`，本次 migration 後不再使用但保留欄位避免 v3.x rollback 失敗」。 |
| I6 | Inconsistency | LOW | tasks.md:309 (T132) | T132 寫「解析左碼前 38 字元」。財政部電子發票 v3.0 左碼實際長度為 77 字元（字軌 10 + 日期 7 + 隨機碼 4 + 銷售額 8 + 總計 8 + 買方統編 8 + 賣方統編 8 + 加密驗證 24）。「前 38 字元」會切到「總計」之前、無法取得發票總額。 | T132 字元位置依財政部 [電子發票證明聯一維二維條碼規格 v3.0](https://www.einvoice.nat.gov.tw/) 重新計算（前 77 chars），並把欄位偏移列在 task 內以利 reviewer 對照。 |
| A1 | Ambiguity | LOW | spec.md:78 (US2 Acceptance #5) | 「明顯區分『已排除』帳戶」措辭在 US2 屬可量測（隨即說明「灰色虛線外框 + 已排除徽章」），但 spec.md:80 額外列出「明顯標籤（例如灰色虛線外框 + 「已排除」徽章）」用「**例如**」的措辭，未鎖死視覺規範。tasks.md T040／T063 已採用，無實際影響。 | 移除「例如」二字使其成為規範性語句，避免未來 UI 改版偏離 acceptance scenario。 |
| C6 | Coverage Gap | LOW | spec.md:280-287 (Assumptions) | spec.md「假設」段第 1 條依賴 001 之 `createDefaultsForUser()` 建立預設分類；T022 只新增「現金」帳戶與 `user_settings`，未驗證 001 預設分類是否存在。若 001 流程被改動，002 註冊流程會失敗。 | 在 T022 末或 quickstart §1.0 補一個輕量檢查：「呼叫 `/api/auth/register` 後 `SELECT COUNT(*) FROM categories WHERE user_id = ? AND parent_id IS NULL` 應為 N（依 001 預設值），若為 0 提醒 reviewer 001 流程已改」。 |
| D1 | Duplication | LOW | spec.md:181-194 (Edge Cases) ↔ FR sections | Edge Cases 多條重述 FR-013 / FR-014 / FR-022a / FR-014a 已寫過的內容（未來日期、二次確認、跨幣別轉帳、樂觀鎖）。技術上不衝突，但同一句話重複出現於兩處，未來改寫易出現只改一處的漂移。 | 接受現況或在 Edge Cases 改為連結式描述：「未來日期：見 FR-013」，避免維護兩份 source of truth。 |

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 新增帳戶 | ✅ | T030, T041 | — |
| FR-002 預設現金帳戶 | ✅ | T022 | — |
| FR-003 帳戶管理頁 tabs / 信用卡分組 | ✅ | T031, T040, T082 | — |
| FR-004 exclude_from_total | ✅ | T040, T047, T063 | — |
| FR-005 編輯帳戶 / 幣別鎖定 | ✅ | T033, T042 | — |
| FR-006 刪除帳戶引用檢查 | ✅ | T034, T043 | — |
| FR-007 即時餘額計算 | ✅ | T032 | — |
| FR-007a Asia/Taipei 時區 | ✅ | T017, T032 | — |
| FR-010 三種交易類型 | ✅ | T035, T044, T070 | — |
| FR-011 收支必填欄位 | ✅ | T035, T044 | — |
| FR-012 分類 optgroup / 自訂下拉 | ✅ | T044, T102 | — |
| FR-013 允許未來日期 + 未來分區 | ✅ | T035, T046 | — |
| FR-014 硬刪除 + 二次確認 | ✅ | T038, T043, T081 | — |
| FR-014a 樂觀鎖 | ✅ | T021, T033, T034, T037, T038, T112 | — |
| FR-015 轉帳對稱 + linked_id | ✅ | T070, T080, T081 | — |
| FR-016 統計排除 transfer | ✅ | T072 | — |
| FR-017 exclude_from_stats 影響統計 | ⚠️ 部分 | T035, T037 (寫入欄位) | **C1**：T072 統計 SQL 未過濾 exclude_from_stats |
| FR-018 類型色標 | ✅ | T045 | — |
| FR-020 自動匯率填入 | ✅ | T110, T122 | — |
| FR-020a Pinned currencies | ✅ | T015, T111, T112, T120, T121 | — |
| FR-021 信用卡海外手續費 | ⚠️ 部分 | T113, T123 | **C5**：覆寫費率 vs 金額契約不對齊 |
| FR-022 fx_rate 持久化 | ✅ | T035, T037, T124 | — |
| FR-022a Decimal 精度 | ✅ | T001, T013, T016, T035 | — |
| FR-023 匯率快取（dedup + 30min） | ✅ | T018 | — |
| FR-024 匯率 API fallback | ✅ | T018, T110, T122 | — |
| FR-030 掃描發票按鈕 + fallback | ✅ | T130, T131 | — |
| FR-031 左右二維條碼解析 + 店家名稱 | ⚠️ 部分 | T132 | **I1**：右碼未實作；店家以統編字串替代 |
| FR-032 解析失敗訊息 | ✅ | T133 | — |
| FR-040 多選 checkbox | ✅ | T100 | — |
| FR-041 批次操作列 | ✅ | T101 | — |
| FR-042 批次刪除轉帳連動 | ✅ | T091, T104 | — |
| FR-043 批次變更分類/帳戶/日期 | ✅ | T090, T102, T103 | — |
| FR-044 500 筆上限 | ✅ | T090, T091, T101 | — |
| FR-045 atomic 全有全無 | ✅ | T090, T091, T105 | — |
| FR-050 預設排序 + 篩選 | ✅ | T050, T051, T060, T061 | — |
| FR-051 每頁筆數 | ✅ | T050, T062 | — |
| FR-052 URL query 還原 | ✅ | T060, T061, T062 | — |
| FR-060 IDOR / AuthZ | ✅ | T020 | — |
| SC-001 第一筆交易 60 秒內完成 | ✅ | quickstart §1（隱含） | UX 量測，由 quickstart 觀察 |
| SC-002 餘額更新 P95<1s | ⚠️ 未量測 | — | **C3**：無 buildable 量測任務 |
| SC-003 匯率 P95<2s / cache<100ms | ⚠️ 未量測 | — | **C3**：無 buildable 量測任務 |
| SC-004 100 組轉帳無 orphan | ⚠️ 未量測 | T071 (sanity) | **C3**：無壓測腳本，僅啟動 self-check |
| SC-005 批次 100 筆 P95<3s | ⚠️ 未量測 | — | **C3**：無 buildable 量測任務 |
| SC-006 fx_rate 不變 | ✅ | T124, quickstart §5.5 | — |
| SC-007 URL 還原 | ✅ | T060, T061, T062 | — |
| SC-008 帳戶引用拒絕 100% | ✅ | T034, T043, quickstart §1.6 | — |

---

## Constitution Alignment Issues

無 CRITICAL 違規。Constitution Check 通過：

- **Principle I（zh-TW 文件）**：spec.md / plan.md / tasks.md / research.md / data-model.md / quickstart.md 皆繁體中文，識別字保留英文符合例外條款 ✅
- **Principle II（OpenAPI 3.2.0）**：plan.md / tasks.md T140 明確要求 `openapi: 3.2.0` literal 與 `redocly lint` 驗證；contracts/transactions.openapi.yaml 已存在；T140 在同 PR 同步根目錄 openapi.yaml ✅。**注意**：T030~T038、T050~T052、T070、T090~T091、T110~T112 多條後端任務本身未明文要求**該任務同時更新 openapi.yaml**。Polish T140 在最後一次性合併雖然仍在同一 PR、形式上符合 Principle II 規則 #2，但若中途 PR 拆分，存在違規風險。建議於每個後端 task 末尾追加「同步更新 openapi.yaml 對應 path」一句，更穩健。

---

## Unmapped Tasks

無：所有 78 個任務均可對應到至少一條 FR 或 user story。

| Task | 對應依據 |
|------|----------|
| T001 (decimal.js dependency) | FR-022a |
| T002, T003 (lib 骨架 / .env) | Foundational |
| T010~T015 (schema migration) | FR-022a, FR-007a, FR-020a, plan CT-1 |
| T016~T018 (lib 模組) | FR-007a, FR-022a, FR-023 |
| T019, T020, T021 (require / middleware / helper) | FR-014a, FR-060 |
| T022 (createDefaultsForUser) | FR-002, FR-020a |
| T140~T149 (Polish) | 憲章 Principle II / changelog / a11y / acceptance |

---

## Metrics

- **Total Functional Requirements**：38（含 4 條 `a` 後綴 sub-FR）
- **Total Success Criteria**：8
- **Total Tasks**：78
- **FR Coverage**：38 / 38 = **100%**（其中 FR-017、FR-021、FR-031 為「部分覆蓋」⚠️）
- **SC Coverage（buildable 部分）**：4 / 8 = **50%**（SC-002 ~ SC-005 缺量測任務）
- **Ambiguity findings**：1（A1）
- **Duplication findings**：1（D1）
- **Inconsistency findings**：6（I1–I6）
- **Coverage Gap findings**：6（C1–C6）
- **Critical Issues**：**0**
- **High Issues**：**3**（C1, I1, C2）
- **Medium Issues**：**5**（C3, I2, C4, I3, I4, C5）
- **Low Issues**：**4**（I5, I6, A1, C6, D1）

---

## Next Actions

由於存在 3 條 HIGH severity coverage / inconsistency，**建議先解決 HIGH 後再進入 `/speckit.implement`**。MEDIUM 與 LOW 可於實作期間並行處理。

優先處理順序（建議）：

1. **C1（FR-017 exclude_from_stats）** — 改 1 條 SQL 即可，影響面小，務必在實作 T072 時順手補上。實作命令：手動於 tasks.md T072 描述追加「`AND exclude_from_stats = 0`」一句即可，無需重新跑 `/speckit.tasks`。
2. **I1（FR-031 左右碼 / 店家名稱）** — 文件三向對齊問題。建議：
   - 跑 `/speckit.clarify` 把「右碼是否解析 / 店家名稱來源」鎖死成 Clarification 條目，
   - 或手動編輯 spec.md FR-031 把「左右」改為「左碼為主、右碼為 Phase 2 範圍外」、把「店家名稱」改為「賣方統編字串（使用者可手動命名）」。
3. **C2（跨幣別總資產）** — 補一條 task。建議：
   - 手動編輯 tasks.md 在 T124 後追加 T125「於 `app.js` 儀表板 `renderTotalAssets` 改用 `fxCache.getRate()` 換算後加總；同時於 quickstart §5 追加驗收節」。
4. **C3（SC-002~005 量測缺）** — 建議：
   - 編輯 tasks.md Phase 9 追加 T150「補 `quickstart.md §10` 量測腳本（autocannon 4 條 + sanity 100 組轉帳）」並於 T147 acceptance 指明跑過。
5. **MEDIUM 4 項（I2, C4, I3, I4, C5）** — PR review 期間以 review comment 修正即可，不阻擋 implement。
6. **LOW 5 項（I5, I6, A1, C6, D1）** — 可於 polish phase 最後修飾。

具體可立即執行的指令：

```bash
# 1. 編輯 spec.md / tasks.md 補上 HIGH 缺口
# 2. （選用）/speckit.clarify  # 對 FR-031 增加 Clarification
# 3. /speckit.analyze  # 重跑此分析確認 HIGH 數量降到 0
# 4. /speckit.implement  # 開始實作
```

---

## Offer Remediation

是否需要我為前述 HIGH 與 MEDIUM 項目（共 8 條）產出具體的 spec.md / tasks.md 編輯草稿？例如：

- C1：T072 追加 `AND exclude_from_stats = 0` 之前後 diff 文字。
- I1：spec FR-031 / US6 Acceptance #2 / tasks T132 三處的對齊修正稿。
- C2：補一條 T125 任務的完整描述（含路徑、前後依賴、acceptance）。

如同意，請回覆「請出 remediation diff（C1 / I1 / C2 / …）」，我即依清單逐條輸出，**不會直接寫入檔案**，需您逐條確認後手動 apply。
