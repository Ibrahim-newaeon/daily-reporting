import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase';
import { createUser, getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idToken = searchParams.get('idToken');
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  if (!idToken) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Check if user exists, create if not
    let user = await getUser(decodedToken.uid);
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

    const response = NextResponse.redirect(new URL(returnUrl, request.url));

    response.cookies.set('auth-token', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, returnUrl = '/dashboard' } = body;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Check if user exists, create if not
    let user = await getUser(decodedToken.uid);
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
      data: { user, returnUrl },
    });

    response.cookies.set('auth-token', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
