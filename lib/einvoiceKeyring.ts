import { decryptSecret } from './apiTokenCore';
import { decryptCarrierSecret, encryptCarrierSecret } from './einvoiceSecret';
import { decryptVersionedSecret, encryptVersionedSecret, parseVersionedSecret } from './keyringCore';
import { getActiveKey, getKeyById, getLegacyKey, isKeyringEnabled } from './keyring';

export function encryptEinvoiceSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env !== process.env) return encryptCarrierSecret(plaintext, env);
  const active = getActiveKey('einvoice');
  return active
    ? encryptVersionedSecret(plaintext, active.key, 'einvoice', active.kid)
    : encryptCarrierSecret(plaintext, env);
}

export function decryptEinvoiceSecret(
  payload: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env !== process.env) return decryptCarrierSecret(payload, env);
  const versioned = parseVersionedSecret(payload);
  if (versioned) {
    const key = getKeyById('einvoice', versioned.kid);
    return decryptVersionedSecret(payload, key.key, 'einvoice', key.kid);
  }
  if (isKeyringEnabled()) {
    const legacy = getLegacyKey('einvoice');
    if (!legacy) throw new Error('Legacy e-invoice key is unavailable');
    return decryptSecret(payload, legacy.key.toString('utf8'));
  }
  return decryptCarrierSecret(payload, env);
}
