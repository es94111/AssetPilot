import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

let initialized = false;

function generateSecret(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    values[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return values;
}

function upsertEnvLine(lines: string[], key: string, value: string): string[] {
  const next = [...lines];
  const idx = next.findIndex(line => line.startsWith(`${key}=`));
  if (idx >= 0) next[idx] = `${key}=${value}`;
  else next.push(`${key}=${value}`);
  return next;
}

export function ensureEnvSecrets(): void {
  if (initialized) return;
  initialized = true;

  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
    const values = parseEnvFile(envContent);
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (_) {
    // Missing env file is expected on first startup.
  }

  const updates: Record<string, string> = {};
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'please-change-this-secret') {
    updates.JWT_SECRET = generateSecret(64);
    process.env.JWT_SECRET = updates.JWT_SECRET;
  }

  // Webhook 簽章密鑰以 AES-256-GCM 加密後存入資料庫（見 lib/apiTokenCore.ts）。
  // 與 JWT_SECRET 相同，缺少時自動產生，讓自架部署無須額外設定即可使用 Webhook；
  // 一旦有訂閱後就不可更換（更換後既有密鑰將無法解密）。
  if (!process.env.API_TOKEN_ENCRYPTION_KEY) {
    updates.API_TOKEN_ENCRYPTION_KEY = generateSecret(64);
    process.env.API_TOKEN_ENCRYPTION_KEY = updates.API_TOKEN_ENCRYPTION_KEY;
  }

  if (Object.keys(updates).length === 0) return;

  const dir = path.dirname(envPath);
  fs.mkdirSync(dir, { recursive: true });
  let lines = envContent ? envContent.split('\n').filter(line => line.trim() !== '') : [];
  for (const [key, value] of Object.entries(updates)) {
    lines = upsertEnvLine(lines, key, value);
  }
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
  try { fs.chmodSync(envPath, 0o600); } catch (_) {}
}

export function writeEnvVars(updates: Record<string, string>): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  let envContent = '';
  try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch (_) {}
  const dir = path.dirname(envPath);
  fs.mkdirSync(dir, { recursive: true });
  let lines = envContent ? envContent.split('\n').filter(line => line.trim() !== '') : [];
  for (const [key, value] of Object.entries(updates)) {
    lines = upsertEnvLine(lines, key, value);
    process.env[key] = value;
  }
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
  try { fs.chmodSync(envPath, 0o600); } catch (_) {}
}
