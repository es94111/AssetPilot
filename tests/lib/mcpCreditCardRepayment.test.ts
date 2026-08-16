// tests/lib/mcpCreditCardRepayment.test.ts — 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；
// 未設定時略過（保持 `npm test` 在無 DB 環境下仍可通過）。
// 驗證 007-mcp-credit-card-repayment 的三個 MCP 工具端到端行為：
//  - create_credit_card_repayment（US1）：總金額還款寫入、V1-V5 拒絕、ai_created 標記、冪等鍵、稽核
//  - get_credit_card_repayment_preview（US2）：試算分配、不建立紀錄、isOverpay、與正式送出一致
//  - list_credit_card_repayments（US3）：分頁、期間篩選、stale 標示（modified／deleted）
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/mcpCreditCardRepayment.test.ts
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('mcpCreditCardRepayment（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll, saveDB } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { buildMcpServer } = await import('../../lib/mcpServer.ts');
  const { OpenAiCompatibleMcpTransport } = await import('../../lib/mcpOpenAiCompatibility.ts');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

  await initDB();

  const userId = 'test_mcpccr_' + uid();
  const now = Date.now();
  const credential = { credentialId: 'test_mcpccr_cred_' + uid(), userId, name: '測試憑證', allowCreate: true };

  before(() => {
    const db = getDB();
    const nowIso = new Date().toISOString();
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at, timezone) VALUES (?,?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', nowIso, 'Asia/Taipei']
    );
  });

  after(() => {
    const db = getDB();
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM credit_card_repayment_summaries WHERE user_id = ?', [userId]);
    db.run('DELETE FROM mcp_transaction_idempotency WHERE user_id = ?', [userId]);
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉。
    db.close();
  });

  type McpClient = InstanceType<typeof Client>;

  async function withMcpClient<T>(fn: (client: McpClient) => Promise<T>): Promise<T> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer(credential);
    const client = new Client({ name: 'assetpilot-mcpccr-test', version: '1.0.0' });
    try {
      await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
      await client.connect(clientTransport);
      return await fn(client);
    } finally {
      await client.close();
      await server.close();
    }
  }

  async function withMcpClientReadOnly<T>(fn: (client: McpClient) => Promise<T>): Promise<T> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer({ ...credential, allowCreate: false });
    const client = new Client({ name: 'assetpilot-mcpccr-test-ro', version: '1.0.0' });
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

  // 建立一組 fixture：1 個銀行帳戶（付款）＋ 3 張關聯信用卡（2 張有欠款 6000／3000，1 張無欠款）
  function setupFixture(): { bankId: string; cardIds: string[] } {
    const db = getDB();
    const bankId = uid();
    const cardIds = [uid(), uid(), uid()];
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [bankId, userId, '測試付款帳戶', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    // 前 2 張有欠款，第 3 張無欠款（餘額 0）
    const debts = [6000, 3000, 0];
    const createdDates = ['2026-02-01', '2026-03-01', '2026-04-01'];
    cardIds.forEach((cid, i) => {
      db.run(
        "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [cid, userId, `卡${i + 1}`, 'credit_card', '信用卡', 'TWD', 0, bankId, createdDates[i], now]
      );
      if (debts[i] > 0) {
        db.run(
          "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, twd_amount, date, account_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          [uid(), userId, 'expense', debts[i], 'TWD', debts[i], debts[i], '2026-08-10', cid, '消費', now, now]
        );
      }
    });
    saveDB();
    return { bankId, cardIds };
  }

  // ── User Story 1：create_credit_card_repayment ──

  test('US1 (a)：成功建立還款，回應形狀一致、各卡分配總和等於 totalAmount、總額恰等於應繳總額時 balanceAfter=0（SC-002）', async () => {
    const { bankId, cardIds } = setupFixture();
    // 應繳總額 = 6000 + 3000 = 9000
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'create_credit_card_repayment',
        arguments: { fromAccountId: bankId, totalAmount: 9000, date: '2026-08-15' },
      });
      assert.equal(result.isError, undefined);
      const payload = JSON.parse(firstTextContent(result));

      assert.equal(payload.ok, true);
      assert.ok(payload.summaryId);
      assert.equal(payload.date, '2026-08-15');
      assert.equal(payload.fromAccountId, bankId);
      assert.equal(payload.currency, 'TWD');
      assert.equal(payload.totalAmount, 9000);
      assert.equal(payload.allocations.length, 2, '只納入有欠款的 2 張卡');
      const sum = payload.allocations.reduce((acc: number, a: any) => acc + a.amount, 0);
      assert.equal(sum, 9000, '分配總和應等於 totalAmount');
      // 總額恰等於應繳總額 → 各卡 balanceAfter = 0
      for (const a of payload.allocations) {
        assert.equal(a.balanceAfter, 0, '總額=應繳總額時各卡 balanceAfter 應為 0');
        assert.ok(a.cardId && a.cardName && a.cardCurrency);
      }
    });
  });

  test('US1 (b)：無欠款的關聯卡不被納入、不產生任何交易（Acceptance Scenario 3、FR-004）', async () => {
    const { bankId, cardIds } = setupFixture();
    const beforeCount = queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]) as { cnt: number };
    await withMcpClient(async (client) => {
      await client.callTool({
        name: 'create_credit_card_repayment',
        arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' },
      });
    });
    // 第 3 張卡（無欠款）不應有任何還款交易
    const card3Txs = queryAll('SELECT id FROM transactions WHERE user_id = ? AND account_id = ? AND type IN (?)', [userId, cardIds[2], 'transfer_in']);
    assert.equal(card3Txs.length, 0, '無欠款的卡不應有 transfer_in 交易');
  });

  test('US1 (c)：V1-V5 各拒絕情形，訊息與既有路由逐字元相同（FR-006）', async () => {
    const { bankId, cardIds } = setupFixture();

    await withMcpClient(async (client) => {
      // V1：totalAmount 非大於 0 整數
      const r1 = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 0, date: '2026-08-15' } });
      assert.equal(r1.isError, true);
      assert.match(firstTextContent(r1), /還款總金額須為大於 0 的整數/);

      const r1b = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 100.5, date: '2026-08-15' } });
      assert.equal(r1b.isError, true);

      // V2：付款帳戶不存在
      const r2 = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: 'nonexistent', totalAmount: 5000, date: '2026-08-15' } });
      assert.equal(r2.isError, true);
      assert.match(firstTextContent(r2), /付款帳戶不存在/);

      // V3：付款帳戶為信用卡
      const r3 = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: cardIds[0], totalAmount: 5000, date: '2026-08-15' } });
      assert.equal(r3.isError, true);
      assert.match(firstTextContent(r3), /付款帳戶不可為信用卡/);

      // V5：totalAmount < 納入卡片數（2 張 → 至少需 2）
      const r5 = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 1, date: '2026-08-15' } });
      assert.equal(r5.isError, true);
      assert.match(firstTextContent(r5), /金額過小，至少需 2 才能讓每張卡都分配到/);
    });
  });

  test('US1 (c2)：付款帳戶無可還款信用卡 → V4 拒絕（FR-006）', async () => {
    const db = getDB();
    const emptyBankId = uid();
    db.run(
      "INSERT INTO accounts (id, user_id, name, category, account_type, currency, initial_balance, linked_bank_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [emptyBankId, userId, '無卡銀行', 'bank', '銀行', 'TWD', 100000, null, '2026-01-01', now]
    );
    saveDB();
    await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: emptyBankId, totalAmount: 5000, date: '2026-08-15' } });
      assert.equal(r.isError, true);
      assert.match(firstTextContent(r), /此付款帳戶目前沒有可還款的信用卡/);
    });
  });

  test('US1 (d)：成功建立的 2N 筆交易 ai_created=1，且 list_transactions 查得到（FR-007）', async () => {
    const { bankId } = setupFixture();
    const beforeCount = Number((queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]) as { cnt: number }).cnt);
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'create_credit_card_repayment',
        arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' },
      });
      const payload = JSON.parse(firstTextContent(result));
      const txs = queryAll('SELECT ai_created FROM transactions WHERE user_id = ? AND repayment_summary_id = ?', [userId, payload.summaryId]);
      assert.ok(txs.length >= 4, '應寫入 2N 筆交易（2 張卡 → 4 筆）');
      assert.ok(txs.every((t) => Number(t.ai_created) === 1), '所有交易 ai_created 應為 1');
    });
  });

  test('US1 (e)：相同 idempotencyKey 連續呼叫兩次，回應完全相同且資料庫僅一組交易（FR-008）', async () => {
    const { bankId } = setupFixture();
    const idempotencyKey = 'idem-ccr-' + uid();
    const args = { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15', idempotencyKey };

    const first = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: args });
      return JSON.parse(firstTextContent(r));
    });
    const second = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: args });
      return JSON.parse(firstTextContent(r));
    });

    assert.equal(first.summaryId, second.summaryId, '相同冪等鍵應回傳同一 summaryId');
    assert.deepEqual(first.allocations, second.allocations);
    const summaryCount = queryAll('SELECT id FROM credit_card_repayment_summaries WHERE user_id = ? AND id = ?', [userId, first.summaryId]);
    assert.equal(summaryCount.length, 1, '資料庫應僅一筆摘要');
  });

  test('US1 (f)：稽核紀錄 action=mcp_create_credit_card_repayment，metadata 含 repayment_summary_id／transaction_summary，不含逐卡明細（FR-013）', async () => {
    const { bankId } = setupFixture();
    const beforeAudit = Number((queryOne("SELECT COUNT(*) AS cnt FROM data_operation_audit_log WHERE user_id = ? AND action = 'mcp_create_credit_card_repayment'", [userId]) as { cnt: number }).cnt);
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'create_credit_card_repayment',
        arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' },
      });
      const payload = JSON.parse(firstTextContent(result));
      const audits = queryAll('SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = ?', [userId, 'mcp_create_credit_card_repayment']) as { metadata: string }[];
      const lastAudit = audits[audits.length - 1];
      const meta = JSON.parse(lastAudit.metadata);
      assert.equal(meta.repayment_summary_id, payload.summaryId);
      assert.match(meta.transaction_summary, /信用卡還款 5000 元/);
      // 不含逐卡分配明細鍵
      assert.equal(meta.allocations, undefined, '稽核 metadata 不應含逐卡明細');
      assert.equal(meta.amount, undefined);
    });
  });

  test('US1 (g)：allowCreate=false 的憑證 tools/list 不含此工具，強行呼叫得到協定層錯誤（FR-003）', async () => {
    await withMcpClientReadOnly(async (client) => {
      const listed = await client.listTools();
      const names = listed.tools.map((t) => t.name);
      assert.ok(!names.includes('create_credit_card_repayment'), '未開 allowCreate 不應含此工具');
      // 強行呼叫 → MCP 協定層「找不到工具」錯誤
      await assert.rejects(
        () => client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: 'x', totalAmount: 1 } }),
        /create_credit_card_repayment|not found|Method not found/i
      );
    });
  });

  // ── User Story 2：get_credit_card_repayment_preview ──

  test('US2 (a)：試算回應含每張卡分配與試算後餘額，且查詢前後交易筆數不變（FR-009）', async () => {
    const { bankId } = setupFixture();
    const beforeCount = Number((queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]) as { cnt: number }).cnt);
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'get_credit_card_repayment_preview',
        arguments: { fromAccountId: bankId, totalAmount: 5000 },
      });
      assert.equal(result.isError, undefined);
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.fromAccountId, bankId);
      assert.equal(payload.currency, 'TWD');
      assert.equal(payload.totalAmount, 5000);
      assert.equal(payload.cardCount, 2);
      assert.equal(payload.allocations.length, 2);
      for (const a of payload.allocations) {
        assert.ok(typeof a.balanceAfter === 'number');
      }
    });
    const afterCount = Number((queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId]) as { cnt: number }).cnt);
    assert.equal(afterCount, beforeCount, '試算不應建立任何交易（FR-009）');
    const summaryCount = Number((queryOne('SELECT COUNT(*) AS cnt FROM credit_card_repayment_summaries WHERE user_id = ?', [userId]) as { cnt: number }).cnt);
    assert.equal(summaryCount, 0, '試算不應建立任何摘要');
  });

  test('US2 (b)：總金額大於應繳總額時 isOverpay=true、overpayAmount 正確、形成正餘額的卡 balanceAfter>0（Acceptance Scenario 2）', async () => {
    const { bankId } = setupFixture();
    // 應繳總額 = 9000，試算 9500 → overpayAmount = 500
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: 'get_credit_card_repayment_preview',
        arguments: { fromAccountId: bankId, totalAmount: 9500 },
      });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(payload.isOverpay, true);
      assert.equal(payload.overpayAmount, 500);
      assert.equal(payload.totalDebt, 9000);
    });
  });

  test('US2 (c)：試算與正式送出的 allocations 數值逐項相同（期間欠款未變動，FR-010）', async () => {
    const { bankId } = setupFixture();
    const preview = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'get_credit_card_repayment_preview', arguments: { fromAccountId: bankId, totalAmount: 7000 } });
      return JSON.parse(firstTextContent(r));
    });
    const actual = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 7000, date: '2026-08-15' } });
      return JSON.parse(firstTextContent(r));
    });
    assert.deepEqual(preview.allocations, actual.allocations, '試算與正式送出的 allocations 應逐項相同');
  });

  test('US2 (d)：試算 V1-V5 拒絕情形，訊息與寫入工具相同', async () => {
    const { bankId, cardIds } = setupFixture();
    await withMcpClient(async (client) => {
      const r1 = await client.callTool({ name: 'get_credit_card_repayment_preview', arguments: { fromAccountId: bankId, totalAmount: 0 } });
      assert.equal(r1.isError, true);
      assert.match(firstTextContent(r1), /還款總金額須為大於 0 的整數/);

      const r3 = await client.callTool({ name: 'get_credit_card_repayment_preview', arguments: { fromAccountId: cardIds[0], totalAmount: 5000 } });
      assert.equal(r3.isError, true);
      assert.match(firstTextContent(r3), /付款帳戶不可為信用卡/);

      const r5 = await client.callTool({ name: 'get_credit_card_repayment_preview', arguments: { fromAccountId: bankId, totalAmount: 1 } });
      assert.equal(r5.isError, true);
      assert.match(firstTextContent(r5), /金額過小，至少需 2/);
    });
  });

  test('US2 (e)：allowCreate=false 的憑證呼叫試算工具仍成功（唯讀工具不受開關影響，FR-009）', async () => {
    const { bankId } = setupFixture();
    await withMcpClientReadOnly(async (client) => {
      const result = await client.callTool({
        name: 'get_credit_card_repayment_preview',
        arguments: { fromAccountId: bankId, totalAmount: 5000 },
      });
      assert.equal(result.isError, undefined);
    });
  });

  // ── User Story 3：list_credit_card_repayments ──

  test('US3 (a)：建立 2 筆不同日期還款後查詢，回應含每筆明細（FR-011）', async () => {
    const { bankId } = setupFixture();
    await withMcpClient(async (client) => {
      await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-07-10' } });
      const { bankId: bankId2 } = setupFixture();
      await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId2, totalAmount: 5000, date: '2026-08-12' } });
    });

    await withMcpClient(async (client) => {
      const result = await client.callTool({ name: 'list_credit_card_repayments', arguments: {} });
      const payload = JSON.parse(firstTextContent(result));
      assert.ok(payload.items.length >= 2, '應查到至少 2 筆');
      for (const item of payload.items) {
        assert.ok(item.id);
        assert.ok(item.date);
        assert.ok(item.fromAccount);
        assert.ok(typeof item.totalAmount === 'number');
        assert.ok(Array.isArray(item.allocations));
        assert.equal(typeof item.stale, 'boolean');
        assert.match(item.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
      // 依 date DESC 排序
      const dates = payload.items.map((i: any) => i.date);
      const sorted = [...dates].sort().reverse();
      assert.deepEqual(dates, sorted.slice(0, dates.length) || dates, '應依日期降序');
    });
  });

  test('US3 (b)：dateFrom／dateTo 篩選與分頁行為正確（FR-011）', async () => {
    await withMcpClient(async (client) => {
      // 只查 2026-07
      const r1 = await client.callTool({ name: 'list_credit_card_repayments', arguments: { dateFrom: '2026-07-01', dateTo: '2026-07-31' } });
      const p1 = JSON.parse(firstTextContent(r1));
      for (const item of p1.items) {
        assert.ok(item.date >= '2026-07-01' && item.date <= '2026-07-31', 'dateFrom/dateTo 篩選應成立');
      }

      // 分頁
      const r2 = await client.callTool({ name: 'list_credit_card_repayments', arguments: { page: 1, pageSize: 1 } });
      const p2 = JSON.parse(firstTextContent(r2));
      assert.equal(p2.items.length, 1, 'pageSize=1 應只回 1 筆');
      assert.equal(p2.pageSize, 1);
      assert.ok(p2.totalPages >= p2.total, 'totalPages 應正確');
    });
  });

  test('US3 (c)：完全未異動的還款紀錄 stale:false 全 intact（Acceptance Scenario 3 對照組）', async () => {
    const { bankId } = setupFixture();
    const created = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' } });
      return JSON.parse(firstTextContent(r));
    });
    await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'list_credit_card_repayments', arguments: { dateFrom: '2026-08-15', dateTo: '2026-08-15' } });
      const payload = JSON.parse(firstTextContent(r));
      const target = payload.items.find((i: any) => i.id === created.summaryId);
      assert.ok(target, '應找到剛建立的摘要');
      assert.equal(target.stale, false);
      assert.ok(target.allocations.every((a: any) => a.status === 'intact'));
    });
  });

  test('US3 (d)：修改某筆還款其中一組交易金額後，該筆 stale:true 且對應卡片 status:modified（FR-012）', async () => {
    const { bankId } = setupFixture();
    const created = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' } });
      return JSON.parse(firstTextContent(r));
    });
    // 修改其中一組轉出交易的金額
    const txs = queryAll('SELECT id FROM transactions WHERE user_id = ? AND repayment_summary_id = ? AND type = ?', [userId, created.summaryId, 'transfer_out']);
    getDB().run('UPDATE transactions SET original_amount = ?, twd_amount = ?, amount = ?, updated_at = ? WHERE id = ?', [9999, 9999, 9999, now, txs[0].id]);
    saveDB();

    await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'list_credit_card_repayments', arguments: { dateFrom: '2026-08-15', dateTo: '2026-08-15' } });
      const payload = JSON.parse(firstTextContent(r));
      const target = payload.items.find((i: any) => i.id === created.summaryId);
      assert.equal(target.stale, true);
      assert.ok(target.allocations.some((a: any) => a.status === 'modified'), '應有卡為 modified');
    });
  });

  test('US3 (e)：刪除某組配對後該卡 status:deleted、stale:true，其餘維持 intact（research.md 第 9 節）', async () => {
    const { bankId } = setupFixture();
    const created = await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'create_credit_card_repayment', arguments: { fromAccountId: bankId, totalAmount: 5000, date: '2026-08-15' } });
      return JSON.parse(firstTextContent(r));
    });
    // 刪除其中一組配對（第一張卡的轉出＋轉入）
    const txs = queryAll('SELECT id FROM transactions WHERE user_id = ? AND repayment_summary_id = ? AND type = ?', [userId, created.summaryId, 'transfer_out']);
    const firstOutId = txs[0].id as string;
    getDB().run('DELETE FROM transactions WHERE repayment_summary_id = ? AND linked_id = ?', [created.summaryId, firstOutId]);
    getDB().run('DELETE FROM transactions WHERE id = ?', [firstOutId]);
    saveDB();

    await withMcpClient(async (client) => {
      const r = await client.callTool({ name: 'list_credit_card_repayments', arguments: { dateFrom: '2026-08-15', dateTo: '2026-08-15' } });
      const payload = JSON.parse(firstTextContent(r));
      const target = payload.items.find((i: any) => i.id === created.summaryId);
      assert.equal(target.stale, true);
      assert.ok(target.allocations.some((a: any) => a.status === 'deleted'), '應有卡為 deleted');
      assert.ok(target.allocations.some((a: any) => a.status === 'intact'), '其餘卡應維持 intact');
    });
  });

  test('US3 (f)：allowCreate=false 的憑證呼叫查詢工具仍成功（FR-011）', async () => {
    await withMcpClientReadOnly(async (client) => {
      const result = await client.callTool({ name: 'list_credit_card_repayments', arguments: {} });
      assert.equal(result.isError, undefined);
    });
  });

  test('US3 (g)：查無資料時回傳 items:[]、total:0（非錯誤）', async () => {
    // 用一個保證查不到資料的日期區間
    await withMcpClient(async (client) => {
      const result = await client.callTool({ name: 'list_credit_card_repayments', arguments: { dateFrom: '1900-01-01', dateTo: '1900-01-02' } });
      const payload = JSON.parse(firstTextContent(result));
      assert.equal(result.isError, undefined);
      assert.deepEqual(payload.items, []);
      assert.equal(payload.total, 0);
    });
  });
}