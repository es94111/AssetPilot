# Specification Analysis Report — 009-multi-timezone（v2 / 修補後重審）

**Analyzed at**: 2026-04-29（第 2 輪）
**Inputs**: [spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[data-model.md](./data-model.md)、[research.md](./research.md)、[contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)、[.specify/memory/constitution.md](../../.specify/memory/constitution.md)
**Mode**: 唯讀（不修改任何檔案）
**Previous report**: [analyze-01.md (v1)](#) — 16 findings（HIGH 1 / MEDIUM 7 / LOW 8）

---

## 變更摘要（v1 → v2）

| 修補 ID（v1） | 嚴重度 | 狀態 | 驗證證據 |
|---|---|---|---|
| **I1**（US3 偽依賴 US2） | HIGH | ✅ **已修復** | tasks.md:236「**不**依賴 Phase 4 任何任務 — US3 排程器寫的是 `monthly_report_send_log`，不寫 `data_operation_audit_log`」 |
| **D1**（FR-006 / FR-018 重疊） | MEDIUM | ✅ **已修復** | spec.md:94「失敗處理見 FR-018」；尾段刪除 |
| **G1**（FR-015 無驗證 task） | MEDIUM | ✅ **已修復** | tasks.md:218 新增 T060（baseline 比對 + in-memory 自動化版本） |
| **G2**（SC-003 無 SLA 取樣） | MEDIUM | ✅ **已修復** | tasks.md:219–224 新增 T061（100 帳號 × 10 時區 × 整月模擬，P95 ≤ 30 分鐘） |
| **G3**（T010 缺 monthInUserTz / isFutureDateForTz） | MEDIUM | ✅ **已修復** | tasks.md:56–62 全 6 函式各列具體案例 |
| **U1**（T030 引用未存在的 writeAuditLog） | MEDIUM | ✅ **已修復** | tasks.md:130–148 補完整 INSERT SQL；plan.md:239 補註解；已 grep 驗證 helper 不存在 |
| **U2**（T019 scheduler context 未明示） | MEDIUM | ✅ **已修復** | tasks.md:87–93 補 4 步驟（JOIN users → for-each → todayInUserTz → 與 T018 不重複） |
| **U3**（T021 探索性無端點清單） | MEDIUM | ✅ **已修復** | tasks.md:95–98 拆 T021a（grep 列舉）+ T021b（逐一替換）+ T053 自動驗證閉環 |

**結果**：HIGH 1 → 0、MEDIUM 7 → 0。所有修補無回歸（沒有引入新的 HIGH/MEDIUM）。

---

## Findings（剩餘）

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I2 | Inconsistency | LOW | plan.md:108–378 vs tasks.md:17–225 | plan 採 8 階段（Phase 0–7，技術導向）；tasks 採 6 階段（Phase 1–6，user-story-first）。Phase 7（Regression）在 tasks 併入 Phase 6 Polish。對應有明確 mapping 但編號不一。 | 於 plan.md 結尾或 tasks.md 結尾加一張對應表「plan Phase N ↔ tasks Phase M ↔ task IDs」。 |
| I3 | Inconsistency | LOW | plan.md:112 | Phase 0 標題「憲章修訂與相依性確認 ✓」帶勾號，但 T003（實作任務）尚未執行；視覺暗示「已完成」造成誤導。 | 移除 ✓ 或改為「☐」直至 T003 完成。 |
| U4 | Underspecification | LOW | tasks.md:52 (T009) | T009「對需 auth 的 /api/** 路由前置」加 `attachUserTimezone` middleware；filter 機制（per-route 註冊 vs 全域 middleware + 條件略過）未明示。 | T009 補：「於 `requireAuth` 之後立即接 `attachUserTimezone`；公開端點不經 `requireAuth` → 自然不經 `attachUserTimezone`」。 |
| U5 | Underspecification | LOW | tasks.md:157 (T036) | T036 假設「個人設定頁」已存在且有「主題模式」區塊；若結構不符隱含 UI scaffolding。 | T036 補：「先 grep `index.html` 確認 settings section 結構；若不符預期則調整錨點」。 |
| U6 | Underspecification | LOW | tasks.md:124 (T028) | T028 驗證 audit metadata 含 `from`/`to`/`source`，但未斷言 `metadata` 為合法 JSON 字串。 | T028 補：「斷言 `JSON.parse(metadata)` 不擲錯且鍵齊全」。 |
| A1 | Ambiguity | LOW | spec.md:145 (Assumptions) | 「DST 切換不需要額外特殊處理；以 IANA tz database 規則為準」過於簡略；research.md R2 有完整論述。 | 加 cross-ref：「詳見 [research.md §R2](./research.md)」。 |
| G4 | Coverage Gap | LOW | spec.md:73 (Edge Cases), tasks.md:177 (T043) | Edge Case 描述兩個 DST 邊界（重複 01:30、跳過 02:30），T043 只覆蓋「PST 秋季重複 01:00」；春跳分支未測。 | T043 補一個子案例：「PST 春季 02:00→03:00（2026-03-08）月初 00:00 觸發仍只一次」。 |
| G5 | Coverage Gap | LOW | spec.md:115 (FR-014), tasks.md:108 (T025) | FR-014 規定 TWSE 永久鎖 Asia/Taipei；T025 只負責加註解，無回歸驗證測試（PST 使用者下台股交易時間判斷正確）。 | 於 Phase 5 或 Polish 加 task：「以 PST 使用者帳號打 `/api/stocks/realtime` 等台股端點，確認市場開盤判斷不受 user.timezone 影響」。 |
| **N1** | Inconsistency | LOW | tasks.md:135, plan.md:235 | T030 SQL 範例 / plan PATCH 範例使用 `uuid()`，但專案現行慣例為 `crypto.randomUUID().replace(/-/g, '')`（已 grep [server.js:1806](../../server.js#L1806)）。直接複製範例可能因 `uuid` 未匯入而執行錯誤。 | T030 範例改 `crypto.randomUUID().replace(/-/g, '')`，或於 task 註明「依 server.js 既有慣例選用 ID 生成方式」。 |
| **N2** | Coverage Gap | LOW | tasks.md:56 (T010), tasks.md:42 (T007) | `lib/userTime.js` 匯出 7 個函式（含 `isValidIsoDate` re-export）；T010 覆蓋 6 個，缺 `isValidIsoDate` 直接測試。 | T010 補一條：「`isValidIsoDate` 接受合法（`'2026-04-29'`）、月日越界（`'2026-02-30'`）、非 ISO（`'2026/04/29'`）三組」。 |

**Findings 總計：10 項**（HIGH 0 / MEDIUM 0 / LOW 10）

> 8 個 LOW 為 v1 既有低優先項目（重新確認仍存在但不阻擋 implement）；2 個（**N1**、**N2**）為本輪修補帶入的新發現，等級皆為 LOW。

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 (users.timezone 欄位) | ✅ | T004 | DB migration |
| FR-002 (拒絕非 IANA) | ✅ | T007、T010、T030 | 工具 + 測試 + handler |
| FR-003 (ISO 8601 UTC `Z` + 毫秒) | ✅ | T007、T010、T014、T021a/b、T053–T054 | 工具 + 4 測試任務 |
| FR-004 (per-user 今天/當月) | ✅ | T007、T009、T015–T020 | 替換 8 處 |
| FR-005 (`transactions.date` 預設 = 使用者當天) | ✅ | T020 | POST/PATCH 預設值 |
| FR-006 (月度郵件 per-user) | ✅ | T005、T045–T046、T042 | 表 + scheduler + 測試 |
| FR-007 (GET /api/users/me) | ✅ | T029、T026 | handler + test |
| FR-008 (PATCH /me/timezone + audit) | ✅ | T030、T027、T028 | handler + 2 測試 |
| FR-009 (Asia/Taipei regression-free) | ✅ | T012、T015–T020、T055 | regression + replacements |
| FR-010 (前端偵測 + 3 條件提示) | ✅ | T034、T035 | 既有 + 新使用者 |
| FR-011 (個人設定時區下拉) | ✅ | T036、T037 | UI + data source |
| FR-012 (前端依 user.tz 顯示) | ✅ | T032、T039 | 工具 + 替換 |
| FR-013 (前端送出格式) | ✅ | T024、T032、T038 | 隱含覆蓋 |
| FR-014 (TWSE 永久 Asia/Taipei) | ⚠ 部分 | T025 | 只有註解，無回歸測試（見 G5） |
| **FR-015 (歷史 transactions.date 不遷移)** | ✅ **NEW** | **T060** | baseline 比對 + 自動化版本 |
| FR-016 (憲章 v1.3.0) | ✅ | T003、T058 | 修訂 + 收尾驗證 |
| FR-017 (openapi.yaml + lint) | ✅ | T049、T050 | 同步 + lint |
| FR-018 (失敗不重試) | ✅ | T046、T044 | 實作 + 測試 |
| SC-001 (regression 0 失敗) | ✅ | T012、T055 | 整合 + 全套 |
| SC-002 (PST < 1 秒) | ✅ | T013 | 整合測試 |
| **SC-003 (95% < 30 分鐘 SLA)** | ✅ **NEW** | T041、**T061** | 整合測試 + SLA 取樣統計 |
| SC-004 (1000 抽樣 100% UTC) | ✅ | T053、T054 | 自動化掃描 + npm script |
| SC-005 (6 種瀏覽器 tz 一致) | ✅ | T056 | 跨瀏覽器矩陣手測 |
| SC-006 (1 秒內反映) | ✅ | T038 | 設定頁儲存後即時 re-render |

**覆蓋率**：24/24 = **100%**（v1 為 91.7%，提升 8.3%）。FR-014 仍標「部分」是因為僅有靜態註解、無動態回歸測試（G5），非阻擋項。

---

## Constitution Alignment Issues

無違反。憲章 v1.2.0 三大 Gate（zh-TW、OpenAPI 3.2.0、Slash-Style Path）皆 PASS；FR-007a 違反已於 plan §Complexity Tracking 列明，並透過 T003 同 PR 升級至 v1.3.0 處置。

---

## Unmapped Tasks

無孤兒任務。新增的 T060 對應 FR-015、T061 對應 SC-003，均有明確規格錨點。

---

## Metrics

| 指標 | v1 | **v2** | 變化 |
|---|---|---|---|
| Total Functional Requirements (FR) | 18 | 18 | — |
| Total Success Criteria (SC) | 6 | 6 | — |
| Total Tasks | 59 | **61** | +2（T060、T061） |
| Coverage % | 91.7% | **100%** | **+8.3%** |
| Strong coverage (≥2 task references) | 75% | **79%** | +4% |
| Critical issues | 0 | **0** | — |
| **High issues** | **1** | **0** | **−1** ✅ |
| Medium issues | 7 | **0** | **−7** ✅ |
| Low issues | 8 | 10 | +2（N1、N2） |
| Ambiguity count | 1 | 1 | — |
| Duplication count | 1 | **0** | −1 ✅ |
| Coverage gap count | 5 | 2 | −3 |
| Underspecification count | 6 | 3 | −3 |
| Inconsistency count | 3 | 4 | +1（N1） |

---

## Next Actions

### ✅ 可直接進入 `/speckit.implement`

- 0 CRITICAL / 0 HIGH / 0 MEDIUM。
- 100% requirement coverage（每個 FR 與 SC 至少有 1 個 task）。
- 憲章 Gate 全 PASS。
- 剩餘 10 個 LOW 全為「文件 polish / 補強」等級，可於 implement 進行中或 PR review 階段順手處理，不阻擋啟動。

### 建議 implement 前的 5 分鐘小修補（可選）

若要把報告壓到 ≤ 5 LOW 再進實作：

1. **N1**（T030 `uuid()` → `crypto.randomUUID()`）— 1 行範例修正
2. **I3**（plan Phase 0 `✓` 移除）— 1 字符
3. **U4**（T009 middleware 順序補述）— 1 句話
4. **N2**（T010 `isValidIsoDate` 測試補一條）— 1 行
5. **A1**（spec.md Assumptions 加 cross-ref）— 1 行

其餘 5 項（I2、U5、U6、G4、G5）建議於 implement 過程遇到時再處理（例如 T028 改測試時補 U6、T036 改 UI 時補 U5、T043 寫 DST 測試時補 G4）。

### 不建議

- 重跑 `/speckit.clarify`：無新模糊點。
- 重跑 `/speckit.plan`：plan 結構穩定，僅有 LOW 級文字 polish。

---

## Remediation Offer

是否要由我**直接套用 5 分鐘小修補（Top 5 LOW）**？

- N1：tasks.md T030 / plan.md PATCH 範例 `uuid()` → `crypto.randomUUID().replace(/-/g, '')`
- I3：plan.md:112 `✓` 移除
- U4：tasks.md T009 補 middleware 順序敘述
- N2：tasks.md T010 補 `isValidIsoDate` 測試案例
- A1：spec.md Assumptions 補 [research.md §R2](./research.md) cross-ref

回覆「是」即套用全部 5 項；回覆「否」我留報告為唯讀並建議直接 `/speckit.implement`；回覆指定子集（如「只做 N1+N2」）我精確處理。
