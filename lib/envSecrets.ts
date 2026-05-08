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
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (_) {
    // Missing env file is expected on first startup.
  }

  const updates: Record<string, string> = {};
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'please-change-this-secret') {
    updates.JWT_SECRET = generateSecret(64);
    process.env.JWT_SECRET = updates.JWT_SECRET;
  }
  if (!process.env.DB_ENCRYPTION_KEY) {
    updates.DB_ENCRYPTION_KEY = generateSecret(64);
    process.env.DB_ENCRYPTION_KEY = updates.DB_ENCRYPTION_KEY;
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
