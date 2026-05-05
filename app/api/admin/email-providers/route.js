import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers.js';

const EMAIL_PROVIDER_PRIMARY = process.env.EMAIL_PROVIDER_PRIMARY || '';
const EMAIL_PROVIDER_FALLBACK = process.env.EMAIL_PROVIDER_FALLBACK || '';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_USER = process.env.SMTP_USER || '';
const ZEABUR_API_KEY = process.env.ZEABUR_API_KEY || '';
const ZEABUR_FROM_EMAIL = process.env.ZEABUR_FROM_EMAIL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

function isProviderConfigured(name) {
  if (name === 'smtp') return !!SMTP_HOST;
  if (name === 'zeabur') return !!(ZEABUR_API_KEY && ZEABUR_FROM_EMAIL);
  if (name === 'resend') return !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
  return false;
}

function getActiveEmailProviders() {
  const primary = isProviderConfigured(EMAIL_PROVIDER_PRIMARY) ? EMAIL_PROVIDER_PRIMARY : '';
  const fallback = (EMAIL_PROVIDER_FALLBACK && EMAIL_PROVIDER_FALLBACK !== primary && isProviderConfigured(EMAIL_PROVIDER_FALLBACK))
    ? EMAIL_PROVIDER_FALLBACK : '';
  return { primary, fallback };
}

export async function GET(request) {
  const auth = requireAdmin(request);
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
