import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.npm_package_version || '1.0.0',

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Expected errors
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
    // Network timeout (may be client-side issue)
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],

  // Don't send sensitive data
  beforeSend(event) {
    // Scrub request headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-auth-token'];
    }

    // Scrub cookies
    if (event.request?.cookies) {
      event.request.cookies = {};
    }

    // Remove any tokens from URLs
    if (event.request?.url) {
      event.request.url = event.request.url.replace(
        /token=[^&]+/g,
        'token=[REDACTED]'
      );
    }

    return event;
  },

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error'],
    }),
  ],
});
