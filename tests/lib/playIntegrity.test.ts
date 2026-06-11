// lib/playIntegrity.ts evaluateVerdict 單元測試
// 純 Node.js（無外部框架），執行：node tests/lib/playIntegrity.test.ts
// 任一斷言失敗即 process.exit(1)。

const assert = require('node:assert/strict');

// evaluateVerdict 透過 getPackageName() 讀 PLAY_INTEGRITY_PACKAGE_NAME（呼叫時讀取），
// 範例 JSON 用 com.package.name，故先對齊套件名。
process.env.PLAY_INTEGRITY_PACKAGE_NAME = 'com.package.name';

const pi = require('../../lib/playIntegrityVerdict.ts') as typeof import('../../lib/playIntegrityVerdict');

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log('  ✓', name);
    pass++;
  } catch (e) {
    console.error('  ✗', name);
    console.error('    ', e instanceof Error ? e.message : String(e));
    fail++;
  }
}

// 使用者提供的範例 verdict（合格裝置）。
function sampleVerdict(): import('../../lib/playIntegrityVerdict').IntegrityVerdict {
  return {
    requestDetails: {
      requestPackageName: 'com.package.name',
      timestampMillis: '1617893780',
      nonce: 'aGVsbG8gd29scmQgdGhlcmU',
    },
    accountDetails: { appLicensingVerdict: 'LICENSED' },
    appIntegrity: {
      appRecognitionVerdict: 'PLAY_RECOGNIZED',
      packageName: 'com.package.name',
      certificateSha256Digest: ['6a6a1474b5cbbb2b1aa57e0bc3'],
      versionCode: '42',
    },
    deviceIntegrity: {
      deviceRecognitionVerdict: [
        'MEETS_BASIC_INTEGRITY',
        'MEETS_DEVICE_INTEGRITY',
        'MEETS_STRONG_INTEGRITY',
      ],
    },
    environmentDetails: { playProtectVerdict: 'NO_ISSUES' },
  };
}

console.log('evaluateVerdict:');

test('範例 verdict（無 expectedNonce）→ ok', () => {
  const r = pi.evaluateVerdict(sampleVerdict());
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
});

test('expectedNonce 相符 → ok', () => {
  const r = pi.evaluateVerdict(sampleVerdict(), { expectedNonce: 'aGVsbG8gd29scmQgdGhlcmU' });
  assert.equal(r.ok, true);
});

test('expectedNonce 不符 → nonce_mismatch', () => {
  const r = pi.evaluateVerdict(sampleVerdict(), { expectedNonce: 'somethingelse' });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('nonce_mismatch'));
});

test('套件名竄改 → package_name_mismatch', () => {
  const v = sampleVerdict();
  v.requestDetails!.requestPackageName = 'com.evil.clone';
  const r = pi.evaluateVerdict(v);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('package_name_mismatch'));
});

test('App 非 PLAY_RECOGNIZED → app_*', () => {
  const v = sampleVerdict();
  v.appIntegrity!.appRecognitionVerdict = 'UNRECOGNIZED_VERSION';
  const r = pi.evaluateVerdict(v);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('app_UNRECOGNIZED_VERSION'));
});

test('缺 MEETS_DEVICE_INTEGRITY → device_integrity_failed', () => {
  const v = sampleVerdict();
  v.deviceIntegrity!.deviceRecognitionVerdict = ['MEETS_BASIC_INTEGRITY'];
  const r = pi.evaluateVerdict(v);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('device_integrity_failed'));
});

test('null verdict → no_verdict', () => {
  const r = pi.evaluateVerdict(null);
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons, ['no_verdict']);
});

// ─── 結算 ───
console.log('');
console.log(`結果：${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
