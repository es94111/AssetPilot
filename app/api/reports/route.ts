import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getTransactionsSummary, InvalidDateRangeError } from '../../../lib/dashboardHelpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  try {
    const summary = getTransactionsSummary(auth.userId, { type, from, to }, auth.userTimezone);
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof InvalidDateRangeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
