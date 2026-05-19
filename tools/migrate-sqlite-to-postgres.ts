import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { migrateSqliteToPostgresIfNeeded } from '../lib/postgresMigration.ts';

const ENC_MAGIC = Buffer.from('EADB');

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

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

function decryptBuffer(encBuffer: Buffer, passphrase: string): Buffer {
  if (encBuffer.length < 48) throw new Error('加密檔案格式錯誤：檔案太小');
  const magic = encBuffer.subarray(0, 4);
  if (!magic.equals(ENC_MAGIC)) throw new Error('非加密資料庫檔案');
  const salt = encBuffer.subarray(4, 20);
  const nonce = encBuffer.subarray(20, 32);
  const authTag = encBuffer.subarray(32, 48);
  const encrypted = encBuffer.subarray(48);
  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function isEncryptedDB(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ENC_MAGIC);
}

async function main(): Promise<void> {
  loadEnvFile();
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'database.db');
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }
  if (!fs.existsSync(dbPath)) {
    throw new Error(`找不到 SQLite .db 檔案：${dbPath}`);
  }

  const result = await migrateSqliteToPostgresIfNeeded({
    dbPath,
    encryptionKey: process.env.DB_ENCRYPTION_KEY,
    decryptBuffer,
    isEncryptedDB,
  });

  if (!result) {
    console.log('未執行：未設定 PostgreSQL 連線或找不到 SQLite .db');
    return;
  }
  if (result.skipped) {
    console.log(`已略過：PostgreSQL 已匯入相同來源 hash (${result.sourceHash})`);
    return;
  }

  const importedRows = result.tables.reduce((sum, table) => sum + table.rows, 0);
  console.log(`完成：匯入 ${result.tables.length} 張表、${importedRows} 筆資料`);
  for (const table of result.tables) {
    console.log(`- ${table.name}: ${table.skipped ? 'skipped' : `${table.rows} rows`}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
