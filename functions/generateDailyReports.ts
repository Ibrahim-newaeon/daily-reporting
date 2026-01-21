import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import axios from 'axios';
import * as crypto from 'crypto';

// ============================================================================
// TOKEN ENCRYPTION (mirrors lib/security.ts for Cloud Functions)
// ============================================================================
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Validate date format to prevent injection attacks in GAQL queries
 */
function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }
  return true;
}

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  // Check if token is already plaintext (for backwards compatibility)
  const parts = encryptedToken.split(':');
  if (parts.length !== 3 || parts[0].length !== 32) {
    return encryptedToken; // Return as-is if not encrypted format
  }

  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedData] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = new Storage();

// Token refresh configuration
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const META_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const TIKTOK_TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/';
const SNAP_TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface PlatformConnection {
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  propertyId?: string;
}

interface ReportProfile {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  platforms: string[];
  whatsappRecipients: Array<{
    id: string;
    name: string;
    number: string;
    isActive: boolean;
  }>;
  schedule: {
    enabled: boolean;
    frequency: string;
    time: string;
    timezone: string;
  };
}

interface MetricData {
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

// Cloud Function triggered by Cloud Scheduler
export const generateDailyReports = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
  })
  .pubsub.schedule('0 8 * * *') // Run at 8 AM UTC daily
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting daily report generation at:', new Date().toISOString());

    try {
      // Get all active profiles with enabled schedules
      const profilesSnapshot = await db
        .collectionGroup('reportProfiles')
        .where('isActive', '==', true)
        .where('schedule.enabled', '==', true)
        .get();

      console.log(`Found ${profilesSnapshot.size} profiles to process`);

      let succeeded = 0;
      let failed = 0;

      for (const profileDoc of profilesSnapshot.docs) {
        try {
          const profile = { id: profileDoc.id, ...profileDoc.data() } as ReportProfile;

          // Check if it's time to generate based on schedule
          if (!shouldGenerateNow(profile.schedule)) {
            continue;
          }

          console.log(`Processing profile: ${profile.name} (${profile.id})`);

          await generateReportForProfile(profile);
          succeeded++;
        } catch (error) {
          console.error(`Error processing profile ${profileDoc.id}:`, error);
          failed++;
        }
      }

      console.log(`Report generation complete. Succeeded: ${succeeded}, Failed: ${failed}`);
      return { succeeded, failed };
    } catch (error) {
      console.error('Fatal error in generateDailyReports:', error);
      throw error;
    }
  });

// HTTP trigger for manual report generation
export const generateReportHttp = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '2GB',
  })
  .https.onRequest(async (req, res) => {
    // Verify authorization with proper token validation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
      return;
    }

    // Extract and verify the Firebase ID token
    const idToken = authHeader.substring(7);
    let authenticatedUserId: string;

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      authenticatedUserId = decodedToken.uid;
    } catch (authError) {
      console.error('Token verification failed:', authError);
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      return;
    }

    try {
      const { profileId, userId } = req.body;

      if (!profileId || !userId) {
        res.status(400).json({ error: 'Missing profileId or userId' });
        return;
      }

      // Verify the authenticated user matches the requested userId
      if (authenticatedUserId !== userId) {
        res.status(403).json({ error: 'Forbidden: Cannot generate reports for other users' });
        return;
      }

      const profileDoc = await db
        .collection('users')
        .doc(userId)
        .collection('reportProfiles')
        .doc(profileId)
        .get();

      if (!profileDoc.exists) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const profile = { id: profileDoc.id, ...profileDoc.data() } as ReportProfile;
      const result = await generateReportForProfile(profile);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

function shouldGenerateNow(schedule: ReportProfile['schedule']): boolean {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  // Check if current hour matches schedule time (with 1 hour tolerance)
  if (Math.abs(now.getUTCHours() - hours) > 1) {
    return false;
  }

  if (schedule.frequency === 'daily') {
    return true;
  }

  if (schedule.frequency === 'weekly') {
    // Run on Mondays (day 1)
    return now.getUTCDay() === 1;
  }

  if (schedule.frequency === 'monthly') {
    // Run on the 1st of each month
    return now.getUTCDate() === 1;
  }

  return false;
}

async function generateReportForProfile(profile: ReportProfile): Promise<{
  reportId: string;
  pdfUrl: string;
}> {
  const userId = profile.userId;
  const now = new Date();

  // Get user data
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (!userData) {
    throw new Error('User not found');
  }

  // Fetch metrics from all connected platforms
  const metrics = await fetchMetricsFromPlatforms(
    userData.connectedAccounts || {},
    profile.platforms,
    userId
  );

  // Calculate totals
  const totals = calculateTotals(metrics);

  // Generate HTML report
  const htmlContent = generateReportHtml(profile.name, totals, metrics, now);

  // Generate PDF
  const pdfBuffer = await generatePdf(htmlContent);

  // Upload to Cloud Storage
  const bucket = storage.bucket(process.env.GCS_BUCKET || 'marketing-reports-bucket');
  const filename = `reports/${userId}/${profile.id}/${now.getTime()}.pdf`;
  const file = bucket.file(filename);

  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      cacheControl: 'private, max-age=31536000',
    },
  });

  // Get signed URL
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Create report record
  const reportId = db.collection('generatedReports').doc().id;
  await db.collection('generatedReports').doc(reportId).set({
    profileId: profile.id,
    userId,
    generatedAt: now,
    pdfUrl: signedUrl,
    status: 'success',
    metrics: totals,
  });

  // Send WhatsApp notifications
  if (profile.whatsappRecipients?.length > 0) {
    await sendWhatsAppNotifications(
      profile.whatsappRecipients,
      signedUrl,
      profile.name,
      totals,
      reportId
    );
  }

  return { reportId, pdfUrl: signedUrl };
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  backoffMs: number = INITIAL_BACKOFF_MS
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    const axiosError = error as { response?: { status?: number } };
    // Don't retry on auth errors (401, 403)
    if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
      throw error;
    }

    console.log(`Retrying after ${backoffMs}ms, ${retries} retries left`);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    return retryWithBackoff(fn, retries - 1, backoffMs * 2);
  }
}

/**
 * Refresh Google OAuth token
 */
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh Google token:', error);
    return null;
  }
}

/**
 * Refresh Meta token (exchange for long-lived token)
 */
async function refreshMetaToken(accessToken: string): Promise<string | null> {
  try {
    const response = await axios.get(META_TOKEN_URL, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: accessToken,
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh Meta token:', error);
    return null;
  }
}

/**
 * Refresh LinkedIn OAuth token
 */
async function refreshLinkedInToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await axios.post(LINKEDIN_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh LinkedIn token:', error);
    return null;
  }
}

/**
 * Refresh TikTok OAuth token
 */
async function refreshTikTokToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await axios.post(TIKTOK_TOKEN_URL, {
      app_id: process.env.TIKTOK_APP_ID || '',
      secret: process.env.TIKTOK_APP_SECRET || '',
      refresh_token: refreshToken,
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.code !== 0) {
      console.error('TikTok token refresh failed:', response.data.message);
      return null;
    }

    return response.data.data.access_token;
  } catch (error) {
    console.error('Failed to refresh TikTok token:', error);
    return null;
  }
}

/**
 * Refresh Snapchat OAuth token
 */
async function refreshSnapToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await axios.post(SNAP_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SNAP_CLIENT_ID || '',
      client_secret: process.env.SNAP_CLIENT_SECRET || '',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh Snap token:', error);
    return null;
  }
}

/**
 * Fetch GA4 metrics using the Data API v1beta
 */
async function fetchGA4Metrics(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  const response = await axios.post(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
    },
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  const row = response.data.rows?.[0];
  const values = row?.metricValues || [];

  return {
    platform: 'ga4',
    spend: 0, // GA4 doesn't track ad spend
    impressions: parseInt(values[2]?.value || '0', 10), // screenPageViews
    clicks: parseInt(values[1]?.value || '0', 10), // totalUsers
    conversions: parseFloat(values[3]?.value || '0'),
    conversionValue: parseFloat(values[4]?.value || '0'),
  };
}

/**
 * Fetch Google Ads metrics
 */
async function fetchGoogleAdsMetrics(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  // Validate date formats to prevent GAQL injection
  validateDateFormat(startDate);
  validateDateFormat(endDate);

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `;

  const response = await axios.post(
    `https://googleads.googleapis.com/v15/customers/${customerId.replace(/-/g, '')}/googleAds:search`,
    { query },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json',
      },
    }
  );

  const result = response.data.results?.[0]?.metrics || {};

  return {
    platform: 'google_ads',
    spend: (parseInt(result.costMicros || '0', 10)) / 1000000,
    impressions: parseInt(result.impressions || '0', 10),
    clicks: parseInt(result.clicks || '0', 10),
    conversions: parseFloat(result.conversions || '0'),
    conversionValue: parseFloat(result.conversionsValue || '0'),
  };
}

/**
 * Fetch Meta Ads metrics
 */
async function fetchMetaAdsMetrics(
  accessToken: string,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/act_${accountId.replace('act_', '')}/insights`,
    {
      params: {
        access_token: accessToken,
        fields: 'spend,impressions,clicks,actions,action_values',
        time_range: JSON.stringify({ since: startDate, until: endDate }),
      },
    }
  );

  const data = response.data.data?.[0] || {};

  // Extract conversions from actions
  let conversions = 0;
  let conversionValue = 0;
  const conversionTypes = ['purchase', 'lead', 'complete_registration'];

  if (Array.isArray(data.actions)) {
    for (const action of data.actions) {
      if (conversionTypes.includes(action.action_type)) {
        conversions += parseFloat(action.value || '0');
      }
    }
  }

  if (Array.isArray(data.action_values)) {
    const purchaseValue = data.action_values.find(
      (av: { action_type: string }) => av.action_type === 'purchase' || av.action_type === 'omni_purchase'
    );
    if (purchaseValue) {
      conversionValue = parseFloat(purchaseValue.value || '0');
    }
  }

  return {
    platform: 'meta',
    spend: parseFloat(data.spend || '0'),
    impressions: parseInt(data.impressions || '0', 10),
    clicks: parseInt(data.clicks || '0', 10),
    conversions,
    conversionValue,
  };
}

/**
 * Fetch LinkedIn Ads metrics
 */
async function fetchLinkedInAdsMetrics(
  accessToken: string,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  const start = startDate.replace(/-/g, '');
  const end = endDate.replace(/-/g, '');

  const response = await axios.get(
    'https://api.linkedin.com/rest/adAnalytics',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-RestLi-Protocol-Version': '2.0.0',
      },
      params: {
        q: 'analytics',
        pivot: 'ACCOUNT',
        dateRange: JSON.stringify({
          start: {
            year: parseInt(start.slice(0, 4), 10),
            month: parseInt(start.slice(4, 6), 10),
            day: parseInt(start.slice(6, 8), 10),
          },
          end: {
            year: parseInt(end.slice(0, 4), 10),
            month: parseInt(end.slice(4, 6), 10),
            day: parseInt(end.slice(6, 8), 10),
          },
        }),
        accounts: `urn:li:sponsoredAccount:${accountId}`,
        fields: 'impressions,clicks,costInUsd,externalWebsiteConversions,conversionValueInLocalCurrency',
      },
    }
  );

  const data = response.data.elements?.[0] || {};

  return {
    platform: 'linkedin',
    spend: parseFloat(data.costInUsd || '0'),
    impressions: parseInt(data.impressions || '0', 10),
    clicks: parseInt(data.clicks || '0', 10),
    conversions: parseInt(data.externalWebsiteConversions || '0', 10),
    conversionValue: parseFloat(data.conversionValueInLocalCurrency || '0'),
  };
}

/**
 * Fetch TikTok Ads metrics
 */
async function fetchTikTokAdsMetrics(
  accessToken: string,
  advertiserId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  const response = await axios.get(
    'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
    {
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      params: {
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        data_level: 'AUCTION_ADVERTISER',
        dimensions: JSON.stringify(['advertiser_id']),
        metrics: JSON.stringify([
          'spend',
          'impressions',
          'clicks',
          'conversion',
          'complete_payment',
          'complete_payment_value',
        ]),
        start_date: startDate,
        end_date: endDate,
      },
    }
  );

  if (response.data.code !== 0) {
    throw new Error(response.data.message || 'TikTok API error');
  }

  const data = response.data.data?.list?.[0]?.metrics || {};

  return {
    platform: 'tiktok',
    spend: parseFloat(data.spend || '0'),
    impressions: parseInt(data.impressions || '0', 10),
    clicks: parseInt(data.clicks || '0', 10),
    conversions: parseInt(data.conversion || '0', 10) + parseInt(data.complete_payment || '0', 10),
    conversionValue: parseFloat(data.complete_payment_value || '0'),
  };
}

/**
 * Fetch Snapchat Ads metrics
 */
async function fetchSnapAdsMetrics(
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<MetricData> {
  const response = await axios.get(
    `https://adsapi.snapchat.com/v1/adaccounts/${adAccountId}/stats`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        granularity: 'TOTAL',
        start_time: `${startDate}T00:00:00.000Z`,
        end_time: `${endDate}T23:59:59.999Z`,
        fields: 'impressions,swipes,spend,conversion_purchases,conversion_purchases_value,conversion_add_cart,conversion_sign_ups',
      },
    }
  );

  const stats = response.data.total_stats?.[0]?.stats || {};

  // Snap uses "swipes" as clicks and returns spend in micro-currency
  const conversions = parseInt(stats.conversion_purchases || '0', 10) +
                     parseInt(stats.conversion_add_cart || '0', 10) +
                     parseInt(stats.conversion_sign_ups || '0', 10);

  return {
    platform: 'snapchat',
    spend: parseFloat(stats.spend || '0') / 1000000, // Convert micro-currency
    impressions: parseInt(stats.impressions || '0', 10),
    clicks: parseInt(stats.swipes || '0', 10),
    conversions,
    conversionValue: parseFloat(stats.conversion_purchases_value || '0') / 1000000,
  };
}

/**
 * Update user's token in Firestore after refresh
 * Tokens are encrypted before storage for security
 */
async function updateUserToken(
  userId: string,
  platform: string,
  newAccessToken: string,
  newRefreshToken?: string
): Promise<void> {
  // Encrypt the access token before storing
  const encryptedAccessToken = encryptToken(newAccessToken);

  const updateData: Record<string, unknown> = {
    [`connectedAccounts.${platform}.accessToken`]: encryptedAccessToken,
    [`connectedAccounts.${platform}.tokenEncrypted`]: true,
    [`connectedAccounts.${platform}.updatedAt`]: new Date(),
  };

  // Also encrypt and update refresh token if provided
  if (newRefreshToken) {
    updateData[`connectedAccounts.${platform}.refreshToken`] = encryptToken(newRefreshToken);
  }

  await db.collection('users').doc(userId).update(updateData);
}

/**
 * Mark a platform as needing re-authentication
 */
async function markPlatformNeedsReauth(
  userId: string,
  platform: string
): Promise<void> {
  await db.collection('users').doc(userId).update({
    [`connectedAccounts.${platform}.needsReauth`]: true,
    [`connectedAccounts.${platform}.expired`]: true,
  });
}

async function fetchMetricsFromPlatforms(
  connectedAccounts: Record<string, PlatformConnection>,
  platforms: string[],
  userId: string
): Promise<MetricData[]> {
  const metrics: MetricData[] = [];
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  for (const platform of platforms) {
    const account = connectedAccounts[platform];
    if (!account?.connected || !account.accessToken) {
      console.log(`Skipping ${platform}: not connected or missing token`);
      continue;
    }

    // Decrypt the access token if it's encrypted
    let accessToken: string;
    try {
      accessToken = decryptToken(account.accessToken);
    } catch (decryptError) {
      console.error(`Failed to decrypt token for ${platform}:`, decryptError);
      continue;
    }

    // Also decrypt refresh token if available
    let refreshToken: string | undefined;
    if (account.refreshToken) {
      try {
        refreshToken = decryptToken(account.refreshToken);
      } catch {
        // Refresh token might be in old format, use as-is
        refreshToken = account.refreshToken;
      }
    }

    try {
      // Try to fetch metrics with current token
      let platformMetrics: MetricData;

      const fetchFn = async () => {
        switch (platform) {
          case 'ga4':
            if (!account.propertyId) throw new Error('GA4 property ID not configured');
            return fetchGA4Metrics(accessToken, account.propertyId, startDateStr, endDateStr);

          case 'google_ads':
            if (!account.accountId) throw new Error('Google Ads customer ID not configured');
            return fetchGoogleAdsMetrics(accessToken, account.accountId, startDateStr, endDateStr);

          case 'meta':
            if (!account.accountId) throw new Error('Meta ad account ID not configured');
            return fetchMetaAdsMetrics(accessToken, account.accountId, startDateStr, endDateStr);

          case 'linkedin':
            if (!account.accountId) throw new Error('LinkedIn ad account ID not configured');
            return fetchLinkedInAdsMetrics(accessToken, account.accountId, startDateStr, endDateStr);

          case 'tiktok':
            if (!account.accountId) throw new Error('TikTok advertiser ID not configured');
            return fetchTikTokAdsMetrics(accessToken, account.accountId, startDateStr, endDateStr);

          case 'snapchat':
            if (!account.accountId) throw new Error('Snapchat ad account ID not configured');
            return fetchSnapAdsMetrics(accessToken, account.accountId, startDateStr, endDateStr);

          default:
            throw new Error(`Unknown platform: ${platform}`);
        }
      };

      try {
        platformMetrics = await retryWithBackoff(fetchFn);
      } catch (error) {
        const axiosError = error as { response?: { status?: number } };

        // If unauthorized, try refreshing the token
        if (axiosError.response?.status === 401) {
          console.log(`Token expired for ${platform}, attempting refresh...`);

          let newToken: string | null = null;

          switch (platform) {
            case 'ga4':
            case 'google_ads':
              if (refreshToken) {
                newToken = await refreshGoogleToken(refreshToken);
              }
              break;
            case 'meta':
              newToken = await refreshMetaToken(accessToken);
              break;
            case 'linkedin':
              if (refreshToken) {
                newToken = await refreshLinkedInToken(refreshToken);
              }
              break;
            case 'tiktok':
              if (refreshToken) {
                newToken = await refreshTikTokToken(refreshToken);
              }
              break;
            case 'snapchat':
              if (refreshToken) {
                newToken = await refreshSnapToken(refreshToken);
              }
              break;
          }

          if (newToken) {
            accessToken = newToken;
            await updateUserToken(userId, platform, newToken);
            console.log(`Successfully refreshed token for ${platform}`);

            // Retry with new token
            platformMetrics = await retryWithBackoff(fetchFn);
          } else {
            await markPlatformNeedsReauth(userId, platform);
            throw new Error(`Failed to refresh token for ${platform}`);
          }
        } else {
          throw error;
        }
      }

      metrics.push(platformMetrics);
      console.log(`Successfully fetched metrics for ${platform}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error fetching metrics for ${platform}:`, errorMessage);

      // Add zero metrics for failed platforms to maintain reporting consistency
      metrics.push({
        platform,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversionValue: 0,
      });
    }
  }

  return metrics;
}

function calculateTotals(metrics: MetricData[]) {
  const totals = {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
    roas: 0,
    byPlatform: metrics,
  };

  for (const m of metrics) {
    totals.totalSpend += m.spend;
    totals.totalImpressions += m.impressions;
    totals.totalClicks += m.clicks;
    totals.totalConversions += m.conversions;
    totals.totalRevenue += m.conversionValue;
  }

  totals.roas = totals.totalSpend > 0 ? totals.totalRevenue / totals.totalSpend : 0;

  return totals;
}

function generateReportHtml(
  profileName: string,
  totals: ReturnType<typeof calculateTotals>,
  metrics: MetricData[],
  generatedAt: Date
): string {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatNumber = (n: number) => n.toLocaleString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${profileName} - Marketing Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 40px; background: #fff; }
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #1e40af; margin-bottom: 8px; }
    .header .date { color: #6b7280; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: linear-gradient(135deg, #f8fafc, #e2e8f0); padding: 24px; border-radius: 12px; text-align: center; }
    .summary-card .label { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px; }
    .summary-card .value { font-size: 28px; font-weight: 700; color: #1e40af; }
    .section { margin-top: 30px; }
    .section h2 { font-size: 20px; margin-bottom: 16px; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b; }
    td { font-size: 14px; }
    tr:hover { background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${profileName}</h1>
    <div class="date">Generated: ${generatedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Spend</div>
      <div class="value">${formatCurrency(totals.totalSpend)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Conversions</div>
      <div class="value">${formatNumber(totals.totalConversions)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Revenue</div>
      <div class="value">${formatCurrency(totals.totalRevenue)}</div>
    </div>
    <div class="summary-card">
      <div class="label">ROAS</div>
      <div class="value">${totals.roas.toFixed(2)}x</div>
    </div>
  </div>

  <div class="section">
    <h2>Platform Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th>Spend</th>
          <th>Impressions</th>
          <th>Clicks</th>
          <th>CTR</th>
          <th>Conversions</th>
          <th>ROAS</th>
        </tr>
      </thead>
      <tbody>
        ${metrics.map(m => {
          const ctr = m.impressions > 0 ? (m.clicks / m.impressions * 100) : 0;
          const roas = m.spend > 0 ? (m.conversionValue / m.spend) : 0;
          return `
            <tr>
              <td>${getPlatformDisplayName(m.platform)}</td>
              <td>${formatCurrency(m.spend)}</td>
              <td>${formatNumber(m.impressions)}</td>
              <td>${formatNumber(m.clicks)}</td>
              <td>${ctr.toFixed(2)}%</td>
              <td>${formatNumber(m.conversions)}</td>
              <td>${roas.toFixed(2)}x</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Marketing Dashboard SaaS - Automated Report
  </div>
</body>
</html>
  `;
}

function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    ga4: 'Google Analytics 4',
    google_ads: 'Google Ads',
    meta: 'Meta Ads',
    linkedin: 'LinkedIn Ads',
    tiktok: 'TikTok Ads',
    snapchat: 'Snapchat Ads',
  };
  return names[platform] || platform;
}

async function generatePdf(htmlContent: string): Promise<Buffer> {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function sendWhatsAppNotifications(
  recipients: ReportProfile['whatsappRecipients'],
  pdfUrl: string,
  profileName: string,
  totals: ReturnType<typeof calculateTotals>,
  reportId: string
): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !accessToken) {
    console.warn('WhatsApp credentials not configured');
    return;
  }

  const deliveries: Array<{
    recipientId: string;
    recipientNumber: string;
    status: string;
    sentAt?: Date;
    error?: string;
  }> = [];

  for (const recipient of recipients) {
    if (!recipient.isActive) continue;

    try {
      // Send summary message
      const summaryMessage =
        `📊 *${profileName}*\n\n` +
        `💰 Total Spend: $${totals.totalSpend.toFixed(2)}\n` +
        `🎯 Conversions: ${totals.totalConversions}\n` +
        `📈 ROAS: ${totals.roas.toFixed(2)}x\n\n` +
        `Your detailed report is attached below. 👇`;

      const fetch = (await import('node-fetch')).default;

      // Send text message
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient.number.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: summaryMessage },
        }),
      });

      // Send PDF
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient.number.replace(/[^0-9]/g, ''),
          type: 'document',
          document: {
            link: pdfUrl,
            caption: `${profileName} - ${new Date().toLocaleDateString()}`,
            filename: `${profileName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          },
        }),
      });

      deliveries.push({
        recipientId: recipient.id,
        recipientNumber: recipient.number,
        status: 'sent',
        sentAt: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      deliveries.push({
        recipientId: recipient.id,
        recipientNumber: recipient.number,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  // Update report with delivery status
  await db.collection('generatedReports').doc(reportId).update({ deliveries });
}
