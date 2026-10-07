import { withLedgerWriteAudit } from '../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../lib/db';
import { todayInUserTz } from '../../../lib/userTime';
import { uid } from '../../../lib/userDefaults';
import { parseRepaymentPlanRequest } from '../../../lib/savingsGoal';
import { buildRepaymentPlanView, listRepaymentPlans } from '../../../lib/savingsGoalStore';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const today = todayInUserTz(auth.userTimezone);
  // 清單只回摘要（各期進度與月付金）；完整攤還表由 GET /api/repayment-plans/{id} 提供。
  const plans = listRepaymentPlans(auth.userId).map(plan => buildRepaymentPlanView(plan, today));
  return NextResponse.json(plans);
}

async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const parsed = parseRepaymentPlanRequest(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error, code: 'ValidationError', field: parsed.field }, { status: 400 });
  }

  // account_id 選填：僅作為「這筆債務的還款來源」標記，不影響攤還計算。
  if (parsed.accountId) {
    const account = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [parsed.accountId, auth.userId]);
    if (!account) return NextResponse.json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' }, { status: 400 });
  }

  const now = Date.now();
  const id = uid();
  getDB().run(
    'INSERT INTO repayment_plans (id, user_id, name, principal, annual_rate, periods, start_date, account_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, parsed.name, parsed.principal, parsed.annualRatePercent, parsed.periods, parsed.startDate, parsed.accountId || '', now, now],
  );
  saveDB();

  return NextResponse.json({ ok: true, id, createdAt: now }, { status: 201 });
}

export const POST = withLedgerWriteAudit(handlePOST);
