import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { MCP_OAUTH_SCOPE } from '../../lib/mcpOAuthCore.ts';
import { OpenAiCompatibleMcpTransport } from '../../lib/mcpOpenAiCompatibility.ts';
import { buildMcpServer } from '../../lib/mcpServer.ts';

const EXPECTED_TOOL_NAMES = [
  'get_stock_realized_pl',
  'get_transactions_summary',
  'list_accounts',
  'list_budgets',
  'list_categories',
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
