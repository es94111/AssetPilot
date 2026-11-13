// lib/rootKekProvider.ts — OpenBao (Vault-API-compatible) Transit secrets engine as an optional
// source for KEYRING_ROOT_KEK. Default provider stays 'env' (today's behaviour, unchanged).
//
// Design choice: OpenBao never wraps individual purpose keys and is never on any request's hot
// path. It protects exactly one small blob — the 32-byte Root KEK material itself — behind a
// named Transit key. At startup, AssetPilot recovers that same plaintext by calling Transit
// `decrypt` on a ciphertext stored in keyring_control, then sets it into
// process.env.KEYRING_ROOT_KEK so the existing (unchanged) local AES-256-GCM keyring code in
// lib/keyring.ts / lib/keyringCore.ts keeps working exactly as before. Purpose-key rotation,
// JWT kid handling, and photo DEK wrapping are completely untouched by this module.
//
// OpenBao's own `auto_rotate_period` on the Transit key rotates automatically with zero action
// required here: the stored ciphertext stays decryptable via OpenBao's internal keyring until an
// operator advances `min_decryption_version`. rewrapStoredRootKek() lets an operator refresh the
// stored ciphertext onto the newest Transit key version — this never exposes or changes the
// plaintext root KEK and never touches lib/keyring.ts's keyring_keys rows.
//
// Fail-closed: any OpenBao error (misconfiguration, network, auth, wrong-length material) throws
// instead of falling back to env or generating an ad-hoc value, matching every other keyring
// failure mode in this codebase.

import { getDB, queryOne } from './db';

export type RootKekProviderId = 'env' | 'openbao';

export class RootKekProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RootKekProviderError';
  }
}

const ROOT_KEK_BYTES = 32;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_TRANSIT_KEY = 'assetpilot-root-kek';

export function rootKekProviderId(): RootKekProviderId {
  return String(process.env.KEYRING_ROOT_KEK_PROVIDER || '').trim().toLowerCase() === 'openbao' ? 'openbao' : 'env';
}

interface OpenBaoConfig {
  addr: string;
  token: string;
  transitKey: string;
}

function readConfig(): OpenBaoConfig {
  const addr = String(process.env.OPENBAO_ADDR || '').trim().replace(/\/+$/, '');
  const token = String(process.env.OPENBAO_TOKEN || '').trim();
  const transitKey = String(process.env.OPENBAO_TRANSIT_KEY || '').trim() || DEFAULT_TRANSIT_KEY;
  if (!addr) throw new RootKekProviderError('KEYRING_ROOT_KEK_PROVIDER=openbao 需要設定 OPENBAO_ADDR');
  if (!token) throw new RootKekProviderError('KEYRING_ROOT_KEK_PROVIDER=openbao 需要設定 OPENBAO_TOKEN');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transitKey)) {
    throw new RootKekProviderError('OPENBAO_TRANSIT_KEY 僅可包含字母、數字、- 與 _');
  }
  return { addr, token, transitKey };
}

async function transitRequest(
  config: OpenBaoConfig,
  method: 'GET' | 'POST',
  pathAndQuery: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(`${config.addr}/v1/${pathAndQuery}`, {
        method,
        headers: {
          'X-Vault-Token': config.token,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RootKekProviderError(`連線 OpenBao 逾時（${REQUEST_TIMEOUT_MS}ms）`);
      }
      throw new RootKekProviderError(`無法連線至 OpenBao：${error instanceof Error ? error.message : '未知錯誤'}`);
    }
    const text = await response.text();
    let json: { data?: Record<string, unknown>; errors?: string[] } = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new RootKekProviderError(`OpenBao 回應格式錯誤（HTTP ${response.status}）`);
      }
    }
    if (!response.ok) {
      const detail = Array.isArray(json.errors) && json.errors.length > 0 ? `：${json.errors.join('; ')}` : '';
      throw new RootKekProviderError(`OpenBao 要求失敗（HTTP ${response.status}）${detail}`);
    }
    return json.data || {};
  } finally {
    clearTimeout(timer);
  }
}

async function createDatakey(config: OpenBaoConfig): Promise<{ plaintext: string; ciphertext: string }> {
  const data = await transitRequest(config, 'POST', `transit/datakey/plaintext/${config.transitKey}`, { bits: 256 });
  const plaintext = String(data.plaintext || '');
  const ciphertext = String(data.ciphertext || '');
  if (!plaintext || !ciphertext) throw new RootKekProviderError('OpenBao datakey 回應缺少必要欄位');
  return { plaintext, ciphertext };
}

async function decryptBlob(config: OpenBaoConfig, ciphertext: string): Promise<string> {
  const data = await transitRequest(config, 'POST', `transit/decrypt/${config.transitKey}`, { ciphertext });
  const plaintext = String(data.plaintext || '');
  if (!plaintext) throw new RootKekProviderError('OpenBao decrypt 回應缺少 plaintext');
  return plaintext;
}

async function rewrapBlob(config: OpenBaoConfig, ciphertext: string): Promise<string> {
  const data = await transitRequest(config, 'POST', `transit/rewrap/${config.transitKey}`, { ciphertext });
  const next = String(data.ciphertext || '');
  if (!next) throw new RootKekProviderError('OpenBao rewrap 回應缺少 ciphertext');
  return next;
}

/** Unauthenticated connectivity probe; never touches the stored root KEK ciphertext. */
export async function testOpenBaoConnection(): Promise<void> {
  const config = readConfig();
  await transitRequest(config, 'GET', 'sys/health?standbyok=true&perfstandbyok=true');
}

function assertRootKekLength(base64Value: string): void {
  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64Value, 'base64');
  } catch {
    throw new RootKekProviderError('OpenBao 回傳的 root KEK 材料不是合法的 base64');
  }
  if (decoded.length !== ROOT_KEK_BYTES || decoded.toString('base64') !== base64Value) {
    throw new RootKekProviderError(`OpenBao 回傳的 root KEK 材料必須恰好 ${ROOT_KEK_BYTES} bytes`);
  }
}

let resolvedThisProcess = false;

/**
 * Resolves KEYRING_ROOT_KEK from OpenBao when KEYRING_ROOT_KEK_PROVIDER=openbao; a no-op
 * otherwise (the 'env' provider keeps reading KEYRING_ROOT_KEK exactly as deployed). Must run
 * once at startup, before any keyring code reads KEYRING_ROOT_KEK — see instrumentation.ts.
 * Idempotent per process via an internal flag (not by checking the env var), so a stale
 * KEYRING_ROOT_KEK left over from a previous provider is always overridden, never silently kept.
 */
export async function resolveRootKek(): Promise<void> {
  if (rootKekProviderId() !== 'openbao') return;
  if (resolvedThisProcess) return;

  const config = readConfig();
  const row = queryOne('SELECT root_kek_wrapped FROM keyring_control WHERE id = 1');
  const stored = String(row?.root_kek_wrapped || '');

  let plaintext: string;
  if (stored) {
    plaintext = await decryptBlob(config, stored);
    assertRootKekLength(plaintext);
  } else {
    const created = await createDatakey(config);
    assertRootKekLength(created.plaintext);
    const db = getDB();
    db.run(
      `UPDATE keyring_control
         SET root_kek_provider = 'openbao', root_kek_wrapped = ?, root_kek_updated_at = ?
       WHERE id = 1 AND root_kek_wrapped = ''`,
      [created.ciphertext, Date.now()],
    );
    if (db.getRowsModified() === 1) {
      plaintext = created.plaintext;
    } else {
      // Another replica won the race to create the datakey first; use its stored value so every
      // replica ends up unwrapping purpose keys with the SAME root KEK.
      const winner = queryOne('SELECT root_kek_wrapped FROM keyring_control WHERE id = 1');
      const winnerWrapped = String(winner?.root_kek_wrapped || '');
      if (!winnerWrapped) throw new RootKekProviderError('無法建立或讀取 OpenBao 包裝的 root KEK');
      plaintext = await decryptBlob(config, winnerWrapped);
      assertRootKekLength(plaintext);
    }
  }

  if (process.env.KEYRING_ROOT_KEK) {
    console.warn('[keyring] KEYRING_ROOT_KEK_PROVIDER=openbao；忽略環境變數中既有的 KEYRING_ROOT_KEK，改用 OpenBao 解析的值。');
  }
  process.env.KEYRING_ROOT_KEK = plaintext;
  resolvedThisProcess = true;
}

export interface RootKekRewrapResult {
  rewrapped: boolean;
  message: string;
}

/**
 * Re-wraps the stored root KEK ciphertext under OpenBao's current Transit key version, without
 * ever exposing or changing the plaintext. Safe to run repeatedly (e.g. a cron invoking the CLI)
 * after OpenBao's own auto_rotate_period creates a new key version. Purpose keys in
 * keyring_keys — and the plaintext root KEK itself — are never touched by this operation.
 */
export async function rewrapStoredRootKek(): Promise<RootKekRewrapResult> {
  if (rootKekProviderId() !== 'openbao') {
    throw new RootKekProviderError('KEYRING_ROOT_KEK_PROVIDER 不是 openbao；沒有需要 rewrap 的資料');
  }
  const config = readConfig();
  const row = queryOne('SELECT root_kek_wrapped FROM keyring_control WHERE id = 1');
  const stored = String(row?.root_kek_wrapped || '');
  if (!stored) throw new RootKekProviderError('尚未透過 OpenBao 建立 root KEK，無法 rewrap');

  const next = await rewrapBlob(config, stored);
  if (next === stored) {
    return { rewrapped: false, message: '已是 OpenBao 最新金鑰版本，無需更新' };
  }
  const db = getDB();
  db.run(
    'UPDATE keyring_control SET root_kek_wrapped = ?, root_kek_updated_at = ? WHERE id = 1 AND root_kek_wrapped = ?',
    [next, Date.now(), stored],
  );
  if (db.getRowsModified() !== 1) {
    throw new RootKekProviderError('root KEK 已被其他程序同時更新，請重試');
  }
  return { rewrapped: true, message: '已將 root KEK 更新為 OpenBao 最新金鑰版本' };
}

export interface RootKekProviderStatus {
  provider: RootKekProviderId;
  configured: boolean;
  wrapped: boolean;
  updatedAt: number;
}

export async function getRootKekProviderStatus(): Promise<RootKekProviderStatus> {
  const provider = rootKekProviderId();
  const row = queryOne('SELECT root_kek_wrapped, root_kek_updated_at FROM keyring_control WHERE id = 1');
  return {
    provider,
    configured: provider === 'openbao' ? Boolean(process.env.OPENBAO_ADDR && process.env.OPENBAO_TOKEN) : true,
    wrapped: Boolean(String(row?.root_kek_wrapped || '')),
    updatedAt: Number(row?.root_kek_updated_at) || 0,
  };
}
