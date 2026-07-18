# Lessons

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
