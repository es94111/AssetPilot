import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { isSmartAssistEnabled, setSmartAssistEnabled } from '../../../../../lib/smartAssist';

export const dynamic = 'force-dynamic';

/**
 * 智慧輔助（分類建議／固定收支偵測）總開關（issue #252）。
 *
 * 這是「個人顯示偏好」而非帳本資料：一律讀寫操作者自己的 user_settings 列，
 * 不套用帳本寫入稽核（與 /api/user/settings/pinned-currencies 等一致）。
 * 建議內容本身仍以帳本範圍計算（見 /api/transactions/suggestions）。
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { skipAutomaticProcessing: true });
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ enabled: isSmartAssistEnabled(auth.actorUserId) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, { skipAutomaticProcessing: true });
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  if (typeof (body as { enabled?: unknown })?.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'ValidationError', field: 'enabled', message: 'enabled 必須為布林值' },
      { status: 400 },
    );
  }
  setSmartAssistEnabled(auth.actorUserId, (body as { enabled: boolean }).enabled);
  return NextResponse.json({ enabled: (body as { enabled: boolean }).enabled });
}
