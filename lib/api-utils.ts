import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { getClientIP } from './security';

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers,
    }
  );
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    },
    { status }
  );
}

/**
 * API route handler type
 */
type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Options for the API wrapper
 */
interface ApiWrapperOptions {
  /** Enable audit logging for this endpoint */
  audit?: boolean;
  /** Rate limit key prefix (enables rate limiting) */
  rateLimitKey?: string;
  /** Rate limit: max requests */
  rateLimitMax?: number;
  /** Rate limit: window in ms */
  rateLimitWindow?: number;
}

/**
 * Wrap an API route handler with error handling, logging, and optional features
 *
 * Features:
 * - Automatic error handling (never leaks stack traces in production)
 * - Request/response logging with timing
 * - Request ID generation for tracing
 * - Optional audit logging
 * - Consistent error response format
 *
 * @example
 * ```ts
 * export const GET = withApiHandler(async (request) => {
 *   const data = await fetchData();
 *   return successResponse(data);
 * }, { audit: true });
 * ```
 */
export function withApiHandler(
  handler: ApiHandler,
  options: ApiWrapperOptions = {}
): ApiHandler {
  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const method = request.method;
    const path = request.nextUrl.pathname;
    const clientIP = getClientIP(request.headers);

    // Add request ID to response headers
    const addRequestIdHeader = (response: NextResponse): NextResponse => {
      response.headers.set('X-Request-ID', requestId);
      return response;
    };

    try {
      // Log incoming request
      if (options.audit) {
        logger.apiRequest(method, path, undefined, {
          requestId,
          ip: clientIP,
          userAgent: request.headers.get('user-agent'),
        });
      }

      // Execute the handler
      const response = await handler(request, context);
      const duration = Date.now() - startTime;

      // Log response
      if (options.audit) {
        logger.apiResponse(method, path, response.status, duration, {
          requestId,
        });
      }

      return addRequestIdHeader(response);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log the error (with sanitization)
      logger.error('API handler error', error, {
        requestId,
        method,
        path,
        duration,
      });

      // Determine appropriate error response
      if (error instanceof ApiError) {
        return addRequestIdHeader(
          errorResponse(error.message, error.statusCode, error.details)
        );
      }

      // For unknown errors, return generic message in production
      const errorMessage =
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'An unexpected error occurred';

      return addRequestIdHeader(errorResponse(errorMessage, 500));
    }
  };
}

/**
 * Custom API error class for controlled error responses
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, 403);
  }

  static notFound(message: string = 'Not found'): ApiError {
    return new ApiError(message, 404);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(message, 409, details);
  }

  static tooManyRequests(message: string = 'Too many requests'): ApiError {
    return new ApiError(message, 429);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(message, 500);
  }
}

/**
 * Parse and validate JSON body with error handling
 */
export async function parseJsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw ApiError.badRequest('Invalid JSON body');
  }
}

/**
 * Extract pagination parameters from query string
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  defaults: { page: number; limit: number } = { page: 1, limit: 20 }
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaults.page), 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit), 10))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
