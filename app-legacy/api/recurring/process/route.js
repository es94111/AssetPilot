import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { processRecurringForUser } from '../../../../lib/recurringHelpers';

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const generated = processRecurringForUser(auth.userId, { maxSync: Infinity });
    return NextResponse.json({ generated });
  } catch (e) {
    console.error('[004-recurring] /process error:', e);
    return NextResponse.json({ error: '產生流程失敗' }, { status: 500 });
  }
}
