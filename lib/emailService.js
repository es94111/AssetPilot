'use strict';

const EMAIL_PROVIDER_PRIMARY = process.env.EMAIL_PROVIDER_PRIMARY || '';
const EMAIL_PROVIDER_FALLBACK = process.env.EMAIL_PROVIDER_FALLBACK || '';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_SECURE = /^(1|true|yes)$/i.test(String(process.env.SMTP_SECURE || ''));
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || '';

const ZEABUR_API_KEY = process.env.ZEABUR_API_KEY || '';
const ZEABUR_FROM_EMAIL = process.env.ZEABUR_FROM_EMAIL || '';
const ZEABUR_API_ENDPOINT = 'https://api.zeabur.com/api/v1/zsend/emails';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

const EMAIL_SENDER_NAME = (process.env.EMAIL_SENDER_NAME || '').trim();

let smtpTransporter = null;
let resendClient = null;

function runtimeRequire(moduleName) {
  return new Function('moduleName', 'return require(moduleName)')(moduleName);
}

function runtimeImport(moduleName) {
  return new Function('moduleName', 'return import(moduleName)')(moduleName);
}

function formatFromAddress(raw) {
  if (!raw) return raw;
  if (!EMAIL_SENDER_NAME) return raw;
  if (raw.includes('<')) return raw;
  const escaped = EMAIL_SENDER_NAME.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}" <${raw}>`;
}

async function getSmtpTransporter() {
  if (!SMTP_HOST) return null;
  if (!smtpTransporter) {
    const nodemailer = runtimeRequire('nodemailer');
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }
  return smtpTransporter;
}

async function getResendClient() {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) {
    const { Resend } = await runtimeImport('resend');
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

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
  return { primary, fallback, hasAny: !!(primary || fallback) };
}

async function sendViaProvider(name, { to, subject, html }) {
  if (name === 'smtp') {
    const transporter = await getSmtpTransporter();
    const from = formatFromAddress(SMTP_FROM || SMTP_USER || 'noreply@localhost');
    const info = await transporter.sendMail({ from, to, subject, html });
    return { provider: 'smtp', id: info.messageId || '' };
  }

  if (name === 'zeabur') {
    const resp = await fetch(ZEABUR_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZEABUR_API_KEY}`,
      },
      body: JSON.stringify({
        from: formatFromAddress(ZEABUR_FROM_EMAIL),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = new Error(data?.message || data?.error || `Zeabur 寄送失敗 (HTTP ${resp.status})`);
      err.provider = 'zeabur';
      throw err;
    }
    return { provider: 'zeabur', id: data?.id || data?.message_id || '' };
  }

  if (name === 'resend') {
    const resend = await getResendClient();
    const result = await resend.emails.send({ from: formatFromAddress(RESEND_FROM_EMAIL), to, subject, html });
    if (result?.error) {
      const err = new Error(result.error.message || 'Resend 寄送失敗');
      err.provider = 'resend';
      throw err;
    }
    return { provider: 'resend', id: result?.data?.id || '' };
  }

  throw new Error(`未知寄信通道：${name}`);
}

async function sendStatsEmail({ to, subject, html }) {
  const { primary, fallback } = getActiveEmailProviders();
  if (!primary && !fallback) return null;

  if (primary) {
    try {
      return await sendViaProvider(primary, { to, subject, html });
    } catch (err) {
      if (!fallback) throw err;
    }
  }
  return sendViaProvider(fallback, { to, subject, html });
}

module.exports = {
  formatFromAddress,
  getActiveEmailProviders,
  isProviderConfigured,
  sendStatsEmail,
};
