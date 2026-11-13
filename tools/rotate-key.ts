import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KeyringPurpose } from '../lib/keyringCore.ts';

const PURPOSES: KeyringPurpose[] = ['jwt', 'api-token', 'photo'];
type Action = 'preview' | 'prepare' | 'apply' | 'activate' | 'resume' | 'rollback';

interface Options {
  action: Action;
  purpose?: KeyringPurpose;
  rotationId?: string;
  confirmBackup: boolean;
  confirmAllInstancesReady: boolean;
}

const USAGE = `用法：
  npm run rotate:key -- --purpose=<jwt|api-token|photo> [--dry-run]
  npm run rotate:key -- --prepare --purpose=<用途> --confirm-backup
  npm run rotate:key -- --apply --purpose=<用途> --confirm-backup --confirm-all-instances-ready
  npm run rotate:key -- --activate --rotation=<id> --confirm-backup --confirm-all-instances-ready
  npm run rotate:key -- --resume --rotation=<id> --confirm-backup
  npm run rotate:key -- --rollback --rotation=<id> --confirm-backup

預設只做 dry-run。--apply 是 prepare、activate、批次重加密的便利寫法。
舊金鑰不會由此工具退役或銷毀。`;

function loadEnvFile(): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  let content: string;
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator);
    if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1);
  }
}

function parseOptions(argv: string[]): Options {
  const actions: Action[] = [];
  const values = new Map<string, string>();
  let confirmBackup = false;
  let confirmAllInstancesReady = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--confirm-backup') {
      confirmBackup = true;
      continue;
    }
    if (argument === '--confirm-all-instances-ready') {
      confirmAllInstancesReady = true;
      continue;
    }
    const [flag, inlineValue] = argument.split('=', 2);
    const action = flag === '--dry-run' ? 'preview'
      : flag === '--prepare' ? 'prepare'
        : flag === '--apply' ? 'apply'
          : flag === '--activate' ? 'activate'
            : flag === '--resume' ? 'resume'
              : flag === '--rollback' ? 'rollback'
                : null;
    if (action) {
      if (inlineValue !== undefined) throw new Error(`選項 ${flag} 不接受值`);
      actions.push(action);
      continue;
    }
    if (flag === '--purpose' || flag === '--rotation') {
      const value = inlineValue ?? argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`選項 ${flag} 缺少值`);
      if (values.has(flag)) throw new Error(`選項 ${flag} 不可重複`);
      values.set(flag, value);
      continue;
    }
    throw new Error(`未知選項：${argument}`);
  }

  if (actions.length > 1) throw new Error('一次只能指定一種操作');
  const action = actions[0] || 'preview';
  const rawPurpose = values.get('--purpose');
  const purpose = rawPurpose as KeyringPurpose | undefined;
  if (purpose && !PURPOSES.includes(purpose)) throw new Error(`不支援的用途：${purpose}`);
  const rotationId = values.get('--rotation');
  if (['activate', 'resume', 'rollback'].includes(action) && !rotationId) {
    throw new Error(`${action} 操作需要 --rotation=<id>`);
  }
  if (['preview', 'prepare', 'apply'].includes(action) && !purpose) {
    throw new Error(`${action} 操作需要 --purpose=<用途>`);
  }
  if (['activate', 'resume', 'rollback'].includes(action) && purpose) {
    throw new Error(`${action} 操作請使用 --rotation，不要指定 --purpose`);
  }
  if (['apply', 'activate'].includes(action) && !confirmAllInstancesReady) {
    throw new Error(`${action} 操作需要明確確認所有執行副本都支援 keyring：--confirm-all-instances-ready`);
  }
  if (['prepare', 'apply', 'activate', 'resume', 'rollback'].includes(action) && !confirmBackup) {
    throw new Error(`${action} 操作前須確認 DB 與對應 Root KEK 備份可復原：--confirm-backup`);
  }
  if (action === 'preview' && (confirmBackup || confirmAllInstancesReady || rotationId)) {
    throw new Error('dry-run 不接受備份、副本確認或 rotation id');
  }
  if (action === 'prepare' && (confirmAllInstancesReady || rotationId)) {
    throw new Error('prepare 不接受副本確認或 rotation id');
  }
  if (action === 'rollback' && confirmAllInstancesReady) {
    throw new Error('rollback 不接受副本確認旗標');
  }

  return { action, purpose, rotationId, confirmBackup, confirmAllInstancesReady };
}

function printProgress(progress: { status: string; scanned: number; reencrypted: number }): void {
  console.log(`狀態=${progress.status}；已掃描=${progress.scanned}；已重加密=${progress.reencrypted}`);
}

async function main(): Promise<void> {
  loadEnvFile();
  const options = parseOptions(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }

  const dbModule = await import('../lib/db.ts');
  await dbModule.initDB();
  try {
    await (await import('../lib/rootKekProvider.ts')).resolveRootKek();
    const rotation = await import('../lib/keyringRotation.ts');
    if (options.action === 'preview') {
      const preview = rotation.previewKeyRotation(options.purpose!);
      console.log(`用途=${preview.purpose}；active kid=${preview.activeKid}`);
      console.log(preview.message);
      console.log('[dry-run] 未變更資料。');
      return;
    }
    if (options.action === 'prepare') {
      const id = rotation.prepareKeyRotation(options.purpose!);
      console.log(`已建立 pending 輪換；rotation id=${id}。尚未切換 active key。`);
      return;
    }
    if (options.action === 'apply') {
      const id = rotation.prepareKeyRotation(options.purpose!);
      console.log(`已建立 pending 輪換；rotation id=${id}。`);
      rotation.activatePreparedRotation(id, options.confirmAllInstancesReady);
      console.log('已切換 active key，開始批次重加密。');
      printProgress(await rotation.runKeyRotation(id, printProgress));
      return;
    }
    if (options.action === 'activate') {
      rotation.activatePreparedRotation(options.rotationId!, options.confirmAllInstancesReady);
      console.log(`已啟用輪換 ${options.rotationId}，開始批次重加密。`);
      printProgress(await rotation.runKeyRotation(options.rotationId!, printProgress));
      return;
    }
    if (options.action === 'resume') {
      printProgress(await rotation.runKeyRotation(options.rotationId!, printProgress));
      return;
    }
    rotation.rollbackKeyRotation(options.rotationId!);
    console.log(`已回滾輪換 ${options.rotationId} 的 active key 指標；已重加密資料仍以 previous key 保留可讀。`);
  } finally {
    await dbModule.getDB().close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === 'RootKekProviderError') {
    console.error(`${error.name}: ${error.message}`);
  } else if (error instanceof Error && error.name === 'KeyRotationError') {
    const coded = error as Error & { code?: string };
    console.error(`${coded.code || 'KEY_ROTATION_ERROR'}: ${error.message}`);
  } else if (error instanceof Error && /用法|選項|操作需要|操作前須|操作不接受|一次只能指定|不支援/.test(error.message)) {
    console.error(`${error.message}\n\n${USAGE}`);
  } else {
    console.error('金鑰輪換操作失敗；未輸出任何金鑰資料。請檢查部署端錯誤紀錄。');
  }
  process.exitCode = 1;
});
