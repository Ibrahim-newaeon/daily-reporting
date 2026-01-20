import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id } = context.params;

    const adminDb = getAdminDb();
    const reportDoc = await adminDb.collection('generatedReports').doc(id).get();

    if (!reportDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    const report = reportDoc.data();

    // Verify ownership
    if (report?.userId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { report: { id: reportDoc.id, ...report } },
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id } = context.params;

    const adminDb = getAdminDb();
    const reportRef = adminDb.collection('generatedReports').doc(id);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    const report = reportDoc.data();

    // Verify ownership
    if (report?.userId !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    await reportRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
