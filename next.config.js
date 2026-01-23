const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Enable instrumentation hook for Sentry
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'puppeteer-core',
      '@google-cloud/bigquery',
      '@google-cloud/storage',
      'firebase-admin',
    ],
  },
  // Exclude server-only packages from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        'fs/promises': false,
      };
    }
    return config;
  },
  images: {
    domains: ['storage.googleapis.com', 'lh3.googleusercontent.com'],
  },
  async headers() {
    // Define allowed origins - in production, only allow your domain
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3030',
    ].filter(Boolean);

    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.sentry.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://storage.googleapis.com https://lh3.googleusercontent.com",
              "font-src 'self'",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.sentry.io",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // CORS headers for API routes - restricted to allowed origins
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins[0] || 'https://yourdomain.com',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppress source map upload logs
  silent: true,
  // Organization and project from environment
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from generated client bundles
  hideSourceMaps: true,
  // Disable source map uploading during development
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',
};

// Export with Sentry wrapper (only if Sentry is configured)
module.exports = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
