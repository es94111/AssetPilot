## 專案治理原則

Please refer to the [Project Charter](.specify/memory/constitution.md) (.specify/memory/constitution.md), which serves as the guiding principle for all development work.

### 1. Think Before Coding

**Do not assume. Do not hide confusion. Surface trade-offs.**

LLMs often silently pick one interpretation and proceed. This principle enforces explicit reasoning:

* **State assumptions clearly** — If uncertain, ask instead of guessing
* **Present multiple interpretations** — When ambiguity exists, don’t silently choose
* **Raise objections when appropriate** — If there’s a simpler approach, say it
* **Pause when confused** — Point out unclear areas and request clarification

---

### 2. Simplicity First

**Solve the problem with the least amount of code. Avoid over-engineering.**

Counteract the tendency to overbuild:

* Do not add features beyond what’s requested
* Do not create abstractions for one-off code
* Do not add unrequested “flexibility” or “configurability”
* Do not handle scenarios that won’t realistically occur
* If 200 lines can be written in 50, rewrite it

**Litmus test:** Would a senior engineer consider this overly complex? If yes, simplify.

---

### 3. Precise Changes

**Only touch what must be touched. Only clean up what you break.**

When editing existing code:

* Do not “improve” adjacent code, comments, or formatting
* Do not refactor what isn’t broken
* Match the existing style, even if you prefer a different one
* If you notice unrelated dead code, mention it — don’t remove it

When your changes create orphaned code:

* Remove imports/variables/functions made obsolete by your changes
* Do not remove pre-existing dead code unless explicitly asked

**Litmus test:** Every modified line should be directly traceable to the user’s request.

---

### 4. Goal-Driven Execution

**Define success criteria. Iterate until achieved.**

Turn vague instructions into verifiable goals:

| Instead of...      | Transform into...                                           |
| ------------------ | ----------------------------------------------------------- |
| “Add validation” | “Write tests for invalid inputs, then make them pass”     |
| “Fix the bug”    | “Write a test that reproduces the bug, then make it pass” |
| “Refactor X”     | “Ensure tests pass before and after refactoring”          |

For multi-step tasks, outline a short plan:

```
1. [Step] → Verify: [Check]
2. [Step] → Verify: [Check]
3. [Step] → Verify: [Check]
```

Strong success criteria enable independent iteration. Weak ones (“make it work”) require constant clarification.

<!-- SPECKIT START -->
## 目前進行中的功能規劃

- 功能：預算與固定收支（Budgets & Recurring Transactions）
- 分支：`004-budgets-recurring`
- 規格：[specs/004-budgets-recurring/spec.md](specs/004-budgets-recurring/spec.md)
- 計畫：[specs/004-budgets-recurring/plan.md](specs/004-budgets-recurring/plan.md)
- 衍生產物：
  - [research.md](specs/004-budgets-recurring/research.md)
  - [data-model.md](specs/004-budgets-recurring/data-model.md)
  - [quickstart.md](specs/004-budgets-recurring/quickstart.md)
  - [contracts/budgets-recurring.openapi.yaml](specs/004-budgets-recurring/contracts/budgets-recurring.openapi.yaml)
<!-- SPECKIT END -->

