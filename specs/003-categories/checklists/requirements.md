# Specification Quality Checklist: 分類系統（Category System）

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
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
- [x] No implementation details leak into specification

## Notes

- 規格中刻意保留「父分類整列＋子分類縮排網格＋藍色邊框＋箭頭圖示」的版面描述，因為這是使用者輸入中明確的設計約束（屬於 UX 規格，非實作細節）；這不違反「無實作細節」原則。
- 顏色驗證明確以 `#RRGGBB` 格式表示，亦來自輸入；屬於業務規則（防 CSS 注入）而非實作技術選型。
- FR-027、FR-028 顯式宣告 Non-Goals，符合「Scope is clearly bounded」要求。
- 自動補建預設子分類的冪等性（FR-010、FR-011、SC-005）來自輸入中「舊使用者登入時自動補建」之要求。
- 2026-04-25 Clarify 補強：交易為 leaf-only（FR-013a）、補建衝突跳過（FR-011a）、預設旗標為純資訊（FR-009a）、子分類可跨父移動（FR-014a/b）、父分類唯一鍵 `(user_id, type, name)`（FR-005a）。
- 2026-04-25 Clarify round 2：FR-008 重新設計每個父分類的預設子分類集（含支出「其他」與全部收入分類，使 leaf-only 下立即可用）、登入補建同步 P95 ≤ 200 ms（FR-010a/b、SC-007）、拖曳排序（FR-024a/b）、`DeletedDefaultRegistry` 防止主動刪除被復活（FR-011b/c）、「還原預設分類」非破壞性語意（FR-011d/e/f）。
- 2026-04-25 Clarify round 3：分類 type 不可變（FR-014c）、連帶刪除子分類對稱寫入 registry（FR-011b1）、分類管理頁雙區塊（先支出後收入，FR-022a）、移動子分類後 sort_order 落在新父最末（FR-014d）、**移除「是否隱藏」整個功能**（FR-002 屬性、FR-014 可編輯欄位、FR-026、Category 實體、Edge Cases、相關 user story 文字皆已清理）。

Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`.
