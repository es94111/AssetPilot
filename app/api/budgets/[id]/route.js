import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

function parseYearMonth(body) {
  return body.yearMonth || body.month || '';
}

function serializeBudgetRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    yearMonth: row.year_month,
    amount: row.amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!row) {
    return NextResponse.json({ error: '預算不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  return NextResponse.json(serializeBudgetRow(row));
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!existing) {
    return NextResponse.json({ error: '預算不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const yearMonth = String(parseYearMonth(body));
  const categoryId = body.categoryId || null;

  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: '預算金額必須為正整數', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }
  if (!yearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    return NextResponse.json({ error: '月份格式無效（需為 YYYY-MM）', code: 'ValidationError', field: 'yearMonth' }, { status: 400 });
  }

  if (categoryId) {
    const cat = queryOne('SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!cat) return NextResponse.json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
    if (!cat.parent_id || cat.parent_id === '') {
      return NextResponse.json({ error: '預算僅可綁定子分類；請選擇父分類下的子分類', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
    }
  }

  const duplicate = queryOne(
    'SELECT id FROM budgets WHERE user_id = ? AND year_month = ? AND category_id IS ? AND id != ?',
    [auth.userId, yearMonth, categoryId, id]
  );
  if (duplicate) {
    return NextResponse.json({ error: '該月份此分類已存在預算，請改為編輯既有預算', code: 'Conflict' }, { status: 409 });
  }

  const now = Date.now();
  getDB().run(
    'UPDATE budgets SET category_id = ?, amount = ?, year_month = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [categoryId, amount, yearMonth, now, id, auth.userId]
  );
  saveDB();

  return NextResponse.json({ ok: true, id, updatedAt: now });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = queryOne('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!existing) {
    return NextResponse.json({ error: '預算不存在或無權限', code: 'NotFound' }, { status: 404 });
  }

  getDB().run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}
