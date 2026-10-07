import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { queryOne } from '../../../../lib/db';
import { importLocks } from '@/lib/transactionImportState';
import { parseReconciliationCsv, ReconciliationCsvError } from '../../../../lib/csvReconciliationParser';
import {
  deleteReconciliationProfile,
  listReconciliationProfiles,
  parseProfileConfig,
  upsertReconciliationProfile,
  type ReconciliationProfileRecord,
} from '../../../../lib/reconciliationStore';

/** 驗證 profile 是否可用：以 3 列樣本試跑解析器，避免存入無法使用的設定。 */
function validateProfile(config: unknown): string | null {
  if (!config || typeof config !== 'object') return '缺少欄位對應設定';
  try {
    parseReconciliationCsv('date,amount\n2026-01-01,1\n2026-01-02,-1', config as never);
  } catch (error) {
    if (error instanceof ReconciliationCsvError) {
      // 樣本欄位名與使用者設定不同是預期外的，只有結構錯誤才需回報。
      if (/缺少對應欄位/.test(error.message)) return null;
      return error.message;
    }
    return String(error instanceof Error ? error.message : error);
  }
  return null;
}

function serializeProfile(row: ReconciliationProfileRecord) {
  return {
    id: row.id,
    name: row.name,
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
    profile: parseProfileConfig(row.config),
  };
}

/**
 * GET /api/reconciliation/profiles — 本人的 CSV 欄位對應設定清單。
 * POST /api/reconciliation/profiles — 建立或更新（同名視為更新）。
 * DELETE /api/reconciliation/profiles?id=<id> — 刪除本人設定。
 *
 * 匯入進行中（互斥鎖生效）時，建立／更新／刪除一律回 409，避免同一批次前後
 * 設定不一致。實際的匯入與對帳結果寫入 data_operation_audit_log；純設定異動
 * 比照其他使用者偏好設定，不另留稽核（刪除除外，便於事後追查設定為何消失）。
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({
    profiles: listReconciliationProfiles(auth.userId).map(serializeProfile),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (importLocks.has(auth.userId)) {
    return NextResponse.json({ error: '匯入進行中，請稍候再試' }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    profile?: unknown;
  };
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: '請提供欄位對應名稱' }, { status: 400 });
  const validationError = validateProfile(body.profile);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    const saved = upsertReconciliationProfile({
      userId: auth.userId,
      name,
      profile: body.profile as never,
    });
    return NextResponse.json({ profile: serializeProfile(saved) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : error) },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const profileId = String(new URL(request.url).searchParams.get('id') || '');
  if (!profileId) return NextResponse.json({ error: '缺少設定 id' }, { status: 400 });
  if (importLocks.has(auth.userId)) {
    return NextResponse.json({ error: '匯入進行中，請稍候再試' }, { status: 409 });
  }

  const removed = deleteReconciliationProfile(auth.userId, profileId);
  if (!removed) return NextResponse.json({ error: '找不到欄位對應設定' }, { status: 404 });

  const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.actorUserId]);
  writeOperationAudit({
    userId: auth.userId,
    role: userRow?.is_admin ? 'admin' : 'user',
    action: 'delete_reconciliation_profile',
    ipAddress: getRequestIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') || '',
    result: 'success',
    isAdminOperation: false,
    metadata: { reconciliation_profile_id: profileId },
  });

  return NextResponse.json({ ok: true });
}
