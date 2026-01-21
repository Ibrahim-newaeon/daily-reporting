import { NextRequest, NextResponse } from 'next/server';
import { Platform, PlatformSchema } from '@/lib/types';
import { createSignedState } from '@/lib/security';

/**
 * Validate return URL to prevent open redirect attacks
 * Only allows relative paths starting with /
 */
function validateReturnUrl(url: string): string {
  // Only allow relative paths that start with /
  if (!url || typeof url !== 'string') {
    return '/connectors';
  }

  // Remove any protocol or domain attempts
  const sanitized = url.trim();

  // Must start with / and not contain protocol markers
  if (!sanitized.startsWith('/') ||
      sanitized.startsWith('//') ||
      sanitized.includes('://') ||
      sanitized.includes('\\')) {
    return '/connectors';
  }

  // Ensure it's a valid path (no null bytes, etc.)
  try {
    const decoded = decodeURIComponent(sanitized);
    if (decoded.includes('\0') || decoded !== sanitized.replace(/%[0-9A-Fa-f]{2}/g, '')) {
      return '/connectors';
    }
  } catch {
    return '/connectors';
  }

  return sanitized;
}

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
  tiktok: {
    authUrl: 'https://business-api.tiktok.com/portal/auth',
    scopes: [
      'ad.read',
      'ad.management',
      'report.read',
      'user.info.basic',
    ],
  },
  snapchat: {
    authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
    scopes: [
      'snapchat-marketing-api',
      'snapchat-marketing-api-ads-read',
      'snapchat-marketing-api-organizations-read',
    ],
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platformParam = searchParams.get('platform');
  const returnUrlParam = searchParams.get('returnUrl') || '/connectors';

  // Validate platform using Zod schema
  const platformResult = PlatformSchema.safeParse(platformParam);
  if (!platformResult.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid platform specified' },
      { status: 400 }
    );
  }

  const platform = platformResult.data;

  // Validate return URL to prevent open redirect attacks
  const returnUrl = validateReturnUrl(returnUrlParam);

  if (!OAUTH_CONFIGS[platform]) {
    return NextResponse.json(
      { success: false, error: 'Unsupported platform' },
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
  } else if (platform === 'tiktok') {
    authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('app_id', process.env.TIKTOK_APP_ID || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    // TikTok uses comma-separated scopes
    authUrl.searchParams.set('scope', config.scopes.join(','));
  } else if (platform === 'snapchat') {
    authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', process.env.SNAP_CLIENT_ID || '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
  } else {
    return NextResponse.json(
      { success: false, error: 'Unsupported platform' },
      { status: 400 }
    );
  }

  return NextResponse.redirect(authUrl.toString());
}
