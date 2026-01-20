import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';
import { UpdateProfileSchema } from '@/lib/types';

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
    const profileDoc = await adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles')
      .doc(id)
      .get();

    if (!profileDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { profile: { id: profileDoc.id, ...profileDoc.data() } },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id } = context.params;
    const body = await request.json();

    // Validate input
    const validationResult = UpdateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const profileRef = adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles')
      .doc(id);

    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const updates = {
      ...validationResult.data,
      updatedAt: new Date(),
    };

    await profileRef.update(updates);

    const updatedDoc = await profileRef.get();

    return NextResponse.json({
      success: true,
      data: { profile: { id: updatedDoc.id, ...updatedDoc.data() } },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  // Handle partial updates (same as PUT)
  return PUT(request, context);
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
    const profileRef = adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles')
      .doc(id);

    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    await profileRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Profile deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete profile' },
      { status: 500 }
    );
  }
}
