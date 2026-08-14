// tests/lib/mcpCreateTransaction.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 create_transaction MCP 工具（003-mcp-write-no-delete）：成功建立、冪等鍵去重（SC-006），
// 以及刪除／修改語意的不存在工具名稱皆被安全拒絕、不影響既有資料（User Story 3、FR-002、FR-003）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/mcpCreateTransaction.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('mcpCreateTransaction（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { buildMcpServer } = await import('../../lib/mcpServer.ts');
  const { OpenAiCompatibleMcpTransport } = await import('../../lib/mcpOpenAiCompatibility.ts');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

  await initDB();

  const userId = 'test_mcpcreate_' + uid();
  const accountId = uid();
  const categoryId = uid();
  const credential = { credentialId: 'test_mcpcreate_cred_' + uid(), userId, name: '測試憑證', allowCreate: true };

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now]
    );
    db.run(
      'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
      [accountId, userId, '測試帳戶', 'TWD', now]
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)',
      [categoryId, userId, '測試分類', 'expense', '']
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM mcp_transaction_idempotency WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM categories WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
    db.close();
  });

  type McpClient = InstanceType<typeof Client>;

  async function withMcpClient<T>(fn: (client: McpClient) => Promise<T>): Promise<T> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer(credential);
    const client = new Client({ name: 'assetpilot-mcpcreate-test', version: '1.0.0' });
    try {
      await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
      await client.connect(clientTransport);
      return await fn(client);
    } finally {
      await client.close();
      await server.close();
    }
  }

  function firstTextContent(result: unknown): string {
    const content = (result as { content?: unknown })?.content as Array<{ type: string; text?: string }> | undefined;
    const first = content?.[0];
    if (!first || typeof first.text !== 'string') throw new Error('預期 callTool 回應為文字內容');
    return first.text;
  }

  let sharedTransactionId = '';

  test('create_transaction 成功建立一筆 expense 交易，回傳欄位與契約一致', async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'create_transaction',
        arguments: { type: 'expense', amount: 350, categoryId, accountId, note: '晚餐' },
      });
      assert.equal(result.isError, undefined);
      const payload = JSON.parse(firstTextContent(result));

      assert.ok(payload.id);
      assert.equal(payload.type, 'expense');
      assert.equal(payload.amount, 350);
      assert.equal(payload.currency, 'TWD');
      assert.equal(payload.categoryId, categoryId);
      assert.equal(payload.accountId, accountId);
      assert.equal(payload.note, '晚餐');
      assert.match(payload.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(payload.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const row = queryOne('SELECT type, twd_amount, account_id, category_id, note FROM transactions WHERE id = ?', [payload.id]);
      assert.equal(row?.type, 'expense');
      assert.equal(Number(row?.twd_amount), 350);
      assert.equal(row?.account_id, accountId);
      assert.equal(row?.category_id, categoryId);
      assert.equal(row?.note, '晚餐');

      sharedTransactionId = payload.id;
    });
  });

  test('create_transaction 帶相同 idempotencyKey 重複呼叫，回傳相同結果且只建立一筆交易（SC-006）', async () => {
    await withMcpClient(async (client) => {
      const idempotencyKey = 'idem-test-' + uid();
      const args = { type: 'expense', amount: 120, accountId, note: '早餐', idempotencyKey };

      const first = await client.callTool({ name: 'create_transaction', arguments: args });
      const firstPayload = JSON.parse(firstTextContent(first));

      const second = await client.callTool({ name: 'create_transaction', arguments: args });
      const secondPayload = JSON.parse(firstTextContent(second));

      assert.deepEqual(secondPayload, firstPayload);

      const count = queryOne(
        "SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ? AND note = '早餐'",
        [userId]
      );
      assert.equal(Number(count?.cnt) || 0, 1);
    });
  });

  test('刪除／修改語意的不存在工具名稱皆被安全拒絕，不影響任何既有資料（FR-002、FR-003、SC-004）', async () => {
    assert.ok(sharedTransactionId, '前一個測試應已建立 sharedTransactionId');
    const before = queryOne(
      'SELECT type, twd_amount, date, note, account_id FROM transactions WHERE id = ?',
      [sharedTransactionId]
    );
    assert.ok(before, '應能查得先前建立的交易');
    const totalBefore = queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]);

    await withMcpClient(async (client) => {
      for (const toolName of ['delete_transaction', 'update_transaction']) {
        await assert.rejects(
          () => client.callTool({ name: toolName, arguments: { id: sharedTransactionId } }),
          (error: unknown) => {
            assert.match(String((error as Error)?.message || error), /not found/i);
            return true;
          },
          `${toolName} 應回傳 MCP 協定層級的「工具不存在」錯誤`
        );
      }
    });

    const after = queryOne(
      'SELECT type, twd_amount, date, note, account_id FROM transactions WHERE id = ?',
      [sharedTransactionId]
    );
    assert.deepEqual(after, before, '呼叫不存在的刪除／修改工具前後，交易欄位內容必須完全相同');

    const totalAfter = queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]);
    assert.equal(Number(totalAfter?.cnt) || 0, Number(totalBefore?.cnt) || 0, '不應有任何資料被刪除或新增');
  });
}
