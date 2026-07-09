# 2026-07-09 typescript-7-upgrade

## Goal + Acceptance Criteria
- [ ] Upgrade the project TypeScript dev dependency from 6.x to 7.x.
- [ ] Keep the change scoped to package metadata, lockfile, and only compatibility fixes required by verification.
- [ ] Preserve existing Next.js/npm project conventions.
- [ ] Verification covers at least install/lock consistency plus targeted type/build/test checks where feasible.

## Risk & Rollback
- Risk level: medium because this changes compiler behavior and can surface project-wide type/config incompatibilities.
- Affected components: TypeScript compiler, Next.js build/typecheck flow, TS-based tests/tools.
- Rollback strategy: revert `package.json`, `package-lock.json`, and any compatibility edits from this task.
- Monitoring signals: typecheck failures, Next build failures, TS-based tool/test failures.

## Dependencies & Environment
- Package manager: npm with `package-lock.json`.
- Runtime constraint from `package.json`: Node `>=24.0.0 <25`.
- Current dependency before change: `typescript` `^6.0.3`.

## Working Notes
- Existing user worktree changes are present under `mobile/test-lab/*`; do not touch or revert them.
- npm reports `typescript@7.0.2` as `latest`; `next` is a 7.1.0 dev prerelease, so use stable `^7.0.2`.
- Local shell Node is `v22.22.2`, while the project declares `>=24.0.0 <25`; verification may be limited by this environment mismatch.
- TypeScript 7 no longer ships `typescript/lib/typescript.js`; Next 16.2.9 still checks for that legacy file for tsconfig path loading and built-in type validation.
- Next/Webpack needs an explicit `@` alias in `next.config.ts` under TS7 because Next cannot load `paths` from tsconfig through the old TypeScript JS API.
- Keep type safety in the npm build path by running an explicit `npm run typecheck` before `next build`; Next's incompatible built-in validation is skipped.
- Add pinned `@typescript/native-preview@7.0.0-dev.20260707.2` as a Next 16 compatibility signal only, so Next does not try to auto-install legacy `typescript` during build.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Confirm available TypeScript 7 version and peer/tooling constraints.
- [x] Update package metadata and lockfile minimally.
- [x] Run verification (lock consistency, typecheck/build/tests).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Upgraded `typescript` from `^6.0.3` to `^7.0.2`; `npm ls typescript --depth=0` resolves `typescript@7.0.2`.
- Added `@typescript/native-preview@7.0.0-dev.20260707.2` to exercise Next 16's native TypeScript compatibility path; actual typechecking still uses `typescript@7.0.2`.
- Added `npm run typecheck` using `tsconfig.typecheck.json`, excluding the existing `tests/e2e` Playwright tests because `@playwright/test` is not installed in this workspace.
- Changed `npm run build` to run `npm run typecheck && next build --webpack`.
- Added an explicit Webpack `@` alias in `next.config.ts` for TS7/Next16 compatibility, and set Next's built-in type validation to skip after the explicit typecheck.
- Verification:
  - `npm run typecheck` passed.
  - `npm run build` passed; Next prints its native-preview info message plus existing cache-control and middleware warnings.
  - `npm test` passed `test:tz`, `test:photo-crypto`, `test:info-board`, and `check:iso`, then failed at existing stale i18n generated outputs.
  - Full `npx tsc --noEmit --pretty false` remains blocked by existing E2E `@playwright/test` type setup.
- Lesson recorded: `2026-07-09 TypeScript 7 Removed baseUrl`.

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

# 2026-07-07 info-board-avg-cost-schema

## Goal + Acceptance Criteria
- [x] Fix `/finance/info-board` server render failure: `column "avg_cost" does not exist`.
- [x] Keep the page using the signed-in user's recorded data.
- [x] Preserve existing stock/transaction behavior and avoid broad refactors.
- [x] Verification includes targeted type/build checks or a documented reason if unavailable.

## Risk & Rollback
- Risk level: medium because this touches database schema compatibility for finance data.
- Affected components: stock schema initialization/migration and full-moon info-board stock aggregation.
- Rollback strategy: revert the schema/query change; if a migration column is added, it is additive and can safely remain.
- Monitoring signals: `/finance/info-board` render errors, stock page render/API errors, migration startup logs.

## Dependencies & Environment
- Runtime: existing Next.js/PostgreSQL data access via `lib/db.ts`.
- Reported environment: Zeabur runtime log at `2026-07-07T04:18:18Z`.
- No new dependencies planned.

## Working Notes
- Reported error points at `/finance/info-board/page.js` and `column "avg_cost" does not exist`.
- Initial search found `lib/fullMoonInfoBoard.ts` selects `avg_cost` from `stocks`.
- Initial search found `lib/db.ts` includes `avg_cost` in `CREATE TABLE stocks`, but the existing-table ALTER compatibility list only adds `current_price`, `stock_type`, and `delisted`.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Locate existing implementation / migration patterns.
- [x] Design minimal approach + key decisions.
- [x] Implement smallest safe slice.
- [x] Add/adjust tests if a nearby schema/query test exists.
- [x] Run verification (typecheck/build/manual schema sanity).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Added an idempotent `stocks.avg_cost` compatibility migration in `lib/db.ts` so existing PostgreSQL databases catch up to the current `CREATE TABLE stocks` definition.
- Removed the unused `avg_cost` column from the `/finance/info-board` stock aggregation query in `lib/fullMoonInfoBoard.ts`; stock market value still uses recorded transactions, current price, and currency.
- Verification:
  - `rg` confirmed `avg_cost` remains only in `lib/db.ts` create/alter schema lines and is no longer selected by `lib/fullMoonInfoBoard.ts`.
  - `npx tsc -p tsconfig.codex-info-board.json --noEmit --pretty false` passed for the changed data-layer files; the temporary tsconfig was removed.
  - Static schema sanity check passed: schema alter exists and the info-board SELECT no longer asks for `avg_cost`.
  - `npm test` passed `test:tz`, `test:photo-crypto`, and `check:iso`, then failed at existing `check:i18n` stale generated outputs.
  - `npm run build` compiled successfully, then failed in the local environment with `spawn EPERM`.
  - Full `npx tsc --noEmit --pretty false` is blocked by existing E2E type setup: missing `@playwright/test`.
- Lessons: added `2026-07-07 Optional Test Dependency Assumption` to `tasks/lessons.md`.

# 2026-07-07 info-board-future-month-data

## Goal + Acceptance Criteria
- [x] Fix the full-moon info-board so months after the current month do not show recorded or carried-forward values.
- [x] Current month being July means August-December cells stay blank even when account balances or future-dated records would otherwise produce values.
- [x] Preserve the signed-in user's live-data behavior and existing dense spreadsheet layout.
- [x] Keep the change scoped to the info-board aggregation/rendering path unless evidence requires otherwise.
- [x] Verification includes a deterministic regression check for months after July.

## Risk & Rollback
- Risk level: medium because the page summarizes user financial records.
- Affected components: `lib/fullMoonInfoBoard.ts`, `/finance/info-board` rendering if needed, and any targeted tests/helpers added for this behavior.
- Rollback strategy: revert the info-board future-month data fix; no schema or data migration planned.
- Monitoring signals: `/finance/info-board` render errors, incorrect blank cells after the current month, changed totals.

## Dependencies & Environment
- Runtime: existing Next.js and TypeScript tooling.
- Date context: current date is 2026-07-07 in Asia/Taipei; the current-year board should only display through July.
- No new dependencies planned.

## Working Notes
- User reported in Chinese: "滿月資訊版，現在7月，滿月資訊版7月之後的月份是有資料的，修復錯誤".
- Corrected interpretation: the bug is that future months after the current month already show data.
- Existing helper builds all 12 months from the user's current year and carries balances through December, so August-December can display values when today is in July.
- Root cause: account and stock balance queries used December month-end as the cutoff, while category/dividend queries used `YYYY-12-31`; the page also rendered future monthly totals/net worth as zero instead of blank.
- Decision: derive `visibleThroughMonthIndex` from the user's timezone-local today, use that cutoff in aggregation, blank future month totals in the table, and calculate change-based totals through the current month instead of December.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Locate existing implementation / patterns.
- [x] Design minimal approach + key decisions.
- [x] Implement smallest safe slice.
- [x] Add/adjust tests.
- [x] Run verification (targeted regression plus type/build where practical).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Added `lib/fullMoonInfoBoardCutoff.ts` for current-month cutoff helpers.
- Updated `lib/fullMoonInfoBoard.ts` so account balances, stock values, income/expense rows, and dividends only aggregate through the user's current month.
- Updated `/finance/info-board` to leave future month section totals, net worth, and monthly growth cells blank, while Total/% for change-based rows use the latest visible month.
- Added `tests/lib/fullMoonInfoBoard.test.ts` and wired `npm run test:info-board` into `npm test`.
- Verification:
  - `npm run test:info-board` passed.
  - `npx tsc -p tsconfig.codex-info-board.json --noEmit --pretty false` passed with a temporary scoped config; the config was removed after verification.
  - `npm test` passed `test:tz`, `test:photo-crypto`, `test:info-board`, and `check:iso`, then failed at existing stale i18n generated outputs.
  - `npm run build` timed out after 4 minutes in this environment.
  - Full `npx tsc --noEmit --pretty false` remains blocked by existing E2E `@playwright/test` type setup.
