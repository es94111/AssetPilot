// lib/nouriledgerHandoff.ts — 一鍵把使用者「自己的」資料交給 NouriLedger（合併後的新版）。
//
// 流程（OAuth authorization code + PKCE；本站同時是 authorization 與 resource server）：
//   1. NouriLedger 把瀏覽器導到 /api/migration/nouriledger/authorize，帶 state 與 PKCE S256 challenge。
//      已登入的使用者拿到一組綁定該 challenge 的短效 code，瀏覽器被導回 NouriLedger。
//   2. NouriLedger 的「伺服器」帶 code + PKCE verifier 呼叫 /userinfo（身分與筆數，不消耗 code）
//      與 /export（資料，消耗 code）。verifier 從不經過瀏覽器，所以從網址外洩的 code 沒有用。
//
// 未設定 NOURILEDGER_ORIGIN 時整個功能關閉。不需要任何資料庫變更：code 是無狀態的 HMAC 權杖，
// 單次使用只在記憶體內強制（verifier 要求與 10 分鐘壽命限制了重啟後的重放空間）。
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ensureEnvSecrets } from './envSecrets';

type Env = Readonly<Record<string, string | undefined>>;

export const HANDOFF_CALLBACK_PATH = '/migrate/callback';
export const HANDOFF_AUTHORIZE_PATH = '/api/migration/nouriledger/authorize';
/** 足夠使用者在 NouriLedger 讀完確認頁。 */
export const CODE_TTL_SECONDS = 600;

const CODE_PREFIX = 'nlh1';
export const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/u;
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/u;
export const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/u;

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

/** 回傳純 origin；僅接受 HTTPS（本機開發的 loopback 可用 HTTP），否則 null。 */
export function normalizeOrigin(value: string): string | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname))) return url.origin;
  return null;
}

let warnedFor: string | null = null;

/** 使用者可交付資料的 NouriLedger 站台；null 代表整個功能關閉。 */
export function getNouriLedgerOrigin(env: Env = process.env): string | null {
  const raw = (env.NOURILEDGER_ORIGIN ?? '').trim();
  if (!raw) return null;
  const origin = normalizeOrigin(raw);
  if (!origin && warnedFor !== raw) {
    warnedFor = raw;
    console.warn('[nouriledger-import] NOURILEDGER_ORIGIN is not a valid HTTPS origin; the one-click import stays disabled.');
  }
  return origin;
}

export type HandoffErrorCode = 'invalid_request' | 'invalid_grant';

export class HandoffError extends Error {
  readonly code: HandoffErrorCode;
  constructor(code: HandoffErrorCode) {
    super(code);
    this.name = 'HandoffError';
    this.code = code;
  }
}

export interface CodePayload {
  v: 1;
  /** code 發給的帳號。 */
  uid: string;
  /** 發出當下的 token_version：「登出所有裝置」會讓尚未使用的 code 立即失效。 */
  tv: number;
  /** 兌換方必須證明持有的 PKCE S256 challenge。 */
  cc: string;
  /** 到期時間（epoch 秒）。 */
  exp: number;
  jti: string;
  /** 這組 code 預定交給的 NouriLedger origin。 */
  aud: string;
}

function signingKey(env: Env): Buffer {
  if (env === process.env) ensureEnvSecrets();
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  return createHmac('sha256', secret).update('nouriledger-import:v1').digest();
}

function sign(body: string, env: Env): string {
  return createHmac('sha256', signingKey(env)).update(body).digest('base64url');
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export interface IssueOptions { now?: number; env?: Env }

export function issueAuthorizationCode(input: { userId: string; tokenVersion: number; codeChallenge: string; audience: string }, options: IssueOptions = {}): string {
  const payload: CodePayload = {
    v: 1, uid: input.userId, tv: input.tokenVersion, cc: input.codeChallenge,
    exp: Math.floor((options.now ?? Date.now()) / 1000) + CODE_TTL_SECONDS, jti: randomBytes(16).toString('base64url'), aud: input.audience,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${CODE_PREFIX}.${body}.${sign(body, options.env ?? process.env)}`;
}

/** 驗證簽章、期限、audience 與 PKCE。任何失敗都是同一個不透明的 invalid_grant。 */
export function verifyAuthorizationCode(code: string, input: { verifier: string; audience: string }, options: IssueOptions = {}): CodePayload {
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) throw new HandoffError('invalid_grant');
  const [, body, signature] = parts;
  if (!sameString(signature, sign(body, options.env ?? process.env))) throw new HandoffError('invalid_grant');
  let payload: Partial<CodePayload>;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<CodePayload>; } catch { throw new HandoffError('invalid_grant'); }
  if (payload.v !== 1 || typeof payload.uid !== 'string' || !payload.uid || !Number.isInteger(payload.tv) || typeof payload.cc !== 'string'
    || !Number.isInteger(payload.exp) || typeof payload.jti !== 'string' || typeof payload.aud !== 'string') throw new HandoffError('invalid_grant');
  if ((payload.exp as number) <= Math.floor((options.now ?? Date.now()) / 1000)) throw new HandoffError('invalid_grant');
  if (!sameString(payload.aud, input.audience)) throw new HandoffError('invalid_grant');
  if (!sameString(payload.cc, pkceChallenge(input.verifier))) throw new HandoffError('invalid_grant');
  return payload as CodePayload;
}

// 單次使用記錄。放在 globalThis 以便開發模式模組重載時不遺失。
const globalStore = globalThis as unknown as { __nouriLedgerUsedCodes?: Map<string, number> };
const usedCodes = (globalStore.__nouriLedgerUsedCodes ??= new Map<string, number>());

function pruneUsed(now: number): void {
  for (const [jti, expiresAt] of usedCodes) if (expiresAt <= now) usedCodes.delete(jti);
}

export function isCodeUsed(payload: CodePayload, now: number = Date.now()): boolean {
  pruneUsed(now);
  return usedCodes.has(payload.jti);
}

/** code 已被兌換過則回傳 false。 */
export function markCodeUsed(payload: CodePayload, now: number = Date.now()): boolean {
  pruneUsed(now);
  if (usedCodes.has(payload.jti)) return false;
  usedCodes.set(payload.jti, payload.exp * 1000);
  return true;
}

export const grantBodySchema = z.strictObject({
  code: z.string().min(20).max(4096),
  code_verifier: z.string().regex(VERIFIER_RE),
  redirect_uri: z.string().max(300),
});

/**
 * 驗證伺服器對伺服器請求。consume=true 兌換 code（export）；false 只檢查（userinfo）。
 * 已被兌換的 code 對兩者都無效。
 */
export function redeemGrant(body: unknown, origin: string, options: IssueOptions & { consume: boolean }): CodePayload {
  const parsed = grantBodySchema.safeParse(body);
  if (!parsed.success) throw new HandoffError('invalid_request');
  if (parsed.data.redirect_uri !== `${origin}${HANDOFF_CALLBACK_PATH}`) throw new HandoffError('invalid_grant');
  const payload = verifyAuthorizationCode(parsed.data.code, { verifier: parsed.data.code_verifier, audience: origin }, options);
  const now = options.now ?? Date.now();
  if (options.consume ? !markCodeUsed(payload, now) : isCodeUsed(payload, now)) throw new HandoffError('invalid_grant');
  return payload;
}

export type AuthorizeDecision =
  | { kind: 'reject'; status: number; error: string }
  | { kind: 'login' }
  | { kind: 'redirect'; location: string };

/**
 * 決定瀏覽器端 authorize 端點的行為。redirect 目標不可信時一律 `reject`（絕不把錯誤彈到沒設定過的網址）；
 * 其餘情況都導回 NouriLedger。
 */
export function decideAuthorize(url: URL, session: { userId: string; tokenVersion: number } | null, origin: string | null, options: IssueOptions = {}): AuthorizeDecision {
  if (!origin) return { kind: 'reject', status: 404, error: 'not_found' };
  const query = url.searchParams;
  const redirectUri = `${origin}${HANDOFF_CALLBACK_PATH}`;
  if (query.get('redirect_uri') !== redirectUri) return { kind: 'reject', status: 400, error: 'invalid_redirect_uri' };
  const state = query.get('state') ?? '';
  if (!STATE_RE.test(state)) return { kind: 'reject', status: 400, error: 'invalid_request' };
  const challenge = query.get('code_challenge') ?? '';
  if (query.get('response_type') !== 'code' || query.get('code_challenge_method') !== 'S256' || !CHALLENGE_RE.test(challenge)) {
    return { kind: 'redirect', location: `${redirectUri}?${new URLSearchParams({ error: 'invalid_request', state })}` };
  }
  if (!session) return { kind: 'login' };
  const code = issueAuthorizationCode({ userId: session.userId, tokenVersion: session.tokenVersion, codeChallenge: challenge, audience: origin }, options);
  return { kind: 'redirect', location: `${redirectUri}?${new URLSearchParams({ code, state })}` };
}

/** NouriLedger 讀取的非致命匯出提示標頭（base64url JSON），遠小於它 4 KB 的上限。 */
export function encodeWarnings(warnings: string[]): string {
  return Buffer.from(JSON.stringify(warnings.slice(0, 5).map((warning) => warning.slice(0, 160)))).toString('base64url');
}
