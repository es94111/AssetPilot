// 009 T060：FR-015 歷史不變式驗證
// 範圍：升級前後 transactions 表的 date 欄位 baseline 完全一致
// 做法：以 in-memory sql.js 建表 + 寫入歷史測試資料 → 跑 009 migration → 驗證 date 不變
// 執行：node tests/integration/fr015-transactions-historical.test.js

const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

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

  // 模擬升級前的 schema（簡化版）
  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT
  )`);
  db.run(`CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT,
    amount INTEGER,
    date TEXT NOT NULL
  )`);

  // 寫入「升級前歷史資料」
  db.run("INSERT INTO users (id) VALUES ('u1')");
  const sampleDates = [
    '2024-01-01', '2024-12-31', '2025-06-15', '2026-02-29', // 閏年
    '2026-04-30', '2026-05-01', '2023-07-04',
  ];
  sampleDates.forEach((d, i) => {
    db.run("INSERT INTO transactions (id, user_id, type, amount, date) VALUES (?, ?, ?, ?, ?)",
      [`tx-${i}`, 'u1', 'expense', 100 * (i + 1), d]);
  });

  // 計算 baseline
  const baseline = db.exec("SELECT COUNT(*) AS c, MIN(date) AS mn, MAX(date) AS mx, SUM(LENGTH(date)) AS slen FROM transactions")[0].values[0];
  const baselineDates = db.exec("SELECT id, date FROM transactions ORDER BY id")[0].values
    .map(r => `${r[0]}=${r[1]}`).join(',');

  console.log('Baseline before 009 migration:');
  console.log(`  count=${baseline[0]} min=${baseline[1]} max=${baseline[2]} sumLen=${baseline[3]}`);
  console.log(`  dates: ${baselineDates}`);

  // 跑 009 migration（複製自 server.js）
  console.log('\nApplying 009 migration...');
  db.run("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'");
  db.run("UPDATE users SET timezone = 'Asia/Taipei' WHERE timezone IS NULL OR timezone = ''");
  db.run(`CREATE TABLE IF NOT EXISTS monthly_report_send_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    year_month TEXT NOT NULL,
    schedule_id TEXT,
    sent_at_utc TEXT NOT NULL,
    send_status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT DEFAULT '',
    UNIQUE(user_id, year_month)
  )`);

  // 驗證 transactions 表完全不變
  console.log('\nFR-015 不變式驗證：');
  const after = db.exec("SELECT COUNT(*) AS c, MIN(date) AS mn, MAX(date) AS mx, SUM(LENGTH(date)) AS slen FROM transactions")[0].values[0];
  const afterDates = db.exec("SELECT id, date FROM transactions ORDER BY id")[0].values
    .map(r => `${r[0]}=${r[1]}`).join(',');

  await test('transactions COUNT(*) 不變', () => assert.equal(after[0], baseline[0]));
  await test('transactions MIN(date) 不變', () => assert.equal(after[1], baseline[1]));
  await test('transactions MAX(date) 不變', () => assert.equal(after[2], baseline[2]));
  await test('transactions SUM(LENGTH(date)) 不變', () => assert.equal(after[3], baseline[3]));
  await test('每一筆 transactions.date 完全相同（逐筆比對）', () => {
    assert.equal(afterDates, baselineDates);
  });

  // 驗證 transactions 表 schema 沒被加欄位
  await test('transactions 表 schema 不被 009 migration 觸碰', () => {
    const cols = db.exec("PRAGMA table_info(transactions)")[0].values.map(r => r[1]);
    assert.deepEqual(cols.sort(), ['id', 'user_id', 'type', 'amount', 'date'].sort());
  });

  console.log('');
  console.log(`結果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
})();
