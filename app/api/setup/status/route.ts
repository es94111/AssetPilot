import { NextResponse } from 'next/server';
import { getSetupStatus } from '@/lib/setupBootstrap';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    return NextResponse.json(getSetupStatus(), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ required: false, tokenActive: false }, { headers: NO_STORE });
  }
}
