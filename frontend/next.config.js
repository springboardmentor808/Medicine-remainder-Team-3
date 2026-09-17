/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // ── Performance: disable double-render in dev (strict mode causes 2x renders) ──
  reactStrictMode: false,

  // ── Turbopack: much faster HMR and cold starts (Next.js 15 built-in) ────────
  // Use `next dev --turbopack` or set this flag
  turbopack: {
    resolveAlias: {
      '@': path.join(__dirname, 'src'),
    },
  },

  // ── @/ path alias for webpack (production builds) ─────────────────────────
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
    };
    return config;
  },

  // ── Optimize large icon/component packages ────────────────────────────────
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },


  // ── API Proxy to FastAPI backend ──────────────────────────────────────────
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },

  // ── Image domains ─────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '**.googleapis.com' },
    ],
  },
};

module.exports = nextConfig;
