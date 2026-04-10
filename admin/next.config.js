/** @type {import('next').NextConfig} */
const nextConfig = {
   output: 'standalone',

   compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudinary.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2_592_000, // 30 days
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

   
  turbopack: {
    root: process.cwd(),
  },

  async headers() {
    return [
      
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },

   
  webpack: (config) => config,
};

module.exports = nextConfig;