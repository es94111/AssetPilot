// app/api/imports/invoices/[id]/route.ts — 發票草稿確認入帳／略過（issue #253）
//
// POST   → 確認入帳：把發票草稿轉為正式交易（使用者需先選帳戶／分類）
// DELETE → 略過此發票（標記 dismissed，不產生交易）
//
// 入帳沿用既有寫入核心 `insertIncomeExpenseTransaction()`（與
// POST /api/transactions、MCP create_transaction 共用），確保金額換算、
// 信用卡停用檢查、手續費規則與稽核行為完全一致。
// 冪等性：以發票號碼推導穩定的 `client_ref`，重複確認（含併發）只會有一筆交易。
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';
import { queryOne } from '../../../../../lib/db';
import { convertToTwd } from '../../../../../lib/accountHelpers';
import { computeTwdAmount } from '../../../../../lib/moneyDecimal';
import { insertIncomeExpenseTransaction } from '../../../../../lib/transactionWriteCore';
import { emitTransactionEvent } from '../../../../../lib/transactionWebhooks';
import {
  EinvoiceError,
  dismissInvoice,
  findInvoice,
  invoiceAuditMetadata,
  invoiceNote,
  markInvoiceImported,
  requireInvoice,
} from '../../../../../lib/einvoiceCarrier';

function handleError(e: unknown): NextResponse {
  if (e instanceof EinvoiceError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  throw e;
}

/**
 * 以發票號碼推導穩定的 idempotency key（32 碼十六進位，符合 clientRef 格式）。
 * 同一張發票無論確認幾次都指向同一把 key，由 transactions 的
 * `(user_id, client_ref)` 部分唯一索引保證只寫入一筆。
 */
export function invoiceClientRef(userId: string, invoiceNumber: string): string {
  return crypto
    .createHash('sha256')
    .update(`einvoice:${userId}:${invoiceNumber}`)
    .digest('hex')
    .slice(0, 32);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    accountId?: unknown;
    categoryId?: unknown;
    note?: unknown;
  };

  try {
    const invoice = requireInvoice(auth.userId, id);
    const status = String(invoice.status || 'draft');
    if (status === 'imported') throw new EinvoiceError('此發票已入帳', 409, 'InvoiceAlreadyImported');
    if (status === 'dismissed') throw new EinvoiceError('此發票已略過，無法入帳', 409, 'InvoiceDismissed');

    const accountId = String(body?.accountId || '').trim();
    const categoryId = String(body?.categoryId || '').trim();

    // 與 POST /api/transactions 相同的擁有權驗證：不接受不屬於本人的帳戶／分類。
    if (accountId) {
      const account = queryOne(
        'SELECT id, category, account_type, is_active FROM accounts WHERE id = ? AND user_id = ?',
        [accountId, auth.userId],
      );
      if (!account) throw new EinvoiceError('帳戶不存在或無權限', 400, 'AccountNotFound');
      const isCreditCard =
        account.category === 'credit_card' || account.account_type === '信用卡';
      if (isCreditCard && Number(account.is_active) === 0) {
        throw new EinvoiceError('此信用卡已停用，無法新增刷卡消費', 409, 'CreditCardDisabled');
      }
    }
    if (categoryId) {
      const category = queryOne(
        'SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, auth.userId],
      );
      if (!category) throw new EinvoiceError('分類不存在或無權限', 400, 'CategoryNotFound');
      if (!category.parent_id) {
        throw new EinvoiceError(
          '交易必須指派至子分類，不能直接掛在父分類底下',
          400,
          'ParentCategoryNotAllowed',
        );
      }
    }

    const amount = Number(invoice.amount) || 0;
    if (!(amount > 0)) throw new EinvoiceError('發票金額無效，無法入帳', 400, 'InvalidAmount');

    // 電子發票一律為新台幣整數元；換算與交易建立路徑完全一致
    // （見 app/api/transactions/route.ts 的 convertToTwd + computeTwdAmount）。
    const converted = convertToTwd(amount, 'TWD', '1', auth.userId);
    const twdAmountInt = computeTwdAmount(
      Math.round(converted.originalAmount * 100) / 100,
      converted.fxRate,
      0,
    );

    const note = invoiceNote(invoice, String(body?.note || ''));
    const result = insertIncomeExpenseTransaction({
      userId: auth.userId,
      type: 'expense',
      twdAmount: twdAmountInt,
      currency: converted.currency,
      originalAmount: converted.originalAmount,
      fxRate: converted.fxRate,
      fxFee: 0,
      date: String(invoice.invoice_date),
      categoryId: categoryId || null,
      accountId: accountId || null,
      note,
      excludeFromStats: false,
      clientRef: invoiceClientRef(auth.userId, String(invoice.invoice_number)),
    });

    const updated = markInvoiceImported(auth.userId, id, result.id);
    if (result.inserted) {
      // 與 POST /api/transactions 相同：只有真的新增列才發出事件（維持冪等）。
      emitTransactionEvent(auth.userId, 'transaction.created', {
        id: result.id,
        type: 'expense',
        amount: twdAmountInt,
        currency: converted.currency,
        date: String(invoice.invoice_date),
        account_id: accountId || null,
        category_id: categoryId || null,
        note,
      });
    }
    auditSensitiveAction(request, auth, {
      action: 'invoice_import',
      metadata: invoiceAuditMetadata({ id: updated.id, invoiceNumber: updated.invoiceNumber }),
    });

    return NextResponse.json({ invoice: updated, transactionId: result.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    // 先確認存在（避免對不存在的 id 留下假的稽核紀錄）。
    if (!findInvoice(auth.userId, id)) {
      throw new EinvoiceError('找不到此發票', 404, 'InvoiceNotFound');
    }
    const invoice = dismissInvoice(auth.userId, id);
    auditSensitiveAction(request, auth, {
      action: 'invoice_dismiss',
      metadata: invoiceAuditMetadata(invoice),
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    return handleError(e);
  }
}
