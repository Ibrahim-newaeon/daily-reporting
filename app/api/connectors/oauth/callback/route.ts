import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAdminAuth, getAdminDb } from '@/lib/firebase';
import { Platform, OAuthTokens } from '@/lib/types';

async function exchangeCodeForTokens(
  platform: Platform,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  let tokenUrl: string;
  let params: Record<string, string>;

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

    default:
      throw new Error('Unsupported platform');
  }

  const response = await axios.post(tokenUrl, new URLSearchParams(params), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    platform = stateData.platform;
    returnUrl = stateData.returnUrl || '/connectors';
  } catch {
    return NextResponse.redirect(
      new URL('/connectors?error=invalid_state', request.url)
    );
  }

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

    // Update user's connected accounts in Firestore
    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(userId).update({
      [`connectedAccounts.${platform}`]: {
        connected: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
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
