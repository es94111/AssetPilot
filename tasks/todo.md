# 2026-07-29 openai-plugin-mcp-descriptors

## Goal + Acceptance Criteria
- [x] Every MCP tool advertises a user-facing title, read-only behavior annotations, the `mcp:read` OAuth requirement, and matching legacy `_meta.securitySchemes`.
- [x] Raw `tools/list` responses include the OpenAI top-level `securitySchemes` extension even though the current MCP SDK only exposes the `_meta` field.
- [x] The existing whole-resource OAuth flow continues to fail closed with RFC-compliant HTTP `401` Bearer challenges and never exposes financial tool results before authentication.
- [x] OAuth protected-resource and authorization-server metadata point to a public MCP service document and continue to support CIMD first, DCR fallback, PKCE S256, and public clients using token authentication method `none`.
- [x] Automated tests prove descriptor parity, least-privilege annotations, raw transport compatibility, and metadata/documentation consistency.

## Risk & Rollback
- Risk level: high because the descriptor metadata controls when an external AI client requests authorization to private financial data.
- Affected components: MCP tool discovery responses, Streamable HTTP transport wrapping, OAuth discovery documentation, and the public MCP help page.
- Rollback strategy: remove the additive descriptor transport wrapper and metadata helpers; the existing HTTP Bearer challenge and PAT/OAuth authentication remain unchanged.
- Monitoring signals: tools missing the OAuth badge/link flow, `tools/list` serialization failures, requests that bypass HTTP authentication, or a scope other than `mcp:read`.

## Dependencies & Environment
- OpenAI plugin authentication and tool-descriptor references current on 2026-07-29, plus MCP Authorization specification revision 2025-11-25.
- Existing `@modelcontextprotocol/sdk` 1.30.0 and Zod only; no new package planned.
- The SDK currently supports `_meta.securitySchemes` but not OpenAI's top-level descriptor extension, so compatibility must be injected at the transport boundary without changing MCP request handling.

## Working Notes
- AssetPilot protects the entire MCP resource, so authentication discovery begins with HTTP `401` and `WWW-Authenticate`; tool-level metadata reinforces authorization requirements after linking.
- OpenAI's `_meta["mcp/www_authenticate"]` result is reserved for per-tool linking or scope step-up after an MCP connection exists. It is not used here because every request is authenticated before JSON-RPC handling.
- Tool results remain text content for backward compatibility. `outputSchema` is only required when returning `structuredContent`, which these tools do not currently return.
- All existing tools are read-only, closed-world queries scoped to the authenticated AssetPilot user.

## Plan
- [x] Compare the three official specifications against the current OAuth and MCP implementation.
- [x] Add reusable read-only OAuth descriptor metadata to every tool.
- [x] Add a narrow transport compatibility layer for top-level `securitySchemes`.
- [x] Add a public MCP service document and update OAuth metadata links.
- [x] Add targeted regression tests and run typecheck, tests, build, and diff checks.
- [x] Complete independent correctness/security review and record results.

## Results
- Added title, `mcp:read` OAuth schemes, matching `_meta` mirror, read-only annotations, and concise invocation states to all 11 AssetPilot tools.
- Added a transport decorator that restores OpenAI's top-level `securitySchemes` on raw `tools/list` responses without weakening the connection-wide HTTP authentication boundary or adding dependencies.
- Added a public `/mcp` service document and pointed protected-resource and authorization-server metadata to it; invalid-token challenges now include a safe `error_description`.
- Verification passed: descriptor test 1/1, OAuth test 12/12 (PostgreSQL lifecycle case conditionally skipped without a DB URL), full `npm test`, TypeScript typecheck, raw WebStandard Streamable HTTP probe, `git diff --check`, and isolated production build.
- Two independent reviews found no P0 security issue; the security review found no remaining P1/P2. A separate interoperability reviewer confirmed the raw wire fields and noted only optional future structured output/per-tool step-up enhancements.

# 2026-07-29 mcp-oauth-login

## Goal + Acceptance Criteria
- [x] MCP HTTP clients can discover AssetPilot's protected-resource and OAuth authorization-server metadata without prior configuration.
- [x] An unauthenticated MCP request returns `401` with a standards-compliant Bearer challenge containing `resource_metadata` and the least-privilege `mcp:read` scope.
- [x] MCP clients can register through RFC 7591 Dynamic Client Registration, then complete Authorization Code + PKCE (`S256`) using the user's existing AssetPilot login session and explicit consent.
- [x] Authorization and token requests require the exact canonical `/api/mcp` `resource`; access tokens are audience-bound, short-lived, opaque, hashed at rest, and accepted only for the owning active user.
- [x] Refresh tokens rotate on every use, replay revokes the token family, and authorization codes are short-lived, single-use, client/redirect/resource-bound, and never logged.
- [x] Existing manually-created MCP PATs remain backward compatible and can still be revoked from Settings.
- [x] Redirect URI, scope, client authentication, PKCE, expired/reused code, refresh replay, wrong audience, and revoked/deleted-user failure paths are covered by deterministic tests.

## Risk & Rollback
- Risk level: high; this introduces an authorization server and grants access to private financial data.
- Affected components: MCP HTTP authentication, OAuth discovery/registration/authorization/token/revocation routes, login return flow, database credential lifecycle, middleware public-path and rate-limit rules, MCP settings/help copy.
- Rollback strategy: revert the additive OAuth routes/tables and restore PAT-only MCP authentication; existing PAT rows and financial records are unchanged.
- Rollout plan: preserve PAT fallback, fail closed on any OAuth validation mismatch, and expose only the existing read-only MCP tools.
- Monitoring signals: repeated invalid grants, refresh-token replay, redirect/resource mismatch, unexpected 401/403 rates, or tokens accepted for the wrong client/user/resource.

## Dependencies & Environment
- MCP authorization baseline: 2025-11-25 specification, OAuth 2.1 draft, RFC 8414, RFC 7591, RFC 8707, and RFC 9728.
- Existing Next.js route handlers, PostgreSQL compatibility migrations, `@modelcontextprotocol/sdk`, Node `>=24 <25`, and existing AssetPilot cookie login only; no new dependency planned.
- Production authorization endpoints require HTTPS. Local development permits HTTP only on loopback origins.

## Working Notes
- `/api/mcp` now accepts audience-bound OAuth access tokens or existing `ap_mcp_*` PATs. PAT-only production deployments still return normal 401 responses when `APP_URL` has not yet been configured.
- Client registration supports public-client RFC 7591 DCR and Client ID Metadata Documents. CIMD retrieval is authenticated-first, HTTPS-only, DNS-pinned to public IPs, timeout/size/capacity bounded, single-flight, and non-redirecting.
- Scope is a single least-privilege `mcp:read` permission because every registered MCP tool is read-only.
- Streamable HTTP browser origins are exact-allowlisted through the canonical app origin plus `ALLOWED_ORIGINS`; native clients without `Origin` remain supported.

## Plan
- [x] Confirm existing MCP/login/database invariants and capture the PAT-only baseline.
- [x] Add persistent OAuth client, authorization-code, and rotating token-family primitives with pure validation helpers.
- [x] Add protected-resource/authorization-server metadata, DCR, authorize/consent, token, and revocation endpoints.
- [x] Bind `/api/mcp` bearer validation to PAT or audience-bound OAuth access token and emit RFC-compliant challenges.
- [x] Preserve the authorization return path across all existing login methods and update user-facing MCP guidance.
- [x] Add regression/security tests and run targeted tests, typecheck, i18n parity, full tests, build, and diff hygiene.
- [x] Complete independent correctness/security review and record results.

## Results
- Added MCP 2025-11-25 OAuth discovery, public-client CIMD/DCR registration, explicit consent, Authorization Code + PKCE S256, token/refresh/revocation endpoints, and the existing-login return flow.
- Added opaque hashed credentials, five-minute single-use codes, one-hour audience-bound access tokens, 30-day rotating refresh tokens with family replay revocation, user-active checks, record cleanup, registration quotas, and strict redirect/scope/resource validation.
- Preserved PAT compatibility, added standards-compliant Bearer challenges, exact Streamable HTTP Origin validation/CORS, Settings connection guidance, production `APP_URL` documentation, and all shared/mobile translations.
- Independent interoperability and security reviews found no remaining P0/P1 after fixes for Origin validation, PAT-only deployments, anonymous CIMD egress, bounded registration/metadata storage, loopback redirects, repeated token parameters, and discovery preflight.
- Verification passed: `npm run test:mcp-oauth` (12/12; PostgreSQL lifecycle case present but skipped without a local DB URL), `npm run typecheck`, full `npm test`, 10-locale parity with 1,257 keys, `git diff --check`, and an isolated production `npm run build`.

# 2026-07-18 phase-4-proactive-cashflow-action-loop

## Goal + Acceptance Criteria
- [x] Dashboard shows a deterministic next-30-day scheduled cash outlook based only on active, valid recurring entries linked to included bank accounts.
- [x] Forecast totals include every occurrence in the window, handle daily/weekly/monthly/yearly schedules, month-end clamping, leap years, overdue schedules, and stable ordering.
- [x] Users can see starting bank balance, scheduled income/expense, projected closing balance, lowest projected balance/date, price/data coverage, and an explicit calculation explanation.
- [x] Low-balance/shortfall and incomplete-schedule conditions become actionable items with direct links; no transaction, transfer, or notification is executed automatically.
- [x] A responsive savings scenario tool lets users adjust a monthly change and horizon, shows the deterministic difference, and clearly labels it as a simple scenario rather than a prediction or investment return.
- [x] Cash outlook and scenario are optional Dashboard modules and participate in the existing server-rendered personalization order/visibility contract.
- [x] Empty, partial, mixed-account, large-number, mobile 320px, keyboard, RTL, and screen-reader states remain understandable and non-alarming.
- [x] Verification covers pure schedule/forecast calculations, TypeScript, full tests, 10-locale parity, diff hygiene, production build, and independent review.

## Risk & Rollback
- Risk level: medium; projected financial values can influence user decisions even though this slice does not mutate financial records.
- Affected components: pure recurring schedule/forecast helpers, additive Dashboard response, Dashboard module registry/page, one client scenario component, shared translations/tests.
- Rollback strategy: remove the two additive modules/response fields and restore the previous module allowlist; no transaction or account data is migrated or rewritten.
- Monitoring signals: duplicate/skipped occurrences, overdue infinite loops, accountless/card recurring entries incorrectly changing bank cash, false shortfall alarms, or scenario copy being mistaken for guaranteed returns.

## Dependencies & Environment
- Existing Next.js/React/Tailwind/Base UI/Lucide/Decimal stack only; no new dependency planned.
- `recurring.amount` is stored as canonical TWD. Bank starting balances use the current exchange-rate conversion already used by Dashboard; this is a present-value planning view, not historical FX performance.
- Only recurring entries linked to included bank accounts can change projected bank cash. Excluded, missing-account, non-bank, inactive, or `needs_attention` entries are reported as uncovered rather than silently included.
- The scenario tool uses user-entered monthly adjustment × horizon with no interest or market-return assumption.

## Working Notes
- Phase four is implemented as one complete loop: observe upcoming scheduled cash → flag a possible gap → explain covered/uncovered data → link to the relevant recurring/account action → simulate a user-controlled monthly adjustment.
- Forecast window is user-timezone date-only, starting tomorrow and ending 30 days after today. Today/due history remains the recurring processor’s responsibility and is not counted twice.
- Historical index/TWR, news explanations, cohort comparisons, and automatic transfers remain outside this slice until daily snapshots and trustworthy historical series exist.

## Plan
- [x] Confirm recurring/account/budget data invariants and official comparable-product patterns.
- [x] Extract pure recurrence-date logic and add forecast helpers/tests.
- [x] Extend Dashboard data contract with scheduled cash outlook and coverage.
- [x] Add personalized cash-outlook/action UI and savings scenario interaction.
- [x] Add translations and accessibility/responsive safeguards.
- [x] Run full verification and independent correctness/UX review.

## Results
- Added a server-rendered 30-day scheduled-cash module with today's forecast starting balance, income/expense totals, closing cash, lowest point, first combined-cash shortfall, upcoming occurrences, explicit coverage, and direct recurring/account actions.
- Preserved the existing Dashboard bank-balance contract while independently excluding future manual transactions from the forecast starting point. Foreign-currency schedules are valued consistently through the linked account using current rates; invalid rates, impossible dates, stale references, attention-needed rows, and non-bank/accountless schedules are uncovered instead of silently counted.
- Added a deterministic 6/12/24-month savings-adjustment scenario with keyboard controls, concise screen-reader updates, honest cumulative-difference wording, and no interest/return/inflation/tax assumption.
- Added both modules to Dashboard personalization, fixed the default two-column information order, generated all shared/mobile translations, and documented that the cash estimate combines accounts and cannot detect a single-account overdraft.
- Independent correctness/security and UX/accessibility reviews found no remaining P1. Their findings were addressed: existing balance compatibility, FX-basis consistency, strict calendar validation, negative-start CTA routing, actionable coverage, responsive ordering, scenario wording, and live-region verbosity.
- Verification passed: `npm run typecheck`, `npm test` (including 7 scheduled-cash tests), 10-locale parity with 1,217 keys, `git diff --check`, and a clean production `npm run build` outside the Windows sandbox. Existing Cache-Control and middleware-deprecation warnings remain unchanged.

# 2026-07-18 phase-3-personalized-decision-dashboard

## Goal + Acceptance Criteria
- [x] Users can open Dashboard personalization, reorder the decision modules, hide optional modules, save once, and see the same layout after refresh.
- [x] Preferences are isolated by authenticated `user_id`, validated against a fixed module allowlist, and saved with atomic optimistic concurrency semantics.
- [x] Dashboard explains selected-period change against the correct comparison window: current month-to-date vs prior month-to-date, historical full month vs prior full month.
- [x] “Why changed” shows deterministic Top 3 net-change contributors with direction, amount, type, and links to the matching transaction period.
- [x] Investment decision support compares current held-market value against remaining FIFO cost basis, shows estimated P/L and concentration, and clearly states that it is not a market-index/TWR benchmark.
- [x] Missing historical market data, missing prices, zero cost, mixed currencies, missing baselines, and empty periods use explicit unavailable/insufficient-data states rather than fabricated percentages.
- [x] Existing phase-one/two totals, transaction filters, mobile layouts, APIs, and user data remain backward compatible through additive response/schema fields.
- [x] Verification covers pure period/driver calculations, preference validation, i18n parity, TypeScript, full tests, diff hygiene, and production build.

## Risk & Rollback
- Risk level: medium; this adds an authenticated preference contract and more financial interpretation to the Dashboard.
- Affected components: additive `user_settings.dashboard_layout`, Dashboard API/types/page, one client personalization dialog, shared translations/tests.
- Rollback strategy: revert the additive preference route/column and decision-support response/UI; the existing Dashboard fields and financial records are not rewritten.
- Monitoring signals: comparison windows crossing month/year incorrectly, category deltas with reversed signs, preference conflicts, hidden mandatory overview, or cost-basis copy being mistaken for index performance.

## Dependencies & Environment
- Existing Next.js/React/Base UI/Lucide stack only; no new package planned.
- Current schema has current stock prices, transactions, dividends, and FIFO lots but no historical price/index series. Market benchmark and TWR must remain explicitly unavailable in this slice.
- User settings are already included in export/import/deletion; an additive column remains inside that existing lifecycle.

## Working Notes
- Personalization module allowlist: `assets`, `attention`, `whyChanged`, `spending`, `portfolioHealth`, `incomeRecent`; cash-flow hero remains mandatory and cannot be hidden.
- “Why changed” operates on income/expense transaction cash flow, not total net-worth history, because the repository has no account/portfolio snapshots.
- Investment comparison is a current cost-basis health view, not time-weighted performance and not an index benchmark.
- For current month, prior comparison end-day is clamped to the prior month’s last day. Future selected months return an unavailable comparison rather than extrapolation.

## Plan
- [x] Confirm data availability, UX boundary, and official comparable-product patterns.
- [x] Add pure comparison/preference helpers and regression tests.
- [x] Add dashboard preference persistence and authenticated API.
- [x] Extend Dashboard API with comparison and cost-basis portfolio insight.
- [x] Add personalization and decision-support UI with empty/error states.
- [x] Generate translations and run full verification.
- [x] Complete independent correctness/UX review and record results.

## Results
- Added server-rendered Dashboard module ordering/visibility with a keyboard-operable customizer, fixed module allowlist, an independent `dashboard_layout_updated_at` version, and atomic compare-and-swap persistence.
- Replaced the previous amount-only driver ranking with comparable-period cash-flow explanations. Current month uses aligned month-to-date windows; historical months use complete months; future months and missing baselines are unavailable.
- Added a current cost-basis portfolio health view using the existing Decimal FIFO calculation, with mixed-currency, missing-price, price-coverage, empty-holding, zero-cost, and concentration safeguards. Copy explicitly distinguishes this from index/TWR performance.
- Independent correctness/security and UX/accessibility reviews found no P0. Their P1 findings were addressed: atomic isolated preference locking, missing-baseline handling, tenant-scoped category joins, consistent driver semantics, mobile action order/saving lock, localized strings, and large-number wrapping.
- Verification passed: `npm run typecheck`, `npm test` (including 9 Dashboard insight/preference tests), `npm run check:i18n` across 10 locales, `git diff --check`, and a clean production `npm run build` outside the Windows sandbox. The build retains existing Next.js Cache-Control and middleware deprecation warnings.

# 2026-07-18 production-browser-screenshot-verification

## Goal + Acceptance Criteria
- [x] Authenticate to `https://asset.shao.one` with the user-provided test account without persisting credentials.
- [x] Capture desktop Dashboard and transactions screenshots at 1440px width.
- [ ] Capture mobile Dashboard, transactions list/filter, and add form screenshots at 375px and inspect the 320px edge case. Dashboard/list/add/320px were captured; the phase-two filter panel is absent from the deployment and cannot be captured.
- [ ] Verify the deployed DOM contains the phase-two attention/drivers, mobile cards, filters, and quick-add hierarchy before judging responsive behavior. The deployed DOM does not contain these features.
- [x] Record console/runtime errors, observed deployment differences, and reproducible UI issues without changing production data.

## Risk & Rollback
- Risk level: low; read-only production UI verification after login.
- No transaction will be saved, edited, or deleted. Add dialogs and filters may be opened, but any form remains unsubmitted.
- Screenshots are stored only in the current Codex visualization workspace and may contain the supplied test account's visible UI.

## Plan
- [x] Complete authentication and confirm the authenticated Dashboard route.
- [x] Capture and inspect desktop Dashboard/transactions.
- [x] Capture and inspect 375px mobile Dashboard/transactions/add form; confirm the expected phase-two filter is not deployed.
- [x] Inspect 320px overflow, touch-target, sticky-action, and console-error signals.
- [x] Summarize deployment parity, screenshots, and any blocking issues.

## Results
- Authentication succeeded after the user completed Cloudflare Turnstile. Credentials were used only in the browser login form and were not written to project or screenshot-report files.
- Desktop at 1440px: Dashboard and transactions had no document-level horizontal overflow. The deployed Dashboard headings are limited to the phase-one cash-flow/category/ratio/recent sections; attention, queried-at status, and Top 3 drivers are absent.
- Mobile at 375px: Dashboard has no horizontal overflow and its fixed four-item bottom navigation remains visible. Transactions also fit the viewport, but still use the legacy always-expanded filter block and inline Add button.
- Mobile at 320px: transactions reported `scrollWidth === clientWidth` (305px after scrollbar), so there is no page-level horizontal overflow in the zero-data state. This does not validate transaction cards because the deployed page has no phase-two mobile cards.
- The deployed add dialog remains the legacy form order (date → type → amount → category → account), occupies 780px of an 812px viewport, and has no sticky footer; Save/Cancel are below the initial viewport. No form was submitted and no production data was mutated.
- Browser console had no application errors. The only messages were repeated Cloudflare Turnstile locale warnings (`zh-TW` falling back to `zh-tw`).
- Conclusion: production screenshot verification successfully identifies a deployment-parity blocker. Deploy the current workspace/commit before repeating acceptance of phase-two Dashboard insights, mobile filters/cards, sticky batch actions, and quick-add hierarchy.

# 2026-07-18 phase-2-actionable-dashboard-mobile-transactions

## Goal + Acceptance Criteria
- [x] Dashboard clearly shows when its data was queried, without presenting record or stock metadata as a market-price refresh time.
- [x] Dashboard shows at most three actionable items with direct destinations and a clear all-good state when nothing needs attention.
- [x] Dashboard explains the selected month with an explicitly labelled Top 3 driver list derived from existing income/expense category totals.
- [x] Transactions use a mobile card list below the desktop breakpoint, retain every status/action from the table, and avoid horizontal page scrolling at 320px.
- [x] Mobile filtering is collapsible, exposes an active-filter count, keeps URL deep links, and uses accessible labels and 44px controls.
- [x] Add/edit presents the common path first (type, amount, category, account), keeps advanced fields available, and preserves existing save/FX/photo behavior.
- [x] No schema, dependency, or financial-calculation contract changes; additive Dashboard response fields remain backward compatible.
- [x] Verification covers targeted helper tests, i18n parity, TypeScript, the full project test suite, diff hygiene, and production build.

## Risk & Rollback
- Risk level: medium; the Dashboard response is extended and the shared transactions screen is substantially reflowed on mobile.
- Affected components: Dashboard API/types/page and the transactions list/filter/create experience.
- Rollback strategy: revert this section's additive Dashboard insight fields and responsive transaction markup; no data migration or cleanup is required.
- Monitoring signals: Dashboard insight counts diverging from existing totals, lost transaction status/actions on mobile, URL filters failing to restore, clipped controls, or dialog save regressions.

## Dependencies & Environment
- Existing Next.js/React/Tailwind/Base UI/Lucide stack only; no new package is planned.
- Existing dirty `.swarm` files and `tsconfig.tsbuildinfo` are user/generated baseline and must not be reverted or included in the task result.
- Current Dashboard/category and transaction APIs remain the sources of truth; all queries remain scoped by authenticated `user_id`.

## Working Notes
- Official comparable-product patterns support search/filter/add at the transaction-list level, explicit edit controls, short attention queues, and Top 3 explanatory drivers.
- Stock `updated_at` is not a reliable quote timestamp. Only an actual held position with no positive current price may be surfaced as needing attention.
- The smallest safe first slice uses recurring attention, uncategorized current-period transactions, unpriced held stocks, and generated-at query time. Budget-overrun and period-over-period analysis remain follow-ups because their hierarchy and partial-period semantics require broader extraction/testing.
- Desktop table behavior and the current query-string contract stay intact; mobile cards are an alternate presentation of the same `txs` data.

## Plan
- [x] Audit Dashboard data sources, transaction interactions, responsive behavior, and accessibility risks.
- [x] Confirm phase-two scope and testable acceptance criteria from current official product patterns.
- [x] Implement additive Dashboard status, attention, and Top 3 drivers.
- [x] Implement mobile transaction cards, collapsible filtering, and quick-add form hierarchy.
- [x] Add targeted tests and translations.
- [x] Run typecheck, tests, i18n checks, diff checks, and production build.
- [x] Record results, verification evidence, and any deferred follow-ups.

## Results
- Dashboard response now adds query-time status, active recurring-attention count, current-period uncategorized count/amount, and held positions without a positive price; all queries remain scoped to the authenticated user.
- Dashboard presents a maximum-three attention queue with exact destinations, including a dedicated `__uncategorized__` transaction filter, plus an explicitly labelled Top 3 monthly amount-driver list and all-clear state.
- Transactions now render full-fidelity cards below `md` while preserving the desktop table, attachments, transfer/FX/recurring/excluded states, edit/delete, selection, pagination, and batch operations.
- Search is debounced without losing pending text during URL synchronization, stale responses cannot replace newer results, mobile filters expose active count, and selected rows get a reachable fixed batch action bar.
- Add/edit prioritizes type, amount, category, and account; date remains visible in the advanced summary, other fields/photos stay available, validation expands hidden invalid fields, and the footer remains sticky above the mobile safe area.
- Added four pure regression tests for Top 3 calculation and held-position valuation, including zero/negative price behavior. Added localized Dashboard insight copy for all ten supported locales and regenerated the expected Web/mobile dictionaries.
- Verification passed on Node 24.15.0: `npm run typecheck`, `npm test`, `npm run check:i18n`, `git diff --check`, and a clean `npm run build` (147/147 static pages, exit 0).
- Independent read-only UX and Dashboard correctness reviews found no P0 or cross-user data issue. Their P1 findings (pending-search overwrite, misleading mobile Apply semantics, and non-exact uncategorized CTA) were fixed before final verification.
- Runtime screenshot QA was not available because this environment has no running PostgreSQL service; 320px/RTL behavior was reviewed statically and by an independent UX diff review, not claimed as browser screenshot evidence.

# 2026-07-18 user-centered-ui-ux-refresh

## Goal + Acceptance Criteria
- [x] Research comparable personal-finance and portfolio products using current, attributable sources.
- [x] Translate the research into AssetPilot-specific information hierarchy and interaction rules.
- [x] Refresh the authenticated Web shell and dashboard as the first complete vertical slice without changing financial calculations or API contracts.
- [x] Preserve existing uncommitted UI/mobile work and avoid unrelated refactors.
- [x] Improve responsive behavior, keyboard/focus behavior, touch targets, empty states, and primary-action discoverability.
- [x] Verification covers TypeScript, targeted tests/build, and visual checks at desktop/mobile widths where feasible.

## Risk & Rollback
- Risk level: medium; shared shell and UI primitives affect all authenticated Web screens.
- Affected components: global design tokens, app navigation, dashboard presentation, shared form/dialog/toast primitives.
- Rollback strategy: revert only this task's additive shell/dashboard changes; no schema, API, or data changes are planned.
- Monitoring signals: clipped content, broken navigation, inaccessible controls, layout shifts, incorrect dashboard totals.

## Dependencies & Environment
- Existing Next.js 16 / React 19 / Tailwind CSS 4 stack; no new dependency planned.
- Existing worktree already contains UI accessibility and mobile formatting changes; treat them as user-owned baseline.
- Visual reference sources must be current as of 2026-07-18 and cited in the handoff.

## Working Notes
- Start with the authenticated Web shell and `/dashboard` because they establish the interaction model reused by finance and stock screens.
- Preserve the current financial aggregation behavior; this task changes hierarchy, layout, copy placement, and interaction affordances only.
- Existing app screenshots under `docs/screenshots/app` are mobile product captures, not proof of the current Web worktree.

## Plan
- [x] Audit current implementation, design tokens, routes, and nearby tests.
- [x] Research comparable products and extract reusable design logic.
- [x] Define the minimal user-centered redesign and success criteria.
- [x] Implement the shared shell/dashboard slice.
- [x] Verify typecheck, tests/build, responsive layout, and accessibility basics.
- [x] Summarize behavior changes, unchanged contracts, evidence, and follow-ups.

## Results
- Research compared Copilot Money, Sharesight, Kubera, Monarch Money, Empower, and Delta using current official product/help sources. The shared model is overview → explain → act, with one page-wide time scope and progressive disclosure.
- Reworked `/dashboard` around one monthly cash-flow hero, drill-down income/expense/account/portfolio cards, a visible quick-add transaction action, responsive recent-transaction cards, and complete category details.
- Added a four-destination mobile bottom navigation while preserving the full sidebar for lower-frequency destinations.
- Converted sidebar and stock tabs to semantic links; added `aria-current`, theme `aria-pressed`, a translated skip link, unique main/h1 landmarks, RTL drawer direction, focus entry/trap/restore, background inert state, and 44px month controls.
- Added `?action=add` handling so the Dashboard CTA opens the existing transaction dialog after metadata loads and then removes the one-shot action from the URL.
- Split dark-mode text accent from solid primary action color and raised light semantic text colors. Measured contrast against white: primary 5.82:1, income/success 5.48:1, expense/danger 6.29:1, net 6.70:1, muted 4.76:1.
- Preserved the pre-existing uncommitted shared-component and Flutter changes; no schema, API contract, dependency, or financial aggregation change was made.
- Verification passed: `npm run typecheck`, `npm test`, `npm run check:i18n`, `git diff --check`, and `npm run build` (147/147 static pages, exit 0).
- Runtime screenshot QA was attempted, but the local environment has no available PostgreSQL service; the dev server therefore stopped in the instrumentation hook before authenticated pages could render. No fake/mock screenshot was used as evidence.

# 2026-07-09 upgrade-project-packages-latest

## Goal + Acceptance Criteria
- [ ] Upgrade direct project npm dependencies/devDependencies/overrides to the latest registry versions available today.
- [ ] Preserve npm lockfile consistency and existing project scripts.
- [ ] Keep changes scoped to package metadata, lockfile, and compatibility fixes required by verification.
- [ ] Verification covers install/lock consistency plus targeted tests/typecheck/build where feasible.

## Risk & Rollback
- Risk level: medium because this can introduce framework/compiler/runtime behavior changes.
- Affected components: Next.js app build/runtime, TypeScript toolchain, test/tool scripts, transitive dependency tree.
- Rollback strategy: revert `package.json`, `package-lock.json`, and any compatibility edits from this task.
- Monitoring signals: npm resolution errors, typecheck/build/test failures, Next runtime warnings.

## Dependencies & Environment
- Package manager: npm with `package-lock.json`.
- Runtime constraint from `package.json`: Node `>=24.0.0 <25`.
- Registry source of truth: `npm outdated` / `npm install <pkg>@latest` against npm registry.

## Working Notes
- Existing user worktree changes are present under `mobile/test-lab/*`; do not touch or revert them.
- Prior TypeScript 7 upgrade required explicit `npm run typecheck` before `next build --webpack`; preserve that verification path.
- `npm outdated` initially reported only three outdated direct dependencies: `next` 16.2.9 -> 16.2.10, `resend` 6.16.0 -> 6.17.2, and `@types/node` 26.1.0 -> 26.1.1.
- Current PATH resolves `node` to v22.22.2, but the project requires Node `>=24 <25`; verification used the installed Scoop nvm Node v24.15.0 at `$env:NVM_SYMLINK`.
- An initial `npm install next@latest resend@latest @types/node@latest` timed out and left npm processes running; stopped those npm install processes before rerunning to avoid concurrent writes.
- `npm install` completed after cleanup, changed 105 packages, audited 142 packages, and reported 0 vulnerabilities.

## Plan
- [x] Restate goal + acceptance criteria.
- [x] Confirm direct dependency latest versions and package-manager behavior.
- [x] Update package metadata and lockfile minimally.
- [x] Run verification (install consistency, typecheck/build/tests).
- [x] Summarize changes + verification story.
- [x] Record lessons if any correction or mistake occurs.

## Results
- Upgraded direct npm dependencies to the latest registry versions reported on 2026-07-09:
  - `next` `^16.2.9` -> `^16.2.10`
  - `resend` `^6.16.0` -> `^6.17.2`
  - `@types/node` `^26.1.0` -> `^26.1.1`
- Updated `package-lock.json` for the new direct versions and Next SWC optional packages.
- Verification:
  - `npm outdated` passed with no output after the upgrade.
  - `npm ls next resend @types/node --depth=0` resolved `next@16.2.10`, `resend@6.17.2`, and `@types/node@26.1.1`.
  - Node 24 verification environment confirmed: `node v24.15.0`, `npm 11.12.1`.
  - `npm run typecheck` passed under Node 24.
  - `npm test` passed `test:tz`, `test:photo-crypto`, `test:info-board`, and `check:iso`; it still fails at the pre-existing stale i18n generated output check.
  - `npm run build` passed under Node 24 when run outside the sandbox with build-only `AUTH_SECRET` and `DATABASE_URL`; the sandboxed run compiled successfully but failed at page-data worker spawn with `EPERM`.
- Lessons: no user correction or new project behavior mistake to record.

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
# 2026-08-13 mcp-auth-security-dependency-maintenance

## Goal + Acceptance Criteria
- [x] MCP OAuth supports public `none` clients and DCR confidential `client_secret_basic` / `client_secret_post` clients without the reported interoperability failure; client secrets are only returned at registration and stored as hashes.
- [x] MCP authorization remains available after the initial consent; normal logout does not revoke MCP OAuth grants, and revoked/expired MCP authorization states show an actionable re-login/reconnect prompt.
- [x] Existing PAT compatibility, read-only MCP scope, audience binding, PKCE, token rotation, and user isolation remain intact.
- [x] Likely error paths are reproduced or statically verified, fixed with regression coverage, and the project passes the relevant test/type/build/security checks.
- [x] Dependencies are upgraded to the latest compatible versions available in the configured registry, with lockfile and audit results recorded.

## Risk & Rollback
- Risk level: high because this changes OAuth interoperability and protects private financial MCP data.
- Affected components: MCP OAuth metadata/registration/token validation, login return flow, MCP connection failure UX, package manifests/lockfile, and security checks.
- Rollback strategy: revert the focused source/test changes and package lockfile together; preserve existing database rows and PAT fallback. Do not revoke stored MCP grants as part of rollout.
- Monitoring signals: OAuth registration/authorize/token 4xx rates, repeated re-login prompts, invalid audience/scope attempts, refresh-token replay, and MCP 401/403 rates.

## Dependencies & Environment
- Runtime baseline: Node 24.16.0, npm 11.13.0, package engine `>=24.0.0 <25`.
- Existing MCP authorization baseline: public clients, `mcp:read`, Authorization Code + PKCE S256, audience-bound tokens, and PAT compatibility.
- Dependency upgrades must remain compatible with Next.js 16, React 19, TypeScript 7, and the repository's native Node test runner.

## Working Notes
- The original reported message came from a public-client-only normalizer. DCR accepts `none`, `client_secret_basic`, and `client_secret_post`; CIMD now additionally accepts confidential `private_key_jwt` with RS256/JWKS, while the UI documents both connection paths.
- DCR secrets are high-entropy, returned only in the registration response, hashed with SHA-256 in the database, and accepted through Basic or POST for client interoperability. PKCE and resource/audience validation remain mandatory.
- Next.js 16.3's deprecated `middleware.ts` convention was migrated to `proxy.ts`; the existing production static-cache policy remains intentionally configured and produces a non-fatal Next warning.
- The workspace contains an existing untracked `results.sarif`; preserve it and do not include it in this task unless explicitly requested.

## Plan
- [x] Capture baseline behavior for metadata/registration, unauthenticated MCP requests, login-return continuity, and current dependency/audit status.
- [x] Implement the smallest safe OAuth/UX fix and add regression tests for the reported failure and authorization-loss/re-login paths.
- [x] Run security and likely-error checks; fix findings that are in scope without weakening auth boundaries.
- [x] Upgrade compatible dependencies and verify lockfile, tests, typecheck, build, and diff hygiene.
- [x] Document results, verification evidence, and any environment-limited checks.

## Results
- OAuth metadata, DCR, and CIMD now advertise/support `none`, `client_secret_basic`, `client_secret_post`, and `private_key_jwt` where applicable; the old public-client-only error string is no longer emitted for the actual ChatGPT CIMD metadata.
- Added additive database columns for hashed DCR secrets, preserving existing clients and grants. Client secrets are never serialized from stored records.
- Token and revocation endpoints now validate Basic/POST client authentication, while public `none` flows remain compatible. MCP 401 responses include standard `invalid_token` details plus an explicit reauthorization action.
- OAuth consent errors now offer a login link preserving the safe `/oauth/authorize` return target. MCP help text explains re-login/reconnect recovery and that normal AssetPilot logout does not revoke MCP OAuth grants.
- Migrated `middleware.ts` to Next 16's `proxy.ts` convention and updated references. Upgraded compatible dependencies including Next 16.3.0, React 19.2.8, MCP-compatible supporting packages, and PostCSS override/typing packages; lockfile was regenerated.
- Verification evidence:
  - `npm run test:mcp-oauth`: 14/14 passed.
  - `npm run test:mcp-descriptors`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, including i18n generation/parity and ISO checks.
  - `npm run build`: passed; only the pre-existing intentional static Cache-Control warning remains.
  - `npm.cmd audit --audit-level=moderate`: 0 vulnerabilities.
  - `npm outdated --json`: `{}` (no outdated packages reported by the configured registry).
  - `git diff --check`: passed.
- Environment limitation: PostgreSQL-backed MCP auth/OAuth lifecycle tests remain skipped when `DATABASE_URL`/`POSTGRES_URL` are absent; run `npm test` with a disposable test database before deployment for full DB-path coverage.

# 2026-08-13 mcp-chatgpt-private-key-jwt

## Goal + Acceptance Criteria
- [x] ChatGPT CIMD metadata using `private_key_jwt` completes authorization-code token exchange without the unsupported-method error.
- [x] Only RS256 assertions signed by a key from the client-provided public JWKS are accepted; issuer, subject, audience, expiry, clock skew, key strength, and one-time `jti` replay checks are enforced.
- [x] Existing public `none`, DCR secret methods, PKCE, resource audience binding, PAT access, and grant-preserving logout behavior remain unchanged.
- [x] The exact ChatGPT metadata shape and a generated RS256 assertion have regression coverage.

## Risk & Rollback
- Risk level: high because this adds remote-key client authentication to the OAuth token and revocation endpoints.
- Affected components: CIMD normalization, JWKS retrieval/cache, private-key JWT verification/replay storage, OAuth token/revocation routes, discovery metadata, and MCP documentation.
- Rollback strategy: revert this focused source/test/migration change; do not delete existing OAuth client, authorization-code, or token rows.
- Security controls: HTTPS-only metadata/JWKS, public-DNS SSRF filtering, no redirects, bounded JSON/JWT size, RS256-only, minimum 2048-bit RSA keys, exact endpoint audience, and single-use assertion IDs.

## Working Notes
- Before deployment, production discovery advertises only `none`, `client_secret_basic`, and `client_secret_post`; the deployed ChatGPT metadata URL `https://chatgpt.com/oauth/fLSEW_QyqHY2/client.json` declares `private_key_jwt`, `jwks_uri: https://chatgpt.com/oauth/jwks.json`, and `RS256`. The source discovery response now includes `private_key_jwt`.
- The previous error occurred while validating the CIMD document, before user consent or token issuance; no authorization was revoked.
- Existing OAuth clients and grants are preserved; the new assertion replay table and JWKS columns are additive migrations.

## Plan
- [x] Fetch and record the exact production ChatGPT metadata and compare it with local validation.
- [x] Add private_key_jwt CIMD validation, RS256/JWKS verification, replay protection, and discovery support.
- [x] Add exact metadata and generated assertion regression tests.
- [x] Run targeted/full tests, typecheck, build, audit, and final diff checks.

## Results
- OAuth CIMD normalization accepts the exact ChatGPT metadata shape and persists its HTTPS JWKS URI and RS256 signing algorithm. DCR and public-client flows retain their existing secret/PKCE behavior.
- Token and revocation authentication now support `private_key_jwt` with bounded HTTPS JWKS retrieval, public-IP SSRF filtering, no redirects, RSA-2048 minimum keys, exact `iss`/`sub`/`aud`, bounded clock skew, and one-time `jti` replay protection.
- Discovery metadata advertises `private_key_jwt`; the MCP UI explains the supported authentication paths and re-login recovery. Logout does not revoke MCP grants.
- Verification evidence:
  - `npm run test:mcp-oauth`: 15/15 passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed.
  - `NEXT_VERIFY_DIST_DIR=build-verify npm run build`: passed; the normal `build` directory could not be replaced because Synology/Windows locked the existing reparse-point output, while the isolated production build completed all routes and 160 static pages.
  - `npm.cmd audit --audit-level=moderate`: 0 vulnerabilities.
  - `npm outdated --json`: `{}` (no outdated packages reported by the configured registry).
  - `git diff --check`: passed.
- Deployment note: the live discovery endpoint was observed before this source change and still advertises only the three legacy methods. Deploy/restart this revision before reconnecting ChatGPT; no existing authorization grants need to be revoked.
- Environment limitation: PostgreSQL-backed MCP auth/OAuth lifecycle tests remain skipped when `DATABASE_URL`/`POSTGRES_URL` are absent; run `npm test` with a disposable test database before deployment for full DB-path coverage.
