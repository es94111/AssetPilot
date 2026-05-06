import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db.js';

const EMAIL_PROVIDER_PRIMARY = process.env.EMAIL_PROVIDER_PRIMARY || '';
const EMAIL_PROVIDER_FALLBACK = process.env.EMAIL_PROVIDER_FALLBACK || '';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_FROM = process.env.SMTP_FROM || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

const ZEABUR_API_KEY = process.env.ZEABUR_API_KEY || '';
const ZEABUR_FROM_EMAIL = process.env.ZEABUR_FROM_EMAIL || '';
const ZEABUR_API_ENDPOINT = process.env.ZEABUR_API_ENDPOINT || 'https://gateway.zeabur.com/v1/send-email';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

function isProviderConfigured(name) {
  if (name === 'smtp') return !!SMTP_HOST;
  if (name === 'zeabur') return !!(ZEABUR_API_KEY && ZEABUR_FROM_EMAIL);
  if (name === 'resend') return !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
  return false;
}

async function sendViaSmtp({ to, subject, html }) {
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  const from = SMTP_FROM || SMTP_USER || 'noreply@localhost';
  const info = await transporter.sendMail({ from, to, subject, html });
  return { provider: 'smtp', id: info.messageId };
}

async function sendViaZeabur({ to, subject, html }) {
  const resp = await fetch(ZEABUR_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZEABUR_API_KEY}` },
    body: JSON.stringify({ from: ZEABUR_FROM_EMAIL, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.message || data?.error || `Zeabur 寄送失敗 (HTTP ${resp.status})`);
  return { provider: 'zeabur', id: data?.id || '' };
}

async function sendViaResend({ to, subject, html }) {
  const { Resend } = await import('resend');
  const resend = new Resend(RESEND_API_KEY);
  const result = await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, html });
  if (result?.error) throw new Error(result.error.message || 'Resend 寄送失敗');
  return { provider: 'resend', id: result?.data?.id || '' };
}

async function sendEmail({ to, subject, html }) {
  const primary = isProviderConfigured(EMAIL_PROVIDER_PRIMARY) ? EMAIL_PROVIDER_PRIMARY : '';
  const fallback = (EMAIL_PROVIDER_FALLBACK && EMAIL_PROVIDER_FALLBACK !== primary && isProviderConfigured(EMAIL_PROVIDER_FALLBACK))
    ? EMAIL_PROVIDER_FALLBACK : '';
  if (!primary && !fallback) return null;

  const sendVia = async (name) => {
    if (name === 'smtp') return sendViaSmtp({ to, subject, html });
    if (name === 'zeabur') return sendViaZeabur({ to, subject, html });
    if (name === 'resend') return sendViaResend({ to, subject, html });
    throw new Error(`未知寄信通道：${name}`);
  };

  if (primary) {
    try { return await sendVia(primary); } catch (err) { if (!fallback) throw err; }
  }
  return await sendVia(fallback);
}

export async function POST(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const me = queryOne('SELECT email, display_name FROM users WHERE id = ?', [auth.userId]);
  if (!me?.email) return NextResponse.json({ error: '目前管理員未設定 Email，無法寄送測試信' }, { status: 400 });

  try {
    const result = await sendEmail({
      to: me.email,
      subject: 'AssetPilot 寄信設定測試',
      html: '<p>這是一封測試信，用來驗證寄信設定正確。</p><p>若您能收到此信，代表「寄送資產統計報表」功能已可正常使用。</p>',
    });
    if (!result) return NextResponse.json({ error: '寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）' }, { status: 503 });
    return NextResponse.json({ success: true, provider: result.provider, to: me.email });
  } catch (e) {
    return NextResponse.json({ error: e.message || '測試信寄送失敗' }, { status: 500 });
  }
}
