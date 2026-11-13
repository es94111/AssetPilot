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

const ENV_PATH_LOCK_STALE_MS = 60_000;
const ENV_PATH_LOCK_WAIT_MS = 30_000;

function withEnvPathLock<T>(envPath: string, action: () => T): T {
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  const lockPath = `${envPath}.lock`;
  const deadline = Date.now() + ENV_PATH_LOCK_WAIT_MS;
  const waitCell = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

  while (true) {
    try {
      fs.mkdirSync(lockPath, { mode: 0o700 });
      try {
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- lockPath 衍生自部署者設定的 ENV_PATH，非任何請求輸入；第二引數固定為常數 'owner'
        fs.writeFileSync(path.join(lockPath, 'owner'), `${process.pid}\n${Date.now()}\n`, { mode: 0o600, flag: 'wx' });
      } catch (error) {
        try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch {}
        throw error;
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
    }

    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > ENV_PATH_LOCK_STALE_MS) {
        const stalePath = `${lockPath}.stale-${process.pid}-${crypto.randomUUID()}`;
        try {
          fs.renameSync(lockPath, stalePath);
          fs.rmSync(stalePath, { recursive: true, force: true });
          continue;
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }

    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ENV_PATH writer lock: ${envPath}`);
    Atomics.wait(waitCell, 0, 0, 20);
  }

  try {
    return action();
  } finally {
    try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch {}
  }
}

function writeAtomicEnvFile(envPath: string, content: string): void {
  const dir = path.dirname(envPath);
  fs.mkdirSync(dir, { recursive: true });
  const temporary = `${envPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd: number | null = null;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content, 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temporary, envPath);
    try { fs.chmodSync(envPath, 0o600); } catch { /* non-POSIX filesystem */ }
    try {
      const dirFd = fs.openSync(dir, 'r');
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    } catch { /* directory fsync is not supported on every platform */ }
  } finally {
    if (fd != null) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    try { fs.unlinkSync(temporary); } catch { /* renamed or already removed */ }
  }
}

function hydrateProcessEnv(envContent: string): void {
  const values = parseEnvFile(envContent);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

export function ensureEnvSecrets(): void {
  if (initialized) return;
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  withEnvPathLock(envPath, () => ensureEnvSecretsLocked(envPath));
}

function ensureEnvSecretsLocked(envPath: string): void {
  if (initialized) return;
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
      writeAtomicEnvFile(envPath, `${lines.join('\n')}\n`);
    } catch (error) {
      if (updates.JWT_SECRET || updates.API_TOKEN_ENCRYPTION_KEY) throw error;
      if (updates.VAPID_PUBLIC_KEY || updates.VAPID_PRIVATE_KEY) {
        console.error(
          '[web-push] Could not persist generated VAPID keys to ENV_PATH; configure a writable persistent ENV_PATH or set matching VAPID environment variables on every replica.',
          error,
        );
      }
    }
    initialized = true;
  } catch (error) {
    initialized = false;
    throw error;
  }
}

export function writeEnvVars(updates: Record<string, string>): void {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
  withEnvPathLock(envPath, () => {
    const envContent = readEnvContent(envPath);
    let lines = envContent ? envContent.split('\n').filter(line => line.trim() !== '') : [];
    for (const [key, value] of Object.entries(updates)) {
      lines = upsertEnvLine(lines, key, value);
    }
    writeAtomicEnvFile(envPath, `${lines.join('\n')}\n`);
    for (const [key, value] of Object.entries(updates)) process.env[key] = value;
  });
}
