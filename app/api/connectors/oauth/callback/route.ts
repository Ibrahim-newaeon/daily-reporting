import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAdminAuth, getAdminDb } from '@/lib/firebase';
import { Platform, OAuthTokens } from '@/lib/types';
import { verifySignedState, encryptToken } from '@/lib/security';

async function exchangeCodeForTokens(
  platform: Platform,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  let tokenUrl: string;
  let params: Record<string, string>;
  let headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };

  switch (platform) {
    case 'ga4':
    case 'google_ads':
      tokenUrl = 'https://oauth2.googleapis.com/token';
      params = {
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      break;

    case 'meta':
      tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
      params = {
        code,
        client_id: process.env.NEXT_PUBLIC_META_APP_ID || '',
        client_secret: process.env.META_APP_SECRET || '',
        redirect_uri: redirectUri,
      };
      break;

    case 'linkedin':
      tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      params = {
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      break;

    case 'tiktok': {
      // TikTok uses a different token exchange endpoint
      tokenUrl = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
      const tiktokResponse = await axios.post(tokenUrl, {
        app_id: process.env.TIKTOK_APP_ID || '',
        secret: process.env.TIKTOK_APP_SECRET || '',
        auth_code: code,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (tiktokResponse.data.code !== 0) {
        throw new Error(tiktokResponse.data.message || 'TikTok token exchange failed');
      }

      return {
        accessToken: tiktokResponse.data.data.access_token,
        refreshToken: tiktokResponse.data.data.refresh_token,
        expiresIn: tiktokResponse.data.data.expires_in || 86400,
        tokenType: 'Bearer',
        scope: tiktokResponse.data.data.scope,
      };
    }

    case 'snapchat':
      tokenUrl = 'https://accounts.snapchat.com/login/oauth2/access_token';
      params = {
        code,
        client_id: process.env.SNAP_CLIENT_ID || '',
        client_secret: process.env.SNAP_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      break;

    default:
      throw new Error('Unsupported platform');
  }

  const response = await axios.post(tokenUrl, new URLSearchParams(params), {
    headers,
  });

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in || 3600,
    tokenType: response.data.token_type || 'Bearer',
    scope: response.data.scope,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/connectors?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/connectors?error=missing_params', request.url)
    );
  }

  let platform: Platform;
  let returnUrl: string;

  // Verify the cryptographically signed state parameter
  const stateData = verifySignedState(state);
  if (!stateData) {
    console.error('Invalid or expired OAuth state parameter');
    return NextResponse.redirect(
      new URL('/connectors?error=invalid_state', request.url)
    );
  }

  platform = stateData.platform as Platform;
  returnUrl = (stateData.returnUrl as string) || '/connectors';

  try {
    // Get user from session cookie
    const sessionCookie = request.cookies.get('auth-token')?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(
        new URL('/login?returnUrl=/connectors', request.url)
      );
    }

    const adminAuth = getAdminAuth();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    const userId = decodedClaims.sub;

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/oauth/callback`;
    const tokens = await exchangeCodeForTokens(platform, code, redirectUri);

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Encrypt tokens before storing in database
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;

    // Update user's connected accounts in Firestore with encrypted tokens
    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(userId).update({
      [`connectedAccounts.${platform}`]: {
        connected: true,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenEncrypted: true, // Flag to indicate tokens are encrypted
        expiresAt,
        connectedAt: new Date(),
      },
      updatedAt: new Date(),
    });

    return NextResponse.redirect(
      new URL(`${returnUrl}?success=${platform}`, request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/connectors?error=token_exchange_failed&platform=${platform}`, request.url)
    );
  }
}
