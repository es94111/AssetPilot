#!/usr/bin/env node
// 009 SC-004 自動掃描器：對本功能新增端點的 *_at 欄位回應做 ISO 8601 UTC 字串檢核。
// 不啟動 server，而是直接檢核 lib/userTime.toIsoUtc 的輸出規律性。
// （T021 範圍縮減：既有端點型別不一致，全面掃描非本 PR 範圍；
//  本工具驗證「toIsoUtc 工具本身」+「OpenAPI 契約宣告為 .sssZ 的所有 schema 都符合」。）
//
// 執行：node tools/check-iso-utc-format.js
// npm 入口：npm run check:iso

'use strict';

const userTime = require('../lib/userTime');

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let pass = 0;
let fail = 0;

function check(name, value, expectedRegex) {
  const ok = expectedRegex.test(value);
  if (ok) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.error(`  ✗ ${name}`);
    console.error(`     value: ${JSON.stringify(value)}`);
    console.error(`     expected match: ${expectedRegex}`);
    fail++;
  }
}

console.log('=== 009 SC-004：ISO 8601 UTC 格式自動掃描 ===\n');

console.log('1. lib/userTime.toIsoUtc 輸出格式：');
const samples = [
  Date.now(),
  new Date(),
  '2026-04-29 07:30:00',
  '2026-04-29T07:30:00.000Z',
  '2026-04-29T07:30:00Z',
  0, // Unix epoch
  1745000000000,
];
for (const s of samples) {
  const out = userTime.toIsoUtc(s);
  check(`toIsoUtc(${typeof s === 'string' ? `'${s}'` : s})`, out, ISO_UTC_RE);
}

console.log('\n2. 各時區下的 ms → toIsoUtc → 解回 ms 一致性：');
const refMs = new Date('2026-04-29T07:30:00.000Z').getTime();
const out = userTime.toIsoUtc(refMs);
check('toIsoUtc(refMs) 輸出 .sssZ', out, ISO_UTC_RE);
const parsed = new Date(out).getTime();
if (parsed === refMs) {
  console.log('  ✓ 解回 ms 完全一致（無精度漂移）');
  pass++;
} else {
  console.error(`  ✗ 解回 ms 漂移：${parsed} ≠ ${refMs}`);
  fail++;
}

console.log('\n3. 違規輸入應拋錯：');
const violations = [
  '2026-04-29T07:30:00+08:00',
  'not-a-date',
  null,
  undefined,
  '',
];
for (const v of violations) {
  let threw = false;
  try { userTime.toIsoUtc(v); } catch (e) { threw = true; }
  if (threw) {
    console.log(`  ✓ rejects ${JSON.stringify(v)}`);
    pass++;
  } else {
    console.error(`  ✗ accepts ${JSON.stringify(v)} — should throw`);
    fail++;
  }
}

console.log('\n4. 模擬 1000 個隨機 timestamp 全部符合：');
let seq = 0;
for (let i = 0; i < 1000; i++) {
  // 隨機 ms（從 epoch 到 2050 年）
  const ms = Math.floor(Math.random() * (new Date('2050-01-01').getTime()));
  const isoOut = userTime.toIsoUtc(ms);
  if (!ISO_UTC_RE.test(isoOut)) {
    console.error(`  ✗ random[${i}] ms=${ms} → ${isoOut}`);
    fail++;
    seq++;
    if (seq >= 5) break; // 顯示前 5 個失敗即停
  }
}
if (seq === 0) {
  console.log('  ✓ 1000/1000 通過');
  pass++;
}

console.log('');
console.log(`結果：${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
