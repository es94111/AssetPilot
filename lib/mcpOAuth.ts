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
  isSupportedMcpOAuthClientAuthMethod,
  validateClientIdMetadataDocument,
  validateMcpResource,
  validatePkceChallenge,
  verifyPkce,
  type McpOAuthClient,
  type McpOAuthClientAuthMethod,
  type McpOAuthClientMetadata,
} from './mcpOAuthCore';
import { getDB, queryOne, queryAll, saveDB } from './db';
import { uid } from './userDefaults';
import type { VerifyMcpTokenResult } from './mcpAuth';

const ACCESS_TOKEN_PREFIX = 'ap_mcp_oauth_access_';
const REFRESH_TOKEN_PREFIX = 'ap_mcp_oauth_refresh_';
const AUTHORIZATION_CODE_PREFIX = 'ap_mcp_oauth_code_';
const CLIENT_SECRET_PREFIX = 'ap_mcp_client_secret_';
const CLIENT_METADATA_MAX_BYTES = 5 * 1024;
const CLIENT_METADATA_TIMEOUT_MS = 5_000;
const CLIENT_METADATA_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const CLIENT_METADATA_CACHE_MAX_ENTRIES = 500;
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const CLIENT_ASSERTION_MAX_BYTES = 16 * 1024;
const CLIENT_ASSERTION_CLOCK_SKEW_MS = 60 * 1000;
const CLIENT_JWKS_CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const CLIENT_JWKS_CACHE_MAX_ENTRIES = 100;
const MAX_REGISTERED_OAUTH_CLIENTS = 10_000;
const UNUSED_CLIENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface OAuthClientRow {
  client_id: string | number;
  client_id_issued_at: string | number | null;
  redirect_uris: string | number;
  token_endpoint_auth_method: string | number;
  client_secret_hash: string | number | null;
  client_secret_expires_at: string | number | null;
  jwks_uri: string | number | null;
  token_endpoint_auth_signing_alg: string | number | null;
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
  allow_create?: string | number | null;
  allow_update_note?: string | number | null;
}

interface OAuthConnectionRow {
  client_id: string | number;
  client_name: string | number;
  allow_create: string | number;
  allow_update_note: string | number;
  first_connected_at: string | number;
  last_used_at: string | number;
}

interface CachedClientMetadata {
  expiresAt: number;
  client: McpOAuthClient;
}

interface CachedClientJwks {
  expiresAt: number;
  keys: Array<Record<string, unknown>>;
}

interface ClientAssertionClaims {
  jti: string;
  exp: number;
}

export interface McpOAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export type McpOAuthClientAuthSource = 'none' | 'basic' | 'post' | 'private_key_jwt';

export interface McpOAuthClientCredentials {
  clientId: string;
  source: McpOAuthClientAuthSource;
  clientSecret?: string;
  clientAssertionType?: string;
  clientAssertion?: string;
}

export interface RegisteredMcpOAuthClient extends McpOAuthClient {
  client_secret?: string;
  client_secret_expires_at?: number;
}

const clientMetadataCache = new Map<string, CachedClientMetadata>();
const clientMetadataLoads = new Map<string, Promise<McpOAuthClient>>();
const clientJwksCache = new Map<string, CachedClientJwks>();
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
  const storedAuthMethod = String(row.token_endpoint_auth_method || 'none').trim().toLowerCase();
  const authMethod: McpOAuthClientAuthMethod = isSupportedMcpOAuthClientAuthMethod(storedAuthMethod)
    ? storedAuthMethod
    : 'none';
  return {
    client_id: String(row.client_id),
    client_id_issued_at: Number(row.client_id_issued_at) || undefined,
    redirect_uris: parseJsonArray(row.redirect_uris),
    token_endpoint_auth_method: authMethod,
    grant_types: parseJsonArray(row.grant_types) as Array<'authorization_code' | 'refresh_token'>,
    response_types: ['code'],
    client_name: String(row.client_name),
    client_uri: row.client_uri ? String(row.client_uri) : undefined,
    logo_uri: row.logo_uri ? String(row.logo_uri) : undefined,
    scope: String(row.scope || MCP_OAUTH_SCOPE),
    client_secret_hash: row.client_secret_hash ? String(row.client_secret_hash) : undefined,
    client_secret_expires_at: Number(row.client_secret_expires_at) || undefined,
    jwks_uri: row.jwks_uri ? String(row.jwks_uri) : undefined,
    token_endpoint_auth_signing_alg: row.token_endpoint_auth_signing_alg === 'RS256' ? 'RS256' : undefined,
  };
}

export function registerMcpOAuthClient(input: unknown): RegisteredMcpOAuthClient {
  const metadata = normalizeMcpOAuthClientMetadata(input, { allowPrivateKeyJwt: true });
  const now = Date.now();
  pruneMcpOAuthRecords(now, true);
  const countRow = queryOne('SELECT COUNT(*) AS count FROM mcp_oauth_clients');
  if (Number(countRow?.count) >= MAX_REGISTERED_OAUTH_CLIENTS) {
    throw new McpOAuthError('invalid_client_metadata', 'OAuth client registration capacity has been reached', 429);
  }
  const clientId = crypto.randomUUID();
  const issuedAt = Math.floor(now / 1000);
  // Some deployed MCP clients ask for a registration secret even when they
  // declare the public `none` method.  Issuing one is harmless for PKCE public
  // clients, keeps the normal `none` flow available, and lets the token
  // endpoint interoperate with those clients without storing plaintext.
  const clientSecret = metadata.token_endpoint_auth_method === 'private_key_jwt' ? '' : randomOpaqueValue(CLIENT_SECRET_PREFIX);
  const clientSecretHash = clientSecret ? hashSecret(clientSecret) : '';
  const clientSecretExpiresAt = 0;
  getDB().run(
    `INSERT INTO mcp_oauth_clients (
      client_id, client_id_issued_at, redirect_uris, token_endpoint_auth_method,
      client_secret_hash, client_secret_expires_at,
      jwks_uri, token_endpoint_auth_signing_alg,
      grant_types, response_types, client_name, client_uri, logo_uri, scope, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      clientId,
      issuedAt,
      JSON.stringify(metadata.redirect_uris),
      metadata.token_endpoint_auth_method,
      clientSecretHash,
      clientSecretExpiresAt,
      metadata.jwks_uri || '',
      metadata.token_endpoint_auth_signing_alg || '',
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
  return {
    ...metadata,
    client_id: clientId,
    client_id_issued_at: issuedAt,
    client_secret: clientSecret,
    client_secret_expires_at: clientSecretExpiresAt,
    client_secret_hash: clientSecretHash,
  };
}

function getStoredMcpOAuthClient(clientId: string): McpOAuthClient | null {
  const row = queryOne(
    `SELECT client_id, client_id_issued_at, redirect_uris, token_endpoint_auth_method,
            client_secret_hash, client_secret_expires_at,
            jwks_uri, token_endpoint_auth_signing_alg,
            grant_types, response_types, client_name, client_uri, logo_uri, scope
     FROM mcp_oauth_clients WHERE client_id = ?`,
    [clientId]
  ) as unknown as OAuthClientRow | null;
  return row ? clientFromRow(row) : null;
}

function hashMatches(expectedHash: string | undefined, secret: string | undefined): boolean {
  if (!expectedHash || !secret) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = crypto.createHash('sha256').update(secret).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function parseBase64UrlJson(segment: string, label: string): Record<string, unknown> {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new McpOAuthError('invalid_client', `${label} is not valid`, 401);
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value as Record<string, unknown>;
  } catch {
    throw new McpOAuthError('invalid_client', `${label} is not valid`, 401);
  }
}

function getClientAssertionJwk(jwks: unknown, kid: string): Record<string, unknown> {
  if (!jwks || typeof jwks !== 'object' || Array.isArray(jwks)) {
    throw new McpOAuthError('invalid_client', 'Client JWKS is invalid', 401);
  }
  const keys = (jwks as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) {
    throw new McpOAuthError('invalid_client', 'Client JWKS must contain keys', 401);
  }
  const key = keys.find((candidate) => (
    candidate && typeof candidate === 'object' && !Array.isArray(candidate) &&
    String((candidate as Record<string, unknown>).kid || '') === kid
  ));
  if (!key || typeof key !== 'object' || Array.isArray(key)) {
    throw new McpOAuthError('invalid_client', 'Client assertion key was not found', 401);
  }
  const jwk = key as Record<string, unknown>;
  if (jwk.kty !== 'RSA' || jwk.use === 'enc' || (jwk.use != null && jwk.use !== 'sig') || jwk.alg === 'none' || (jwk.alg != null && jwk.alg !== 'RS256')) {
    throw new McpOAuthError('invalid_client', 'Client assertion key is not an RSA signing key', 401);
  }
  return jwk;
}

function audienceMatches(audience: unknown, expected: string): boolean {
  return typeof audience === 'string'
    ? audience === expected
    : Array.isArray(audience) && audience.length > 0 && audience.includes(expected);
}

export function verifyMcpOAuthClientAssertion(input: {
  assertion: string;
  clientId: string;
  audience: string;
  jwks: unknown;
  nowMs?: number;
}): ClientAssertionClaims {
  if (typeof input.assertion !== 'string' || Buffer.byteLength(input.assertion, 'utf8') > CLIENT_ASSERTION_MAX_BYTES) {
    throw new McpOAuthError('invalid_client', 'Client assertion is invalid', 401);
  }
  const parts = input.assertion.split('.');
  if (parts.length !== 3) throw new McpOAuthError('invalid_client', 'Client assertion is not a JWT', 401);
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseBase64UrlJson(encodedHeader, 'Client assertion header');
  const payload = parseBase64UrlJson(encodedPayload, 'Client assertion payload');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new McpOAuthError('invalid_client', 'Client assertion must use RS256 and include kid', 401);
  }
  const jwk = getClientAssertionJwk(input.jwks, header.kid);

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      key: jwk as crypto.webcrypto.JsonWebKey,
      format: 'jwk',
    });
  } catch {
    throw new McpOAuthError('invalid_client', 'Client assertion key could not be parsed', 401);
  }
  if (publicKey.asymmetricKeyType !== 'rsa' || Number(publicKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
    throw new McpOAuthError('invalid_client', 'Client assertion RSA key is too weak', 401);
  }
  let signature: Buffer;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(encodedSignature)) throw new Error('invalid base64url');
    signature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    throw new McpOAuthError('invalid_client', 'Client assertion signature is invalid', 401);
  }
  if (!signature.length || !crypto.verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, signature)) {
    throw new McpOAuthError('invalid_client', 'Client assertion signature is invalid', 401);
  }

  const now = input.nowMs ?? Date.now();
  if (payload.iss !== input.clientId || payload.sub !== input.clientId || !audienceMatches(payload.aud, input.audience)) {
    throw new McpOAuthError('invalid_client', 'Client assertion claims do not match this client or token endpoint', 401);
  }
  if (!Number.isFinite(payload.exp) || Number(payload.exp) * 1000 <= now - CLIENT_ASSERTION_CLOCK_SKEW_MS) {
    throw new McpOAuthError('invalid_client', 'Client assertion is expired', 401);
  }
  if (Number(payload.exp) * 1000 > now + 10 * 60 * 1000) {
    throw new McpOAuthError('invalid_client', 'Client assertion lifetime is too long', 401);
  }
  if (payload.iat != null && (!Number.isFinite(payload.iat) || Number(payload.iat) * 1000 > now + CLIENT_ASSERTION_CLOCK_SKEW_MS || Number(payload.iat) * 1000 < now - 10 * 60 * 1000)) {
    throw new McpOAuthError('invalid_client', 'Client assertion issued-at claim is invalid', 401);
  }
  if (payload.nbf != null && (!Number.isFinite(payload.nbf) || Number(payload.nbf) * 1000 > now + CLIENT_ASSERTION_CLOCK_SKEW_MS)) {
    throw new McpOAuthError('invalid_client', 'Client assertion is not active yet', 401);
  }
  if (typeof payload.jti !== 'string' || !/^[A-Za-z0-9._~-]{16,256}$/.test(payload.jti)) {
    throw new McpOAuthError('invalid_client', 'Client assertion must include a unique jti', 401);
  }
  return { jti: payload.jti, exp: Number(payload.exp) * 1000 };
}

async function getClientJwks(client: McpOAuthClient, forceRefresh = false): Promise<unknown> {
  if (!client.jwks_uri) throw new McpOAuthError('invalid_client', 'Client metadata does not provide jwks_uri', 401);
  const cached = clientJwksCache.get(client.jwks_uri);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return { keys: cached.keys };
  clientJwksCache.delete(client.jwks_uri);
  const { body, cacheControl } = await fetchPinnedJson(
    client.jwks_uri,
    'Client JWKS',
    CLIENT_ASSERTION_MAX_BYTES,
    'application/json, application/jwk-set+json'
  );
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray((body as { keys?: unknown }).keys)) {
    throw new McpOAuthError('invalid_client', 'Client JWKS is invalid', 401);
  }
  const keys = (body as { keys: unknown[] }).keys.filter((key): key is Record<string, unknown> => (
    !!key && typeof key === 'object' && !Array.isArray(key)
  ));
  const maxAge = cacheMaxAgeMs(cacheControl) || 5 * 60 * 1000;
  if (clientJwksCache.size >= CLIENT_JWKS_CACHE_MAX_ENTRIES) {
    const oldest = clientJwksCache.keys().next().value;
    if (oldest) clientJwksCache.delete(oldest);
  }
  clientJwksCache.set(client.jwks_uri, {
    keys,
    expiresAt: Date.now() + Math.min(maxAge, CLIENT_JWKS_CACHE_MAX_AGE_MS),
  });
  return { keys };
}

function consumeClientAssertion(clientId: string, jti: string, expiresAt: number): boolean {
  const now = Date.now();
  const db = getDB();
  db.run('DELETE FROM mcp_oauth_client_assertions WHERE expires_at < ?', [now - TOKEN_AUDIT_RETENTION_MS]);
  try {
    db.run(
      'INSERT INTO mcp_oauth_client_assertions (client_id, jti, expires_at, created_at) VALUES (?,?,?,?)',
      [clientId, jti, expiresAt, now]
    );
    saveDB();
    return true;
  } catch {
    return false;
  }
}

export function parseMcpOAuthClientCredentials(
  authorizationHeader: string | null | undefined,
  bodyClientId: string | undefined,
  bodyClientSecret: string | undefined,
  bodyClientAssertionType?: string,
  bodyClientAssertion?: string
): McpOAuthClientCredentials {
  const header = String(authorizationHeader || '').trim();
  const hasAssertion = bodyClientAssertionType !== undefined || bodyClientAssertion !== undefined;
  if (!header) {
    if (!bodyClientId) throw new McpOAuthError('invalid_request', 'client_id is required');
    if (hasAssertion) {
      if (bodyClientSecret !== undefined || !bodyClientAssertionType || !bodyClientAssertion) {
        throw new McpOAuthError('invalid_client', 'Invalid client assertion credentials', 401);
      }
      return {
        clientId: bodyClientId,
        source: 'private_key_jwt',
        clientAssertionType: bodyClientAssertionType,
        clientAssertion: bodyClientAssertion,
      };
    }
    return {
      clientId: bodyClientId,
      source: bodyClientSecret ? 'post' : 'none',
      clientSecret: bodyClientSecret,
    };
  }

  const match = header.match(/^Basic[ \t]+([^ \t]+)$/i);
  if (!match) {
    throw new McpOAuthError('invalid_client', 'Unsupported client authentication method', 401);
  }
  if (hasAssertion) throw new McpOAuthError('invalid_client', 'Conflicting client authentication methods', 401);
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    throw new McpOAuthError('invalid_client', 'Invalid HTTP Basic client credentials', 401);
  }
  const separator = decoded.indexOf(':');
  if (separator <= 0) {
    throw new McpOAuthError('invalid_client', 'Invalid HTTP Basic client credentials', 401);
  }
  const clientId = decoded.slice(0, separator);
  const clientSecret = decoded.slice(separator + 1);
  if (!clientSecret || (bodyClientId && bodyClientId !== clientId) || bodyClientSecret !== undefined) {
    throw new McpOAuthError('invalid_client', 'Invalid or conflicting client credentials', 401);
  }
  return { clientId, source: 'basic', clientSecret };
}

export async function verifyMcpOAuthClientAuthentication(
  client: McpOAuthClient,
  credentials: McpOAuthClientCredentials,
  audience: string
): Promise<boolean> {
  if (credentials.clientId !== client.client_id) return false;
  if (credentials.source === 'none') return client.token_endpoint_auth_method === 'none';
  if (credentials.source === 'private_key_jwt') {
    if (client.token_endpoint_auth_method !== 'private_key_jwt' || client.token_endpoint_auth_signing_alg !== 'RS256' || credentials.clientAssertionType !== CLIENT_ASSERTION_TYPE || !credentials.clientAssertion) return false;
    let claims: ClientAssertionClaims;
    try {
      const jwks = await getClientJwks(client);
      claims = verifyMcpOAuthClientAssertion({
        assertion: credentials.clientAssertion,
        clientId: client.client_id,
        audience,
        jwks,
      });
    } catch (error) {
      if (error instanceof McpOAuthError && /key was not found/.test(error.message)) {
        const jwks = await getClientJwks(client, true);
        claims = verifyMcpOAuthClientAssertion({
          assertion: credentials.clientAssertion,
          clientId: client.client_id,
          audience,
          jwks,
        });
      } else {
        throw error;
      }
    }
    return consumeClientAssertion(client.client_id, claims.jti, claims.exp);
  }

  // Accept either Basic or POST when the issued secret matches. This keeps
  // interoperability with MCP clients that ignore the registered method,
  // while still requiring an unguessable server-issued secret.
  const expiresAt = Number(client.client_secret_expires_at) || 0;
  if (expiresAt !== 0 && expiresAt <= Date.now()) return false;
  return hashMatches(client.client_secret_hash, credentials.clientSecret);
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
  db.run('DELETE FROM mcp_oauth_client_assertions WHERE expires_at < ?', [now - TOKEN_AUDIT_RETENTION_MS]);
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

function validatePinnedJsonUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new McpOAuthError('invalid_client', `${label} URL is invalid`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || value.length > CLIENT_METADATA_MAX_BYTES) {
    throw new McpOAuthError('invalid_client', `${label} URL must use HTTPS without credentials or a fragment`);
  }
  return url;
}

async function fetchPinnedJson(
  value: string,
  label: string,
  maxBytes: number,
  accept = 'application/json'
): Promise<{ body: unknown; cacheControl?: string }> {
  const url = validatePinnedJsonUrl(value, label);
  let addresses: Array<{ address: string; family: number }>;
  let lookupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    addresses = await Promise.race([
      dns.promises.lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        lookupTimer = setTimeout(
          () => reject(new McpOAuthError('invalid_client', `${label} hostname resolution timed out`)),
          CLIENT_METADATA_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    throw new McpOAuthError('invalid_client', `Unable to resolve the ${label.toLowerCase()} hostname`);
  } finally {
    if (lookupTimer) clearTimeout(lookupTimer);
  }
  if (addresses.length === 0 || addresses.some((entry) => !isPublicMetadataIp(entry.address))) {
    throw new McpOAuthError('invalid_client', `${label} hostname does not resolve exclusively to public addresses`);
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
          Accept: accept,
          'User-Agent': 'AssetPilot-MCP-OAuth/1.0',
        },
        // Node 的 Happy Eyeballs（autoSelectFamily）在偵測到雙棧位址時，會以 { all: true }
        // 呼叫 lookup 並預期回傳位址陣列；只回傳單一位址／family 會讓內部 lookupAndConnectMultiple
        // 讀到 undefined 而丟出 ERR_INVALID_IP_ADDRESS，導致固定住的 IPv4 選擇形同虛設。
        lookup: (_hostname, options, callback) => {
          if (options && typeof options === 'object' && 'all' in options && options.all) {
            callback(null, [{ address: selected.address, family: selected.family }]);
            return;
          }
          callback(null, selected.address, selected.family);
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new McpOAuthError('invalid_client', `${label} endpoint returned HTTP ${response.statusCode || 0}`));
          return;
        }
        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (!contentType.includes('application/json') && !contentType.includes('+json')) {
          response.resume();
          reject(new McpOAuthError('invalid_client', `${label} endpoint must return JSON`));
          return;
        }
        const declaredLength = Number(response.headers['content-length']) || 0;
        if (declaredLength > maxBytes) {
          response.resume();
          reject(new McpOAuthError('invalid_client', `${label} is too large`));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on('data', (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += bytes.length;
          if (totalBytes > maxBytes) {
            request.destroy(new McpOAuthError('invalid_client', `${label} is too large`));
            return;
          }
          chunks.push(bytes);
        });
        response.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve({ body, cacheControl: String(response.headers['cache-control'] || '') });
          } catch {
            reject(new McpOAuthError('invalid_client', `${label} is not valid JSON`));
          }
        });
      }
    );
    request.setTimeout(CLIENT_METADATA_TIMEOUT_MS, () => {
      request.destroy(new McpOAuthError('invalid_client', `${label} request timed out`));
    });
    request.on('error', (error) => {
      reject(error instanceof McpOAuthError ? error : new McpOAuthError('invalid_client', `Unable to retrieve ${label.toLowerCase()}`));
    });
    request.end();
  });
}

async function fetchPinnedClientMetadata(clientId: string): Promise<{ body: unknown; cacheControl?: string }> {
  return fetchPinnedJson(clientId, 'Client metadata document', CLIENT_METADATA_MAX_BYTES);
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

    const hasValidExistingToken = queryOne(
      'SELECT 1 AS x FROM mcp_oauth_tokens WHERE user_id = ? AND client_id = ? AND revoked_at = 0 AND expires_at > ? LIMIT 1',
      [String(row.user_id), String(row.client_id), now]
    );

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

    const connectionConflictUpdate = hasValidExistingToken
      ? 'client_name = excluded.client_name, last_used_at = excluded.last_used_at'
      : 'client_name = excluded.client_name, last_used_at = excluded.last_used_at, allow_create = 0, allow_update_note = 0';
    db.run(
      `INSERT INTO mcp_oauth_connections (user_id, client_id, client_name, allow_create, first_connected_at, last_used_at)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT (user_id, client_id) DO UPDATE SET ${connectionConflictUpdate}`,
      [String(row.user_id), String(row.client_id), String(row.client_name), now, now]
    );

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
            u.is_active AS user_is_active, mc.allow_create, mc.allow_update_note
     FROM mcp_oauth_tokens t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN mcp_oauth_connections mc ON mc.user_id = t.user_id AND mc.client_id = t.client_id
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
    allowCreate: Number(row.allow_create) === 1,
    allowUpdateNote: Number(row.allow_update_note) === 1,
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

export interface McpOAuthConnectionSummary {
  clientId: string;
  clientName: string;
  allowCreate: boolean;
  allowUpdateNote: boolean;
  firstConnectedAt: number;
  lastUsedAt: number;
}

export function listMcpOAuthConnections(userId: string): McpOAuthConnectionSummary[] {
  const now = Date.now();
  const rows = queryAll(
    `SELECT c.client_id, c.client_name, c.allow_create, c.allow_update_note, c.first_connected_at, c.last_used_at
     FROM mcp_oauth_connections c
     WHERE c.user_id = ?
       AND EXISTS (
         SELECT 1 FROM mcp_oauth_tokens t
         WHERE t.user_id = c.user_id AND t.client_id = c.client_id
           AND t.revoked_at = 0 AND t.expires_at > ?
       )
     ORDER BY c.last_used_at DESC`,
    [userId, now]
  ) as unknown as OAuthConnectionRow[];
  return rows.map((row) => ({
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    allowCreate: Number(row.allow_create) === 1,
    allowUpdateNote: Number(row.allow_update_note) === 1,
    firstConnectedAt: Number(row.first_connected_at) || 0,
    lastUsedAt: Number(row.last_used_at) || 0,
  }));
}

export function setMcpOAuthConnectionAllowCreate(userId: string, clientId: string, allowCreate: boolean): boolean {
  const db = getDB();
  db.run(
    'UPDATE mcp_oauth_connections SET allow_create = ? WHERE user_id = ? AND client_id = ?',
    [allowCreate ? 1 : 0, userId, clientId]
  );
  const hit = db.getRowsModified() > 0;
  saveDB();
  return hit;
}

export function setMcpOAuthConnectionAllowUpdateNote(userId: string, clientId: string, allowUpdateNote: boolean): boolean {
  const db = getDB();
  db.run(
    'UPDATE mcp_oauth_connections SET allow_update_note = ? WHERE user_id = ? AND client_id = ?',
    [allowUpdateNote ? 1 : 0, userId, clientId]
  );
  const hit = db.getRowsModified() > 0;
  saveDB();
  return hit;
}

export function serializeRegisteredClient(
  client: McpOAuthClient & { client_secret?: string; client_secret_expires_at?: number }
): Record<string, unknown> {
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
  if (client.client_secret) {
    result.client_secret = client.client_secret;
    result.client_secret_expires_at = Number(client.client_secret_expires_at) || 0;
  }
  if (client.jwks_uri) result.jwks_uri = client.jwks_uri;
  if (client.token_endpoint_auth_signing_alg) result.token_endpoint_auth_signing_alg = client.token_endpoint_auth_signing_alg;
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
