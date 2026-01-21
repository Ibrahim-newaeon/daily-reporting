import { NextRequest, NextResponse } from 'next/server';
import { Platform } from '@/lib/types';
import { createSignedState } from '@/lib/security';

const OAUTH_CONFIGS: Record<Platform, {
  authUrl: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}> = {
  ga4: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics',
    ],
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  google_ads: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  meta: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scopes: [
      'ads_management',
      'ads_read',
      'business_management',
      'pages_read_engagement',
    ],
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: [
      'r_ads',
      'r_ads_reporting',
      'r_organization_social',
    ],
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') as Platform;
  const returnUrl = searchParams.get('returnUrl') || '/connectors';

  if (!platform || !OAUTH_CONFIGS[platform]) {
    return NextResponse.json(
      { success: false, error: 'Invalid platform specified' },
      { status: 400 }
    );
  }

  const config = OAUTH_CONFIGS[platform];
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/oauth/callback`;

  // Create cryptographically signed state parameter to prevent CSRF attacks
  // State expires after 10 minutes
  const state = createSignedState({ platform, returnUrl }, 600000);

  // Build OAuth URL based on platform
  let authUrl: URL;

  if (platform === 'ga4' || platform === 'google_ads') {
    authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);

    if (config.additionalParams) {
      Object.entries(config.additionalParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }
  } else if (platform === 'meta') {
    authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(','));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
  } else if (platform === 'linkedin') {
    authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
  } else {
    return NextResponse.json(
      { success: false, error: 'Unsupported platform' },
      { status: 400 }
    );
  }

  return NextResponse.redirect(authUrl.toString());
}
