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
  if (key.length !== KEY_LEN) {
    throw new Error(`${label} 解碼後必須為 ${KEY_LEN} bytes（請用：openssl rand -base64 32）`);
  }
  return key;
}

interface KeyRow {
  user_id: string;
  wrapped_dek: string;
  iv: string;
  tag: string;
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
    const { rows } = await pool.query<KeyRow>('SELECT user_id, wrapped_dek, iv, tag FROM user_photo_keys');
    console.log(`掃描 user_photo_keys：${rows.length} 列`);

    // ── 第一階段：逐列驗證並計畫，任一列無法以舊/新金鑰解開即中止 ──
    const plans: Plan[] = [];
    let alreadyRotated = 0;
    const failures: string[] = [];

    for (const row of rows) {
      let dek: Buffer | null = null;
      try {
        dek = unwrapDek(oldMaster, row.wrapped_dek, row.iv, row.tag);
      } catch {
        // 舊金鑰解不開：可能已用新金鑰包覆（先前輪替到一半）→ 視為已完成、略過
        try {
          unwrapDek(newMaster, row.wrapped_dek, row.iv, row.tag);
          alreadyRotated++;
          continue;
        } catch {
          failures.push(row.user_id);
          continue;
        }
      }
      plans.push({ row, rewrapped: wrapDek(newMaster, dek) });
    }

    if (failures.length > 0) {
      console.error(`✗ 有 ${failures.length} 列無法用舊或新金鑰解開，已中止（未寫入任何資料）：`);
      for (const id of failures.slice(0, 20)) console.error(`   - user_id=${id}`);
      if (failures.length > 20) console.error(`   ...（共 ${failures.length} 列）`);
      process.exitCode = 1;
      return;
    }

    console.log(`待輪替：${plans.length} 列；已是新金鑰、略過：${alreadyRotated} 列`);

    if (plans.length === 0) {
      console.log('沒有需要輪替的列，結束。');
      return;
    }

    if (!apply) {
      console.log('\n[dry-run] 以上為預覽，未寫入任何資料。加上 --apply 才會實際更新。');
      return;
    }

    // ── 第二階段：交易內逐列更新 ──
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { row, rewrapped } of plans) {
        await client.query(
          'UPDATE user_photo_keys SET wrapped_dek = $1, iv = $2, tag = $3 WHERE user_id = $4',
          [rewrapped.wrapped, rewrapped.iv, rewrapped.tag, row.user_id]
        );
      }
      await client.query('COMMIT');
      console.log(`✓ 已完成輪替：${plans.length} 列已用新主金鑰重新包覆。`);
      console.log('  請驗證照片可正常開啟後，再將 PHOTO_MASTER_KEY_OLD 自環境移除。');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
