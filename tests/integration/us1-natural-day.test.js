// 009-multi-timezone US1 整合測試（T012 + T013 + T014）
// 範圍：以 in-memory sql.js + lib/userTime 模擬 PST 23:30 / 00:30 場景，
// 驗證 transaction.date 歸屬、未來日判斷、Asia/Taipei regression-free。
// 執行：node tests/integration/us1-natural-day.test.js

const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const ut = require('../../lib/userTime');

let pass = 0;
let fail = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log('  ✓', name); pass++; })
    .catch(e => { console.error('  ✗', name); console.error('    ', e.message); fail++; });
}

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // 建立簡化版 users / transactions schema
  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
    is_active INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    note TEXT
  )`);

  // 兩個測試使用者
  db.run("INSERT INTO users (id, email, display_name, timezone) VALUES ('u-tw', 'tw@test', 'TaipeiUser', 'Asia/Taipei')");
  db.run("INSERT INTO users (id, email, display_name, timezone) VALUES ('u-pst', 'pst@test', 'PSTUser', 'America/Los_Angeles')");

  // 模擬「PST 4-30 23:30」=「UTC 5-1 06:30」=「Asia/Taipei 5-1 14:30」
  const ms_PST_4_30_23_30 = new Date('2026-05-01T06:30:00Z').getTime();
  // 模擬「PST 5-1 00:30」=「UTC 5-1 07:30」=「Asia/Taipei 5-1 15:30」
  const ms_PST_5_1_00_30 = new Date('2026-05-01T07:30:00Z').getTime();

  // ─── User Story 1 Acceptance Scenario 1 ───
  console.log('Scenario 1: PST 23:30 新增當日支出 → 應出現於「今日」、不出現於「未來」');
  ut.__setNowMs(ms_PST_4_30_23_30);
  const todayPst = ut.todayInUserTz('America/Los_Angeles');
  await test('PST 當地「今天」 = 2026-04-30', () => {
    assert.equal(todayPst, '2026-04-30');
  });
  // 模擬 POST /api/transactions（未指定 date → 後端套使用者今天）
  const insertDate = todayPst; // T020 預設行為
  db.run("INSERT INTO transactions (id, user_id, type, amount, date, note) VALUES ('t1', 'u-pst', 'expense', 100, ?, 'PST 晚餐')",
    [insertDate]);
  await test('交易 date = PST 4-30（被歸入當地當日）', () => {
    const row = db.exec("SELECT date FROM transactions WHERE id = 't1'")[0].values[0];
    assert.equal(row[0], '2026-04-30');
  });
  await test('「今日」查詢含本筆', () => {
    const rows = db.exec("SELECT note FROM transactions WHERE user_id = 'u-pst' AND date = ?", [todayPst])[0].values;
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0], 'PST 晚餐');
  });
  await test('未來日判斷：date 為「今天」不算未來', () => {
    assert.equal(ut.isFutureDateForTz('America/Los_Angeles', insertDate), false);
  });

  // ─── User Story 1 Acceptance Scenario 2 ───
  console.log('Scenario 2: 快進到 PST 5-1 00:30 → 上一筆進「昨日」、4 月小計仍含此筆');
  ut.__setNowMs(ms_PST_5_1_00_30);
  const newToday = ut.todayInUserTz('America/Los_Angeles');
  await test('「今天」改為 2026-05-01', () => assert.equal(newToday, '2026-05-01'));
  await test('原 4-30 那筆不在「今日」', () => {
    const rows = db.exec("SELECT note FROM transactions WHERE user_id = 'u-pst' AND date = ?", [newToday])[0];
    assert.equal(rows == null || rows.values.length === 0, true);
  });
  await test('原 4-30 那筆仍在「昨日」', () => {
    const rows = db.exec("SELECT note FROM transactions WHERE user_id = 'u-pst' AND date = '2026-04-30'")[0].values;
    assert.equal(rows.length, 1);
  });
  await test('4 月小計仍含此筆', () => {
    const rows = db.exec("SELECT SUM(amount) FROM transactions WHERE user_id = 'u-pst' AND date LIKE '2026-04%'")[0].values;
    assert.equal(rows[0][0], 100);
  });

  // ─── User Story 1 Acceptance Scenario 3 (Asia/Taipei regression-free) ───
  console.log('Scenario 3: Asia/Taipei 使用者完全不變（regression-free）');
  // 設定 FAKE_NOW 為某 Taipei 工作日 13:00 = UTC 5:00
  ut.__setNowMs(new Date('2026-05-15T05:00:00Z').getTime());
  const todayTw = ut.todayInUserTz('Asia/Taipei');
  await test('Taipei 「今天」 = 2026-05-15', () => assert.equal(todayTw, '2026-05-15'));
  db.run("INSERT INTO transactions (id, user_id, type, amount, date, note) VALUES ('t2', 'u-tw', 'expense', 200, ?, 'TW 午餐')", [todayTw]);
  await test('Taipei 使用者交易 date = 2026-05-15', () => {
    const row = db.exec("SELECT date FROM transactions WHERE id = 't2'")[0].values[0];
    assert.equal(row[0], '2026-05-15');
  });
  // 模擬 lib/taipeiTime wrapper 行為（向後相容）
  const tp = require('../../lib/taipeiTime');
  await test('lib/taipeiTime.todayInTaipei() 仍對 Asia/Taipei 正確（thin wrapper）', () => {
    assert.equal(tp.todayInTaipei(), '2026-05-15');
  });
  await test('lib/taipeiTime.isFutureDate() 行為不變', () => {
    assert.equal(tp.isFutureDate('2026-05-16'), true);
    assert.equal(tp.isFutureDate('2026-05-15'), false);
    assert.equal(tp.isFutureDate('2026-05-14'), false);
  });

  // ─── User Story 1 Acceptance Scenario 4: created_at 同瞬時兩使用者 ───
  console.log('Scenario 4: 同 UTC 瞬時、不同 user.tz 顯示出不同當地時間');
  const sharedUtc = '2026-04-30T07:30:00.000Z'; // Taipei 4-30 15:30 / PDT 4-30 00:30
  const refMs = new Date(sharedUtc).getTime();
  await test('Taipei tz 顯示 4-30 15:30', () => {
    const p = ut.partsInTz('Asia/Taipei', refMs);
    assert.equal(`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')} ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`, '2026-04-30 15:30');
  });
  await test('PDT tz 顯示 4-30 00:30', () => {
    const p = ut.partsInTz('America/Los_Angeles', refMs);
    assert.equal(`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')} ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`, '2026-04-30 00:30');
  });
  await test('toIsoUtc 從同一 ms 一致輸出 .sssZ', () => {
    assert.equal(ut.toIsoUtc(refMs), sharedUtc);
  });

  // ─── 結算 ───
  ut.__setNowMs(null);
  console.log('');
  console.log(`結果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
})();
