import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKUP_ARCHIVE_OVERHEAD, decryptBackupArchive, withNewBackupArchive } from '../../lib/backupArchive';
import { isValidBackupPassphrase } from '../../lib/backupPassphrase';

const sql = "-- AssetPilot PostgreSQL backup\nBEGIN;\nINSERT INTO \"fixture\" (\"note\") VALUES ('測試資料');\nCOMMIT;\n";
const passphrase = '  unusual backup passphrase 測試  ';

test('APB1 uses independent salts and nonces to protect the complete UTF-8 SQL', async () => {
  const seal = () => withNewBackupArchive(passphrase, (archive) => archive.encrypt(sql));
  const first = await seal();
  const second = await seal();
  assert.equal(first.subarray(0, 4).toString(), 'APB1');
  assert.equal(first.length, Buffer.byteLength(sql) + BACKUP_ARCHIVE_OVERHEAD);
  assert.equal(first.includes(Buffer.from('測試資料')), false);
  assert.notDeepEqual(first.subarray(4, 20), second.subarray(4, 20));
  assert.notDeepEqual(first.subarray(20, 32), second.subarray(20, 32));
  assert.equal(await decryptBackupArchive(first, passphrase), sql);
  assert.equal(await decryptBackupArchive(second, passphrase), sql);

  await assert.rejects(decryptBackupArchive(first, passphrase.trim()), { code: 'decryption_failed' });
  for (const offset of [4, 20, 32, BACKUP_ARCHIVE_OVERHEAD]) {
    const changed = Buffer.from(first);
    changed[offset] ^= 1;
    await assert.rejects(decryptBackupArchive(changed, passphrase), { code: 'decryption_failed' });
  }
  await assert.rejects(decryptBackupArchive(first.subarray(0, -1), passphrase), { code: 'decryption_failed' });
  await assert.rejects(decryptBackupArchive(first.subarray(0, 6), passphrase), { code: 'invalid_file' });
  const newer = Buffer.from(first);
  newer[3] = '9'.charCodeAt(0);
  await assert.rejects(decryptBackupArchive(newer, passphrase), { code: 'unsupported_version' });
});

test('passphrases use a minimum of 16 characters and a maximum of 1024 UTF-8 bytes', () => {
  assert.equal(isValidBackupPassphrase(undefined), false);
  assert.equal(isValidBackupPassphrase(' '.repeat(16)), false);
  assert.equal(isValidBackupPassphrase('passphrase with\na newline'), false);
  assert.equal(isValidBackupPassphrase('passphrase with \uD800'), false);
  assert.equal(isValidBackupPassphrase('🔒'.repeat(15)), false);
  assert.equal(isValidBackupPassphrase('🔒'.repeat(16)), true);
  assert.equal(isValidBackupPassphrase('鎖'.repeat(342)), false);
  assert.equal(isValidBackupPassphrase('a'.repeat(1024)), true);
});
