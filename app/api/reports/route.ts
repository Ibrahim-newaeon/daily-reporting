import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');

    const adminDb = getAdminDb();
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
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
