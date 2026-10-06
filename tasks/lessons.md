# Lessons

## 2026-10-06 Run `flutter pub get` in `mobile/` Before Regenerating Shared i18n
- Mistake class: environment-dependent verification assumption / missing prerequisite step.
- Failure mode: `npm run i18n:generate` was run without first executing `flutter pub get` inside `mobile/`. The Flutter SDK's `gen-l10n` then emitted an extra blank line after `import 'package:intl/intl.dart' as intl;` in all nine `app_localizations_<locale>.dart` files, even though the generated translations were correct. Local `npm run check:i18n` still passed because it compares the generator's *own* outputs, so the drift was invisible until CI's `git diff --exit-code` on the generated files failed.
- Detection signal: CI `i18n-parity` failed at the "Check generated output drift" step with a one-line diff (`-` blank line) in `mobile/lib/generated/l10n/app_localizations_{ar,en,es,fr,hi,ko,pt,ru,zh}.dart`, while a clean checkout of `main` regenerated identically with the same local Flutter 3.47.6 — proving the difference came from the local working tree state, not the toolchain version.
- Prevention rule: Treat `mobile/` Flutter prerequisites as part of the i18n generation phase — run `flutter pub get` in `mobile/` (matching the CI step order) before `npm run i18n:generate`, and after regenerating confirm with `git diff --exit-code` on the generated paths rather than trusting `check:i18n` alone.
- Tripwire: Whenever CI reports generated-output drift but the same files look correct locally, prove reproducibility by running the generator in a fresh checkout of the base branch before looking for a toolchain difference; and always run `git diff --exit-code -- lib/i18n mobile/lib/generated` locally after any i18n change.

## 2026-10-06 Keep Node-Only Modules Out of Client Bundles, and Prove It
- Mistake class: architectural hazard avoided by design / verification gap.
- Failure mode: The new `'use client'` settings page needed the authoritative scope and event lists that live in `lib/apiTokenCore.ts`, but that module imports `node:crypto` for token hashing and HMAC signing; importing it from a client component would pull Node built-ins into the browser bundle.
- Detection signal: The module's top-level import list showed `node:crypto`, and the build output only warns at bundle-analysis time, so the mistake usually surfaces as a runtime failure or a silent bundle-size regression rather than a typecheck error.
- Prevention rule: Duplicate tiny constant lists in a zero-dependency client module rather than importing server-only helpers, and add a test that asserts the duplicate exactly equals the server's authoritative list so the two cannot drift.
- Tripwire: Before importing any `lib/*` module into a `'use client'` file, inspect its top-level imports for `node:*`, `next/headers`, and database modules; when duplication is chosen, add a parity assertion in the same commit.

## 2026-10-06 i18n Generation Writes Files, So Do Not Stash Around It
- Mistake class: unsafe execution ordering / missing verification.
- Failure mode: To check whether Flutter's `untranslated message(s)` warnings were pre-existing, `git stash` was run, then `npm run i18n:generate` regenerated tracked output files, and the following `git stash pop` aborted because the newly regenerated files conflicted with the stash.
- Detection signal: `git stash pop` failed with "Your local changes ... would be overwritten by merge" listing the generated `mobile/lib/generated/l10n/*.dart` files.
- Prevention rule: Treat `npm run i18n:generate` as a write phase that dirties tracked files; to compare against a baseline, use `git stash` plus an explicit `git checkout -- .` before popping, or inspect the warning source directly instead of stashing.
- Tripwire: Never run a generator between `git stash` and `git stash pop`; verify with `git status` before popping.

## 2026-07-29 Verify Descriptor Serialization, Not Only Helper Types
- Mistake class: incorrect assumption about dependency behavior / missing verification.
- Failure mode: Assumed the official `registerAppTool` helper would preserve OpenAI's top-level `securitySchemes` because its documented config accepts the field, but the installed MCP SDK 1.30 `registerTool` implementation destructures only standard fields and silently drops the extension.
- Detection signal: Reading the installed helper and SDK runtime showed the helper delegates unchanged to `registerTool`, whose stored tool definition omits `securitySchemes`.
- Prevention rule: For protocol extensions, inspect or probe the final serialized `tools/list` response; type acceptance and wrapper documentation do not prove the field survives runtime serialization.
- Tripwire: Add a raw JSON-RPC descriptor test for every non-standard discovery field before adopting or upgrading MCP helper packages.

## 2026-07-29 Next Route Boundary Tests Need Explicit Node Resolver Support
- Mistake class: incorrect assumption about repository behavior / missing verification.
- Failure mode: Added direct Node tests for Next route handlers while assuming the package subpath `next/server` would resolve exactly as it does in the Next bundler; the Node ESM runner required the exported `next/server.js` entry. The first test also mutated the readonly-typed `NODE_ENV` property directly.
- Detection signal: `test:mcp-oauth` failed with `ERR_MODULE_NOT_FOUND` for `next/server`, then the production typecheck rejected direct assignment/deletion of `process.env.NODE_ENV`.
- Prevention rule: When a direct Node test imports framework route handlers, add the narrow package-subpath mapping to the test-only resolver and mutate test environment keys through an explicitly mutable `Record` view with guaranteed restoration.
- Tripwire: Run both the targeted Node test and the full project typecheck immediately after adding any route-handler integration test.

## 2026-07-29 Next Build Must Not Share a Live Dev Dist Directory on Windows
- Mistake class: environment-dependent verification assumption.
- Failure mode: Started a production build against the normal Next `build` directory while the user's development server had files open there, causing a Windows unlink failure.
- Detection signal: The build failed while unlinking `build/types/app`, and process inspection showed the existing dev server still using that directory.
- Prevention rule: Preserve the user's dev process and run verification builds in a task-specific isolated `distDir`; restore any temporary config immediately after verification.
- Tripwire: Before a Windows Next production build, check for an active dev server and select a verified workspace-contained isolated output directory when one is running.

## 2026-07-18 Decimal Sign Is Not a Strict Positive-Rate Check
- Mistake class: incorrect assumption about dependency behavior.
- Failure mode: Used `Decimal.isPositive()` to validate an exchange rate, but Decimal.js treats positive zero as positive, allowing division by zero and returning `Infinity`.
- Detection signal: The foreign-currency regression test expected an invalid zero rate to return `null` but received `Infinity`.
- Prevention rule: Financial divisors must be both finite and strictly greater than zero; sign predicates alone are insufficient.
- Tripwire: Every new rate/divisor helper needs explicit tests for zero, negative, `NaN`, and infinity-like inputs before API integration.

## 2026-07-18 Generated Sources Must Settle Before Consumers Run
- Mistake class: missing verification / unsafe execution ordering.
- Failure mode: Ran shared-i18n generation, TypeScript checking, and a targeted Node test concurrently; the generator writes files that the typechecker reads, so the combined tool call did not complete within its expected timeout.
- Detection signal: The parallel command produced no completion output for more than two minutes, while a subsequent generated-output check and sequential validation completed normally.
- Prevention rule: Run source generators to completion before starting checks that consume their outputs; only parallelize read-only validations after generated files are stable.
- Tripwire: Treat `generate`, codegen, schema generation, and formatting commands as write phases, then run `--check`, typecheck, tests, and build in a separate phase.

## 2026-07-18 Native Node TypeScript Tests Need Resolvable Relative Extensions
- Mistake class: incorrect assumption about repository behavior / missing verification.
- Failure mode: The new pure `dashboardForecast.ts` used an extensionless relative import that Next/TypeScript accepted, but the repository's direct `node file.test.ts` runner could not resolve it.
- Detection signal: `npm run test:dashboard-forecast` failed with `ERR_MODULE_NOT_FOUND` for `lib/recurringSchedule` even though `npm run typecheck` passed.
- Prevention rule: Pure TypeScript modules loaded directly by Node tests must use explicit `.ts` relative imports under this project's no-emit configuration, and targeted tests must run before UI/API integration.
- Tripwire: For every new direct-Node test module, recursively inspect its pure-module import chain for extensionless relative imports and run the targeted test independently rather than relying on a semicolon-chained command's final exit code.

## 2026-07-18 Pure Test Modules Must Not Import Runtime Alias Dependencies
- Mistake class: incorrect assumption about repository behavior / missing verification.
- Failure mode: The first Dashboard insight test imported `dashboardHelpers.ts`, which also imports `@/lib/*` runtime modules; plain Node could not resolve that application alias even though the insight function itself was pure.
- Detection signal: `npm run test:dashboard-insights` failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib' imported from lib/dashboardHelpers.ts`.
- Prevention rule: Place no-dependency domain calculations in a dedicated pure module and have runtime helpers import them, so the existing plain-Node test runner never loads authentication, logging, or framework aliases.
- Tripwire: Before adding a plain-Node test import, inspect the target module's top-level imports for `@/`, Next.js, database, auth, or browser-only dependencies; extract the pure logic first when any are present.

## 2026-07-18 UI Tokens and Progressive Disclosure Need Explicit Semantics
- Mistake class: accessibility oversight / unsafe change scope.
- Failure mode: A first-pass dark-mode accent token was also consumed as a white-text button background, producing insufficient contrast; category lists were truncated for progressive disclosure without labeling the view as partial.
- Detection signal: Independent diff review calculated the dark solid-action contrast at roughly 2.4:1 and found `slice(...)` calls while the visible totals still represented all categories.
- Prevention rule: Separate text/link accent tokens from solid-action background tokens, calculate contrast for both themes, and never truncate financial detail unless the UI explicitly says “Top N” and exposes the remainder.
- Tripwire: Before final UI verification, search changed views for `slice(` and shared color tokens used by both `color` and `background`; run a WCAG contrast calculation for semantic text and solid actions in light/dark themes.

## 2026-07-09 TypeScript 7 Removed baseUrl
- Mistake class: incorrect assumption about compiler behavior / missing verification.
- Failure mode: Added `compilerOptions.baseUrl` as a likely Next/Webpack alias fix, but TypeScript 7 rejects `baseUrl` with TS5102 because the option has been removed.
- Detection signal: `npm run typecheck` failed immediately with `Option 'baseUrl' has been removed`.
- Prevention rule: Before adding legacy tsconfig options during a compiler major upgrade, verify the option against the target compiler by running the project typecheck, and prefer tool-specific resolver config when the issue is a bundler integration gap.
- Tripwire: After any `tsconfig*.json` edit during TypeScript upgrades, run `npm run typecheck` before continuing to build fixes.

## 2026-07-07 Ambiguous Chinese Bug Report Polarity
- Mistake class: misunderstanding requirements.
- Failure mode: Initially interpreted "現在7月，7月之後的月份是有資料的，修復錯誤" as future months should keep showing data, when the actual bug was that months after July were incorrectly showing data.
- Detection signal: Re-reading the phrasing against the observed implementation showed account/stock balances were carried forward into August-December even though today is in July.
- Prevention rule: For terse bug reports that state an observed behavior followed by "修復錯誤", treat the stated behavior as the likely bug unless the user explicitly says it is expected.
- Tripwire: Before editing, write the expected/actual pair in `tasks/todo.md` and check it against the implementation symptom.

## 2026-07-06 Unicode i18n Writes
- Mistake class: missing verification / incorrect assumption about shell encoding.
- Failure mode: Writing non-ASCII i18n values through a PowerShell piped Python script mangled strings into `???` in ARB/generated files.
- Detection signal: `git diff` showed `navInfoBoard: "???"` in `shared/i18n/app_zh_Hant_TW.arb` and generated dictionaries.
- Prevention rule: When mechanically writing localized JSON from PowerShell, keep the script source ASCII-only with `\uXXXX` escapes or use a verified UTF-8 file/script path, then inspect representative non-ASCII values with a UTF-8 reader before regenerating outputs.
- Tripwire: After i18n generation, run `node tools/generate-shared-i18n.mjs --check`, `node tools/check-i18n-parity.ts`, and inspect at least zh-TW/en generated values for the new key.

## 2026-07-07 Optional Test Dependency Assumption
- Mistake class: incorrect assumption about repo behavior / missing verification.
- Failure mode: Tried to run a quick `sql.js` schema sanity check because existing migration tests reference `sql.js`, but the dependency is not installed in the current workspace and the command failed with `MODULE_NOT_FOUND`.
- Detection signal: Node reported `Cannot find module 'sql.js'` for the inline sanity check.
- Prevention rule: Before using an optional test helper or dependency that is not listed in `package.json`, verify it exists in the current workspace or choose a no-dependency check.
- Tripwire: Run `npm ls <package> --depth=0` or check `node_modules/<package>` before writing one-off validation that depends on it.

## 2026-08-13 Security Test Fixtures Must Match Production Entropy Constraints
- Mistake class: missing verification.
- Failure mode: A DCR response regression fixture used a short placeholder client secret and failed the test's production-length assertion.
- Detection signal: The targeted MCP OAuth test failed before exercising serialization because the fixture was shorter than the minimum expected secret length.
- Prevention rule: Security-sensitive fixtures must satisfy the same minimum length and shape constraints as generated production values.
- Tripwire: Assert fixture entropy/length at test setup and use a clearly long, non-secret placeholder value.

## 2026-08-13 OAuth Client Metadata Must Be Verified Against the Actual Provider
- Mistake class: incorrect assumption about protocol interoperability.
- Failure mode: The first MCP OAuth fix covered public and shared-secret methods but assumed ChatGPT would use one of them; ChatGPT's live CIMD instead declared `private_key_jwt` with an RS256 JWKS.
- Detection signal: A read-only fetch of the exact `client_id` metadata reproduced the production error and showed `token_endpoint_auth_method: private_key_jwt`.
- Prevention rule: Before finalizing OAuth client-method support, fetch a representative provider metadata document and verify every advertised method against the authorization-server metadata and token endpoint implementation.
- Tripwire: Keep a regression fixture for each provider-specific method, including signed assertion claims, key rotation, and replay behavior.
