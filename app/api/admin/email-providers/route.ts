// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getActiveEmailProviders, isProviderConfigured } from '../../../../lib/emailService';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { primary, fallback } = getActiveEmailProviders();
  return NextResponse.json({
    primary,
    fallback,
    configured: {
      smtp: isProviderConfigured('smtp'),
      zeabur: isProviderConfigured('zeabur'),
      resend: isProviderConfigured('resend'),
    },
  });
}
