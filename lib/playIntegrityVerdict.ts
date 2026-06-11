// lib/playIntegrityVerdict.ts — Play Integrity verdict 型別與純評估邏輯
//
// 刻意不引入任何相依（無 logger / db），讓 evaluateVerdict 可被獨立單元測試
// （raw Node 無法解析專案其餘檔案的無副檔名 ESM import）。I/O 與解碼留在
// lib/playIntegrity.ts。

const DEFAULT_PACKAGE_NAME = 'com.assetpilot.assetpilot';

/** decodeIntegrityToken 回傳的 tokenPayloadExternal（即使用者提供的範例 JSON） */
export interface IntegrityVerdict {
  requestDetails?: {
    requestPackageName?: string;
    timestampMillis?: string;
    nonce?: string;
  };
  accountDetails?: { appLicensingVerdict?: string };
  appIntegrity?: {
    appRecognitionVerdict?: string;
    packageName?: string;
    certificateSha256Digest?: string[];
    versionCode?: string;
  };
  deviceIntegrity?: {
    deviceRecognitionVerdict?: string[];
  };
  environmentDetails?: {
    playProtectVerdict?: string;
  };
}

export function getPackageName(): string {
  return (process.env.PLAY_INTEGRITY_PACKAGE_NAME || DEFAULT_PACKAGE_NAME).trim();
}

/**
 * 依 verdict 評估是否「可信」。回傳 ok 與不通過原因清單（供記錄/除錯）。
 * 條件：套件名相符、nonce 相符、App 為 PLAY_RECOGNIZED、裝置達 MEETS_DEVICE_INTEGRITY。
 */
export function evaluateVerdict(
  verdict: IntegrityVerdict | null,
  opts: { expectedNonce?: string } = {},
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!verdict) {
    return { ok: false, reasons: ['no_verdict'] };
  }

  const packageName = getPackageName();
  const reqPkg = verdict.requestDetails?.requestPackageName;
  if (reqPkg && reqPkg !== packageName) reasons.push('package_name_mismatch');

  if (opts.expectedNonce) {
    if (verdict.requestDetails?.nonce !== opts.expectedNonce) reasons.push('nonce_mismatch');
  }

  const appVerdict = verdict.appIntegrity?.appRecognitionVerdict;
  if (appVerdict !== 'PLAY_RECOGNIZED') reasons.push(`app_${appVerdict || 'unknown'}`);

  const deviceVerdicts = verdict.deviceIntegrity?.deviceRecognitionVerdict || [];
  if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) reasons.push('device_integrity_failed');

  return { ok: reasons.length === 0, reasons };
}
