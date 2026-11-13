import assert from 'node:assert/strict';
import {
  MIGRATION_ARCHIVE_MAGIC,
  buildMigrationPayload,
  generateMigrationKey,
  packMigrationArchive,
  parseMigrationKey,
  unpackMigrationArchive,
} from '../../lib/migrationArchive.ts';

const key = parseMigrationKey(generateMigrationKey());
const sql = '-- AssetPilot PostgreSQL backup\nINSERT INTO t VALUES (\'sentinel-sql-text\');';
const secrets = {
  photoDeks: [{ user_id: 'u1', dek: Buffer.alloc(32, 7).toString('base64'), created_at: 1 }],
  webhookSecrets: [{ id: 'w1', secret: 'whsec_plaintext_sentinel' }],
};

const payload = buildMigrationPayload(sql, secrets);
const archive = packMigrationArchive(payload, key);

const roundTrip = unpackMigrationArchive(archive, key);
assert.equal(roundTrip.sql, sql);
assert.deepEqual(roundTrip.secrets, secrets);
assert.equal(roundTrip.manifest.counts.photoDeks, 1);

assert.ok(!archive.includes('whsec_plaintext_sentinel'));
assert.ok(!archive.includes('sentinel-sql-text'));
assert.ok(!archive.includes(secrets.photoDeks[0].dek));

assert.throws(() => unpackMigrationArchive(archive, parseMigrationKey(generateMigrationKey())), /解密失敗/);

const tampered = Buffer.from(archive);
tampered[tampered.length - 1] ^= 0xff;
assert.throws(() => unpackMigrationArchive(tampered, key), /解密失敗/);

const badMagic = Buffer.from(archive);
badMagic[0] = 0x00;
assert.throws(() => unpackMigrationArchive(badMagic, key), /有效的/);
assert.throws(() => unpackMigrationArchive(MIGRATION_ARCHIVE_MAGIC, key), /有效的/);

const badChecksum = packMigrationArchive(
  { ...payload, manifest: { ...payload.manifest, checksum: 'x'.repeat(64) } },
  key,
);
assert.throws(() => unpackMigrationArchive(badChecksum, key), /checksum/);

const badCount = packMigrationArchive(
  { ...payload, manifest: { ...payload.manifest, counts: { photoDeks: 5, webhookSecrets: 1 } } },
  key,
);
assert.throws(() => unpackMigrationArchive(badCount, key), /筆數/);

const badVersion = packMigrationArchive(
  { ...payload, manifest: { ...payload.manifest, formatVersion: 99 } },
  key,
);
assert.throws(() => unpackMigrationArchive(badVersion, key), /版本/);

assert.throws(() => parseMigrationKey(undefined), /缺少/);
assert.throws(() => parseMigrationKey('c2hvcnQ='), /32 bytes/);

console.log('migrationArchive tests passed');
