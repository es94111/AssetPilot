import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('concurrent cold starts sharing ENV_PATH converge on one persisted VAPID pair', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'assetpilot-vapid-lock-'));
  const envPath = path.join(directory, '.env');
  const worker = fileURLToPath(new URL('../helpers/envSecretsWorker.ts', import.meta.url));
  const startAt = Date.now() + 750;

  function runWorker(): Promise<{
    publicKey: string;
    validPair: boolean;
    persisted: boolean;
    privateKeyDigest: string;
    fileMode: number;
    secretStoreMode: number;
    storeMatches: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--experimental-transform-types', '--import', './tests/setup/register.mjs', worker],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ENV_PATH: envPath,
            ENV_SECRETS_TEST_START_AT: String(startAt),
            JWT_SECRET: 'shared-test-jwt-secret-not-production',
            API_TOKEN_ENCRYPTION_KEY: 'shared-test-api-key-not-production',
            VAPID_PUBLIC_KEY: '',
            VAPID_PRIVATE_KEY: '',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code !== 0) {
          reject(new Error(`cold-start worker exited ${code}: ${stderr || stdout}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()) as {
            publicKey: string;
            validPair: boolean;
            persisted: boolean;
            privateKeyDigest: string;
            fileMode: number;
            secretStoreMode: number;
            storeMatches: boolean;
          });
        } catch (error) {
          reject(new Error(`cold-start worker returned invalid output: ${stdout}; ${stderr}; ${String(error)}`));
        }
      });
    });
  }

  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => runWorker()));
    assert.ok(results.every((result) => result.validPair));
    assert.ok(results.every((result) => result.secretStoreMode === 0o600));
    assert.ok(results.every((result) => result.storeMatches));
    assert.equal(new Set(results.map((result) => result.publicKey)).size, 1);
    assert.equal(new Set(results.map((result) => result.privateKeyDigest)).size, 1);
    const envValues = Object.fromEntries(
      readFileSync(envPath, 'utf8').split('\n').filter(Boolean).map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
    );
    assert.equal(envValues.VAPID_PUBLIC_KEY, results[0].publicKey);
    assert.equal(
      crypto.createHash('sha256').update(envValues.VAPID_PRIVATE_KEY || '').digest('hex'),
      results[0].privateKeyDigest,
      'final ENV_PATH must contain the canonical private key pair',
    );
    assert.equal(statSync(envPath).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
