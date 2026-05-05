import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
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

export async function GET(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    originCert: getCertInfo(SSL_ORIGIN_CERT),
    originKeyExists: fs.existsSync(SSL_ORIGIN_KEY),
    originCa: getCertInfo(SSL_ORIGIN_CA),
  });
}
