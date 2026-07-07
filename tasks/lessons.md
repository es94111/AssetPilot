# Lessons

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
