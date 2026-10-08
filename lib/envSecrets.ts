import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { generateVapidKeys, isValidVapidKeyPair } from './webPushCore';

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

interface GeneratedSecrets {
  JWT_SECRET: string;
  API_TOKEN_ENCRYPTION_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

function generatedSecretsPath(envPath: string): string {
  return `${envPath}.generated-secrets`;
}

function readGeneratedSecrets(file: string): GeneratedSecrets | null {
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw error;
  }
  const values = parseEnvFile(content);
  const keys: GeneratedSecrets = {
    JWT_SECRET: values.JWT_SECRET || '',
    API_TOKEN_ENCRYPTION_KEY: values.API_TOKEN_ENCRYPTION_KEY || '',
    VAPID_PUBLIC_KEY: values.VAPID_PUBLIC_KEY || '',
    VAPID_PRIVATE_KEY: values.VAPID_PRIVATE_KEY || '',
  };
  if (!keys.JWT_SECRET || !keys.API_TOKEN_ENCRYPTION_KEY
    || !isValidVapidKeyPair(keys.VAPID_PUBLIC_KEY, keys.VAPID_PRIVATE_KEY)) {
    throw new Error(`Generated secrets file ${file} is incomplete or invalid; do not delete until the active ENV_PATH pair is backed up.`);
  }
  return keys;
}

/**
 * Atomically choose one generated secret set for all processes sharing ENV_PATH.
 * A fully written, mode-0600 temp file is hard-linked into place; link() fails atomically
 * if another replica already won. Unlike a stale lock file, a crash leaves a usable
 * canonical secret record rather than blocking startup.
 */
function getOrCreateGeneratedSecrets(envPath: string): GeneratedSecrets {
  const file = generatedSecretsPath(envPath);
  const existing = readGeneratedSecrets(file);
  if (existing) return existing;

  const vapid = generateVapidKeys();
  const candidate: GeneratedSecrets = {
    JWT_SECRET: generateSecret(64),
    API_TOKEN_ENCRYPTION_KEY: generateSecret(64),
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  };
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd: number | null = null;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, `${Object.entries(candidate).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    try {
      fs.linkSync(temporary, file);
      try { fs.chmodSync(file, 0o600); } catch {}
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
      const winner = readGeneratedSecrets(file);
      if (!winner) throw new Error(`Generated secrets winner file disappeared: ${file}`);
      return winner;
    }
  } finally {
    if (fd != null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(temporary); } catch {}
  }
}

function readEnvContent(envPath: string): string {
  try { return fs.readFileSync(envPath, 'utf-8'); } catch { return ''; }
}

function hydrateProcessEnv(envContent: string): void {
  const values = parseEnvFile(envContent);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function initializeEnvSecrets(envPath: string): void {
  const envContent = readEnvContent(envPath);
  hydrateProcessEnv(envContent);

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

  // 雲端發票載具憑證（驗證碼）的加密主金鑰（issue #253），同樣以 AES-256-GCM 加密
  // 後存入 invoice_carriers（見 lib/einvoiceSecret.ts）。與 Webhook 主金鑰分開，
  // 避免不同用途共用同一把金鑰；缺少時自動產生，一旦有載具綁定後即不可更換。
  if (!process.env.EINVOICE_ENCRYPTION_KEY) {
    updates.EINVOICE_ENCRYPTION_KEY = generateSecret(64);
    process.env.EINVOICE_ENCRYPTION_KEY = updates.EINVOICE_ENCRYPTION_KEY;
  }

  // Web Push VAPID 金鑰（issue #257）首啟產生並寫入同一個 ENV_PATH 持久化 Volume。
  // ENV_PATH lock 串行化 replica cold-start，後續啟動會先讀到勝出者寫入的同一組金鑰。
  const vapidPublic = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const vapidPrivate = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!isValidVapidKeyPair(vapidPublic, vapidPrivate)) {
    const vapid = generateVapidKeys();
    updates.VAPID_PUBLIC_KEY = vapid.publicKey;
    updates.VAPID_PRIVATE_KEY = vapid.privateKey;
    process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
    process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  }

  if (Object.keys(updates).length === 0) return;

  let lines = envContent ? envContent.split('\n').filter(line => line.trim() !== '') : [];
  for (const [key, value] of Object.entries(updates)) lines = upsertEnvLine(lines, key, value);
  try {
    fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
    try { fs.chmodSync(envPath, 0o600); } catch (_) {}
  } catch (error) {
    // JWT/API encryption keys already failed startup before this Web Push change;
    // do not silently weaken their persistence guarantees.
    const mustPersistExistingSecrets = Boolean(updates.JWT_SECRET || updates.API_TOKEN_ENCRYPTION_KEY);
    if (mustPersistExistingSecrets) throw error;

    // VAPID is optional: with read-only ENV_PATH the current process may use its in-memory pair,
    // while the shared public-key DB marker ensures mismatched replicas fail closed.
    console.error(
      '[web-push] Could not persist generated VAPID keys to ENV_PATH; pushes will work only until restart. Configure a writable persistent ENV_PATH or set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
      error,
    );
  }
}

export function ensureEnvSecrets(): void {
  if (initialized) return;
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  try {
    const envContent = readEnvContent(envPath);
    hydrateProcessEnv(envContent);

    const needsJwt = !process.env.JWT_SECRET || process.env.JWT_SECRET === 'please-change-this-secret';
    const needsApiKey = !process.env.API_TOKEN_ENCRYPTION_KEY;
    const needsVapid = !isValidVapidKeyPair(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const updates: Record<string, string> = {};

    if (needsJwt || needsApiKey || needsVapid) {
      let generated: GeneratedSecrets;
      try {
        generated = getOrCreateGeneratedSecrets(envPath);
      } catch (error) {
        if (needsJwt || needsApiKey) throw error;
        // VAPID is optional: read-only deployments can run with a process-local pair,
        // while the shared DB marker will fail closed if another replica has a different key.
        const vapid = generateVapidKeys();
        generated = {
          JWT_SECRET: process.env.JWT_SECRET || '',
          API_TOKEN_ENCRYPTION_KEY: process.env.API_TOKEN_ENCRYPTION_KEY || '',
          VAPID_PUBLIC_KEY: vapid.publicKey,
          VAPID_PRIVATE_KEY: vapid.privateKey,
        };
        console.error(
          '[web-push] Could not persist generated VAPID keys to ENV_PATH; pushes may be disabled on other replicas. Configure a writable persistent ENV_PATH or set the same VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on every replica.',
          error,
        );
      }

      if (needsJwt) {
        updates.JWT_SECRET = generated.JWT_SECRET;
        process.env.JWT_SECRET = generated.JWT_SECRET;
      }
      if (needsApiKey) {
        updates.API_TOKEN_ENCRYPTION_KEY = generated.API_TOKEN_ENCRYPTION_KEY;
        process.env.API_TOKEN_ENCRYPTION_KEY = generated.API_TOKEN_ENCRYPTION_KEY;
      }
      if (needsVapid) {
        updates.VAPID_PUBLIC_KEY = generated.VAPID_PUBLIC_KEY;
        updates.VAPID_PRIVATE_KEY = generated.VAPID_PRIVATE_KEY;
        process.env.VAPID_PUBLIC_KEY = generated.VAPID_PUBLIC_KEY;
        process.env.VAPID_PRIVATE_KEY = generated.VAPID_PRIVATE_KEY;
      }
    }

    if (Object.keys(updates).length === 0) {
      initialized = true;
      return;
    }

    let lines = envContent ? envContent.split('\n').filter(line => line.trim() !== '') : [];
    for (const [key, value] of Object.entries(updates)) lines = upsertEnvLine(lines, key, value);
    try {
      fs.mkdirSync(path.dirname(envPath), { recursive: true });
      fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
      try { fs.chmodSync(envPath, 0o600); } catch (_) {}
    } catch (error) {
      if (updates.JWT_SECRET || updates.API_TOKEN_ENCRYPTION_KEY) throw error;
      console.error(
        '[web-push] Could not persist generated VAPID keys to ENV_PATH; configure a writable persistent ENV_PATH or set matching VAPID environment variables on every replica.',
        error,
      );
    }
    initialized = true;
  } catch (error) {
    initialized = false;
    throw error;
  }
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
