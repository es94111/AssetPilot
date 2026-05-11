import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// 修正：worktree 根目錄需明確指定，避免 Next.js 誤用父目錄的 package-lock.json
const PROJECT_ROOT = __dirname;

type NodeCallback<T> = (err: NodeJS.ErrnoException | null, value?: T) => void;
type Readlink = typeof fs.readlink;
type ReadlinkSync = typeof fs.readlinkSync;
type ReadlinkPromise = typeof fs.promises.readlink;

function readlinkEnoentError(p: fs.PathLike): NodeJS.ErrnoException {
  return Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), {
    code: 'ENOENT',
    errno: -2,
    syscall: 'readlink',
    path: String(p),
  });
}

function isEinvalReadlinkError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err && err.code === 'EINVAL';
}

// ── Windows 非 ASCII 路徑相容修正 ──
// @vercel/nft 在 standalone 輸出時呼叫 fs.readlink，若路徑非符號連結則回傳 EINVAL。
// Windows 上非 ASCII 路徑會觸發此問題。將 EINVAL 轉換為 ENOENT，讓 nft 正常跳過。
if (process.platform === 'win32') {
  const originalReadlink = fs.readlink.bind(fs) as Readlink;
  const originalReadlinkSync = fs.readlinkSync.bind(fs) as ReadlinkSync;
  const originalReadlinkPromise = fs.promises.readlink.bind(fs.promises) as ReadlinkPromise;

  fs.readlink = function readlinkCompat(
    p: fs.PathLike,
    opts: BufferEncoding | { encoding?: BufferEncoding | null } | NodeCallback<string | Buffer>,
    cb?: NodeCallback<string | Buffer>,
  ) {
    let options = opts;
    let callback = cb;
    if (typeof opts === 'function') {
      callback = opts;
      options = {};
    }

    originalReadlink(p, options as BufferEncoding, (err, link) => {
      if (err && err.code === 'EINVAL') {
        callback?.(readlinkEnoentError(p));
      } else {
        callback?.(err, link);
      }
    });
  } as Readlink;

  fs.readlinkSync = function readlinkSyncCompat(
    p: fs.PathLike,
    opts?: BufferEncoding | { encoding?: BufferEncoding | null },
  ) {
    try {
      return originalReadlinkSync(p, opts as BufferEncoding);
    } catch (err) {
      if (isEinvalReadlinkError(err)) {
        throw readlinkEnoentError(p);
      }
      throw err;
    }
  } as ReadlinkSync;

  fs.promises.readlink = async function readlinkPromiseCompat(
    p: fs.PathLike,
    opts?: BufferEncoding | { encoding?: BufferEncoding | null },
  ) {
    try {
      return await originalReadlinkPromise(p, opts as BufferEncoding);
    } catch (err) {
      if (isEinvalReadlinkError(err)) {
        throw readlinkEnoentError(p);
      }
      throw err;
    }
  } as ReadlinkPromise;
}

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: PROJECT_ROOT,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  serverExternalPackages: ['sql.js'],
  distDir: 'build', // ASCII-only path
  // 保留 JS/TS 混用（由 tsconfig 的 allowJs 控制），但 build 需執行完整型別與 lint 檢查
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  // Next.js 15 起 instrumentation.js 為穩定 API，無需 experimental.instrumentationHook

  // instrumentation.ts 會被編譯給 nodejs 與 edge 兩個 runtime；
  // edge 環境不提供 path/fs/crypto，設 fallback:false 讓 webpack 不拋錯。
  // 實際執行時這些模組只在 NEXT_RUNTIME==='nodejs' 時才被呼叫。
  webpack(config, { nextRuntime }) {
    // 強制 webpack 優先使用 worktree 的 node_modules，避免 Next.js workspace root 偵測錯誤
    // 導致 client bundle 與 RSC server 使用不同的 next 路徑，造成 module ID 不一致
    config.resolve = {
      ...config.resolve,
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
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com";
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

export default nextConfig;
