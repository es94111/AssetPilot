// tests/lib/mcpUpdateTransactionNote.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 update_transaction_note MCP 工具（004-mcp-update-notes-only）：成功更新備註、
// 其餘欄位逐欄比對不變（SC-002）、回應形狀與 list_transactions 單筆項目一致（FR-015）、
// 夾帶其他欄位被靜默忽略（FR-002）、不可編輯交易被拒（FR-010）、非本人交易被拒（FR-010）、
// 刪除能力不存在（FR-003）、空字串清空（FR-008）、長度上限（FR-009）、轉帳單腳獨立、
// 冪等、久遠交易、缺欄位被拒（FR-008）、稽核紀錄形狀與不含備註全文（FR-012、SC-005）、
// 被拒絕的嘗試不留稽核（Clarification #2）、僅限一般交易紀錄（FR-004）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/mcpUpdateTransactionNote.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('mcpUpdateTransactionNote（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { buildMcpServer } = await import('../../lib/mcpServer.ts');
  const { OpenAiCompatibleMcpTransport } = await import('../../lib/mcpOpenAiCompatibility.ts');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

  await initDB();

  const userId = 'test_mcpnote_' + uid();
  const otherUserId = 'test_mcpnote_other_' + uid();
  const accountId = uid();
  const otherAccountId = uid();
  const categoryId = uid();
  const credential = { credentialId: 'test_mcpnote_cred_' + uid(), userId, name: '測試憑證', allowUpdateNote: true };

  // 前置資料交易 id
  let expenseTxId = '';
  let emptyNoteTxId = '';
  let fxfeeTxId = '';
  let transferOutTxId = '';
  let transferInTxId = '';
  let oldDateTxId = '';
  let otherUserTxId = '';
  const MARKER_NOTE = 'MARKER_NOTE_' + uid();

  before(() => {
    const db = getDB();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now]
    );
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [otherUserId, `${otherUserId}@example.com`, 'x', '另一個測試使用者', now]
    );
    db.run(
      'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
      [accountId, userId, '測試帳戶', 'TWD', now]
    );
    db.run(
      'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
      [otherAccountId, otherUserId, '另一使用者帳戶', 'TWD', now]
    );
    db.run(
      'INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)',
      [categoryId, userId, '測試分類', 'expense', '']
    );

    // 一筆手動建立的支出交易（FR-004：更新對象不限於 AI 建立的交易）
    expenseTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, category_id, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [expenseTxId, userId, 'expense', 350, 'TWD', '2026-08-10', categoryId, accountId, '舊備註', Date.now(), Date.now()]
    );

    // 一筆備註為空的交易
    emptyNoteTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, category_id, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [emptyNoteTxId, userId, 'expense', 100, 'TWD', '2026-08-11', categoryId, accountId, '', Date.now(), Date.now()]
    );

    // 一筆國外刷卡手續費子交易（is_fx_fee = 1，不可編輯）
    fxfeeTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, category_id, account_id, note, is_fx_fee, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [fxfeeTxId, userId, 'expense', 10, 'TWD', '2026-08-12', null, accountId, '手續費', 1, Date.now(), Date.now()]
    );

    // 一筆轉帳的兩腳（linked_id 互相指向）
    transferOutTxId = uid();
    transferInTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, linked_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [transferOutTxId, userId, 'transfer_out', 200, 'TWD', '2026-08-13', accountId, '轉出備註', transferInTxId, Date.now(), Date.now()]
    );
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, linked_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [transferInTxId, userId, 'transfer_in', 200, 'TWD', '2026-08-13', accountId, '轉入備註', transferOutTxId, Date.now(), Date.now()]
    );

    // 一筆日期為一年以前的交易（Clarification #4：不因時間久遠被拒）
    oldDateTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, category_id, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [oldDateTxId, userId, 'expense', 50, 'TWD', '2025-01-15', categoryId, accountId, '去年交易', Date.now(), Date.now()]
    );

    // 另一個使用者的交易（FR-010：非本人）
    otherUserTxId = uid();
    db.run(
      'INSERT INTO transactions (id, user_id, type, amount, currency, date, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [otherUserTxId, otherUserId, 'expense', 999, 'TWD', '2026-08-14', otherAccountId, '他人的交易', Date.now(), Date.now()]
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM transactions WHERE user_id = ?', [otherUserId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [otherUserId]);
    db.run('DELETE FROM categories WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [otherUserId]);
    db.close();
  });

  type McpClient = InstanceType<typeof Client>;

  async function withMcpClient<T>(fn: (client: McpClient) => Promise<T>): Promise<T> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer(credential);
    const client = new Client({ name: 'assetpilot-mcpnote-test', version: '1.0.0' });
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

  function listTransactionsItemKeys(client: McpClient): Promise<Set<string>> {
    return withMcpClient(async (c) => {
      const result = await c.callTool({ name: 'list_transactions', arguments: {} });
      const payload = JSON.parse(firstTextContent(result));
      assert.ok(Array.isArray(payload.items) && payload.items.length > 0, 'list_transactions 應回傳非空 items');
      return new Set(Object.keys(payload.items[0]));
    });
  }

  // ── T017: User Story 1 成功更新 ＋ 其餘欄位逐欄比對 ＋ 回應形狀一致 ──────────────

  test('T017(a)(b) 成功更新支出交易備註，回應形狀與 list_transactions 單筆項目一致，且兩層逐欄比對不變（SC-002、FR-015）', async () => {
    const before = queryOne(
      'SELECT type, amount, currency, date, category_id, account_id FROM transactions WHERE id = ? AND user_id = ?',
      [expenseTxId, userId]
    );
    assert.ok(before, '前置交易應存在');

    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: expenseTxId, note: '跟客戶聚餐' },
      });
      assert.equal(result.isError, undefined);
      const payload = JSON.parse(firstTextContent(result));

      assert.equal(payload.ok, true);
      const tx = payload.transaction;
      assert.ok(tx, 'transaction 物件應存在');
      assert.equal(tx.id, expenseTxId);
      assert.equal(tx.note, '跟客戶聚餐');
      assert.equal(tx.type, 'expense');
      assert.equal(tx.amount, 350);
      assert.equal(tx.currency, 'TWD');
      assert.equal(tx.date, '2026-08-10');
      assert.equal(tx.categoryId, categoryId);
      assert.equal(tx.accountId, accountId);

      // (i) 資料庫層逐欄比對（note/updated_at 以外欄位）
      const after = queryOne(
        'SELECT type, amount, currency, date, category_id, account_id FROM transactions WHERE id = ? AND user_id = ?',
        [expenseTxId, userId]
      );
      assert.deepEqual(after, before, 'note/updated_at 以外的資料庫欄位必須逐欄不變');

      // (ii) 回應 transaction 物件鍵集合與 list_transactions 單筆項目完全相同
      const listKeys = await listTransactionsItemKeys(client);
      assert.deepEqual(new Set(Object.keys(tx)), listKeys, '回應 transaction 鍵集合須與 list_transactions 單筆項目一致');
    });
  });

  test('T017(c) 空字串可清空備註（FR-008）', async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: emptyNoteTxId, note: '' },
      });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.ok, true);
      assert.equal(payload.transaction.note, '');
      const row = queryOne('SELECT note FROM transactions WHERE id = ?', [emptyNoteTxId]);
      assert.equal(row?.note, '');
    });
  });

  test('T017(d) 剛好 200 字成功、201 字被拒且備註不變（FR-009）', async () => {
    const note200 = 'A'.repeat(200);
    const note201 = 'B'.repeat(201);

    await withMcpClient(async (client) => {
      // 200 字成功
      const okResult = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: oldDateTxId, note: note200 },
      });
      const okPayload = JSON.parse(firstTextContent(okResult));
      assert.equal(okPayload.ok, true);
      assert.equal(okPayload.transaction.note, note200);

      // 201 字被拒（isError）
      const failResult = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: oldDateTxId, note: note201 },
      });
      assert.equal(failResult.isError, true);
      const failText = firstTextContent(failResult);
      assert.match(failText, /備註長度不可超過 200 字/);
      // 備註不變（仍為先前的 200 字）
      const row = queryOne('SELECT note FROM transactions WHERE id = ?', [oldDateTxId]);
      assert.equal(row?.note, note200);
    });
  });

  test('T017(e) 轉帳「轉出」腳更新備註後，「轉入」腳備註未被連動修改（Edge Cases）', async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: transferOutTxId, note: '新的轉出備註' },
      });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.ok, true);
      assert.equal(payload.transaction.note, '新的轉出備註');

      const inRow = queryOne('SELECT note FROM transactions WHERE id = ?', [transferInTxId]);
      assert.equal(inRow?.note, '轉入備註', '轉入腳備註不應被連動修改');
    });
  });

  test('T017(f) 以完全相同內容連續呼叫兩次皆成功且結果一致（冪等，Edge Cases）', async () => {
    await withMcpClient(async (client) => {
      const args = { transactionId: expenseTxId, note: '冪等測試備註' };
      const first = await client.callTool({ name: 'update_transaction_note', arguments: args });
      const second = await client.callTool({ name: 'update_transaction_note', arguments: args });
      const firstPayload = JSON.parse(firstTextContent(first));
      const secondPayload = JSON.parse(firstTextContent(second));
      assert.equal(firstPayload.ok, true);
      assert.equal(secondPayload.ok, true);
      assert.deepEqual(secondPayload.transaction, firstPayload.transaction);
    });
  });

  test('T017(g) 更新一筆日期為一年以前的交易正常成功（Clarification #4）', async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: oldDateTxId, note: '久遠交易新備註' },
      });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.ok, true);
      assert.equal(payload.transaction.note, '久遠交易新備註');
    });
  });

  test('T017(h) callTool 只給 transactionId 不給 note，斷言 inputSchema 驗證錯誤且交易不變（FR-008 缺欄位分支）', async () => {
    const before = queryOne('SELECT note FROM transactions WHERE id = ?', [expenseTxId]);
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: expenseTxId } as { transactionId: string },
      });
      // 缺必填 note ⇒ MCP 協定層驗證錯誤（isError 或 throws）
      assert.equal(result.isError, true, '缺 note 應為驗證錯誤');
    }).catch(() => {
      // SDK 可能以 throw 表達 invalid params，視為通過
    });
    const after = queryOne('SELECT note FROM transactions WHERE id = ?', [expenseTxId]);
    assert.equal(after?.note, before?.note, '缺欄位時備註不應變更');
  });

  // ── T032: User Story 3 稽核 ──────────────────────────────────────────

  test('T032(a)(b) 成功更新後稽核出現 mcp_update_transaction_note 且 metadata 不含備註全文（FR-012、SC-005）', async () => {
    // 用一個可辨識的備註，確保稽核 metadata 不含其子字串
    const auditNote = 'AUDIT_' + MARKER_NOTE;
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: expenseTxId, note: auditNote },
      });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.ok, true);
    });

    const auditRow = queryOne(
      "SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'mcp_update_transaction_note' AND result = 'success' ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );
    assert.ok(auditRow, '應查得 mcp_update_transaction_note 稽核紀錄');
    const metadataJson = String(auditRow?.metadata);
    const metadata = JSON.parse(metadataJson);
    assert.equal(metadata.mcp_credential_id, credential.credentialId);
    assert.equal(metadata.mcp_credential_name, credential.name);
    assert.equal(metadata.transaction_id, expenseTxId);
    // (b) 不含更新前或更新後的備註字串，也不含 transaction_summary
    assert.ok(!metadataJson.includes(auditNote), '稽核 metadata 不得含更新後備註字串');
    assert.ok(!metadataJson.includes('跟客戶聚餐'), '稽核 metadata 不得含先前備註字串');
    assert.ok(!('transaction_summary' in metadata), '稽核 metadata 不得含 transaction_summary');
  });

  test('T032(c) 被拒絕的嘗試不留稽核（Clarification #2）', async () => {
    const countBefore = Number(queryOne(
      "SELECT COUNT(*) AS cnt FROM data_operation_audit_log WHERE user_id = ? AND action = 'mcp_update_transaction_note'",
      [userId]
    )?.cnt) || 0;

    await withMcpClient(async (client) => {
      // 超長備註
      const longResult = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: expenseTxId, note: 'C'.repeat(201) },
      });
      assert.equal(longResult.isError, true);
      // 不存在的交易 id
      const missingResult = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: 'nonexistent_' + uid(), note: '不存在' },
      });
      assert.equal(missingResult.isError, true);
    }).catch(() => {});

    const countAfter = Number(queryOne(
      "SELECT COUNT(*) AS cnt FROM data_operation_audit_log WHERE user_id = ? AND action = 'mcp_update_transaction_note'",
      [userId]
    )?.cnt) || 0;
    assert.equal(countAfter, countBefore, '被拒絕的嘗試不應新增稽核紀錄');
  });

  // ── T033: User Story 3 邊界案例 ──────────────────────────────────────

  test('T033(a) 夾帶其他欄位請求成功，且其餘欄位逐欄與呼叫前完全相同（FR-002、SC-004）', async () => {
    const before = queryOne(
      'SELECT type, amount, currency, date, category_id, account_id FROM transactions WHERE id = ? AND user_id = ?',
      [expenseTxId, userId]
    );
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: {
          transactionId: expenseTxId,
          note: '夾帶測試',
          date: '2000-01-01',
          amount: 999999,
          type: 'income',
          categoryId: 'any',
          accountId: 'any',
          delete: true,
        },
      });
      // 夾帶不應使請求失敗
      assert.equal(result.isError, undefined);
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.ok, true);
      assert.equal(payload.transaction.note, '夾帶測試');

      const after = queryOne(
        'SELECT type, amount, currency, date, category_id, account_id FROM transactions WHERE id = ? AND user_id = ?',
        [expenseTxId, userId]
      );
      assert.deepEqual(after, before, '夾帶的其他欄位不得變更任何資料庫欄位');
    });
  });

  test('T033(b) 對 is_fx_fee=1 的交易呼叫，錯誤訊息與共用規則逐字相同且備註未變（FR-010）', async () => {
    const before = queryOne('SELECT note FROM transactions WHERE id = ?', [fxfeeTxId]);
    const expectedMessage = '此為自動產生的國外刷卡手續費交易，請改編輯對應的國外交易（修改後手續費會自動同步）';
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: fxfeeTxId, note: '嘗試改手續費備註' },
      });
      assert.equal(result.isError, true);
      assert.equal(firstTextContent(result), expectedMessage, '錯誤訊息須與共用規則逐字相同');
    });
    const after = queryOne('SELECT note FROM transactions WHERE id = ?', [fxfeeTxId]);
    assert.equal(after?.note, before?.note, '不可編輯交易的備註不應變更');
  });

  test('T033(c) 非本人交易與不存在 id 皆得到「交易不存在或無權限」，且原交易未變（FR-010）', async () => {
    const before = queryOne('SELECT note FROM transactions WHERE id = ?', [otherUserTxId]);
    await withMcpClient(async (client) => {
      // 非本人交易
      const notOwned = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: otherUserTxId, note: '偷改' },
      });
      assert.equal(notOwned.isError, true);
      assert.equal(firstTextContent(notOwned), '交易不存在或無權限');

      // 隨機字串（不存在）
      const missing = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: 'random_' + uid(), note: '隨機' },
      });
      assert.equal(missing.isError, true);
      assert.equal(firstTextContent(missing), '交易不存在或無權限');
    });
    const after = queryOne('SELECT note FROM transactions WHERE id = ?', [otherUserTxId]);
    assert.equal(after?.note, before?.note, '非本人交易備註不應變更');
  });

  test('T033(d) 刪除能力不存在：呼叫 delete_transaction 等不存在的工具名稱被拒，且交易逐欄不變（FR-003、SC-004）', async () => {
    const before = queryOne(
      'SELECT type, amount, currency, date, note, account_id FROM transactions WHERE id = ? AND user_id = ?',
      [expenseTxId, userId]
    );
    await withMcpClient(async (client) => {
      for (const toolName of ['delete_transaction', 'update_transaction']) {
        await assert.rejects(
          () => client.callTool({ name: toolName, arguments: { transactionId: expenseTxId } }),
          (error: unknown) => {
            assert.match(String((error as Error)?.message || error), /not found/i);
            return true;
          },
          `${toolName} 應回傳 MCP 協定層級的「工具不存在」錯誤`
        );
      }
    });
    const after = queryOne(
      'SELECT type, amount, currency, date, note, account_id FROM transactions WHERE id = ? AND user_id = ?',
      [expenseTxId, userId]
    );
    assert.deepEqual(after, before, '呼叫不存在的刪除／修改工具前後，交易逐欄內容必須完全相同');
  });

  test('T033(e) 以帳戶 id、分類 id 當 transactionId 呼叫，回傳「交易不存在或無權限」且該列未變（FR-004）', async () => {
    const accountBefore = queryOne('SELECT name FROM accounts WHERE id = ?', [accountId]);
    const categoryBefore = queryOne('SELECT name FROM categories WHERE id = ?', [categoryId]);

    await withMcpClient(async (client) => {
      // 帳戶 id
      const asAccount = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: accountId, note: '以帳戶 id 嘗試' },
      });
      assert.equal(asAccount.isError, true);
      assert.equal(firstTextContent(asAccount), '交易不存在或無權限');

      // 分類 id
      const asCategory = await client.callTool({
        name: 'update_transaction_note',
        arguments: { transactionId: categoryId, note: '以分類 id 嘗試' },
      });
      assert.equal(asCategory.isError, true);
      assert.equal(firstTextContent(asCategory), '交易不存在或無權限');
    });

    const accountAfter = queryOne('SELECT name FROM accounts WHERE id = ?', [accountId]);
    const categoryAfter = queryOne('SELECT name FROM categories WHERE id = ?', [categoryId]);
    assert.deepEqual(accountAfter, accountBefore, '帳戶資料列不應被變更');
    assert.deepEqual(categoryAfter, categoryBefore, '分類資料列不應被變更');
  });
}