# Specification Analysis Report — 007-data-export-import (Round 2)

**Generated**: 2026-04-27
**Artifacts analyzed**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`tasks.md`、`contracts/data-export-import.openapi.yaml`、`.specify/memory/constitution.md` v1.2.0
**Scope**: 57 FR（46 base + 11 sub-FR）／9 SC／18 Clarifications／78 tasks
**Mode**: READ-ONLY — no spec/plan/tasks files modified（此報告為覆寫前一輪輸出）。

> **Note**：本報告為**第二輪**分析，前一輪（Round 1）的 14 個發現（F1 CRITICAL / F2-F3 HIGH / F4-F9 MEDIUM / F10-F14 LOW）已於修訂中解決。本輪聚焦於 (a) 驗證 Round 1 修復是否完備、(b) 檢視修復過程中是否引入新不一致。

---

## Round 1 修復驗證

| ID | 嚴重度 | 修復狀態 | 驗證依據 |
|----|--------|----------|----------|
| F1 | CRITICAL | ✅ **已解決** | research.md §11 含 `scheduleNextMidnightTick()` cascade 實作 + 「為何不用 setInterval(24h)」反向說明；tasks.md T014 描述明示「次日午夜 setTimeout cascade」+「不可用 `setInterval(tick, 24*3600*1000)`」反向警語；plan.md「不引入新依賴」段落同步註記 |
| F2 | HIGH | ✅ **已解決** | spec.md Edge Case 措辭明示「四欄全等才視為重複」+「任一欄不同即視為合法新紀錄」與 FR-023a 對齊；無語意衝突 |
| F3 | HIGH | ✅ **已解決** | tasks.md T036 (c) 子項明示「`stockDividend > 0` → 同 transaction 內 `INSERT INTO stock_transactions (..., type='buy', price=0, ..., note='[SYNTH] 股票股利配發 ...')`」；FR-023 落地清晰 |
| F4 | MEDIUM | ✅ **已解決** | tasks.md T028 (f) 子項「保留既有「前 10 筆預覽 Modal」（FR-007）」；明示 refactor 不變動預覽流程 |
| F5 | MEDIUM | ✅ **已解決** | tasks.md T028 (g) 子項實作 UTF-8 → Big5 fallback（含 `�` 替代字元 > 0.1% 重試邏輯）；不引入新依賴 |
| F6 | MEDIUM | ✅ **已解決** | plan.md §1 baseline 分析註記「FR-022「觸發 FIFO 全量重算」採惰性詮釋」+「重算發生點延後至下次 GET」 |
| F7 | MEDIUM | ✅ **已解決** | research.md §4 採弱保證取捨段落 + 三條 Rationale；quickstart.md §3.9 新增中斷情境兩種驗證劇本（情境 A：commit 完成、情境 B：commit 未完成） |
| F8 | MEDIUM | ✅ **已解決** | quickstart.md §3.7b 新增「100 對轉帳量化驗證 ≥ 99%」步驟與 SQL 統計指令 |
| F9 | MEDIUM | ✅ **已解決** | tasks.md T009 含「metadata 採白名單欄位制」明示 15 條允許 keys + silent drop + console.warn |
| F10 | LOW | ✅ **已解決** | quickstart.md §11 第 6 條新增匯率 baseline 行為回歸（FR-029 / FR-033 / FR-034 / FR-035） |
| F11 | LOW | ✅ **已解決** | quickstart.md §10.5 新增 SC-007 首次使用者 UAT 觀察步驟 |
| F12 | LOW | ✅ **已解決** | plan.md §1 第 16 點註記「『重新部署』指 rebuild Docker image / 推 registry」、單純 restart 為部署內 reload |
| F13 | LOW | ✅ **已解決** | data-model.md §0 新增「上層分類 = 父分類 = parent_id」三者同義語彙統一說明 |
| F14 | LOW | ✅ **已解決** | tasks.md T043 明示「app.js IIFE 內既有匯率區塊 module-level array literal」位置 + 不採新增端點理由 |

**所有 14 條 Round 1 findings 全數解決**。

---

## Specification Analysis Report — Round 2 New Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| G1 | Inconsistency | **LOW** | plan.md §8 vs tasks.md T013 vs spec.md FR-043 | plan.md §8「刪除事件 `console.log` 結構化 log + **寫稽核日誌**」；T013 僅明示「結構化 log 事件 `before_restore_pruned`」；spec FR-043 `action` 列舉值**不含** `prune_before_restore`。三者互相矛盾：plan 要寫 audit、task 不寫、spec 沒對應 action。 | 建議從 plan §8 移除「+ 寫稽核日誌」字樣，以 T013 為準（僅 console.log）；保留「日誌可被管理員觀察刪除事件」為足；無需擴充 FR-043 列舉值。 |
| G2 | Underspecification | **LOW** | tasks.md T009 metadata 白名單 | T009 白名單含 `filterParams` 鍵（共 15 條），但 data-model.md §1.1 metadata JSON 規範範例 + 其他任務皆未實際使用 `filterParams`。為「未來擴充」佔位欄但未明示。 | T009 描述補一句「`filterParams` 為未來擴充佔位欄（如 export 端點 query 條件序列化記錄），目前無 action 使用」；或刪除該鍵改為 14 條。建議前者（保留擴充空間）。 |
| G3 | Inconsistency | **LOW** | spec.md FR-046b vs contracts/data-export-import.openapi.yaml `pageSize` | spec FR-046b 規定「列表 MUST 以 `timestamp` 倒序分頁顯示（**每頁 50 筆**）」（固定 50）；contract `/api/admin/data-audit` 與 `/api/user/data-audit` 的 `pageSize` query 參數允許 1-200、預設 50（可調整）。 | 二擇一：(a) contract 改為「`pageSize` 固定 50」（移除 query 參數）以嚴守 spec；(b) spec 鬆綁為「預設 50 筆、可由 query 參數調整為 1-200」。建議 (b) 因為前端可能對「行動裝置 / 桌面」需要不同 pageSize，未來擴充更彈性。 |

（findings 數 = 3，皆 LOW；無 overflow summary。）

---

## Coverage Summary Table

> 與 Round 1 相比，僅 G1-G3 涉及條目有變動；其餘 100% 覆蓋率不變。

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 ~ FR-046b | ✅ 100% | 全 78 任務分配 | Round 1 已全數覆蓋；Round 2 fix 進一步強化 T009 / T028 / T036 / T043 內容 |
| FR-022（FIFO 全量重算） | ✅ 惰性詮釋 | T035 + plan 註記 | Round 1 F6 已標註等價詮釋 |
| FR-023（合成 $0 買進交易） | ✅ 完整 | T036 (c) | Round 1 F3 補強落地細節 |
| FR-046a（每日午夜清理） | ✅ 完整 | T002 / T014 / T063 / T064 | Round 1 F1 改寫排程模式為 setTimeout cascade |
| FR-046b（管理員 + 我的操作紀錄分頁） | ⚠️ G3 | T065 / T066 / T067 / T068 + contract | spec 固定 pageSize 50 vs contract 可調整 1-200 — 微小不一致 |
| Edge Case「股利同日多筆」 | ✅ 釐清 | spec.md | Round 1 F2 措辭明示「四欄全等」唯一鍵 |
| Edge Case「網路中斷」 | ✅ 弱保證 | research §4 + quickstart §3.9 | Round 1 F7 採取捨明示 |
| Edge Case「編碼非 UTF-8」 | ✅ 完整 | T028 (g) | Round 1 F5 補 UTF-8 → Big5 fallback |
| FR-007（前 10 筆預覽） | ✅ 完整 | T028 (f) | Round 1 F4 補保留 |
| SC-001 / SC-002 / SC-005 / SC-006 / SC-008 / SC-009 | ✅ 完整 | T075 + quickstart §10 | 不變 |
| SC-003（Formula Injection 100%） | ✅ 完整 | T010 / T017 + quickstart §2.2 | 不變 |
| SC-004（轉帳配對 ≥ 99%） | ✅ 量化驗證 | T022 + quickstart §3.7b | Round 1 F8 補量化 |
| SC-007（首次 5 分鐘） | ✅ UAT | quickstart §10.5 | Round 1 F11 補 UAT 步驟 |

---

## Constitution Alignment Issues

無違反項目。三條 Principle 全數通過（與 Round 1 一致）：

- **[I] 繁體中文文件規範**：✅ 通過
- **[II] OpenAPI 3.2.0 契約**：✅ 通過（contract `openapi: 3.2.0` 字串完全相等；T069 將同步根目錄 `openapi.yaml` 至 4.28.0）
- **[III] Slash-Style HTTP Path**：✅ 通過（14 個新路徑全斜線；無冒號自訂方法；T078 redocly lint 為 CI 防線）

---

## Unmapped Tasks

無 unmapped tasks。78 個任務全數對應至少一個 FR / SC / 憲章 gate / 部署檢核項。

---

## Metrics

| 指標 | Round 1 | Round 2 | Δ |
|------|---------|---------|---|
| Total Functional Requirements | 57 | 57 | 0 |
| Total Success Criteria | 9 | 9 | 0 |
| Total Tasks | 78 | 78 | 0 |
| Coverage % (requirements with ≥ 1 task or baseline reference) | 100% | 100% | 0 |
| Ambiguity Count | 1（F12） | 0 | -1（已釐清）|
| Duplication Count | 0 | 0 | 0 |
| Inconsistency Count | 4（F1 / F2 / F6 / F13） | 2（G1 / G3） | -2 |
| Coverage Gap Count | 7（F3 / F4 / F5 / F7 / F8 / F10 / F15） | 0 | -7 |
| Underspecification Count | 2（F9 / F14） | 1（G2） | -1 |
| **Critical Issues** | **1**（F1） | **0** | **-1** ✅ |
| **High Issues** | **2**（F2 / F3） | **0** | **-2** ✅ |
| Medium Issues | 6 | 0 | -6 |
| Low Issues | 6 | 3 | -3 |
| **Total Findings** | **15** | **3** | **-12** |

---

## Next Actions

**0 個 CRITICAL / 0 個 HIGH** — 可立即進入 `/speckit.implement`。

剩餘 3 個 LOW（G1 / G2 / G3）為文字一致性微調，**不阻擋實作**：

- **G1**：plan §8 移除「+ 寫稽核日誌」字樣 — 5 秒編輯。
- **G2**：T009 補「`filterParams` 為未來擴充佔位欄」一句 — 5 秒編輯。
- **G3**：選擇 contract 固定 50（嚴守 spec）或 spec 鬆綁（彈性）。

### 推薦命令順序

**選擇 A — 立即實作（接受 LOW 不一致）**：
1. `/speckit.implement` 開始 Phase 1 Setup（T001 ~ T006 全 [P]）。
2. 實作期間若發現任一 G1 / G2 / G3 阻塞，再回頭修。

**選擇 B — 完美主義（先解 LOW 再實作）**：
1. 手動編輯 plan.md（G1）+ tasks.md T009（G2）+ contract（G3 二擇一）。
2. 重跑 `/speckit.analyze` 確認 0 findings。
3. `/speckit.implement`。

建議**選擇 A**（LOW 不阻擋實作；實作過程修起來成本相同，避免「分析-修-分析」迴圈過多）。

---

## Offer Remediation

3 個 LOW finding 修復成本極低（每條 ≤ 5 秒），需要我代為產出具體編輯建議嗎？回答 **「是」** 我會生成 diff 風格 before/after；回答 **「否」** 或 **「直接 implement」** 則進入下一階段。
