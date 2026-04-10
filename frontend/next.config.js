// frontend/next.config.js
// Req 4.1: Page load time < 3 seconds
// Req 4.3: Scalability — cloud-ready, standalone output

/** @type {import('next').NextConfig} */
const nextConfig = {

  // ── Build output ────────────────────────────────────────────────────────────
  // Standalone bundles only what's needed — Docker image / PM2 is ~70% smaller.
  output: 'standalone',

  // SWC minification (default in Next.js 14, explicit for clarity)
  swcMinify: true,

  // Gzip all page and API route responses
  compress: true,

  // Remove "X-Powered-By: Next.js" (security + noise)
  poweredByHeader: false,

  // ── Image optimisation ───────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images-eu.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com'              },
      { protocol: 'https', hostname: '*.cloudfront.net'                },
      { protocol: 'http',  hostname: 'localhost'                       },
      { protocol: 'https', hostname: 'placehold.co'                    },
      // Uncomment for your production domain:
      // { protocol: 'https', hostname: 'yourdomain.com' },
    ],
    // AVIF = best compression. WebP = wider support. Both via Accept header.
    formats: ['image/avif', 'image/webp'],
    // srcset breakpoints aligned with Tailwind defaults
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes:  [16, 32, 48, 64, 96, 128, 256],
    // Cache optimised images for 30 days (dev default is 60s)
    minimumCacheTTL: 2_592_000,
  },

  // ── Bundle size ───────────────────────────────────────────────────────────────
  // Tree-shake heavy packages — only ship icons/functions actually imported
  experimental: {
    optimizePackageImports: [
      'lucide-react', // 1000+ icons
      'recharts',     // heavy chart lib
      'date-fns',     // heavy date lib
    ],
  },

  // ── HTTP cache headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      // Hashed static assets — immutable forever
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Optimised images — 30 days
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000' },
        ],
      },
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'SAMEORIGIN'                      },
          { key: 'X-Content-Type-Options',  value: 'nosniff'                         },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',        value: '1; mode=block'                  },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // ── Webpack ───────────────────────────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure plugins array exists before pushing to it
      config.plugins = config.plugins || [];
    }
    return config;
  },
};

module.exports = nextConfig;