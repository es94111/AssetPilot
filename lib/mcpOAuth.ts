import crypto from 'node:crypto';
import dns from 'node:dns';
import https from 'node:https';
import {
  MCP_ACCESS_TOKEN_TTL_MS,
  MCP_AUTHORIZATION_CODE_TTL_MS,
  MCP_OAUTH_SCOPE,
  MCP_REFRESH_TOKEN_TTL_MS,
  McpOAuthError,
  isClientIdMetadataDocumentUrl,
  isPublicMetadataIp,
  mcpRedirectUriMatches,
  normalizeMcpOAuthClientMetadata,
  parseMcpOAuthScopes,
  validateClientIdMetadataDocument,
  validateMcpResource,
  validatePkceChallenge,
  verifyPkce,
  type McpOAuthClient,
  type McpOAuthClientMetadata,
} from './mcpOAuthCore';
import { getDB, queryOne, saveDB } from './db';
import { uid } from './userDefaults';
import type { VerifyMcpTokenResult } from './mcpAuth';

const ACCESS_TOKEN_PREFIX = 'ap_mcp_oauth_access_';
const REFRESH_TOKEN_PREFIX = 'ap_mcp_oauth_refresh_';
const AUTHORIZATION_CODE_PREFIX = 'ap_mcp_oauth_code_';
const CLIENT_METADATA_MAX_BYTES = 5 * 1024;
const CLIENT_METADATA_TIMEOUT_MS = 5_000;
const CLIENT_METADATA_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const CLIENT_METADATA_CACHE_MAX_ENTRIES = 500;
const MAX_REGISTERED_OAUTH_CLIENTS = 10_000;
const UNUSED_CLIENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface OAuthClientRow {
  client_id: string | number;
  client_id_issued_at: string | number | null;
  redirect_uris: string | number;
  token_endpoint_auth_method: string | number;
  grant_types: string | number;
  response_types: string | number;
  client_name: string | number;
  client_uri: string | number | null;
  logo_uri: string | number | null;
  scope: string | number;
}

interface AuthorizationCodeRow {
  code_hash: string | number;
  user_id: string | number;
  client_id: string | number;
  client_name: string | number;
  redirect_uri: string | number;
  code_challenge: string | number;
  resource: string | number;
  scope: string | number;
  expires_at: string | number;
  consumed_at: string | number | null;
}

interface OAuthTokenRow {
  token_hash: string | number;
  token_type: string | number;
  family_id: string | number;
  user_id: string | number;
  client_id: string | number;
  client_name: string | number;
  resource: string | number;
  scope: string | number;
  expires_at: string | number;
  revoked_at: string | number | null;
  replaced_by_hash: string | number | null;
  user_is_active?: string | number | null;
}

interface CachedClientMetadata {
  expiresAt: number;
  client: McpOAuthClient;
}

export interface McpOAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

const clientMetadataCache = new Map<string, CachedClientMetadata>();
const clientMetadataLoads = new Map<string, Promise<McpOAuthClient>>();
let lastOAuthPruneAt = 0;

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function randomOpaqueValue(prefix: string): string {
  return prefix + crypto.randomBytes(32).toString('base64url');
}

function parseJsonArray(value: string | number | null): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function clientFromRow(row: OAuthClientRow): McpOAuthClient {
  return {
    client_id: String(row.client_id),
    client_id_issued_at: Number(row.client_id_issued_at) || undefined,
    redirect_uris: parseJsonArray(row.redirect_uris),
    token_endpoint_auth_method: 'none',
    grant_types: parseJsonArray(row.grant_types) as Array<'authorization_code' | 'refresh_token'>,
    response_types: ['code'],
    client_name: String(row.client_name),
    client_uri: row.client_uri ? String(row.client_uri) : undefined,
    logo_uri: row.logo_uri ? String(row.logo_uri) : undefined,
    scope: String(row.scope || MCP_OAUTH_SCOPE),
  };
}

export function registerMcpOAuthClient(input: unknown): McpOAuthClient {
  const metadata = normalizeMcpOAuthClientMetadata(input);
  const now = Date.now();
  pruneMcpOAuthRecords(now, true);
  const countRow = queryOne('SELECT COUNT(*) AS count FROM mcp_oauth_clients');
  if (Number(countRow?.count) >= MAX_REGISTERED_OAUTH_CLIENTS) {
    throw new McpOAuthError('invalid_client_metadata', 'OAuth client registration capacity has been reached', 429);
  }
  const clientId = crypto.randomUUID();
  const issuedAt = Math.floor(now / 1000);
  getDB().run(
    `INSERT INTO mcp_oauth_clients (
      client_id, client_id_issued_at, redirect_uris, token_endpoint_auth_method,
      grant_types, response_types, client_name, client_uri, logo_uri, scope, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      clientId,
      issuedAt,
      JSON.stringify(metadata.redirect_uris),
      metadata.token_endpoint_auth_method,
      JSON.stringify(metadata.grant_types),
      JSON.stringify(metadata.response_types),
      metadata.client_name,
      metadata.client_uri || '',
      metadata.logo_uri || '',
      metadata.scope,
      now,
    ]
  );
  saveDB();
  return { ...metadata, client_id: clientId, client_id_issued_at: issuedAt };
}

function getStoredMcpOAuthClient(clientId: string): McpOAuthClient | null {
  const row = queryOne(
    `SELECT client_id, client_id_issued_at, redirect_uris, token_endpoint_auth_method,
            grant_types, response_types, client_name, client_uri, logo_uri, scope
     FROM mcp_oauth_clients WHERE client_id = ?`,
    [clientId]
  ) as unknown as OAuthClientRow | null;
  return row ? clientFromRow(row) : null;
}

function cacheMaxAgeMs(cacheControl: string | undefined): number {
  if (!cacheControl || /\bno-store\b/i.test(cacheControl) || /\bno-cache\b/i.test(cacheControl)) return 0;
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
  if (!match) return 5 * 60 * 1000;
  return Math.min(Number(match[1]) * 1000, CLIENT_METADATA_CACHE_MAX_AGE_MS);
}

function pruneMcpOAuthRecords(now: number, force = false): void {
  if (!force && now - lastOAuthPruneAt < 60 * 60 * 1000) return;
  lastOAuthPruneAt = now;
  const db = getDB();
  db.run('DELETE FROM mcp_oauth_authorization_codes WHERE expires_at < ?', [now - MCP_AUTHORIZATION_CODE_TTL_MS]);
  db.run(
    `DELETE FROM mcp_oauth_tokens
     WHERE expires_at < ? OR (revoked_at > 0 AND revoked_at < ?)`,
    [now - TOKEN_AUDIT_RETENTION_MS, now - TOKEN_AUDIT_RETENTION_MS]
  );
  db.run(
    `DELETE FROM mcp_oauth_clients
     WHERE created_at < ?
       AND client_id NOT IN (SELECT client_id FROM mcp_oauth_authorization_codes)
       AND client_id NOT IN (SELECT client_id FROM mcp_oauth_tokens)`,
    [now - UNUSED_CLIENT_RETENTION_MS]
  );
  saveDB();
}

async function fetchPinnedClientMetadata(clientId: string): Promise<{ body: unknown; cacheControl?: string }> {
  const url = new URL(clientId);
  let addresses: Array<{ address: string; family: number }>;
  let lookupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    addresses = await Promise.race([
      dns.promises.lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        lookupTimer = setTimeout(
          () => reject(new McpOAuthError('invalid_client', 'Client metadata hostname resolution timed out')),
          CLIENT_METADATA_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    throw new McpOAuthError('invalid_client', 'Unable to resolve the client metadata hostname');
  } finally {
    if (lookupTimer) clearTimeout(lookupTimer);
  }
  if (addresses.length === 0 || addresses.some((entry) => !isPublicMetadataIp(entry.address))) {
    throw new McpOAuthError('invalid_client', 'Client metadata hostname does not resolve exclusively to public addresses');
  }
  // 部署環境（Zeabur）容器只有 IPv4 對外路由；dns.lookup 的 verbatim 順序可能把 AAAA 排在前面，
  // 若直接取 addresses[0] 連到 IPv6 位址會 Network unreachable，因此優先挑 IPv4。
  const selected = [...addresses].sort((a, b) => a.family - b.family)[0];

  return await new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AssetPilot-MCP-OAuth/1.0',
        },
        lookup: (_hostname, _options, callback) => {
          callback(null, selected.address, selected.family);
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new McpOAuthError('invalid_client', `Client metadata endpoint returned HTTP ${response.statusCode || 0}`));
          return;
        }
        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (!contentType.includes('application/json') && !contentType.includes('+json')) {
          response.resume();
          reject(new McpOAuthError('invalid_client', 'Client metadata endpoint must return JSON'));
          return;
        }
        const declaredLength = Number(response.headers['content-length']) || 0;
        if (declaredLength > CLIENT_METADATA_MAX_BYTES) {
          response.resume();
          reject(new McpOAuthError('invalid_client', 'Client metadata document is too large'));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on('data', (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += bytes.length;
          if (totalBytes > CLIENT_METADATA_MAX_BYTES) {
            request.destroy(new McpOAuthError('invalid_client', 'Client metadata document is too large'));
            return;
          }
          chunks.push(bytes);
        });
        response.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve({ body, cacheControl: String(response.headers['cache-control'] || '') });
          } catch {
            reject(new McpOAuthError('invalid_client', 'Client metadata document is not valid JSON'));
          }
        });
      }
    );
    request.setTimeout(CLIENT_METADATA_TIMEOUT_MS, () => {
      request.destroy(new McpOAuthError('invalid_client', 'Client metadata request timed out'));
    });
    request.on('error', (error) => {
      reject(error instanceof McpOAuthError ? error : new McpOAuthError('invalid_client', 'Unable to retrieve client metadata document'));
    });
    request.end();
  });
}

async function getClientIdMetadataDocument(clientId: string): Promise<McpOAuthClient> {
  for (const [key, entry] of clientMetadataCache) {
    if (entry.expiresAt <= Date.now()) clientMetadataCache.delete(key);
  }
  const cached = clientMetadataCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.client;
  clientMetadataCache.delete(clientId);

  const existingLoad = clientMetadataLoads.get(clientId);
  if (existingLoad) return existingLoad;
  if (clientMetadataLoads.size >= CLIENT_METADATA_CACHE_MAX_ENTRIES) {
    throw new McpOAuthError('invalid_client', 'Too many client metadata requests are in progress', 429);
  }

  const load = (async () => {
    const { body, cacheControl } = await fetchPinnedClientMetadata(clientId);
    const client = validateClientIdMetadataDocument(clientId, body);
    const maxAge = cacheMaxAgeMs(cacheControl);
    if (maxAge > 0) {
      if (clientMetadataCache.size >= CLIENT_METADATA_CACHE_MAX_ENTRIES) {
        const oldest = clientMetadataCache.keys().next().value;
        if (oldest) clientMetadataCache.delete(oldest);
      }
      clientMetadataCache.set(clientId, { client, expiresAt: Date.now() + maxAge });
    }
    return client;
  })();
  clientMetadataLoads.set(clientId, load);
  try {
    return await load;
  } finally {
    clientMetadataLoads.delete(clientId);
  }
}

export async function getMcpOAuthClient(clientId: string): Promise<McpOAuthClient | null> {
  const stored = getStoredMcpOAuthClient(clientId);
  if (stored) return stored;
  if (!isClientIdMetadataDocumentUrl(clientId)) return null;
  return getClientIdMetadataDocument(clientId);
}

export function validateAuthorizationRequest(input: {
  client: McpOAuthClient;
  responseType: unknown;
  redirectUri: unknown;
  codeChallenge: unknown;
  codeChallengeMethod: unknown;
  scope: unknown;
  resource: unknown;
  expectedResource: string;
}): {
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
} {
  if (input.responseType !== 'code') {
    throw new McpOAuthError('unsupported_response_type', 'response_type must be code');
  }
  if (
    typeof input.redirectUri !== 'string' ||
    !input.client.redirect_uris.some((registered) => mcpRedirectUriMatches(input.redirectUri as string, registered))
  ) {
    throw new McpOAuthError('invalid_redirect_uri', 'redirect_uri is not registered for this client');
  }
  const codeChallenge = validatePkceChallenge(input.codeChallenge, input.codeChallengeMethod);
  const scopes = parseMcpOAuthScopes(typeof input.scope === 'string' ? input.scope : undefined);
  const resource = validateMcpResource(input.resource, input.expectedResource);
  return { redirectUri: input.redirectUri, codeChallenge, scopes, resource };
}

export function issueMcpAuthorizationCode(input: {
  userId: string;
  client: McpOAuthClient;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}): string {
  const now = Date.now();
  pruneMcpOAuthRecords(now);
  const code = randomOpaqueValue(AUTHORIZATION_CODE_PREFIX);
  getDB().run(
    `INSERT INTO mcp_oauth_authorization_codes (
      code_hash, user_id, client_id, client_name, redirect_uri, code_challenge,
      resource, scope, created_at, expires_at, consumed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [
      hashSecret(code),
      input.userId,
      input.client.client_id,
      input.client.client_name,
      input.redirectUri,
      input.codeChallenge,
      input.resource,
      input.scopes.join(' '),
      now,
      now + MCP_AUTHORIZATION_CODE_TTL_MS,
    ]
  );
  getDB().run('DELETE FROM mcp_oauth_authorization_codes WHERE expires_at < ?', [now - MCP_AUTHORIZATION_CODE_TTL_MS]);
  saveDB();
  return code;
}

function insertTokenPair(input: {
  familyId: string;
  userId: string;
  clientId: string;
  clientName: string;
  resource: string;
  scope: string;
  now: number;
  allowRefresh: boolean;
}): McpOAuthTokenResponse & { refreshTokenHash?: string } {
  const accessToken = randomOpaqueValue(ACCESS_TOKEN_PREFIX);
  const accessHash = hashSecret(accessToken);
  const db = getDB();

  db.run(
    `INSERT INTO mcp_oauth_tokens (
      token_hash, token_type, family_id, user_id, client_id, client_name, resource,
      scope, issued_at, expires_at, revoked_at, replaced_by_hash, last_used_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,0,'',0)`,
    [
      accessHash,
      'access',
      input.familyId,
      input.userId,
      input.clientId,
      input.clientName,
      input.resource,
      input.scope,
      input.now,
      input.now + MCP_ACCESS_TOKEN_TTL_MS,
    ]
  );
  const response: McpOAuthTokenResponse & { refreshTokenHash?: string } = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(MCP_ACCESS_TOKEN_TTL_MS / 1000),
    scope: input.scope,
  };
  if (input.allowRefresh) {
    const refreshToken = randomOpaqueValue(REFRESH_TOKEN_PREFIX);
    const refreshHash = hashSecret(refreshToken);
    db.run(
      `INSERT INTO mcp_oauth_tokens (
        token_hash, token_type, family_id, user_id, client_id, client_name, resource,
        scope, issued_at, expires_at, revoked_at, replaced_by_hash, last_used_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,0,'',0)`,
      [
        refreshHash,
        'refresh',
        input.familyId,
        input.userId,
        input.clientId,
        input.clientName,
        input.resource,
        input.scope,
        input.now,
        input.now + MCP_REFRESH_TOKEN_TTL_MS,
      ]
    );
    response.refresh_token = refreshToken;
    response.refreshTokenHash = refreshHash;
  }
  return response;
}

export function exchangeMcpAuthorizationCode(input: {
  client: McpOAuthClient;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  resource: string;
  expectedResource: string;
}): McpOAuthTokenResponse {
  const canonicalResource = validateMcpResource(input.resource, input.expectedResource);
  const codeHash = hashSecret(input.code);
  const db = getDB();
  db.run('BEGIN');
  try {
    const row = queryOne(
      `SELECT code_hash, user_id, client_id, client_name, redirect_uri, code_challenge,
              resource, scope, expires_at, consumed_at
       FROM mcp_oauth_authorization_codes WHERE code_hash = ?`,
      [codeHash]
    ) as unknown as AuthorizationCodeRow | null;
    const now = Date.now();
    if (
      !row ||
      Number(row.consumed_at) !== 0 ||
      Number(row.expires_at) <= now ||
      String(row.client_id) !== input.client.client_id ||
      String(row.redirect_uri) !== input.redirectUri ||
      String(row.resource) !== canonicalResource
    ) {
      throw new McpOAuthError('invalid_grant', 'Authorization code is invalid, expired, already used, or bound to another request');
    }
    if (!verifyPkce(input.codeVerifier, String(row.code_challenge))) {
      throw new McpOAuthError('invalid_grant', 'code_verifier does not match the PKCE challenge');
    }

    db.run(
      'UPDATE mcp_oauth_authorization_codes SET consumed_at = ? WHERE code_hash = ? AND consumed_at = 0',
      [now, codeHash]
    );
    if (db.getRowsModified() !== 1) {
      throw new McpOAuthError('invalid_grant', 'Authorization code has already been used');
    }

    const user = queryOne('SELECT id, is_active FROM users WHERE id = ?', [String(row.user_id)]);
    if (!user || Number(user.is_active) !== 1) {
      throw new McpOAuthError('invalid_grant', 'The AssetPilot account is unavailable');
    }

    const tokens = insertTokenPair({
      familyId: uid(),
      userId: String(row.user_id),
      clientId: String(row.client_id),
      clientName: String(row.client_name),
      resource: String(row.resource),
      scope: String(row.scope),
      now,
      allowRefresh: input.client.grant_types.includes('refresh_token'),
    });
    db.run('COMMIT');
    saveDB();
    const { refreshTokenHash: _, ...response } = tokens;
    return response;
  } catch (error) {
    try { db.run('ROLLBACK'); } catch {}
    throw error;
  }
}

export function exchangeMcpRefreshToken(input: {
  client: McpOAuthClient;
  refreshToken: string;
  scope?: string;
  resource: string;
  expectedResource: string;
}): McpOAuthTokenResponse {
  if (!input.client.grant_types.includes('refresh_token')) {
    throw new McpOAuthError('unsupported_grant_type', 'This client is not registered for refresh_token grants');
  }
  const canonicalResource = validateMcpResource(input.resource, input.expectedResource);
  const requestedScopes = parseMcpOAuthScopes(input.scope);
  const refreshHash = hashSecret(input.refreshToken);
  const db = getDB();
  db.run('BEGIN');
  let transactionOpen = true;
  try {
    const row = queryOne(
      `SELECT t.token_hash, t.token_type, t.family_id, t.user_id, t.client_id, t.client_name,
              t.resource, t.scope, t.expires_at, t.revoked_at, t.replaced_by_hash,
              u.is_active AS user_is_active
       FROM mcp_oauth_tokens t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.token_type = 'refresh'`,
      [refreshHash]
    ) as unknown as OAuthTokenRow | null;
    const now = Date.now();
    if (!row || String(row.client_id) !== input.client.client_id || String(row.resource) !== canonicalResource) {
      throw new McpOAuthError('invalid_grant', 'Refresh token is invalid for this client or resource');
    }
    if (Number(row.revoked_at) !== 0) {
      if (String(row.replaced_by_hash || '')) {
        db.run('UPDATE mcp_oauth_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at = 0', [now, String(row.family_id)]);
        db.run('COMMIT');
        transactionOpen = false;
        saveDB();
      }
      throw new McpOAuthError('invalid_grant', 'Refresh token reuse was detected; this token family has been revoked');
    }
    if (Number(row.expires_at) <= now || Number(row.user_is_active) !== 1) {
      throw new McpOAuthError('invalid_grant', 'Refresh token is expired or its AssetPilot account is unavailable');
    }

    const existingScopes = parseMcpOAuthScopes(String(row.scope));
    if (requestedScopes.some((scope) => !existingScopes.includes(scope))) {
      throw new McpOAuthError('invalid_scope', 'Refresh cannot expand the originally granted scope');
    }

    const tokens = insertTokenPair({
      familyId: String(row.family_id),
      userId: String(row.user_id),
      clientId: String(row.client_id),
      clientName: String(row.client_name),
      resource: String(row.resource),
      scope: requestedScopes.join(' '),
      now,
      allowRefresh: true,
    });
    db.run(
      `UPDATE mcp_oauth_tokens
       SET revoked_at = ?, replaced_by_hash = ?
       WHERE token_hash = ? AND token_type = 'refresh' AND revoked_at = 0`,
      [now, tokens.refreshTokenHash || '', refreshHash]
    );
    if (db.getRowsModified() !== 1) {
      db.run('ROLLBACK');
      transactionOpen = false;
      db.run(
        'UPDATE mcp_oauth_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at = 0',
        [now, String(row.family_id)]
      );
      saveDB();
      throw new McpOAuthError('invalid_grant', 'Refresh token has already been rotated');
    }
    db.run('COMMIT');
    transactionOpen = false;
    saveDB();
    const { refreshTokenHash: _, ...response } = tokens;
    return response;
  } catch (error) {
    if (transactionOpen) {
      try { db.run('ROLLBACK'); } catch {}
    }
    throw error;
  }
}

export function verifyMcpOAuthAccessToken(token: string, expectedResource: string): VerifyMcpTokenResult | null {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const tokenHash = hashSecret(token);
  const row = queryOne(
    `SELECT t.token_hash, t.token_type, t.family_id, t.user_id, t.client_id, t.client_name,
            t.resource, t.scope, t.expires_at, t.revoked_at, t.replaced_by_hash,
            u.is_active AS user_is_active
     FROM mcp_oauth_tokens t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.token_type = 'access'`,
    [tokenHash]
  ) as unknown as OAuthTokenRow | null;
  const now = Date.now();
  if (
    !row ||
    Number(row.revoked_at) !== 0 ||
    Number(row.expires_at) <= now ||
    Number(row.user_is_active) !== 1 ||
    String(row.resource) !== expectedResource
  ) {
    return null;
  }
  try {
    if (!parseMcpOAuthScopes(String(row.scope)).includes(MCP_OAUTH_SCOPE)) return null;
  } catch {
    return null;
  }
  getDB().run('UPDATE mcp_oauth_tokens SET last_used_at = ? WHERE token_hash = ?', [now, tokenHash]);
  saveDB();
  return {
    credentialId: `oauth:${String(row.family_id)}`,
    userId: String(row.user_id),
    name: String(row.client_name || row.client_id),
  };
}

export function revokeMcpOAuthToken(client: McpOAuthClient, token: string): void {
  const tokenHash = hashSecret(token);
  const row = queryOne(
    'SELECT family_id, client_id FROM mcp_oauth_tokens WHERE token_hash = ?',
    [tokenHash]
  );
  if (!row || String(row.client_id) !== client.client_id) return;
  getDB().run(
    'UPDATE mcp_oauth_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at = 0',
    [Date.now(), String(row.family_id)]
  );
  saveDB();
}

export function serializeRegisteredClient(client: McpOAuthClient): Record<string, unknown> {
  const result: Record<string, unknown> = {
    client_id: client.client_id,
    client_id_issued_at: client.client_id_issued_at,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
    grant_types: client.grant_types,
    response_types: client.response_types,
    client_name: client.client_name,
    scope: client.scope,
  };
  if (client.client_uri) result.client_uri = client.client_uri;
  if (client.logo_uri) result.logo_uri = client.logo_uri;
  return result;
}

export function sanitizeClientForConsent(client: McpOAuthClient): Pick<McpOAuthClient, 'client_id' | 'client_name' | 'client_uri' | 'logo_uri' | 'redirect_uris'> {
  return {
    client_id: client.client_id,
    client_name: client.client_name,
    client_uri: client.client_uri,
    logo_uri: client.logo_uri,
    redirect_uris: client.redirect_uris,
  };
}

export type { McpOAuthClientMetadata };
