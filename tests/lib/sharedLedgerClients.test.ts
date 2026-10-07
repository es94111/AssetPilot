// tests/lib/sharedLedgerClients.test.ts — issue #281 整合層測試
// 驗證非 Web 用戶端（MCP、API Token、LINE、排程通知、個人 bundle）在共享帳本下的
// 選取、跨帳本隔離、離開／撤銷後的即時失效，以及 viewer 的寫入邊界。
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過，維持 `npm test`
// 在無 DB 環境仍可通過。
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('sharedLedgerClients（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  // 測試會經由已驗證請求觸發 triggerUserRequestMaintenance()，其內部以
  // fire-and-forget 方式呼叫股價自動更新；停用以避免測試環境對外發出真實
  // 股價 API 請求（與 tests/lib/sharedLedger.test.ts 既有慣例一致）。
  process.env.STOCK_AUTO_UPDATE_ENABLED = 'false';
  // 要實際呼叫 app/api/line/webhook/route.ts 的 POST（而非只測 schema），需要讓
  // lib/lineMessaging.ts 於模組載入時讀到非空密鑰；這兩個常數在該模組載入時
  // 就會被求值快取，必須在任何 import 之前設定完成。
  process.env.LINE_MESSAGING_CHANNEL_SECRET = 'test_281_line_channel_secret';
  process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = 'test_281_line_channel_access_token';

  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createSharedLedger } = await import('../../lib/ledgerCore.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { resolveLedgerScope, listAuthorizedLedgers } = await import('../../lib/ledgerScope.ts');
  const { createMcpCredential } = await import('../../lib/mcpAuth.ts');
  const { createApiToken } = await import('../../lib/apiTokenAuth.ts');
  const { buildMcpServer } = await import('../../lib/mcpServer.ts');
  const { OpenAiCompatibleMcpTransport } = await import('../../lib/mcpOpenAiCompatibility.ts');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { NextRequest } = await import('next/server');

  await initDB();

  const db = getDB();
  const owner = `t281_owner_${uid()}`;
  const editor = `t281_editor_${uid()}`;
  const viewer = `t281_viewer_${uid()}`;
  const outsider = `t281_outsider_${uid()}`;
  const people = [owner, editor, viewer, outsider];
  const tokens = new Map<string, string>();
  let ledgerId = '';
  let dataOwner = '';

  const request = (person: string, path: string, method = 'GET', body?: unknown, ledger = '') => new NextRequest(
    `http://localhost${path}`,
    {
      method,
      headers: {
        Cookie: `authToken=${tokens.get(person)}`,
        Origin: 'http://localhost',
        'Content-Type': 'application/json',
        ...(ledger ? { 'x-ledger-id': ledger } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );

  function addMember(person: string, role: 'editor' | 'viewer') {
    db.run('DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ?', [ledgerId, person]);
    db.run(
      "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
      [ledgerId, person, role, Date.now()],
    );
  }

  function removeMember(person: string) {
    db.run('DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ?', [ledgerId, person]);
  }

  // 以真實 HMAC 簽名送出一個 LINE webhook 事件，實際呼叫 webhook.POST()
  // （而非直接操作 line_bot_states 資料表），用來驗證 handleEvent 內的
  // 帳本解析、getLineBotState／setLineBotState 真的以 ledger_id 分離。
  // 送出期間會攔截 fetch 到 api.line.me 的呼叫，避免測試對外發出真實請求。
  async function postLineEvent(
    webhookModule: { POST: (req: Request) => Promise<Response> },
    event: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({ events: [event] });
    const signature = crypto
      .createHmac('sha256', process.env.LINE_MESSAGING_CHANNEL_SECRET!)
      .update(body)
      .digest('base64');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: unknown) => {
      const href = typeof input === 'string' ? input : (input as { url?: string })?.url || '';
      if (href.includes('api.line.me')) {
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input as never, init as never);
    }) as typeof fetch;
    try {
      const req = new Request('http://localhost/api/line/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-line-signature': signature },
        body,
      });
      const res = await webhookModule.POST(req);
      assert.equal(res.status, 200, `LINE webhook 事件應回 200，實得 ${res.status}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  type McpClient = InstanceType<typeof Client>;

  async function withMcpClient<T>(
    userId: string,
    credentialId: string,
    allowCreate: boolean,
    fn: (client: McpClient) => Promise<T>,
  ): Promise<T> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer({ credentialId, userId, name: '測試憑證', allowCreate });
    const client = new Client({ name: 'assetpilot-ledger-clients-test', version: '1.0.0' });
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

  try {
    for (const person of people) {
      db.run(
        'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
        [person, `${person}@example.com`, 'disabled', person, new Date().toISOString()],
      );
      tokens.set(person, createLoginSession(person, 0, {}).token);
    }
    const created = createSharedLedger(owner, `Ledger #281 ${uid()}`);
    ledgerId = created.id;
    dataOwner = String(queryOne('SELECT data_owner_id FROM financial_ledgers WHERE id = ?', [ledgerId])?.data_owner_id);
    // 共享帳本的資料擁有者是一個獨立的 system user（見 lib/ledgerCore.createSharedLedger），
    // 但 categories/accounts 有 users 外鍵，故先建立對應的使用者列。
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?) ON CONFLICT (id) DO NOTHING',
      [dataOwner, `${dataOwner}@ledger.test`, 'disabled', 'Ledger data owner', new Date().toISOString()],
    );

    // 共享帳本的一筆資料，用來驗證跨帳本隔離與 viewer 可讀不可寫。
    db.run(
      "INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)",
      [uid(), dataOwner, '共享餐飲', 'expense', ''],
    );
    db.run(
      "INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)",
      [uid(), dataOwner, '共享現金', 'TWD', new Date().toISOString()],
    );
    const sharedStockId = uid();
    db.run(
      'INSERT INTO stocks (id, user_id, symbol, market, name, shares, avg_cost, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [sharedStockId, dataOwner, 'TEST281', 'TW', '共享測試股票', 10, 12, 'TWD', Date.now(), Date.now()],
    );
    db.run(
      'INSERT INTO stock_transactions (id, user_id, stock_id, type, shares, price, fee, tax, date, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), dataOwner, sharedStockId, 'buy', 10, 12, 0, 0, '2026-10-01', '共享投資', Date.now()],
    );

    await test('未指定帳本時所有整合沿用個人帳本，行為與過往一致', async () => {
      const scope = resolveLedgerScope({ userId: owner });
      assert.equal(scope.ok, true);
      assert.equal(scope.ok && scope.ledgerId, `personal:${owner}`);
      assert.equal(scope.ok && scope.isShared, false);

      const ledgers = listAuthorizedLedgers(owner);
      assert.ok(ledgers.some((row) => row.ledgerId === `personal:${owner}`));
      assert.ok(ledgers.some((row) => row.ledgerId === ledgerId && row.role === 'owner'));
    });

    await test('viewer 可讀共享帳本但所有寫入路徑都被拒，editor 可寫', async () => {
      addMember(viewer, 'viewer');
      addMember(editor, 'editor');

      const viewerRead = resolveLedgerScope({ userId: viewer, ledgerId });
      assert.equal(viewerRead.ok, true);
      assert.equal(viewerRead.ok && viewerRead.role, 'viewer');

      const viewerWrite = resolveLedgerScope({ userId: viewer, ledgerId, write: true });
      assert.deepEqual(viewerWrite, { ok: false, reason: 'read-only' });

      const editorWrite = resolveLedgerScope({ userId: editor, ledgerId, write: true });
      assert.equal(editorWrite.ok, true);
      assert.equal(editorWrite.ok && editorWrite.role, 'editor');
      // 資料範圍一律落在帳本的資料擁有者，而非呼叫者本人。
      assert.equal(editorWrite.ok && editorWrite.dataOwnerId, dataOwner);
    });

    await test('非成員（含被偽造的帳本 id）一律 fail closed', async () => {
      assert.deepEqual(
        resolveLedgerScope({ userId: outsider, ledgerId }),
        { ok: false, reason: 'not-a-member' },
      );
      assert.deepEqual(
        resolveLedgerScope({ userId: outsider, ledgerId: `personal:${owner}` }),
        { ok: false, reason: 'not-a-member' },
      );
    });

    await test('MCP：明確傳遞 ledgerId 才讀寫共享帳本，viewer 被拒，登入憑證不共享', async () => {
      const editorCred = `t281_mcp_editor_${uid()}`;
      const viewerCred = `t281_mcp_viewer_${uid()}`;
      createMcpCredential(editor, 'editor cred', 0);
      createMcpCredential(viewer, 'viewer cred', 0);

      await withMcpClient(editor, editorCred, true, async (client) => {
        const ledgers = JSON.parse(firstTextContent(await client.callTool({ name: 'list_ledgers', arguments: {} })));
        assert.ok(ledgers.items.some((row: { ledgerId: string }) => row.ledgerId === ledgerId));
        // 未指定帳本時個人帳本為 0 筆（共享帳本的資料不會外洩）。
        const personal = JSON.parse(firstTextContent(
          await client.callTool({ name: 'list_transactions', arguments: {} }),
        ));
        assert.equal(personal.total, 0);
        const sharedAccounts = JSON.parse(firstTextContent(
          await client.callTool({ name: 'list_accounts', arguments: { ledgerId } }),
        ));
        assert.equal(sharedAccounts.total, 1);
        const personalStocks = JSON.parse(firstTextContent(
          await client.callTool({ name: 'list_stock_transactions', arguments: {} }),
        ));
        assert.equal(personalStocks.total, 0);
        const sharedStocks = JSON.parse(firstTextContent(
          await client.callTool({ name: 'list_stock_transactions', arguments: { ledgerId } }),
        ));
        assert.equal(sharedStocks.total, 1);
        assert.equal(sharedStocks.items[0].note, '共享投資');
        const created = JSON.parse(firstTextContent(await client.callTool({
          name: 'create_transaction',
          arguments: { type: 'expense', amount: 88, ledgerId, note: 'MCP 共享記帳' },
        })));
        assert.ok(created.id);
        assert.equal(queryOne('SELECT user_id FROM transactions WHERE id = ?', [created.id])?.user_id, dataOwner);
      });

      await withMcpClient(viewer, viewerCred, true, async (client) => {
        const read = JSON.parse(firstTextContent(
          await client.callTool({ name: 'list_transactions', arguments: { ledgerId } }),
        ));
        assert.equal(read.total, 1);
        const denied = await client.callTool({
          name: 'create_transaction',
          arguments: { type: 'expense', amount: 10, ledgerId, note: 'viewer 不該寫入' },
        });
        assert.equal((denied as { isError?: boolean }).isError, true);
        assert.match(firstTextContent(denied), /唯讀/);
      });

      // 別的成員用同一把 MCP 憑證 id 也無法取得資料：憑證屬於個人，不隨帳本共享。
      await withMcpClient(outsider, editorCred, true, async (client) => {
        const denied = await client.callTool({ name: 'list_transactions', arguments: { ledgerId } });
        assert.equal((denied as { isError?: boolean }).isError, true);
        assert.match(firstTextContent(denied), /找不到帳本或沒有存取權/);
      });
    });

    await test('MCP 冪等鍵以帳本分離：同一鍵在個人帳本與共享帳本各自成立', async () => {
      const credentialId = `t281_mcp_idem_${uid()}`;
      const key = `idem-${uid()}`;
      // owner 的個人帳本需要一個帳戶才能記帳。
      db.run(
        'INSERT INTO accounts (id, user_id, name, currency, created_at) VALUES (?,?,?,?,?)',
        [uid(), owner, '個人現金', 'TWD', new Date().toISOString()],
      );
      await withMcpClient(owner, credentialId, true, async (client) => {
        const personal = JSON.parse(firstTextContent(await client.callTool({
          name: 'create_transaction',
          arguments: { type: 'expense', amount: 11, idempotencyKey: key, note: '個人冪等' },
        })));
        const shared = JSON.parse(firstTextContent(await client.callTool({
          name: 'create_transaction',
          arguments: { type: 'expense', amount: 22, ledgerId, idempotencyKey: key, note: '共享冪等' },
        })));
        assert.notEqual(shared.id, personal.id);
        const sharedRetry = JSON.parse(firstTextContent(await client.callTool({
          name: 'create_transaction',
          arguments: { type: 'expense', amount: 22, ledgerId, idempotencyKey: key, note: '共享冪等' },
        })));
        assert.equal(sharedRetry.id, shared.id);
        assert.equal(
          Number(queryOne(
            'SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ? AND note = ?',
            [dataOwner, '共享冪等'],
          )?.cnt),
          1,
        );
      });
    });

    await test('API Token：ledgerId 明確傳遞、viewer 唯讀、scope 與成員身分都重新檢查', async () => {
      const v1 = await import('../../app/api/v1/transactions/route.ts');
      const { todayInUserTz } = await import('../../lib/userTime.ts');
      const viewerToken = createApiToken(viewer, 'viewer api', ['transactions:read', 'transactions:write']).token;
      const editorToken = createApiToken(editor, 'editor api', ['transactions:read', 'transactions:write']).token;
      const readOnlyToken = createApiToken(editor, 'editor read only', ['transactions:read']).token;

      const authed = (token: string, body?: unknown, method = 'GET') => new NextRequest(
        `http://localhost/api/v1/transactions?ledgerId=${encodeURIComponent(ledgerId)}`,
        {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );

      // 未帶 ledgerId 時看個人帳本（0 筆），帶 ledgerId 才看到共享帳本。
      const personal = await v1.GET(new NextRequest('http://localhost/api/v1/transactions', {
        headers: { Authorization: `Bearer ${editorToken}` },
      }));
      assert.equal((await personal.json()).transactions.length, 0);
      const shared = await v1.GET(authed(editorToken));
      // v1 只回傳一般收支（排除手續費副交易）；以資料庫為準比對筆數，避免依賴先前測試的殘留。
      const expectedShared = Number(queryOne(
        `SELECT COUNT(*) AS cnt FROM transactions
          WHERE user_id = ? AND type IN ('income', 'expense') AND COALESCE(is_fx_fee, 0) = 0`,
        [dataOwner],
      )?.cnt);
      assert.equal((await shared.json()).transactions.length, expectedShared);

      // viewer 讀得到、寫不進去。
      assert.equal((await v1.GET(authed(viewerToken))).status, 200);
      const denied = await v1.POST(authed(viewerToken, { type: 'expense', amount: 5, ledgerId, note: 'viewer api 寫入' }, 'POST'));
      assert.equal(denied.status, 403);

      // scope 不足時仍以 403 拒絕（不能因為帳本授權而放行）。
      const noScope = await v1.POST(authed(readOnlyToken, { type: 'expense', amount: 5, ledgerId }, 'POST'));
      assert.equal(noScope.status, 403);

      // 非成員指定他人共享帳本 → 404，不洩漏帳本存在與否。
      const outsiderToken = createApiToken(outsider, 'outsider api', ['transactions:read', 'transactions:write']).token;
      const forged = await v1.GET(authed(outsiderToken));
      assert.equal(forged.status, 404);

      const created = await v1.POST(authed(editorToken, { type: 'expense', amount: 9, ledgerId, note: 'API 共享記帳' }, 'POST'));
      assert.equal(created.status, 201);
      const createdId = (await created.json()).transaction.id;
      assert.equal(queryOne('SELECT user_id FROM transactions WHERE id = ?', [createdId])?.user_id, dataOwner);

      // Omitted date uses the selected ledger timezone rather than a hard-coded local timezone.
      db.run("UPDATE financial_ledgers SET timezone = 'Pacific/Kiritimati' WHERE id = ?", [ledgerId]);
      const timezoneWrite = await v1.POST(authed(
        editorToken,
        { type: 'expense', amount: 3, ledgerId, note: 'ledger timezone date' },
        'POST',
      ));
      assert.equal(timezoneWrite.status, 201);
      assert.equal(
        (await timezoneWrite.json()).transaction.date,
        todayInUserTz('Pacific/Kiritimati'),
      );
      db.run("UPDATE financial_ledgers SET timezone = 'Asia/Taipei' WHERE id = ?", [ledgerId]);
    });

    await test('離開或被移除後，所有用戶端立即失去共享帳本存取權', async () => {
      const v1 = await import('../../app/api/v1/transactions/route.ts');
      const editorToken = createApiToken(editor, 'editor revoke api', ['transactions:read']).token;
      const before = await v1.GET(new NextRequest(
        `http://localhost/api/v1/transactions?ledgerId=${encodeURIComponent(ledgerId)}`,
        { headers: { Authorization: `Bearer ${editorToken}` } },
      ));
      assert.equal(before.status, 200);

      removeMember(editor);

      const after = await v1.GET(new NextRequest(
        `http://localhost/api/v1/transactions?ledgerId=${encodeURIComponent(ledgerId)}`,
        { headers: { Authorization: `Bearer ${editorToken}` } },
      ));
      assert.equal(after.status, 404);
      assert.deepEqual(
        resolveLedgerScope({ userId: editor, ledgerId }),
        { ok: false, reason: 'not-a-member' },
      );
      assert.ok(!listAuthorizedLedgers(editor).some((row) => row.ledgerId === ledgerId));
      // 資料仍屬帳本，不會因成員離開而搬移或刪除。
      assert.equal(
        Number(queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [dataOwner])?.cnt) > 0,
        true,
      );
    });

    await test('月報去重範圍包含帳本：個人與共享帳本可各自寄送', () => {
      const month = `281-${uid().slice(0, 6)}`;
      for (const targetLedger of [`personal:${owner}`, ledgerId]) {
        db.run(
          `INSERT INTO monthly_report_send_log
           (id, user_id, ledger_id, year_month, schedule_id, sent_at_utc)
           VALUES (?,?,?,?,?,?)`,
          [uid(), owner, targetLedger, month, `rs-${targetLedger}`, new Date().toISOString()],
        );
      }
      assert.equal(
        Number(queryOne(
          'SELECT COUNT(*) AS cnt FROM monthly_report_send_log WHERE user_id = ? AND year_month = ?',
          [owner, month],
        )?.cnt),
        2,
      );
      db.run('DELETE FROM monthly_report_send_log WHERE user_id = ? AND year_month = ?', [owner, month]);
    });

    await test('LINE 對話狀態以帳本分離：不同帳本各自保留自己的草稿（實際呼叫 webhook.POST）', async () => {
      const webhook = await import('../../app/api/line/webhook/route.ts');
      const lineUserId = `t281_line_${uid()}`;
      db.run('UPDATE users SET line_id = ? WHERE id = ?', [lineUserId, owner]);
      const personalLedger = `personal:${owner}`;
      const now = Date.now();
      const replyToken = () => `rt_${uid()}`;

      // 分別在兩個帳本預先建立對話草稿（模擬切換帳本後各自輸入到一半），
      // 兩筆都還沒附照片。
      db.run('DELETE FROM line_bot_states WHERE line_user_id = ?', [lineUserId]);
      db.run(
        `INSERT INTO line_bot_states (line_user_id, user_id, action, tx_type, payload, ledger_id, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [lineUserId, owner, 'record_amount', 'expense', JSON.stringify({ date: '2026-10-01', type: 'expense', amount: 100 }), personalLedger, now],
      );
      db.run(
        `INSERT INTO line_bot_states (line_user_id, user_id, action, tx_type, payload, ledger_id, updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [lineUserId, owner, 'record_amount', 'expense', JSON.stringify({ date: '2026-10-02', type: 'expense', amount: 200 }), ledgerId, now],
      );

      // 1) 真實送出 ledger_select postback 切到共享帳本 → 驗證 setActiveLineLedgerId
      //    真的把選擇寫回去、且下一個事件能讀回來（迴歸測試：曾發生 setter 寫
      //    activeLedgerId、getter 卻讀 ledgerId 的鍵名不一致，導致選擇永遠讀不回來）。
      await postLineEvent(webhook, {
        type: 'postback', replyToken: replyToken(), source: { userId: lineUserId },
        postback: { data: `action=ledger_select&ledger=${encodeURIComponent(ledgerId)}` },
      });

      // 2) 送一張照片事件（不帶 ledger 參數，純粹依賴「上次選取」的帳本）→
      //    應該命中共享帳本的草稿並把照片附加上去，個人帳本草稿不受影響。
      await postLineEvent(webhook, {
        type: 'message', replyToken: replyToken(), source: { userId: lineUserId },
        message: { type: 'image', id: `img_shared_${uid()}` },
      });

      const sharedAfter = JSON.parse(String(queryOne(
        'SELECT payload FROM line_bot_states WHERE line_user_id = ? AND ledger_id = ?',
        [lineUserId, ledgerId],
      )?.payload));
      const personalAfterSharedPhoto = JSON.parse(String(queryOne(
        'SELECT payload FROM line_bot_states WHERE line_user_id = ? AND ledger_id = ?',
        [lineUserId, personalLedger],
      )?.payload));
      assert.equal(sharedAfter.amount, 200, '共享帳本草稿金額應維持不變');
      assert.equal(sharedAfter.linePhotoMessageIds?.length, 1, '照片應附加到目前選取（共享）帳本的草稿');
      assert.equal(personalAfterSharedPhoto.linePhotoMessageIds, undefined, '個人帳本草稿不應被共享帳本的照片事件誤寫');

      // 3) 切回個人帳本，再送一張照片 → 應該命中個人帳本草稿，共享帳本草稿維持剛才的 1 張不變。
      await postLineEvent(webhook, {
        type: 'postback', replyToken: replyToken(), source: { userId: lineUserId },
        postback: { data: `action=ledger_select&ledger=${encodeURIComponent(personalLedger)}` },
      });
      await postLineEvent(webhook, {
        type: 'message', replyToken: replyToken(), source: { userId: lineUserId },
        message: { type: 'image', id: `img_personal_${uid()}` },
      });

      const personalAfter = JSON.parse(String(queryOne(
        'SELECT payload FROM line_bot_states WHERE line_user_id = ? AND ledger_id = ?',
        [lineUserId, personalLedger],
      )?.payload));
      const sharedAfterSwitchBack = JSON.parse(String(queryOne(
        'SELECT payload FROM line_bot_states WHERE line_user_id = ? AND ledger_id = ?',
        [lineUserId, ledgerId],
      )?.payload));
      assert.equal(personalAfter.amount, 100, '個人帳本草稿金額應維持不變');
      assert.equal(personalAfter.linePhotoMessageIds?.length, 1, '照片應附加到切回後目前選取（個人）帳本的草稿');
      assert.equal(sharedAfterSwitchBack.linePhotoMessageIds?.length, 1, '共享帳本草稿不應被切回個人帳本後的照片事件誤寫，應維持原有 1 張');

      db.run('UPDATE users SET line_id = ? WHERE id = ?', ['', owner]);
      db.run('DELETE FROM line_bot_states WHERE line_user_id = ?', [lineUserId]);
    });

    await test('排程通知綁定帳本與接收者：離開後不再寄送共享帳本資料', async () => {
      const { runScheduledReportNow, runLineExpenseReminderNow } = await import('../../lib/scheduler.ts');
      const removed = `t281_sched_removed_${uid()}`;
      db.run(
        'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
        [removed, `${removed}@example.com`, 'disabled', removed, new Date().toISOString()],
      );
      addMember(removed, 'editor');
      const scheduleId = `rs_${uid()}`;
      const nowMs = Date.now();
      db.run(
        `INSERT INTO report_schedules
         (id, user_id, ledger_id, freq, hour, minute, weekday, day_of_month, notify_email, notify_line, enabled, last_run, last_summary, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'',?,?)`,
        [scheduleId, removed, ledgerId, 'daily', 9, 0, 1, 1, 1, 0, 1, nowMs, nowMs],
      );

      // 仍是成員時：可進入寄送流程（缺 Email 服務不算授權失敗）。
      const allowed = await runScheduledReportNow(scheduleId, '測試');
      assert.notEqual(allowed.status, 'unauthorized');

      removeMember(removed);

      const denied = await runScheduledReportNow(scheduleId, '測試');
      assert.equal(denied.status, 'unauthorized');
      assert.match(String(denied.reason), /已失去此帳本權限/);

      // viewer 也不接收共享帳本通知。
      addMember(viewer, 'viewer');
      const viewerScheduleId = `rs_${uid()}`;
      db.run(
        `INSERT INTO report_schedules
         (id, user_id, ledger_id, freq, hour, minute, weekday, day_of_month, notify_email, notify_line, enabled, last_run, last_summary, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'',?,?)`,
        [viewerScheduleId, viewer, ledgerId, 'daily', 9, 0, 1, 1, 1, 0, 1, nowMs, nowMs],
      );
      const viewerDenied = await runScheduledReportNow(viewerScheduleId, '測試');
      assert.equal(viewerDenied.status, 'unauthorized');

      // LINE 支出提醒同樣在寄送當下重新授權。
      const reminderId = `ler_${uid()}`;
      db.run(
        `INSERT INTO line_expense_reminders
         (id, user_id, ledger_id, freq, hour, minute, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,0,'',?,?)`,
        [reminderId, removed, ledgerId, 'daily', 21, 0, 0, 1, 1, nowMs, nowMs],
      );
      const reminderDenied = await runLineExpenseReminderNow(reminderId, '測試');
      assert.equal(reminderDenied.status, 'unauthorized');

      // 未指定帳本的排程沿用個人帳本，維持既有行為（不會被誤判為無權限）。
      const personalScheduleId = `rs_${uid()}`;
      db.run(
        `INSERT INTO report_schedules
         (id, user_id, ledger_id, freq, hour, minute, weekday, day_of_month, notify_email, notify_line, enabled, last_run, last_summary, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'',?,?)`,
        [personalScheduleId, owner, `personal:${owner}`, 'daily', 9, 0, 1, 1, 1, 0, 1, nowMs, nowMs],
      );
      const personal = await runScheduledReportNow(personalScheduleId, '測試');
      assert.notEqual(personal.status, 'unauthorized');

      for (const id of [scheduleId, viewerScheduleId, personalScheduleId]) {
        db.run('DELETE FROM report_schedules WHERE id = ?', [id]);
      }
      db.run('DELETE FROM line_expense_reminders WHERE id = ?', [reminderId]);
    });

    await test('個人 bundle：共享帳本備份／還原需要 owner，成員無法覆寫其他帳本', async () => {
      const { resolveBundleLedger } = await import('../../lib/ledgerScope.ts');
      const { restoreUserBundle } = await import('../../lib/userDataBundle.ts');

      assert.deepEqual(
        resolveBundleLedger({ userId: owner, ledgerId }).ok && resolveBundleLedger({ userId: owner, ledgerId }),
        { ok: true, dataOwnerId: dataOwner, ledgerId, isShared: true },
      );
      assert.deepEqual(
        resolveBundleLedger({ userId: editor, ledgerId }),
        { ok: false, reason: 'not-a-member' },
      );
      addMember(editor, 'editor');
      removeMember(viewer);
      assert.deepEqual(
        resolveBundleLedger({ userId: editor, ledgerId }),
        { ok: false, reason: 'not-owner' },
      );
      addMember(viewer, 'viewer');
      assert.deepEqual(
        resolveBundleLedger({ userId: viewer, ledgerId: [].join('') }),
        { ok: true, dataOwnerId: viewer, ledgerId: `personal:${viewer}`, isShared: false },
      );
      // 非成員連帳本都不該看到（避免以 bundle 探測他人帳本）。
      assert.deepEqual(
        resolveBundleLedger({ userId: outsider, ledgerId }),
        { ok: false, reason: 'not-a-member' },
      );

      // 空 ZIP 對共享帳本的還原必須以 owner 授權失敗收場，且不得寫入任何資料。
      const before = Number(queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [dataOwner])?.cnt);
      await assert.rejects(
        () => restoreUserBundle(outsider, Buffer.from(''), ledgerId),
        /找不到帳本或沒有存取權/,
      );
      await assert.rejects(
        () => restoreUserBundle(editor, Buffer.from(''), ledgerId),
        /只有共享帳本的擁有者/,
      );
      assert.equal(Number(queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [dataOwner])?.cnt), before);
    });

    await test('排程 API：切換帳本與 viewer 邊界', async () => {
      const schedules = await import('../../app/api/user/report-schedules/route.ts');
      const scheduleItem = await import('../../app/api/user/report-schedules/[id]/route.ts');

      // owner 可建立以共享帳本為範圍的排程。
      const created = await schedules.POST(request(owner, '/api/user/report-schedules', 'POST', {
        freq: 'daily',
        ledgerId,
        notifyEmail: true,
      }));
      assert.equal(created.status, 201);
      const body = await created.json();
      assert.equal(body.ledgerId, ledgerId);

      // viewer 不得建立共享帳本排程。
      const viewerDenied = await schedules.POST(request(viewer, '/api/user/report-schedules', 'POST', {
        freq: 'daily',
        ledgerId,
        notifyEmail: true,
      }));
      assert.equal(viewerDenied.status, 403);

      // 非成員指定他人帳本 → 404。
      const outsiderDenied = await schedules.POST(request(outsider, '/api/user/report-schedules', 'POST', {
        freq: 'daily',
        ledgerId,
        notifyEmail: true,
      }));
      assert.equal(outsiderDenied.status, 404);

      // 更新時指定已無權限的帳本 → 404，不會把排程留在無權限帳本。
      // 須由 editor 更新「自己」建立的排程（而非 owner 的排程），否則會先被
      // 路由既有的擁有權檢查（WHERE id = ? AND user_id = ?）擋下 404，
      // 根本不會跑到新增的帳本授權重新檢查，使此案例形同未測試。
      const editorOwnCreated = await schedules.POST(request(editor, '/api/user/report-schedules', 'POST', {
        freq: 'daily',
        ledgerId,
        notifyEmail: true,
      }));
      assert.equal(editorOwnCreated.status, 201);
      const editorOwnBody = await editorOwnCreated.json();
      removeMember(editor);
      const editDenied = await scheduleItem.PUT(
        request(editor, `/api/user/report-schedules/${editorOwnBody.id}`, 'PUT', { ledgerId }),
        { params: Promise.resolve({ id: editorOwnBody.id }) },
      );
      assert.equal(editDenied.status, 404);
      db.run('DELETE FROM report_schedules WHERE id = ?', [editorOwnBody.id]);
      addMember(editor, 'editor');

      const switched = await scheduleItem.PUT(
        request(owner, `/api/user/report-schedules/${body.id}`, 'PUT', { ledgerId: `personal:${owner}` }),
        { params: Promise.resolve({ id: body.id }) },
      );
      assert.equal(switched.status, 200);
      assert.equal((await switched.json()).ledgerId, `personal:${owner}`);

      db.run('DELETE FROM report_schedules WHERE id = ?', [body.id]);
    });
  } finally {
    for (const table of [
      'stock_transactions',
      'stock_dividends',
      'stock_recurring',
      'transactions',
      'categories',
      'accounts',
      'stocks',
      'stock_settings',
    ]) {
      db.run(`DELETE FROM ${table} WHERE user_id = ?`, [dataOwner]);
      for (const person of people) db.run(`DELETE FROM ${table} WHERE user_id = ?`, [person]);
    }
    db.run('DELETE FROM line_bot_states WHERE user_id = ?', [owner]);
    db.run('UPDATE users SET line_id = ? WHERE id = ?', ['', owner]);
    db.run('DELETE FROM mcp_transaction_idempotency WHERE user_id = ?', [dataOwner]);
    db.run('DELETE FROM mcp_credentials WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM api_tokens WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM report_schedules WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM line_expense_reminders WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM data_operation_audit_log WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM login_sessions WHERE user_id IN (?,?,?,?)', [owner, editor, viewer, outsider]);
    db.run('DELETE FROM financial_ledgers WHERE id = ?', [ledgerId]);
    for (const person of people) db.run('DELETE FROM users WHERE id = ?', [person]);
    db.run('DELETE FROM users WHERE id = ?', [dataOwner]);
    db.close();
  }
}
