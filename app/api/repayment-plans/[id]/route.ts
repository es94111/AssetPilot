import { withLedgerWriteAudit } from '../../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { todayInUserTz } from '../../../../lib/userTime';
import { parseRepaymentPlanRequest } from '../../../../lib/savingsGoal';
import { buildRepaymentPlanDetail, findRepaymentPlanRow } from '../../../../lib/savingsGoalStore';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const plan = findRepaymentPlanRow(auth.userId, id);
  if (!plan) return NextResponse.json({ error: '還款計畫不存在或無權限', code: 'NotFound' }, { status: 404 });

  return NextResponse.json(buildRepaymentPlanDetail(plan, todayInUserTz(auth.userTimezone)));
}

async function handlePUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = findRepaymentPlanRow(auth.userId, id);
  if (!existing) return NextResponse.json({ error: '還款計畫不存在或無權限', code: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseRepaymentPlanRequest(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error, code: 'ValidationError', field: parsed.field }, { status: 400 });
  }

  if (parsed.accountId) {
    const account = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [parsed.accountId, auth.userId]);
    if (!account) return NextResponse.json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' }, { status: 400 });
  }

  const now = Date.now();
  getDB().run(
    'UPDATE repayment_plans SET name = ?, principal = ?, annual_rate = ?, periods = ?, start_date = ?, account_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [parsed.name, parsed.principal, parsed.annualRatePercent, parsed.periods, parsed.startDate, parsed.accountId || '', now, id, auth.userId],
  );
  saveDB();

  const updated = findRepaymentPlanRow(auth.userId, id);
  return NextResponse.json(updated
    ? buildRepaymentPlanDetail(updated, todayInUserTz(auth.userTimezone))
    : { ok: true, id, updatedAt: now });
}

async function handleDELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = findRepaymentPlanRow(auth.userId, id);
  if (!existing) return NextResponse.json({ error: '還款計畫不存在或無權限', code: 'NotFound' }, { status: 404 });

  getDB().run('DELETE FROM repayment_plans WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}

export const PUT = withLedgerWriteAudit(handlePUT);
export const DELETE = withLedgerWriteAudit(handleDELETE);
