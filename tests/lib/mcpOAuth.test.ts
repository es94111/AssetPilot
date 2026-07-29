import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after } from 'node:test';
import {
  MCP_OAUTH_SCOPE,
  McpOAuthError,
  derivePkceChallenge,
  getMcpOAuthUrls,
  isMcpHttpOriginAllowed,
  isClientIdMetadataDocumentUrl,
  isPublicMetadataIp,
  mcpRedirectUriMatches,
  normalizeMcpOAuthClientMetadata,
  parseMcpOAuthScopes,
  resolveMcpOAuthOrigin,
  validateClientIdMetadataDocument,
  validateMcpResource,
  validateMcpRedirectUri,
  verifyPkce,
} from '../../lib/mcpOAuthCore.ts';
import {
  createMcpAuthorizationServerMetadata,
  createMcpProtectedResourceMetadata,
} from '../../lib/mcpOAuthMetadata.ts';
import { safeOAuthReturnTo } from '../../lib/loginReturn.ts';

const RFC_7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

test('PKCE S256 使用 RFC 7636 向量並拒絕無效 verifier', () => {
  assert.equal(derivePkceChallenge(RFC_7636_VERIFIER), RFC_7636_CHALLENGE);
  assert.equal(verifyPkce(RFC_7636_VERIFIER, RFC_7636_CHALLENGE), true);
  assert.equal(verifyPkce(RFC_7636_VERIFIER, 'A'.repeat(43)), false);
  assert.throws(() => derivePkceChallenge('short'), (error: unknown) =>
    error instanceof McpOAuthError && error.code === 'invalid_grant'
  );
});

test('DCR client metadata 僅允許 public authorization-code client 與安全 redirect URI', () => {
  const client = normalizeMcpOAuthClientMetadata({
    redirect_uris: ['https://client.example/callback', 'http://127.0.0.1:49152/callback'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_name: 'Example MCP Client',
  });
  assert.equal(client.token_endpoint_auth_method, 'none');
  assert.deepEqual(client.grant_types, ['authorization_code', 'refresh_token']);
  assert.equal(client.scope, MCP_OAUTH_SCOPE);

  assert.throws(
    () => normalizeMcpOAuthClientMetadata({
      redirect_uris: ['https://client.example/callback'],
      token_endpoint_auth_method: 'client_secret_basic',
    }),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_client_metadata'
  );
  assert.equal(
    mcpRedirectUriMatches('http://127.0.0.1:54321/callback', 'http://127.0.0.1:3000/callback'),
    true
  );
  assert.equal(
    mcpRedirectUriMatches('https://client.example:54321/callback', 'https://client.example:3000/callback'),
    false
  );
  assert.equal(
    mcpRedirectUriMatches('http://localhost:54321/callback', 'http://localhost:3000/callback'),
    false
  );
  assert.equal(
    mcpRedirectUriMatches('https://127.0.0.1:54321/callback', 'https://127.0.0.1:3000/callback'),
    false
  );
  assert.equal(
    validateMcpRedirectUri('https://client.example:443/callback'),
    'https://client.example:443/callback'
  );
  assert.throws(
    () => validateMcpRedirectUri('http://client.example/callback'),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_redirect_uri'
  );
  assert.throws(
    () => validateMcpRedirectUri('https://client.example/callback#fragment'),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_redirect_uri'
  );
});

test('Client ID Metadata Document 驗證 URL、必填欄位、精確 client_id 與無 shared secret', () => {
  const clientId = 'https://client.example/oauth/client-metadata.json';
  assert.equal(isClientIdMetadataDocumentUrl(clientId), true);
  assert.equal(isClientIdMetadataDocumentUrl('https://client.example/'), false);
  assert.equal(isClientIdMetadataDocumentUrl('https://127.0.0.1/client.json'), false);
  assert.equal(isClientIdMetadataDocumentUrl(`${clientId}?version=1`), false);

  const client = validateClientIdMetadataDocument(clientId, {
    client_id: clientId,
    client_name: 'Metadata Client',
    redirect_uris: ['https://client.example/callback'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
  assert.equal(client.client_id, clientId);
  assert.equal(client.client_name, 'Metadata Client');

  assert.throws(
    () => validateClientIdMetadataDocument(clientId, {
      client_id: 'https://attacker.example/client.json',
      client_name: 'Wrong Client',
      redirect_uris: ['https://client.example/callback'],
    }),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_client'
  );
  assert.throws(
    () => validateClientIdMetadataDocument(clientId, {
      client_id: clientId,
      client_name: 'Secret Client',
      client_secret: 'must-not-be-here',
      redirect_uris: ['https://client.example/callback'],
    }),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_client'
  );
});

test('Client metadata SSRF 防護只接受公開 IP', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '100.64.0.1',
    '192.0.2.10',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
  ]) {
    assert.equal(isPublicMetadataIp(address), false, address);
  }
  assert.equal(isPublicMetadataIp('1.1.1.1'), true);
  assert.equal(isPublicMetadataIp('2606:4700:4700::1111'), true);
});

test('scope 與 resource 均 fail closed', () => {
  assert.deepEqual(parseMcpOAuthScopes('mcp:read'), ['mcp:read']);
  assert.throws(
    () => parseMcpOAuthScopes('mcp:read mcp:write'),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_scope'
  );
  assert.equal(
    validateMcpResource('https://asset.example/api/mcp', 'https://asset.example/api/mcp'),
    'https://asset.example/api/mcp'
  );
  assert.equal(
    validateMcpResource('HTTPS://ASSET.EXAMPLE/api/mcp', 'https://asset.example/api/mcp'),
    'https://asset.example/api/mcp'
  );
  assert.throws(
    () => validateMcpResource('https://other.example/api/mcp', 'https://asset.example/api/mcp'),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_request'
  );
});

test('MCP Streamable HTTP Origin 僅允許同源或精確 allowlist，原生 client 可省略 Origin', () => {
  assert.equal(isMcpHttpOriginAllowed(null, 'https://asset.example'), true);
  assert.equal(isMcpHttpOriginAllowed('https://asset.example', 'https://asset.example'), true);
  assert.equal(
    isMcpHttpOriginAllowed('https://mcp-client.example', 'https://asset.example', 'https://mcp-client.example'),
    true
  );
  assert.equal(isMcpHttpOriginAllowed('https://evil.example', 'https://asset.example'), false);
  assert.equal(isMcpHttpOriginAllowed('null', 'https://asset.example'), false);
  assert.equal(isMcpHttpOriginAllowed('https://asset.example/path', 'https://asset.example'), false);
});

test('canonical origin 正式環境必須顯式設定 HTTPS，local development 才可用 HTTP', () => {
  assert.equal(resolveMcpOAuthOrigin({
    configuredOrigin: 'https://asset.example/some/path',
    nodeEnv: 'production',
  }), 'https://asset.example');
  assert.throws(
    () => resolveMcpOAuthOrigin({ configuredOrigin: '', nodeEnv: 'production' }),
    (error: unknown) => error instanceof McpOAuthError && error.code === 'server_error'
  );
  assert.equal(resolveMcpOAuthOrigin({
    requestOrigin: 'http://localhost:3000',
    headers: { get: () => null },
    nodeEnv: 'development',
  }), 'http://localhost:3000');
});

test('discovery metadata 宣告 MCP resource、PKCE、CIMD 與 DCR fallback', () => {
  const urls = getMcpOAuthUrls({
    configuredOrigin: 'https://asset.example',
    nodeEnv: 'production',
  });
  const resource = createMcpProtectedResourceMetadata(urls);
  const authorization = createMcpAuthorizationServerMetadata(urls);
  assert.equal(resource.resource, 'https://asset.example/api/mcp');
  assert.deepEqual(resource.authorization_servers, ['https://asset.example']);
  assert.deepEqual(resource.scopes_supported, [MCP_OAUTH_SCOPE]);
  assert.equal(resource.resource_documentation, 'https://asset.example/mcp');
  assert.deepEqual(authorization.code_challenge_methods_supported, ['S256']);
  assert.equal(authorization.client_id_metadata_document_supported, true);
  assert.equal(authorization.registration_endpoint, 'https://asset.example/api/oauth/register');
  assert.deepEqual(authorization.token_endpoint_auth_methods_supported, ['none']);
  assert.equal(authorization.service_documentation, 'https://asset.example/mcp');
});

test('登入 returnTo 只接受本機 /oauth/authorize', () => {
  const valid = '/oauth/authorize?client_id=abc&state=123';
  assert.equal(safeOAuthReturnTo(valid), valid);
  assert.equal(safeOAuthReturnTo('//evil.example/oauth/authorize'), '');
  assert.equal(safeOAuthReturnTo('https://evil.example/oauth/authorize'), '');
  assert.equal(safeOAuthReturnTo('/dashboard'), '');
});

test('MCP endpoint 在 production 未設定 APP_URL 時保留 PAT-only 401，且拒絕非白名單 Origin', async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.APP_URL;
  const previousPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.APP_URL;
    delete mutableEnv.NEXT_PUBLIC_APP_URL;
    const [{ NextRequest }, mcpRoute] = await Promise.all([
      import('next/server'),
      import('../../app/api/mcp/route.ts'),
    ]);

    const unauthenticated = await mcpRoute.POST(new NextRequest('https://asset.example/api/mcp', {
      method: 'POST',
    }));
    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.headers.get('www-authenticate') || '', /^Bearer scope="mcp:read"/);

    mutableEnv.APP_URL = 'https://asset.example';
    const invalidAuthorization = await mcpRoute.POST(new NextRequest('https://asset.example/api/mcp', {
      method: 'POST',
      headers: { Authorization: 'Basic invalid' },
    }));
    const challenge = invalidAuthorization.headers.get('www-authenticate') || '';
    assert.equal(invalidAuthorization.status, 401);
    assert.match(
      challenge,
      /resource_metadata="https:\/\/asset\.example\/\.well-known\/oauth-protected-resource\/api\/mcp"/
    );
    assert.match(challenge, /scope="mcp:read"/);
    assert.match(challenge, /error="invalid_token"/);
    assert.match(challenge, /error_description="The access token is invalid, expired, or revoked"/);
    assert.match(
      invalidAuthorization.headers.get('access-control-expose-headers') || '',
      /WWW-Authenticate/i
    );

    const rejectedOrigin = await mcpRoute.OPTIONS(new NextRequest('https://asset.example/api/mcp', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    }));
    assert.equal(rejectedOrigin.status, 403);
  } finally {
    if (previousNodeEnv == null) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousAppUrl == null) delete mutableEnv.APP_URL;
    else mutableEnv.APP_URL = previousAppUrl;
    if (previousPublicAppUrl == null) delete mutableEnv.NEXT_PUBLIC_APP_URL;
    else mutableEnv.NEXT_PUBLIC_APP_URL = previousPublicAppUrl;
  }
});

test('OAuth token endpoint 拒絕重複安全參數，不需查詢 client', async () => {
  const [{ NextRequest }, tokenRoute] = await Promise.all([
    import('next/server'),
    import('../../app/api/oauth/token/route.ts'),
  ]);
  const response = await tokenRoute.POST(new NextRequest('https://asset.example/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&grant_type=refresh_token&client_id=test',
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_request');
});

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('MCP OAuth DB lifecycle（略過：未設定 DATABASE_URL/POSTGRES_URL）', () => {});
} else {
  const { initDB, getDB } = await import('../../lib/db.ts');
  await initDB();
  after(() => { getDB().close(); });
  const {
    exchangeMcpAuthorizationCode,
    exchangeMcpRefreshToken,
    issueMcpAuthorizationCode,
    registerMcpOAuthClient,
    revokeMcpOAuthToken,
    verifyMcpOAuthAccessToken,
  } = await import('../../lib/mcpOAuth.ts');

  test('authorization code 單次兌換、access audience、refresh rotation/replay 與 revoke', () => {
    const userId = `test_mcpoauth_${crypto.randomUUID().replaceAll('-', '')}`;
    const email = `${userId}@example.test`;
    const expectedResource = 'https://asset.example/api/mcp';
    let clientId = '';
    try {
      getDB().run(
        `INSERT INTO users (id, email, password_hash, display_name, created_at, is_active)
         VALUES (?,?,?,?,?,1)`,
        [userId, email, 'test-only', 'OAuth Test User', '2026-07-29']
      );
      const client = registerMcpOAuthClient({
        redirect_uris: ['https://client.example/callback'],
        token_endpoint_auth_method: 'none',
        client_name: 'OAuth Test Client',
      });
      clientId = client.client_id;

      const code = issueMcpAuthorizationCode({
        userId,
        client,
        redirectUri: client.redirect_uris[0],
        codeChallenge: RFC_7636_CHALLENGE,
        scopes: [MCP_OAUTH_SCOPE],
        resource: expectedResource,
      });
      const firstTokens = exchangeMcpAuthorizationCode({
        client,
        code,
        codeVerifier: RFC_7636_VERIFIER,
        redirectUri: client.redirect_uris[0],
        resource: expectedResource,
        expectedResource,
      });
      assert.equal(firstTokens.token_type, 'Bearer');
      assert.ok(firstTokens.access_token.startsWith('ap_mcp_oauth_access_'));
      assert.ok(firstTokens.refresh_token?.startsWith('ap_mcp_oauth_refresh_'));
      assert.equal(verifyMcpOAuthAccessToken(firstTokens.access_token, expectedResource)?.userId, userId);
      assert.equal(verifyMcpOAuthAccessToken(firstTokens.access_token, 'https://other.example/api/mcp'), null);
      assert.throws(
        () => exchangeMcpAuthorizationCode({
          client,
          code,
          codeVerifier: RFC_7636_VERIFIER,
          redirectUri: client.redirect_uris[0],
          resource: expectedResource,
          expectedResource,
        }),
        (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_grant'
      );

      const rotatedTokens = exchangeMcpRefreshToken({
        client,
        refreshToken: firstTokens.refresh_token!,
        resource: expectedResource,
        expectedResource,
      });
      assert.equal(verifyMcpOAuthAccessToken(rotatedTokens.access_token, expectedResource)?.userId, userId);
      assert.throws(
        () => exchangeMcpRefreshToken({
          client,
          refreshToken: firstTokens.refresh_token!,
          resource: expectedResource,
          expectedResource,
        }),
        (error: unknown) => error instanceof McpOAuthError && error.code === 'invalid_grant'
      );
      assert.equal(verifyMcpOAuthAccessToken(rotatedTokens.access_token, expectedResource), null);

      const secondCode = issueMcpAuthorizationCode({
        userId,
        client,
        redirectUri: client.redirect_uris[0],
        codeChallenge: RFC_7636_CHALLENGE,
        scopes: [MCP_OAUTH_SCOPE],
        resource: expectedResource,
      });
      const revocableTokens = exchangeMcpAuthorizationCode({
        client,
        code: secondCode,
        codeVerifier: RFC_7636_VERIFIER,
        redirectUri: client.redirect_uris[0],
        resource: expectedResource,
        expectedResource,
      });
      revokeMcpOAuthToken(client, revocableTokens.access_token);
      assert.equal(verifyMcpOAuthAccessToken(revocableTokens.access_token, expectedResource), null);
    } finally {
      getDB().run('DELETE FROM mcp_oauth_authorization_codes WHERE user_id = ?', [userId]);
      getDB().run('DELETE FROM mcp_oauth_tokens WHERE user_id = ?', [userId]);
      if (clientId) getDB().run('DELETE FROM mcp_oauth_clients WHERE client_id = ?', [clientId]);
      getDB().run('DELETE FROM users WHERE id = ?', [userId]);
    }
  });
}
