// tests/helpers/envSecretsWorker.ts — independent cold-start process for shared ENV_PATH tests.
import * as fs from 'node:fs';
import crypto from 'node:crypto';
import { ensureEnvSecrets } from '../../lib/envSecrets.ts';
import { isValidVapidKeyPair } from '../../lib/webPushCore.ts';

const startAt = Number(process.env.ENV_SECRETS_TEST_START_AT || 0);
while (Date.now() < startAt) {
  await new Promise((resolve) => setTimeout(resolve, Math.min(10, startAt - Date.now())));
}
ensureEnvSecrets();
const envPath = process.env.ENV_PATH || '';
const content = fs.readFileSync(envPath, 'utf8');
const values = Object.fromEntries(content.split('\n').filter(Boolean).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
const secretStorePath = `${envPath}.generated-secrets`;
const storeContent = fs.readFileSync(secretStorePath, 'utf8');
const storeValues = Object.fromEntries(storeContent.split('\n').filter(Boolean).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
console.log(JSON.stringify({
  publicKey: process.env.VAPID_PUBLIC_KEY,
  validPair: isValidVapidKeyPair(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY),
  persisted: values.VAPID_PUBLIC_KEY === process.env.VAPID_PUBLIC_KEY
    && values.VAPID_PRIVATE_KEY === process.env.VAPID_PRIVATE_KEY,
  privateKeyDigest: crypto.createHash('sha256').update(process.env.VAPID_PRIVATE_KEY || '').digest('hex'),
  fileMode: fs.statSync(envPath).mode & 0o777,
  secretStoreMode: fs.statSync(secretStorePath).mode & 0o777,
  storeMatches: storeValues.VAPID_PUBLIC_KEY === process.env.VAPID_PUBLIC_KEY
    && storeValues.VAPID_PRIVATE_KEY === process.env.VAPID_PRIVATE_KEY,
}));
