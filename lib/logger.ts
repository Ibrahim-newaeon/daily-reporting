/**
 * Structured logging utility with PII/sensitive data redaction
 * Use this instead of console.log/error for production-safe logging
 */

// Fields that should be redacted from logs
const SENSITIVE_FIELDS = [
  'password',
  'accessToken',
  'refreshToken',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'sessionId',
  'creditCard',
  'ssn',
  'idToken',
];

// Patterns to redact (e.g., tokens in URLs or strings)
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+/gi,
  /token=[A-Za-z0-9\-_]+/gi,
  /api[_-]?key=[A-Za-z0-9\-_]+/gi,
];

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitiveData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let redacted = data;
    // Redact patterns in strings
    for (const pattern of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    // Truncate very long strings (likely tokens or encoded data)
    if (redacted.length > 500) {
      return redacted.substring(0, 100) + '...[TRUNCATED]';
    }
    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Format an error for logging (without exposing sensitive stack traces in production)
 */
function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // Only include stack traces in development
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? (redactSensitiveData(context) as Record<string, unknown>) : undefined,
    error: formatError(error),
  };
}

/**
 * Output a log entry
 */
function outputLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);

  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(output);
      }
      break;
    default:
      console.log(output);
  }
}

/**
 * Structured logger with automatic sensitive data redaction
 */
export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    outputLog(createLogEntry('debug', message, context));
  },

  info(message: string, context?: Record<string, unknown>): void {
    outputLog(createLogEntry('info', message, context));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    outputLog(createLogEntry('warn', message, context));
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    outputLog(createLogEntry('error', message, context, error));
  },

  /**
   * Log an API request (for audit trail)
   */
  apiRequest(
    method: string,
    path: string,
    userId?: string,
    context?: Record<string, unknown>
  ): void {
    outputLog(
      createLogEntry('info', 'API Request', {
        type: 'api_request',
        method,
        path,
        userId,
        ...context,
      })
    );
  },

  /**
   * Log an API response
   */
  apiResponse(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: Record<string, unknown>
  ): void {
    outputLog(
      createLogEntry('info', 'API Response', {
        type: 'api_response',
        method,
        path,
        statusCode,
        durationMs,
        ...context,
      })
    );
  },
};

/**
 * Utility to create a child logger with preset context
 */
export function createLogger(defaultContext: Record<string, unknown>) {
  return {
    debug(message: string, context?: Record<string, unknown>): void {
      logger.debug(message, { ...defaultContext, ...context });
    },
    info(message: string, context?: Record<string, unknown>): void {
      logger.info(message, { ...defaultContext, ...context });
    },
    warn(message: string, context?: Record<string, unknown>): void {
      logger.warn(message, { ...defaultContext, ...context });
    },
    error(message: string, error?: unknown, context?: Record<string, unknown>): void {
      logger.error(message, error, { ...defaultContext, ...context });
    },
  };
}

export { redactSensitiveData };
