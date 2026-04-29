# Specification Analysis Report — 009-multi-timezone（v3 / 第 3 輪重審）

**Analyzed at**: 2026-04-29（第 3 輪）
**Inputs**: [spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[data-model.md](./data-model.md)、[research.md](./research.md)、[contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)、[.specify/memory/constitution.md](../../.specify/memory/constitution.md)
**Mode**: 唯讀（不修改任何檔案）

**Round history**:
- v1（首審）：16 findings（HIGH 1 / MEDIUM 7 / LOW 8）
- v2（第 1 輪修補）：10 findings（HIGH 0 / MEDIUM 0 / LOW 10，+2 polish 帶入）
- **v3（第 2 輪修補，本次）**：5 findings（HIGH 0 / MEDIUM 0 / LOW 5）

---

## 變更摘要（v2 → v3）

| 修補 ID | 嚴重度 | 狀態 | 驗證證據 |
|---|---|---|---|
| **N1**（`uuid()` → `crypto.randomUUID()`） | LOW | ✅ **已修復** | `grep uuid\(\)` 回零（除 analyze-01.md 內歷史引述）；tasks.md:138、plan.md:244、plan.md:293、data-model.md:88 全改完 |
| **I3**（plan Phase 0 ✓ 標記） | LOW | ✅ **已修復** | plan.md:112「Phase 0：憲章修訂與相依性確認」（無 ✓） |
| **U4**（T009 middleware 順序） | LOW | ✅ **已修復** | tasks.md:53–54 補「註冊順序」+「實作建議」說明 |
| **N2**（T010 缺 `isValidIsoDate` 測試） | LOW | ✅ **已修復** | tasks.md:65 補 4 類案例（合法 / 月日越界 / 非 ISO / 非字串） |
| **A1**（DST 假設過簡） | LOW | ✅ **已修復** | spec.md:145 加 `[research.md §R2](./research.md)` cross-ref |

**結果**：v2 → v3 共修 5 個 LOW，**無新引入問題**。第 1 輪（v1→v2）+ 第 2 輪（v2→v3）累計修：1 HIGH + 7 MEDIUM + 5 LOW = **13 項**。

---

## Findings（剩餘）

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I2 | Inconsistency | LOW | plan.md:108–378 vs tasks.md:17–225 | plan 採 8 階段（Phase 0–7，技術導向）；tasks 採 6 階段（Phase 1–6，user-story-first）。Phase 7（Regression）併入 Phase 6 Polish。對應有 mapping 但編號不一。 | 於 plan.md 結尾加一張對應表「plan Phase N ↔ tasks Phase M ↔ task IDs」。implement 中順手補即可。 |
| U5 | Underspecification | LOW | tasks.md:158 (T036) | T036 假設「個人設定頁」已有「主題模式」相鄰結構；若該頁面尚未建立／結構不同，T036 隱含 UI scaffolding。 | T036 執行前先 grep [index.html](../../index.html) 確認 settings section；若不符預期則調整錨點。 |
| U6 | Underspecification | LOW | tasks.md:124 (T028) | T028 驗證 audit metadata 含 `from`/`to`/`source` 欄位，但未斷言 `metadata` 為合法 JSON 字串（既有 `data_operation_audit_log.metadata` 為 TEXT）。 | T028 補：「斷言 `JSON.parse(row.metadata)` 不擲錯且 3 鍵齊全」；可於 implement T028 時 1 行補上。 |
| G4 | Coverage Gap | LOW | spec.md:73 (Edge Cases), tasks.md:178 (T043) | Edge Case 列兩個 DST 邊界（重複 01:30、跳過 02:30），T043 只覆蓋秋季「重複 01:00」；春跳分支未測。 | T043 執行時補一個子案例：「PST 春季 02:00→03:00（2026-03-08）月初 00:00 觸發仍只一次」。 |
| G5 | Coverage Gap | LOW | spec.md:115 (FR-014), tasks.md:108 (T025) | FR-014 規定 TWSE 永久鎖 Asia/Taipei；T025 只負責加註解，無回歸驗證測試（PST 使用者下台股交易時間判斷正確）。 | implement 階段 T025 完成後手動驗證一次：以 PST 使用者帳號打 `/api/stocks/realtime` 等台股端點，確認市場開盤判斷不受 user.timezone 影響；或補一個整合測試 task（規模有限，可省）。 |

**Findings 總計：5 項**（HIGH 0 / MEDIUM 0 / LOW 5）

> 全 5 項皆為「implement 時順手補」級別；單獨任一項都不阻擋啟動實作，且不會於後續 PR review 被退件（皆有明確 mitigation 路徑）。

---

## Coverage Summary Table

（與 v2 相同 — 100% 覆蓋無變化）

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
| FR-015 (歷史 transactions.date 不遷移) | ✅ | T060 | baseline 比對 + 自動化版本 |
| FR-016 (憲章 v1.3.0) | ✅ | T003、T058 | 修訂 + 收尾驗證 |
| FR-017 (openapi.yaml + lint) | ✅ | T049、T050 | 同步 + lint |
| FR-018 (失敗不重試) | ✅ | T046、T044 | 實作 + 測試 |
| SC-001 (regression 0 失敗) | ✅ | T012、T055 | 整合 + 全套 |
| SC-002 (PST < 1 秒) | ✅ | T013 | 整合測試 |
| SC-003 (95% < 30 分鐘 SLA) | ✅ | T041、T061 | 整合測試 + SLA 取樣統計 |
| SC-004 (1000 抽樣 100% UTC) | ✅ | T053、T054 | 自動化掃描 + npm script |
| SC-005 (6 種瀏覽器 tz 一致) | ✅ | T056 | 跨瀏覽器矩陣手測 |
| SC-006 (1 秒內反映) | ✅ | T038 | 設定頁儲存後即時 re-render |

**覆蓋率**：24/24 = **100%**

---

## Constitution Alignment Issues

無違反。憲章 v1.2.0 三大 Gate（zh-TW、OpenAPI 3.2.0、Slash-Style Path）皆 PASS；FR-007a 違反已於 plan §Complexity Tracking 列明，並透過 T003 同 PR 升級至 v1.3.0 處置。

---

## Unmapped Tasks

無孤兒任務。所有 61 個 task 皆對應 ≥ 1 FR 或 SC。

---

## Metrics

| 指標 | v1 | v2 | **v3** | v1 → v3 變化 |
|---|---|---|---|---|
| Total Functional Requirements (FR) | 18 | 18 | 18 | — |
| Total Success Criteria (SC) | 6 | 6 | 6 | — |
| Total Tasks | 59 | 61 | **61** | +2 |
| Coverage % | 91.7% | 100% | **100%** | **+8.3%** ✅ |
| Strong coverage (≥2 task) | 75% | 79% | **79%** | +4% |
| Critical issues | 0 | 0 | **0** | — |
| **High issues** | **1** | 0 | **0** | **−1** ✅ |
| **Medium issues** | **7** | 0 | **0** | **−7** ✅ |
| **Low issues** | **8** | 10 | **5** | **−3** ✅ |
| Ambiguity count | 1 | 1 | 0 | −1 |
| Duplication count | 1 | 0 | 0 | −1 |
| Coverage gap count | 5 | 2 | 2 | −3 |
| Underspecification count | 6 | 3 | 2 | −4 |
| Inconsistency count | 3 | 4 | 1 | −2 |

---

## Next Actions

### ✅ 強烈建議直接進入 `/speckit.implement`

**理由**：
- 0 CRITICAL / 0 HIGH / 0 MEDIUM。
- 100% requirement coverage（24/24）。
- 憲章 Gate 全 PASS。
- 剩餘 5 個 LOW 全為「implement 時順手處理」級別，每一項都有明確 1 行 mitigation：
  - I2：plan / tasks 結尾加對應表
  - U5：T036 動工前 grep 一下 `index.html`
  - U6：T028 加一行 `JSON.parse` 斷言
  - G4：T043 加一個 spring-forward 子測試
  - G5：T025 完成後手動 PST 帳號打台股端點 1 次

### 不建議

- 再跑一次 `/speckit.analyze`：v3 已是穩定態，再跑會回傳一樣 5 個 LOW，浪費 token。
- 進 `/speckit.clarify`：spec 模糊點已掃完。
- 重做 `/speckit.plan`：plan 結構已穩定。

### 建議路徑

1. **commit** 當前 5 階段所有規格文件（spec / plan / clarify / tasks / analyze + 修補）為單一 docs commit
2. **`/speckit.implement`** 按 T001 → T061 線性路徑開始實作；遇到剩餘 5 個 LOW 對應的 task 時順手補

---

## Remediation Offer

當前狀態無需進一步 remediation。如硬要再壓 LOW 數，可：

- 5 分鐘文書修補：U6（補 1 行斷言到 T028）+ I2（補 plan/tasks Phase 對應表 1 表格）→ 剩 3 LOW

但**強烈不建議**。剩下這幾項在 implement 中遇到時 30 秒就修完，提早處理只是 docs churn，且每修 1 條都可能在 implement 時又微調。

**結論：可直接進 `/speckit.implement`**。
