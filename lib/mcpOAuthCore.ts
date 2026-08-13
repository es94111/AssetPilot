import crypto from 'node:crypto';
import net from 'node:net';

export const MCP_OAUTH_SCOPE = 'mcp:read';
export const MCP_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
export const MCP_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const MCP_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type McpOAuthClientAuthMethod = 'none' | 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt';

const SUPPORTED_CLIENT_AUTH_METHODS = new Set<McpOAuthClientAuthMethod>([
  'none',
  'client_secret_basic',
  'client_secret_post',
  'private_key_jwt',
]);

const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const CLIENT_ID_MAX_LENGTH = 2048;
const REDIRECT_URI_MAX_LENGTH = 2048;
const MAX_REDIRECT_URIS = 10;

export type McpOAuthErrorCode =
  | 'access_denied'
  | 'invalid_client'
  | 'invalid_client_metadata'
  | 'invalid_grant'
  | 'invalid_redirect_uri'
  | 'invalid_request'
  | 'invalid_scope'
  | 'server_error'
  | 'unsupported_grant_type'
  | 'unsupported_response_type';

export class McpOAuthError extends Error {
  constructor(
    public readonly code: McpOAuthErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'McpOAuthError';
  }
}

interface HeadersLike {
  get(name: string): string | null;
}

export interface McpOAuthClientMetadata {
  redirect_uris: string[];
  token_endpoint_auth_method: McpOAuthClientAuthMethod;
  grant_types: Array<'authorization_code' | 'refresh_token'>;
  response_types: ['code'];
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  scope: string;
  jwks_uri?: string;
  token_endpoint_auth_signing_alg?: 'RS256';
}

export interface McpOAuthClient extends McpOAuthClientMetadata {
  client_id: string;
  client_id_issued_at?: number;
  /** Stored only on the server; never serialize this field to a client. */
  client_secret_hash?: string;
  client_secret_expires_at?: number;
}

export function isSupportedMcpOAuthClientAuthMethod(value: unknown): value is McpOAuthClientAuthMethod {
  return typeof value === 'string' && SUPPORTED_CLIENT_AUTH_METHODS.has(value as McpOAuthClientAuthMethod);
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new McpOAuthError('invalid_client_metadata', 'Client metadata field must be a string');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new McpOAuthError('invalid_client_metadata', 'Client metadata field has an invalid length');
  }
  return normalized;
}

function validateHttpsUrl(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, CLIENT_ID_MAX_LENGTH);
  if (!normalized) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new McpOAuthError('invalid_client_metadata', `${field} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
    throw new McpOAuthError('invalid_client_metadata', `${field} must be an HTTPS URL without credentials or a fragment`);
  }
  return parsed.href;
}

export function validateMcpRedirectUri(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > REDIRECT_URI_MAX_LENGTH
  ) {
    throw new McpOAuthError('invalid_redirect_uri', 'redirect_uri must be a non-empty URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new McpOAuthError('invalid_redirect_uri', 'redirect_uri must be a valid URL');
  }

  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
  if ((!isLoopback && parsed.protocol !== 'https:') || (isLoopback && parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new McpOAuthError('invalid_redirect_uri', 'redirect_uri must use HTTPS or an HTTP(S) loopback address');
  }
  if (parsed.username || parsed.password || value.includes('#')) {
    throw new McpOAuthError('invalid_redirect_uri', 'redirect_uri must not contain credentials or a fragment');
  }
  return value;
}

export function mcpRedirectUriMatches(requested: string, registered: string): boolean {
  if (requested === registered) return true;
  let requestedUrl: URL;
  let registeredUrl: URL;
  try {
    requestedUrl = new URL(requested);
    registeredUrl = new URL(registered);
  } catch {
    return false;
  }
  if (
    requestedUrl.protocol !== 'http:' ||
    registeredUrl.protocol !== 'http:' ||
    requestedUrl.hostname !== registeredUrl.hostname ||
    !['127.0.0.1', '[::1]', '::1'].includes(requestedUrl.hostname) ||
    requestedUrl.username ||
    requestedUrl.password ||
    registeredUrl.username ||
    registeredUrl.password ||
    requested.includes('#') ||
    registered.includes('#')
  ) {
    return false;
  }
  return (
    requestedUrl.pathname === registeredUrl.pathname &&
    requestedUrl.search === registeredUrl.search
  );
}

function normalizeStringArray(value: unknown, fallback: string[], field: string): string[] {
  if (value == null) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new McpOAuthError('invalid_client_metadata', `${field} must be an array of strings`);
  }
  return [...new Set(value)];
}

export function normalizeMcpOAuthClientMetadata(
  input: unknown,
  options: { allowPrivateKeyJwt?: boolean } = {}
): McpOAuthClientMetadata {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new McpOAuthError('invalid_client_metadata', 'Client metadata must be a JSON object');
  }
  const metadata = input as Record<string, unknown>;

  if (!Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length < 1 || metadata.redirect_uris.length > MAX_REDIRECT_URIS) {
    throw new McpOAuthError('invalid_redirect_uri', `redirect_uris must contain 1 to ${MAX_REDIRECT_URIS} entries`);
  }
  const redirectUris = [...new Set(metadata.redirect_uris.map(validateMcpRedirectUri))];

  const authMethod = metadata.token_endpoint_auth_method == null
    ? 'none'
    : String(metadata.token_endpoint_auth_method).trim().toLowerCase();
  if (!isSupportedMcpOAuthClientAuthMethod(authMethod) || (authMethod === 'private_key_jwt' && !options.allowPrivateKeyJwt)) {
    throw new McpOAuthError(
      'invalid_client_metadata',
      options.allowPrivateKeyJwt
        ? 'Unsupported token_endpoint_auth_method; use none, client_secret_basic, client_secret_post, or private_key_jwt'
        : 'Unsupported token_endpoint_auth_method; DCR supports none, client_secret_basic, or client_secret_post'
    );
  }

  const jwksUri = validateHttpsUrl(metadata.jwks_uri, 'jwks_uri');
  const signingAlg = optionalString(metadata.token_endpoint_auth_signing_alg, 32);
  if (authMethod === 'private_key_jwt') {
    if (!jwksUri) {
      throw new McpOAuthError('invalid_client_metadata', 'private_key_jwt requires jwks_uri');
    }
    if (signingAlg && signingAlg !== 'RS256') {
      throw new McpOAuthError('invalid_client_metadata', 'Only RS256 private_key_jwt assertions are supported');
    }
    const advertisedMethods = metadata.token_endpoint_auth_methods_supported;
    if (advertisedMethods != null) {
      if (!Array.isArray(advertisedMethods) || advertisedMethods.some((method) => typeof method !== 'string')) {
        throw new McpOAuthError('invalid_client_metadata', 'token_endpoint_auth_methods_supported must be an array of strings');
      }
      const normalizedMethods = advertisedMethods.map((method) => method.trim().toLowerCase());
      if (!normalizedMethods.includes('private_key_jwt')) {
        throw new McpOAuthError('invalid_client_metadata', 'Client metadata does not advertise private_key_jwt support');
      }
    }
  }

  const grantTypes = normalizeStringArray(
    metadata.grant_types,
    ['authorization_code', 'refresh_token'],
    'grant_types'
  );
  if (!grantTypes.includes('authorization_code') || grantTypes.some((grant) => grant !== 'authorization_code' && grant !== 'refresh_token')) {
    throw new McpOAuthError('invalid_client_metadata', 'grant_types may only contain authorization_code and refresh_token');
  }

  const responseTypes = normalizeStringArray(metadata.response_types, ['code'], 'response_types');
  if (responseTypes.length !== 1 || responseTypes[0] !== 'code') {
    throw new McpOAuthError('invalid_client_metadata', 'response_types must contain only code');
  }

  const requestedScopes = parseMcpOAuthScopes(metadata.scope == null ? MCP_OAUTH_SCOPE : String(metadata.scope));
  const clientName = optionalString(metadata.client_name, 100) || 'MCP Client';

  return {
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
    grant_types: grantTypes as Array<'authorization_code' | 'refresh_token'>,
    response_types: ['code'],
    client_name: clientName,
    client_uri: validateHttpsUrl(metadata.client_uri, 'client_uri'),
    logo_uri: validateHttpsUrl(metadata.logo_uri, 'logo_uri'),
    scope: requestedScopes.join(' '),
    ...(authMethod === 'private_key_jwt'
      ? { jwks_uri: jwksUri, token_endpoint_auth_signing_alg: (signingAlg || 'RS256') as 'RS256' }
      : {}),
  };
}

export function validateClientIdMetadataDocument(clientId: string, input: unknown): McpOAuthClient {
  if (!isClientIdMetadataDocumentUrl(clientId)) {
    throw new McpOAuthError('invalid_client', 'Client ID metadata document URL is invalid');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new McpOAuthError('invalid_client', 'Client ID metadata document must be a JSON object');
  }
  const document = input as Record<string, unknown>;
  if (document.client_id !== clientId) {
    throw new McpOAuthError('invalid_client', 'Client ID metadata document client_id does not match its URL');
  }
  if (typeof document.client_name !== 'string' || !document.client_name.trim()) {
    throw new McpOAuthError('invalid_client', 'Client ID metadata document must include client_name');
  }
  if ('client_secret' in document || 'client_secret_expires_at' in document) {
    throw new McpOAuthError('invalid_client', 'Client ID metadata documents must not contain shared client secrets');
  }
  try {
    const normalized = normalizeMcpOAuthClientMetadata(document, { allowPrivateKeyJwt: true });
    if (normalized.token_endpoint_auth_method !== 'none' && normalized.token_endpoint_auth_method !== 'private_key_jwt') {
      throw new McpOAuthError(
        'invalid_client',
        'Client ID metadata documents must use token_endpoint_auth_method=none; confidential clients must use DCR'
      );
    }
    return {
      ...normalized,
      client_id: clientId,
    };
  } catch (error) {
    if (error instanceof McpOAuthError) {
      throw new McpOAuthError('invalid_client', error.message);
    }
    throw error;
  }
}

export function isClientIdMetadataDocumentUrl(clientId: string): boolean {
  if (!clientId || clientId.length > CLIENT_ID_MAX_LENGTH) return false;
  if (/[?#]/.test(clientId)) return false;
  const rawPath = clientId.replace(/^https:\/\/[^/]+/i, '');
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) return false;
  try {
    const parsed = new URL(clientId);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) return false;
    if (!parsed.pathname || parsed.pathname === '/') return false;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!hostname || net.isIP(hostname) !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

export function isPublicMetadataIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    ) {
      return false;
    }
    return true;
  }

  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const firstGroup = Number.parseInt(lower.split(':')[0] || '0', 16);
    if (firstGroup < 0x2000 || firstGroup > 0x3fff) return false;
    if (lower.startsWith('2001:db8:') || lower === '2001:db8::') return false;
    return true;
  }
  return false;
}

export function parseMcpOAuthScopes(raw: string | null | undefined): string[] {
  if (!raw) return [MCP_OAUTH_SCOPE];
  const scopes = [...new Set(raw.split(/\s+/).map((scope) => scope.trim()).filter(Boolean))];
  if (scopes.length !== 1 || scopes[0] !== MCP_OAUTH_SCOPE) {
    throw new McpOAuthError('invalid_scope', `Only the ${MCP_OAUTH_SCOPE} scope is supported`);
  }
  return scopes;
}

export function validatePkceChallenge(challenge: unknown, method: unknown): string {
  if (method !== 'S256') throw new McpOAuthError('invalid_request', 'code_challenge_method must be S256');
  if (typeof challenge !== 'string' || !PKCE_CHALLENGE_PATTERN.test(challenge)) {
    throw new McpOAuthError('invalid_request', 'code_challenge must be a valid S256 PKCE challenge');
  }
  return challenge;
}

export function derivePkceChallenge(verifier: string): string {
  if (!PKCE_VERIFIER_PATTERN.test(verifier)) {
    throw new McpOAuthError('invalid_grant', 'code_verifier is invalid');
  }
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function verifyPkce(verifier: string, expectedChallenge: string): boolean {
  const actual = derivePkceChallenge(verifier);
  const actualBytes = Buffer.from(actual, 'ascii');
  const expectedBytes = Buffer.from(expectedChallenge, 'ascii');
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

export function validateMcpResource(resource: unknown, expectedResource: string): string {
  if (typeof resource !== 'string') throw new McpOAuthError('invalid_request', 'resource must be an absolute URI');
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(resource);
    expected = new URL(expectedResource);
  } catch {
    throw new McpOAuthError('invalid_request', 'resource must be an absolute URI');
  }
  if (parsed.hash) throw new McpOAuthError('invalid_request', 'resource must not contain a fragment');
  if (
    parsed.protocol !== expected.protocol ||
    parsed.host !== expected.host ||
    parsed.pathname !== expected.pathname ||
    parsed.search !== expected.search
  ) {
    throw new McpOAuthError('invalid_request', 'resource must match the canonical MCP server URI');
  }
  return expectedResource;
}

export function isMcpHttpOriginAllowed(
  originHeader: string | null,
  serverOrigin: string,
  configuredOrigins = process.env.ALLOWED_ORIGINS || ''
): boolean {
  if (!originHeader) return true;
  let normalizedOrigin: string;
  try {
    const parsed = new URL(originHeader);
    normalizedOrigin = parsed.origin;
    if (originHeader !== normalizedOrigin || parsed.username || parsed.password) return false;
  } catch {
    return false;
  }

  const allowed = new Set<string>([new URL(serverOrigin).origin]);
  for (const candidate of configuredOrigins.split(',').map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate);
      if (candidate === parsed.origin && !parsed.username && !parsed.password) allowed.add(parsed.origin);
    } catch {
      // Invalid allowlist entries are ignored so they cannot accidentally broaden access.
    }
  }
  return allowed.has(normalizedOrigin);
}

export function resolveMcpOAuthOrigin(options: {
  headers?: HeadersLike;
  requestOrigin?: string;
  configuredOrigin?: string;
  nodeEnv?: string;
} = {}): string {
  const configured = (
    options.configuredOrigin ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).trim();
  const environment = options.nodeEnv || process.env.NODE_ENV || 'development';

  let candidate = configured;
  if (!candidate && environment !== 'production') {
    const forwardedHost = options.headers?.get('x-forwarded-host') || options.headers?.get('host') || '';
    const forwardedProto = options.headers?.get('x-forwarded-proto') || 'http';
    candidate = forwardedHost ? `${forwardedProto}://${forwardedHost}` : (options.requestOrigin || '');
  }
  if (!candidate) {
    throw new McpOAuthError('server_error', 'APP_URL is required to enable MCP OAuth in production', 500);
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new McpOAuthError('server_error', 'APP_URL must be a valid absolute URL', 500);
  }
  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(environment !== 'production' && isLoopback && parsed.protocol === 'http:')) {
    throw new McpOAuthError('server_error', 'MCP OAuth requires an HTTPS APP_URL (HTTP is allowed only for local development)', 500);
  }
  return parsed.origin;
}

export function getMcpOAuthUrls(options: Parameters<typeof resolveMcpOAuthOrigin>[0] = {}) {
  const origin = resolveMcpOAuthOrigin(options);
  return {
    origin,
    issuer: origin,
    resource: `${origin}/api/mcp`,
    protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource/api/mcp`,
    authorizationServerMetadata: `${origin}/.well-known/oauth-authorization-server`,
    authorizationEndpoint: `${origin}/oauth/authorize`,
    tokenEndpoint: `${origin}/api/oauth/token`,
    registrationEndpoint: `${origin}/api/oauth/register`,
    revocationEndpoint: `${origin}/api/oauth/revoke`,
  };
}

export function oauthErrorBody(error: unknown): { error: string; error_description: string } {
  if (error instanceof McpOAuthError) {
    return { error: error.code, error_description: error.message };
  }
  return { error: 'server_error', error_description: 'Internal Server Error' };
}
