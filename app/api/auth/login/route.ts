import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase';
import { createUser, getUser } from '@/lib/auth';
import { checkRateLimit, RateLimits, getClientIP, createAuditLogEntry } from '@/lib/security';

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent brute force attacks
  const clientIP = getClientIP(request.headers);
  const rateLimit = checkRateLimit(
    `login:${clientIP}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.windowMs
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many login attempts. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter || 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      );
    }

    // Verify the ID token
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Check if user exists in Firestore
    let user = await getUser(decodedToken.uid);

    // Create user if doesn't exist
    if (!user) {
      user = await createUser(
        decodedToken.uid,
        decodedToken.email || '',
        decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        decodedToken.picture
      );
    }

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
      },
    });

    // Set session cookie
    response.cookies.set('auth-token', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    // Log successful login for audit trail
    const adminDb = getAdminDb();
    const auditEntry = createAuditLogEntry(user.id, 'LOGIN', 'auth', {
      ip: clientIP,
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
    });
    await adminDb.collection('auditLogs').add(auditEntry);

    return response;
  } catch (error) {
    console.error('Login error:', error);

    // Log failed login attempt
    const adminDb = getAdminDb();
    const auditEntry = createAuditLogEntry('unknown', 'LOGIN_FAILED', 'auth', {
      ip: clientIP,
      userAgent: request.headers.get('user-agent') || undefined,
      success: false,
      details: { error: 'Authentication failed' },
    });
    await adminDb.collection('auditLogs').add(auditEntry).catch(() => {});

    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
