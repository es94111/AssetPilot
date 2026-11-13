import crypto from 'node:crypto';
import { getDB, queryAll, queryOne } from './db';
import { ensureEnvSecrets } from './envSecrets';
import { loadPreviousMasterKey } from './photoCryptoCore';
import {
  KEYRING_PURPOSES,
  parseRootKek,
  unwrapPurposeKey,
  wrapPurposeKey,
  type KeyringPurpose,
} from './keyringCore';

export { KEYRING_ROTATION_LOCK_NAME, KEYRING_PURPOSES, type KeyringPurpose } from './keyringCore';

export class KeyringConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyringConfigurationError';
  }
}

export interface KeyringKey {
  kid: string;
  purpose: KeyringPurpose;
  key: Buffer;
}

interface KeyRow {
  kid: string;
  purpose: KeyringPurpose;
  wrapped_key: string;
  wrap_iv: string;
  wrap_tag: string;
  status: 'active' | 'previous' | 'retired';
  accept_legacy: number;
}

let configurationChecked = false;
let configurationEnabled = false;
const keyCache = new Map<string, Buffer>();

function clearCachedKeys(): void {
  for (const key of keyCache.values()) key.fill(0);
  keyCache.clear();
}

function rootKek(): Buffer | null {
  try {
    return parseRootKek(process.env.KEYRING_ROOT_KEK);
  } catch (error) {
    throw new KeyringConfigurationError(error instanceof Error ? error.message : 'Invalid KEYRING_ROOT_KEK');
  }
}

function valueForPurpose(purpose: KeyringPurpose): Buffer | null {
  const raw = String(process.env[{
    jwt: 'JWT_SECRET',
    'api-token': 'API_TOKEN_ENCRYPTION_KEY',
    photo: 'PHOTO_MASTER_KEY',
  }[purpose]] || '').trim();
  if (!raw) return null;
  if (purpose === 'photo') {
    let key: Buffer;
    try {
      key = Buffer.from(raw, 'base64');
    } catch {
      throw new KeyringConfigurationError('PHOTO_MASTER_KEY must be base64-encoded');
    }
    if (key.length !== 32 || key.toString('base64') !== raw) {
      throw new KeyringConfigurationError('PHOTO_MASTER_KEY must decode to exactly 32 bytes');
    }
    return key;
  }
  return Buffer.from(raw, 'utf8');
}

function newKid(): string {
  return `k_${crypto.randomBytes(12).toString('base64url')}`;
}

function wrapAndInsert(
  purpose: KeyringPurpose,
  key: Buffer,
  root: Buffer,
  acceptLegacy: boolean,
  status: 'active' | 'previous' = 'active',
): string {
  const kid = newKid();
  const wrapped = wrapPurposeKey(key, root, purpose, kid);
  getDB().run(
    `INSERT INTO keyring_keys
       (kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kid, purpose, wrapped.ciphertext, wrapped.iv, wrapped.tag, status, acceptLegacy ? 1 : 0, Date.now()],
  );
  keyCache.set(`${purpose}:${kid}`, Buffer.from(key));
  return kid;
}

function unwrapRow(row: KeyRow, root: Buffer): KeyringKey {
  if (row.status === 'retired') throw new KeyringConfigurationError(`Key ${row.kid} has been retired`);
  const cacheKey = `${row.purpose}:${row.kid}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return { kid: row.kid, purpose: row.purpose, key: Buffer.from(cached) };
  try {
    const key = unwrapPurposeKey(
      { ciphertext: String(row.wrapped_key), iv: String(row.wrap_iv), tag: String(row.wrap_tag) },
      root,
      row.purpose,
      row.kid,
    );
    keyCache.set(cacheKey, key);
    return { kid: row.kid, purpose: row.purpose, key: Buffer.from(key) };
  } catch {
    throw new KeyringConfigurationError(`Could not unwrap ${row.purpose} key ${row.kid}; verify KEYRING_ROOT_KEK`);
  }
}

function seedInitialKeys(root: Buffer, activate: boolean): void {
  const db = getDB();
  db.run('BEGIN');
  try {
    db.run("SELECT pg_advisory_xact_lock(hashtext('assetpilot:keyring:initialize:v1'))");
    const control = queryOne('SELECT enabled FROM keyring_control WHERE id = 1');
    if (Number(control?.enabled) === 1) {
      db.run('COMMIT');
      return;
    }

    for (const purpose of KEYRING_PURPOSES) {
      const exists = queryOne('SELECT kid FROM keyring_keys WHERE purpose = ? AND status = ?', [purpose, 'active']);
      if (exists) continue;
      const key = valueForPurpose(purpose);
      if (key) wrapAndInsert(purpose, key, root, true);
    }

    const configuredPreviousPhotoKey = loadPreviousMasterKey();
    if (configuredPreviousPhotoKey) {
      const previousPhotoKey = Buffer.from(configuredPreviousPhotoKey);
      try {
        const legacyPhotoRows = queryAll(
          `SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy
           FROM keyring_keys WHERE purpose = 'photo' AND accept_legacy = 1 AND status IN ('active', 'previous')`,
        ) as unknown as KeyRow[];
        let alreadyWrapped = false;
        for (const row of legacyPhotoRows) {
          const existing = unwrapRow(row, root);
          try {
            if (existing.key.equals(previousPhotoKey)) alreadyWrapped = true;
          } finally {
            existing.key.fill(0);
          }
        }
        if (!alreadyWrapped) wrapAndInsert('photo', previousPhotoKey, root, true, 'previous');
      } finally {
        previousPhotoKey.fill(0);
      }
    }

    for (const purpose of ['jwt', 'api-token'] as const) {
      const active = queryOne('SELECT kid FROM keyring_keys WHERE purpose = ? AND status = ?', [purpose, 'active']);
      if (!active) throw new KeyringConfigurationError(`Missing initial ${purpose} key; configure its environment variable`);
    }
    if (activate) db.run('UPDATE keyring_control SET enabled = 1, updated_at = ? WHERE id = 1', [Date.now()]);
    db.run('COMMIT');
    clearCachedKeys();
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* preserve the initialization error */ }
    clearCachedKeys();
    throw error;
  }
}

function validateActiveKeys(root: Buffer): void {
  for (const purpose of ['jwt', 'api-token'] as const) {
    const row = queryOne(
      "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = ? AND status = 'active'",
      [purpose],
    ) as unknown as KeyRow | undefined;
    if (!row) throw new KeyringConfigurationError(`Keyring is enabled but the active ${purpose} key is missing`);
    unwrapRow(row, root);
  }
  const photoRows = queryAll(
    "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = 'photo' AND status = 'active'",
  ) as unknown as KeyRow[];
  for (const row of photoRows) unwrapRow(row, root);
}

function activationRequested(): boolean {
  return String(process.env.KEYRING_ENABLE || '').trim().toLowerCase() === 'true';
}

/** Run after DB migrations. A configured root KEK prepares the keyring; KEYRING_ENABLE opts into first activation. */
export function initializeKeyring(): boolean {
  const root = rootKek();
  const control = queryOne('SELECT enabled FROM keyring_control WHERE id = 1');
  const enabled = Number(control?.enabled) === 1;
  const activate = activationRequested();
  if (!root) {
    configurationChecked = true;
    configurationEnabled = false;
    if (enabled) {
      throw new KeyringConfigurationError('Keyring is enabled in the database but KEYRING_ROOT_KEK is missing');
    }
    if (activate) throw new KeyringConfigurationError('KEYRING_ENABLE=true requires KEYRING_ROOT_KEK');
    return false;
  }

  ensureEnvSecrets();
  if (!enabled) seedInitialKeys(root, activate);
  const latestEnabled = Number(queryOne('SELECT enabled FROM keyring_control WHERE id = 1')?.enabled) === 1;
  validateActiveKeys(root);
  configurationChecked = true;
  configurationEnabled = latestEnabled;
  return latestEnabled;
}

export function isKeyringEnabled(): boolean {
  const enabled = Number(queryOne('SELECT enabled FROM keyring_control WHERE id = 1')?.enabled) === 1;
  if (!enabled) {
    if (configurationChecked && !activationRequested()) return false;
    return initializeKeyring();
  }

  const root = rootKek();
  if (!root) {
    throw new KeyringConfigurationError('Keyring is enabled in the database but KEYRING_ROOT_KEK is missing');
  }
  return configurationChecked && configurationEnabled ? true : initializeKeyring();
}

export function getActiveKey(purpose: KeyringPurpose): KeyringKey | null {
  if (!isKeyringEnabled()) return null;
  const root = rootKek();
  if (!root) throw new KeyringConfigurationError('KEYRING_ROOT_KEK is missing');
  let row = queryOne(
    "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = ? AND status = 'active'",
    [purpose],
  ) as unknown as KeyRow | undefined;
  if (!row && purpose === 'photo') {
    const key = valueForPurpose('photo');
    if (!key) return null;
    const db = getDB();
    db.run('BEGIN');
    try {
      db.run("SELECT pg_advisory_xact_lock(hashtext('assetpilot:keyring:photo-seed:v1'))");
      row = queryOne(
        "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = 'photo' AND status = 'active'",
      ) as unknown as KeyRow | undefined;
      if (!row) {
        wrapAndInsert('photo', key, root, true);
        row = queryOne(
          "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = 'photo' AND status = 'active'",
        ) as unknown as KeyRow | undefined;
      }
      db.run('COMMIT');
    } catch (error) {
      try { db.run('ROLLBACK'); } catch { /* preserve the seed error */ }
      clearCachedKeys();
      throw error;
    }
  }
  if (!row) {
    if (purpose === 'photo') return null;
    throw new KeyringConfigurationError(`Keyring is enabled but the active ${purpose} key is missing`);
  }
  return unwrapRow(row, root);
}

export function getKeyById(purpose: KeyringPurpose, kid: string): KeyringKey {
  if (!isKeyringEnabled()) throw new KeyringConfigurationError('Keyring is not enabled');
  const root = rootKek();
  if (!root) throw new KeyringConfigurationError('KEYRING_ROOT_KEK is missing');
  const row = queryOne(
    "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = ? AND kid = ? AND status IN ('active', 'previous')",
    [purpose, kid],
  ) as unknown as KeyRow | undefined;
  if (!row) throw new KeyringConfigurationError(`Unknown or retired ${purpose} key id ${kid}`);
  return unwrapRow(row, root);
}

export function getPendingKeyById(purpose: KeyringPurpose, kid: string): KeyringKey {
  if (!isKeyringEnabled()) throw new KeyringConfigurationError('Keyring is not enabled');
  const root = rootKek();
  if (!root) throw new KeyringConfigurationError('KEYRING_ROOT_KEK is missing');
  const row = queryOne(
    "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = ? AND kid = ? AND status = 'pending'",
    [purpose, kid],
  ) as unknown as KeyRow | undefined;
  if (!row) throw new KeyringConfigurationError(`Unknown pending ${purpose} key id ${kid}`);
  return unwrapRow(row, root);
}

export function getLegacyKeys(purpose: KeyringPurpose): KeyringKey[] {
  if (!isKeyringEnabled()) return [];
  const root = rootKek();
  if (!root) throw new KeyringConfigurationError('KEYRING_ROOT_KEK is missing');
  const rows = queryAll(
    "SELECT kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy FROM keyring_keys WHERE purpose = ? AND accept_legacy = 1 AND status IN ('active', 'previous') ORDER BY created_at DESC",
    [purpose],
  ) as unknown as KeyRow[];
  if (purpose !== 'photo' && rows.length > 1) {
    throw new KeyringConfigurationError(`Multiple legacy ${purpose} keys are enabled`);
  }
  return rows.map((row) => unwrapRow(row, root));
}

export function getLegacyKey(purpose: KeyringPurpose): KeyringKey | null {
  const keys = getLegacyKeys(purpose);
  if (keys.length > 1) {
    for (const key of keys) key.key.fill(0);
    throw new KeyringConfigurationError(`Multiple legacy ${purpose} keys are enabled`);
  }
  return keys[0] ?? null;
}

export function clearKeyringCache(): void {
  clearCachedKeys();
  configurationChecked = false;
  configurationEnabled = false;
}

// Replaces every keyring key with freshly generated ones wrapped by `root`.
// Used only by the one-time migration import; `root` must be KEYRING_ROOT_KEK.
export function createFreshKeyring(root: Buffer): Record<KeyringPurpose, string> {
  const db = getDB();
  const kids = {} as Record<KeyringPurpose, string>;
  db.run('BEGIN');
  try {
    db.run("SELECT pg_advisory_xact_lock(hashtext('assetpilot:keyring:initialize:v1'))");
    clearCachedKeys();
    db.run('DELETE FROM keyring_keys');
    for (const purpose of KEYRING_PURPOSES) {
      const key = crypto.randomBytes(32);
      try {
        kids[purpose] = wrapAndInsert(purpose, key, root, false);
      } finally {
        key.fill(0);
      }
    }
    const now = Date.now();
    if (queryOne('SELECT id FROM keyring_control WHERE id = 1')) {
      db.run("UPDATE keyring_control SET enabled = 1, root_kek_wrapped = '', updated_at = ? WHERE id = 1", [now]);
    } else {
      db.run('INSERT INTO keyring_control (id, enabled, updated_at) VALUES (1, 1, ?)', [now]);
    }
    db.run('COMMIT');
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  } finally {
    clearKeyringCache();
  }
  return kids;
}
