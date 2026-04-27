# Specification Analysis Report

**Feature**: 008-frontend-routing
**Date**: 2026-04-27
**Artifacts analyzed**: [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md), [.specify/memory/constitution.md](../../.specify/memory/constitution.md)
**Mode**: read-only（無檔案修改）

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F1 | Inconsistency | ~~HIGH~~ ✅ **已修復** | [tasks.md:233](./tasks.md), [spec.md:356-360](./spec.md), [tasks.md:237](./tasks.md) | T070 於 `extended` 模式 401 偵測點寫入 `session_expired` 動作；但 FR-032 列舉僅含 `route_admin_path_blocked` / `route_open_redirect_blocked` / `static_path_traversal_blocked` 三值；T071 同步至 `openapi.yaml` `AuditLogActions` 列舉亦未含 `session_expired`。 | **修復：** FR-032 補入第四項 `session_expired` 列舉（含 metadata `path` + `reason` 四選一）；FR-033 `extended` 描述改為「四個事件全寫」；T071 改為擴充四條列舉並補 `RouteAuditMetadataSessionExpired` schema；contracts/frontend-routing.openapi.yaml `RouteAuditAction` enum 加 `session_expired`、補 metadata schema；T070 改為引用 FR-032 第四項與 metadata 結構；T073 SRS 補登改為四條；plan.md 同步調整為四條。 |
| E1 | Coverage Gap | ~~HIGH~~ ✅ **已修復** | [spec.md:223](./spec.md) (FR-007a)、[tasks.md:100](./tasks.md) (T031) | FR-007a MUST 規範 *「API 任何端點回 401，前端路由層 MUST 立刻將當前 URL 寫入 ?next= 並導向 /login」*；但 T031 僅替換 dashboard / transactions / stocks 三條高頻 fetch，並自承 *「其餘 fetch 點留作後續清理」* — 將 MUST 級行為公然延後。 | **修復：** T031 改為**全量**替換所有 `fetch('/api/...)` 為 `apiFetch`，涵蓋 12 個受保護頁全部 fetch 點，並以 `grep -n "fetch('/api" app.js` 驗證零殘留作為完成準則；登入端點本身（首次取得 cookie）以 inline 註解豁免；plan.md 設計段同步移除「漸進式」延後條款；tasks.md Notes 改為「全量改寫 + grep 驗證」。 |
| F2 | Inconsistency | MEDIUM | [spec.md:344](./spec.md) (FR-026)、[plan.md:13](./plan.md)、[spec.md:158](./spec.md) (US6 Independent Test) | FR-026 條列 8 條白名單檔（`index.html`、`app.js`、`style.css`、`favicon.svg`、`logo.svg`、`changelog.json`、`privacy.html`、`terms.html`），但 plan §1 既有 baseline 已註明白名單含 `/vendor/webauthn.min.js`、`/lib/moneyDecimal.js`，擴充後總數應為 9；SC-006 亦聲明「9 條合法路徑」。FR-026 條列**不完整**。 | 將 `/vendor/webauthn.min.js`、`/lib/moneyDecimal.js` 補入 FR-026 條列，使 spec 文字與實作（PUBLIC_FILES）、SC-006 計數一致。 |
| C1 | Underspec | MEDIUM | [spec.md:360](./spec.md) (FR-032a)、[tasks.md:46](./tasks.md) (T002) | FR-032a 要求後端 `ADMIN_ONLY_PATHS` 與前端 `ROUTES` 中 `requireAdmin: true` 集合「**手動同步**並由 code review 把關」；現行 tasks.md 無 CI lint、無自動化檢核、亦無 Polish 階段同步性比對任務 — 易因人為疏失產生隱性安全缺陷。 | 新增 Polish 任務或檢核腳本：對 `server.js` 之 `ADMIN_ONLY_PATHS` 與 `app.js` 之 `ROUTES.filter(r => r.requireAdmin).map(r => r.path)` 比較，差異即 fail。 |
| C2 | Underspec | MEDIUM | [tasks.md:116](./tasks.md) (T038)、[tasks.md:339](./tasks.md) (Notes) | T038 後端 open redirect 偵測之「ROUTES path 列表常數」與前端 T006 之 ROUTES 表分別維護，tasks.md Notes 已自承「需手動同步」。同 C1 為手動同步面，但範圍是全 20 條路徑（非僅 admin-only）。 | 抽出共用 JSON／純 const 為單一資料來源（同檔讀取），或新增同步性檢核任務。 |
| E2 | Coverage Gap | MEDIUM | [spec.md:178](./spec.md) (Edge Case)、[tasks.md:130](./tasks.md) (T039) | spec Edge Case「權限變更但 session 仍存活...原本可見的『管理員面板』連結應消失，**已開啟頁面則導向 `/settings/account`**」；T039 C2 僅實作 sidebar 重渲染，未涵蓋「當前路由 `requireAdmin` 為 true 但角色已變」之自動 navigate 離開行為。 | 在 T039 或新增子任務：`/api/auth/me` 回應到達後若 `currentRoute.requireAdmin && !user.isAdmin` 即 `navigateToPath('/settings/account')`。 |
| C3 | Underspec | MEDIUM | [spec.md:182](./spec.md) (Edge Case 「改 URL 但 JS 尚未載入」)、[tasks.md:66-77](./tasks.md) (T017、T018) | spec 明文 *「`index.html` MUST 內聯一個極簡載入指示器（中央旋轉圈 + 應用程式 logo）...內聯資產不得發出額外網路請求」*；T017 僅加入 `#route-progress`、`#sr-route-status`；T018 加入 `#page-404`；無對應 inline loader 任務。 | 在 Phase 2 加任務：`index.html` `<body>` 起始處內聯極簡 SPA 預載指示器（純 SVG + CSS keyframe），SPA 掛載後 router 第一次渲染前移除。 |
| A1 | Duplication | LOW | [spec.md:233](./spec.md) (FR-010b 第 4 點)、[spec.md:240-245](./spec.md) (FR-010e) | FR-010b 第 4 點與 FR-010e 描述相同 SR live region 行為；spec 已自註「FR-010b 第 4 點修正為...」但兩段仍存在重複規則。 | 保留 FR-010e 為單一權威來源；將 FR-010b 第 4 點精簡為一句「依 FR-010e」。 |
| B1 | Ambiguity | LOW | [spec.md:346](./spec.md) (FR-028) | FR-028 *「未指紋版本則設短 max-age」* 未量化「短」之具體秒數；T064 落地為 `max-age=300`，但 spec 端未鎖定上限。 | spec 補入「`max-age ≤ 300s`」量化條款，避免後續實作飄移。 |
| F3 | Inconsistency | LOW | [spec.md:77](./spec.md) (US2)、[spec.md:381](./spec.md) (SC-003)、[plan.md:8](./plan.md) (Summary)、[tasks.md:53](./tasks.md) (T006) | 受保護頁數量描述橫跨文件不一致：「14 受保護頁入口」（US2 一般使用者側邊欄）／「14 個主應用程式頁面」（SC-003）／「16 受保護路徑」（plan）／「20 條 ROUTES」（含 4 公開 + 16 受保護）。語境（pages / paths / sidebar entries）未明示。 | 於 spec 開頭或 plan 加入術語對照表：14（一般使用者可見頁）、15（含管理員面板）、16（路徑數含 stocks 雙別名）、20（總路由含 4 公開）。 |
| F4 | Inconsistency | LOW | [plan.md:33-34](./plan.md)、[tasks.md:54](./tasks.md) (T007) | plan §1 寫「Lucide／Heroicons SVG 字彙」二擇一；T007 收斂為「採 Lucide 字彙」。輕微實作收斂，未造成功能差異。 | 於 plan 統一收斂為 Lucide 單一字彙；或於 T007 同步寫「Lucide／Heroicons 任一」。 |

---

## Coverage Summary（要點 FR）

完整 49 FR 對映任務太長，僅列出有風險或值得注意條目；其餘預設「已覆蓋」。

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| FR-001（公開路由） | ✅ | T006、T020、T066 | 路由表 + 容器 + 渲染 |
| FR-002（受保護路由） | ✅ | T006 | ROUTES 表 |
| FR-003（History API） | ✅ | T025、T026、T027 | navigateToPath / popstate |
| FR-004（catch-all） | ✅ | T036 | baseline 既有，本次擴增稽核 |
| FR-005（init from pathname） | ✅ | T028 | |
| FR-006a（?next= 白名單） | ✅ | T011、T029、T038 | |
| FR-007a（401 → ?next=） | ✅ | T012、T013、T031 | E1 已修復：T031 改為全量替換所有 fetch('/api/...) + grep 零殘留驗證 |
| FR-007b（登出清理） | ✅ | T013、T054 | |
| FR-008（404 頁） | ✅ | T018、T032、T033 | |
| FR-010a（路徑正規化） | ✅ | T003、T008、T028 | |
| FR-010b（title 兩階段） | ✅ | T034、T035 | |
| FR-010c（捲動還原） | ✅ | T025、T027、T028 | |
| FR-010d（殼 + 進度條） | ✅ | T015、T017、T022、T025 | |
| FR-010e（SR live region） | ✅ | T015、T017、T021、T034 | |
| FR-013（admin sidebar 可見性） | ⚠️ | T039 | **E2：權限降級時自動 navigate 缺漏** |
| FR-014（admin 路徑 404） | ✅ | T033、T047 | |
| FR-015a~c（sidebar 三件式 / 圖示 / 三段式） | ✅ | T007、T019、T024、T040、T042、T043 | |
| FR-019（theme 後端持久化） | ✅ | baseline | server.js 既有 |
| FR-021a（theme 三層 fallback） | ✅ | T051~T054 | |
| FR-022（12 Modal） | ✅ | T016、T056~T059 | |
| FR-023a（body scroll lock） | ✅ | T023、T056 | |
| FR-024（Modal back button） | ✅ | T056、T057 | |
| FR-024a（Modal 堆疊） | ✅ | T056、T061 | |
| FR-024b（Modal focus mgmt） | ✅ | T056、T057、T058 | |
| FR-026（白名單） | ⚠️ | T063 | **F2：FR-026 條列缺 vendor/lib 兩條** |
| FR-027（path traversal） | ✅ | T037 | |
| FR-028（Cache-Control） | ⚠️ | T064 | **B1：spec 未量化「短」max-age** |
| FR-032（稽核事件列舉） | ✅ | T037、T038、T047、T070、T071 | F1 已修復：FR-032 補入 `session_expired` 第四項列舉；T071 同步擴充至四條；contracts schema 補 RouteAuditMetadataSessionExpired |
| FR-032a（ADMIN_ONLY_PATHS） | ⚠️ | T002、T047 | **C1：手動同步無自動檢核** |
| FR-033（路由稽核模式） | ✅ | T004、T005、T067~T070 | |
| Edge Case「JS 尚未載入時 inline loader」 | ❌ | — | **C3：spec 要求 inline loader，無對應任務** |

### Success Criteria

| SC | Has Task? | Task IDs | Notes |
|----|-----------|----------|-------|
| SC-001（深層連結 5/5） | ✅ | T074 | |
| SC-002（F5 ≥ 99%） | ✅ | T074 | |
| SC-003（FAB 14 頁對齊） | ✅ | T075、T076 | 拆分至兩任務 |
| SC-004（主題同步 P95 ≤ 500ms） | ✅ | T076 | |
| SC-005（WCAG AA = 0） | ✅ | T080 | axe-core × 36 畫面 |
| SC-006（白名單 9+9） | ✅ | T076 | |
| SC-007（跨瀏覽器） | ✅ | T079 | |
| SC-008a（路由切換 ≤ 100ms） | ✅ | T078 | |
| SC-008b（完整渲染 ≤ 1000ms） | ✅ | T078 | |

---

## Constitution Alignment

對 `.specify/memory/constitution.md` v1.2.0 之三個 NON-NEGOTIABLE 原則檢核：

| 原則 | 結果 | 說明 |
|-----|------|------|
| I. 繁體中文文件規範 | ✅ | spec.md / plan.md / tasks.md / research.md / data-model.md / quickstart.md 主體皆為繁體中文 |
| II. OpenAPI 3.2.0 契約 | ✅ | plan.md 已宣告 `openapi: 3.2.0`；T071 將同步至根目錄 `openapi.yaml`；無新增端點 |
| III. Slash-Style HTTP Path | ✅ | 路由表 20 條全為斜線形式；無冒號自訂方法；既有路由 (`/api/admin/system-settings` 等) 沿用斜線 |

**無 Critical Constitution 違反項目。**

---

## Unmapped Tasks

無 — 所有 80 條任務皆可追溯至 ≥1 個 FR / SC / Edge Case 或 Constitution 工作項。

---

## Metrics

| 指標 | 數值 |
|-----|-----|
| Total FRs（base + sub） | 49（33 + 16） |
| Total SCs | 9（SC-008 已拆 a/b） |
| Total User Stories | 6（P1×2 + P2×2 + P3×2） |
| Total Tasks | 80（T001~T080） |
| FR Coverage % | 100%（含 baseline 與 exclusions） |
| Tasks with ≥1 FR/SC mapping | 80 / 80 |
| **Critical Issues** | **0** |
| High Issues | ~~2~~ → **0**（F1、E1 已修復） |
| Medium Issues | 5（F2、C1、C2、E2、C3） |
| Low Issues | 4（A1、B1、F3、F4） |
| Total Findings | 11（其中 2 條 HIGH 已修復） |
| Duplication Count | 1 |
| Ambiguity Count | 1 |
| Underspecification Count | 3 |
| Coverage Gap Count | 2 |
| Inconsistency Count | 4 |

---

## Next Actions

**2 條 HIGH（F1、E1）已修復；無 Critical 與 HIGH 阻擋；可進入 `/speckit.implement`。**

修復摘要：

- **F1（schema 漂移）已修復**：spec.md FR-032 第四項列舉 `session_expired` 已補；FR-033 `extended` 描述同步；T071 OpenAPI 同步改為擴充四條；contracts/frontend-routing.openapi.yaml `RouteAuditAction` enum 補 `session_expired` + 新增 `RouteAuditMetadataSessionExpired` metadata schema；T070 改為引用 FR-032 第四項；T073 SRS 補登改為四條；plan.md 同步調整。
- **E1（MUST 級延後）已修復**：T031 改為全量替換所有 `fetch('/api/...)` 為 `apiFetch`，含 grep 零殘留驗證；登入端點以 inline 註解豁免；plan.md 設計段移除「漸進式」延後條款；tasks.md Notes 改為「全量改寫 + grep 驗證」。

建議後續處理順序：

1. **補強 C1 / C2 / C3 / E2 / F2**（MEDIUM）— 可於 T080 之後追加單獨任務或合併至 T071 同步檢查；若不處理，需在 PR 描述中明示「已知技術債」。
2. **LOW（A1 / B1 / F3 / F4）** — 文件級別調整，可於 PR 中順手修正，不阻擋實作。

可用指令：

- 修 spec：手動編輯 [spec.md:357-359](./spec.md)、[spec.md:344](./spec.md)、[spec.md:182](./spec.md) 等行
- 修任務：手動編輯 [tasks.md](./tasks.md) 加入新任務或重排
- 重新分析：`/speckit.analyze` 將輸出新版報告

---

## Remediation Offer

需要為前 2 條 HIGH（F1、E1）產出具體 spec / tasks.md 修訂 patch 嗎？
（本指令為 read-only；如需實際 apply，請於確認後另行下達編輯指令。）
