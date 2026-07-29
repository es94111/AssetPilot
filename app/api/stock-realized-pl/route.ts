// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getStockRealizedPl } from '../../../lib/stockHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(getStockRealizedPl(auth.userId));
}
