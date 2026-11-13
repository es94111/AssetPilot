import assert from 'node:assert/strict';
import { collectSecrets, preservedRootKekWrap, transformBackupRow } from '../../lib/keyMigration.ts';

assert.equal(preservedRootKekWrap({ root_kek_wrapped: '', root_kek_updated_at: 0 }, 'env'), null);
assert.throws(() => preservedRootKekWrap({ root_kek_wrapped: '' }, 'openbao'), /OpenBao 模式需先透過 OpenBao 解析 Root KEK/u);
assert.deepEqual(
  preservedRootKekWrap({ root_kek_wrapped: 'vault:v1:wrapped', root_kek_updated_at: 123 }, 'openbao'),
  { provider: 'openbao', wrapped: 'vault:v1:wrapped', updatedAt: 123 },
);

assert.equal(transformBackupRow('keyring_keys', { kid: 'a' }), null);
assert.equal(transformBackupRow('keyring_control', { id: 1 }), null);
assert.equal(transformBackupRow('user_photo_keys', { user_id: 'u' }), null);
assert.deepEqual(
  transformBackupRow('webhook_subscriptions', { id: 'w', secret_encrypted: 'v1:abc', url: 'x' }),
  { id: 'w', secret_encrypted: '', url: 'x' },
);
for (const table of ['keyring_rotations', 'keyring_rotation_readiness', 'keyring_rotation_instances']) {
  assert.equal(transformBackupRow(table, { id: 'r' }), null);
}
const schedule = transformBackupRow('keyring_rotation_schedules', {
  purpose: 'jwt', enabled: 1, last_rotation_id: 'rot-1', retry_count: 3, retry_after: 9, last_error_code: 'E', last_error_at: 5,
});
assert.deepEqual(schedule, {
  purpose: 'jwt', enabled: 1, last_rotation_id: '', retry_count: 0, retry_after: 0, last_error_code: '', last_error_at: 0,
});
const other = { id: 1, name: 'n' };
assert.equal(transformBackupRow('accounts', other), other);

const dek = Buffer.alloc(32, 3);
const result = collectSecrets(
  [{ user_id: 'u1', created_at: 10 }],
  [{ id: 'w1', secret_encrypted: 'cipher' }],
  () => dek,
  (payload) => `plain-of-${payload}`,
);
assert.deepEqual(result.photoDeks, [{ user_id: 'u1', dek: dek.toString('base64'), created_at: 10 }]);
assert.deepEqual(result.webhookSecrets, [{ id: 'w1', secret: 'plain-of-cipher' }]);

assert.throws(
  () => collectSecrets([{ user_id: 'u1', created_at: 1 }], [], () => { throw new Error('bad'); }, () => ''),
  /照片金鑰/,
);
assert.throws(
  () => collectSecrets([], [{ id: 'w1', secret_encrypted: 'x' }], () => dek, () => { throw new Error('bad'); }),
  /Webhook/,
);

console.log('keyMigration tests passed');
