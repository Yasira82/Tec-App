const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Output ──────────────────────────────────────────────
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),

  // ── Images ──────────────────────────────────────────────
  images: {
    formats:         ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns:  [
      { protocol: 'https', hostname: '**.vercel.app' },
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: 'api.minepi.com' },
    ],
  },

  // ── Compression ──────────────────────────────────────────
  compress: true,

  // ── Bundle Analyzer (npm run analyze) ────────────────────
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesExternals: true,
    },
  }),

  // ── Webpack ──────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    // ── Alias ──────────────────────────────────────────────
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

    // ── Tree shaking ────────────────────────────────────────
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        usedExports:   true,
        sideEffects:   true,
        splitChunks: {
          chunks:                'all',
          minSize:               20000,
          maxSize:               200000,
          cacheGroups: {
            framework: {
              name:     'framework',
              chunks:   'all',
              test:     /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              priority: 40,
              enforce:  true,
            },
            commons: {
              name:     'commons',
              chunks:   'all',
              minChunks: 2,
              priority:  20,
            },
          },
        },
      };
    }

    return config;
  },

  // ── Headers ──────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff'                        },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin'},
          { key: 'X-DNS-Prefetch-Control',     value: 'on'                             },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=()'       },
        ],
      },
      {
        // ── Static assets — cache 1 year ──────────────────
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // ── Fonts ─────────────────────────────────────────
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type',  value: 'application/manifest+json'  },
          { key: 'Cache-Control', value: 'public, max-age=86400'       },
        ],
      },
      {
        // ── API routes — no cache ─────────────────────────
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

  // ── Redirects ────────────────────────────────────────────
  async redirects() {
    return [
      {
        source:      '/home',
        destination: '/',
        permanent:   true,
      },
    ];
  },
};

module.exports = nextConfig;
