import { writeEnvVars } from '../../lib/envSecrets.ts';

const startAt = Number(process.env.ENV_SECRETS_TEST_START_AT || 0);
while (Date.now() < startAt) {
  await new Promise((resolve) => setTimeout(resolve, Math.min(10, startAt - Date.now())));
}

const key = String(process.env.ENV_SECRETS_TEST_KEY || '');
const value = String(process.env.ENV_SECRETS_TEST_VALUE || '');
if (!/^[A-Z][A-Z0-9_]*$/.test(key) || !value) throw new Error('Missing or invalid test environment update');
writeEnvVars({ [key]: value });
