// lib/passkeyRegistration.ts — 共用 WebAuthn 註冊驗證核心（一般新增 Passkey、復原、首次部署初始化共用）
import { server as webauthnServer } from '@passwordless-id/webauthn';
import { resolvePasskeyExpectedOrigin } from './originPolicy';

export class PasskeyOriginUnavailableError extends Error {
  constructor() {
    super('伺服器未設定允許的網域（ALLOWED_ORIGINS），無法驗證 Passkey');
    this.name = 'PasskeyOriginUnavailableError';
  }
}

export interface VerifiedPasskeyCredential {
  id: string;
  publicKey: string;
  algorithm: string;
  transports?: string[];
}

/**
 * 以伺服器端信任清單比對 origin（不採用請求自帶 Origin 作為期望值），並強制 userVerified。
 * origin 未設定會丟出 PasskeyOriginUnavailableError；驗證失敗會丟出 webauthn 原生錯誤。
 */
export async function verifyPasskeyRegistration(
  registration: unknown,
  challenge: string,
  requestOrigin: string | null,
): Promise<VerifiedPasskeyCredential> {
  const { origin } = resolvePasskeyExpectedOrigin(requestOrigin);
  if (!origin) throw new PasskeyOriginUnavailableError();
  const result = await webauthnServer.verifyRegistration(registration as never, {
    challenge,
    origin,
    userVerified: true,
  });
  return result.credential as VerifiedPasskeyCredential;
}

export const INSERT_PASSKEY_SQL =
  'INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, transports, counter, device_name, created_at) VALUES (?,?,?,?,?,?,?,?)';

export function passkeyInsertParams(
  userId: string,
  credential: VerifiedPasskeyCredential,
  deviceName: unknown,
): (string | number)[] {
  return [
    credential.id,
    userId,
    credential.publicKey,
    credential.algorithm,
    JSON.stringify(credential.transports || []),
    0,
    String(deviceName || '').trim().slice(0, 60) || 'Passkey',
    new Date().toISOString().slice(0, 10),
  ];
}
