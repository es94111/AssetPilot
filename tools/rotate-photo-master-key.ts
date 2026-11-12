// tools/rotate-photo-master-key.ts — 交易照片主金鑰（PHOTO_MASTER_KEY）輪替工具
//
// envelope 設計下，主金鑰只「包覆」每使用者 DEK，並未直接加密照片，因此輪替只需把
// user_photo_keys 每一列的 wrapped DEK 用舊金鑰解開、再用新金鑰重新包覆即可；
// 照片密文本身完全不動。
//
// 用法（在已設定 DATABASE_URL 的環境，例如容器內）：
//   PHOTO_MASTER_KEY=<新金鑰> PHOTO_MASTER_KEY_OLD=<舊金鑰> node tools/rotate-photo-master-key.ts            # dry-run 預覽
//   PHOTO_MASTER_KEY=<新金鑰> PHOTO_MASTER_KEY_OLD=<舊金鑰> node tools/rotate-photo-master-key.ts --apply    # 實際寫入
// 確認無誤後再把 PHOTO_MASTER_KEY_OLD 自環境移除。
//
// 安全性：
//  - 先「逐列驗證」用舊金鑰能成功 unwrap（GCM 認證）才會進行寫入；任一列失敗即整體中止、不寫。
//  - 已用新金鑰包覆的列（先前輪替到一半）會被辨識並略過，可安全重跑。
//  - 寫入全程包在單一交易（BEGIN/COMMIT），任何錯誤 ROLLBACK。

import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';
import { KEYRING_ROTATION_LOCK_NAME } from '../lib/keyringCore.ts';
import { KEY_LEN, wrapDek, unwrapDek } from '../lib/photoCryptoCore.ts';

const { Pool } = pg;

function loadEnvFile(): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch (_) {
    return;
  }
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseKey(label: string, raw: string | undefined): Buffer {
  const value = String(raw || '').trim();
  if (!value) throw new Error(`未設定 ${label}`);
  let key: Buffer;
  try {
    key = Buffer.from(value, 'base64');
  } catch {
    throw new Error(`${label} 不是有效的 base64`);
  }
  if (key.length !== KEY_LEN || key.toString('base64') !== value) {
    throw new Error(`${label} 解碼後必須為 ${KEY_LEN} bytes（請用：openssl rand -base64 32）`);
  }
  return key;
}

interface KeyRow {
  user_id: string;
  wrapped_dek: string;
  iv: string;
  tag: string;
  key_id: string | null;
}

type Plan = { row: KeyRow; rewrapped: { wrapped: string; iv: string; tag: string } };

async function main(): Promise<void> {
  loadEnvFile();
  const apply = process.argv.includes('--apply');

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }
  const oldMaster = parseKey('PHOTO_MASTER_KEY_OLD', process.env.PHOTO_MASTER_KEY_OLD);
  const newMaster = parseKey('PHOTO_MASTER_KEY', process.env.PHOTO_MASTER_KEY);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [KEYRING_ROTATION_LOCK_NAME]);

      const keyringControl = await client.query<{ enabled: boolean }>(
        'SELECT enabled FROM keyring_control WHERE id = 1 FOR SHARE',
      );
      if (keyringControl.rows.length !== 1) throw new Error('找不到 keyring_control 設定；拒絕執行舊式照片金鑰輪替');
      if (keyringControl.rows[0].enabled) {
        throw new Error('Keyring 已啟用；請使用 keyring photo rotation，不可混用舊式照片金鑰輪替工具');
      }

      const { rows } = await client.query<KeyRow>(
        'SELECT user_id, wrapped_dek, iv, tag, key_id FROM user_photo_keys ORDER BY user_id FOR UPDATE',
      );
      if (rows.some((row) => row.key_id)) {
        throw new Error('發現 keyring 管理的照片 DEK；拒絕執行舊式照片金鑰輪替');
      }
      console.log(`掃描 user_photo_keys：${rows.length} 列`);

      const plans: Plan[] = [];
      let alreadyRotated = 0;
      const failures: string[] = [];

      for (const row of rows) {
        let dek: Buffer | null = null;
        try {
          try {
            dek = unwrapDek(oldMaster, row.wrapped_dek, row.iv, row.tag);
            plans.push({ row, rewrapped: wrapDek(newMaster, dek) });
          } catch {
            try {
              dek = unwrapDek(newMaster, row.wrapped_dek, row.iv, row.tag);
              alreadyRotated++;
            } catch {
              failures.push(row.user_id);
            }
          }
        } finally {
          dek?.fill(0);
        }
      }

      if (failures.length > 0) {
        console.error(`✗ 有 ${failures.length} 列無法用舊或新金鑰解開，已中止（未寫入任何資料）：`);
        for (const id of failures.slice(0, 20)) console.error(`   - user_id=${id}`);
        if (failures.length > 20) console.error(`   ...（共 ${failures.length} 列）`);
        process.exitCode = 1;
        await client.query('ROLLBACK');
        return;
      }

      console.log(`待輪替：${plans.length} 列；已是新金鑰、略過：${alreadyRotated} 列`);
      if (plans.length === 0) {
        console.log('沒有需要輪替的列，結束。');
        await client.query('COMMIT');
        return;
      }
      if (!apply) {
        console.log('\n[dry-run] 以上為預覽，未寫入任何資料。加上 --apply 才會實際更新。');
        await client.query('COMMIT');
        return;
      }

      for (const { row, rewrapped } of plans) {
        const result = await client.query(
          `UPDATE user_photo_keys SET wrapped_dek = $1, iv = $2, tag = $3
           WHERE user_id = $4 AND key_id IS NOT DISTINCT FROM $5 AND wrapped_dek = $6 AND iv = $7 AND tag = $8`,
          [rewrapped.wrapped, rewrapped.iv, rewrapped.tag, row.user_id, row.key_id, row.wrapped_dek, row.iv, row.tag],
        );
        if (result.rowCount !== 1) throw new Error(`照片 DEK ${row.user_id} 在輪替期間已變更；已中止`);
      }
      await client.query('COMMIT');
      console.log(`✓ 已完成輪替：${plans.length} 列已用新主金鑰重新包覆。`);
      console.log('  請驗證照片可正常開啟後，再將 PHOTO_MASTER_KEY_OLD 自環境移除。');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    oldMaster.fill(0);
    newMaster.fill(0);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
