import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('auth-token')?.value;

    if (sessionCookie) {
      try {
        const adminAuth = getAdminAuth();
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
        await adminAuth.revokeRefreshTokens(decodedClaims.sub);
      } catch (error) {
        // Cookie might be invalid, but we still want to clear it
        console.error('Error revoking session:', error);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear the session cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);

    // Still clear the cookie even if there's an error
    const response = NextResponse.json({
      success: true,
      message: 'Logged out',
    });

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  }
}

export async function GET(request: NextRequest) {
  // Redirect to login page after logout
  const response = NextResponse.redirect(new URL('/login', request.url));

  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
