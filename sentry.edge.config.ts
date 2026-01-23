import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring - lower rate for edge
  tracesSampleRate: 0.05, // 5% of transactions

  // Environment
  environment: process.env.NODE_ENV,
});
