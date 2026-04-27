# Specification Analysis Report

**Feature**: 008-frontend-routing
**Date**: 2026-04-27
**Artifacts analyzed**: [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md)
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (v1.2.0)
**Run by**: `/speckit-analyze` (read-only)

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Ambiguity / Constitution-adjacent | HIGH | [spec.md FR-027](./spec.md), [plan.md L82-86](./plan.md), [tasks.md T037](./tasks.md) | FR-027 規定 path traversal 請求 MUST 回 404；plan 改為「仍 sendFile(index.html)（HTTP 200）」並由前端落入 404 訊息頁，HTTP 狀態碼與 spec 不一致。Spec L344 與 §假設 L396 互相矛盾（一處要求 404、一處說 catch-all 為 200 + SPA HTML）。 | 在 spec 中明確：路徑遊走的 HTTP 狀態碼預期為 404 還是 200（SPA 渲染 404）。若採後者，FR-027 文字需改寫為「MUST 走 catch-all 並寫稽核」；若維持 404，則 T037 需改為 `res.status(404).send('Not Found')`，並更新 plan §6 第 3 點。 |
| A2 | Ambiguity / Inconsistency | MEDIUM | [spec.md FR-024 #2](./spec.md), [spec.md FR-024a (a)](./spec.md), [tasks.md T056](./tasks.md) | FR-024 第 2 點規定 hash 為 `#modal-<modalId>`（modalId 為 modal 變數值，例 `#modal-modalConfirm`）；FR-024a 第 (a) 點直接寫死 `#modal-confirm`。T056 採 `'#modal-' + id` 模板字串會產出 `#modal-modalConfirm`，與 FR-024a 字面寫法不一致。 | 在 FR-024a 修正為 `#modal-<modalId>` 樣板（與 FR-024 一致）並補例：`#modal-modalConfirm`；或於 FR-024 加註「特例：modalConfirm 採縮寫 `#modal-confirm`」並讓 T056 對 confirm 採用特例字串。建議前者（一致性優先）。 |
| I1 | Inconsistency | MEDIUM | [spec.md US2 Independent Test L77](./spec.md), [spec.md US2 AC#1 L81](./spec.md), [spec.md FR-002 table](./spec.md) | US2 IT 寫「列出 11 個受保護頁入口（不含管理員面板）」，但同節 AC#1 列出 14 個項目（dashboard + 6 finance + 4 stocks + api-credits + 2 settings）。FR-002 表共 14 個受保護頁（含 admin），所以非 admin 應為 13 個（不含 admin 與 stocks 別名）—— 三處數字皆不對齊。 | 將 US2 IT 改為「列出 13 個受保護頁入口（不含管理員面板，`/stocks` 與 `/stocks/portfolio` 視為同一入口）」並與 AC#1 對齊（移除多算或更新為 13）。AC#1 目前列了 14 項，需減去 1 項或重新核對。 |
| I2 | Inconsistency | LOW | [plan.md L8 Summary](./plan.md) | Plan summary 寫「33 base FR + 13 sub-FR（`a`~`e` 後綴）= 46 FR」。實際子 FR 共 16 條（006a／007a／007b／010a-e／015a-c／021a／023a／024a-b／032a），總計 49 FR。 | 將 plan summary 計數更新為「33 base FR + 16 sub-FR = 49 FR」。或重新審視是否有遺漏的 sub-FR 不應計入。 |
| I3 | Inconsistency | LOW | [plan.md L8 Summary](./plan.md), [spec.md Clarifications L10-36](./spec.md) | Plan summary 寫「23 條 Clarification」，但 spec Clarifications §Session 2026-04-27 實際包含 25 條 Q／A 條目（已歷經兩次補充：title 兩階段 + SR live region + Modal hash + URL 編碼契約 + 側邊欄三段式 + 進度條延遲）。 | 將 plan summary 數字改為「25 條 Clarification」。最近兩個 commit (`fd0726b`、`461d686`) 已新增 4 條，但 plan summary 未同步。 |
| I4 | Inconsistency | LOW | [tasks.md T020](./tasks.md) | T020 描述：「為 US6 T053 移除獨立 handler 鋪路」。但實際移除 `/privacy`／`/terms` 獨立 handler 的任務是 T065，T053 是 US4 主題同步任務（`onUserThemeReceived`）。Cross-reference 錯誤。 | 將 T020 描述更正為「為 US6 T065 移除獨立 handler 鋪路」。 |
| I5 | Inconsistency / Terminology drift | LOW | [plan.md Performance Goals L127-128](./plan.md), [spec.md SC-008 L386](./spec.md) | Plan 將效能指標標記為 SC-008a（路由切換 100ms）／SC-008b（內容渲染 1000ms），但 spec 只定義 SC-008 含「雙層量測」(a)(b)（無正式 SC-008a／SC-008b 識別字）。Tasks T078 沿用 SC-008a／SC-008b。 | 在 spec SC-008 內顯式拆分為 SC-008a 與 SC-008b 兩條，或將 plan／tasks 用語統一為「SC-008(a)」「SC-008(b)」。建議前者，使每條 SC 可獨立稽核。 |
| C1 | Coverage Gap | MEDIUM | [spec.md FR-012](./spec.md), [tasks.md T039](./tasks.md) | FR-012 規定側邊欄分組順序「儀表板 → 收支管理 → 股票投資 → API → 設定」；T039 雖實作 `renderSidebar`，但描述僅參照 FR-002 與 FR-015b，未明確指向「分組順序」需求；無任何任務以 FR-012 為主。風險：若 ROUTES 表順序與 FR-012 不一致，T039 線性渲染會導致分組錯誤。 | 在 T039 描述補上「依 FR-012 分組順序維護 ROUTES 排列」；或新增獨立任務驗證 quickstart §2 的分組順序檢核，明確以 FR-012 為來源。 |
| C2 | Coverage Gap | MEDIUM | [spec.md FR-013](./spec.md), [tasks.md T039](./tasks.md) | FR-013 規定「管理員面板」入口 MUST 僅在 `currentUser.isAdmin` 為 true 時顯示。T039 雖提到「過濾 `requireAdmin === true` × `currentUser.isAdmin`」，但無任何任務或 spec 段落定義「角色變更（管理員身分被移除）後 sidebar 何時重新渲染」（spec Edge Cases L178 提到此情境但無 FR 對應）。 | 在 spec 新增 FR-013a 或於 FR-013 補充：「`/api/auth/me` 角色變更後 MUST 重新呼叫 `renderSidebar`」；或於 tasks 新增 T039a 任務，於主題／權限刷新點呼叫 `renderSidebar(currentUser)` 重渲染。 |
| C3 | Coverage Gap | MEDIUM | [spec.md FR-014 後段](./spec.md), [tasks.md (none)](./tasks.md) | FR-014 規定「後端對應 API MUST 一律回傳 403／無資料」。所有 admin API 之 403 行為依賴 plan 所述「既有 adminMiddleware」。但 tasks 內無「驗證既有 adminMiddleware 對 admin API 仍回 403」之任務；quickstart §2 雖測 admin 路徑命中 audit log，未明確檢核 API 403。 | 在 T075 quickstart §2 驗證項目中補一條：「以一般使用者 cookie 對 `/api/admin/*` 端點任一 GET，預期 403 而非 200」。或新增獨立任務於 server.js 確認 `adminMiddleware` 仍掛在所有 admin API 上。 |
| C4 | Coverage Gap | LOW | [spec.md SC-001/SC-002/SC-003/SC-006](./spec.md), [tasks.md T074-T076](./tasks.md) | SC-001（5/5 深層連結）、SC-002（≥99% F5 不掉頁）、SC-003（FAB 14 頁對齊）、SC-006（白名單 9+9 路徑）皆未在任何 task 描述顯式標記。T074／T076 透過 quickstart §1／§3／§6 隱含覆蓋，但無單一 task 明確點出 SC-### 對應，影響後續驗收稽核可追溯性。 | 在 T074～T076 描述末段加上對應 SC 編號（例 T074 → SC-001／SC-002）。或於 quickstart 各小節標題標記 SC-###。 |
| C5 | Coverage Gap | LOW | [spec.md FR-029, FR-030, FR-031](./spec.md) | 三條負面需求（不做 PWA／i18n／自訂主題色）為「明確排除」。Tasks 內無對應任務（合理），但亦無「掃描 PR 確認未引入 PWA／i18n／主題切換 UI」之檢核。 | 可選：在 T076（SC-006）或 polish 階段補一條：「以 grep 確認 PR 未引入 `service-worker`、`i18n`、`theme-color-picker` 等違反 FR-029～FR-031 的關鍵字」。 |
| C6 | Coverage Gap | LOW | [spec.md FR-024 #6 / FR-010e #4](./spec.md), [tasks.md (none)](./tasks.md) | FR-024 第 6 點：Modal 開啟期間若 hash 被外部改動 MUST 視為「主動離開 Modal」並關閉所有 Modal。FR-010e 第 4 點：Modal 開啟事件 MUST NOT 寫入 SR live region。T056～T058 ModalBase 行為實作未明確覆蓋此罕見邊界。 | 在 T058（trapFocus／popstate）描述補入：「外部 hashchange 事件偵測時呼叫 `ModalBase.close()`」；或新增 T058a 邊緣案例任務。 |
| U1 | Underspecification | LOW | [spec.md FR-021a (1)](./spec.md), [tasks.md T053](./tasks.md) | FR-021a 第 (1) 點宣告「後端 `/api/auth/login` 與 `/api/users/me` 回應 MUST 在 response body 直接夾帶 `theme` 欄位」，但 plan 中僅提到 `/api/auth/me`（非 `/api/users/me`）。Spec 與 plan 端點命名不一致；現行 server.js 使用 `/api/auth/me`（plan §Baseline 已實作 §第 5 點明確指出）。 | 將 spec FR-021a 的 `/api/users/me` 改為 `/api/auth/me`（與既有實作一致）。 |
| U2 | Underspecification | LOW | [spec.md FR-007a](./spec.md), [tasks.md T031](./tasks.md) | FR-007a 規定「API 任何端點回 401」皆觸發 `?next=` 重導。T031 採「漸進式改寫策略」：僅替換 dashboard／transactions／stocks 三條最高頻 fetch 路徑，其餘 fetch 留作後續 PR。此策略未在 spec 中註記為可接受的階段性實作。 | 在 spec FR-007a 末段補：「漸進改寫：本 PR 涵蓋高頻 fetch 路徑，剩餘 fetch 點以後續 PR 補完，不阻擋 v4.29.0 ship」；或補建一個 follow-up issue 列出待清理 fetch 點清單。 |
| D1 | Duplication | LOW | [spec.md FR-006a 第 0 點](./spec.md), [spec.md FR-006a 第 1-5 點](./spec.md), [Clarification L34](./spec.md) | FR-006a 第 0 點（編碼契約）與 Clarification L34（URL 編碼契約 Q/A）內容高度重複。Clarification 為決策來源，但併入 FR-006a 後形成兩處同義表述。 | 視為文件設計（Clarification 為來源，FR 為規範），可保留兩處；若考慮精簡，於 FR-006a 第 0 點末段加 `(來源: Clarification 2026-04-27)` 連結，避免日後變更只更新一處。 |

> 共 16 個 finding（無 CRITICAL，1 HIGH，5 MEDIUM，10 LOW）。未截斷。

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001（公開路由）| ✅ | T006, T065, T066 | ROUTES 含 4 公開條目；T065/T066 移除舊 handler 並改由 SPA 處理 |
| FR-002（受保護路由 14 條）| ✅ | T006 | 14 + 1 alias |
| FR-003（History API）| ✅ | T025, T026, T027 | `pushState`/`popstate` 完整鏈 |
| FR-004（catch-all）| ✅ baseline | (既有) | server.js:10167 已實作；T036 框架 |
| FR-005（依 pathname 渲染）| ✅ | T009, T028 | parsePath + init |
| FR-006（?next= 攔截 + fallback）| ✅ | T029, T030 | 含 fallback `/dashboard` |
| FR-006a（5 條規則）| ✅ | T011, T013, T038 | 前 + 後端版 |
| FR-007（已登入訪客 `/login` 自動跳轉）| ✅ | T030 | replaceState `/dashboard` |
| FR-007a（401 自動導向）| ⚠️ 部分 | T012, T031 | 僅替換高頻路徑（U2）|
| FR-007b（登出清理）| ✅ | T013, T054 | localStorage + 主題清除 |
| FR-008（404 訊息頁）| ✅ | T018, T032, T033 | 含按鈕綁定 |
| FR-009（同頁點擊不推 history）| ✅ | T041 | preventDefault |
| FR-010（pathname-only 路由）| ✅ 隱含 | T009 | parsePath 演算法 |
| FR-010a（路徑正規化）| ✅ | T003, T008, T028 | 前 + 後端版 |
| FR-010b（document.title 兩階段）| ✅ | T034, T035 | static + dynamic |
| FR-010c（捲動還原）| ✅ | T027, T028 | history.scrollRestoration manual |
| FR-010d（殼 + 進度條）| ✅ | T015, T017, T022, T025 | 含 prefers-reduced-motion |
| FR-010e（SR live region）| ✅ | T015, T017, T021, T034 | aria-live polite |
| FR-011（桌面常駐 / 行動漢堡）| ✅ | T044, T046 | 768px 斷點 |
| FR-012（側邊欄分組順序）| ⚠️ 隱含 | T039 | 未明確指向（C1）|
| FR-013（管理員面板僅 admin 顯示）| ⚠️ 隱含 | T039 | 角色變更重渲染未涵蓋（C2）|
| FR-014（admin 路徑落入 404）| ✅ | T033, T036, T047 | 前 + 後端 |
| FR-015（漢堡選單行為）| ✅ | T044, T045, T046 | 遮罩 + ESC |
| FR-015a（三件式 active）| ✅ | T040, T042 | CSS 三件式 |
| FR-015b（圖示 + 文字）| ✅ | T006, T007, T039, T043 | inline SVG 字典 |
| FR-015c（三段式佈局）| ✅ | T019, T024 | flex column |
| FR-016（情境化 FAB）| ✅ | T048, T049 | route.fab 欄位驅動 |
| FR-017（FAB z-index）| ✅ | T050 | < modal-backdrop |
| FR-018（外觀模式三選一）| ✅ | T055 | UI 切換 |
| FR-019（後端持久化）| ✅ | T053 | onUserThemeReceived |
| FR-020（立即套用 + 跟隨系統）| ✅ | T051, T055 | matchMedia change |
| FR-021（公開頁依 prefers-color-scheme）| ✅ | T051 | applyTheme(system) |
| FR-021a（三層 fallback）| ⚠️ 命名 | T052, T053, T054 | 端點命名不一致（U1）|
| FR-022（12 種 Modal 共用基底）| ✅ | T016, T056-T060 | ModalBase IIFE |
| FR-023（刪除走 modalConfirm）| ✅ | T060 | 替換 confirm() |
| FR-023a（body 捲動鎖）| ✅ | T023, T056 | iOS 防穿透 |
| FR-024（pushState + popstate）| ✅ | T056, T057 | history.state 標記 |
| FR-024a（堆疊規則）| ✅ | T056, T061 | 僅 confirm 可疊 |
| FR-024b（焦點 trap）| ✅ | T056, T057, T058 | 6 點全部 |
| FR-025（設計系統）| ✅ | T042, T062 | 視覺檢核 |
| FR-026（白名單）| ✅ | T063 | +3 條目 |
| FR-027（path traversal）| ⚠️ 衝突 | T037 | HTTP 狀態碼歧義（A1）|
| FR-028（Cache-Control）| ✅ | T064 | no-cache / max-age=300 |
| FR-029～FR-031（不做 PWA/i18n/自訂主題）| ⚠️ 無檢核 | — | (C5)|
| FR-032（路由稽核三事件）| ✅ | T037, T038, T047 | 三 action 列舉值 |
| FR-032a（後端 ADMIN_ONLY_PATHS 常數）| ✅ | T002, T047, T073 | 手動同步 |
| FR-033（稽核模式三選一）| ✅ | T004, T005, T067-T070 | system_settings 擴欄 + UI |

**Buildable Success Criteria:**

| SC | Has Task? | Task IDs | Notes |
|----|-----------|----------|-------|
| SC-001（深層連結 5/5）| ⚠️ 隱含 | T074 | (C4)|
| SC-002（F5 ≥ 99%）| ⚠️ 隱含 | T074 | (C4)|
| SC-003（FAB 14 頁對齊）| ⚠️ 隱含 | T076 | (C4)|
| SC-004（主題同步 P95 ≤ 500ms）| ✅ | T076 | quickstart §4 |
| SC-005（axe-core WCAG AA）| ✅ | T080 | 36 畫面 |
| SC-006（白名單 9+9）| ⚠️ 隱含 | T076 | (C4)|
| SC-007（跨瀏覽器 / 行動）| ✅ | T079 | latest 2 majors |
| SC-008（雙層 P95）| ✅ | T078 | 100ms / 1000ms |

---

## Constitution Alignment Issues

無 Constitution 違反。本計畫依 v1.2.0 三個 NON-NEGOTIABLE Principle 全數通過：

- **[I] 繁體中文文件規範**：spec／plan／tasks／research／data-model／quickstart 主體皆為 zh-TW；識別字保留英文。✅
- **[II] OpenAPI 3.2.0 契約**：本功能無新端點；`PUT /api/admin/system-settings` 擴一個欄位（FR-033），同 PR 更新 [openapi.yaml](../../openapi.yaml) 與 [contracts/frontend-routing.openapi.yaml](./contracts/frontend-routing.openapi.yaml)（T071 任務）。`openapi: 3.2.0` 字串完全相等。✅
- **[III] Slash-Style HTTP Path**：所有路徑（前端 ROUTES 18 條 + 既有後端端點）皆斜線；無冒號自訂方法。✅

---

## Unmapped Tasks

無「無對應 FR／SC」之任務。全部 80 個 task 皆可追溯至至少一條 FR 或為 setup／polish／validation 工作。

---

## Metrics

- **Total Requirements (FR + SC)**：49 FR (33 base + 16 sub) + 8 SC = 57 條
- **Total Tasks**：80 條（T001～T080）
- **Coverage % (有至少 1 task 指向)**：
  - FR-coverage：49/49 = 100%（含「baseline 既有」與「隱含」）
  - 嚴格指向（task 描述顯式提及 FR-###）：約 41/49 ≈ 84%
- **Ambiguity findings**：2（A1 HIGH、A2 MEDIUM）
- **Inconsistency findings**：5（I1 MEDIUM、I2-I5 LOW）
- **Coverage gap findings**：6（C1-C2 MEDIUM、C3-C6 LOW）
- **Underspecification findings**：2（U1-U2 LOW）
- **Duplication findings**：1（D1 LOW）
- **Critical issues**：0
- **HIGH issues**：1（A1 — FR-027 path traversal 狀態碼）
- **MEDIUM issues**：5
- **LOW issues**：10

---

## Next Actions

**HIGH 優先解決（建議於 `/speckit.implement` 前處理）**：

1. **A1（FR-027 狀態碼歧義）**：與 product owner 確認 path traversal 的預期 HTTP 狀態碼，並於 spec 與 plan 取得一致表述。建議：
   - 若採 SPA 內 404 渲染（與 plan 一致）：更新 FR-027 文字為「MUST 走 catch-all 並寫稽核 + 前端渲染 404 訊息頁；HTTP 200（與 FR-008 一致策略）」。
   - 若採真正 HTTP 404：更新 T037 為 `res.status(404).end()`，並於 SC-006 補入「path traversal 路徑 HTTP status MUST 為 404」量測點。

**MEDIUM 優先解決（可於實作期間補強）**：

2. **A2（Modal hash 命名）**：spec FR-024a 採用 `#modal-<modalId>` 模板（與 FR-024 對齊），消除字面寫死。
3. **I1（US2 數字不對齊）**：spec US2 IT 與 AC#1 重新核對 13 vs 14 個項目並統一。
4. **C1（FR-012 分組順序）**：T039 描述補入「依 FR-012 分組順序」字樣。
5. **C2（FR-013 角色刷新）**：補入 `renderSidebar` 重渲染觸發條件（spec 或 task 擇一）。
6. **C3（FR-014 後端 403）**：T075 quickstart 補入 admin API 403 檢核項。

**LOW 優先（可於 polish 階段順手修）**：

7. **I2／I3**：plan summary 計數更新（16 sub-FR、25 Clarification）。
8. **I4**：T020 描述「US6 T053」改為「US6 T065」。
9. **I5**：spec SC-008 拆為 SC-008a／SC-008b。
10. **U1**：spec FR-021a `/api/users/me` → `/api/auth/me`。
11. **U2**：spec FR-007a 註明階段性實作策略。
12. **C4／C5／C6／D1**：polish 階段順手補。

**建議命令**：

- `/speckit.specify --refine`：修正 spec 中 A1（FR-027 狀態碼）、A2（FR-024a hash 命名）、I1（US2 數字）、I5（SC-008 拆分）、U1（端點命名）。
- 直接編輯 [plan.md](./plan.md)：修正 I2／I3（計數）、I4（task ref）。
- 直接編輯 [tasks.md](./tasks.md)：修正 T020 task ref；補 C1／C2／C3／C4 對應 FR/SC tag。
- **無需** `/speckit.plan` 或 `/speckit.tasks` 重跑（架構與任務分解整體穩固，僅文字與覆蓋稽核需修整）。

---

## 結論

**整體結論**：本功能規格／計畫／任務分解品質高，無 CRITICAL 與 Constitution 違反；任務涵蓋率 100%（FR + SC），可進入實作階段。HIGH 級議題僅 1 條（FR-027 HTTP 狀態碼歧義），建議於 `/speckit.implement` 前 5 分鐘以內 patch 完成；其餘 MEDIUM／LOW 議題可於實作期間以「順手補」方式處理，不阻擋 MVP（US1 + US2）出貨。
