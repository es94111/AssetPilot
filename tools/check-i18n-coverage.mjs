import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const webDictionaries = {
  en: ['lib/i18n/dictionaries/en.ts', 'en'],
  'zh-CN': ['lib/i18n/dictionaries/zh-CN.ts', 'zhCN'],
  es: ['lib/i18n/dictionaries/es.ts', 'es'],
  ar: ['lib/i18n/dictionaries/ar.ts', 'ar'],
  fr: ['lib/i18n/dictionaries/fr.ts', 'fr'],
  hi: ['lib/i18n/dictionaries/hi.ts', 'hi'],
  'pt-BR': ['lib/i18n/dictionaries/pt-BR.ts', 'ptBR'],
  ru: ['lib/i18n/dictionaries/ru.ts', 'ru'],
  ko: ['lib/i18n/dictionaries/ko.ts', 'ko'],
};

const targetLocales = ['zh-CN', 'es', 'ar', 'fr', 'hi', 'pt-BR', 'ru', 'ko'];

function leaves(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' && !Array.isArray(child)
      ? leaves(child, prefix ? `${prefix}.${key}` : key)
      : [[prefix ? `${prefix}.${key}` : key, child]]
  );
}

async function readWebDictionary(path, exportName) {
  const mod = await import(pathToFileURL(path).href);
  return mod[exportName];
}

function parseDartMap(source, mapName) {
  const start = source.indexOf(`const Map<String, String> ${mapName} = {`);
  if (start < 0) return new Set();
  const bodyStart = source.indexOf('{', start) + 1;
  const end = source.indexOf('\n};', bodyStart);
  const body = source.slice(bodyStart, end);
  return new Set([...body.matchAll(/^\s*'((?:\\'|[^'])+)'\s*:/gm)].map((m) => m[1].replace(/\\'/g, "'").replace(/\\\$/g, '$')));
}

function parseDartMaps(source, mapNames) {
  const keys = new Set();
  for (const mapName of mapNames) {
    for (const key of parseDartMap(source, mapName)) keys.add(key);
  }
  return keys;
}

function isMobileDynamicKey(key) {
  return [
    /^\d+ 號$/,
    /^\$d 號$/,
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
  ].some((pattern) => pattern.test(key));
}

function parseMobileSourceKeys() {
  const keys = new Set();
  for (const file of [
    'mobile/lib/api_client.dart',
    'mobile/lib/l10n.dart',
    'mobile/lib/widgets.dart',
    ...[
      'accounts_screen',
      'budgets_screen',
      'categories_screen',
      'changelog_screen',
      'dashboard_screen',
      'login_screen',
      'more_screen',
      'onboarding_screen',
      'recurring_screen',
      'register_screen',
      'report_schedule_screen',
      'reports_screen',
      'security_screens',
      'settings_screen',
      'stock_settings_screen',
      'stocks_screen',
      'transaction_form_screen',
      'transactions_screen',
    ].map((name) => `mobile/lib/screens/${name}.dart`),
  ]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/tr\('((?:\\'|[^'])+)'\)/g)) keys.add(match[1].replace(/\\'/g, "'"));
    for (const match of text.matchAll(/trPair\('((?:\\'|[^'])+)'\s*,/g)) keys.add(match[1].replace(/\\'/g, "'"));
  }
  return keys;
}

function printRow(kind, locale, total, covered, missing) {
  const pct = total ? ((covered / total) * 100).toFixed(1) : '0.0';
  console.log(`${kind.padEnd(6)} ${locale.padEnd(5)} ${String(covered).padStart(4)}/${String(total).padEnd(4)} ${pct.padStart(5)}% missing=${missing}`);
}

const strict = process.argv.includes('--strict');
let incomplete = false;

const zhTW = await readWebDictionary('lib/i18n/dictionaries/zh-TW.ts', 'zhTW');
const webSourceKeys = new Set(leaves(zhTW).map(([key]) => key));

console.log('Web dictionaries');
for (const locale of targetLocales) {
  const [path, exportName] = webDictionaries[locale];
  const dict = await readWebDictionary(path, exportName);
  const keys = new Set(leaves(dict).map(([key]) => key));
  const missing = [...webSourceKeys].filter((key) => !keys.has(key));
  if (missing.length) incomplete = true;
  printRow('web', locale, webSourceKeys.size, webSourceKeys.size - missing.length, missing.length);
  if (missing.length) console.log(`       first missing: ${missing.slice(0, 8).join(', ')}`);
}

console.log('\nMobile dictionaries');
const mobileText = readFileSync('mobile/lib/l10n.dart', 'utf8');
const mobileSourceKeys = parseMobileSourceKeys();
const mobileMapNames = {
  'zh-CN': ['_zhCN', '_zhCNCompletion'],
  es: ['_es', '_esCompletion'],
  ar: ['_ar', '_arCompletion'],
  fr: ['_fr', '_frCompletion'],
  hi: ['_hi', '_hiCompletion'],
  'pt-BR': ['_ptBR', '_ptBRCompletion'],
  ru: ['_ru', '_ruCompletion'],
  ko: ['_ko', '_koCompletion'],
};
for (const locale of targetLocales) {
  const keys = parseDartMaps(mobileText, mobileMapNames[locale]);
  const missing = [...mobileSourceKeys].filter((key) => !keys.has(key) && !isMobileDynamicKey(key));
  if (missing.length) incomplete = true;
  printRow('mobile', locale, mobileSourceKeys.size, mobileSourceKeys.size - missing.length, missing.length);
  if (missing.length) console.log(`       first missing: ${missing.slice(0, 8).join(', ')}`);
}

if (strict && incomplete) process.exit(1);
