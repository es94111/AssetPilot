import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/apiHelpers';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const SSL_BASE_DIR = process.env.SSL_PATH || path.join(process.cwd(), 'SSL');
const SSL_ORIGIN_DIR = path.join(SSL_BASE_DIR, 'Origin Certificates');
const SSL_ORIGIN_CA = path.join(SSL_ORIGIN_DIR, 'cloudflare-origin-ca.pem');

function getCertInfo(certPath) {
  try {
    if (!fs.existsSync(certPath)) return null;
    const pem = fs.readFileSync(certPath, 'utf-8');
    const cert = new crypto.X509Certificate(pem);
    return { subject: cert.subject, issuer: cert.issuer, validFrom: cert.validFrom, validTo: cert.validTo, fingerprint256: cert.fingerprint256 };
  } catch (e) {
    return { error: '憑證格式錯誤：' + e.message };
  }
}

function validatePemCert(pem) {
  return typeof pem === 'string' && pem.includes('-----BEGIN CERTIFICATE-----') && pem.includes('-----END CERTIFICATE-----');
}

export async function POST(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const cert = typeof body?.cert === 'string' ? body.cert : '';
  if (!validatePemCert(cert)) {
    return NextResponse.json({ error: 'Origin CA 憑證格式錯誤，需為 PEM 格式' }, { status: 400 });
  }
  try { new crypto.X509Certificate(cert); } catch (e) {
    return NextResponse.json({ error: 'Origin CA 憑證解析失敗：' + e.message }, { status: 400 });
  }
  if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
  fs.writeFileSync(SSL_ORIGIN_CA, cert.trim() + '\n', 'utf-8');
  return NextResponse.json({ ok: true, cert: getCertInfo(SSL_ORIGIN_CA), requiresRestart: true });
}

export async function DELETE(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try { if (fs.existsSync(SSL_ORIGIN_CA)) fs.unlinkSync(SSL_ORIGIN_CA); } catch (_) {}
  return NextResponse.json({ ok: true, requiresRestart: true });
}
