import { withLedgerWriteAudit } from '../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../lib/db';
import { todayInUserTz } from '../../../lib/userTime';
import { uid } from '../../../lib/userDefaults';
import { parseSavingsGoalRequest } from '../../../lib/savingsGoal';
import { buildSavingsGoalView, findSavingsGoalRow, listSavingsGoals } from '../../../lib/savingsGoalStore';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const today = todayInUserTz(auth.userTimezone);
  const goals = listSavingsGoals(auth.userId).map(goal => buildSavingsGoalView(auth.userId, goal, today));
  return NextResponse.json(goals);
}

async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

  const today = todayInUserTz(auth.userTimezone);
  const now = Date.now();
  const id = uid();
  getDB().run(
    'INSERT INTO savings_goals (id, user_id, name, target_amount, target_date, start_date, account_id, category_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, parsed.name, parsed.targetAmount, parsed.targetDate, today, parsed.accountId || '', parsed.categoryId || '', now, now],
  );
  saveDB();

  const created = findSavingsGoalRow(auth.userId, id);
  return NextResponse.json(
    created ? buildSavingsGoalView(auth.userId, created, today) : { ok: true, id },
    { status: 201 },
  );
}

export const POST = withLedgerWriteAudit(handlePOST);
