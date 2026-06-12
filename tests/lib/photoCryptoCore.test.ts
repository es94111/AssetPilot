// lib/photoCryptoCore.ts 單元測試（純密碼學原語，無 DB 相依）
// 純 Node.js（無外部框架），執行：node tests/lib/photoCryptoCore.test.ts
// 任一斷言失敗即 process.exit(1)。

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const pc = require('../../lib/photoCryptoCore.ts') as typeof import('../../lib/photoCryptoCore');

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void): void {
  try { fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.error('  ✗', name); console.error('    ', e instanceof Error ? e.message : String(e)); fail++; }
}

const master = pc.generateDek();
const dekA = pc.generateDek();
const dekB = pc.generateDek();
const plain = Buffer.from('假裝是 JPEG 的照片內容 \x00\xff\x01 binary'.repeat(20), 'utf8');

console.log('DEK 封裝（wrap/unwrap）：');
test('wrap → unwrap 還原相同 DEK', () => {
  const { wrapped, iv, tag } = pc.wrapDek(master, dekA);
  const back = pc.unwrapDek(master, wrapped, iv, tag);
  assert.equal(back.equals(dekA), true);
});

test('用錯誤的主金鑰 unwrap 應拋錯', () => {
  const { wrapped, iv, tag } = pc.wrapDek(master, dekA);
  const wrongMaster = pc.generateDek();
  assert.throws(() => pc.unwrapDek(wrongMaster, wrapped, iv, tag));
});

console.log('照片加解密（encryptWithDek/decryptWithDek）：');
test('密文帶 MAGIC 標頭、長度大於明文', () => {
  const enc = pc.encryptWithDek(dekA, plain);
  assert.equal(pc.isEncryptedBlob(enc), true);
  assert.equal(enc.subarray(0, 4).toString('ascii'), 'APX1');
  assert.ok(enc.length > plain.length);
});

test('encrypt → decrypt 來回還原相同明文', () => {
  const enc = pc.encryptWithDek(dekA, plain);
  assert.equal(pc.decryptWithDek(dekA, enc).equals(plain), true);
});

test('同明文不同 IV → 每次密文不同', () => {
  const e1 = pc.encryptWithDek(dekA, plain);
  const e2 = pc.encryptWithDek(dekA, plain);
  assert.notEqual(e1.equals(e2), true);
});

test('用別人的 DEK 解密應失敗（金鑰隔離）', () => {
  const enc = pc.encryptWithDek(dekA, plain);
  assert.throws(() => pc.decryptWithDek(dekB, enc));
});

test('竄改密文 → 解密拋錯（GCM 完整性保護）', () => {
  const enc = pc.encryptWithDek(dekA, plain);
  enc[enc.length - 1] ^= 0xff;
  assert.throws(() => pc.decryptWithDek(dekA, enc));
});

test('空檔案也能來回加解密', () => {
  const empty = Buffer.alloc(0);
  const enc = pc.encryptWithDek(dekA, empty);
  assert.equal(pc.decryptWithDek(dekA, enc).equals(empty), true);
});

console.log('isEncryptedBlob / 明文辨識：');
test('明文（無 MAGIC）不被誤判為密文', () => {
  assert.equal(pc.isEncryptedBlob(plain), false);
  assert.equal(pc.isEncryptedBlob(Buffer.from([0xff, 0xd8, 0xff])), false); // JPEG 開頭
  assert.equal(pc.isEncryptedBlob(Buffer.alloc(0)), false);
});

console.log('主金鑰載入（loadMasterKey）：');
test('未設定 → 停用、isEnabled = false', () => {
  delete process.env.PHOTO_MASTER_KEY;
  pc._resetMasterKeyCache();
  assert.equal(pc.loadMasterKey(), null);
  assert.equal(pc.isPhotoEncryptionEnabled(), false);
});

test('合法 32-byte base64 → 啟用', () => {
  process.env.PHOTO_MASTER_KEY = crypto.randomBytes(32).toString('base64');
  pc._resetMasterKeyCache();
  assert.equal(pc.isPhotoEncryptionEnabled(), true);
  assert.equal(pc.loadMasterKey()!.length, 32);
});

test('長度錯誤 → 拋出明確錯誤', () => {
  process.env.PHOTO_MASTER_KEY = crypto.randomBytes(16).toString('base64'); // 只有 16 bytes
  pc._resetMasterKeyCache();
  assert.throws(() => pc.loadMasterKey(), /32 bytes/);
});

delete process.env.PHOTO_MASTER_KEY;
pc._resetMasterKeyCache();

console.log(`\n結果：${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
