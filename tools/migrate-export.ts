import * as fs from 'node:fs';
import * as path from 'node:path';

const USAGE = `用法：
  npm run migrate:export -- --output=<檔案.apm> [--key-file=<金鑰檔>] [--generate-key]

金鑰以環境變數 ASSETPILOT_MIGRATION_KEY（base64，32 bytes）或 --key-file 提供，不接受命令列明文。
--generate-key 會產生一次性搬遷金鑰並寫入 <output>.key（權限 600）。`;

function loadEnvFile(): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function parseOptions(argv: string[]): { output: string; keyFile?: string; generateKey: boolean } {
  const values = new Map<string, string>();
  let generateKey = false;
  for (let index = 0; index < argv.length; index++) {
    const [flag, inline] = argv[index].split('=', 2);
    if (flag === '--generate-key') {
      if (inline !== undefined) throw new Error('選項 --generate-key 不接受值');
      generateKey = true;
    } else if (flag === '--output' || flag === '--key-file') {
      const value = inline ?? argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`選項 ${flag} 缺少值`);
      if (values.has(flag)) throw new Error(`選項 ${flag} 不可重複`);
      values.set(flag, value);
    } else {
      throw new Error(`未知選項：${argv[index]}`);
    }
  }
  const output = values.get('--output');
  if (!output) throw new Error('選項 --output 缺少值');
  const keyFile = values.get('--key-file');
  if (generateKey && keyFile) throw new Error('不支援同時指定 --generate-key 與 --key-file');
  return { output, keyFile, generateKey };
}

async function main(): Promise<void> {
  loadEnvFile();
  const options = parseOptions(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }
  const output = path.resolve(options.output);
  if (fs.existsSync(output)) throw new Error(`不支援覆寫既有檔案：${output}`);

  const archiveModule = await import('../lib/migrationArchive.ts');
  let rawKey: string | undefined;
  let generatedKeyPath: string | undefined;
  if (options.generateKey) {
    rawKey = archiveModule.generateMigrationKey();
    generatedKeyPath = `${output}.key`;
    if (fs.existsSync(generatedKeyPath)) throw new Error(`不支援覆寫既有檔案：${generatedKeyPath}`);
  } else if (options.keyFile) {
    rawKey = fs.readFileSync(options.keyFile, 'utf8').trim();
  } else {
    rawKey = process.env.ASSETPILOT_MIGRATION_KEY;
  }
  const migrationKey = archiveModule.parseMigrationKey(rawKey);

  const dbModule = await import('../lib/db.ts');
  await dbModule.initDB();
  try {
    const { exportMigration } = await import('../lib/keyMigration.ts');
    const { archive, stats } = exportMigration(migrationKey);
    const tmp = `${output}.tmp`;
    fs.writeFileSync(tmp, archive, { mode: 0o600 });
    fs.renameSync(tmp, output);
    if (generatedKeyPath) fs.writeFileSync(generatedKeyPath, `${rawKey}\n`, { mode: 0o600 });
    console.log(`已建立搬遷包：${output}`);
    console.log(`照片金鑰=${stats.photoDeks}；Webhook secret=${stats.webhookSecrets}；SQL bytes=${stats.sqlBytes}`);
    if (generatedKeyPath) console.log(`搬遷金鑰已寫入：${generatedKeyPath}（請與搬遷包分開保管）`);
  } finally {
    await dbModule.getDB().close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/選項|不支援|PostgreSQL|DATABASE_URL|搬遷金鑰|ASSETPILOT_MIGRATION_KEY|無法解密/.test(message)) {
    console.error(`${message}\n\n${USAGE}`);
  } else {
    console.error('搬遷匯出失敗；未輸出任何金鑰資料。請檢查部署端錯誤紀錄。');
  }
  process.exitCode = 1;
});
