import axios from 'axios';
import { getAdminDb } from './firebase';
import { Platform, PlatformConnection } from './types';

interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Refreshes OAuth tokens for a platform
 */
export async function refreshPlatformToken(
  platform: Platform,
  refreshToken: string
): Promise<TokenRefreshResult> {
  try {
    switch (platform) {
      case 'ga4':
      case 'google_ads':
        return await refreshGoogleToken(refreshToken);
      case 'meta':
        return await refreshMetaToken(refreshToken);
      case 'linkedin':
        return await refreshLinkedInToken(refreshToken);
      default:
        return { success: false, error: 'Unknown platform' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    console.error(`Token refresh error for ${platform}:`, error);
    return { success: false, error: message };
  }
}

/**
 * Refreshes Google OAuth token (works for GA4 and Google Ads)
 */
async function refreshGoogleToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

  return {
    success: true,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token || refreshToken, // Google may not return new refresh token
    expiresAt,
  };
}

/**
 * Refreshes Meta (Facebook) OAuth token
 * Note: Meta long-lived tokens last ~60 days and need to be exchanged before expiry
 */
async function refreshMetaToken(currentToken: string): Promise<TokenRefreshResult> {
  // Meta uses token exchange rather than refresh tokens
  const response = await axios.get(
    'https://graph.facebook.com/v18.0/oauth/access_token',
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.NEXT_PUBLIC_META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: currentToken,
      },
    }
  );

  // Long-lived tokens typically last 60 days
  const expiresAt = new Date(Date.now() + (response.data.expires_in || 5184000) * 1000);

  return {
    success: true,
    accessToken: response.data.access_token,
    expiresAt,
  };
}

/**
 * Refreshes LinkedIn OAuth token
 */
async function refreshLinkedInToken(refreshToken: string): Promise<TokenRefreshResult> {
  const response = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

  return {
    success: true,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token || refreshToken,
    expiresAt,
  };
}

/**
 * Checks if a token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(expiresAt: Date | undefined): boolean {
  if (!expiresAt) return true;

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  return Date.now() >= expiry.getTime() - bufferMs;
}

/**
 * Gets a valid access token for a platform, refreshing if necessary
 */
export async function getValidAccessToken(
  userId: string,
  platform: Platform
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const adminDb = getAdminDb();
  const userDoc = await adminDb.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    console.error('User not found:', userId);
    return null;
  }

  const userData = userDoc.data();
  const connection: PlatformConnection = userData?.connectedAccounts?.[platform];

  if (!connection?.connected || !connection.accessToken) {
    console.error(`Platform ${platform} not connected for user ${userId}`);
    return null;
  }

  // Check if token is still valid
  if (!isTokenExpired(connection.expiresAt)) {
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
    };
  }

  // Token is expired, try to refresh
  console.log(`Token expired for ${platform}, refreshing...`);

  // Meta uses access token for refresh, others use refresh token
  const tokenToRefresh = platform === 'meta'
    ? connection.accessToken
    : connection.refreshToken;

  if (!tokenToRefresh) {
    console.error(`No refresh token available for ${platform}`);
    return null;
  }

  const refreshResult = await refreshPlatformToken(platform, tokenToRefresh);

  if (!refreshResult.success || !refreshResult.accessToken) {
    console.error(`Failed to refresh token for ${platform}:`, refreshResult.error);

    // Mark connection as needing re-auth
    await adminDb.collection('users').doc(userId).update({
      [`connectedAccounts.${platform}.expired`]: true,
      [`connectedAccounts.${platform}.needsReauth`]: true,
      updatedAt: new Date(),
    });

    return null;
  }

  // Update tokens in Firestore
  await adminDb.collection('users').doc(userId).update({
    [`connectedAccounts.${platform}.accessToken`]: refreshResult.accessToken,
    [`connectedAccounts.${platform}.refreshToken`]: refreshResult.refreshToken || connection.refreshToken,
    [`connectedAccounts.${platform}.expiresAt`]: refreshResult.expiresAt,
    [`connectedAccounts.${platform}.expired`]: false,
    [`connectedAccounts.${platform}.needsReauth`]: false,
    updatedAt: new Date(),
  });

  console.log(`Successfully refreshed token for ${platform}`);

  return {
    accessToken: refreshResult.accessToken,
    refreshToken: refreshResult.refreshToken,
  };
}

/**
 * Wraps an API call with automatic token refresh on 401 errors
 */
export async function withTokenRefresh<T>(
  userId: string,
  platform: Platform,
  apiCall: (accessToken: string) => Promise<T>
): Promise<T> {
  const tokens = await getValidAccessToken(userId, platform);

  if (!tokens) {
    throw new Error(`No valid token available for ${platform}`);
  }

  try {
    return await apiCall(tokens.accessToken);
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number } };

    // If unauthorized, try refreshing once more
    if (axiosError.response?.status === 401) {
      console.log(`Got 401 for ${platform}, forcing token refresh...`);

      const adminDb = getAdminDb();
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const connection = userDoc.data()?.connectedAccounts?.[platform];

      if (connection?.refreshToken) {
        const refreshResult = await refreshPlatformToken(
          platform,
          platform === 'meta' ? connection.accessToken : connection.refreshToken
        );

        if (refreshResult.success && refreshResult.accessToken) {
          // Update and retry
          await adminDb.collection('users').doc(userId).update({
            [`connectedAccounts.${platform}.accessToken`]: refreshResult.accessToken,
            [`connectedAccounts.${platform}.expiresAt`]: refreshResult.expiresAt,
            updatedAt: new Date(),
          });

          return await apiCall(refreshResult.accessToken);
        }
      }
    }

    throw error;
  }
}
