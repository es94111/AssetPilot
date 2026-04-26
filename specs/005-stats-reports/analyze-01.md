# 跨產出物分析報告：統計報表（005-stats-reports）

**分析時間**: 2026-04-26（第 3 次掃描；驗證前次 round 4 remediation 是否完整落地）
**分析者**: `/speckit.analyze` (read-only audit)
**產出物**: [spec.md](./spec.md) / [plan.md](./plan.md) / [research.md](./research.md) / [data-model.md](./data-model.md) / [contracts/stats-reports.openapi.yaml](./contracts/stats-reports.openapi.yaml) / [quickstart.md](./quickstart.md) / [tasks.md](./tasks.md) / `.specify/memory/constitution.md`

**前次掃描概要**: 識別 9 個 finding（1 HIGH / 4 MEDIUM / 4 LOW），核心議題為 round 4 釐清（`/api/accounts.twdAccumulated`）後 spec/tasks 已升級但 plan/research/data-model/contracts/quickstart 五份姊妹文件**尚未同步**。

**本次掃描結論**: 前次 9 個 finding 全部驗證為 **RESOLVED**。所有姊妹文件均已補入 round 4 內容、契約檔已宣告 `twdAccumulated` schema、quickstart 已含對應驗證步驟。新一輪 6 個 LOW/MEDIUM 文件層級 finding（N1 ~ N6）已於本次 remediation 全部修補；**無任何 CRITICAL 或 HIGH**；可推進至 `/speckit.implement`。

**Remediation Applied (本輪 N1 ~ N6)**:
- **N1**: [plan.md L10](./plan.md) 改寫為自描述形式（不再循環引用 analyze-01.md 的「Remediation Applied」段落）
- **N2**: [tasks.md L10](./tasks.md) 移除「+ OUT-001/002/003/004」字樣，補充說明 spec.md 的 4 項 Out of Scope
- **N3**: [tasks.md T066 步驟 (f.1)](./tasks.md) 補 `sendStatsEmail` 回 null 時視為 failed；[tasks.md T072](./tasks.md) 補 handler MUST 回 503 不可偽裝成功
- **N4**: [tasks.md T095](./tasks.md) 補 SC-001 / SC-002 `performance.now()` 量測指引
- **N5**: [spec.md SC-007](./spec.md) 末尾補「post-launch user retention metric」標註
- **N6**: [tasks.md T015](./tasks.md) 移除 task body 內的 meta-explanation 括號註記，移至 Foundational Checkpoint 後的腳註

---

## Resolved Findings (前次 9 條已修復驗證)

| 前次 ID | 議題 | 驗證證據 | 狀態 |
|---------|------|----------|------|
| D5 (HIGH) | contracts 缺 `/api/accounts.twdAccumulated` schema | [contracts/stats-reports.openapi.yaml:26, 49-55, 268-279](./contracts/stats-reports.openapi.yaml) 已含 `AccountWithTwdAccumulated` schema 與 `/api/accounts` (GET) entry | ✅ RESOLVED |
| D2 (MEDIUM) | plan.md 仍寫「10 Clarification（3 輪）」 | [plan.md:L8](./plan.md) 已改為「11 Clarification（4 輪）」 | ✅ RESOLVED |
| D3 (MEDIUM) | research.md 缺 round 4 / T064a / T064b 研究紀錄 | [research.md §13 (L314)](./research.md) 與 §14 (L348) 已補入完整決策依據與 12h 閾值理由 | ✅ RESOLVED |
| D4 (MEDIUM) | data-model.md §2.2 描述 `accounts` 不正確 | [data-model.md §2.2 (L78-80)](./data-model.md) 已改寫，正確標註 T015 新增 `twdAccumulated` 計算欄位且不變動表結構 | ✅ RESOLVED |
| D6 (MEDIUM) | quickstart.md 缺 `twdAccumulated` / FR-023 / Mon-Sun + 週末紫色驗證步驟 | [quickstart.md §2.4 (L81-91)、§4.2 FR-023 (L213-221)、§4.3 (L237)](./quickstart.md) 三段皆已補入 | ✅ RESOLVED |
| U5 (LOW) | T015 未明示 `transactions.type` enum 假設 | [tasks.md T015 (L56)](./tasks.md) 已補「**假設 `transactions.type` enum 僅此 4 種**」inline 說明 | ✅ RESOLVED |
| C6 (LOW) | T064a 未處理 `priceAsOf` 為 0/NULL 的 corner case | [tasks.md T064a (L169)](./tasks.md) 已補「**Edge case 處理**」段落明示 NULL/0/"0" 顯示「資料: —」 | ✅ RESOLVED |
| C7 (LOW) | T064b 修改 `getReportPeriod` 屬跨任務影響 | [tasks.md T064b (L170)](./tasks.md) 已補「**跨任務影響**」段落明示對 deprecated singleton + admin test-email 的影響並要求驗證 | ✅ RESOLVED |
| I3 (LOW) | T015 帶 `[US1]` 標籤但位於 Foundational | [tasks.md T015 (L56)](./tasks.md) 已移除 `[US1]` 標籤並以「**無 [Story] 標籤**，因為定位為跨 user story 共用基礎設施」inline 說明 | ✅ RESOLVED |

---

## Specification Analysis Report (本次新一輪 finding)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **N1** | Inconsistency | MEDIUM | [plan.md:L10](./plan.md) | plan.md L10 寫「Round 4 釐清補強（2026-04-26 由 [analyze-01.md](./analyze-01.md) 跨產出物分析觸發）」與「詳見 [analyze-01.md Remediation Applied](./analyze-01.md)」。但 analyze-01.md 本身被本次掃描覆寫為新報告（第 3 次掃描），原本記錄 round 4 觸發成因的文字已不在當前版本。後續讀者點擊連結將找不到 plan 引用的「Remediation Applied」段落。 | 兩擇一：(a) plan.md L10 改寫為「Round 4 釐清補強（2026-04-26 由前次 `/speckit.analyze` 跨產出物分析觸發；前次掃描成果摘要見本檔 §Resolved Findings）」；(b) 在 analyze-01.md 本檔保留一段「## Remediation Applied (round 4)」歷史錨點供 plan 連結指向。建議 (a) 較簡潔。 |
| **N2** | Terminology | LOW | [tasks.md:L10](./tasks.md) | tasks.md scope 行寫「26 base FR + 3 sub-FR ... + OUT-001/002/003/004」。spec.md「Out of Scope」段落（L205-211）僅列 4 項排除事項，**無**任何 `OUT-###` 編號。tasks 引入了 spec 不存在的識別字。 | 兩擇一：(a) 在 spec.md「Out of Scope」段落為 4 項分別補上 `OUT-001 ~ OUT-004` 編號（與 FR-/SC- 一致）；(b) 在 tasks.md L10 移除「+ OUT-001/002/003/004」字樣（純粹 reference 性質，移除不影響任何 task 內容）。建議 (b) — Out of Scope 屬負面列表，加 ID 反而暗示需追蹤。 |
| **N3** | Underspecification | LOW | [research.md:L170](./research.md) ／ [tasks.md T062 (L166)](./tasks.md) ／ [spec.md FR-021 (L159)](./spec.md) | spec FR-021 明示「兩者皆未設定 MUST 回 503 並中斷該次寄送，不靜默吞錯」。research.md L170 與 T062 的 `sendStatsEmail` helper 行為為「兩通道皆未設定仍回 `null`（既有行為）」。caller `runScheduledReportNow` (T066) 與 endpoint handler (T072) 必須將 `null` 翻譯為 503，但**沒有任何 task 明示此 null→503 的 translation 責任在哪**。實作者可能漏接，導致設定缺失時呈現「靜默無回應」而非 spec 要求的 503。 | 在 T072 補一行「**MUST**：若 `sendStatsEmail` 回傳 `null`（兩通道皆未設定），handler MUST 回 `503 { status: 'no_email_service', reason: '寄信服務未設定' }`，不可回 `200 { sent: 0 }` 偽裝成功。」；同時於 T066 補一句「**MUST**：若 `sendStatsEmail` 回傳 `null`，視為 `failed`（非 `skipped`）並於 `last_summary` 記錄『寄信服務未設定』。」 |
| **N4** | Coverage Gap | LOW | spec SC-001、SC-002 ／ tasks T095 | SC-001（儀表板 ≤ 2 秒完整呈現）與 SC-002（統計頁切換 ≤ 1 秒同步重繪、99% 動作達標）為**可量測的 performance 目標**，但 tasks.md 未含任何 `performance.now()` 量測或 DevTools Performance 截圖驗證任務。T095 quickstart 全流程驗證為 functional 確認，無 performance gate。 | T095 補一行：「於 quickstart.md §2 與 §3 各補一段 `performance.now()` 量測：(a) `renderDashboard()` 從 click 到所有 chart 完成 < 2000ms；(b) `renderReports()` 從期間/類型 click 到三圖完成 < 1000ms。記錄至少 5 次切換的中位數於 PR 描述。」即使無自動化 gate，量測本身可作為 SC-001/SC-002 的 self-report 證據。 |
| **N5** | Coverage Soft | LOW | spec SC-007 ／ tasks scope L10 | spec.md SC-007「90% 使用者 30 秒可回答『我這個月過得如何』」為 post-launch behavioural metric，無法於 build-time 驗證。tasks.md L10 已正確聲明「SC-007 屬 post-launch retention，不在 build-time 驗證範疇」。但 spec.md SC-007 本身**未**明示此性質，可能誤導未來讀者期待 build-time 驗收。 | spec.md SC-007 末尾補一句「*(此項屬 post-launch user retention metric，需透過分析 / 訪談量測，本功能 build-time 不直接驗證；列入此處以對齊產品目標。)*」 |
| **N6** | Documentation | LOW | [tasks.md T015 (L56)](./tasks.md) | T015 內括號註記「（**無 [Story] 標籤**，因為定位為跨 user story 共用基礎設施 — 雖然目前僅 US1 消費，但 contract 修改屬於跨頁基礎契約變更）」此括號註記寫進 task body，會在實作者複製 task 描述至 commit message / PR 描述時造成噪音；屬 meta-explanation 而非 actionable 內容。 | 將該括號內容移至 tasks.md「Notes」段落或 `## Phase 2: Foundational` checkpoint 後的腳註，task body 內僅保留 actionable 描述（檔案路徑、行為要求、對應 FR）。建議 polish-only，不阻塞實作。 |

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 (儀表板 KPI 跟隨月份切換器) | ✅ | T020, T023 | |
| FR-002 (支出分類雙圓餅切換) | ✅ | T021, T025 | |
| FR-003 (圖例 + tooltip + 前 5 名) | ✅ | T025 | renderDashExpenseTop5 既有 helper 重用 |
| FR-004 (資產配置圓餅 + 不主動查價) | ✅ | T015, T027 | |
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
| FR-014 (折線/長條 X 軸聚合粒度系統決定) | ✅ | T049, T050 | 閾值 ≤31/≤92/≤366/>366 已 inline |
| FR-015 (三圖空狀態統一) | ✅ | T012, T051 | |
| FR-015a (圓餅圖點擊跳轉 + 返回鈕保留 state) | ✅ | T013, T014, T026, T029, T048 | |
| FR-016 (管理員建立排程 + 多筆並存) | ✅ | T068, T069, T076 | |
| FR-017 (寄送前股價更新) | ✅ | T066 (step c), T072 | 既有 `updateUserStockPrices` 重用 |
| FR-018 (HTML 信件版面 + 對比 pill 同型前一段) | ✅ | T011, T063, T064 | |
| FR-019 (交易紀錄區塊隨頻率切換 + 週末紫色) | ✅ | T064b | weekly Mon-Sun 起點 + 週末紫色驗證 |
| FR-020 (股票投資 4 列彩色 ±) | ⚠️ baseline | (既有 baseline) | 既有 `renderStatsEmailHtml` 已實作；T064a 補資料時間註記時 MUST 不破壞既有 4 列 |
| FR-021 (寄信通道 SMTP 優先 + Resend 退回 + 503) | ⚠️ partial | T062, T066, T072 | 兩通道皆未設定的 null→503 translation 責任未明示（見 N3） |
| FR-022 (台灣時區排程觸發) | ✅ | T065, T067 | 既有 `twParts()` 重用 |
| FR-023 (持股價更新失敗時的快取 + 資料時間註記) | ✅ | T064a | NULL/0 corner case 已補 |
| FR-024 (使用者停用時略過寄送) | ✅ | T066 (step b.1) | |
| FR-024a (停用→啟用不補寄) | ✅ | T065, T070 | last_run 不重置邏輯已明示 |
| FR-025 (本幣 TWD 等值統一) | ✅ | T015 | 既有 transactions.twd_amount 累計 |
| FR-026 (圖表即時反映變動) | ⚠️ inherent | (FR 性質為 invariant) | 由 US1/US2 的「不快照」設計天然滿足；T095 quickstart §6 含手動驗證 |
| SC-001 (儀表板 ≤ 2 秒) | ⚠️ no measurement | (見 N4) | T095 quickstart 為 functional 驗證，無 performance.now() gate |
| SC-002 (統計頁切換 ≤ 1 秒、99%) | ⚠️ no measurement | (見 N4) | 同上 |
| SC-003 (圓餅排序 100% 穩定) | ✅ | T010 | 後端 helper 統一聚合 |
| SC-004 (排程信件 ≤ 5 分鐘寄送) | ✅ | T066 | per-schedule lock 確保不互相阻塞 |
| SC-005 (Outlook Desktop 100% 視覺一致) | ⚠️ manual | T095 (manual) | 接受現狀；PR 須附 Outlook 截圖 |
| SC-006 (新增/修改/刪除即時反映) | ✅ | (FR-026 同源) | T095 quickstart §6 |
| SC-007 (90% 使用者 30 秒可判斷) | ❌ post-launch | (見 N5) | 屬 post-launch behavioural metric |

**FR 覆蓋率**: 29 / 29 = **100%**（含 baseline 與 inherent；27 條有顯式 task，FR-020 / FR-026 為 baseline / invariant）。
**SC 覆蓋率**: 4 / 7 顯式驗證、2 / 7 manual / inherent、1 / 7 post-launch。

---

## Constitution Alignment Issues

無重大違反。

| 原則 | 狀態 | 證據 |
|------|------|------|
| Principle I — 繁體中文文件 | ✅ PASS | spec / plan / research / data-model / quickstart / tasks 主體皆為 zh-TW；技術名詞例外條款適用 |
| Principle II — OpenAPI 3.2.0 契約 | ✅ PASS | [contracts/stats-reports.openapi.yaml:1](./contracts/stats-reports.openapi.yaml) 字串 `openapi: 3.2.0`；新端點均有 `security`；共用 schema 以 `$ref` 表達；T015 的 `twdAccumulated` schema 已宣告 |
| Principle III — Slash-style HTTP path | ✅ PASS | 全檔案路徑 `/api/admin/report-schedules/{id}/run-now` 等皆為斜線；多字動詞 `run-now` 為 kebab-case；T094 grep gate 含護欄驗證 |
| Workflow — Contract-first | ✅ PASS | T033 / T054 / T081 同步根目錄 `openapi.yaml`；T090 ~ T092 同步 changelog.json + SRS.md；T093 OpenAPI lint gate |

---

## Unmapped Tasks

無；所有 task 均有對應 FR / SC 或為 cross-cutting Setup / Foundational / Polish。

---

## Metrics

- **Total Requirements**: 29 FR (26 base + 3 sub) + 7 SC = 36
- **Total Tasks**: 68（T001-003 setup / T010-015 foundational / T020-033 US1 / T040-054 US2 / T060-081 US3 / T090-095 polish）
- **Coverage %（FR with ≥1 task or baseline）**: 100%
- **Coverage %（SC with build-time verification）**: 4 / 6 = 67%（SC-007 排除為 post-launch）
- **Ambiguity Count**: 1（N4 SC-001/SC-002 無顯式量測）
- **Duplication Count**: 0
- **Critical Issues Count**: 0
- **High Issues Count**: 0
- **Medium Issues Count**: 1（N1 plan→analyze 循環引用）
- **Low Issues Count**: 5（N2、N3、N4、N5、N6）

---

## Next Actions

**結論**: 無 CRITICAL / HIGH 議題；前次 round 4 remediation 全部驗證落地。本次 6 個 finding 屬文件層級 polish，**不阻塞 `/speckit.implement`**。

建議的下一步（依優先級）：

1. **可選擇性遵照 N3 強化**：在 T072 / T066 task body 補 null→503 translation 責任明示，避免實作者漏接而違反 spec FR-021「不靜默吞錯」承諾。
2. **可選擇性遵照 N1 修補**：plan.md L10 改寫為自描述形式（不再循環引用 analyze-01.md）。
3. **可選擇性遵照 N4 補 measurement gate**：T095 quickstart 補 `performance.now()` 量測作為 SC-001/SC-002 的 self-report 證據。
4. **可選擇性遵照 N5 標註 post-launch SC-007**：spec.md 直接於 SC-007 內標註性質，避免未來讀者誤判 build-time 驗收範圍。
5. **N2、N6 為 cosmetic polish**，可於 implement PR 內順手完成或忽略。

**可直接執行的下一個指令**:
- `/speckit.implement` — 開始落地 T001 ~ T095（依 plan 的 MVP First 策略：US1 → US2 → US3 → Polish）。
- 若先處理 N3：執行 `/speckit.tasks` 微調 T066 / T072 描述後再進入 implement。

---

## Remediation Status

✅ N1 ~ N6 全部已套用 remediation（見上方「Remediation Applied」區塊）。
本次 `/speckit.analyze` 結束，可進入 `/speckit.implement`。
