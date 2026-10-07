// tests/lib/reportCurrency.test.ts — 報表基準幣別（issue #255）。
//
// 零相依純函式測試，不需 PostgreSQL：
//  1. 基準幣別解析與 ISO 4217 白名單
//  2. decimal.js 全精度換算（含 float 會失真的案例）
//  3. 匯率來源標示與字典鍵一致性（動態鍵繞過 check:i18n 靜態掃描，故在此斷言）
//  4. 顯示格式化與既有 TWD 行為完全一致
import assert from 'node:assert/strict';
import test from 'node:test';
import Decimal from 'decimal.js';
import {
  REPORT_BASE_CURRENCY_DEFAULT,
  REPORT_RATE_SOURCES,
  REPORT_RATE_SOURCE_LABEL_KEYS,
  REPORT_RATE_SOURCE_SOURCE_LABELS,
  reportRateSourceLabelKey,
  reportRateSourceLabel,
  reportCurrencyFractionDigits,
  reportBaseCurrencyOptions,
  resolveReportBaseCurrency,
  formatReportMoney,
} from '../../lib/reportCurrency.ts';
import {
  convertReportSummaryToBase,
  toBaseAmountNumber,
  convertAmountToBase,
  roundReportAmount,
  reportFractionDigits,
  isUsableReportRate,
  toReportDecimal,
} from '../../lib/reportCurrencyConversion.ts';
import { ISO_4217_CODES, isValidCurrency } from '../../lib/iso4217.ts';
import { getSmallestUnit } from '../../lib/moneyDecimal.ts';
import {
  resolveRateToTwdFromRows,
  availableCurrenciesFromRows,
  buildReportCurrencyContext,
  normalizeReportCurrency,
  type SharedCachedRate,
} from '../../lib/reportCurrencyRate.ts';
import { DEFAULT_EXCHANGE_RATES } from '../../lib/exchangeRateDefaults.ts';
import { zhTW } from '../../lib/i18n/dictionaries/zh-TW.ts';

const DEFAULTS = DEFAULT_EXCHANGE_RATES;

function row(currency: string, rate: string, opts: { updatedAt?: number; isManual?: boolean } = {}) {
  return {
    currency,
    rate_to_twd: rate,
    updated_at: opts.updatedAt ?? 0,
    is_manual: opts.isManual ? 1 : 0,
  };
}

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (
    acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined
  ), zhTW);
}

test('resolveReportBaseCurrency：未指定／空白一律回預設 TWD（既有行為）', () => {
  assert.equal(REPORT_BASE_CURRENCY_DEFAULT, 'TWD');
  assert.equal(resolveReportBaseCurrency(null), 'TWD');
  assert.equal(resolveReportBaseCurrency(undefined), 'TWD');
  assert.equal(resolveReportBaseCurrency(''), 'TWD');
  assert.equal(resolveReportBaseCurrency('   '), 'TWD');
  assert.equal(resolveReportBaseCurrency('TWD'), 'TWD');
});

test('resolveReportBaseCurrency：大小寫正規化，僅接受 ISO 4217 白名單', () => {
  assert.equal(resolveReportBaseCurrency('usd'), 'USD');
  assert.equal(resolveReportBaseCurrency(' jpy '), 'JPY');
  assert.equal(resolveReportBaseCurrency('bhd'), 'BHD');
  for (const code of ISO_4217_CODES) {
    assert.equal(resolveReportBaseCurrency(code), code, `${code} 應為合法基準幣別`);
    assert.equal(resolveReportBaseCurrency(code.toLowerCase()), code);
  }
});

test('resolveReportBaseCurrency：非白名單輸入回 null（呼叫端須回 400）', () => {
  for (const bad of ['XYZ', 'TW', 'TWDX', '123', 'US$', '台幣', '<script>', 'ZZZ']) {
    assert.equal(resolveReportBaseCurrency(bad), null, `${bad} 應被拒絕`);
  }
  // 僅 3 碼英文字母但不在白名單者亦須拒絕（避免放行任意代碼）
  assert.equal(isValidCurrency('ZZZ'), false);
  assert.equal(resolveReportBaseCurrency('ZZZ'), null);
});

test('reportBaseCurrencyOptions：TWD 置頂、其餘依字母排序、去重且限白名單', () => {
  const options = reportBaseCurrencyOptions(['USD', 'JPY', 'USD', 'eur', 'ZZZ', 'TW']);
  assert.deepEqual(options, ['TWD', 'EUR', 'JPY', 'USD']);
  assert.equal(options[0], 'TWD');
  // 無可用清單時至少仍提供預設幣別
  assert.deepEqual(reportBaseCurrencyOptions(null), ['TWD']);
  assert.deepEqual(reportBaseCurrencyOptions(undefined), ['TWD']);
  assert.deepEqual(reportBaseCurrencyOptions([]), ['TWD']);
});

test('reportBaseCurrencyOptions：current 一律保留（深層連結），但須通過白名單', () => {
  assert.deepEqual(reportBaseCurrencyOptions(['USD'], 'JPY'), ['TWD', 'JPY', 'USD']);
  assert.deepEqual(reportBaseCurrencyOptions(['USD'], 'ZZZ'), ['TWD', 'USD']);
  assert.deepEqual(reportBaseCurrencyOptions(['USD'], 'twd'), ['TWD', 'USD']);
});

test('匯率來源：標籤鍵與固定中文標示皆涵蓋全部來源且與字典一致', () => {
  for (const source of REPORT_RATE_SOURCES) {
    const key = reportRateSourceLabelKey(source);
    assert.equal(key, REPORT_RATE_SOURCE_LABEL_KEYS[source]);
    assert.equal(typeof lookup(key as string), 'string', `${key} 應存在於 zh-TW 字典`);
    assert.notEqual(String(lookup(key as string)).trim(), '', `${key} 不應為空字串`);

    // CSV 匯出用的固定中文字串必須與字典值完全相同，避免畫面與匯出漂移。
    assert.equal(reportRateSourceLabel(source), lookup(key as string), `${source} 的 CSV 標示應等於字典值`);
  }
  assert.equal(reportRateSourceLabelKey('unknown'), null);
  assert.equal(reportRateSourceLabel('unknown'), 'unknown');
});

test('reportRateSourceLabelKey 與固定標示表的鍵集合相等（無遺漏、無多餘）', () => {
  assert.deepEqual(Object.keys(REPORT_RATE_SOURCE_LABEL_KEYS).sort(), [...REPORT_RATE_SOURCES].sort());
  assert.deepEqual(Object.keys(REPORT_RATE_SOURCE_SOURCE_LABELS).sort(), [...REPORT_RATE_SOURCES].sort());
});

test('toReportDecimal：null／NaN／Infinity／非數字一律視為 0，不拋錯', () => {
  assert.equal(toReportDecimal(null).toString(), '0');
  assert.equal(toReportDecimal(undefined).toString(), '0');
  assert.equal(toReportDecimal('').toString(), '0');
  assert.equal(toReportDecimal(Number.NaN).toString(), '0');
  assert.equal(toReportDecimal(Number.POSITIVE_INFINITY).toString(), '0');
  assert.equal(toReportDecimal('abc').toString(), '0');
  assert.equal(toReportDecimal('12.5').toString(), '12.5');
});

test('isUsableReportRate：僅有限正數可用', () => {
  assert.equal(isUsableReportRate('31.5'), true);
  assert.equal(isUsableReportRate(1), true);
  assert.equal(isUsableReportRate('0'), false);
  assert.equal(isUsableReportRate('-1'), false);
  assert.equal(isUsableReportRate(Number.NaN), false);
  assert.equal(isUsableReportRate(null), false);
  assert.equal(isUsableReportRate(undefined), false);
});

test('decimal.js 全精度換算：float 會失真的案例仍得出正確結果', () => {
  // 10.01 / 2：float 為 5.004999...，toFixed(2) 得 5.00；Decimal HALF_UP 得 5.01
  assert.equal((10.01 / 2).toFixed(2), '5.00', '前提：float 在此案例確實失真');
  assert.equal(toBaseAmountNumber('10.01', '2', 'USD'), 5.01);

  // 0.1 + 0.2 的經典誤差不得出現
  assert.equal(new Decimal('0.1').plus('0.2').toString(), '0.3');
  assert.equal(toBaseAmountNumber('0.3', '1', 'USD'), 0.3);

  // 整數加總後換算：0.01 + 0.02 = 0.03 除以 2 為 0.015 → HALF_UP 為 0.02；
  // 若先以 float 相除再加總（0.005 + 0.01）則會得到不同的四捨五入結果。
  assert.equal(toBaseAmountNumber('0.03', '2', 'USD'), 0.02);
  assert.equal((0.01 / 2) + (0.02 / 2), 0.015);
});

test('decimal.js 全精度換算：匯總先加總再換算，與逐筆全精度換算結果一致', () => {
  const amounts = ['100', '200', '300'];
  const rate = '31.5';

  // 既有彙總以整數加總（float 完全精確），再一次性以 Decimal 換算
  let sumAsNumber = 0;
  let sumAsDecimal = new Decimal(0);
  for (const a of amounts) {
    sumAsNumber += Number(a);
    sumAsDecimal = sumAsDecimal.plus(a);
  }
  assert.equal(sumAsDecimal.toString(), '600');

  const viaAggregate = toBaseAmountNumber(sumAsNumber, rate, 'USD');
  const viaPerItem = amounts
    .map(a => new Decimal(a).div(rate))
    .reduce((acc, v) => acc.plus(v), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
  assert.equal(viaAggregate, viaPerItem);
  assert.equal(viaAggregate, 19.05);
});

test('decimal.js 全精度換算：基準幣別為 TWD 時完全不改動既有數值', () => {
  const summary = {
    catMap: { 午餐: { total: 300, color: '#111' } },
    categoryBreakdown: [{ total: 300 }],
    dailyMap: { '2026-05-10': 100, '2026-05-15': 200 },
    monthlyMap: { '2026-05': 300 },
    total: 300,
  };
  // TWD 匯率為 1：換算後必須與輸入逐欄相同（預設行為不變）
  const converted = convertReportSummaryToBase(summary, '1', 'TWD');
  assert.equal(converted.total, 300);
  assert.equal(converted.catMap['午餐']?.total, 300);
  assert.equal(converted.catMap['午餐']?.color, '#111');
  assert.equal(converted.dailyMap['2026-05-10'], 100);
  assert.equal(converted.monthlyMap['2026-05'], 300);
  assert.equal(converted.categoryBreakdown[0].total, 300);
});

test('convertReportSummaryToBase：所有金額欄位皆換算，非金額欄位原樣保留', () => {
  const summary = {
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    catMap: {
      午餐: { total: 630, color: '#ef4444' },
      晚餐: { total: 315, color: '#3b82f6' },
    },
    categoryBreakdown: [
      { categoryId: 'a', name: '午餐', total: 630, parentName: '餐飲' },
      { categoryId: null, name: '合計', total: 315 },
    ],
    dailyMap: { '2026-05-10': 630, '2026-05-11': 315 },
    monthlyMap: { '2026-05': 945 },
    total: 945,
  };
  const converted = convertReportSummaryToBase(summary, '31.5', 'USD');

  assert.equal(converted.total, 30); // 945 / 31.5
  assert.equal(converted.catMap['午餐']?.total, 20); // 630 / 31.5
  assert.equal(converted.catMap['午餐']?.color, '#ef4444');
  assert.equal(converted.dailyMap['2026-05-10'], 20);
  assert.equal(converted.dailyMap['2026-05-11'], 10);
  assert.equal(converted.monthlyMap['2026-05'], 30);
  assert.deepEqual(converted.categoryBreakdown.map(n => n.total), [20, 10]);
  // 非金額欄位不變
  assert.equal(converted.categoryBreakdown[0].name, '午餐');
  assert.equal(converted.categoryBreakdown[0].parentName, '餐飲');
  assert.equal(converted.periodStart, '2026-05-01');
  assert.equal(converted.periodEnd, '2026-05-31');
});

test('convertReportSummaryToBase：分項捨入差額以最大餘數法分配，使所有分組加總等於總計', () => {
  const summary = {
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    catMap: {
      A: { total: 1, color: '#111' },
      B: { total: 1, color: '#222' },
      C: { total: 1, color: '#333' },
    },
    categoryBreakdown: [
      { categoryId: 'a', name: 'A', total: 1 },
      { categoryId: 'b', name: 'B', total: 1 },
      { categoryId: 'c', name: 'C', total: 1 },
    ],
    dailyMap: { '2026-05-01': 1, '2026-05-02': 1, '2026-05-03': 1 },
    monthlyMap: { '2026-05': 3 },
    total: 3,
  };

  const converted = convertReportSummaryToBase(summary, '31.5', 'USD');
  assert.equal(converted.total, 0.1);
  const sum = (values: number[]) => values.reduce((acc, value) => acc.plus(String(value)), new Decimal(0)).toString();
  assert.equal(sum(Object.values(converted.catMap).map(entry => entry.total)), '0.1');
  assert.equal(sum(converted.categoryBreakdown.map(entry => entry.total)), '0.1');
  assert.equal(sum(Object.values(converted.dailyMap)), '0.1');
  assert.equal(sum(Object.values(converted.monthlyMap)), '0.1');
  // Exact tie follows source order deterministically; one smallest unit residual goes to the first bucket.
  assert.deepEqual(converted.categoryBreakdown.map(entry => entry.total), [0.04, 0.03, 0.03]);
});

test('convertReportSummaryToBase：不修改傳入的物件（純函式）', () => {
  const summary = {
    catMap: { 午餐: { total: 630, color: '#111' } },
    categoryBreakdown: [{ total: 630 }],
    dailyMap: { '2026-05-10': 630 },
    monthlyMap: { '2026-05': 630 },
    total: 630,
  };
  const snapshot = JSON.parse(JSON.stringify(summary));
  convertReportSummaryToBase(summary, '31.5', 'USD');
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), snapshot);
});

test('roundReportAmount：依幣別最小單位四捨五入（HALF_UP）', () => {
  assert.equal(roundReportAmount('95.238095238095238095', 'USD').toString(), '95.24');
  assert.equal(roundReportAmount('14286.5', 'JPY').toString(), '14287');
  assert.equal(roundReportAmount('14286.4', 'JPY').toString(), '14286');
  assert.equal(roundReportAmount('2.675', 'USD').toString(), '2.68');
  assert.equal(roundReportAmount('8000', 'BHD').toString(), '8000');
  assert.equal(roundReportAmount('1.2345678', 'BHD').toString(), '1.235');
  assert.equal(roundReportAmount('3.5', 'TWD').toString(), '4');
});

test('convertAmountToBase：TWD 基準直接回傳原值（不經除法）', () => {
  assert.equal(convertAmountToBase('3000', '1', 'TWD').toString(), '3000');
  assert.equal(convertAmountToBase('3000', '0', 'TWD').toString(), '3000');
  assert.equal(convertAmountToBase('3000', '31.5', 'USD').toString(), '95.238095238095238095');
});

test('convertAmountToBase：匯率非正數時拋錯（不靜默產生錯誤金額）', () => {
  assert.throws(() => convertAmountToBase('3000', '0', 'USD'), /positive/);
  assert.throws(() => convertAmountToBase('3000', '-1', 'USD'), /positive/);
  assert.throws(() => convertAmountToBase('3000', 'abc', 'USD'), /positive/);
});

test('reportFractionDigits 與 server 端 getSmallestUnit 在所有 ISO 4217 代碼上一致（TWD 為刻意的 0 位例外）', () => {
  for (const code of ISO_4217_CODES) {
    const unit = getSmallestUnit(code);
    const expected = unit <= 1 ? 0 : Math.round(Math.log10(unit));
    assert.equal(reportFractionDigits(code), expected, `${code} 的小數位數應為 ${expected}`);
  }
});

test('reportCurrencyFractionDigits（client 版，Intl）與 reportFractionDigits 一致，TWD 例外固定 0 位', () => {
  assert.equal(reportCurrencyFractionDigits('TWD'), 0);
  for (const code of ISO_4217_CODES) {
    if (code === 'TWD') continue;
    assert.equal(
      reportCurrencyFractionDigits(code),
      reportFractionDigits(code),
      `${code} 的 client 與 server 小数位數應一致`,
    );
  }
});

test('formatReportMoney：預設 TWD 輸出與既有報表完全相同（NT$ 3,000）', () => {
  assert.equal(formatReportMoney(3000), 'NT$ 3,000');
  assert.equal(formatReportMoney(3000, 'TWD'), 'NT$ 3,000');
  assert.equal(formatReportMoney(3000, 'TWD', 'zh-TW'), 'NT$ 3,000');
  assert.equal(formatReportMoney('3000', 'twd'), 'NT$ 3,000');
  // 既有實作為 Math.round → 四捨五入至整數，不得出現小數
  assert.equal(formatReportMoney(3000.4, 'TWD'), 'NT$ 3,000');
  assert.equal(formatReportMoney(1299.6, 'TWD'), 'NT$ 1,300');
  assert.equal(formatReportMoney(-1.5, 'TWD'), 'NT$ -1');
  assert.equal(formatReportMoney(0, 'TWD'), 'NT$ 0');
  // 未提供幣別時回退預設
  assert.equal(formatReportMoney(500, ''), 'NT$ 500');
  assert.equal(formatReportMoney(500, undefined as unknown as string), 'NT$ 500');
});

test('formatReportMoney：非 TWD 幣別附上代碼並依最小單位顯示小數', () => {
  assert.equal(formatReportMoney(95.24, 'USD', 'zh-TW'), '95.24 USD');
  assert.equal(formatReportMoney(14286, 'JPY', 'zh-TW'), '14,286 JPY');
  assert.equal(formatReportMoney('95.2', 'usd', 'zh-TW'), '95.20 USD');
  assert.equal(formatReportMoney(3000, 'ZZZ', 'zh-TW'), '3,000.00 ZZZ');
});

// ── 匯率解析（lib/reportCurrencyRate.ts，零相依） ─────────────────────

test('resolveRateToTwdFromRows：TWD 一律為 identity 且匯率 1', () => {
  for (const rows of [[], [row('USD', '32.1')], [row('TWD', '5')]]) {
    assert.deepEqual(resolveRateToTwdFromRows('TWD', rows, DEFAULTS), {
      rateToTwd: '1',
      source: 'identity',
      updatedAt: 0,
    });
  }
});

test('resolveRateToTwdFromRows：使用者列優先於系統預設，is_manual 決定來源標示', () => {
  const manual = resolveRateToTwdFromRows('USD', [row('USD', '32.5', { updatedAt: 1700000000000, isManual: true })], DEFAULTS);
  assert.equal(manual?.rateToTwd, '32.5');
  assert.equal(manual?.source, 'manual');
  assert.equal(manual?.updatedAt, 1700000000000);

  const auto = resolveRateToTwdFromRows('USD', [row('USD', '31.75', { updatedAt: 1700000000001 })], DEFAULTS);
  assert.equal(auto?.rateToTwd, '31.75');
  assert.equal(auto?.source, 'exchangerate-api');
  assert.equal(auto?.updatedAt, 1700000000001);
});

test('resolveRateToTwdFromRows：無使用者列時回退系統預設，來源標示為 default', () => {
  for (const [code, rate] of Object.entries(DEFAULTS)) {
    const resolved = resolveRateToTwdFromRows(code, [], DEFAULTS);
    assert.ok(resolved, `${code} 應可由系統預設解析`);
    assert.equal(resolved?.rateToTwd, String(rate));
    assert.equal(resolved?.source, code === 'TWD' ? 'identity' : 'default');
  }
});

test('resolveRateToTwdFromRows：沿用 30 分鐘內 exchangeRateCache，保留來源與 fetchedAt', () => {
  const nowMs = 1700000000000;
  const cached: ReadonlyMap<string, SharedCachedRate> = new Map([
    ['USD', { rate: '30.75', fetchedAt: nowMs - 1000, source: 'exchangerate-api' }],
    ['CAD', { rate: '0.74', fetchedAt: nowMs - 1000, source: 'exchangerate-api' }],
    ['SEK', { rate: '0.09', fetchedAt: nowMs - 31 * 60 * 1000, source: 'exchangerate-api' }],
    ['ZZZ', { rate: '1', fetchedAt: nowMs - 1000, source: 'exchangerate-api' }],
  ]);

  const usd = resolveRateToTwdFromRows('USD', [], DEFAULTS, cached, nowMs);
  assert.equal(usd?.rateToTwd, '30.75'); // 快取比系統預設新，優先採用
  assert.equal(usd?.source, 'exchangerate-api');
  assert.equal(usd?.updatedAt, nowMs - 1000);

  // 無系統預設的幣別可由有效快取提供匯率；過期 cache 不使用
  assert.equal(resolveRateToTwdFromRows('CAD', [], DEFAULTS, cached, nowMs)?.rateToTwd, '0.74');
  assert.equal(resolveRateToTwdFromRows('SEK', [], DEFAULTS, cached, nowMs), null);
  assert.equal(resolveRateToTwdFromRows('ZZZ', [], DEFAULTS, cached, nowMs), null);
});

test('resolveRateToTwdFromRows：手動匯率與較新使用者同步匯率優先於共享快取', () => {
  const nowMs = 1700000000000;
  const cached: ReadonlyMap<string, SharedCachedRate> = new Map([
    ['USD', { rate: '30', fetchedAt: nowMs, source: 'exchangerate-api' }],
    ['EUR', { rate: '35', fetchedAt: nowMs - 1000, source: 'exchangerate-api' }],
  ]);
  const manual = resolveRateToTwdFromRows('USD', [row('USD', '32', { updatedAt: nowMs - 500, isManual: true })], DEFAULTS, cached, nowMs);
  assert.equal(manual?.rateToTwd, '32');
  assert.equal(manual?.source, 'manual');

  const newerRow = resolveRateToTwdFromRows('EUR', [row('EUR', '34.5', { updatedAt: nowMs })], DEFAULTS, cached, nowMs);
  assert.equal(newerRow?.rateToTwd, '34.5');
  assert.equal(newerRow?.source, 'exchangerate-api');
});

test('resolveRateToTwdFromRows：匯率無效（0／負／非數字）時視為無資料，不得靜默沿用', () => {
  for (const bad of ['0', '-1', '', 'abc', null, 'Infinity', 'NaN']) {
    const resolved = resolveRateToTwdFromRows('USD', [{ currency: 'USD', rate_to_twd: bad as any, updated_at: 1, is_manual: 1 }], DEFAULTS);
    // 使用者列無效 → 回退系統預設（而非回傳無效匯率或 null）
    assert.equal(resolved?.source, 'default', `${JSON.stringify(bad)} 應回退系統預設`);
    assert.equal(resolved?.rateToTwd, String(DEFAULTS.USD));
  }
  // 非白名單幣別且無預設值 → null
  assert.equal(resolveRateToTwdFromRows('ZZZ', [], DEFAULTS), null);
  assert.equal(resolveRateToTwdFromRows('ZZZ', [row('ZZZ', '5')], DEFAULTS), null);
});

test('availableCurrenciesFromRows：含使用者設定幣別與系統預設幣別，且限 ISO 4217 白名單', () => {
  const available = availableCurrenciesFromRows(
    [row('SEK', '3.1'), row('ZZZ', '9'), row('BAD', '0'), row('USD', '32.1')],
    DEFAULTS,
  );
  for (const code of available) assert.equal(isValidCurrency(code), true, `${code} 應在白名單內`);
  assert.ok(available.includes('TWD'));
  assert.ok(available.includes('SEK')); // 使用者設定
  assert.ok(available.includes('JPY')); // 系統預設
  assert.ok(!available.includes('ZZZ')); // 非白名單排除
  assert.ok(!available.includes('BAD')); // 匯率無效排除
  assert.deepEqual(available, [...available].sort(), '清單須為穩定排序');
  assert.deepEqual(availableCurrenciesFromRows([], DEFAULTS), ['CNY', 'EUR', 'HKD', 'JPY', 'TWD', 'USD']);
  const cached = new Map<string, SharedCachedRate>([
    ['CAD', { rate: '0.74', fetchedAt: 1700000000000, source: 'exchangerate-api' }],
    ['SEK', { rate: '0.09', fetchedAt: 1700000000000 - 31 * 60 * 1000, source: 'exchangerate-api' }],
    ['ZZZ', { rate: '1', fetchedAt: 1700000000000, source: 'exchangerate-api' }],
  ]);
  const withCache = availableCurrenciesFromRows([], DEFAULTS, cached, 1700000000000);
  assert.ok(withCache.includes('CAD'));
  assert.ok(!withCache.includes('SEK'));
  assert.ok(!withCache.includes('ZZZ'));
});

test('buildReportCurrencyContext：TWD 基準來源為 identity，且不虛構匯率時間戳', () => {
  const ctx = buildReportCurrencyContext([], 'TWD', DEFAULTS, 1700000000000);
  assert.equal(ctx?.rate.baseCurrency, 'TWD');
  assert.equal(ctx?.rate.rateToBase, '1');
  assert.equal(ctx?.rate.source, 'identity');
  assert.equal(ctx?.rate.fetchedAt, null);
});

test('buildReportCurrencyContext：非 TWD 基準保留實際來源時間戳；系統預設明確不提供時間戳', () => {
  const withRow = buildReportCurrencyContext(
    [row('USD', '32.1', { updatedAt: 1700000000000, isManual: true })],
    'USD', DEFAULTS, 1800000000000,
  );
  assert.equal(withRow?.rate.baseCurrency, 'USD');
  assert.equal(withRow?.rate.rateToBase, '32.1');
  assert.equal(withRow?.rate.source, 'manual');
  assert.equal(withRow?.rate.fetchedAt, '2023-11-14T22:13:20.000Z');

  const viaDefault = buildReportCurrencyContext([], 'USD', DEFAULTS, 1700000000000);
  assert.equal(viaDefault?.rate.source, 'default');
  assert.equal(viaDefault?.rate.rateToBase, String(DEFAULTS.USD));
  assert.equal(viaDefault?.rate.fetchedAt, null);
});

test('buildReportCurrencyContext：無法解析匯率時回 null（呼叫端須回 400，不得回錯誤金額）', () => {
  assert.equal(buildReportCurrencyContext([], 'ZZZ', DEFAULTS), null);
  assert.equal(buildReportCurrencyContext([], 'ZZZ', {}), null);
});

test('buildReportCurrencyContext：匯率字串維持全精度（不經 float 來回轉換）', () => {
  const ctx = buildReportCurrencyContext([row('USD', '31.123456789012345678', { isManual: true })], 'USD', DEFAULTS);
  assert.equal(ctx?.rate.rateToBase, '31.123456789012345678');
  // 用該匯率換算不得因 float 轉換而失真
  assert.equal(toBaseAmountNumber('1000', ctx!.rate.rateToBase, 'USD'), new Decimal('1000').div('31.123456789012345678').toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber());
});

test('normalizeReportCurrency：3 碼英文字母以外的輸入一律回退 TWD', () => {
  assert.equal(normalizeReportCurrency('usd'), 'USD');
  assert.equal(normalizeReportCurrency(' usd '), 'USD');
  assert.equal(normalizeReportCurrency('US'), 'TWD');
  assert.equal(normalizeReportCurrency('USDX'), 'TWD');
  assert.equal(normalizeReportCurrency('123'), 'TWD');
  assert.equal(normalizeReportCurrency(null), 'TWD');
  assert.equal(normalizeReportCurrency(undefined), 'TWD');
  assert.equal(normalizeReportCurrency(''), 'TWD');
});
