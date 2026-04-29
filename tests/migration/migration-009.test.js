// 009-multi-timezone T011：Migration 自動化測試
// 在 in-memory sql.js DB 上跑 009 migration 的 DDL，驗證：
// 1. users.timezone 欄位存在、NOT NULL、DEFAULT 'Asia/Taipei'
// 2. monthly_report_send_log 表存在
// 3. UNIQUE(user_id, year_month) 約束生效（重複 INSERT 失敗）
// 執行：node tests/migration/migration-009.test.js

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

  // 模擬 server.js 既有 users 表（簡化版，僅必要欄位）
  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    created_at TEXT,
    is_active INTEGER DEFAULT 1
  )`);
  db.run("INSERT INTO users (id, email, display_name, created_at) VALUES ('u1', 'a@b.c', 'Alice', '2026-04-01T00:00:00Z')");
  db.run("INSERT INTO users (id, email, display_name, created_at) VALUES ('u2', 'b@b.c', 'Bob', '2026-04-15T00:00:00Z')");

  // 跑 009 migration（複製自 server.js 對應區塊）
  console.log('Running 009 migration on in-memory DB...');
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
  db.run("CREATE INDEX IF NOT EXISTS idx_monthly_report_send_log_user ON monthly_report_send_log(user_id, year_month DESC)");

  // ─── 測試 ───
  console.log('users.timezone：');
  await test('users 表含 timezone 欄位', () => {
    const cols = db.exec("PRAGMA table_info(users)")[0].values;
    const tzCol = cols.find(c => c[1] === 'timezone');
    assert.ok(tzCol, 'timezone 欄位不存在');
  });
  await test('timezone 欄位 NOT NULL', () => {
    const cols = db.exec("PRAGMA table_info(users)")[0].values;
    const tzCol = cols.find(c => c[1] === 'timezone');
    // PRAGMA table_info 第 4 欄 (index 3) 是 notnull
    assert.equal(tzCol[3], 1, `notnull = ${tzCol[3]}`);
  });
  await test("timezone DEFAULT 'Asia/Taipei'", () => {
    const cols = db.exec("PRAGMA table_info(users)")[0].values;
    const tzCol = cols.find(c => c[1] === 'timezone');
    // 第 5 欄 (index 4) 是 dflt_value
    assert.match(String(tzCol[4]), /Asia\/Taipei/);
  });
  await test('既有列被 DEFAULT 填為 Asia/Taipei', () => {
    const rows = db.exec("SELECT timezone FROM users")[0].values;
    assert.ok(rows.length === 2);
    rows.forEach(r => assert.equal(r[0], 'Asia/Taipei'));
  });
  await test('既有列無 NULL / 空字串 timezone', () => {
    const empty = db.exec("SELECT COUNT(*) FROM users WHERE timezone IS NULL OR timezone = ''")[0].values[0][0];
    assert.equal(empty, 0);
  });

  console.log('monthly_report_send_log：');
  await test('表存在', () => {
    const tbls = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_report_send_log'")[0].values;
    assert.equal(tbls.length, 1);
  });
  await test('UNIQUE(user_id, year_month) 約束生效', () => {
    db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, sent_at_utc) VALUES ('m1', 'u1', '2026-04', '2026-05-01T00:00:00.000Z')");
    let threw = false;
    try {
      db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, sent_at_utc) VALUES ('m2', 'u1', '2026-04', '2026-05-01T00:00:01.000Z')");
    } catch (e) {
      threw = true;
      assert.match(String(e.message), /UNIQUE|constraint/i);
    }
    assert.equal(threw, true, '第二次 INSERT 應觸發 UNIQUE 衝突但未');
  });
  await test('不同 user 同 year_month 可成功插入', () => {
    db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, sent_at_utc) VALUES ('m3', 'u2', '2026-04', '2026-05-01T00:00:02.000Z')");
    const cnt = db.exec("SELECT COUNT(*) FROM monthly_report_send_log WHERE year_month = '2026-04'")[0].values[0][0];
    assert.equal(cnt, 2);
  });
  await test('同 user 不同 year_month 可成功插入', () => {
    db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, sent_at_utc) VALUES ('m4', 'u1', '2026-05', '2026-06-01T00:00:00.000Z')");
    const cnt = db.exec("SELECT COUNT(*) FROM monthly_report_send_log WHERE user_id = 'u1'")[0].values[0][0];
    assert.equal(cnt, 2);
  });
  await test('idx_monthly_report_send_log_user 索引存在', () => {
    const idx = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_monthly_report_send_log_user'")[0].values;
    assert.equal(idx.length, 1);
  });
  await test('send_status DEFAULT success', () => {
    db.run("INSERT INTO monthly_report_send_log (id, user_id, year_month, sent_at_utc) VALUES ('m5', 'u2', '2026-05', '2026-06-01T00:00:03.000Z')");
    const status = db.exec("SELECT send_status FROM monthly_report_send_log WHERE id = 'm5'")[0].values[0][0];
    assert.equal(status, 'success');
  });

  console.log('');
  console.log(`結果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
})();
