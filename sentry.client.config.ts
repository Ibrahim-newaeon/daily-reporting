import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session Replay for debugging
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% on error

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // User-triggered
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Auth-related (expected)
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  // Don't send PII
  beforeSend(event, hint) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    // Don't send events for 4xx client errors (usually expected)
    const statusCode = (hint.originalException as any)?.statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return null;
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text for privacy
      maskAllText: true,
      // Block all media for privacy
      blockAllMedia: true,
    }),
  ],
});
