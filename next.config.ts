import type { NextConfig } from "next";

import type { NextConfig } from "next";

import type { NextConfig } from "next";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    turbo: false,
  },
  outputFileTracingExcludes: {
    '*': ['.next/types/**'],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/api/:path*",
      },
    ];
  },
};
export default nextConfig;

export default nextConfig;

export default nextConfig;
