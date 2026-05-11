// @ts-nocheck
import { NextResponse } from 'next/server';
import externalApisData from '../../../lib/external-apis.json';

export async function GET() {
  const response = NextResponse.json({ apis: externalApisData });
  response.headers.set('Cache-Control', 'public, max-age=3600');
  return response;
}
