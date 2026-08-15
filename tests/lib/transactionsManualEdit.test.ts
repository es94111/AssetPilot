// tests/lib/transactionsManualEdit.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 005-mcp-transaction-restore 的 updateHandler()（PUT /api/transactions/{id}）標記清除邏輯：
// 手動編輯「備註值真的改變」才清除 note_ai_modified／pre_ai_note；只改其他欄位（備註同值重送）
// 保留標記；且「AI 建立」標記不受任何手動編輯影響（FR-002、FR-003、Edge Cases）。
// 本專案首次以「已認證 Route Handler」方式測試（其餘測試檔皆走 MCP 工具或純函式），故完整寫出
// authedRequest() 固定寫法：createLoginSession + NextRequest。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/transactionsManualEdit.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('transactionsManualEdit（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const txRoute = await import('../../app/api/transactions/[txId]/route.ts');

  await initDB();

  const userId = 'test_txmanual_' + uid();
  const txId = uid();

  function authedRequest(method: string, url: string, body?: unknown) {
    const { token } = createLoginSession(userId, 0, {});
    const headers: Record<string, string> = { Cookie: `authToken=${token}` };
    if (method !== 'GET') headers.Origin = new URL(url).origin; // CSRF 檢查要求 Origin 與 request URL 同源
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return new NextRequest(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now]
    );
    // 一筆同時具備 ai_created=1 且 note_ai_modified=1 的交易（FR-002 一併驗證）
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, note, ai_created, note_ai_modified, pre_ai_note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [txId, userId, 'expense', 100, 'TWD', '2026-08-14', 'AI 修改後的備註', 1, 1, 'AI 修改前的備註', Date.now(), Date.now()]
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM login_sessions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.close();
  });

  const url = `http://localhost/api/transactions/${txId}`;

  test('(a) PUT 送出相同備註值（其餘欄位可變）→ note_ai_modified 保持 1、pre_ai_note 不變、ai_created 仍為 1（FR-002、Edge Cases）', async () => {
    const res = await txRoute.PUT(authedRequest('PUT', url, {
      type: 'expense', amount: 150, date: '2026-08-15', categoryId: null, accountId: null,
      note: 'AI 修改後的備註', excludeFromStats: false,
    }), { params: Promise.resolve({ txId }) });
    assert.equal(res.status, 200);
    const row = queryOne('SELECT note_ai_modified, pre_ai_note, ai_created FROM transactions WHERE id = ?', [txId]);
    assert.equal(Number(row?.note_ai_modified), 1, '備註同值重送不應清除標記');
    assert.equal(row?.pre_ai_note, 'AI 修改前的備註', '快照應原樣保留');
    assert.equal(Number(row?.ai_created), 1, '手動編輯不影響 AI 建立標記');
  });

  test('(b) 同一情境但 PUT 送出不同備註值 → note_ai_modified 變 0、pre_ai_note 清為空、ai_created 仍為 1（FR-002、FR-003）', async () => {
    const res = await txRoute.PUT(authedRequest('PUT', url, {
      type: 'expense', amount: 150, date: '2026-08-15', categoryId: null, accountId: null,
      note: '使用者手動改的備註', excludeFromStats: false,
    }), { params: Promise.resolve({ txId }) });
    assert.equal(res.status, 200);
    const row = queryOne('SELECT note_ai_modified, pre_ai_note, ai_created FROM transactions WHERE id = ?', [txId]);
    assert.equal(Number(row?.note_ai_modified), 0, '備註值改變應清除標記');
    assert.equal(row?.pre_ai_note, '', '快照應清空');
    assert.equal(Number(row?.ai_created), 1, '即使改的是備註本身，AI 建立標記不受影響');
  });
}
