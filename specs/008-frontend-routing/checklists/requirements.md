# Specification Quality Checklist: 前端路由與頁面（Frontend Routing & Pages）

**Purpose**: 驗證規格在進入 `/speckit.clarify` 或 `/speckit.plan` 前的完整性與品質
**Created**: 2026-04-27
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> 備註：FR-003 提到「History API（`history.pushState` / `popstate`）」、FR-004 提到「`index.html` catch-all」、FR-026 列出具體靜態檔名，這些屬於 SRS 來源輸入中既已固定的合約細節（不是抽象需求），保留以維持與 SRS 2.8 對應。

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — 已於 2026-04-27 釐清會議全數解決
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification（除 SRS 來源既有合約細節外）

## Notes

- `/speckit.clarify`（2026-04-27 第一輪 Session）已解決：
  - **Q1（FR-014）**：一般使用者直接輸入管理員 URL → 顯示 404 訊息頁（與不存在路由一致），最大化資訊保密。
  - **Q2（FR-024）**：Modal 與「上一頁」整合 → 開啟時 `pushState` 一筆 hash 條目，`popstate` 觸發關閉；主動關閉同步 `history.back()`。
  - **Q3（Edge Case）**：首次深層連結 JS 載入中 → `index.html` 內聯 spinner + logo，SPA 掛載後立刻覆蓋。
  - **Q4（SC-008）**：頁面切換效能預算 → 雙層指標：客戶端路由切換 P95 ≤ 100ms、完整內容渲染 P95 ≤ 1000ms。
- `/speckit.clarify`（2026-04-27 第二輪 Session）已解決：
  - **Q5（FR-007a）**：使用中 session 過期 → 401 偵測後寫 `?next=` 導向 `/login` + Toast「您的登入已過期，請重新登入」。
  - **Q6（FR-032 + FR-033）**：路由／權限稽核日誌 → 管理員可選 `security`（預設）／ `extended` ／ `minimal` 三模式；預設僅記管理員路徑越權與 open redirect 攔截。
  - **Q7（FR-023a）**：Modal 開啟時 MUST 鎖定 `<body>` 捲動，Modal 內容自身內捲；含 iOS Safari 滾動穿透防護；12 種 Modal 一致。
- `/speckit.clarify`（2026-04-27 使用者外掛追加）：
  - **Q8（FR-024a）**：Modal 堆疊規則 → 僅 `modalConfirm` 可疊在其他 Modal 之上，其餘組合一律拒絕。
  - **Q9（FR-010a）**：路徑正規化 → 小寫、無 trailing slash、無連續斜線；不合規 URL 以 `replaceState` 改寫。
  - **Q10（FR-032a）**：後端 admin-only 路徑常數陣列；與前端路由表手動同步並由 code review 把關。
  - **Q11（FR-021a）**：登入 theme FOUC 防範 → 三層 fallback：API response.theme → localStorage `theme_pref` → `prefers-color-scheme`。
  - **Q12（FR-015a）**：側邊欄 active 視覺三件式（左側直條 + 主色文字 + 主色 8% 背景），對色盲／低對比降級安全。
- `/speckit.clarify`（2026-04-27 第三輪 Session）已解決：
  - **Q13（FR-006a）**：`?next=` 嚴格白名單驗證演算法（必須命中已知路由表，不通過寫稽核並 fallback 至 `/dashboard`）。
  - **Q14（FR-007b）**：登出後導向 `/login` 並清除 `?next=` 與 `theme_pref`；可顯示成功 Toast「已成功登出」。
  - **Q15（SC-007 更新）**：瀏覽器支援矩陣 → Chrome／Edge／Firefox latest 2 majors、Safari 16+、Android Chrome latest 2。
- 規格範圍與 SRS 2.8 對齊；不擴張至 PWA、i18n、自訂主題色（已於 FR-029 ~ FR-031 明確排除）。
- US1 + US2 構成可上線 MVP；US3 ~ US6 為品質與安全強化，可分階段交付。
- 可延後至 plan 階段處理（低衝擊）：`index.html` Cache-Control 具體 max-age 數值、`app.js` 初始 bundle size 預算、側邊欄群組內細項排序、行動斷點精確值（FR-011 已採 768px）、Modal 動畫秒數／spring 參數、FAB 距視窗邊緣 offset。
