import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getTransactionPhotoStorageStatus } from '../../../../../lib/transactionAttachments';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(getTransactionPhotoStorageStatus());
}
