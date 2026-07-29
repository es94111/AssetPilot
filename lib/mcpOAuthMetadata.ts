import { MCP_OAUTH_SCOPE, type getMcpOAuthUrls } from './mcpOAuthCore';

type McpOAuthUrls = ReturnType<typeof getMcpOAuthUrls>;

export function createMcpProtectedResourceMetadata(urls: McpOAuthUrls) {
  return {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    scopes_supported: [MCP_OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'AssetPilot MCP',
    resource_documentation: `${urls.origin}/mcp`,
  };
}

export function createMcpAuthorizationServerMetadata(urls: McpOAuthUrls) {
  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorizationEndpoint,
    token_endpoint: urls.tokenEndpoint,
    registration_endpoint: urls.registrationEndpoint,
    revocation_endpoint: urls.revocationEndpoint,
    scopes_supported: [MCP_OAUTH_SCOPE],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: true,
    service_documentation: `${urls.origin}/mcp`,
  };
}
