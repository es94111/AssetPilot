# Lessons

## 2026-07-06 Unicode i18n Writes
- Mistake class: missing verification / incorrect assumption about shell encoding.
- Failure mode: Writing non-ASCII i18n values through a PowerShell piped Python script mangled strings into `???` in ARB/generated files.
- Detection signal: `git diff` showed `navInfoBoard: "???"` in `shared/i18n/app_zh_Hant_TW.arb` and generated dictionaries.
- Prevention rule: When mechanically writing localized JSON from PowerShell, keep the script source ASCII-only with `\uXXXX` escapes or use a verified UTF-8 file/script path, then inspect representative non-ASCII values with a UTF-8 reader before regenerating outputs.
- Tripwire: After i18n generation, run `node tools/generate-shared-i18n.mjs --check`, `node tools/check-i18n-parity.ts`, and inspect at least zh-TW/en generated values for the new key.
