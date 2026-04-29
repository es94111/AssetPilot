# Specification Analysis Report — 009-multi-timezone

**Analyzed at**: 2026-04-29
**Inputs**: [spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[data-model.md](./data-model.md)、[research.md](./research.md)、[contracts/multi-timezone.openapi.yaml](./contracts/multi-timezone.openapi.yaml)、[.specify/memory/constitution.md](../../.specify/memory/constitution.md)
**Mode**: 唯讀（不修改任何檔案）

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | HIGH | tasks.md:196 | Dependencies 段宣稱「Phase 5 (US3) 依賴 ... Phase 4 的 audit 寫入工具（T030）」，但 US3 任務（T041–T048）皆為排程器與 `monthly_report_send_log`，與 PATCH 時區的 audit 寫入無關。此宣稱破壞 spec.md 中「user stories 獨立可測」承諾。 | 將該行改寫為「Phase 5 僅依賴 Phase 2（migration + lib/userTime）」；移除對 T030 的依賴敘述。 |
| D1 | Duplication | MEDIUM | spec.md:94, spec.md:119 | FR-006 的「失敗策略」尾段與 FR-018 完整重疊（兩者皆規定 failed 列保留、不自動重試、不交付管理員 UI）。 | 保留 FR-018 為失敗策略單一來源；將 FR-006 收斂為「每月一封 + per-user 觸發」核心；於 FR-006 末尾加 cross-ref：「失敗策略見 FR-018」。 |
| G1 | Coverage Gap | MEDIUM | spec.md:116 (FR-015), tasks.md | FR-015 規定「既有 `transactions.date` 不遷移」，但 tasks.md 無對應驗證任務（無 task 顯式檢查升級前後 transactions 行數／內容一致）。 | 於 Phase 6 Polish 新增 T0XX：「升級前後 `SELECT COUNT(*), MIN(date), MAX(date) FROM transactions` 三項數值完全相同」。 |
| G2 | Coverage Gap | MEDIUM | spec.md:133 (SC-003), tasks.md:145 (T041) | SC-003 規定「100 名隨機抽樣使用者中 95% 落在 0:00–0:30」，但 T041 只整合測 1 名 PST 使用者觸發；無 SLA 取樣／統計任務。 | 於 Phase 6 加 T0XX：「於 staging 建 100 名測試帳號分布於 ≥10 個時區，跑一個月模擬，記錄每筆 `monthly_report_send_log.sent_at_utc` 與該使用者當地 1 號 00:00 差距，計算 P95 ≤ 30 分鐘」。 |
| G3 | Coverage Gap | MEDIUM | tasks.md:56 (T010) | T010 列舉 `isValidIanaTimezone`、`todayInUserTz`、`partsInTz`、`toIsoUtc` 四個函式測試，但 `lib/userTime.js`（T007）匯出 6 個純函式（缺 `monthInUserTz`、`isFutureDateForTz` 直接測試）。 | T010 描述補上 `monthInUserTz` 跨月／跨年案例與 `isFutureDateForTz` 三組（過去／當天／未來）案例。 |
| U1 | Underspecification | MEDIUM | tasks.md:118 (T030), plan.md:240 | T030 描述「寫 `data_operation_audit_log` 一列」；plan 範例呼叫 `writeAuditLog({...})`。專案是否已有 `writeAuditLog` helper 未確認；若無則 T030 隱含「建立 helper」子任務。 | T030 描述補一句：「若 server.js 尚無 `writeAuditLog` helper 抽象，於 T030 同步建立或直接 `INSERT INTO data_operation_audit_log` SQL；先 grep 確認後再決定」。 |
| U2 | Underspecification | MEDIUM | tasks.md:85 (T019) | T019 改寫「定期交易展開」內 `todayInTaipei()` → `todayInUserTz(...)`，但該邏輯運行於 scheduler context（無 `req.userTimezone`）；任務只簡述「查詢條件用 `users.timezone` JOIN」，未明確改寫形狀（例：先 batch SELECT users → 對每 schedule 呼叫 `todayInUserTz(user.timezone)`）。 | T019 補虛擬碼或步驟列：「(a) `SELECT s.*, u.timezone FROM recurring_schedules s JOIN users u ON s.user_id=u.id` 一次撈、(b) for-each 用 `userTime.todayInUserTz(row.timezone)` 比對」。 |
| U3 | Underspecification | MEDIUM | tasks.md:87 (T021) | T021 為探索性任務（「找出所有 `res.json` 路徑中含 `created_at` 等鍵」），未列舉具體端點清單；風險：升級後仍有遺漏端點輸出未經 `toIsoUtc` 包裝的字串，違反 FR-003。 | T021 拆為兩個 sub-task：(a) 跑 `grep -nE 'res\.json|JSON\.stringify' server.js` 列出全清單於 PR 描述；(b) 再逐一檢查並修。或另增 T053（自動化掃描）為 fail-safe。 |
| G4 | Coverage Gap | LOW | spec.md:73 (Edge Cases), tasks.md:147 (T043) | Edge Case 描述兩個 DST 邊界（重複 01:30、跳過 02:30），但 T043 整合測試只覆蓋「PST 秋季重複 01:00」；春跳分支未測。 | T043 補一個子案例：「PST 春季 02:00→03:00（2026-03-08）月初 00:00 觸發仍只一次」；或新增 T0XX 專測 spring-forward。 |
| G5 | Coverage Gap | LOW | spec.md:115 (FR-014), tasks.md:97 (T025) | FR-014 規定 TWSE 永久鎖 Asia/Taipei；T025 只負責「加註解」，無回歸驗證測試（PST 使用者下台股交易時間判斷正確）。 | 於 Phase 5（US3）或 Polish 加 T0XX：「以 PST 使用者帳號打 `/api/stocks/realtime` 等台股端點，確認市場開盤判斷不受 user.timezone 影響」。 |
| I2 | Inconsistency | LOW | plan.md:108-378 vs tasks.md:17-186 | plan 採 8 階段（Phase 0–7，技術導向）；tasks 採 6 階段（Phase 1–6，user-story-first）。Phase 7（Regression）在 tasks 併入 Phase 6 Polish。跨檔對應有明確 mapping 但編號不一，引用時易混淆。 | 於 plan.md 結尾或 tasks.md 結尾加一張對應表「plan Phase N ↔ tasks Phase M ↔ task IDs」。 |
| I3 | Inconsistency | LOW | plan.md:112 | Phase 0 標題「憲章修訂與相依性確認 ✓」帶勾號，但 T003 尚未執行；視覺暗示「已完成」造成誤導。 | 移除 ✓ 或改為「☐」直至 T003 完成。 |
| U4 | Underspecification | LOW | tasks.md:52 (T009) | T009 規定「對需 auth 的 /api/** 路由前置」加 `attachUserTimezone` middleware；filter 機制（per-route 註冊 vs 全域 middleware + 條件略過）未明示。Express middleware 順序與例外路徑（如 `/api/login`、`/api/healthz`）需明確。 | T009 補一句：「於 `requireAuth` middleware 之後立即接 `attachUserTimezone`；登入／公開端點不經 `requireAuth` → 自然不經 `attachUserTimezone`」。 |
| U5 | Underspecification | LOW | tasks.md:127 (T036) | T036 假設「個人設定頁」已存在且已有「主題模式」區塊；若該頁面尚未建立／結構不同，T036 隱含 UI scaffolding。 | T036 補：「先 grep 確認 `index.html` 內 settings section 結構；若不符預期則調整錨點選擇」。 |
| A1 | Ambiguity | LOW | spec.md:145 (Assumptions) | 「DST 切換不需要額外特殊處理；以 IANA tz database 規則為準」過於簡略；research.md R2 有完整論述（含具體 5 組測試時區）。 | 於該 Assumption 後加 cross-ref：「詳見 [research.md §R2](./research.md)」。 |
| U6 | Underspecification | LOW | tasks.md:113 (T028) | T028 驗證 audit log metadata 含 `from`/`to`/`source`，但未斷言 `metadata` 為「合法 JSON 字串」（既有 `data_operation_audit_log.metadata` 可能是 TEXT 欄位）。 | T028 描述補：「斷言 `JSON.parse(metadata)` 不擲錯且鍵齊全」。 |

**Findings 總計：16 項**（HIGH × 1、MEDIUM × 7、LOW × 8）

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 (users.timezone 欄位) | ✅ | T004 | DB migration |
| FR-002 (拒絕非 IANA) | ✅ | T007、T010、T030 | 工具 + 測試 + handler |
| FR-003 (ISO 8601 UTC `Z` + 毫秒) | ✅ | T007、T010、T014、T021、T053–T054 | 工具 + 4 測試任務 |
| FR-004 (per-user 今天/當月) | ✅ | T007、T009、T015–T020 | 替換 8 處 |
| FR-005 (`transactions.date` 預設 = 使用者當天) | ✅ | T020 | POST/PATCH 預設值 |
| FR-006 (月度郵件 per-user) | ✅ | T005、T045–T046、T042 | 表 + scheduler + 測試 |
| FR-007 (GET /api/users/me) | ✅ | T029、T026 | handler + test |
| FR-008 (PATCH /me/timezone + audit) | ✅ | T030、T027、T028 | handler + 2 測試 |
| FR-009 (Asia/Taipei regression-free) | ✅ | T012、T015–T020、T055 | regression test + replacements |
| FR-010 (前端偵測 + 3 條件提示) | ✅ | T034、T035 | 既有 + 新使用者 |
| FR-011 (個人設定時區下拉) | ✅ | T036、T037 | UI + data source |
| FR-012 (前端依 user.tz 顯示) | ✅ | T032、T039 | 工具 + 替換 |
| FR-013 (前端送出格式) | ✅ | T024、T032、T038 | 隱含覆蓋 |
| FR-014 (TWSE 永久 Asia/Taipei) | ⚠ 部分 | T025 | 只有註解，無回歸測試（見 G5） |
| FR-015 (歷史 `transactions.date` 不遷移) | ❌ | — | **缺驗證任務**（見 G1） |
| FR-016 (憲章 v1.3.0) | ✅ | T003、T058 | 修訂 + 收尾驗證 |
| FR-017 (openapi.yaml + lint) | ✅ | T049、T050 | 同步 + lint |
| FR-018 (失敗不重試) | ✅ | T046、T044 | 實作 + 測試 |
| SC-001 (regression 0 失敗) | ✅ | T012、T055 | 整合 + 全套 |
| SC-002 (PST < 1 秒) | ✅ | T013 | 整合測試 |
| SC-003 (95% < 30 分鐘 SLA) | ⚠ 部分 | T041 | 只測單一帳號，無 SLA 取樣（見 G2） |
| SC-004 (1000 抽樣 100% UTC) | ✅ | T053、T054 | 自動化掃描 + npm script |
| SC-005 (6 種瀏覽器 tz 一致) | ✅ | T056 | 跨瀏覽器矩陣手測 |
| SC-006 (1 秒內反映) | ✅ | T038 | 設定頁儲存後即時 re-render |

**覆蓋率**：22/24（91.7%）。**未完全覆蓋**：FR-014（弱）、FR-015（缺）、SC-003（弱）。

---

## Constitution Alignment Issues

無違反。憲章 v1.2.0 三大 Gate（zh-TW、OpenAPI 3.2.0、Slash-Style Path）皆 PASS；FR-007a 違反已於 plan §Complexity Tracking 列明，並透過 T003 同 PR 升級至 v1.3.0 處置。

---

## Unmapped Tasks

無孤兒任務（每個 task 皆對應到 ≥1 FR 或 SC）：

- T001、T002（環境檢查）→ 對應 plan §Technical Context、Assumptions「ICU 覆蓋」前置
- T003（憲章）→ FR-016
- T004–T006（DB migration）→ FR-001、FR-006
- T007–T009（工具 + middleware）→ FR-002、FR-003、FR-004
- T010–T011（foundational tests）→ FR-002、FR-003、SC-004
- T012–T025 → US1
- T026–T040 → US2
- T041–T048 → US3
- T049–T059 → 文件 / 自動化驗證 / 收尾

---

## Metrics

| 指標 | 數值 |
|---|---|
| Total Functional Requirements (FR) | 18 |
| Total Success Criteria (SC) | 6 |
| Total Tasks | 59 |
| Coverage % (Requirements with ≥1 task) | 22/24 = **91.7%** |
| Strong coverage (≥2 task references) | 18/24 = 75% |
| Ambiguity count | 1 |
| Duplication count | 1 |
| Underspecification count | 6 |
| Coverage gap count | 5 |
| Inconsistency count | 3 |
| **Critical issues** | **0** |
| **High issues** | **1**（I1 — US3 偽依賴 US2） |
| Medium issues | 7 |
| Low issues | 8 |

---

## Next Actions

### 建議於進入 `/speckit.implement` 前修補

無 CRITICAL，但建議至少處理 **HIGH × 1** 與 **MEDIUM 中影響覆蓋率的 4 項**：

1. **I1**（HIGH）— 直接編輯 [tasks.md:196](./tasks.md#L196) 將 `Phase 5 (US3) 依賴 Phase 2 + Phase 4 的 audit 寫入工具（T030 ...）` 改為 `Phase 5 (US3) 僅依賴 Phase 2`。確保 user story 獨立性。
2. **D1**（MEDIUM）— 編輯 [spec.md:94](./spec.md#L94) FR-006 收斂為「per-user 觸發 + 每月一封」；失敗策略全寄於 FR-018，於 FR-006 末加「（失敗處理見 FR-018）」。
3. **G1**（MEDIUM）— 在 [tasks.md](./tasks.md) Phase 6 補一個 task：FR-015 驗證任務。
4. **G2**（MEDIUM）— 在 [tasks.md](./tasks.md) Phase 6 補一個 task：SC-003 SLA 取樣統計。
5. **G3**（MEDIUM）— 編輯 [tasks.md:56](./tasks.md#L56) T010 補 `monthInUserTz`、`isFutureDateForTz` 測試案例。

### 可於 implement 階段一併處理

- U1、U2、U3、U6（M）：在執行 T019、T021、T028、T030 時擴充為更精細子任務即可。
- I2、I3、U4、U5、A1、G4、G5（L）：document drift / wording polish，PR review 時再修。

### 建議命令

- 立即修補：直接編輯 spec / tasks（不需呼叫 speckit-clarify，因已是已確認的事實校正）。
- 修補完成後：可 `/speckit.implement` 開始按 tasks.md 執行；單人路徑見 tasks.md 結尾的線性序列。

---

## Remediation Offer

是否要由我**直接套用上述 Top 5（HIGH + Top 4 MEDIUM）的具體編輯**？

- I1 修 tasks.md Dependencies 段
- D1 收斂 spec.md FR-006
- G1 增補 FR-015 驗證 task
- G2 增補 SC-003 SLA 取樣 task
- G3 擴充 T010 測試案例

回覆「是」即套用；回覆「否」我留報告為唯讀；回覆指定子集（如「只做 I1 + G1」）我精確處理。
