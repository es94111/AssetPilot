import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const fixtureUrl = process.env.ASSETPILOT_BACKUP_TEST_DATABASE_URL;

if (!fixtureUrl) {
  test('database backup route integration', { skip: 'Requires ASSETPILOT_BACKUP_TEST_DATABASE_URL for an empty PostgreSQL test database' }, () => {});
} else {
  test('encrypted database backup and restore routes', async (t) => {
    process.env.DATABASE_URL = fixtureUrl;
    process.env.APP_URL = 'https://backup-tests.example';
    process.env.JWT_SECRET = 'fixture-only-backup-tests-session-signing-secret';
    process.env.PHOTO_MASTER_KEY = Buffer.alloc(32, 42).toString('base64');
    process.env.POSTGRES_SYNC_RESULT_BUFFER_BYTES = String(256 * 1024);
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'assetpilot-backup-route-test-'));
    const envPath = path.join(dataDirectory, '.env');
    const snapshotDirectory = path.join(dataDirectory, 'backups');
    process.env.ENV_PATH = envPath;

    const { Client } = await import('pg');
    const preflight = new Client({ connectionString: fixtureUrl });
    await preflight.connect();
    try {
      const existing = await preflight.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1",
      );
      assert.equal(existing.rows.length, 0, 'Use a fresh, disposable database for full database restores');
    } finally {
      await preflight.end();
    }

    const { NextRequest } = await import('next/server');
    const { initDB, getDB, queryAll, queryOne } = await import('../../lib/db');
    const { createLoginSession } = await import('../../lib/sessionHelpers');
    const { decryptBackupArchive } = await import('../../lib/backupArchive');
    const { DATABASE_RESTORE_LOCK } = await import('../../lib/databaseBackups');
    const { encryptPhoto, decryptPhoto, isEncryptedBlob, _resetPhotoCryptoCache } = await import('../../lib/photoCrypto');
    const { createPostgresBackupSql, MAX_RESTORE_SQL_BYTES } = await import('../../lib/postgresBackup');
    const download = await import('../../app/api/database/export/route');
    const cloud = await import('../../app/api/database/mega-s4/route');
    const restore = await import('../../app/api/database/import/route');
    await initDB();
    const db = getDB();
    t.after(() => db.close());

    const passphrase = 'fixture archive 密語 with outside spaces ';
    const legacyPassphrase = 'fixture recovery passphrase';
    const originalNote = 'original financial fixture 測試 typeof (invoice)';
    db.run('CREATE TABLE "backup_fixture" ("note" TEXT NOT NULL)');
    db.run('INSERT INTO "backup_fixture" ("note") VALUES (?)', [originalNote]);
    const setNote = (note: string) => db.run('UPDATE "backup_fixture" SET "note" = ?', [note]);
    const getNote = () => queryOne('SELECT "note" FROM "backup_fixture"')?.note;

    function session(user: string, isAdmin: boolean, role: string): string {
      db.run(
        "INSERT INTO users (id, email, password_hash, display_name, is_admin, admin_role) VALUES (?, ?, '', 'Test', ?, ?)",
        [user, `${user}@example.test`, isAdmin ? 1 : 0, role],
      );
      return createLoginSession(user, 0, {}).token;
    }
    const admin = session('backup-admin', true, 'super');
    const readonly = session('backup-reader', true, 'readonly');
    const regular = session('backup-user', false, 'super');

    function post(pathname: string, body: BodyInit, token: string, headers?: HeadersInit): Request {
      const requestHeaders = new Headers(headers);
      if (token) requestHeaders.set('cookie', `authToken=${token}`);
      requestHeaders.set('origin', process.env.APP_URL!);
      return new NextRequest(`${process.env.APP_URL}${pathname}`, { method: 'POST', body, headers: requestHeaders });
    }
    function jsonPost(pathname: string, body: object, token = admin): Request {
      return post(pathname, JSON.stringify(body), token, { 'Content-Type': 'application/json' });
    }
    function restorePost(file: Buffer, name: string, password = passphrase, token = admin): Request {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(file)]), name);
      form.append('passphrase', password);
      return post('/api/database/import', form, token);
    }
    async function statusCode(response: Response, expectedStatus: number, expectedCode: string) {
      const result = await response.json();
      assert.equal(response.status, expectedStatus);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(result.code || result.error, expectedCode);
      return result;
    }
    async function snapshotSql(response: Response, password: string): Promise<string> {
      const { beforeRestorePath } = await response.clone().json();
      assert.match(beforeRestorePath, /^backups\/before-restore-\d{14}-[a-f\d-]{36}\.apb$/);
      const snapshot = path.join(dataDirectory, beforeRestorePath);
      const file = readFileSync(snapshot);
      assert.equal(file.subarray(0, 4).toString(), 'APB1');
      assert.equal(file.includes(Buffer.from(originalNote)), false);
      if (process.platform !== 'win32') assert.equal(statSync(snapshot).mode & 0o777, 0o600);
      return decryptBackupArchive(file, password);
    }

    await t.test('all three operations require a super admin, and the plaintext GET is removed', async () => {
      assert.equal(Reflect.has(download, 'GET'), false);
      for (const [token, status] of [['', 401], [regular, 403], [readonly, 403]] as const) {
        for (const [pathname, route] of [
          ['/api/database/export', download],
          ['/api/database/mega-s4', cloud],
          ['/api/database/import', restore],
        ] as const) {
          const response = await route.POST(jsonPost(pathname, { passphrase }, token));
          assert.equal(response.status, status);
          assert.equal(response.headers.get('cache-control'), 'no-store');
        }
      }
    });

    let downloaded: Buffer;
    let legacy: Buffer;
    await t.test('download and the MEGA S4 request contain restorable APB1 ciphertext', async (subtest) => {
      const exportPost = () => download.POST(jsonPost('/api/database/export', { passphrase }));
      const response = await exportPost();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('content-type'), 'application/octet-stream');
      assert.match(response.headers.get('content-disposition') || '', /\.apb"$/);
      downloaded = Buffer.from(await response.arrayBuffer());
      assert.equal(downloaded.includes(Buffer.from(originalNote)), false);
      assert.ok((await decryptBackupArchive(downloaded, passphrase)).includes(originalNote));
      assert.notDeepEqual(Buffer.from(await (await exportPost()).arrayBuffer()), downloaded);
      legacy = Buffer.from(createPostgresBackupSql());

      process.env.MEGA_S4_ENDPOINT = 'https://backup-bucket.example.test';
      process.env.MEGA_S4_BUCKET = 'disposable-backup-fixture';
      process.env.MEGA_S4_ACCESS_KEY_ID = 'fixture-access';
      process.env.MEGA_S4_SECRET_ACCESS_KEY = 'fixture-secret';
      subtest.mock.method(dns, 'lookup', async () => [{ address: '203.0.114.21', family: 4 }]);
      let object: Buffer | undefined;
      subtest.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
        assert.match(url, /^https:\/\/backup-bucket\.example\.test\/disposable-backup-fixture\/.*\.apb$/);
        assert.equal(init.method, 'PUT');
        assert.equal(new Headers(init.headers).get('content-type'), 'application/octet-stream');
        assert.ok(init.body instanceof Uint8Array);
        object = Buffer.from(init.body);
        return new Response(null, { status: 200, headers: { ETag: 'fixture-etag' } });
      });
      const upload = await cloud.POST(jsonPost('/api/database/mega-s4', { passphrase }));
      assert.equal(upload.status, 200);
      assert.equal(upload.headers.get('cache-control'), 'no-store');
      assert.ok(object);
      assert.notDeepEqual(object, downloaded);
      assert.equal(object.includes(Buffer.from(originalNote)), false);
      assert.ok((await decryptBackupArchive(object, passphrase)).includes(originalNote));
      assert.equal(queryOne("SELECT role FROM data_operation_audit_log WHERE action = 'mega_s4_backup'")?.role, 'super_admin');
    });

    await t.test('invalid inputs create no recovery copies and do not change financial data', async () => {
      mkdirSync(snapshotDirectory);
      for (const route of [download, cloud]) {
        const pathname = route === download ? '/api/database/export' : '/api/database/mega-s4';
        await statusCode(await route.POST(jsonPost(pathname, {})), 400, 'invalid_passphrase');
      }
      await statusCode(await restore.POST(restorePost(legacy, 'legacy.sql', '')), 400, 'invalid_passphrase');
      await statusCode(await restore.POST(restorePost(downloaded, 'backup.apb', legacyPassphrase)), 400, 'decryption_failed');
      const tampered = Buffer.from(downloaded);
      tampered[tampered.length - 1] ^= 1;
      await statusCode(await restore.POST(restorePost(tampered, 'backup.apb')), 400, 'decryption_failed');
      await statusCode(await restore.POST(restorePost(downloaded.subarray(0, -1), 'backup.apb')), 400, 'decryption_failed');
      await statusCode(
        await restore.POST(restorePost(legacy.subarray(0, legacy.lastIndexOf('COMMIT;')), 'legacy.sql')),
        400,
        'invalid_sql',
      );

      const tooManyStatements = Buffer.from('-- AssetPilot PostgreSQL backup\nBEGIN;' + ';'.repeat(500_000) + 'COMMIT;');
      await statusCode(
        await restore.POST(restorePost(tooManyStatements, 'too-many-statements.sql')),
        422,
        'too_many_statements',
      );

      const original = restorePost(downloaded, 'backup.apb');
      const multipart = Buffer.from(await original.arrayBuffer());
      const clipped = post('/api/database/import', multipart.subarray(0, -100), admin, {
        'Content-Type': original.headers.get('content-type')!,
        'Content-Length': String(multipart.length),
      });
      await statusCode(await restore.POST(clipped), 400, 'incomplete_upload');
      const tooLarge = post('/api/database/import', multipart, admin, {
        'Content-Type': original.headers.get('content-type')!,
        'Content-Length': String(MAX_RESTORE_SQL_BYTES + 1024 * 1024),
      });
      await statusCode(await restore.POST(tooLarge), 413, 'too_large');
      assert.deepEqual(readdirSync(snapshotDirectory), []);
      assert.equal(getNote(), originalNote);
    });

    await t.test('a restore in a different PostgreSQL session blocks another database restore', async () => {
      const otherRestore = new Client({ connectionString: fixtureUrl });
      await otherRestore.connect();
      try {
        await otherRestore.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [DATABASE_RESTORE_LOCK]);
        await statusCode(await restore.POST(restorePost(downloaded, 'backup.apb')), 409, 'restore_in_progress');
        assert.deepEqual(readdirSync(snapshotDirectory), []);
        assert.equal(getNote(), originalNote);
      } finally {
        await otherRestore.end();
      }
    });

    await t.test('encrypted and legacy restores replace data and protect the previous state', async () => {
      setNote('state before encrypted restore');
      const photoUser = 'backup-admin';
      const oldPhoto = encryptPhoto(photoUser, Buffer.from('photo uploaded after the backup'));
      assert.ok(isEncryptedBlob(oldPhoto));
      assert.ok(queryOne('SELECT 1 FROM user_photo_keys WHERE user_id = ?', [photoUser]));
      const fromArchive = await restore.POST(restorePost(downloaded, 'renamed.sql'));
      assert.equal(fromArchive.status, 200);
      assert.ok((await snapshotSql(fromArchive, passphrase)).includes('state before encrypted restore'));
      assert.equal(queryOne('SELECT 1 FROM user_photo_keys WHERE user_id = ?', [photoUser]), null);
      const newPhotoContent = Buffer.from('photo uploaded after the restore');
      const newPhoto = encryptPhoto(photoUser, newPhotoContent);
      assert.ok(isEncryptedBlob(newPhoto));
      assert.ok(queryOne('SELECT 1 FROM user_photo_keys WHERE user_id = ?', [photoUser]));
      _resetPhotoCryptoCache();
      assert.deepEqual(decryptPhoto(photoUser, newPhoto), newPhotoContent);
      assert.equal(getNote(), originalNote);

      setNote('state before legacy restore');
      const fromSql = await restore.POST(restorePost(legacy, 'legacy.sql', legacyPassphrase));
      assert.equal(fromSql.status, 200);
      assert.ok((await snapshotSql(fromSql, legacyPassphrase)).includes('state before legacy restore'));
      assert.equal(getNote(), originalNote);
      assert.equal(readdirSync(snapshotDirectory).length, 2);
      assert.ok(queryOne("SELECT 1 FROM pg_trigger WHERE tgname = 'protect_shared_ledger_owner'"));
    });

    await t.test('a confirmed PostgreSQL rollback preserves the existing tables without replaying the copy', async () => {
      const originalTable = queryOne("SELECT 'backup_fixture'::regclass::oid AS oid")?.oid;
      assert.ok(originalTable);
      const sql = Buffer.from(`-- AssetPilot PostgreSQL backup
BEGIN;
DROP TABLE IF EXISTS "backup_fixture" CASCADE;
CREATE TABLE "backup_fixture" ("note" TEXT NOT NULL);
INSERT INTO "backup_fixture" ("note") VALUES ('different state');
CREATE TABLE "backup_temporary_fixture" ("note" TEXT NOT NULL);
DROP TABLE IF EXISTS "report_schedules" CASCADE;
CREATE TABLE "report_schedules" ("notify_email" BIGINT);
COMMIT;`);
      const failed = await restore.POST(restorePost(sql, 'rollback-fixture.sql'));
      assert.ok((await snapshotSql(failed, passphrase)).includes(originalNote));
      await statusCode(failed, 422, 'RESTORE_FAILED_ROLLED_BACK');
      assert.equal(getNote(), originalNote);
      assert.equal(queryOne("SELECT 'backup_fixture'::regclass::oid AS oid")?.oid, originalTable);
      assert.equal(queryOne("SELECT table_name FROM information_schema.tables WHERE table_name = 'backup_temporary_fixture'"), null);
      assert.ok(queryOne("SELECT 1 FROM information_schema.columns WHERE table_name = 'report_schedules' AND column_name = 'enabled'"));
    });

    await t.test('a lost commit acknowledgement replays the encrypted recovery copy', async (subtest) => {
      const sql = Buffer.from(`-- AssetPilot PostgreSQL backup
BEGIN;
DROP TABLE IF EXISTS "backup_fixture" CASCADE;
CREATE TABLE "backup_fixture" ("note" TEXT NOT NULL);
INSERT INTO "backup_fixture" ("note") VALUES ('committed failure fixture');
CREATE TABLE "backup_commit_fixture" ("note" TEXT NOT NULL);
COMMIT;`);
      const run = db.run.bind(db);
      // The first commit finishes capturing the snapshot. Lose the second
      // acknowledgement after PostgreSQL has committed the incoming restore.
      let commits = 0;
      subtest.mock.method(db, 'run', (statement: string, parameters?: Parameters<typeof db.run>[1]) => {
        run(statement, parameters);
        if (statement === 'COMMIT' && ++commits === 2) throw new Error('fixture: lost restore commit acknowledgement');
      });
      const failed = await restore.POST(restorePost(sql, 'commit-acknowledgement-fixture.sql'));
      assert.ok((await snapshotSql(failed, passphrase)).includes(originalNote));
      await statusCode(failed, 422, 'RESTORE_FAILED_ROLLED_BACK');
      assert.equal(getNote(), originalNote);
      assert.equal(queryOne("SELECT table_name FROM information_schema.tables WHERE table_name = 'backup_commit_fixture'"), null);
      assert.equal(commits, 3);
    });

    await t.test('a failed recovery-copy write prevents restore and does not audit secrets', async () => {
      setNote('state before unavailable storage');
      const unavailable = path.join(dataDirectory, 'unavailable');
      mkdirSync(unavailable);
      writeFileSync(path.join(unavailable, 'backups'), 'not a directory');
      process.env.ENV_PATH = path.join(unavailable, '.env');
      try {
        const failed = await restore.POST(restorePost(downloaded, 'backup.apb'));
        await statusCode(failed, 500, 'snapshot_failed');
      } finally {
        process.env.ENV_PATH = envPath;
      }
      assert.equal(getNote(), 'state before unavailable storage');
      assert.equal(readdirSync(snapshotDirectory).length, 4);
      const auditRows = queryAll('SELECT role, action, metadata FROM data_operation_audit_log');
      assert.ok(auditRows.some((row) => row.action === 'restore_failed' && row.role === 'super_admin'));
      const audit = JSON.stringify(auditRows);
      assert.equal(audit.includes(passphrase), false);
      assert.equal(audit.includes(legacyPassphrase), false);
    });

    await t.test('exports split oversized worker batches and report individual rows exceeding capacity', async () => {
      db.run('CREATE TABLE "backup_page_fixture" ("id" INTEGER PRIMARY KEY, "note" TEXT)');
      try {
        db.run("INSERT INTO backup_page_fixture SELECT id, repeat('x', 4096) FROM generate_series(1, 95) AS id");
        const exportPost = () => download.POST(jsonPost('/api/database/export', { passphrase }));
        const response = await exportPost();
        assert.equal(response.status, 200);
        const sql = await decryptBackupArchive(Buffer.from(await response.arrayBuffer()), passphrase);
        const ids = Array.from(
          sql.matchAll(/INSERT INTO "backup_page_fixture" \("id", "note"\) VALUES \((\d+), /g),
          (match) => Number(match[1]),
        ).sort((a, b) => a - b);
        assert.deepEqual(ids, Array.from({ length: 95 }, (_, index) => index + 1));

        db.run("INSERT INTO backup_page_fixture VALUES (96, repeat('x', 300000))");
        await statusCode(await exportPost(), 422, 'database_result_too_large');
        assert.equal(queryOne('SELECT COUNT(*) AS count FROM backup_page_fixture')?.count, 96);
      } finally {
        db.run('DROP TABLE backup_page_fixture');
      }
    });

    await t.test('oversized current database returns a database limit error before applying the restore', async (subtest) => {
      const currentState = 'current database is over its backup size limit';
      setNote(currentState);
      const snapshotsBefore = readdirSync(snapshotDirectory);
      const byteLength = Buffer.byteLength;
      subtest.mock.method(Buffer, 'byteLength', (value: Parameters<typeof Buffer.byteLength>[0], encoding?: BufferEncoding) => {
        if (typeof value === 'string' && value.startsWith('INSERT INTO "backup_fixture" ') && value.includes(currentState)) {
          return MAX_RESTORE_SQL_BYTES + 1;
        }
        return byteLength(value, encoding);
      });
      const failed = await restore.POST(restorePost(downloaded, 'backup.apb'));
      await statusCode(failed, 422, 'database_too_large');
      assert.equal(getNote(), currentState);
      assert.deepEqual(readdirSync(snapshotDirectory), snapshotsBefore);
    });

    await t.test('directory sync failure prevents restoring after the snapshot rename', { skip: process.platform === 'win32' }, async (subtest) => {
      const currentState = 'state before snapshot directory failure';
      setNote(currentState);
      const fsync = fs.fsyncSync;
      let syncedFile = false;
      subtest.mock.method(fs, 'fsyncSync', (descriptor: number) => {
        if (fs.fstatSync(descriptor).isDirectory()) {
          assert.ok(syncedFile);
          throw new Error('fixture: snapshot directory sync failed');
        }
        fsync(descriptor);
        syncedFile = true;
      });
      const failed = await restore.POST(restorePost(downloaded, 'backup.apb'));
      await statusCode(failed, 500, 'snapshot_failed');
      assert.ok(syncedFile);
      assert.equal(getNote(), currentState);
    });
  });
}
