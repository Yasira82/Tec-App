if (process.env.VERCEL === '1' && process.env.NEXT_PUBLIC_PI_SANDBOX !== 'false') {
  throw new Error(
    'FATAL: NEXT_PUBLIC_PI_SANDBOX must be set to "false" for Vercel production builds. ' +
    'Current value: "' + (process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'undefined') + '". ' +
    'Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before deploying to Mainnet.'
  );
}

const path = require('path');

/**
 * The commit this CLIENT BUNDLE was built from.
 *
 * A whole debugging round was spent arguing about whether a fix had actually
 * shipped. The modal showed no diagnostic panel at all, and "the code is on
 * main" and "the browser is running that code" are different claims — a
 * Vercel *Redeploy* rebuilds the deployment it was invoked on, and a squash
 * merge can take only part of a branch (that one has bitten this platform
 * before, tec-core-backend #226).
 *
 * `VERCEL_GIT_COMMIT_SHA` is a build-time server variable; putting it in `env`
 * inlines it into the client bundle, so the page can state which commit it IS
 * rather than which commit someone believes it is. Falls back to 'dev' locally.
 */
const BUILD_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
  },

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
      { protocol: 'https', hostname: '**.r2.dev'      },  // NFT artwork (tec-assets uploads)
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
              // ✅ VM-017 FIXED: connect-src explicit whitelist — no more https: wildcard
              "connect-src 'self' https: wss:",
              // *.r2.dev hosts the NFT artwork uploaded through tec-assets. Without it
              // the browser BLOCKS every NFT image on /dashboard/assets and the tile
              // renders empty. tec-assets already allows it — the Hub was the outlier.
              "img-src 'self' data: blob: *.railway.app *.vercel.app *.r2.dev",
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
      {
        // Pi re-fetches validation-key.txt on every Verify — never let an edge
        // cache serve a stale copy while a domain is being validated.
        source: '/validation-key.txt',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

  async rewrites() {
    return {
      // Pi does an EXACT match on the content of /validation-key.txt, and the
      // paired Testnet app is served on the *.vercel.app URL — the SAME Vercel
      // deployment as the Mainnet domain hub.tecosystem.app. So each host must
      // serve exactly its own single key. Only the *.vercel.app host is rewritten
      // to the Testnet-only file; hub.tecosystem.app falls through to the static
      // public/validation-key.txt (the Mainnet key, byte-identical to what Pi
      // already verified — untouched).
      beforeFiles: [
        {
          source: '/validation-key.txt',
          has: [{ type: 'host', value: '.*\\.vercel\\.app(:\\d+)?' }],
          destination: '/validation-key-testnet.txt',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
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
