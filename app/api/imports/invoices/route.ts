// app/api/imports/invoices/route.ts — 雲端發票交易草稿列表（issue #253）
//
// GET → 列出登入者匯入的雲端發票（草稿／已入帳／已略過），供確認後入帳。
// 憑證與草稿皆屬個人整合資料，一律以 `auth.userId` 操作（見 invoice-carriers/route.ts）。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { listInvoices } from '../../../../lib/einvoiceCarrier';

const ALLOWED_STATUSES = new Set(['draft', 'imported', 'dismissed']);

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get('status') || '').trim();
  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: '發票狀態無效', code: 'ValidationError', field: 'status' },
      { status: 400 },
    );
  }
  const limit = Number(searchParams.get('limit')) || 200;

  return NextResponse.json({ invoices: listInvoices(auth.userId, { status, limit }) });
}
