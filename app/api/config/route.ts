// @ts-nocheck
import { NextResponse } from 'next/server';
import { getSystemSettings, getUserCount } from '../../../lib/loginHelpers';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export async function GET() {
  const settings = getSystemSettings();
  const userCount = getUserCount();
  const registrationEnabled = userCount === 0 || settings.publicRegistration || settings.allowedRegistrationEmails.length > 0;
  return NextResponse.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleCodeFlow: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    registrationEnabled,
    publicRegistration: settings.publicRegistration,
    allowlistEnabled: settings.allowedRegistrationEmails.length > 0,
  });
}
