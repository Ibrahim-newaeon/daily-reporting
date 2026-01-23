import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';
import { Platform, ConnectedAccounts } from '@/lib/types';

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
    const userDoc = await adminDb.collection('users').doc(authResult.userId!).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const connectedAccounts: ConnectedAccounts = userData?.connectedAccounts || {};

    // Build status for each platform
    const platforms: Platform[] = ['ga4', 'google_ads', 'meta', 'linkedin', 'tiktok', 'snapchat'];
    const status = platforms.map(platform => {
      const account = connectedAccounts[platform];
      const isConnected = account?.connected ?? false;
      const expiresAt = account?.expiresAt;
      const isExpired = expiresAt
        ? new Date(typeof expiresAt === 'object' && 'toDate' in expiresAt ? (expiresAt as { toDate: () => Date }).toDate() : expiresAt) < new Date()
        : false;

      return {
        platform,
        connected: isConnected,
        expired: isExpired,
        accountId: account?.accountId || null,
        accountName: account?.accountName || null,
        connectedAt: account?.connected ? (account as { connectedAt?: Date }).connectedAt : null,
        needsReauth: isConnected && isExpired,
      };
    });

    return NextResponse.json({
      success: true,
      data: { connectors: status },
    });
  } catch (error) {
    console.error('Error fetching connector status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connector status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as Platform;

    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'Platform is required' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(authResult.userId!).update({
      [`connectedAccounts.${platform}`]: {
        connected: false,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        accountId: null,
        accountName: null,
      },
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `${platform} disconnected successfully`,
    });
  } catch (error) {
    console.error('Error disconnecting platform:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect platform' },
      { status: 500 }
    );
  }
}
