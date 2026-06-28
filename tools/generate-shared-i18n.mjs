#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = path.resolve(import.meta.dirname, '..');
const SHARED_DIR = path.join(ROOT, 'shared', 'i18n');
const LOCALES_PATH = path.join(SHARED_DIR, 'locales.json');
const WEB_DICT_DIR = path.join(ROOT, 'lib', 'i18n', 'dictionaries');
const WEB_GENERATED_DIR = path.join(ROOT, 'lib', 'i18n', 'generated');
const MOBILE_GENERATED_DIR = path.join(ROOT, 'mobile', 'lib', 'generated');
const MOBILE_FLUTTER_ARB_DIR = path.join(MOBILE_GENERATED_DIR, 'l10n', 'arb');
const ANDROID_LOCALE_CONFIG = path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res', 'xml', 'locale_config.xml');

const args = new Set(process.argv.slice(2));
const bootstrapFromWeb = args.has('--bootstrap-from-web');
const checkOnly = args.has('--check');

const registry = JSON.parse(fs.readFileSync(LOCALES_PATH, 'utf8'));
const locales = registry.locales;
const sourceLocale = registry.sourceLocale;
const sourceConfig = locales.find((locale) => locale.id === sourceLocale);

if (!sourceConfig) throw new Error(`Missing source locale config: ${sourceLocale}`);

function flatten(value, prefix = '', out = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.push([prefix, value]);
  }
  return out;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function setPath(target, dotPath, value) {
  const parts = dotPath.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Forbidden key in i18n path: ${dotPath}`);
    if (!Object.hasOwn(cursor, key)) cursor[key] = Object.create(null);
    cursor = cursor[key];
  }
  const lastKey = parts.at(-1);
  if (FORBIDDEN_KEYS.has(lastKey)) throw new Error(`Forbidden key in i18n path: ${dotPath}`);
  cursor[lastKey] = value;
}

function upperFirst(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function messageKeyForPath(dotPath) {
  return dotPath
    .split('.')
    .map((part, index) => {
      const cleaned = part.replace(/[^A-Za-z0-9_]/g, '_');
      return index === 0 ? cleaned : upperFirst(cleaned);
    })
    .join('');
}

function shortHash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
}

function wordsFrom(value) {
  return String(value)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function mobileLegacyKey(source, english, used) {
  const words = wordsFrom(english);
  let base = words.length > 0
    ? `mobileLegacy${words.slice(0, 8).map((word) => upperFirst(word.toLowerCase())).join('')}`
    : `mobileLegacyMessage${shortHash(source)}`;
  if (!/^[A-Za-z]/.test(base)) base = `mobileLegacyMessage${shortHash(source)}`;
  base = base.replace(/[^A-Za-z0-9_]/g, '');
  let key = base;
  if (used.has(key)) key = `${base}${shortHash(source)}`;
  used.add(key);
  return key;
}

function placeholderNames(value) {
  const names = new Set();
  for (const match of String(value).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
    names.add(match[1]);
  }
  return [...names];
}

function arbMetadata(webPath, value, description) {
  const metadata = {
    description: description ?? `Web path: ${webPath}`,
    'x-webPath': webPath,
  };
  const placeholders = placeholderNames(value);
  if (placeholders.length > 0) {
    metadata.placeholders = Object.fromEntries(placeholders.map((name) => [name, {}]));
  }
  return metadata;
}

function loadWebDictionary(locale) {
  const mod = require(path.join(WEB_DICT_DIR, `${locale.tsFile}.ts`));
  return mod[locale.tsExport];
}

function parseDartString(text, index) {
  const quote = text[index];
  if (quote !== "'" && quote !== '"') return null;
  let i = index + 1;
  let value = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === quote) return { value, end: i + 1 };
    if (ch === '\\') {
      const next = text[i + 1];
      if (next === 'n') value += '\n';
      else if (next === 'r') value += '\r';
      else if (next === 't') value += '\t';
      else value += next ?? '';
      i += 2;
      continue;
    }
    value += ch;
    i += 1;
  }
  return null;
}

function skipSpace(text, index) {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

function parseDartMap(source, mapName) {
  const start = source.indexOf(`const Map<String, String> ${mapName} = {`);
  if (start < 0) return new Map();
  const bodyStart = source.indexOf('{', start) + 1;
  const bodyEnd = source.indexOf('\n};', bodyStart);
  const body = source.slice(bodyStart, bodyEnd);
  const out = new Map();
  let i = 0;
  while (i < body.length) {
    i = skipSpace(body, i);
    if (i >= body.length) break;
    const key = parseDartString(body, i);
    if (!key) {
      i += 1;
      continue;
    }
    i = skipSpace(body, key.end);
    if (body[i] !== ':') {
      i += 1;
      continue;
    }
    i = skipSpace(body, i + 1);
    let value = '';
    let parsedAny = false;
    while (i < body.length) {
      i = skipSpace(body, i);
      const parsed = parseDartString(body, i);
      if (!parsed) break;
      value += parsed.value;
      parsedAny = true;
      i = parsed.end;
    }
    if (parsedAny) out.set(key.value, value);
    while (i < body.length && body[i] !== ',') i += 1;
    if (body[i] === ',') i += 1;
  }
  return out;
}

function parseDartMaps(source, mapNames) {
  const merged = new Map();
  for (const mapName of mapNames) {
    for (const [key, value] of parseDartMap(source, mapName)) merged.set(key, value);
  }
  return merged;
}

function mobileSourceFiles() {
  const screensDir = path.join(ROOT, 'mobile', 'lib', 'screens');
  const screens = fs.readdirSync(screensDir)
    .filter((name) => name.endsWith('.dart'))
    .map((name) => path.join(screensDir, name));
  return [
    path.join(ROOT, 'mobile', 'lib', 'api_client.dart'),
    path.join(ROOT, 'mobile', 'lib', 'app.dart'),
    path.join(ROOT, 'mobile', 'lib', 'google_auth.dart'),
    path.join(ROOT, 'mobile', 'lib', 'line_auth.dart'),
    path.join(ROOT, 'mobile', 'lib', 'models.dart'),
    path.join(ROOT, 'mobile', 'lib', 'passkey_auth.dart'),
    path.join(ROOT, 'mobile', 'lib', 'widgets.dart'),
    ...screens,
  ].filter((file) => fs.existsSync(file));
}

function parseMobileSourceStrings() {
  const keys = new Set();
  for (const file of mobileSourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/tr\('((?:\\'|[^'])+)'\)/g)) {
      keys.add(match[1].replace(/\\'/g, "'"));
    }
    for (const match of text.matchAll(/trPair\('((?:\\'|[^'])+)'\s*,/g)) {
      keys.add(match[1].replace(/\\'/g, "'"));
    }
  }
  return [...keys];
}

function isDynamicMobileTemplate(value) {
  return value.includes('$') || [
    /^\d+ 號$/,
    /^上次寄送 /,
    /^目前版本 v/,
    /^有新版本 v.+ 可更新$/,
    /^每月 .+ 號$/,
    /^每週.+$/,
    /^星期.+$/,
    /^建立於 /,
    /^已更新語言：/,
    /^載入失敗：/,
    /^發生未預期的錯誤：/,
    /^.+ 登入失敗：/,
    /^更新股價失敗：/,
    /^同步股利失敗：/,
    /^照片上傳失敗：/,
    /^請求失敗（HTTP .+）$/,
    /^登入失敗（HTTP .+）$/,
    /^無法連線到後端（.+）：.+$/,
    /^確定刪除「.+」？$/,
    /^解除 .+ 綁定$/,
    /^確定解除與 .+ 的綁定？$/,
    /^.+ 綁定$/,
    /^.+（全部）$/,
  ].some((pattern) => pattern.test(value));
}

function readMobileTranslationMaps() {
  const text = fs.readFileSync(path.join(ROOT, 'mobile', 'lib', 'l10n.dart'), 'utf8');
  return {
    en: parseDartMap(text, '_en'),
    'zh-CN': parseDartMaps(text, ['_zhCN', '_zhCNCompletion']),
    es: parseDartMaps(text, ['_es', '_esCompletion']),
    ar: parseDartMaps(text, ['_ar', '_arCompletion']),
    fr: parseDartMaps(text, ['_fr', '_frCompletion']),
    hi: parseDartMaps(text, ['_hi', '_hiCompletion']),
    'pt-BR': parseDartMaps(text, ['_ptBR', '_ptBRCompletion']),
    ru: parseDartMaps(text, ['_ru', '_ruCompletion']),
    ko: parseDartMaps(text, ['_ko', '_koCompletion']),
  };
}

function bootstrapArbs() {
  const webDictionaries = Object.fromEntries(locales.map((locale) => [locale.id, loadWebDictionary(locale)]));
  const sourceLeaves = flatten(webDictionaries[sourceLocale]);
  const sourceValues = new Set(sourceLeaves.map(([, value]) => value).filter((value) => typeof value === 'string'));
  const usedKeys = new Set(sourceLeaves.map(([dotPath]) => messageKeyForPath(dotPath)));
  const entries = sourceLeaves.map(([dotPath, sourceValue]) => ({
    key: messageKeyForPath(dotPath),
    webPath: dotPath,
    description: `Web path: ${dotPath}`,
    values: Object.fromEntries(locales.map((locale) => {
      const leaf = flatten(webDictionaries[locale.id]).find(([pathName]) => pathName === dotPath);
      return [locale.id, leaf?.[1] ?? sourceValue];
    })),
  }));

  const mobileMaps = readMobileTranslationMaps();
  const mobileStrings = parseMobileSourceStrings()
    .filter((source) => typeof source === 'string')
    .filter((source) => !sourceValues.has(source))
    .filter((source) => !isDynamicMobileTemplate(source))
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  for (const source of mobileStrings) {
    const english = mobileMaps.en.get(source) ?? source;
    const key = mobileLegacyKey(source, english, usedKeys);
    const webPath = `mobileLegacy.${key.slice('mobileLegacy'.length, 'mobileLegacy'.length + 1).toLowerCase()}${key.slice('mobileLegacy'.length + 1)}`;
    entries.push({
      key,
      webPath,
      description: `Mobile compatibility string: ${source}`,
      values: Object.fromEntries(locales.map((locale) => [
        locale.id,
        locale.id === sourceLocale ? source : (mobileMaps[locale.id]?.get(source) ?? mobileMaps.en.get(source) ?? source),
      ])),
    });
  }

  for (const locale of locales) {
    const arb = { '@@locale': locale.arbLocale };
    for (const entry of entries) {
      const value = String(entry.values[locale.id] ?? entry.values[sourceLocale] ?? '');
      arb[entry.key] = value;
      arb[`@${entry.key}`] = arbMetadata(entry.webPath, value, entry.description);
    }
    writeFile(path.join(SHARED_DIR, `app_${locale.arbLocale}.arb`), `${JSON.stringify(arb, null, 2)}\n`);
  }

  console.log(`Bootstrapped ${entries.length} shared messages (${mobileStrings.length} mobile compatibility strings).`);
}

function readArbs() {
  const arbs = {};
  for (const locale of locales) {
    const file = path.join(SHARED_DIR, `app_${locale.arbLocale}.arb`);
    arbs[locale.id] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return arbs;
}

function entriesFromArb(sourceArb) {
  return Object.keys(sourceArb)
    .filter((key) => !key.startsWith('@'))
    .map((key) => {
      const meta = sourceArb[`@${key}`] ?? {};
      const webPath = meta['x-webPath'] ?? String(meta.description ?? '').replace(/^Web path:\s*/, '');
      if (!webPath || webPath === String(meta.description ?? '')) {
        throw new Error(`ARB key ${key} is missing x-webPath metadata`);
      }
      return { key, webPath, description: meta.description };
    });
}

function tsString(value) {
  return JSON.stringify(String(value));
}

function tsObject(value, indent = 0) {
  const pad = ' '.repeat(indent);
  const childPad = ' '.repeat(indent + 2);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return tsString(value);
  const lines = ['{'];
  for (const [key, child] of Object.entries(value)) {
    const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : tsString(key);
    lines.push(`${childPad}${safeKey}: ${tsObject(child, indent + 2)},`);
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

function generatedHeader(commentStyle = '//') {
  return `${commentStyle} Generated by tools/generate-shared-i18n.mjs. Do not edit by hand.\n`;
}

function webDictionaryOutputs(arbs, entries) {
  const outputs = {};
  for (const locale of locales) {
    const nested = {};
    for (const entry of entries) {
      setPath(nested, entry.webPath, arbs[locale.id][entry.key] ?? arbs[sourceLocale][entry.key] ?? '');
    }
    const file = path.join(WEB_DICT_DIR, `${locale.tsFile}.ts`);
    const isSource = locale.id === sourceLocale;
    const body = isSource
      ? `${generatedHeader()}export const ${locale.tsExport} = ${tsObject(nested)};\n\nexport type Dictionary = typeof ${locale.tsExport};\nexport type DeepPartialDict<T> = {\n  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartialDict<T[K]> : T[K];\n};\n`
      : `${generatedHeader()}import type { Dictionary, DeepPartialDict } from './${sourceConfig.tsFile}';\n\nexport const ${locale.tsExport} = ${tsObject(nested)} satisfies DeepPartialDict<Dictionary>;\n`;
    outputs[file] = body;
  }
  return outputs;
}

function webConfigOutput() {
  const tuple = (values) => `[${values.map((value) => tsString(value)).join(', ')}] as const`;
  const record = (selector) => `{\n${locales.map((locale) => `  ${tsString(locale.id)}: ${tsString(selector(locale))},`).join('\n')}\n} as const`;
  const prefixAliases = [];
  for (const locale of locales) {
    for (const prefix of locale.matchPrefixes ?? []) prefixAliases.push([prefix, locale.id]);
  }
  prefixAliases.sort(([a], [b]) => b.length - a.length);
  return {
    [path.join(WEB_GENERATED_DIR, 'config.ts')]: `${generatedHeader()}export const GENERATED_LOCALES = ${tuple(locales.map((locale) => locale.id))};\nexport const GENERATED_DEFAULT_LOCALE = ${tsString(sourceLocale)};\nexport const GENERATED_HTML_LANG = ${record((locale) => locale.htmlLang)};\nexport const GENERATED_HTML_DIR = ${record((locale) => locale.dir)};\nexport const GENERATED_LOCALE_LABELS = ${record((locale) => locale.label)};\nexport const GENERATED_LOCALE_PREFIX_ALIASES = [\n${prefixAliases.map(([prefix, locale]) => `  [${tsString(prefix)}, ${tsString(locale)}],`).join('\n')}\n] as const;\n`,
  };
}

function dartString(value) {
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\$/g, '\\$')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}'`;
}

function dartMap(entries, indent = 0) {
  const childPad = ' '.repeat(indent + 2);
  return `{\n${entries.map(([key, value]) => `${childPad}${dartString(key)}: ${dartString(value)},`).join('\n')}\n${' '.repeat(indent)}}`;
}

function dartLocaleOutput() {
  const prefixAliases = [];
  for (const locale of locales) {
    for (const prefix of locale.matchPrefixes ?? []) prefixAliases.push([prefix, locale.id]);
  }
  prefixAliases.sort(([a], [b]) => b.length - a.length);
  return {
    [path.join(MOBILE_GENERATED_DIR, 'app_locales.dart')]: `${generatedHeader('//')}import 'dart:ui';\n\nclass AppLocaleParts {\n  final String languageCode;\n  final String? scriptCode;\n  final String? countryCode;\n\n  const AppLocaleParts(this.languageCode, {this.scriptCode, this.countryCode});\n\n  Locale toLocale() => Locale.fromSubtags(\n        languageCode: languageCode,\n        scriptCode: scriptCode,\n        countryCode: countryCode,\n      );\n}\n\nclass AppLocalePrefixAlias {\n  final String prefix;\n  final String locale;\n\n  const AppLocalePrefixAlias(this.prefix, this.locale);\n}\n\nconst kDefaultAppLocale = ${dartString(sourceLocale)};\nconst kSupportedAppLocales = <String>[${locales.map((locale) => dartString(locale.id)).join(', ')}];\nconst kAppLocaleLabels = <String, String>${dartMap(locales.map((locale) => [locale.id, locale.label]), 0)};\nconst kAndroidLocaleTags = <String, String>${dartMap(locales.map((locale) => [locale.id, locale.androidTag]), 0)};\nconst kAppIntlLocaleTags = <String, String>${dartMap(locales.map((locale) => [locale.id, locale.intlTag]), 0)};\nconst kFlutterLocaleParts = <String, AppLocaleParts>{\n${locales.map((locale) => {
      const parts = locale.flutter;
      const named = [
        parts.scriptCode ? `scriptCode: ${dartString(parts.scriptCode)}` : null,
        parts.countryCode ? `countryCode: ${dartString(parts.countryCode)}` : null,
      ].filter(Boolean).join(', ');
      return `  ${dartString(locale.id)}: AppLocaleParts(${dartString(parts.languageCode)}${named ? `, ${named}` : ''}),`;
    }).join('\n')}\n};\nconst kLocalePrefixAliases = <AppLocalePrefixAlias>[\n${prefixAliases.map(([prefix, locale]) => `  AppLocalePrefixAlias(${dartString(prefix)}, ${dartString(locale)}),`).join('\n')}\n];\n`,
  };
}

function dartTranslationsOutput(arbs, entries) {
  const sourceToKey = new Map();
  for (const entry of entries) {
    const sourceValue = String(arbs[sourceLocale][entry.key] ?? '');
    if (!sourceToKey.has(sourceValue)) sourceToKey.set(sourceValue, entry.key);
  }
  const translationBlocks = locales.map((locale) => {
    const rows = entries.map((entry) => [entry.key, String(arbs[locale.id][entry.key] ?? arbs[sourceLocale][entry.key] ?? '')]);
    return `  ${dartString(locale.id)}: <String, String>${dartMap(rows, 2)},`;
  }).join('\n');
  const content = [
    generatedHeader('//') + "import 'app_locales.dart';",
    '',
    `const kSharedSourceToKey = <String, String>${dartMap([...sourceToKey.entries()], 0)};`,
    'const kSharedTranslations = <String, Map<String, String>>{',
    translationBlocks,
    '};',
    '',
    'String? lookupSharedTranslation(String locale, String source) {',
    '  final key = kSharedSourceToKey[source];',
    '  if (key == null) return null;',
    '  return lookupSharedTranslationByKey(locale, key);',
    '}',
    '',
    'String? lookupSharedTranslationByKey(String locale, String key, [Map<String, Object?>? vars]) {',
    '  final normalizedLocale = kSupportedAppLocales.contains(locale) ? locale : kDefaultAppLocale;',
    '  var value = kSharedTranslations[normalizedLocale]?[key] ??',
    "      kSharedTranslations['en']?[key] ??",
    '      kSharedTranslations[kDefaultAppLocale]?[key];',
    '  if (value == null) return null;',
    '  if (vars != null) {',
    '    for (final entry in vars.entries) {',
    "      value = value!.replaceAll('{${entry.key}}', '${entry.value}');",
    '    }',
    '  }',
    '  return value;',
    '}',
    '',
  ].join('\n');
  return {
    [path.join(MOBILE_GENERATED_DIR, 'shared_translations.dart')]: content,
  };
}

function androidLocaleConfigOutput() {
  return {
    [ANDROID_LOCALE_CONFIG]: `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by tools/generate-shared-i18n.mjs. Do not edit by hand. -->\n<locale-config xmlns:android="http://schemas.android.com/apk/res/android">\n${locales.map((locale) => `    <locale android:name="${locale.androidTag}" />`).join('\n')}\n</locale-config>\n`,
  };
}

function flutterArbOutputs(arbs) {
  const outputs = {};
  const writeArb = (fileLocale, arb) => {
    outputs[path.join(MOBILE_FLUTTER_ARB_DIR, `app_${fileLocale}.arb`)] = `${JSON.stringify(arb, null, 2)}\n`;
  };

  for (const locale of locales) writeArb(locale.arbLocale, arbs[locale.id]);

  const fallbackByLanguage = new Map();
  for (const locale of locales) {
    const languageCode = locale.flutter.languageCode;
    if (!locale.flutter.scriptCode && !locale.flutter.countryCode) continue;
    if (!fallbackByLanguage.has(languageCode) || locale.id === sourceLocale) {
      fallbackByLanguage.set(languageCode, locale.id);
    }
  }

  for (const [languageCode, localeId] of fallbackByLanguage) {
    if (locales.some((locale) => locale.arbLocale === languageCode)) continue;
    writeArb(languageCode, { ...arbs[localeId], '@@locale': languageCode });
  }

  return outputs;
}

function allOutputs() {
  const arbs = readArbs();
  const entries = entriesFromArb(arbs[sourceLocale]);
  return {
    ...webDictionaryOutputs(arbs, entries),
    ...webConfigOutput(),
    ...dartLocaleOutput(),
    ...dartTranslationsOutput(arbs, entries),
    ...androidLocaleConfigOutput(),
    ...flutterArbOutputs(arbs),
  };
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

if (bootstrapFromWeb) {
  if (checkOnly) throw new Error('--bootstrap-from-web cannot be combined with --check');
  bootstrapArbs();
}

const outputs = allOutputs();
let mismatches = 0;
for (const [file, content] of Object.entries(outputs)) {
  if (checkOnly) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current !== content) {
      console.error(`Generated i18n output is stale: ${path.relative(ROOT, file)}`);
      mismatches += 1;
    }
  } else {
    writeFile(file, content);
  }
}

if (checkOnly) {
  if (mismatches > 0) process.exit(1);
  console.log('Generated i18n outputs are up to date.');
} else {
  console.log(`Generated ${Object.keys(outputs).length} i18n output files.`);
}
