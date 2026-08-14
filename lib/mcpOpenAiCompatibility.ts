import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import { MCP_OAUTH_SCOPE } from './mcpOAuthCore';

export interface McpOAuthSecurityScheme {
  type: 'oauth2';
  scopes: string[];
}

export const MCP_OAUTH_SECURITY_SCHEMES: McpOAuthSecurityScheme[] = [
  { type: 'oauth2', scopes: [MCP_OAUTH_SCOPE] },
];

const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

// destructiveHint: false — 此工具只新增，不覆寫既有資料。
const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

/**
 * OpenAI clients read the standard tool fields plus a back-compat auth mirror
 * from `_meta`. The top-level securitySchemes extension is injected at the
 * transport boundary because MCP SDK 1.30 does not retain that config field.
 */
export function createReadOnlyOAuthToolDescriptor(
  title: string,
  invoking: string,
  invoked: string
) {
  return {
    title,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    _meta: {
      securitySchemes: MCP_OAUTH_SECURITY_SCHEMES,
      'openai/toolInvocation/invoking': invoking,
      'openai/toolInvocation/invoked': invoked,
    },
  };
}

export function createWriteOAuthToolDescriptor(
  title: string,
  invoking: string,
  invoked: string
) {
  return {
    title,
    annotations: WRITE_TOOL_ANNOTATIONS,
    _meta: {
      securitySchemes: MCP_OAUTH_SECURITY_SCHEMES,
      'openai/toolInvocation/invoking': invoking,
      'openai/toolInvocation/invoked': invoked,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Adds OpenAI's top-level securitySchemes extension to raw tools/list results.
 * The source of truth remains `_meta.securitySchemes`, so both placements are
 * always byte-for-byte equivalent in the serialized response.
 */
export function addOpenAiToolSecuritySchemes<T extends JSONRPCMessage>(message: T): T {
  if (!isRecord(message) || !('result' in message) || !isRecord(message.result)) {
    return message;
  }
  const tools = message.result.tools;
  if (!Array.isArray(tools)) return message;

  let changed = false;
  const enrichedTools = tools.map((tool) => {
    if (!isRecord(tool) || !isRecord(tool._meta) || !Array.isArray(tool._meta.securitySchemes)) {
      return tool;
    }
    changed = true;
    return {
      ...tool,
      securitySchemes: tool._meta.securitySchemes,
    };
  });
  if (!changed) return message;

  return {
    ...message,
    result: {
      ...message.result,
      tools: enrichedTools,
    },
  } as T;
}

/**
 * Transparent transport decorator used only to preserve OpenAI descriptor
 * extensions that the upstream high-level McpServer currently strips.
 */
export class OpenAiCompatibleMcpTransport implements Transport {
  onclose?: Transport['onclose'];
  onerror?: Transport['onerror'];
  onmessage?: Transport['onmessage'];

  constructor(private readonly inner: Transport) {}

  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }

  async start(): Promise<void> {
    this.inner.onclose = () => this.onclose?.();
    this.inner.onerror = (error) => this.onerror?.(error);
    this.inner.onmessage = (message, extra) => this.onmessage?.(message, extra);
    await this.inner.start();
  }

  send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    return this.inner.send(addOpenAiToolSecuritySchemes(message), options);
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  setProtocolVersion(version: string): void {
    this.inner.setProtocolVersion?.(version);
  }
}
