import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import {
  getKeyringRotationAdminStatus,
  setKeyringRotationPaused,
  updateKeyringRotationSettings,
  type RotationSettingsUpdate,
} from '../../../../lib/keyringRotationScheduler';
import { KeyRotationError } from '../../../../lib/keyringRotation';
import { isKeyringPurpose } from '../../../../lib/keyringRotationScheduleCore';

function errorResponse(error: unknown) {
  if (error instanceof KeyRotationError) {
    const status = error.code.startsWith('INVALID_') ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error('[keyring] admin rotation request failed', error instanceof Error ? error.message : 'unknown');
  return NextResponse.json({ error: '金鑰輪換設定操作失敗' }, { status: 500 });
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(getKeyringRotationAdminStatus());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '無效的金鑰輪換設定' }, { status: 400 });
  }

  try {
    const input = body as RotationSettingsUpdate;
    updateKeyringRotationSettings(input, auth.userId);
    auditSensitiveAction(request, auth, {
      action: 'admin.keyring_rotation.settings_update',
      metadata: { changed_fields: 'expectedInstanceCount,backupConfirmation,scheduleSettings' },
    });
    return NextResponse.json({ success: true, status: getKeyringRotationAdminStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }
  const input = body as { purpose?: unknown; action?: unknown } | null;
  if (!input || !isKeyringPurpose(input.purpose) || !['pause', 'resume'].includes(String(input.action))) {
    return NextResponse.json({ error: '無效的用途或操作' }, { status: 400 });
  }

  const paused = input.action === 'pause';
  try {
    setKeyringRotationPaused(input.purpose, paused, auth.userId);
    auditSensitiveAction(request, auth, {
      action: paused ? 'admin.keyring_rotation.pause' : 'admin.keyring_rotation.resume',
      metadata: { purpose: input.purpose, changed_fields: paused ? 'paused' : 'resumed' },
    });
    return NextResponse.json({ success: true, status: getKeyringRotationAdminStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}
