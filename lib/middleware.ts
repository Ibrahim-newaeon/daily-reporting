import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that require authentication
const protectedPaths = [
  '/dashboard',
  '/profiles',
  '/reports',
  '/connectors',
  '/settings',
  '/api/profiles',
  '/api/reports',
  '/api/connectors',
  '/api/data',
];

// List of paths that are always public
const publicPaths = [
  '/login',
  '/signup',
  '/api/auth',
  '/api/webhooks',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check if path requires authentication
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath) {
    // Check for auth token in cookies or Authorization header
    const authToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('Authorization');

    if (!authToken && !authHeader) {
      // Redirect to login for page requests
      if (!pathname.startsWith('/api')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Return 401 for API requests
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};

// Rate limiting utilities
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new entry
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// CORS utilities
export function corsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
  ].filter(Boolean);

  const corsOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Logging utilities
export function logRequest(
  request: NextRequest,
  response: NextResponse,
  duration: number
) {
  const log = {
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.nextUrl.pathname,
    status: response.status,
    duration: `${duration}ms`,
    userAgent: request.headers.get('User-Agent'),
  };

  console.log(JSON.stringify(log));
}
