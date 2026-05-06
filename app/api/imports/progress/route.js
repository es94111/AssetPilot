import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { importProgress } from '@/lib/transactionImportState';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const entry = importProgress.get(auth.userId);
  if (!entry) return NextResponse.json({ active: false });
  return NextResponse.json({ active: true, ...entry });
}
