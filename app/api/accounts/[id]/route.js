import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import {
  normalizeCurrency, normalizeAccountIcon, categoryFromAccountType, accountTypeFromCategory,
} from '../../../../lib/accountHelpers';
import { ownsResource, assertOptimisticLock, lockErrorResponse } from '../../../../lib/resourceHelpers';

const VALID_CATEGORIES = ['bank', 'credit_card', 'cash', 'virtual_wallet'];

// GET /api/accounts/[id]
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const a = ownsResource('accounts', 'id', id, auth.userId);
  if (!a) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  const accountCurrency = normalizeCurrency(a.currency);
  const txs = queryAll(
    'SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?',
    [a.id, auth.userId]
  );
  let balance = Number(a.initial_balance) || 0;
  txs.forEach(t => {
    const v = Number(t.original_amount) > 0 ? Number(t.original_amount) : Number(t.amount) || 0;
    if (t.type === 'income' || t.type === 'transfer_in') balance += v;
    else if (t.type === 'expense' || t.type === 'transfer_out') balance -= v;
  });
  const referenceCount = queryOne(
    'SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?',
    [a.id, a.id, auth.userId]
  )?.c || 0;

  return NextResponse.json({
    id: a.id, name: a.name,
    category: a.category || categoryFromAccountType(a.account_type),
    accountType: a.account_type,
    initialBalance: a.initial_balance,
    currency: accountCurrency,
    icon: normalizeAccountIcon(a.icon),
    excludeFromTotal: a.exclude_from_total === 1,
    linkedBankId: a.linked_bank_id || null,
    overseasFeeRate: a.overseas_fee_rate ?? null,
    currentBalance: Math.round(balance),
    referenceCount,
    updatedAt: Number(a.updated_at) || 0,
  });
}

async function updateAccount(request, id) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const existing = ownsResource('accounts', 'id', id, auth.userId);
  if (!existing) return NextResponse.json({ error: '資源不存在或無權限', code: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  if (body.expectedUpdatedAt != null || body.expected_updated_at != null) {
    try {
      assertOptimisticLock('accounts', 'id', id, body.expectedUpdatedAt ?? body.expected_updated_at);
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = body;
  const newCurrency = normalizeCurrency(body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const safeName = String(name || existing.name).trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return NextResponse.json({ error: '名稱必須為 1~64 字元', code: 'ValidationError', field: 'name' }, { status: 400 });
  }
  let category = body.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = categoryFromAccountType(body.accountType);
  }
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = excludeFromTotal ? 1 : 0;

  if (newCurrency && newCurrency !== normalizeCurrency(existing.currency)) {
    const refCount = queryOne(
      'SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?',
      [id, id, auth.userId]
    )?.c || 0;
    if (refCount > 0) {
      return NextResponse.json({ error: '此帳戶已有交易紀錄，無法變更幣別；如需不同幣別請新增帳戶', code: 'CurrencyLocked', referenceCount: refCount }, { status: 422 });
    }
  }

  let safeOverseasFeeRate = existing.overseas_fee_rate;
  if (body.overseasFeeRate != null) {
    if (category === 'credit_card') {
      const v = Number(body.overseasFeeRate);
      if (!Number.isFinite(v) || v < 0 || v > 1000) {
        return NextResponse.json({ error: '海外手續費率須為 0~1000（千分點）', code: 'ValidationError', field: 'overseasFeeRate' }, { status: 400 });
      }
      safeOverseasFeeRate = Math.round(v);
    } else {
      safeOverseasFeeRate = null;
    }
  }

  let safeLinkedBankId = null;
  if (category === 'credit_card' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')", [linkedBankId, auth.userId]);
    if (!bankAcc) return NextResponse.json({ error: '指定的銀行帳戶不存在' }, { status: 400 });
    safeLinkedBankId = linkedBankId;
  }

  const safeInitialBalance = Math.round(Number(initialBalance) || 0);
  const nowMs = Date.now();
  getDB().run(
    'UPDATE accounts SET name = ?, category = ?, initial_balance = ?, icon = ?, currency = ?, account_type = ?, exclude_from_total = ?, linked_bank_id = ?, overseas_fee_rate = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [safeName, category, safeInitialBalance, safeIcon, newCurrency, safeAccountType, safeExclude, safeLinkedBankId, safeOverseasFeeRate, nowMs, id, auth.userId]
  );
  saveDB();
  return NextResponse.json({ ok: true, updatedAt: nowMs });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  return updateAccount(request, id);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  return updateAccount(request, id);
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = ownsResource('accounts', 'id', id, auth.userId);
  if (!existing) return NextResponse.json({ error: '資源不存在或無權限', code: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { searchParams } = new URL(request.url);
  const expectedUpdatedAt = body?.expectedUpdatedAt ?? body?.expected_updated_at ?? searchParams.get('expected_updated_at');
  if (expectedUpdatedAt != null) {
    try {
      assertOptimisticLock('accounts', 'id', id, expectedUpdatedAt);
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  const count = queryOne('SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?', [auth.userId])?.cnt || 0;
  if (count <= 1) return NextResponse.json({ error: '至少需保留一個帳戶' }, { status: 400 });

  const refCount = queryOne(
    'SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?',
    [id, id, auth.userId]
  )?.c || 0;
  if (refCount > 0) {
    return NextResponse.json({ error: `請先處理該帳戶上的 ${refCount} 筆交易（可批次移到其他帳戶或刪除）`, code: 'AccountInUse', referenceCount: refCount }, { status: 422 });
  }

  const db = getDB();
  db.run('UPDATE accounts SET linked_bank_id = NULL WHERE linked_bank_id = ? AND user_id = ?', [id, auth.userId]);
  db.run('DELETE FROM accounts WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}
