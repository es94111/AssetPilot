import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookie } from '../../../../lib/apiHelpers';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  return clearAuthCookie(response);
}
