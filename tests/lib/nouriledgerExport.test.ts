// tests/lib/nouriledgerExport.test.ts — 交給 NouriLedger 的單一使用者精確匯出包（需要真實 PostgreSQL；未設定則略過）。
// 重點：超過 2^53 的 NUMERIC 零誤差、每個檔案都有 checksum、只含本人資料、讀不到的附件不擋住整批。
// 執行方式：DATABASE_URL=postgresql://…/assetpilot_test node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/nouriledgerExport.test.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import JSZip from 'jszip';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let usable = false;
try { usable = Boolean(DB_URL) && ['127.0.0.1', 'localhost'].includes(new URL(DB_URL as string).hostname); } catch { /* 無效的連線字串 */ }

if (!usable) {
  test('nouriledgerExport（略過：需設定指向本機 PostgreSQL 的 DATABASE_URL/POSTGRES_URL）', () => {});
} else {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-nouri-export-'));
  process.env.TRANSACTION_PHOTO_LOCAL_DIR = path.join(scratch, 'photos');
  process.env.PHOTO_MASTER_KEY = Buffer.alloc(32, 5).toString('base64');
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { saveTransactionPhotoBuffer } = await import('../../lib/transactionAttachments.ts');
  const exporter = await import('../../lib/nouriledgerExport.ts');
  const sharp = (await import('sharp')).default;
  await initDB();
  const db = getDB();

  const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
  const alice = uid(), bob = uid();
  const aliceAccount = uid(), bobAccount = uid(), aliceTx = uid(), bigTx = uid(), bobTx = uid();
  const now = Date.now();
  const jpeg = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#ffaa00' } }).jpeg().toBuffer();
  const extraUsers: string[] = [];

  for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob']]) {
    db.run('INSERT INTO users(id,email,password_hash,display_name,created_at) VALUES(?,?,?,?,?)', [id, `${id}@nouri-export.invalid`, 'unused', name, new Date().toISOString()]);
  }
  db.run('INSERT INTO accounts(id,user_id,name,initial_balance,currency,created_at) VALUES(?,?,?,?,?,?)', [aliceAccount, alice, 'Exact wallet', '9007199254740993.1234567', 'TWD', String(now)]);
  db.run('INSERT INTO accounts(id,user_id,name,initial_balance,currency,created_at) VALUES(?,?,?,?,?,?)', [bobAccount, bob, 'Bob wallet', '1', 'TWD', String(now)]);
  const insertTx = (id: string, user: string, account: string, amount: string) => db.run(
    'INSERT INTO transactions(id,user_id,type,amount,original_amount,fx_rate,currency,date,account_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [id, user, 'expense', amount, amount, '1', 'TWD', '2026-10-04', account, now, now],
  );
  insertTx(aliceTx, alice, aliceAccount, '120');
  insertTx(bigTx, alice, aliceAccount, '12345678901234567.89');
  insertTx(bobTx, bob, bobAccount, '999');
  const photo = await saveTransactionPhotoBuffer(alice, aliceTx, 'local', { filename: 'receipt.jpg', mimeType: 'image/jpeg', body: jpeg });
  const photoId = (photo as { id?: string; attachmentId?: string }).id ?? (photo as { attachmentId?: string }).attachmentId ?? '';

  after(async () => {
    for (const id of [alice, bob, ...extraUsers]) {
      for (const table of exporter.ASSET_TABLES) db.run(`DELETE FROM ${table} WHERE user_id=?`, [id]);
      db.run('DELETE FROM transaction_attachments WHERE user_id=?', [id]);
      db.run("DELETE FROM data_operation_audit_log WHERE user_id=? AND action='export_to_nouriledger'", [id]);
      db.run('DELETE FROM users WHERE id=?', [id]);
    }
    db.close();
    await fs.rm(scratch, { recursive: true, force: true });
  });

  const open = async (buffer: Buffer) => JSZip.loadAsync(buffer);
  const json = async (zip: JSZip, name: string) => JSON.parse(await zip.file(name)!.async('string')) as Array<Record<string, unknown>>;

  test('NUMERIC and bigint values round-trip as exact text, unlike the Number-based app runtime', async () => {
    const { buffer } = await exporter.buildAssetPilotPackage(alice);
    const zip = await open(buffer);
    const accounts = await json(zip, 'data/accounts.json');
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].initial_balance, '9007199254740993.1234567', 'beyond 2^53 and 7 fractional digits, untouched');
    const amounts = (await json(zip, 'data/transactions.json')).map((row) => row.amount).sort();
    assert.deepEqual(amounts, ['120', '12345678901234567.89'].sort());
    const timestamp = (await json(zip, 'data/transactions.json'))[0].created_at;
    assert.equal(typeof timestamp, 'string', 'bigint timestamps are text too');

    // Why this exporter exists: the app's own database layer parses NUMERIC with Number(), which silently corrupts the value
    // (the legacy personal ZIP is built from exactly these rows).
    const viaAppRuntime = queryOne('SELECT initial_balance FROM accounts WHERE id=?', [aliceAccount])?.initial_balance;
    assert.equal(typeof viaAppRuntime, 'number');
    assert.notEqual(String(viaAppRuntime), '9007199254740993.1234567');
  });

  test('the manifest declares the exact format and every payload has a matching SHA-256', async () => {
    const { buffer, counts } = await exporter.buildAssetPilotPackage(alice);
    const zip = await open(buffer);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as Record<string, unknown> & { checksums: Record<string, string>; counts: Record<string, number> };
    assert.equal(manifest.format, 'assetpilot-user-bundle');
    assert.equal(manifest.version, 1);
    assert.equal(manifest.userId, alice);
    assert.equal(manifest.numericEncoding, 'postgres-numeric-text');
    assert.deepEqual(manifest.counts, counts);
    for (const table of [...exporter.ASSET_TABLES, 'transaction_attachments']) assert.equal(typeof manifest.checksums[`data/${table}.json`], 'string', table);
    for (const [name, expected] of Object.entries(manifest.checksums)) assert.equal(sha(await zip.file(name)!.async('nodebuffer')), expected, name);
    assert.ok(!('manifest.json' in manifest.checksums), 'the manifest does not checksum itself');
    assert.equal(counts.accounts, 1);
    assert.equal(counts.transactions, 2);
  });

  test('only the signed-in account is exported', async () => {
    const { buffer } = await exporter.buildAssetPilotPackage(alice);
    const zip = await open(buffer);
    for (const table of exporter.ASSET_TABLES) {
      const rows = await json(zip, `data/${table}.json`);
      assert.ok(rows.every((row) => row.user_id === alice), table);
    }
    const everything = (await Promise.all(Object.keys(zip.files).filter((name) => name.startsWith('data/') && name.endsWith('.json')).map((name) => zip.file(name)!.async('string')))).join('\n');
    for (const foreign of [bob, bobAccount, bobTx, 'Bob wallet']) assert.ok(!everything.includes(foreign), `leaked: ${foreign}`);
  });

  test('photos are shipped decrypted; unreadable or inconsistent ones degrade to warnings instead of failing the export', async () => {
    assert.ok(photoId, 'the fixture photo was stored');
    let result = await exporter.buildAssetPilotPackage(alice);
    let zip = await open(result.buffer);
    assert.deepEqual(await zip.file(`attachments/${photoId}`)!.async('nodebuffer'), jpeg, 'the stored (encrypted) file comes out as the original bytes');
    assert.deepEqual(result.warnings, []);
    const [metadata] = await json(zip, 'data/transaction_attachments.json');
    assert.equal(metadata.id, photoId);
    assert.equal(metadata.transaction_id, aliceTx);

    // The size note in the database disagrees with the file: the file wins, with a warning.
    db.run('UPDATE transaction_attachments SET byte_size=? WHERE id=?', [jpeg.length + 7, photoId]);
    result = await exporter.buildAssetPilotPackage(alice);
    zip = await open(result.buffer);
    assert.equal((await json(zip, 'data/transaction_attachments.json'))[0].byte_size, String(jpeg.length));
    assert.match(result.warnings[0], /大小紀錄與實際檔案不符/u);

    // The file is gone: the transaction still exports, the photo is skipped and reported.
    const stored = queryOne('SELECT local_path FROM transaction_attachments WHERE id=?', [photoId]);
    await fs.rm(path.join(process.env.TRANSACTION_PHOTO_LOCAL_DIR as string, String(stored?.local_path)), { force: true });
    result = await exporter.buildAssetPilotPackage(alice);
    zip = await open(result.buffer);
    assert.equal((await json(zip, 'data/transaction_attachments.json')).length, 0);
    assert.equal(zip.file(`attachments/${photoId}`), null);
    assert.equal(result.counts.transactions, 2, 'financial data is unaffected');
    assert.match(result.warnings[0], /^1 張交易照片在舊站已無法讀取/u);
  });

  test('an account id NouriLedger cannot represent is refused up front, and an oversized total is rejected', async () => {
    await assert.rejects(() => exporter.buildAssetPilotPackage('not-a-32-hex-id'), exporter.UnsupportedAccountError);
    await assert.rejects(() => exporter.buildAssetPilotPackage(`${alice.slice(0, 31)}Z`), exporter.UnsupportedAccountError);

    const crowded = uid();
    extraUsers.push(crowded);
    db.run('INSERT INTO users(id,email,password_hash,display_name,created_at) VALUES(?,?,?,?,?)', [crowded, `${crowded}@nouri-export.invalid`, 'unused', 'Crowded', new Date().toISOString()]);
    for (let index = 0; index < 14; index += 1) {
      db.run('INSERT INTO transaction_attachments(id,user_id,transaction_id,storage,filename,mime_type,byte_size,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [uid(), crowded, uid(), 'local', `f${index}.jpg`, 'image/jpeg', exporter.MAX_ATTACHMENT_BYTES - 1024, now]);
    }
    const big = Buffer.alloc(exporter.MAX_ATTACHMENT_BYTES - 1024, 1);
    await assert.rejects(() => exporter.buildAssetPilotPackage(crowded, async () => big), exporter.PackageTooLargeError);
    const oversized = Buffer.alloc(exporter.MAX_ATTACHMENT_BYTES + 1, 2);
    const skipped = await exporter.buildAssetPilotPackage(crowded, async () => oversized);
    assert.equal(skipped.counts.transaction_attachments, 0);
    assert.match(skipped.warnings[0], /^14 張交易照片超過 20 MB/u);
  });

  test('attachments are read a few at a time without crossing their bytes, and an oversized account is rejected before everything is loaded', async () => {
    const insertUser = (id: string, name: string) => {
      extraUsers.push(id);
      db.run('INSERT INTO users(id,email,password_hash,display_name,created_at) VALUES(?,?,?,?,?)', [id, `${id}@nouri-export.invalid`, 'unused', name, new Date().toISOString()]);
    };
    const insertAttachment = (id: string, user: string, filename: string, size: number) => db.run(
      'INSERT INTO transaction_attachments(id,user_id,transaction_id,storage,filename,mime_type,byte_size,created_at) VALUES(?,?,?,?,?,?,?,?)',
      [id, user, uid(), 'local', filename, 'image/jpeg', size, now],
    );

    const owner = uid();
    insertUser(owner, 'Parallel');
    const ids = Array.from({ length: 10 }, (_, index) => { const id = uid(); insertAttachment(id, owner, `p${index}.jpg`, 8); return id; });
    let active = 0;
    let peak = 0;
    const reader = async (row: Record<string, unknown>) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return Buffer.from(`b-${String(row.filename)}`.padEnd(8, '_'));
    };
    const { buffer } = await exporter.buildAssetPilotPackage(owner, reader);
    assert.ok(peak > 1, 'reads overlap');
    assert.ok(peak <= exporter.READ_CONCURRENCY, 'but only a bounded number at a time');
    const zip = await open(buffer);
    const metadata = await json(zip, 'data/transaction_attachments.json');
    assert.deepEqual(metadata.map((row) => row.id), [...ids].sort(), 'the metadata keeps the database order');
    for (const row of metadata) {
      assert.equal((await zip.file(`attachments/${String(row.id)}`)!.async('string')), `b-${String(row.filename)}`.padEnd(8, '_'), 'each file carries its own bytes');
    }

    const crowded = uid();
    insertUser(crowded, 'Many');
    for (let index = 0; index < 30; index += 1) insertAttachment(uid(), crowded, `m${index}.jpg`, exporter.MAX_ATTACHMENT_BYTES - 1024);
    let reads = 0;
    const big = Buffer.alloc(exporter.MAX_ATTACHMENT_BYTES - 1024, 7);
    await assert.rejects(() => exporter.buildAssetPilotPackage(crowded, async () => { reads += 1; return big; }), exporter.PackageTooLargeError);
    assert.ok(reads < 30, `stopped early instead of loading everything (read ${reads} of 30)`);
    assert.ok(reads <= 13 + exporter.READ_CONCURRENCY, 'at most the batch in which the limit was crossed');
  });

  test('the summary for the confirmation page counts only the account\'s own rows', () => {
    const summary = exporter.summarizeAssetUser(alice)!;
    assert.deepEqual(summary.account, { email: `${alice}@nouri-export.invalid`, name: 'Alice' });
    assert.equal(summary.sourceUserId, alice);
    assert.equal(summary.counts.accounts, 1);
    assert.equal(summary.counts.transactions, 2);
    assert.equal(exporter.summarizeAssetUser('does-not-exist'), null);
    assert.equal(exporter.summarizeAssetUser(bob)!.counts.transactions, 1);
  });
}
