import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { MCP_OAUTH_SCOPE } from '../../lib/mcpOAuthCore.ts';
import { OpenAiCompatibleMcpTransport } from '../../lib/mcpOpenAiCompatibility.ts';
import { buildMcpServer } from '../../lib/mcpServer.ts';

const EXPECTED_TOOL_NAMES = [
  'get_credit_card_repayment_preview',
  'get_stock_realized_pl',
  'get_transactions_summary',
  'list_accounts',
  'list_budgets',
  'list_categories',
  'list_credit_card_repayments',
  'list_recurring',
  'list_stock_dividends',
  'list_stock_holdings',
  'list_stock_recurring',
  'list_stock_transactions',
  'list_transactions',
];

function isToolListResponse(message: JSONRPCMessage): message is JSONRPCMessage & {
  result: { tools: Array<Record<string, unknown>> };
} {
  if (!('result' in message) || typeof message.result !== 'object' || message.result === null) {
    return false;
  }
  return Array.isArray((message.result as Record<string, unknown>).tools);
}

test('tools/list 輸出 OpenAI OAuth descriptor、相容鏡像與唯讀 annotations', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const rawServerMessages: JSONRPCMessage[] = [];
  const originalSend = serverTransport.send.bind(serverTransport);
  serverTransport.send = async (message, options) => {
    rawServerMessages.push(message);
    await originalSend(message, options);
  };

  const server = buildMcpServer({
    credentialId: 'descriptor-test',
    userId: 'descriptor-user',
    name: 'Descriptor Test',
  });
  const client = new Client({ name: 'assetpilot-descriptor-test', version: '1.0.0' });

  try {
    await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
    await client.connect(clientTransport);
    const listed = await client.listTools();

    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), EXPECTED_TOOL_NAMES);
    for (const tool of listed.tools) {
      assert.equal(typeof tool.title, 'string', `${tool.name} title`);
      assert.ok(tool.title && tool.title.length > 0, `${tool.name} non-empty title`);
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} readOnlyHint`);
      assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} destructiveHint`);
      assert.equal(tool.annotations?.openWorldHint, false, `${tool.name} openWorldHint`);
      assert.deepEqual(
        tool._meta?.securitySchemes,
        [{ type: 'oauth2', scopes: [MCP_OAUTH_SCOPE] }],
        `${tool.name} _meta.securitySchemes`
      );
      for (const key of ['openai/toolInvocation/invoking', 'openai/toolInvocation/invoked']) {
        const invocationValue: unknown = (tool._meta as Record<string, unknown> | undefined)?.[key];
        assert.equal(typeof invocationValue, 'string', `${tool.name} ${key}`);
        assert.ok(String(invocationValue).length <= 64, `${tool.name} ${key} length`);
      }
    }

    const rawListResponse = rawServerMessages.find(isToolListResponse);
    assert.ok(rawListResponse, 'raw tools/list response');
    for (const tool of rawListResponse.result.tools) {
      const meta = tool._meta as Record<string, unknown>;
      assert.deepEqual(
        tool.securitySchemes,
        meta.securitySchemes,
        `${String(tool.name)} top-level securitySchemes mirrors _meta`
      );
      assert.deepEqual(
        tool.securitySchemes,
        [{ type: 'oauth2', scopes: [MCP_OAUTH_SCOPE] }],
        `${String(tool.name)} OAuth scope`
      );
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('allowCreate=true 的憑證 tools/list 額外出現 create_transaction，且 annotations 標示可寫非破壞性', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = buildMcpServer({
    credentialId: 'descriptor-test-write',
    userId: 'descriptor-user-write',
    name: 'Descriptor Test (write)',
    allowCreate: true,
  });
  const client = new Client({ name: 'assetpilot-descriptor-test-write', version: '1.0.0' });

  try {
    await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
    await client.connect(clientTransport);
    const listed = await client.listTools();

    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [...EXPECTED_TOOL_NAMES, 'create_transaction', 'create_credit_card_repayment'].sort());

    const createTool = listed.tools.find((tool) => tool.name === 'create_transaction');
    assert.ok(createTool, 'create_transaction 應出現在 tools/list');
    assert.equal(createTool?.annotations?.readOnlyHint, false, 'create_transaction readOnlyHint');
    assert.equal(createTool?.annotations?.destructiveHint, false, 'create_transaction destructiveHint');
    assert.equal(createTool?.annotations?.openWorldHint, false, 'create_transaction openWorldHint');
  } finally {
    await client.close();
    await server.close();
  }
});

test('allowCreate=true 的憑證 tools/list 額外出現 create_credit_card_repayment，且 annotations 標示可寫非破壞性（FR-003）', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = buildMcpServer({
    credentialId: 'descriptor-test-repay',
    userId: 'descriptor-user-repay',
    name: 'Descriptor Test (repay)',
    allowCreate: true,
  });
  const client = new Client({ name: 'assetpilot-descriptor-test-repay', version: '1.0.0' });

  try {
    await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
    await client.connect(clientTransport);
    const listed = await client.listTools();

    const names = listed.tools.map((tool) => tool.name);
    assert.ok(names.includes('create_credit_card_repayment'), 'create_credit_card_repayment 應出現在 tools/list');

    const repayTool = listed.tools.find((tool) => tool.name === 'create_credit_card_repayment');
    assert.ok(repayTool, 'create_credit_card_repayment 應出現在 tools/list');
    assert.equal(repayTool?.annotations?.readOnlyHint, false, 'create_credit_card_repayment readOnlyHint');
    assert.equal(repayTool?.annotations?.destructiveHint, false, 'create_credit_card_repayment destructiveHint');
    assert.equal(repayTool?.annotations?.openWorldHint, false, 'create_credit_card_repayment openWorldHint');
  } finally {
    await client.close();
    await server.close();
  }
});

test('allowCreate 未開啟的憑證 tools/list 不含 create_credit_card_repayment（FR-003）', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = buildMcpServer({
    credentialId: 'descriptor-test-repay-none',
    userId: 'descriptor-user-repay-none',
    name: 'Descriptor Test (repay none)',
  });
  const client = new Client({ name: 'assetpilot-descriptor-test-repay-none', version: '1.0.0' });

  try {
    await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
    await client.connect(clientTransport);
    const listed = await client.listTools();

    const names = listed.tools.map((tool) => tool.name);
    assert.ok(!names.includes('create_credit_card_repayment'), '未開 allowCreate 時不應出現 create_credit_card_repayment');
    // 但兩個唯讀工具仍應存在（FR-009、FR-011：唯讀工具不受 allowCreate 影響）
    assert.ok(names.includes('get_credit_card_repayment_preview'), 'get_credit_card_repayment_preview 無條件註冊');
    assert.ok(names.includes('list_credit_card_repayments'), 'list_credit_card_repayments 無條件註冊');
  } finally {
    await client.close();
    await server.close();
  }
});

test('allowUpdateNote=true 的憑證 tools/list 額外出現 update_transaction_note（不含 create_transaction），且 annotations 標示破壞性冪等', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = buildMcpServer({
    credentialId: 'descriptor-test-update',
    userId: 'descriptor-user-update',
    name: 'Descriptor Test (update)',
    allowUpdateNote: true,
  });
  const client = new Client({ name: 'assetpilot-descriptor-test-update', version: '1.0.0' });

  try {
    await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
    await client.connect(clientTransport);
    const listed = await client.listTools();

    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [...EXPECTED_TOOL_NAMES, 'update_transaction_note'].sort());
    // 不含 create_transaction（未開 allowCreate）
    assert.ok(!names.includes('create_transaction'), '不應出現 create_transaction');

    const updateTool = listed.tools.find((tool) => tool.name === 'update_transaction_note');
    assert.ok(updateTool, 'update_transaction_note 應出現在 tools/list');
    assert.equal(updateTool?.annotations?.readOnlyHint, false, 'update_transaction_note readOnlyHint');
    assert.equal(updateTool?.annotations?.destructiveHint, true, 'update_transaction_note destructiveHint（覆寫既有值，與 create_transaction 的刻意差異）');
    assert.equal(updateTool?.annotations?.idempotentHint, true, 'update_transaction_note idempotentHint');
    assert.equal(updateTool?.annotations?.openWorldHint, false, 'update_transaction_note openWorldHint');
  } finally {
    await client.close();
    await server.close();
  }
});

test('權限獨立性：allowCreate=true 但未開 allowUpdateNote 時不含 update_transaction_note；兩者皆開時兩工具同時存在', async () => {
  // 只開 allowCreate —— 不含 update_transaction_note
  {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer({
      credentialId: 'indep-create-only',
      userId: 'indep-user-create',
      name: 'Indep (create only)',
      allowCreate: true,
    });
    const client = new Client({ name: 'indep-create-only', version: '1.0.0' });
    try {
      await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
      await client.connect(clientTransport);
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name);
      assert.ok(names.includes('create_transaction'), '應含 create_transaction');
      assert.ok(!names.includes('update_transaction_note'), '不應含 update_transaction_note');
    } finally {
      await client.close();
      await server.close();
    }
  }

  // 兩者皆開 —— 兩工具同時存在
  {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer({
      credentialId: 'indep-both',
      userId: 'indep-user-both',
      name: 'Indep (both)',
      allowCreate: true,
      allowUpdateNote: true,
    });
    const client = new Client({ name: 'indep-both', version: '1.0.0' });
    try {
      await server.connect(new OpenAiCompatibleMcpTransport(serverTransport));
      await client.connect(clientTransport);
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name);
      assert.ok(names.includes('create_transaction'), '應含 create_transaction');
      assert.ok(names.includes('update_transaction_note'), '應含 update_transaction_note');
    } finally {
      await client.close();
      await server.close();
    }
  }
});
