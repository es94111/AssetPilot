import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getRecurringSuggestions, isSmartAssistEnabled } from '../../../../lib/smartAssist';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recurring/suggestions
 *
 * 掃描既有交易找出「疑似週期性」群組並提示「是否設為固定收支」。
 * 這是純提示：不建立任何 recurring 列，使用者確認後才透過既有
 * POST /api/recurring 寫入（維持既有驗證與授權路徑）。
 *
 * 已忽略的群組（recurring_suggestion_dismissals）與已是固定收支者皆不會再出現。
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { skipAutomaticProcessing: true });
  if (auth instanceof NextResponse) return auth;

  try {
    const result = getRecurringSuggestions({
      userId: auth.userId,
      userTimezone: auth.userTimezone,
      enabled: isSmartAssistEnabled(auth.actorUserId),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[smart-assist] recurring suggestions failed', error);
    return NextResponse.json({ error: '固定收支建議產生失敗' }, { status: 500 });
  }
}
