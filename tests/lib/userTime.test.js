// 009-multi-timezone T010：lib/userTime.js 單元測試
// 純 Node.js（無外部框架），執行：node tests/lib/userTime.test.js
// 任一斷言失敗即 process.exit(1)。
//
// 偏移備忘（DST 期間，2026-04-30 ~ 2026-11-01）：
//   PDT = UTC - 7    (e.g. UTC 5-1 07:30Z  =  PDT 5-1 00:30)
//   Asia/Taipei = UTC + 8  (e.g. UTC 5-1 07:30Z = Taipei 5-1 15:30)
//   Pacific/Auckland NZST = UTC + 12 / NZDT = UTC + 13

const assert = require('node:assert/strict');
const ut = require('../../lib/userTime');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓', name);
    pass++;
  } catch (e) {
    console.error('  ✗', name);
    console.error('    ', e.message);
    fail++;
  }
}

// ─── isValidIanaTimezone ───
console.log('isValidIanaTimezone:');
test('正例 Asia/Taipei', () => assert.equal(ut.isValidIanaTimezone('Asia/Taipei'), true));
test('正例 America/Los_Angeles', () => assert.equal(ut.isValidIanaTimezone('America/Los_Angeles'), true));
test('正例 Europe/London', () => assert.equal(ut.isValidIanaTimezone('Europe/London'), true));
test('正例 Pacific/Auckland', () => assert.equal(ut.isValidIanaTimezone('Pacific/Auckland'), true));
test('正例 UTC', () => assert.equal(ut.isValidIanaTimezone('UTC'), true));
test('反例 PST', () => assert.equal(ut.isValidIanaTimezone('PST'), false));
test('反例 UTC+8', () => assert.equal(ut.isValidIanaTimezone('UTC+8'), false));
test('反例 空字串', () => assert.equal(ut.isValidIanaTimezone(''), false));
test('反例 null', () => assert.equal(ut.isValidIanaTimezone(null), false));

// ─── todayInUserTz / partsInTz：用 FAKE_NOW 鎖定瞬時 ───
console.log('todayInUserTz / partsInTz：');
// UTC 5-1 06:30Z  =  PDT 4-30 23:30  /  Taipei 5-1 14:30
ut.__setNowMs(new Date('2026-05-01T06:30:00Z').getTime());
test('PDT 4-30 23:30 → 2026-04-30', () => {
  assert.equal(ut.todayInUserTz('America/Los_Angeles'), '2026-04-30');
});
test('Asia/Taipei 同瞬時 5-1 14:30 → 2026-05-01', () => {
  assert.equal(ut.todayInUserTz('Asia/Taipei'), '2026-05-01');
});
// UTC 5-1 07:30Z  =  PDT 5-1 00:30
ut.__setNowMs(new Date('2026-05-01T07:30:00Z').getTime());
test('PDT 5-1 00:30 → 2026-05-01', () => {
  assert.equal(ut.todayInUserTz('America/Los_Angeles'), '2026-05-01');
});

// 5 組 DST 邊界對照（真實時刻 → 期望日期）
ut.__setNowMs(new Date('2026-03-08T10:30:00Z').getTime()); // 春跳當天 03:30 PDT（02:00 跳到 03:00）
test('PDT 春跳當天 03:30 → 2026-03-08', () => {
  assert.equal(ut.todayInUserTz('America/Los_Angeles'), '2026-03-08');
});
ut.__setNowMs(new Date('2026-11-01T08:30:00Z').getTime()); // 秋重 01:30 第一次 PDT
test('PDT 秋重 01:30 → 2026-11-01', () => {
  assert.equal(ut.todayInUserTz('America/Los_Angeles'), '2026-11-01');
});
ut.__setNowMs(new Date('2026-04-04T13:30:00Z').getTime()); // Pacific/Auckland 4-5 02:30 NZDT (UTC+13)
test('Pacific/Auckland 對照 → 2026-04-05', () => {
  assert.equal(ut.todayInUserTz('Pacific/Auckland'), '2026-04-05');
});

// partsInTz 與 Intl.DateTimeFormat 結果一致
ut.__setNowMs(null);
const refMs = new Date('2026-04-30T07:30:00Z').getTime(); // Taipei 4-30 15:30 / PDT 4-30 00:30
test('partsInTz Asia/Taipei refMs', () => {
  const p = ut.partsInTz('Asia/Taipei', refMs);
  assert.deepEqual(p, { year: 2026, month: 4, day: 30, hour: 15, minute: 30, weekday: 4 });
});
test('partsInTz America/Los_Angeles refMs', () => {
  const p = ut.partsInTz('America/Los_Angeles', refMs);
  assert.deepEqual(p, { year: 2026, month: 4, day: 30, hour: 0, minute: 30, weekday: 4 });
});

// ─── monthInUserTz ───
console.log('monthInUserTz：');
// UTC 5-1 06:30Z  =  PDT 4-30 23:30 / Taipei 5-1 14:30
ut.__setNowMs(new Date('2026-05-01T06:30:00Z').getTime());
test('PDT 4-30 23:30 → 2026-04', () => {
  assert.equal(ut.monthInUserTz('America/Los_Angeles'), '2026-04');
});
test('Taipei 同瞬時 5-1 14:30 → 2026-05', () => {
  assert.equal(ut.monthInUserTz('Asia/Taipei'), '2026-05');
});
// UTC 5-1 07:30Z  =  PDT 5-1 00:30
ut.__setNowMs(new Date('2026-05-01T07:30:00Z').getTime());
test('PDT 5-1 00:30 → 2026-05', () => {
  assert.equal(ut.monthInUserTz('America/Los_Angeles'), '2026-05');
});
// UTC 12-31 16:30Z  =  Taipei 1-1 00:30
ut.__setNowMs(new Date('2026-12-31T16:30:00Z').getTime());
test('Taipei 跨年 → 2027-01', () => {
  assert.equal(ut.monthInUserTz('Asia/Taipei'), '2027-01');
});
test('monthInUserTz 接受顯式 ms 參數', () => {
  const ms = new Date('2025-06-15T00:00:00Z').getTime();
  assert.equal(ut.monthInUserTz('Asia/Taipei', ms), '2025-06');
});

// ─── isFutureDateForTz ───
console.log('isFutureDateForTz：');
// UTC 5-1 07:30Z  =  PDT 5-1 00:30 / Taipei 5-1 15:30
ut.__setNowMs(new Date('2026-05-01T07:30:00Z').getTime());
test('PDT 過去日 4-30 → false', () => {
  assert.equal(ut.isFutureDateForTz('America/Los_Angeles', '2026-04-30'), false);
});
test('PDT 當天 5-1 → false', () => {
  assert.equal(ut.isFutureDateForTz('America/Los_Angeles', '2026-05-01'), false);
});
test('PDT 未來日 5-2 → true', () => {
  assert.equal(ut.isFutureDateForTz('America/Los_Angeles', '2026-05-02'), true);
});
test('Taipei 過去日 4-30 → false', () => {
  assert.equal(ut.isFutureDateForTz('Asia/Taipei', '2026-04-30'), false);
});
test('Taipei 當天 5-1 → false', () => {
  assert.equal(ut.isFutureDateForTz('Asia/Taipei', '2026-05-01'), false);
});
test('Taipei 未來日 5-2 → true', () => {
  assert.equal(ut.isFutureDateForTz('Asia/Taipei', '2026-05-02'), true);
});
// 跨日臨界：UTC 5-1 06:30Z = PDT 4-30 23:30 / Taipei 5-1 14:30
// '2026-05-01' 對 PDT 是「未來」對 Taipei 是「今天」
ut.__setNowMs(new Date('2026-05-01T06:30:00Z').getTime());
test('臨界 PDT 4-30 23:30：5-1 → true（未來）', () => {
  assert.equal(ut.isFutureDateForTz('America/Los_Angeles', '2026-05-01'), true);
});
test('臨界 Taipei 5-1 14:30：5-1 → false（今天）', () => {
  assert.equal(ut.isFutureDateForTz('Asia/Taipei', '2026-05-01'), false);
});
ut.__setNowMs(null);

// ─── toIsoUtc ───
console.log('toIsoUtc：');
test('ms → .sssZ', () => {
  const out = ut.toIsoUtc(1745000000000);
  assert.match(out, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
test('Date → .sssZ', () => {
  const out = ut.toIsoUtc(new Date('2026-04-29T07:30:00Z'));
  assert.equal(out, '2026-04-29T07:30:00.000Z');
});
test('SQLite default 字串（無 T、無 Z）→ 補 T 和 Z', () => {
  assert.equal(ut.toIsoUtc('2026-04-29 07:30:00'), '2026-04-29T07:30:00.000Z');
});
test('已是 .sssZ → 不變', () => {
  assert.equal(ut.toIsoUtc('2026-04-29T07:30:00.000Z'), '2026-04-29T07:30:00.000Z');
});
test('無毫秒 + Z → 補 .000', () => {
  assert.equal(ut.toIsoUtc('2026-04-29T07:30:00Z'), '2026-04-29T07:30:00.000Z');
});
test('+08:00 → throw', () => {
  assert.throws(() => ut.toIsoUtc('2026-04-29T07:30:00+08:00'), /偏移/);
});
test('invalid → throw', () => {
  assert.throws(() => ut.toIsoUtc('not-a-date'));
});
test('null → throw', () => {
  assert.throws(() => ut.toIsoUtc(null));
});
test('undefined → throw', () => {
  assert.throws(() => ut.toIsoUtc(undefined));
});

// ─── isValidIsoDate ───
console.log('isValidIsoDate：');
test('合法 2026-04-29', () => assert.equal(ut.isValidIsoDate('2026-04-29'), true));
test('合法 2024-02-29（閏年）', () => assert.equal(ut.isValidIsoDate('2024-02-29'), true));
test('月日越界 2026-02-30', () => assert.equal(ut.isValidIsoDate('2026-02-30'), false));
test('月日越界 2026-13-01', () => assert.equal(ut.isValidIsoDate('2026-13-01'), false));
test('月日越界 2026-04-31', () => assert.equal(ut.isValidIsoDate('2026-04-31'), false));
test('非 ISO 2026/04/29', () => assert.equal(ut.isValidIsoDate('2026/04/29'), false));
test('非 ISO 04-29-2026', () => assert.equal(ut.isValidIsoDate('04-29-2026'), false));
test('非 ISO 2026-4-29（無 padding）', () => assert.equal(ut.isValidIsoDate('2026-4-29'), false));
test('null → false', () => assert.equal(ut.isValidIsoDate(null), false));
test('undefined → false', () => assert.equal(ut.isValidIsoDate(undefined), false));
test('20260429（數字）→ false', () => assert.equal(ut.isValidIsoDate(20260429), false));

// ─── 結算 ───
console.log('');
console.log(`結果：${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
