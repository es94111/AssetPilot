// 009-multi-timezone US2 整合測試（T026 / T027 / T028）
// 範圍：以 in-memory sql.js 模擬 PATCH /api/users/me/timezone 的副作用：
//   - 合法 IANA → 200 + UPDATE + audit log 多一列
//   - 非法 → 400 + 原值不變 + audit log 不變
//   - no-op（同值）→ 200 + audit log 不變
// 不啟動 HTTP；模擬 handler 內部邏輯（與 server.js T030 等價）。
// 執行：node tests/integration/us2-users-me-timezone.test.js

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

  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
    is_active INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE data_operation_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    result TEXT NOT NULL,
    is_admin_operation INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}'
  )`);
  db.run("INSERT INTO users (id, email, display_name, timezone) VALUES ('u-tw', 'tw@test', 'Alice', 'Asia/Taipei')");

  function getRow(id) {
    return db.exec("SELECT timezone FROM users WHERE id = ?", [id])[0].values[0][0];
  }
  function auditCount(action) {
    return db.exec("SELECT COUNT(*) FROM data_operation_audit_log WHERE action = ?", [action])[0].values[0][0];
  }
  function auditLast() {
    const rows = db.exec("SELECT metadata FROM data_operation_audit_log ORDER BY timestamp DESC LIMIT 1");
    if (!rows[0]) return null;
    return JSON.parse(rows[0].values[0][0]);
  }

  // 模擬 T030 PATCH handler 內部邏輯
  function simulatePatch(userId, body, req = { ip: '127.0.0.1', userAgent: 'test' }) {
    const { timezone, source } = body || {};
    if (!ut.isValidIanaTimezone(timezone)) {
      return { status: 400, body: { error: '時區格式無效', code: 'ValidationError', field: 'timezone' } };
    }
    const u = db.exec("SELECT timezone FROM users WHERE id = ?", [userId])[0];
    if (!u) return { status: 404, body: { error: 'User not found', code: 'NotFound' } };
    const prev = u.values[0][0] || 'Asia/Taipei';
    if (prev !== timezone) {
      db.run("UPDATE users SET timezone = ? WHERE id = ?", [timezone, userId]);
      const src = (source === 'manual' || source === 'auto-detect') ? source : 'manual';
      db.run(
        "INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          'aud-' + Math.random().toString(36).slice(2, 10),
          userId, 'user', 'user.timezone.update',
          req.ip, req.userAgent,
          new Date().toISOString(), 'success', 0,
          JSON.stringify({ from: prev, to: timezone, source: src })
        ]
      );
    }
    return { status: 200, body: { id: userId, timezone } };
  }

  // ─── 合法 IANA ───
  console.log('合法 IANA：');
  await test('PATCH Asia/Tokyo → 200', () => {
    const r = simulatePatch('u-tw', { timezone: 'Asia/Tokyo', source: 'manual' });
    assert.equal(r.status, 200);
    assert.equal(r.body.timezone, 'Asia/Tokyo');
  });
  await test('UPDATE 後 DB 值已變', () => {
    assert.equal(getRow('u-tw'), 'Asia/Tokyo');
  });
  await test('audit log 多一列 user.timezone.update', () => {
    assert.equal(auditCount('user.timezone.update'), 1);
  });
  await test('audit metadata 為合法 JSON 含 from/to/source', () => {
    const meta = auditLast();
    assert.deepEqual(meta, { from: 'Asia/Taipei', to: 'Asia/Tokyo', source: 'manual' });
  });

  // ─── 第二次合法變更 source=auto-detect ───
  await test('PATCH America/Los_Angeles source=auto-detect → 200', () => {
    const r = simulatePatch('u-tw', { timezone: 'America/Los_Angeles', source: 'auto-detect' });
    assert.equal(r.status, 200);
  });
  await test('audit metadata source = auto-detect', () => {
    const meta = auditLast();
    assert.equal(meta.source, 'auto-detect');
    assert.equal(meta.from, 'Asia/Tokyo');
    assert.equal(meta.to, 'America/Los_Angeles');
  });
  await test('audit log 累積到 2 列', () => {
    assert.equal(auditCount('user.timezone.update'), 2);
  });

  // ─── 非法 IANA ───
  console.log('非法 IANA：');
  await test('PATCH PST → 400', () => {
    const r = simulatePatch('u-tw', { timezone: 'PST' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'ValidationError');
    assert.equal(r.body.field, 'timezone');
  });
  await test('PATCH UTC+8 → 400', () => {
    const r = simulatePatch('u-tw', { timezone: 'UTC+8' });
    assert.equal(r.status, 400);
  });
  await test('PATCH 空字串 → 400', () => {
    const r = simulatePatch('u-tw', { timezone: '' });
    assert.equal(r.status, 400);
  });
  await test('PATCH null → 400', () => {
    const r = simulatePatch('u-tw', { timezone: null });
    assert.equal(r.status, 400);
  });
  await test('PATCH 缺欄位 → 400', () => {
    const r = simulatePatch('u-tw', {});
    assert.equal(r.status, 400);
  });
  await test('非法請求後原值不變（仍為 America/Los_Angeles）', () => {
    assert.equal(getRow('u-tw'), 'America/Los_Angeles');
  });
  await test('非法請求後 audit log 計數仍為 2', () => {
    assert.equal(auditCount('user.timezone.update'), 2);
  });

  // ─── No-op（同值）───
  console.log('No-op（同值）：');
  await test('PATCH 同值 America/Los_Angeles → 200', () => {
    const r = simulatePatch('u-tw', { timezone: 'America/Los_Angeles', source: 'manual' });
    assert.equal(r.status, 200);
  });
  await test('No-op 不寫 audit log（仍為 2）', () => {
    assert.equal(auditCount('user.timezone.update'), 2);
  });

  // ─── source 白名單防注入 ───
  console.log('source 白名單：');
  await test("PATCH source='evil-injection' → 視為 manual", () => {
    simulatePatch('u-tw', { timezone: 'Pacific/Auckland', source: 'evil-injection' });
    const meta = auditLast();
    assert.equal(meta.source, 'manual');
  });
  await test('PATCH 未提供 source → 視為 manual', () => {
    simulatePatch('u-tw', { timezone: 'Asia/Tokyo' });
    const meta = auditLast();
    assert.equal(meta.source, 'manual');
  });

  // ─── 結算 ───
  console.log('');
  console.log(`結果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
})();
