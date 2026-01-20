import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase';
import { createUser } from '@/lib/auth';
import {
  checkRateLimit,
  RateLimits,
  getClientIP,
  validatePassword,
  validateEmail,
} from '@/lib/security';

export async function POST(request: NextRequest) {
  // Apply strict rate limiting to prevent abuse
  const clientIP = getClientIP(request.headers);
  const rateLimit = checkRateLimit(
    `signup:${clientIP}`,
    RateLimits.AUTH_SIGNUP.limit,
    RateLimits.AUTH_SIGNUP.windowMs
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many signup attempts. Please try again later.',
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
    const { email, password, displayName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    });

    // Create user document in Firestore
    const user = await createUser(
      userRecord.uid,
      email,
      displayName || email.split('@')[0]
    );

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      },
      message: 'Account created successfully. Please sign in.',
    });
  } catch (error: unknown) {
    console.error('Signup error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle Firebase specific errors
    if (errorMessage.includes('email-already-exists')) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    if (errorMessage.includes('invalid-email')) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
