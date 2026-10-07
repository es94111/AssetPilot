import { withLedgerWriteAudit } from '../../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { todayInUserTz } from '../../../../lib/userTime';
import { parseSavingsGoalRequest } from '../../../../lib/savingsGoal';
import { buildSavingsGoalView, findSavingsGoalRow } from '../../../../lib/savingsGoalStore';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const goal = findSavingsGoalRow(auth.userId, id);
  if (!goal) return NextResponse.json({ error: '目標不存在或無權限', code: 'NotFound' }, { status: 404 });

  return NextResponse.json(buildSavingsGoalView(auth.userId, goal, todayInUserTz(auth.userTimezone)));
}

async function handlePUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = findSavingsGoalRow(auth.userId, id);
  if (!existing) return NextResponse.json({ error: '目標不存在或無權限', code: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSavingsGoalRequest(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error, code: 'ValidationError', field: parsed.field }, { status: 400 });
  }

  if (parsed.accountId) {
    const account = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [parsed.accountId, auth.userId]);
    if (!account) return NextResponse.json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' }, { status: 400 });
  }
  if (parsed.categoryId) {
    const category = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = ?', [parsed.categoryId, auth.userId, 'expense']);
    if (!category) return NextResponse.json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }

  const now = Date.now();
  // start_date 不隨編輯變動：改動它會讓「已存」的計算起點回溯或前移，使歷史進度失真。
  getDB().run(
    'UPDATE savings_goals SET name = ?, target_amount = ?, target_date = ?, account_id = ?, category_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [parsed.name, parsed.targetAmount, parsed.targetDate, parsed.accountId || '', parsed.categoryId || '', now, id, auth.userId],
  );
  saveDB();

  const updated = findSavingsGoalRow(auth.userId, id);
  return NextResponse.json(updated
    ? buildSavingsGoalView(auth.userId, updated, todayInUserTz(auth.userTimezone))
    : { ok: true, id });
}

async function handleDELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = findSavingsGoalRow(auth.userId, id);
  if (!existing) return NextResponse.json({ error: '目標不存在或無權限', code: 'NotFound' }, { status: 404 });

  getDB().run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}

export const PUT = withLedgerWriteAudit(handlePUT);
export const DELETE = withLedgerWriteAudit(handleDELETE);
