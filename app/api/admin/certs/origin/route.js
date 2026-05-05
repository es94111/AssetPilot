import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const SSL_BASE_DIR = process.env.SSL_PATH || path.join(process.cwd(), 'SSL');
const SSL_ORIGIN_DIR = path.join(SSL_BASE_DIR, 'Origin Certificates');
const SSL_ORIGIN_CERT = path.join(SSL_ORIGIN_DIR, 'server.pem');
const SSL_ORIGIN_KEY = path.join(SSL_ORIGIN_DIR, 'server.key');
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

function validatePemKey(pem) {
  return typeof pem === 'string' && pem.includes('-----BEGIN') && pem.includes('PRIVATE KEY-----');
}

export async function POST(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const cert = typeof body?.cert === 'string' ? body.cert : undefined;
  const key = typeof body?.key === 'string' ? body.key : undefined;

  if (cert !== undefined) {
    if (!validatePemCert(cert)) return NextResponse.json({ error: '憑證格式錯誤' }, { status: 400 });
    try { new crypto.X509Certificate(cert); } catch (e) {
      return NextResponse.json({ error: '憑證解析失敗：' + e.message }, { status: 400 });
    }
    if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
    fs.writeFileSync(SSL_ORIGIN_CERT, cert.trim() + '\n', 'utf-8');
  }
  if (key !== undefined) {
    if (!validatePemKey(key)) return NextResponse.json({ error: '私鑰格式錯誤' }, { status: 400 });
    if (!fs.existsSync(SSL_ORIGIN_DIR)) fs.mkdirSync(SSL_ORIGIN_DIR, { recursive: true });
    fs.writeFileSync(SSL_ORIGIN_KEY, key.trim() + '\n', 'utf-8');
  }
  return NextResponse.json({ ok: true, cert: getCertInfo(SSL_ORIGIN_CERT), keyExists: fs.existsSync(SSL_ORIGIN_KEY), requiresRestart: true });
}

export async function DELETE(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  [SSL_ORIGIN_CERT, SSL_ORIGIN_KEY, SSL_ORIGIN_CA].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} });
  return NextResponse.json({ ok: true, requiresRestart: true });
}
