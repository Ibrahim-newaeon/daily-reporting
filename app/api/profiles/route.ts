import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';
import { CreateProfileSchema, ReportProfile } from '@/lib/types';
import { generateId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const adminDb = getAdminDb();
    const profilesRef = adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles');

    const snapshot = await profilesRef.orderBy('createdAt', 'desc').get();

    const profiles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      data: { profiles },
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Validate input
    const validationResult = CreateProfileSchema.safeParse(body);
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

    const now = new Date();
    const profileId = generateId('profile');

    const profile: Omit<ReportProfile, 'id'> = {
      userId: authResult.userId!,
      name: validationResult.data.name,
      description: validationResult.data.description,
      isActive: validationResult.data.isActive ?? true,
      platforms: validationResult.data.platforms,
      metrics: [],
      charts: [],
      schedule: {
        enabled: false,
        frequency: 'daily',
        time: '08:00',
        timezone: 'UTC',
      },
      whatsappRecipients: [],
      createdAt: now,
      updatedAt: now,
    };

    const adminDb = getAdminDb();
    await adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles')
      .doc(profileId)
      .set(profile);

    return NextResponse.json({
      success: true,
      data: { profile: { id: profileId, ...profile } },
      message: 'Profile created successfully',
    });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
