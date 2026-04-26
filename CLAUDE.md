## 專案治理原則

Please refer to the [Project Charter](.specify/memory/constitution.md) (.specify/memory/constitution.md), which serves as the guiding principle for all development work.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!-- SPECKIT START -->
## 目前進行中的功能規劃

- 功能：統計報表（Statistics & Reports）
- 分支：`005-stats-reports`
- 規格：[specs/005-stats-reports/spec.md](specs/005-stats-reports/spec.md)
- 計畫：[specs/005-stats-reports/plan.md](specs/005-stats-reports/plan.md)
- 衍生產物：
  - [research.md](specs/005-stats-reports/research.md)
  - [data-model.md](specs/005-stats-reports/data-model.md)
  - [quickstart.md](specs/005-stats-reports/quickstart.md)
  - [contracts/stats-reports.openapi.yaml](specs/005-stats-reports/contracts/stats-reports.openapi.yaml)
<!-- SPECKIT END -->

