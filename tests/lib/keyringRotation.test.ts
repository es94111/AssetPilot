import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { encryptSecret } from '../../lib/apiTokenCore.ts';
import { generateVapidKeys } from '../../lib/webPushCore.ts';
import { KEYRING_ROTATION_LOCK_NAME } from '../../lib/keyringCore.ts';
import { unwrapDek, wrapDek } from '../../lib/photoCryptoCore.ts';

type Value = string | number | null | Uint8Array;
type Row = Record<string, string | number | null | boolean>;

function signJwtForTest(payload: Record<string, unknown>, key: string | Buffer, header: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode(payload)}`;
  const digest = header.alg === 'HS384' ? 'sha384' : 'sha256';
  const signature = crypto.createHmac(digest, key).update(input).digest('base64url');
  return `${input}.${signature}`;
}

interface KeyRow extends Row {
  kid: string;
  purpose: string;
  wrapped_key: string;
  wrap_iv: string;
  wrap_tag: string;
  status: string;
  accept_legacy: number;
  created_at: number;
}

interface JobRow extends Row {
  id: string;
  purpose: string;
  from_kid: string;
  to_kid: string;
  status: string;
  cursor_id: string;
  scanned_count: number;
  reencrypted_count: number;
  created_at: number;
  updated_at: number;
  completed_at: number;
  last_error_code: string;
}

class RotationMemoryDb {
  enabled = 0;
  rootKekControl: { provider: string; wrapped: string; rootKekUpdatedAt: number; updatedAt: number } = {
    provider: 'env', wrapped: '', rootKekUpdatedAt: 0, updatedAt: 0,
  };
  statements: string[] = [];
  modified = 0;
  advisoryLocks: string[] = [];
  authUser: Row | null = null;
  loginSession: (Row & { id: string; user_id: string; revoked_at: number }) | null = null;
  keys: KeyRow[] = [];
  jobs: JobRow[] = [];
  webhooks: Array<{ id: string; secret_encrypted: string; secret_prefix: string }> = [];
  photos: Array<{ user_id: string; wrapped_dek: string; iv: string; tag: string; key_id: string | null }> = [];

  prepare(sql: string) {
    let rows: Row[] = [];
    let index = 0;
    return {
      bind: (params: Value[] = []) => { rows = this.select(sql, params); index = 0; },
      step: () => index < rows.length,
      getAsObject: () => rows[index++],
      free: () => {},
    };
  }

  run(sql: string, params: Value[] = []): void {
    const statement = sql.replace(/\s+/gu, ' ').trim();
    this.statements.push(statement);
    this.modified = 0;
    if (/^(BEGIN|COMMIT|ROLLBACK)$/iu.test(statement)) return;
    if (statement.startsWith('CREATE TABLE IF NOT EXISTS keyring_control') || statement.startsWith('ALTER TABLE keyring_control ADD COLUMN IF NOT EXISTS root_kek_')) return;
    if (statement.startsWith('SELECT pg_advisory') || statement.startsWith('SELECT pg_try_advisory')) {
      if (params[0]) this.advisoryLocks.push(String(params[0]));
      return;
    }

    if (statement.startsWith('INSERT INTO user_photo_keys')) {
      const [user_id, wrapped_dek, iv, tag, key_id] = params;
      const userId = String(user_id);
      if (this.photos.some((row) => row.user_id === userId)) return;
      this.photos.push({
        user_id: userId,
        wrapped_dek: String(wrapped_dek),
        iv: String(iv),
        tag: String(tag),
        key_id: key_id == null ? null : String(key_id),
      });
      this.modified = 1;
      return;
    }
    if (statement.startsWith('DELETE FROM keyring_keys')) {
      this.keys = [];
      return;
    }
    if (statement.startsWith('INSERT INTO keyring_keys')) {
      const [kid, purpose, wrapped_key, wrap_iv, wrap_tag] = params;
      const pending = statement.includes("'pending'");
      const status = pending ? 'pending' : String(params[5]);
      const accept_legacy = pending ? 0 : Number(params[6]);
      const created_at = Number(params[pending ? 5 : 7]);
      this.keys.push({
        kid: String(kid), purpose: String(purpose), wrapped_key: String(wrapped_key),
        wrap_iv: String(wrap_iv), wrap_tag: String(wrap_tag), status,
        accept_legacy, created_at,
      });
      this.modified = 1;
      return;
    }
    if (statement.startsWith('UPDATE keyring_control SET enabled = 1')) {
      this.enabled = 1;
      if (statement.includes('root_kek_provider')) {
        const [provider, wrapped, rootKekUpdatedAt, updatedAt] = params;
        this.rootKekControl = {
          provider: String(provider), wrapped: String(wrapped),
          rootKekUpdatedAt: Number(rootKekUpdatedAt), updatedAt: Number(updatedAt),
        };
      }
      this.modified = 1;
      return;
    }
    if (statement.startsWith('INSERT INTO keyring_rotations')) {
      const [id, purpose, from_kid, to_kid, created_at, updated_at] = params;
      this.jobs.push({
        id: String(id), purpose: String(purpose), from_kid: String(from_kid), to_kid: String(to_kid),
        status: 'prepared', cursor_id: '', scanned_count: 0, reencrypted_count: 0,
        created_at: Number(created_at), updated_at: Number(updated_at), completed_at: 0, last_error_code: '',
      });
      this.modified = 1;
      return;
    }
    if (statement.startsWith("UPDATE keyring_keys SET status = 'previous'")) {
      const purpose = String(params[0]);
      for (const key of this.keys) {
        if (key.purpose === purpose && key.status === 'active') { key.status = 'previous'; this.modified += 1; }
      }
      return;
    }
    if (statement.startsWith("UPDATE keyring_keys SET status = 'active'")) {
      const [kid, purpose] = params.map(String);
      const expected = statement.includes("status = 'pending'") ? 'pending' : 'previous';
      for (const key of this.keys) {
        if (key.kid === kid && key.purpose === purpose && key.status === expected) {
          key.status = 'active';
          this.modified += 1;
        }
      }
      return;
    }
    if (statement.startsWith('UPDATE webhook_subscriptions')) {
      const [secret_encrypted, id, prior] = params.map(String);
      const row = this.webhooks.find((item) => item.id === id && item.secret_encrypted === prior);
      if (row) { row.secret_encrypted = String(secret_encrypted); this.modified = 1; }
      return;
    }
    if (statement.startsWith('UPDATE user_photo_keys')) {
      const [wrapped_dek, iv, tag, key_id, userId, priorKid] = params;
      const row = this.photos.find((item) => item.user_id === String(userId) && item.key_id === (priorKid == null ? null : String(priorKid)));
      if (row) {
        row.wrapped_dek = String(wrapped_dek);
        row.iv = String(iv);
        row.tag = String(tag);
        row.key_id = String(key_id);
        this.modified = 1;
      }
      return;
    }
    if (statement.startsWith('UPDATE keyring_rotations SET cursor_id')) {
      const [cursor_id, scanned, reencrypted, updated_at, id] = params;
      const job = this.jobs.find((item) => item.id === String(id));
      if (job) {
        job.cursor_id = String(cursor_id);
        job.scanned_count += Number(scanned);
        job.reencrypted_count += Number(reencrypted);
        job.updated_at = Number(updated_at);
        this.modified = 1;
      }
      return;
    }
    if (statement.startsWith('UPDATE keyring_rotations')) {
      const id = String(params[params.length - 1]);
      const job = this.jobs.find((item) => item.id === id);
      if (!job) return;
      if (statement.includes("status = 'running'")) job.status = 'running';
      if (statement.includes("status = 'paused'")) { job.status = 'paused'; job.last_error_code = String(params[0]); }
      if (statement.includes("status = 'completed'")) { job.status = 'completed'; job.completed_at = Number(params[0]); job.last_error_code = ''; }
      if (statement.includes("status = 'rolled_back'")) job.status = 'rolled_back';
      job.updated_at = Number(params[params.length - 2] ?? job.updated_at);
      this.modified = 1;
      return;
    }
    throw new Error(`Unsupported test SQL write: ${statement}`);
  }

  exec(): Array<{ columns: string[]; values: Array<Array<string | number | null>> }> { return []; }
  getRowsModified(): number { return this.modified; }
  close(): void {}

  private select(sql: string, params: Value[]): Row[] {
    const statement = sql.replace(/\s+/gu, ' ').trim();
    if (statement.includes('FROM keyring_control')) return [{ enabled: this.enabled }];
    if (statement.includes('pg_try_advisory_xact_lock')) return [{ locked: true }];
    if (statement.includes('FROM users')) {
      return this.authUser && String(this.authUser.id) === String(params[0]) ? [this.authUser] : [];
    }
    if (statement.includes('FROM login_sessions')) {
      const [id, userId] = params.map(String);
      const session = this.loginSession;
      return session && session.id === id && session.user_id === userId && session.revoked_at === 0
        ? [{ token_hash: session.token_hash, expires_at: session.expires_at, last_seen_at: session.last_seen_at }]
        : [];
    }
    if (statement.includes('FROM keyring_keys')) {
      let rows = [...this.keys];
      if (statement.includes('WHERE purpose = ?')) rows = rows.filter((key) => key.purpose === String(params[0]));
      else {
        const fixedPurpose = statement.match(/WHERE purpose = '([^']+)'/u)?.[1];
        if (fixedPurpose) rows = rows.filter((key) => key.purpose === fixedPurpose);
      }
      if (statement.includes('kid = ?')) rows = rows.filter((key) => key.kid === String(params[1]));
      if (statement.includes('status = ?')) rows = rows.filter((key) => key.status === String(params[1]));
      else if (statement.includes("status = 'active'")) rows = rows.filter((key) => key.status === 'active');
      else if (statement.includes("status = 'previous'")) rows = rows.filter((key) => key.status === 'previous');
      else if (statement.includes("status IN ('active', 'previous')")) rows = rows.filter((key) => ['active', 'previous'].includes(key.status));
      if (statement.includes('accept_legacy = 1')) rows = rows.filter((key) => key.accept_legacy === 1);
      if (statement.includes('ORDER BY created_at DESC')) rows.sort((a, b) => b.created_at - a.created_at);
      if (statement.includes('LIMIT 2')) rows = rows.slice(0, 2);
      return rows;
    }
    if (statement.includes('FROM keyring_rotations')) {
      if (statement.includes('COUNT(*)')) return [{ count: 0 }];
      if (statement.includes('status IN')) {
        const purpose = String(params[0]);
        const statuses = params.slice(1).map(String);
        const found = this.jobs.find((job) => job.purpose === purpose && statuses.includes(job.status));
        return found ? [{ id: found.id }] : [];
      }
      const job = this.jobs.find((item) => item.id === String(params[0]));
      return job ? [job] : [];
    }
    if (statement.includes('FROM webhook_subscriptions')) {
      if (statement.includes('COUNT(*)')) {
        const prefix = String(params[0]);
        return [{ count: this.webhooks.filter((row) => !row.secret_encrypted.startsWith(prefix)).length }];
      }
      const [cursor, limit] = params.map(String);
      return this.webhooks.filter((row) => row.id > cursor).sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, Number(limit)).map((row) => ({ id: row.id, payload: row.secret_encrypted, secret_prefix: row.secret_prefix }));
    }
    if (statement.includes('FROM user_photo_keys')) {
      if (statement.includes('WHERE user_id = ?')) {
        const row = this.photos.find((item) => item.user_id === String(params[0]));
        return row ? [{ wrapped_dek: row.wrapped_dek, iv: row.iv, tag: row.tag, key_id: row.key_id }] : [];
      }
      if (statement.includes('COUNT(*)')) {
        const kid = String(params[0]);
        return [{ count: this.photos.filter((row) => row.key_id !== kid).length }];
      }
      const [cursor, limit] = params.map(String);
      return this.photos.filter((row) => row.user_id > cursor).sort((a, b) => a.user_id.localeCompare(b.user_id))
        .slice(0, Number(limit)).map((row) => ({ id: row.user_id, wrapped_dek: row.wrapped_dek, iv: row.iv, tag: row.tag, key_id: row.key_id }));
    }
    throw new Error(`Unsupported test SQL select: ${statement}`);
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assetpilot-keyring-rotation-'));
const db = new RotationMemoryDb();
const apiTokenMaster = 'legacy-api-token-secret-for-test';
const photoMaster = crypto.randomBytes(32);
const previousPhotoMaster = crypto.randomBytes(32);
const rootKek = crypto.randomBytes(32);
const vapid = generateVapidKeys();
process.env.ENV_PATH = path.join(tempDir, '.env');
process.env.KEYRING_ENABLE = 'true';
process.env.KEYRING_ROOT_KEK = rootKek.toString('base64');
process.env.JWT_SECRET = 'legacy-jwt-secret-for-test';
process.env.API_TOKEN_ENCRYPTION_KEY = apiTokenMaster;
process.env.PHOTO_MASTER_KEY = photoMaster.toString('base64');
process.env.PHOTO_MASTER_KEY_OLD = previousPhotoMaster.toString('base64');
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
(globalThis as Record<string, unknown>).__assetPilotDb = db;

const { initializeKeyring, getActiveKey, getKeyById, clearKeyringCache } = await import('../../lib/keyring.ts');
const { previewKeyRotation, prepareKeyRotation, activatePreparedRotation, runKeyRotation, rollbackKeyRotation, getRotationProgress, KeyRotationError } = await import('../../lib/keyringRotation.ts');

initializeKeyring();

test('manual key rotation previews, prepares, migrates, resumes, and rolls back without losing decryptability', async () => {
  const webhookSecret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
  db.webhooks.push({
    id: 'hook-1',
    secret_encrypted: encryptSecret(webhookSecret, apiTokenMaster),
    secret_prefix: webhookSecret.slice(0, 12),
  });
  const preview = previewKeyRotation('api-token');
  assert.equal(preview.rowsToReencrypt, 1);

  const apiRotationId = prepareKeyRotation('api-token');
  assert.throws(() => activatePreparedRotation(apiRotationId, false), (error: unknown) =>
    error instanceof KeyRotationError && error.code === 'READINESS_NOT_CONFIRMED');
  activatePreparedRotation(apiRotationId, true);
  const apiProgress = await runKeyRotation(apiRotationId);
  assert.equal(apiProgress.status, 'completed');
  assert.equal(apiProgress.reencrypted, 1);
  const apiJob = db.jobs.find((job) => job.id === apiRotationId)!;
  const apiActive = getActiveKey('api-token')!;
  const versionedWebhook = db.webhooks[0].secret_encrypted;
  assert.equal((await import('../../lib/keyringCore.ts')).decryptVersionedSecret(versionedWebhook, apiActive.key, 'api-token', apiActive.kid), webhookSecret);
  apiActive.key.fill(0);

  rollbackKeyRotation(apiRotationId);
  assert.equal(getRotationProgress(apiRotationId).status, 'rolled_back');
  const apiPrevious = getKeyById('api-token', apiJob.to_kid);
  assert.equal((await import('../../lib/keyringCore.ts')).decryptVersionedSecret(versionedWebhook, apiPrevious.key, 'api-token', apiPrevious.kid), webhookSecret);
  apiPrevious.key.fill(0);

  const dek = crypto.randomBytes(32);
  const wrapped = wrapDek(photoMaster, dek);
  db.photos.push({ user_id: 'user-null-kid', wrapped_dek: wrapped.wrapped, iv: wrapped.iv, tag: wrapped.tag, key_id: null });

  const previousDek = crypto.randomBytes(32);
  const previousWrapped = wrapDek(previousPhotoMaster, previousDek);
  db.photos.push({ user_id: 'user-empty-kid', wrapped_dek: previousWrapped.wrapped, iv: previousWrapped.iv, tag: previousWrapped.tag, key_id: '' });
  const { decryptPhoto, _resetPhotoCryptoCache } = await import('../../lib/photoCrypto.ts');
  const previousPhoto = (await import('../../lib/photoCryptoCore.ts')).encryptWithDek(previousDek, Buffer.from('photo wrapped by PHOTO_MASTER_KEY_OLD'));
  assert.deepEqual(decryptPhoto('user-empty-kid', previousPhoto), Buffer.from('photo wrapped by PHOTO_MASTER_KEY_OLD'));
  _resetPhotoCryptoCache();

  const photoPreview = previewKeyRotation('photo');
  assert.equal(photoPreview.rowsToReencrypt, 2);
  const photoRotationId = prepareKeyRotation('photo');
  activatePreparedRotation(photoRotationId, true);
  const photoProgress = await runKeyRotation(photoRotationId);
  assert.equal(photoProgress.status, 'completed');
  assert.ok(db.photos.every((row) => row.key_id !== null && row.key_id !== '' && row.key_id !== undefined));
  const photoActive = getActiveKey('photo')!;
  const restoredDeks = db.photos.map((row) => unwrapDek(photoActive.key, row.wrapped_dek, row.iv, row.tag));
  assert.deepEqual(restoredDeks[0], dek);
  assert.deepEqual(restoredDeks[1], previousDek);
  photoActive.key.fill(0);
  restoredDeks.forEach((restoredDek) => restoredDek.fill(0));
  _resetPhotoCryptoCache();
  assert.deepEqual(decryptPhoto('user-empty-kid', previousPhoto), Buffer.from('photo wrapped by PHOTO_MASTER_KEY_OLD'));
  _resetPhotoCryptoCache();
  dek.fill(0);
  previousDek.fill(0);
  clearKeyringCache();
});

test('JWT rotation accepts active, previous, and legacy tokens while rejecting invalid tokens', async () => {
  const { signToken, verifyToken } = await import('../../lib/auth.ts');
  const priorActive = getActiveKey('jwt')!;
  const priorKid = priorActive.kid;
  priorActive.key.fill(0);
  const previousToken = signToken('jwt-user', 4, 'jwt-session');
  const legacyToken = signJwtForTest(
    { userId: 'legacy-user', tokenVersion: 2, exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.JWT_SECRET!,
    { alg: 'HS256', typ: 'JWT' },
  );

  const rotationId = prepareKeyRotation('jwt');
  activatePreparedRotation(rotationId, true);
  assert.equal((await runKeyRotation(rotationId)).status, 'completed');

  assert.equal((verifyToken(previousToken) as { userId: string }).userId, 'jwt-user');
  assert.equal((verifyToken(legacyToken) as { userId: string }).userId, 'legacy-user');
  const currentToken = signToken('current-user', 5, 'current-session');
  assert.equal((verifyToken(currentToken) as { userId: string }).userId, 'current-user');

  const current = getActiveKey('jwt')!;
  const unknownKid = signJwtForTest({ userId: 'x', exp: Math.floor(Date.now() / 1000) + 60 }, current.key, {
    alg: 'HS256', typ: 'JWT', kid: 'unknown-key-id',
  });
  const emptyKid = signJwtForTest({ userId: 'x' }, current.key, { alg: 'HS256', typ: 'JWT', kid: '' });
  const malformedKid = signJwtForTest({ userId: 'x' }, current.key, { alg: 'HS256', typ: 'JWT', kid: 42 });
  const unsupportedAlgorithm = signJwtForTest({ userId: 'x' }, current.key, { alg: 'HS384', typ: 'JWT', kid: current.kid });
  current.key.fill(0);
  assert.throws(() => verifyToken(unknownKid), /Unknown or retired jwt key id/u);
  assert.throws(() => verifyToken(emptyKid), /invalid token key id/u);
  assert.throws(() => verifyToken(malformedKid), /invalid token key id/u);
  assert.throws(() => verifyToken(unsupportedAlgorithm), /invalid token algorithm/u);

  const previous = getKeyById('jwt', priorKid);
  const expiredToken = signJwtForTest(
    { userId: 'expired-user', exp: Math.floor(Date.now() / 1000) - 1 },
    previous.key,
    { alg: 'HS256', typ: 'JWT', kid: priorKid },
  );
  previous.key.fill(0);
  assert.throws(() => verifyToken(expiredToken), /jwt expired/u);
});

test('API auth still enforces token version and revoked sessions after JWT rotation', async () => {
  const { signToken } = await import('../../lib/auth.ts');
  const { requireAuth } = await import('../../lib/apiHelpers.ts');
  const { hashToken } = await import('../../lib/sessionHelpers.ts');
  const userId = 'auth-check-user';
  const sessionId = 'auth-check-session';
  db.authUser = {
    id: userId,
    email: 'auth-check@example.test',
    display_name: 'Auth check',
    is_admin: 0,
    admin_role: 'super',
    theme_mode: 'system',
    timezone: 'Asia/Taipei',
    token_version: 1,
    is_active: 1,
  };
  const requestFor = (token: string) => ({
    cookies: { get: (name: string) => name === 'authToken' ? { value: token } : undefined },
    method: 'GET',
    headers: new Headers(),
    url: 'http://localhost/api/auth-check',
  });

  const validToken = signToken(userId, 1, sessionId);
  db.loginSession = {
    id: sessionId,
    user_id: userId,
    token_hash: hashToken(validToken),
    expires_at: Date.now() + 60_000,
    last_seen_at: Date.now(),
    revoked_at: 0,
  };
  const valid = await requireAuth(requestFor(validToken), { skipAutomaticProcessing: true });
  assert.equal((valid as { userId?: string; status?: number }).userId, userId);

  const staleVersionToken = signToken(userId, 0, sessionId);
  db.loginSession.token_hash = hashToken(staleVersionToken);
  const staleVersion = await requireAuth(requestFor(staleVersionToken), { skipAutomaticProcessing: true });
  assert.equal((staleVersion as { status?: number }).status, 401);

  db.loginSession.token_hash = hashToken(validToken);
  db.loginSession.revoked_at = Date.now();
  const revoked = await requireAuth(requestFor(validToken), { skipAutomaticProcessing: true });
  assert.equal((revoked as { status?: number }).status, 401);
});

test('new photo DEKs use the shared rotation lock and active key', async () => {
  const { encryptPhoto, decryptPhoto, _resetPhotoCryptoCache } = await import('../../lib/photoCrypto.ts');
  const activeKey = getActiveKey('photo')!;
  const activeKid = activeKey.kid;
  activeKey.key.fill(0);
  const userId = 'user-created-after-rotation';
  const plaintext = Buffer.from('photo data created during key rotation');

  const encrypted = encryptPhoto(userId, plaintext);
  const stored = db.photos.find((row) => row.user_id === userId);
  assert.ok(stored);
  assert.equal(stored.key_id, activeKid);
  assert.ok(db.advisoryLocks.includes(KEYRING_ROTATION_LOCK_NAME));
  assert.deepEqual(decryptPhoto(userId, encrypted), plaintext);

  _resetPhotoCryptoCache();
});

test('fresh migration keyring preserves an OpenBao-wrapped Root KEK', async () => {
  const { createFreshKeyring } = await import('../../lib/keyring.ts');
  createFreshKeyring(rootKek, {
    provider: 'openbao',
    wrapped: 'vault:v3:preserved-root-kek',
    updatedAt: 456,
  });
  assert.equal(db.rootKekControl.provider, 'openbao');
  assert.equal(db.rootKekControl.wrapped, 'vault:v3:preserved-root-kek');
  assert.equal(db.rootKekControl.rootKekUpdatedAt, 456);
  assert.ok(db.rootKekControl.updatedAt > 0);
  for (const column of ['root_kek_provider', 'root_kek_wrapped', 'root_kek_updated_at']) {
    assert.ok(db.statements.some((statement) => statement.includes(`ADD COLUMN IF NOT EXISTS ${column}`)));
  }
  assert.ok(db.keys.some((key) => key.purpose === 'jwt' && key.status === 'active'));
  assert.ok(db.keys.some((key) => key.purpose === 'api-token' && key.status === 'active'));
  assert.ok(db.keys.some((key) => key.purpose === 'photo' && key.status === 'active'));
});

test('fresh migration keyring keeps env mode for older archives', async () => {
  const { createFreshKeyring } = await import('../../lib/keyring.ts');
  createFreshKeyring(rootKek);
  assert.equal(db.rootKekControl.provider, 'env');
  assert.equal(db.rootKekControl.wrapped, '');
  assert.equal(db.rootKekControl.rootKekUpdatedAt, 0);
});

test.after(() => {
  rootKek.fill(0);
  photoMaster.fill(0);
  previousPhotoMaster.fill(0);
  delete process.env.PHOTO_MASTER_KEY_OLD;
  fs.rmSync(tempDir, { recursive: true, force: true });
});
