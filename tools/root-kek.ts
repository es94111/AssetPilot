import * as fs from 'node:fs';
import * as path from 'node:path';

const USAGE = `用法：
  npm run rootkek:openbao -- --status
  npm run rootkek:openbao -- --rewrap

--status 顯示目前 Root KEK 供應者設定、是否已在 OpenBao 建立包裝後的 root KEK，並測試連線；不會建立或變更任何金鑰。
--rewrap 將資料庫中已包裝的 root KEK 更新到 OpenBao 目前的金鑰版本；不影響任何用途金鑰、不會變更明文 root KEK。
只有 KEYRING_ROOT_KEK_PROVIDER=openbao 時才需要本工具；預設（env）供應者不受影響。`;

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

async function main(): Promise<void> {
  loadEnvFile();
  const action = process.argv.slice(2)[0];
  if (action !== '--status' && action !== '--rewrap') {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('請先設定 DATABASE_URL 或 POSTGRES_URL');
  }

  const dbModule = await import('../lib/db.ts');
  await dbModule.initDB();
  try {
    const provider = await import('../lib/rootKekProvider.ts');
    if (action === '--status') {
      const status = await provider.getRootKekProviderStatus();
      console.log(`Root KEK provider = ${status.provider}`);
      if (status.provider === 'openbao') {
        console.log(`OpenBao 設定齊全 = ${status.configured}`);
        console.log(`已建立包裝後的 root KEK = ${status.wrapped}`);
        console.log(`最後更新時間 = ${status.updatedAt ? new Date(status.updatedAt).toISOString() : '尚未建立'}`);
        await provider.testOpenBaoConnection();
        console.log('OpenBao 連線正常（/sys/health 回應成功）');
      } else {
        console.log('目前使用 env 供應者；KEYRING_ROOT_KEK 直接由部署環境變數提供。');
      }
      return;
    }
    const result = await provider.rewrapStoredRootKek();
    console.log(result.message);
  } finally {
    await dbModule.getDB().close();
  }
}

main().catch((error: unknown) => {
  // Only print messages from our own, hand-crafted error type (never interpolates secret
  // material). Any other error — e.g. an unanticipated driver/network exception — falls back to
  // a generic, non-interpolated message so an unexpected future error path can't surface
  // response bodies, tokens, or other sensitive detail; mirrors tools/rotate-key.ts.
  if (error instanceof Error && error.name === 'RootKekProviderError') {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error('操作失敗；未輸出任何金鑰資料。請檢查部署端錯誤紀錄。');
  }
  process.exitCode = 1;
});
