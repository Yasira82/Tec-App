if (process.env.VERCEL === '1' && process.env.NEXT_PUBLIC_PI_SANDBOX !== 'false') {
  throw new Error(
    'FATAL: NEXT_PUBLIC_PI_SANDBOX must be set to "false" for Vercel production builds. ' +
    'Current value: "' + (process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'undefined') + '". ' +
    'Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before deploying to Mainnet.'
  );
}

const path = require('path');

// ✅ PI_SANDBOX build-time guard — Mainnet checklist
// Blocks the production build if sandbox mode is active.
// Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before Mainnet deploy.
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_PI_SANDBOX !== 'false') {
  throw new Error(
    'FATAL: NEXT_PUBLIC_PI_SANDBOX must be set to "false" for production builds. ' +
    'Current value: "' + (process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'undefined') + '". ' +
    'Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before deploying to Mainnet.'
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },

  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),

  images: {
    formats:         ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns:  [
      { protocol: 'https', hostname: '**.vercel.app'  },
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: 'api.minepi.com' },
      { protocol: 'https', hostname: 'www.okx.com'    },
    ],
  },

  compress: true,

  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesExternals: true,
    },
  }),

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: true,
        splitChunks: {
          chunks:  'all',
          minSize: 20000,
          maxSize: 200000,
          cacheGroups: {
            framework: {
              name:     'framework',
              chunks:   'all',
              test:     /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              priority: 40,
              enforce:  true,
            },
            commons: {
              name:      'commons',
              chunks:    'all',
              minChunks: 2,
              priority:  20,
            },
          },
        },
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff'                         },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control',  value: 'on'                              },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=()'        },
          {
            key:   'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' sdk.minepi.com *.minepi.com",
              "connect-src 'self' https: wss:",
              "img-src 'self' data: blob: *.railway.app *.vercel.app",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-src 'self' sdk.minepi.com *.minepi.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'self' *.minepi.com minepi.com",
            ].join('; '),
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type',  value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=86400'     },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

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
