import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';
import { checkRateLimit, RateLimits } from '@/lib/security';

// Maximum allowed limit to prevent abuse
const MAX_LIMIT = 100;

// Valid status values for filtering
const VALID_STATUSES = ['pending', 'generating', 'success', 'failed'];

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  // Apply rate limiting
  const rateLimit = checkRateLimit(
    `reports:${authResult.userId}`,
    RateLimits.API_READ.limit,
    RateLimits.API_READ.windowMs
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
        }
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const requestedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');

    // Validate and cap the limit to prevent abuse
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Verify profile ownership if profileId is provided
    if (profileId) {
      const profileDoc = await adminDb
        .collection('users')
        .doc(authResult.userId!)
        .collection('reportProfiles')
        .doc(profileId)
        .get();

      if (!profileDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'Profile not found or access denied' },
          { status: 403 }
        );
      }
    }

    let query = adminDb
      .collection('generatedReports')
      .where('userId', '==', authResult.userId!)
      .orderBy('generatedAt', 'desc')
      .limit(limit);

    if (profileId) {
      query = query.where('profileId', '==', profileId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();

    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      data: { reports },
    }, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
