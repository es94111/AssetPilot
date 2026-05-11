import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { uid } from '../../../lib/userDefaults';

interface BudgetRow {
  id: string;
  category_id: string | null;
  year_month: string;
  amount: number;
  created_at: number | string | null;
  updated_at: number | string | null;
}

interface BudgetCategoryRow {
  parent_id: string | null;
}

interface BudgetChildCategoryRow {
  id: string;
}

interface CreateBudgetRequest {
  categoryId?: string | null;
  amount?: number;
  yearMonth?: string;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get('yearMonth') || '';

  let sql = 'SELECT * FROM budgets WHERE user_id = ?';
  const params: Array<string | number | null> = [auth.userId];
  if (yearMonth) { sql += ' AND year_month = ?'; params.push(yearMonth); }
  const rows = asRows<BudgetRow>(queryAll(sql, params));

  const result = rows.map(b => {
    const month = b.year_month;
    let usedSql = "SELECT COALESCE(SUM(twd_amount),0) AS used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0";
    const usedParams = [auth.userId, month + '%'];
    if (b.category_id) {
      const cat = asRow<BudgetCategoryRow>(queryOne('SELECT parent_id FROM categories WHERE id = ? AND user_id = ?', [b.category_id, auth.userId]));
      const isParent = !cat?.parent_id || cat.parent_id === '';
      if (isParent) {
        const children = asRows<BudgetChildCategoryRow>(queryAll('SELECT id FROM categories WHERE parent_id = ? AND user_id = ?', [b.category_id, auth.userId]));
        const allIds = [b.category_id, ...children.map(c => c.id)];
        usedSql += ` AND category_id IN (${allIds.map(() => '?').join(',')})`;
        usedParams.push(...allIds);
      } else {
        usedSql += ' AND category_id = ?';
        usedParams.push(b.category_id);
      }
    }
    const used = queryOne(usedSql, usedParams)?.used || 0;
    return {
      id: b.id,
      categoryId: b.category_id,
      yearMonth: b.year_month,
      amount: b.amount,
      used,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    };
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreateBudgetRequest;
  const { categoryId, amount, yearMonth } = body;
  const budgetAmount = Number(amount);

  if (!Number.isInteger(budgetAmount) || budgetAmount < 1) {
    return NextResponse.json({ error: '預算金額必須為正整數', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }
  if (!yearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(yearMonth))) {
    return NextResponse.json({ error: '月份格式無效（需為 YYYY-MM）', code: 'ValidationError', field: 'yearMonth' }, { status: 400 });
  }

  const catId = categoryId || null;
  if (catId) {
    const cat = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [catId, auth.userId]);
    if (!cat) return NextResponse.json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }

  const existing = queryOne('SELECT id FROM budgets WHERE user_id = ? AND year_month = ? AND category_id IS ?', [auth.userId, yearMonth, catId]);
  if (existing) {
    return NextResponse.json({ error: '該月份此分類已存在預算，請改為編輯既有預算', code: 'Conflict' }, { status: 409 });
  }

  const now = Date.now();
  const id = uid();
  getDB().run(
    'INSERT INTO budgets (id, user_id, category_id, amount, year_month, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, auth.userId, catId, budgetAmount, yearMonth, now, now]
  );
  saveDB();
  return NextResponse.json({ ok: true, id });
}
