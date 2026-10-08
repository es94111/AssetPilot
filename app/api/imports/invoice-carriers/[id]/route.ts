// app/api/imports/invoice-carriers/[id]/route.ts — 載具解除綁定與手動同步（issue #253）
//
// DELETE → 解除綁定（標記 revoked 並清除憑證密文；既有草稿與交易保留）
// POST   → 手動同步此載具的雲端發票，轉為交易草稿
// PATCH  → 切換此載具的排程同步（`auto_sync`）
//
// 同步失敗會保留錯誤狀態並設定退避（`next_retry_at`）；退避期間再次呼叫直接回
// `skipped` 且不發出任何外部請求，避免失敗風暴（比照 monthly_report_send_log
// 「保留錯誤狀態、不自動重試」的設計）。
// 憑證屬個人整合（見同目錄 route.ts 的說明），因此一律以 `auth.userId` 操作。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';
import {
  EinvoiceError,
  carrierAuditMetadata,
  requireCarrierSummary,
  revokeCarrier,
  syncAuditMetadata,
  syncCarrier,
} from '../../../../../lib/einvoiceCarrier';
import { setCarrierAutoSync } from '../../../../../lib/einvoiceSync';

function handleError(e: unknown): NextResponse {
  if (e instanceof EinvoiceError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  throw e;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    // 先取出摘要（含遮罩條碼）再解除，讓稽核仍能記錄是哪一組載具被解除。
    const summary = requireCarrierSummary(auth.userId, id);
    revokeCarrier(auth.userId, id);
    auditSensitiveAction(request, auth, {
      action: 'invoice_carrier_revoke',
      metadata: carrierAuditMetadata(summary),
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const result = await syncCarrier(auth, id);
    auditSensitiveAction(request, auth, {
      action: 'invoice_sync',
      // 供應商未設定（degraded）或退避中（skipped）不算失敗，不汙染失敗統計。
      result: result.status === 'failed' ? 'failed' : 'success',
      metadata: syncAuditMetadata(result.carrier, result),
    });
    return NextResponse.json({
      status: result.status,
      created: result.created,
      duplicates: result.duplicates,
      skipped: result.skipped,
      drafts: result.drafts,
      provider: result.provider,
      degraded: result.degraded,
      error: result.errorMessage,
      carrier: result.carrier,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { autoSync?: unknown };

  try {
    requireCarrierSummary(auth.userId, id);
    const autoSync = body?.autoSync === true;
    setCarrierAutoSync(auth.userId, id, autoSync);
    auditSensitiveAction(request, auth, {
      action: 'invoice_carrier_auto_sync',
      metadata: { carrier_id: String(id), sync_status: autoSync ? 'enabled' : 'disabled' },
    });
    return NextResponse.json({ carrier: requireCarrierSummary(auth.userId, id) });
  } catch (e) {
    return handleError(e);
  }
}
