import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase';
import { insertRows } from '@/lib/bigquery';
import { Platform, MetricRow, PlatformSchema } from '@/lib/types';
import { createGA4Client } from '@/lib/apis/ga4';
import { createGoogleAdsClient } from '@/lib/apis/google-ads';
import { createMetaAdsClient } from '@/lib/apis/meta-ads';
import { createLinkedInAdsClient } from '@/lib/apis/linkedin-ads';
import { createTikTokAdsClient } from '@/lib/apis/tiktok-ads';
import { createSnapAdsClient } from '@/lib/apis/snap-ads';
import { getDateRange } from '@/lib/utils';
import { checkRateLimit, RateLimits, decryptToken, isEncryptedToken } from '@/lib/security';

// Valid date range options
const VALID_DATE_RANGES = ['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth'] as const;

// Configure route segment for long-running sync operations
export const maxDuration = 120; // 120 second timeout for syncing multiple platforms
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  // Apply rate limiting for sync operations
  const rateLimit = checkRateLimit(
    `sync:${authResult.userId}`,
    RateLimits.DATA_SYNC.limit,
    RateLimits.DATA_SYNC.windowMs
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter || 60),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { platforms, dateRange = 'last7days', profileId } = body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one platform is required' },
        { status: 400 }
      );
    }

    // Validate date range
    if (!VALID_DATE_RANGES.includes(dateRange)) {
      return NextResponse.json(
        { success: false, error: `Invalid dateRange. Must be one of: ${VALID_DATE_RANGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate platforms
    const validPlatforms = platforms.filter((p: string) => PlatformSchema.safeParse(p).success);
    if (validPlatforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid platforms provided' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const userDoc = await adminDb.collection('users').doc(authResult.userId!).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const connectedAccounts = userData?.connectedAccounts || {};
    const { startDate, endDate } = getDateRange(dateRange);

    const results: { platform: Platform; success: boolean; rowCount?: number; error?: string }[] = [];
    const allMetrics: MetricRow[] = [];

    for (const platform of validPlatforms as Platform[]) {
      const account = connectedAccounts[platform];

      if (!account?.connected || !account?.accessToken) {
        results.push({
          platform,
          success: false,
          error: `${platform} is not connected`,
        });
        continue;
      }

      try {
        // Decrypt the access token if it's encrypted
        let accessToken = account.accessToken;
        if (account.tokenEncrypted || isEncryptedToken(account.accessToken)) {
          try {
            accessToken = decryptToken(account.accessToken);
          } catch (decryptError) {
            console.error(`Failed to decrypt token for ${platform}:`, decryptError);
            results.push({
              platform,
              success: false,
              error: 'Token decryption failed. Please reconnect your account.',
            });
            continue;
          }
        }

        // Decrypt refresh token if available and encrypted
        let refreshToken = account.refreshToken;
        if (refreshToken && (account.tokenEncrypted || isEncryptedToken(refreshToken))) {
          try {
            refreshToken = decryptToken(refreshToken);
          } catch {
            // Refresh token decryption failure is not critical
            refreshToken = undefined;
          }
        }

        let metrics: MetricRow[] = [];

        switch (platform) {
          case 'ga4': {
            const client = createGA4Client(accessToken, refreshToken);
            metrics = await client.getMetrics(
              account.propertyId || process.env.GA4_PROPERTY_ID || '',
              startDate,
              endDate
            );
            break;
          }

          case 'google_ads': {
            const client = createGoogleAdsClient(accessToken, account.accountId);
            metrics = await client.getCampaignMetrics(startDate, endDate);
            break;
          }

          case 'meta': {
            const client = createMetaAdsClient(accessToken, account.accountId || '');
            metrics = await client.getCampaignMetrics(startDate, endDate);
            break;
          }

          case 'linkedin': {
            const client = createLinkedInAdsClient(accessToken, account.accountId || '');
            metrics = await client.getCampaignMetrics(startDate, endDate);
            break;
          }

          case 'tiktok': {
            const client = createTikTokAdsClient(accessToken, account.accountId || '');
            metrics = await client.getCampaignMetrics(startDate, endDate);
            break;
          }

          case 'snapchat': {
            const client = createSnapAdsClient(
              accessToken,
              account.accountId || '',
              account.propertyId || '' // Using propertyId for organizationId
            );
            metrics = await client.getCampaignMetrics(startDate, endDate);
            break;
          }
        }

        // Add user and profile info to each metric
        const enrichedMetrics = metrics.map(m => ({
          ...m,
          user_id: authResult.userId,
          profile_id: profileId || 'default',
          synced_at: new Date().toISOString(),
        }));

        allMetrics.push(...enrichedMetrics);

        results.push({
          platform,
          success: true,
          rowCount: metrics.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          platform,
          success: false,
          error: errorMessage,
        });
      }
    }

    // Insert all metrics into BigQuery
    if (allMetrics.length > 0) {
      try {
        await insertRows('metrics', allMetrics);
      } catch (error) {
        console.error('BigQuery insert error:', error);
        // Don't fail the whole request, metrics were still fetched
      }
    }

    // Update last sync time
    await adminDb.collection('users').doc(authResult.userId!).update({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        totalRowsSynced: allMetrics.length,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync data' },
      { status: 500 }
    );
  }
}
