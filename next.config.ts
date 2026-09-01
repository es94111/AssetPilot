import path from 'node:path';
import type { NextConfig } from 'next';

// 修正：worktree 根目錄需明確指定，避免 Next.js 誤用父目錄的 package-lock.json
const PROJECT_ROOT = __dirname;

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: PROJECT_ROOT,
  // sharp 為原生套件（含平台專屬 .node 二進位），交由 Node 於 runtime require，
  // 不要讓 webpack/Turbopack 打包；standalone 由 Dockerfile 手動複製其 node_modules。
  serverExternalPackages: ['sharp'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  distDir: 'build', // ASCII-only path
  // Next 16 still checks for the old typescript/lib/typescript.js path, which
  // TS 7 no longer ships. `npm run build` runs `npm run typecheck` first;
  // @typescript/native-preview keeps Next from auto-installing legacy TS.
  typescript: { ignoreBuildErrors: true },
  // Next.js 15 起 instrumentation.js 為穩定 API，無需 experimental.instrumentationHook

  // instrumentation.ts 會被編譯給 nodejs 與 edge 兩個 runtime；
  // edge 環境不提供 path/fs/crypto，設 fallback:false 讓 webpack 不拋錯。
  // 實際執行時這些模組只在 NEXT_RUNTIME==='nodejs' 時才被呼叫。
  webpack(config, { nextRuntime }) {
    // 強制 webpack 優先使用 worktree 的 node_modules，避免 Next.js workspace root 偵測錯誤
    // 導致 client bundle 與 RSC server 使用不同的 next 路徑，造成 module ID 不一致
    config.resolve = {
      ...config.resolve,
      // Next 16 cannot load tsconfig paths through TS 7's new package shape,
      // so keep the existing @/* alias explicit here.
      alias: {
        ...(config.resolve?.alias ?? {}),
        '@': PROJECT_ROOT,
      },
      modules: [
        path.resolve(PROJECT_ROOT, 'node_modules'),
        'node_modules',
      ],
    };

    if (nextRuntime !== 'nodejs') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        path: false,
        fs: false,
        crypto: false,
      };
    }
    return config;
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://challenges.cloudflare.com";
    return [
      // 靜態資源長期快取（僅 production；dev mode 下 app-pages-internals.js 等無 hash 的 chunk 不可 immutable）
      ...(!isDev ? [
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
      ] : []),
      // 全域安全標頭
      {
        source: '/(.*)',
        headers: [
          // 僅 production 送出 HSTS：本機/dev 常見 http://localhost，強制 HTTPS
          // 會破壞開發體驗。正式環境的邊緣代理需確實終止 TLS 並將 HTTP 導向
          // HTTPS（見 nginx.conf），HSTS 才能保護首次造訪與後續降級攻擊。
          ...(!isDev
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com",
              "frame-src https://accounts.google.com https://challenges.cloudflare.com",
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

export default nextConfig;
