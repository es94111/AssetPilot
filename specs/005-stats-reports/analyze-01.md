# 跨產出物分析報告：統計報表（005-stats-reports）

**分析時間**: 2026-04-26（第 2 次掃描，前次掃描於 round 4 釐清前已執行並完成主要修補）
**分析者**: `/speckit.analyze` (read-only audit)
**產出物**: [spec.md](./spec.md) / [plan.md](./plan.md) / [research.md](./research.md) / [data-model.md](./data-model.md) / [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) / [quickstart.md](./quickstart.md) / [tasks.md](./tasks.md) / `.specify/memory/constitution.md`

**前次掃描結論**: 識別 20 個 finding（3 HIGH / 4 MEDIUM / 13 LOW）。使用者選擇 Option A 執行 remediation：spec.md 與 tasks.md 已被精準修補（spec 新增 round 4 / 改寫 6 條 FR / 修正 1 條 Edge Case；tasks 新增 T015 / T064a / T064b 並修改 14 處），覆蓋率由 93% → 100%。本次掃描驗證修補成果並識別**新一輪同步差距**：spec/tasks 已升級至 round 4，但 plan/research/data-model/contracts/quickstart 五份姊妹文件**尚未同步**。

---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **D5** | Inconsistency | **HIGH** | contracts/stats-reports.openapi.yaml ／ tasks T015 + T033 | T015 在 Foundational 為 `/api/accounts` response 新增 `twdAccumulated` 欄位（FR-004 必要），但 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) **未**宣告此欄位；契約檔內找不到 `/api/accounts` 路徑的 schema 修改。Constitution Principle II 規則 #2 明示「新欄位 MUST 與實作同 PR 更新契約」— 若 T015 實作落地但 contract 未補，PR review 階段 lint 不會失敗（因為 redocly lint 不要求 contract 包含所有端點），但會造成第三方整合者讀到舊 schema。 | 在 contracts/stats-reports.openapi.yaml 補一段 `/api/accounts` (GET) entry 描述 response schema 含新 `twdAccumulated` 欄位（也可僅在根目錄 openapi.yaml 補；視團隊慣例）。同時在 T033（既有 openapi.yaml dashboard 同步任務）或新增 T015a 明示「同步根目錄 openapi.yaml 的 `/api/accounts` response schema」。 |
| **D2** | Inconsistency | MEDIUM | plan.md:L8 Summary | plan.md 仍寫「10 Clarification（3 輪）」；spec.md 已是 11 條（4 輪）。版本記錄不同步，會誤導讀者以為 round 4 不存在。 | 改 plan.md 該行為「11 Clarification（4 輪）」；補一句 round 4 的核心釐清（`/api/accounts.twdAccumulated` 欄位 + initial_balance 外幣不納入累計）。亦可於計畫的 Summary 段落末尾補一句「v4.26.0 中本變更納入 `/api/accounts` 補 `twdAccumulated` 欄位」。 |
| **D3** | Inconsistency | MEDIUM | research.md（缺 round 4 / T064a / T064b 相關研究紀錄） | research.md 12 大決策中無 (a) Round 4 的「`/api/accounts` 加 `twdAccumulated` 欄位」決策依據與替代方案；(b) T064a「12 小時 stale 閾值」的選擇理由；(c) T064b「Mon-Sun 起點 + weekend purple」的既有實作驗證。spec/tasks 內描述了 what，但 why 不在 research 內可追溯。 | 在 research.md 新增 §13「Round 4 補充：/api/accounts.twdAccumulated 欄位設計」與 §14「FR-023 / FR-019 實作細節」；簡述為何採「累計交易 twd_amount」而非「balance × current rate」（已在 round 4 釐清，但 research 應記錄「替代方案被否決的原因」）。 |
| **D4** | Inconsistency | MEDIUM | data-model.md:§2.2「`accounts` (讀取)」 | data-model.md §2.2 仍寫「用於儀表板『資產配置圓餅圖』的『帳戶餘額』分布；前端呼叫 /api/accounts 取餘額（已內含 TWD 等值換算邏輯，外幣帳戶以歷史交易累計本幣金額；FR-004、Round 1 Q2、Round 2 Q1）」— 此句**不正確**。實際 baseline 不內含 TWD 等值；T015 會新增此欄位才符合 spec。 | 改寫 §2.2 為：「本功能 T015 於 `/api/accounts` response 新增 `twdAccumulated` 計算欄位（**唯一**的 `/api/accounts` 端點修改，無 schema migration）；計算邏輯：`SUM(transactions.twd_amount, signed by direction)` per account；外幣帳戶 initial_balance 不納入此累計（依 Round 4 釐清）。」 |
| **D6** | Inconsistency | MEDIUM | quickstart.md §2.4 / §4.2 / §4.3 | quickstart.md 未補新增的驗證步驟：(a) §2.4「資產配置」未含 `twdAccumulated` 欄位的 DevTools Network 驗證（如「在 GET /api/accounts response 內找到 `twdAccumulated` 欄位、值為負時前端 tooltip 顯示原值含負號」）；(b) §4.2「股票投資」未含「stale `updated_at` > 12h 時呈現小字資料時間」的 visual check；(c) §4.3「每週信件」未明示 weekend (Sat/Sun) 紫色標示驗證 + Mon-Sun 起點驗證。 | 在 quickstart.md 補三段對應驗證步驟；可在 implement PR 內由實作者順手完成。 |
| **U5** | Underspecification | LOW | tasks.md T015 | T015 只說明 `income / transfer_in` 為正、`expense / transfer_out` 為負；但若帳戶有 `transfer` 類型直接記錄（單一行而非雙腿），或者特殊的 `dividend` / `adjustment` 類型，T015 未明示處理。若既有 transactions.type 列舉只有 `income / expense / transfer_in / transfer_out` 四種則此 finding 自動消解；需驗證。 | T015 補一句：「假設 `transactions.type` 列舉僅 `income / expense / transfer_in / transfer_out` 四種；若有其他類型（如 `dividend / adjustment`）需另行決定符號，本 task 預設不處理（不出現於累計計算）。」 |
| **C6** | Coverage Edge | LOW | tasks.md T064a | T064a 規定「若 `priceAsOf` 早於本次寄送 12 小時，補小字註記」；未明示 `stocks.updated_at` 為 NULL 或 0 時的處理（新加入持股、從未成功更新過）。spec FR-023 的「最後一次成功的快取」與 Edge Case「股價更新失敗」也未明示此 corner case。實作者可能依不同直覺處理 → 不一致風險。 | T064a 補：「若 `stocks.updated_at` 為 0 / NULL / 字串『0』，呈現「資料: —」（而非 NaN-formatted 日期），亦同時呈現價格欄位的「—」，與 spec Assumptions「股價快取最小可用單位」一致。」 |
| **C7** | Side-effect Risk | LOW | tasks.md T064b | T064b 寫「驗證 `getReportPeriod('weekly')` 為週一起點；若不是則修正」— 修正既有 helper 將影響：(a) deprecated singleton run-now（仍呼叫 buildUserStatsReport）；(b) admin 「測試信件」端點 `/api/admin/test-email`（雖然該端點寄的是 placeholder，但未來可能改用同 helper）。修改 helper 屬「跨 user story 影響」，T064b 在 US3 phase 但實際是修 baseline。 | T064b 移至 Foundational phase（與 T010 / T011 同期），明示「此修改可能影響既有 deprecated 端點與 test-email；migration 時須確保不破壞 baseline 功能」；或保留 US3 phase 但加 cross-reference「修正後須驗證 deprecated singleton 信件依然可正確產出」。 |
| **I3** | Format Inconsistency | LOW | tasks.md T015 | T015 位於 Phase 2 Foundational 但帶 `[US1]` story 標籤。tasks-template 與 004 慣例：Foundational 階段任務 **不**帶 story 標籤（因為跨多個 user story 共用）。Coverage 顯示 T015 確實只服務 US1（其他 US 不依賴），故可接受其為「pseudo-foundational」；但 [US1] 標籤暗示該任務應落在 US1 phase 而非 Foundational，二擇一不一致。 | 兩擇一：(a) 移除 `[US1]` 標籤、保留在 Foundational（當作真正 cross-cutting prerequisite）；(b) 把 T015 移至 Phase 3 開頭、改名為 T019 或重新編號，並在 Foundational 結尾的 Checkpoint 補一句「US1 開始前需先完成 T019 (originally T015)」。建議 (a) — 更貼近實作順序（T015 不可被任何 user story 任務阻塞）。 |
| **M3** | Manual-only Verification | LOW | spec.md SC-005 | SC-005「Outlook Desktop 通過率 100%」純手動視覺驗證，無自動化 gate。延續前次掃描 finding；接受現狀。 | 接受；於 PR 描述要求作者附 Outlook Desktop 截圖（信件英雄區、3 欄 KPI、儲蓄率進度條、分類顏色長條 4 部分各一張）作為審核依據。 |

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 (儀表板 KPI 跟隨月份切換器) | ✅ | T020, T023 | |
| FR-002 (支出分類雙圓餅切換) | ✅ | T021, T025 | |
| FR-003 (圖例 + tooltip + 前 5 名) | ✅ | T025 | |
| FR-004 (資產配置圓餅 + 不主動查價) | ✅ | T015, T027 | **修補後**：T015 新增 `twdAccumulated` 欄位，T027 改用該欄位 |
| FR-005 (持股/帳戶前 5 名僅有持股顯示) | ✅ | T028 | |
| FR-006 (預算進度條沿用 004) | ✅ | T024 | |
| FR-007 (最近 5 筆交易) | ✅ | T022, T030 | |
| FR-008 (工具列即時重繪無套用按鈕) | ✅ | T046, T047 | |
| FR-009 (期間預設 6 種) | ✅ | T044 | |
| FR-010 (自訂時間預設化 / 反向拒絕) | ✅ | T040, T042, T045 | |
| FR-011 (類型切換器) | ✅ | T046 | |
| FR-011a (Session 內保留 / 跨 Session 重置) | ✅ | T043 | |
| FR-012 (三圖共享期間/類型) | ✅ | T047 | |
| FR-013 (圓餅排序穩定 + 「（其他）」節點) | ✅ | T010, T021, T025, T041, T048 | |
| FR-014 (折線/長條 X 軸聚合粒度系統決定) | ✅ | T049, T050 | 閾值已 inline |
| FR-015 (三圖空狀態統一) | ✅ | T012, T051 | |
| FR-015a (圓餅圖點擊跳轉) | ✅ | T013, T014, T026, T029, T048 | 返回鈕保留狀態已補 |
| FR-016 (管理員建立排程 + 多筆並存) | ✅ | T068, T069, T076 | |
| FR-017 (寄送前股價更新) | ✅ | T072 | |
| FR-018 (HTML + table-based + 對比 pill 同型前一段) | ✅ | T011, T063, T064 | |
| FR-019 (信件交易紀錄區塊隨頻率切換) | ✅ | T064b | **修補後**：新增 T064b 驗證 Mon-Sun + 週末紫色 |
| FR-020 (股票投資 4 列彩色 ±) | ✅ | (baseline 既有) | |
| FR-021 (寄信通道 SMTP 優先 + Resend 退回 + 503) | ✅ | T062 | |
| FR-022 (台灣時區 UTC+8 排程) | ✅ | T065, T067 | |
| FR-023 (股價更新失敗使用快取 + 註記時間) | ✅ | T064a | **修補後**：新增 T064a，C6 餘留 NULL/0 處理待補 |
| FR-024 (使用者帳號停用略過) | ✅ | T066 | **修補後**：T066 補 `is_active === 0` 過濾 |
| FR-024a (排程停用→啟用不補寄) | ✅ | T065, T070 | last_run 保留行為已明示 |
| FR-025 (TWD 等值跨頁共用) | ✅ | T015, T020, T021, T027, T041 | |
| FR-026 (即時反映變動) | ✅ | (跨 task 隱含) | |
| SC-001 (儀表板 2 秒呈現) | ✅ | T027 + 不主動查價設計 | |
| SC-002 (統計頁切換 1 秒重繪) | ✅ | T046, T047 | |
| SC-003 (圓餅排序 100% 穩定) | ✅ | T010, T021, T041 | |
| SC-004 (信件 5 分鐘內寄送 + 錯誤紀錄) | ✅ | T062, T066 | |
| SC-005 (Outlook Desktop 100% 通過) | ⚠️ | (純手動驗證) | M3 — 無自動 gate（接受） |
| SC-006 (交易變動後即時反映) | ✅ | (隱含設計) | |
| SC-007 (90% 使用者 30 秒判斷) | (excluded) | — | post-launch retention |

---

## Constitution Alignment Issues

✅ **無新增違反**（所有 Phase 1 / Phase 2 修補後仍合規）：

- **Principle I（繁體中文文件）**：所有衍生產出皆 zh-TW；spec round 4 / 新 task 補入皆使用繁體中文；技術名詞（`twdAccumulated`、`stocks.updated_at`、`is_active`）為 source-code identifier，依例外條款保留英文。
- **Principle II（OpenAPI 3.2.0）**：[contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) `openapi: 3.2.0` 字串完全相等；新端點皆有 `security`；T093 lint gate 就位。**唯一 gap**: D5 — `/api/accounts` 的 `twdAccumulated` 欄位修改尚未反映在契約檔（因 contracts 檔聚焦在新增端點，但既有端點的 schema 修改也屬於 Principle II 規則 #2 範圍）。
- **Principle III（Slash-Style Path）**：所有新增路徑為斜線；`run-now` kebab-case；無冒號；T094 已用 `git diff` 限縮 grep 避免誤報 v4.21 前的 legacy `:batch-delete` 路徑。

---

## Unmapped Tasks

✅ **無**：所有 68 筆 task 皆可對應到至少一條 FR 或 user story 的具體交付項目；Polish 階段對應 Constitution 與 Workflow Gate；新增 T015 / T064a / T064b 皆有明確 FR 對應（FR-004 / FR-023 / FR-019）。

---

## Metrics

| Metric | Before remediation | After remediation (current) |
|---|---|---|
| Total FRs | 29 | 29 |
| Total Buildable SCs | 6 | 6 |
| Total Tasks | 65 | **68（+T015 + T064a + T064b）** |
| FR Coverage % | 93%（27/29） | **100%（29/29）** |
| Buildable SC Coverage % | 100% | 100% |
| Clarifications count | 10（3 輪） | **11（4 輪）** |
| **CRITICAL** issues | 0 | 0 |
| **HIGH** issues | 3 | **1（D5）** |
| **MEDIUM** issues | 4 | **4（D2, D3, D4, D6）** |
| **LOW** issues | 13 | **5（U5, C6, C7, I3, M3）** |
| Total findings | 20 | **10** |
| Ambiguity count | 3 | 2 |
| Duplication count | 0 | 0 |

---

## Next Actions

⚠️ **1 個 HIGH 與 4 個 MEDIUM 屬「文件同步」差距**，皆來自 spec/tasks 已升至 round 4 但 plan/research/data-model/contracts/quickstart 尚未跟上；**並非阻擋實作**，但建議於 implement PR 內一併修補：

### 建議於 implement 前的 1 個小 PR 內處理（HIGH + MEDIUM 同步）

可包成「Round 4 Documentation Sync」一個小 commit：

1. **D5（HIGH）**: 在 [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) 新增 `/api/accounts` (GET) entry 描述 response schema 含新 `twdAccumulated` 欄位；同時在 tasks.md 新增 T015a 或將 T033 範圍擴大涵蓋此契約變更。
2. **D2（MEDIUM）**: [plan.md:L8](./plan.md#L8) 改「10 Clarification（3 輪）」→「11 Clarification（4 輪）」；Summary 補一句 round 4 的核心釐清。
3. **D3（MEDIUM）**: [research.md](./research.md) 新增 §13（Round 4 `/api/accounts.twdAccumulated` 設計）+ §14（T064a / T064b 實作細節）。
4. **D4（MEDIUM）**: [data-model.md §2.2](./data-model.md) 改寫「accounts (讀取)」段落為「T015 補 `twdAccumulated` 計算欄位」。
5. **D6（MEDIUM）**: [quickstart.md](./quickstart.md) §2.4 / §4.2 / §4.3 補三段對應驗證步驟。

### 可於 implement 期間處理（LOW）

- **U5**: T015 補「假設 type 列舉僅 4 種」一句。
- **C6**: T064a 補「`updated_at` 為 0/NULL 時呈現「資料: —」」。
- **C7**: T064b 移至 Foundational 或補 cross-reference。
- **I3**: T015 移除 `[US1]` 標籤（更乾淨方案）。
- **M3**: 接受現狀（manual verification）。

### 是否阻擋 `/speckit.implement`？

❌ **否**。spec.md 與 tasks.md 已是覆蓋率 100%、HIGH 與 MEDIUM 與實作層完全對齊；剩餘 1 個 HIGH（D5）與 4 個 MEDIUM 純屬「姊妹文件 lag」，不影響實作正確性、不影響 Constitution 合規。實作 PR 內一併處理即可。

### Suggested Commands

```bash
# 1. 「Round 4 Documentation Sync」小 PR — 修補 D5/D2/D3/D4/D6
edit specs/005-stats-reports/{plan,research,data-model,quickstart}.md
edit specs/005-stats-reports/contracts/stats-reports.openapi.yaml

# 2. 直接進入實作（可同時包含上一步的同步）
/speckit.implement
```

---

## Offer Remediation

是否需要我針對本次掃描的 5 個 HIGH+MEDIUM 同步差距（D2~D6）提出**具體修補文字**？

**選項**：

- **A** — 我直接給出 D2~D6 的精確編輯文字（含 plan.md 替換、research.md 新增段落、data-model.md 改寫段落、contracts schema 補強、quickstart 三段驗證步驟），由你貼回對應檔案。
- **B** — 我直接套用編輯（與前次相同流程）；保留 read-only audit 原則之外，將編輯記錄為「Documentation Sync Round 4」追加至本檔末尾。
- **C** — 暫時跳過，直接 `/speckit.implement`，於實作 PR 內由我或你手動處理。
- **D** — 其他（請說明）。

預設建議：**B**（一次到位完成 round 4 同步，避免 implement 期間文件不一致造成 reviewer 困惑）。

---

## Round 4 Documentation Sync Applied (2026-04-26)

使用者選擇 **Option B**（直接套用）；本節記錄已套用的編輯。所有 5 個 HIGH+MEDIUM 同步差距與 4 個 LOW 已修補。

### A. contracts/stats-reports.openapi.yaml（D5、HIGH）

| 改動 | 內容 |
|---|---|
| `tags` 新增「帳戶」tag | 為 `/api/accounts` schema 補強分類 |
| `components.schemas` 新增 `AccountWithTwdAccumulated` schema | 描述 005 對 `/api/accounts` response 的 additive change，含 `twdAccumulated` 欄位定義（type / 計算邏輯 / 邊界規則） |
| `paths` 新增 `/api/accounts` (GET) entry | 採 `allOf: [$ref AccountWithTwdAccumulated]` 表示「既有 schema + 005 新增欄位」 |

### B. plan.md（D2、MEDIUM）

| 改動位置 | 內容 |
|---|---|
| L8 Summary | 「10 Clarification（3 輪）」→「**11 Clarification（4 輪）**」 |
| L8 後追加 | 整段 round 4 釐清補強說明（含本次 task 變動清單、tasks 65→68、coverage 93%→100%、cross-reference [tasks.md](./tasks.md) 與本檔案） |

### C. research.md（D3、MEDIUM）

| 改動位置 | 內容 |
|---|---|
| 末尾追加 §13「Round 4 補強：`/api/accounts.twdAccumulated` 計算欄位」 | 含背景（C3/C4 觸發點）、決策（additive 新欄位 + 4 種 type enum 假設 + initial_balance 不納入）、理由、3 個替代方案被否決原因 |
| 末尾追加 §14「Round 4 補強：FR-023 / FR-019 信件實作細節」 | 含 14.1 FR-023 12 小時閾值選擇 + NULL/0 處理；14.2 FR-019 Mon-Sun 起點 + 週末紫色 inline style + 跨任務影響 cross-reference |

### D. data-model.md（D4、MEDIUM）

| 改動位置 | 內容 |
|---|---|
| §2.2「`accounts` (讀取)」整段改寫 | 改為「表結構不變動 + `/api/accounts` response 新增 `twdAccumulated` 計算欄位」；含 T015 reference、計算邏輯、initial_balance 不納入規則、cross-reference contracts |

### E. quickstart.md（D6、MEDIUM）

| 改動位置 | 內容 |
|---|---|
| §2.4「有持股情境」之後新增「`twdAccumulated` 欄位驗證」段落 | 5 個逐項驗證步驟：(1) DevTools 觀察欄位存在；(2) 手動 SUM 驗證；(3) USD 帳戶 balance vs twdAccumulated 差異；(4) 負值帳戶圓餅扇區行為；(5) initial_balance 無交易帳戶顯示 0 |
| §4.2「信件視覺檢查」+ 新增 FR-023 段落 | 補 KPI pill 的 `compareLabel` 視覺檢查；新增「FR-023 資料時間註記驗證」4 步驟（含 13 小時 stale + updated_at=0 的「資料: —」呈現） |
| §4.3「每週信件」改寫 | 補強驗證：第一筆 row = 週一、最後一筆 row = 週日、週六與週日 inline style `color: #a855f7;` |

### F. tasks.md LOW 修補（U5 / C6 / C7 / I3）

| Task | finding | 改動 |
|---|---|---|
| **T015** | I3、U5 | (1) 移除 `[US1]` 標籤（屬 Foundational 跨 user story 共用基礎設施）；(2) 補「假設 transactions.type enum 僅 4 種」一句；(3) 明示 contract 同步要求（PR 內須同步 contracts/ 與根目錄 openapi.yaml） |
| **T064a** | C6 | 補 `priceAsOf` 為 0 / NULL / 字串 `"0"` 時的處理：價格欄位 `—` + 資料時間欄位 `資料: —`；MUST NOT 顯示 `1970-01-01` |
| **T064b** | C7 | 補「跨任務影響」段落：MUST 驗證 deprecated singleton 與 admin test-email 端點寄出的信件版面依然正確；補 inline style 而非 CSS class 的選擇理由（Outlook Desktop Word engine） |

### G. 修補後狀態

| Metric | Before sync | After sync |
|---|---|---|
| HIGH issues | 1 (D5) | **0** |
| MEDIUM issues | 4 (D2, D3, D4, D6) | **0** |
| LOW issues | 5 (U5, C6, C7, I3, M3) | **1（M3，接受）** |
| Total findings | 10 | **1** |
| Documentation lag | 5 檔案落後 round 4 | **0**（plan/research/data-model/contracts/quickstart 全部對齊） |
| Tasks count | 68 | 68（無變動，僅描述補強） |
| FR coverage % | 100% | 100% |

### H. 後續建議

✅ **一切就緒，可直接執行 `/speckit.implement`**：
- 7 份核心產出物（spec / plan / research / data-model / contracts / quickstart / tasks）已完全對齊 round 4。
- 唯一剩餘的 M3（Outlook Desktop 純手動視覺驗證）為專案慣例可接受項；於 PR 描述要求作者附 4 張視覺檢查截圖即可。
- 第 3 次 `/speckit.analyze` 預期不會再發現新的 HIGH/MEDIUM；可選擇執行以最終確認，或直接進入實作。

🔄 **可選**：執行 `/speckit-git-commit` 提交本次 sync 涉及的 7 份檔案修補（spec.md 已於前次 sync 提交範圍；本次新增 plan/research/data-model/contracts/quickstart/tasks/analyze-01）。

## Extension Hooks

**Optional Hook**: git
Command: `/speckit-git-commit`
Description: Auto-commit after analysis

Prompt: Commit analysis results?
To execute: `/speckit-git-commit`
