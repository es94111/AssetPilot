// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { processStockRecurringForUser } from '../../../../lib/stockRecurringHelpers';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await processStockRecurringForUser(auth.userId, { userTimezone: auth.userTimezone });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: '排程處理失敗：' + e.message }, { status: 500 });
  }
}
