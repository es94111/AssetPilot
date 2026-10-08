import { withLedgerWriteAudit } from '../../../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { dismissRecurringSuggestion } from '../../../../../lib/smartAssist';

export const dynamic = 'force-dynamic';

const SIGNATURE_MAX_LENGTH = 400;

/**
 * POST /api/recurring/suggestions/dismiss  { signature: "expense|cat|acct|1200" }
 *
 * 記錄使用者「不要再提示這組」的決定。僅寫入提示層的忽略清單，
 * 不動任何交易或固定收支設定；路徑屬帳本資料 API，故沿用帳本寫入稽核與角色檢查
 * （viewer 唯讀，無法變更提示狀態）。
 */
async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request, { skipAutomaticProcessing: true });
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const signature = String((body as { signature?: unknown })?.signature || '').trim();
  if (!signature || signature.length > SIGNATURE_MAX_LENGTH) {
    return NextResponse.json(
      { error: 'ValidationError', field: 'signature', message: 'signature 格式無效' },
      { status: 400 },
    );
  }

  try {
    dismissRecurringSuggestion(auth.userId, signature);
    return NextResponse.json({ dismissed: true });
  } catch (error) {
    console.error('[smart-assist] dismiss failed', error);
    return NextResponse.json({ error: '忽略建議失敗' }, { status: 500 });
  }
}

export const POST = withLedgerWriteAudit(handlePOST);
