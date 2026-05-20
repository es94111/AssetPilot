// @ts-nocheck
import { NextResponse } from 'next/server';
import { getSystemSettings, getUserCount } from '../../../lib/loginHelpers';
import { getTurnstileSiteKey, isTurnstileConfigured } from '../../../lib/turnstile';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

export async function GET() {
  const settings = getSystemSettings();
  const userCount = getUserCount();
  const registrationEnabled = userCount === 0 || settings.publicRegistration || settings.allowedRegistrationEmails.length > 0;
  return NextResponse.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleCodeFlow: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    lineChannelId: settings.lineLoginEnabled && LINE_CHANNEL_ID && LINE_CHANNEL_SECRET ? LINE_CHANNEL_ID : null,
    lineCodeFlow: !!(settings.lineLoginEnabled && LINE_CHANNEL_ID && LINE_CHANNEL_SECRET),
    turnstileSiteKey: getTurnstileSiteKey() || null,
    turnstileEnabled: !!getTurnstileSiteKey(),
    turnstileVerificationEnabled: isTurnstileConfigured(),
    registrationEnabled,
    publicRegistration: settings.publicRegistration,
    allowlistEnabled: settings.allowedRegistrationEmails.length > 0,
  });
}
