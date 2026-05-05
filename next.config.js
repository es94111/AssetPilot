const path = require('path');

// ── Windows 非 ASCII 路徑相容修正 ──
// @vercel/nft 在 standalone 輸出時呼叫 fs.readlink，若路徑非符號連結則回傳 EINVAL。
// Windows 上非 ASCII 路徑會觸發此問題。將 EINVAL 轉換為 ENOENT，讓 nft 正常跳過。
if (process.platform === 'win32') {
  const fs = require('fs');
  const _origReadlink = fs.readlink.bind(fs);
  const _origReadlinkSync = fs.readlinkSync.bind(fs);
  fs.readlink = function (p, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    _origReadlink(p, opts, function (err, link) {
      if (err && err.code === 'EINVAL') {
        const e = Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), { code: 'ENOENT', errno: -2, syscall: 'readlink', path: p });
        cb(e);
      } else {
        cb(err, link);
      }
    });
  };
  fs.readlinkSync = function (p, opts) {
    try { return _origReadlinkSync(p, opts); }
    catch (err) {
      if (err && err.code === 'EINVAL') {
        const e = Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), { code: 'ENOENT', errno: -2, syscall: 'readlink', path: p });
        throw e;
      }
      throw err;
    }
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // outputFileTracingRoot：修正 Windows 路徑含非 ASCII 字元時的 EINVAL readlink 問題
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // 排除 .next/types 避免 @vercel/nft 在 Windows 非 ASCII 路徑上 readlink EINVAL 崩潰
    outputFileTracingExcludes: {
      '*': ['.next/types/**'],
    },
  },
  // Next.js 15 起 instrumentation.js 為穩定 API，無需 experimental.instrumentationHook

  async headers() {
    return [
      // 靜態資源長期快取（Next.js 以 hash 保證版本一致性）
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/public/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 全域安全標頭
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://accounts.google.com",
              "frame-src https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
