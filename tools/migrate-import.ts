import * as fs from 'node:fs';
import * as path from 'node:path';

const USAGE = `用法：
  npm run migrate:import -- --input=<檔案.apm> [--key-file=<金鑰檔>]

需先設定新的 KEYRING_ROOT_KEK 與全新資料庫。搬遷金鑰以環境變數 ASSETPILOT_MIGRATION_KEY 或 --key-file 提供。
匯入會取代目標資料庫內容；失敗時自動還原匯入前狀態。`;

function loadEnvFile(): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function parseOptions(argv: string[]): { input: string; keyFile?: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const [flag, inline] = argv[index].split('=', 2);
    if (flag !== '--input' && flag !== '--key-file') throw new Error(`未知選項：${argv[index]}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`選項 ${flag} 缺少值`);
    if (values.has(flag)) throw new Error(`選項 ${flag} 不可重複`);
    values.set(flag, value);
  }
  const input = values.get('--input');
  if (!input) throw new Error('選項 --input 缺少值');
  return { input, keyFile: values.get('--key-file') };
}

async function main(): Promise<void> {
  loadEnvFile();
  const options = parseOptions(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }
  if (!process.env.KEYRING_ROOT_KEK) throw new Error('請先設定新的 KEYRING_ROOT_KEK');

  const { parseMigrationKey } = await import('../lib/migrationArchive.ts');
  const rawKey = options.keyFile
    ? fs.readFileSync(options.keyFile, 'utf8').trim()
    : process.env.ASSETPILOT_MIGRATION_KEY;
  const migrationKey = parseMigrationKey(rawKey);
  const archive = fs.readFileSync(path.resolve(options.input));

  const dbModule = await import('../lib/db.ts');
  await dbModule.initDB();
  try {
    const { importMigration } = await import('../lib/keyMigration.ts');
    const stats = importMigration(archive, migrationKey);
    console.log('搬遷匯入完成，已使用新 keyring 重新加密並驗證。');
    console.log(`照片金鑰=${stats.photoDeks}；Webhook secret=${stats.webhookSecrets}；SQL bytes=${stats.sqlBytes}`);
    console.log('舊環境的 PHOTO_MASTER_KEY、API_TOKEN_ENCRYPTION_KEY、JWT_SECRET 可銷毀；舊 JWT 已失效，使用者需重新登入。');
  } finally {
    await dbModule.getDB().close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/選項|請先設定|搬遷金鑰|解密失敗|匯入失敗|搬遷包/.test(message)) {
    console.error(`${message}\n\n${USAGE}`);
  } else {
    console.error('搬遷匯入失敗；未輸出任何金鑰資料。請檢查部署端錯誤紀錄。');
  }
  process.exitCode = 1;
});
