# 2026-07-06 info-board-from-full-moon-budget

## Goal + Acceptance Criteria
- [ ] Add a new information board page inspired by `docs/跟著柴鼠減加乘-滿月記帳法.xlsx`.
- [ ] The page is reachable from the existing app navigation.
- [ ] The first screen presents the core monthly budgeting information in a dense, spreadsheet-like board rather than a marketing page.
- [ ] The implementation follows existing Next.js/UI conventions and keeps the diff scoped.
- [ ] Verification covers at least targeted lint/type/build checks and a visual/manual sanity check when feasible.

## Risk & Rollback
- Risk level: low/medium UI-only change unless navigation/auth boundaries require broader edits.
- Affected components: web app pages/navigation, potentially shared i18n labels.
- Rollback strategy: revert the added page/navigation changes.
- Monitoring signals: page render errors, navigation regressions.

## Dependencies & Environment
- Runtime: existing Next.js project tooling from `package.json`.
- Reference: local workbook at `docs/跟著柴鼠減加乘-滿月記帳法.xlsx`.
- No new dependencies planned.

## Working Notes
- User asked in Chinese: "新增一個資訊版，要長的像這樣" with the workbook path as visual reference.
- Current assumption: add a Web app information/dashboard page styled after the workbook, not edit the workbook itself.
- Workbook inspection:
  - `artifact-tool` could not import the workbook because comment metadata has missing person displayName; source workbook was not modified.
  - `openpyxl` inspection succeeded and a temporary preview confirmed the blank form layout: grey/dark year + month header, green asset/income bands, pink debt/spend bands, yellow net-worth rows, and dense 12-month columns with Total/%.
- Implementation decision: add a static first slice at `/finance/info-board` that matches the workbook structure visually, then wire it into existing navigation/i18n.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Locate existing implementation / navigation patterns.
- [x] Inspect workbook visuals, sheet names, key ranges, colors, and layout.
- [x] Design minimal approach + key decisions.
- [x] Implement smallest safe slice.
- [x] Add/adjust tests if the project has a nearby pattern.
- [x] Run verification (lint/tests/build/manual repro).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Added `/finance/info-board` as a static first-slice information board styled after the workbook's monthly grid.
- Wired the page into the finance sidebar and top navigation title.
- Added `nav.infoBoard` to shared i18n ARB files and regenerated Web/mobile outputs.
- Verification:
  - `node tools/generate-shared-i18n.mjs --check` passed.
  - `node tools/check-i18n-parity.ts` passed.
  - App-scoped TypeScript check with a temporary tsconfig excluding `tests/` passed.
  - `npm.cmd run test` passed.
  - `npm.cmd run build` did not complete because existing `@base-ui/react` files are missing from `node_modules` (`../internals/use-button/useButton.mjs`, dialog parts). This is unrelated to the new route based on the import trace.
  - Local dev server smoke test could not complete because instrumentation requires `DATABASE_URL` or `POSTGRES_URL`.
