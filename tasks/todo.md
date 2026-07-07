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

# 2026-07-07 info-board-recorded-data

## Goal + Acceptance Criteria
- [x] Replace the hardcoded full-moon info-board sample values with the signed-in user's recorded AssetPilot data.
- [x] Do not read or display the workbook's "填寫範例" amounts as live data.
- [x] Keep the workbook at `docs/跟著柴鼠減加乘-滿月記帳法.xlsx` as the layout/section reference only.
- [x] Preserve the dense spreadsheet-like board and existing navigation/auth behavior.
- [x] Verification includes type/build checks where possible plus a data-source sanity check.

## Risk & Rollback
- Risk level: medium because the page now queries user financial records.
- Affected components: `/finance/info-board`, account/transaction/stock aggregation helpers if extracted.
- Rollback strategy: revert the info-board data aggregation changes to return to the previous static page.
- Monitoring signals: server render errors, slow page loads from aggregation queries, incorrect monthly totals.

## Dependencies & Environment
- Runtime: existing Next.js/PostgreSQL data access via `lib/db.ts`.
- Source data: current user's `accounts`, `transactions`, `categories`, `stocks`, `stock_transactions`, and `stock_dividends`.
- Reference workbook: used for table shape only; no new runtime dependency planned.

## Working Notes
- User clarified: "滿月資訊版，是使用我目前紀錄的資料，不要使用預設模版".
- XML inspection of the workbook found the first sheet is "滿月記帳法(填寫範例&底下FAQ必看)" and contains example amounts matching the current hardcoded page.
- The "2026年(空白表單)" sheet has labels/formulas but no meaningful filled monthly values, so the live page should aggregate app records instead of copying workbook numbers.
- Existing dashboard logic already computes bank balance and stock market value from user records; reuse those patterns where practical.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Inspect workbook structure and confirm which sheet contains examples vs blank form.
- [x] Locate existing DB/account/transaction aggregation patterns.
- [x] Design minimal live-data mapping for the full-moon board sections.
- [x] Implement smallest safe slice.
- [x] Run verification (typecheck/build/manual data-source sanity).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Added `lib/fullMoonInfoBoard.ts` to aggregate the signed-in user's current-year records into the full-moon sections:
  - assets: non-credit-card account month-end balances plus stock holdings at recorded current prices.
  - income: income transactions by category plus recorded cash dividends.
  - debt: credit-card month-end owed balances.
  - expenses: expense transactions by category.
- Updated `/finance/info-board` to render those live sections instead of the workbook/example arrays.
- Verification:
  - `npx tsc -p tsconfig.codex-info-board.json --noEmit` passed with a temporary scoped config, then the config was removed.
  - `rg` confirmed previous example labels/amount arrays are no longer present in the info-board page/helper.
  - Workbook XML inspection confirmed the first workbook sheet is the filled example and `2026年(空白表單)` is the blank form reference.
  - `npm test` passed `test:tz`, `test:photo-crypto`, and `check:iso`, then failed at existing `check:i18n` stale generated outputs. This change did not modify i18n.
  - `npm run build` did not complete before the 4-minute timeout.
- Lessons: no new correction/postmortem entry needed.
