import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import { computeDashboardPayload } from '@/lib/dashboardHelpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ymRaw = String(searchParams.get('yearMonth') || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : null;

  const response = computeDashboardPayload({
    userId: auth.userId,
    actorUserId: auth.actorUserId,
    userTimezone: auth.userTimezone,
    yearMonth: month,
  });

  return NextResponse.json(response);
}
