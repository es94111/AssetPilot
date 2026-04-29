#!/usr/bin/env node
// 009 T061：SC-003 SLA 取樣統計
// 範圍：模擬 100 個帳號分布 ≥ 10 個時區，跑一個月份的 scheduler tick，
// 計算每筆「sent_at_utc 對應該使用者當地 1 號 00:00 UTC」的延遲分布（min / P50 / P95 / max）。
// SC-003 要求：100 名隨機抽樣使用者 ≥ 95% 落在 0:00-0:30（即 P95 ≤ 30 分鐘）。
//
// 執行：node tools/sla-monthly-report.js
// npm 入口：npm run check:sla

'use strict';

const userTime = require('../lib/userTime');

const TZ_POOL = [
  'America/Los_Angeles', 'America/New_York', 'UTC',
  'Europe/London', 'Asia/Taipei', 'Asia/Tokyo',
  'Asia/Singapore', 'Pacific/Auckland', 'America/Asuncion',
  'America/Sao_Paulo', 'Europe/Paris', 'Australia/Sydney',
];

const N_USERS = 100;
const TICK_MS = 5 * 60 * 1000; // 5 分鐘心跳
const MONTH_MS = 31 * 24 * 60 * 60 * 1000; // 模擬 31 天
const SIMULATION_START = new Date('2026-04-30T00:00:00Z').getTime(); // 跨越 4-30 → 5-31

console.log('=== 009 T061：SC-003 SLA 取樣統計 ===');
console.log(`帳號數：${N_USERS}`);
console.log(`時區池（${TZ_POOL.length}）：${TZ_POOL.join(', ')}`);
console.log(`模擬期間：${new Date(SIMULATION_START).toISOString()} + 31 天，每 ${TICK_MS / 60000} 分鐘心跳\n`);

// 為每個 user 隨機分配 timezone
const users = [];
for (let i = 0; i < N_USERS; i++) {
  users.push({
    id: `u${i}`,
    timezone: TZ_POOL[i % TZ_POOL.length],
    sentMonths: new Set(),
    sendEvents: [],
  });
}

// 模擬 scheduler tick
const ticks = Math.floor(MONTH_MS / TICK_MS);
console.log(`執行 ${ticks} 次 tick...`);

let totalSends = 0;
for (let t = 0; t < ticks; t++) {
  const nowMs = SIMULATION_START + t * TICK_MS;
  for (const u of users) {
    const local = userTime.partsInTz(u.timezone, nowMs);
    // 觸發條件：local day=1, hour=0（month=monthly schedule, day_of_month=1, hour=0）
    if (local.day !== 1 || local.hour !== 0) continue;
    const ym = `${local.year}-${String(local.month).padStart(2, '0')}`;
    if (u.sentMonths.has(ym)) continue; // dedup
    u.sentMonths.add(ym);
    // 計算「該使用者當地該月 1 號 00:00 對應的 UTC ms」（理想觸發時刻）
    const idealMs = computeLocalDayStartUtcMs(u.timezone, ym + '-01');
    const delayMin = (nowMs - idealMs) / 60000;
    u.sendEvents.push({ ym, delayMin, sentAt: nowMs, idealAt: idealMs });
    totalSends++;
  }
}

console.log(`總寄送次數：${totalSends}（不重寄）\n`);

// 統計
const allDelays = [];
for (const u of users) {
  for (const ev of u.sendEvents) {
    allDelays.push(ev.delayMin);
  }
}
allDelays.sort((a, b) => a - b);

function pct(p) {
  if (allDelays.length === 0) return NaN;
  const idx = Math.min(allDelays.length - 1, Math.floor(allDelays.length * p / 100));
  return allDelays[idx];
}

const p50 = pct(50);
const p95 = pct(95);
const p99 = pct(99);
const min = allDelays[0];
const max = allDelays[allDelays.length - 1];
const avg = allDelays.reduce((s, x) => s + x, 0) / allDelays.length;

console.log('延遲分布（單位：分鐘）：');
console.log(`  min:   ${min?.toFixed(2)}`);
console.log(`  avg:   ${avg.toFixed(2)}`);
console.log(`  P50:   ${p50.toFixed(2)}`);
console.log(`  P95:   ${p95.toFixed(2)}`);
console.log(`  P99:   ${p99.toFixed(2)}`);
console.log(`  max:   ${max?.toFixed(2)}`);

console.log('\nSC-003 達成判定（P95 ≤ 30 分鐘）：');
if (p95 <= 30) {
  console.log(`  ✓ PASS — P95 = ${p95.toFixed(2)} 分鐘`);
  process.exit(0);
} else {
  console.error(`  ✗ FAIL — P95 = ${p95.toFixed(2)} 分鐘 > 30 分鐘`);
  process.exit(1);
}

// ─── helpers ───
function computeLocalDayStartUtcMs(tz, ymd) {
  // 二分／反推：以 UTC midnight 為起點，依該 tz 偏移調整
  const [y, m, d] = ymd.split('-').map(s => parseInt(s, 10));
  const utcMid = Date.UTC(y, m - 1, d, 0, 0, 0);
  const p = userTime.partsInTz(tz, utcMid);
  let offsetMin = p.hour * 60 + p.minute;
  const localYmd = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  if (localYmd < ymd) offsetMin -= 24 * 60;
  else if (localYmd > ymd) offsetMin += 24 * 60;
  return utcMid - offsetMin * 60 * 1000;
}
