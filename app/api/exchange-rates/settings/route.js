import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { setExchangeRateAutoUpdate } from '../../../../lib/exchangeRateHelpers';

export async function PUT(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const autoUpdate = !!body?.autoUpdate;
  const settings = setExchangeRateAutoUpdate(auth.userId, autoUpdate);
  return NextResponse.json({ success: true, settings });
}
