#!/usr/bin/env node
// tools/check-i18n-parity.ts — i18n 字典正確性把關（CI gate）
//
// 兩道檢查，補住手寫 i18n 最容易漂移的兩個破口：
//
//  A. 字典鍵對齊：以 zh-TW 為來源真實值，比對其餘 9 本字典。
//     - 缺鍵（missing）：來源有、該語言沒有 → 執行期會默默回退英/中，
//       使用者看到夾雜畫面。這是「漏補翻譯」。
//     - 多鍵（stale）：該語言有、來源已無 → 死鍵 / 改名殘留 / typo。
//
//  B. 靜態鍵驗證：掃 app/ components/ lib/ 內的 t('字面值')，
//     驗證每個鍵都存在於 zh-TW。抓呼叫端打錯字（型別層因為要相容
//     動態鍵 t(`a.${x}`) 無法強制，故在此補上）。模板字串自動略過。
//
// 執行：node tools/check-i18n-parity.ts
// npm 入口：npm run check:i18n
//
// 旗標：
//   --warn-missing   缺鍵僅警告、不讓 CI 失敗（漸進翻譯期可用）。

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DICT_DIR = path.join(ROOT, 'lib', 'i18n', 'dictionaries');
const SOURCE_LOCALE = 'zh-TW';
const LOCALES = ['zh-TW', 'zh-CN', 'en', 'es', 'ar', 'fr', 'hi', 'pt-BR', 'ru', 'ko'];

// 掃描原始碼的根目錄（相對 ROOT）
const SCAN_DIRS = ['app', 'components', 'lib'];
const SCAN_EXT = new Set(['.ts', '.tsx']);
const SCAN_SKIP = new Set(['node_modules', '.next', '.git', '.claude', 'dictionaries']);

const warnMissingOnly = process.argv.includes('--warn-missing');

// ── 載入字典 ────────────────────────────────────────────────
/** require 該語言檔，取出唯一匯出的物件（型別匯出在執行期已抹除）。 */
function loadDict(locale: string): Record<string, unknown> {
  const mod = require(path.join(DICT_DIR, `${locale}.ts`));
  const obj = Object.values(mod).find(
    (v) => v && typeof v === 'object' && !Array.isArray(v)
  );
  if (!obj) throw new Error(`字典 ${locale} 找不到匯出的物件`);
  return obj as Record<string, unknown>;
}

/** 攤平成 leaf dot-path 集合（物件遞迴，string/其它為終點）。 */
function flatten(obj: Record<string, unknown>, prefix = '', out = new Set<string>()): Set<string> {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, p, out);
    } else {
      out.add(p);
    }
  }
  return out;
}

// ── A. 字典鍵對齊 ───────────────────────────────────────────
const sourceKeys = flatten(loadDict(SOURCE_LOCALE));
const topNamespaces = new Set([...sourceKeys].map((k) => k.split('.')[0]));

let hardFail = 0;
let softWarn = 0;

console.log(`=== i18n 字典對齊（來源：${SOURCE_LOCALE}，共 ${sourceKeys.size} 鍵）===\n`);

for (const locale of LOCALES) {
  if (locale === SOURCE_LOCALE) continue;
  const keys = flatten(loadDict(locale));

  const missing = [...sourceKeys].filter((k) => !keys.has(k));
  const stale = [...keys].filter((k) => !sourceKeys.has(k));

  if (missing.length === 0 && stale.length === 0) {
    console.log(`  ✓ ${locale.padEnd(6)} 完全對齊`);
    continue;
  }

  console.log(`  ✗ ${locale.padEnd(6)} 缺 ${missing.length} / 多 ${stale.length}`);
  for (const k of missing.slice(0, 15)) console.log(`      − 缺鍵 ${k}`);
  if (missing.length > 15) console.log(`      … 另有 ${missing.length - 15} 個缺鍵`);
  for (const k of stale.slice(0, 15)) console.log(`      + 多鍵 ${k}`);
  if (stale.length > 15) console.log(`      … 另有 ${stale.length - 15} 個多鍵`);

  if (stale.length > 0) hardFail += stale.length; // 死鍵一律失敗
  if (missing.length > 0) {
    if (warnMissingOnly) softWarn += missing.length;
    else hardFail += missing.length;
  }
}

// ── B. 靜態鍵驗證 ───────────────────────────────────────────
// 匹配 t('a.b.c') / t("a.b.c")；前綴 (?<![\w.]) 避開 format( 等。
// 只驗證「含 '.' 且首段是已知命名空間」者，降低誤判。
const T_CALL = /(?<![\w.])t\(\s*(['"])((?:[^'"\\]|\\.)*)\1/g;

function* walk(dir: string): Generator<string> {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SCAN_SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(full);
    else if (SCAN_EXT.has(path.extname(ent.name))) yield full;
  }
}

console.log(`\n=== 原始碼靜態 t('…') 鍵驗證 ===\n`);

const badKeys: Array<{ file: string; line: number; key: string }> = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    scanned++;
    const src = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    T_CALL.lastIndex = 0;
    while ((m = T_CALL.exec(src)) !== null) {
      const key = m[2];
      if (!key.includes('.')) continue; // 單段：多半非翻譯鍵
      if (!topNamespaces.has(key.split('.')[0])) continue; // 非已知命名空間
      if (sourceKeys.has(key)) continue; // 命中
      const line = src.slice(0, m.index).split('\n').length;
      badKeys.push({ file: path.relative(ROOT, file), line, key });
    }
  }
}

if (badKeys.length === 0) {
  console.log(`  ✓ 掃描 ${scanned} 個檔案，靜態鍵全部命中 zh-TW`);
} else {
  console.log(`  ✗ 掃描 ${scanned} 個檔案，發現 ${badKeys.length} 個未知靜態鍵：`);
  for (const b of badKeys) console.log(`      ${b.file}:${b.line}  t('${b.key}')`);
  hardFail += badKeys.length;
}

// ── 結果 ────────────────────────────────────────────────────
console.log('');
if (softWarn > 0) console.log(`⚠ 警告：${softWarn} 個缺鍵（--warn-missing 模式不計失敗）`);
if (hardFail > 0) {
  console.error(`結果：失敗（${hardFail} 個問題）`);
  process.exit(1);
}
console.log('結果：通過');
