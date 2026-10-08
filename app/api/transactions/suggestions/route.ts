import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getCategorySuggestions, isSmartAssistEnabled } from '../../../../lib/smartAssist';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions/suggestions?type=expense&note=早餐
 *
 * 依「本次摘要 + 同類型歷史紀錄」產生子分類建議（Top-N，附信心度）。
 * 僅為提示：不回寫任何資料，使用者未確認前分類不會被指派。
 *
 * 帳本邊界由 requireAuth()/applyLedgerContext 決定 userId（共享帳本 → 帳本資料擁有者），
 * 因此建議只以同一帳本內的歷史紀錄計算，不會跨帳本洩漏。開關則取操作者本人的偏好。
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { skipAutomaticProcessing: true });
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = String(searchParams.get('type') || 'expense') === 'income' ? 'income' : 'expense';
  const note = String(searchParams.get('note') || '').slice(0, 200);

  try {
    const result = getCategorySuggestions({
      userId: auth.userId,
      enabled: isSmartAssistEnabled(auth.actorUserId),
      userTimezone: auth.userTimezone,
      note,
      type,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[smart-assist] category suggestions failed', error);
    return NextResponse.json({ error: '分類建議產生失敗' }, { status: 500 });
  }
}
