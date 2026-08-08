/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,

  // ── @/ path alias ─────────────────────────────────────────────────────
  // For webpack (production builds)
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
    };
    return config;
  },

  // ── API Proxy ──────────────────────────────────────────────────────────
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },

  // ── Image domains (for future prescription image uploads) ─────────────
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '**.googleapis.com' },
    ],
  },
};

module.exports = nextConfig;
