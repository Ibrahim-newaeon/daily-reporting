import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = new Storage();

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
    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const { profileId, userId } = req.body;

      if (!profileId || !userId) {
        res.status(400).json({ error: 'Missing profileId or userId' });
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
    profile.platforms
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

async function fetchMetricsFromPlatforms(
  connectedAccounts: Record<string, PlatformConnection>,
  platforms: string[]
): Promise<MetricData[]> {
  const metrics: MetricData[] = [];
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const platform of platforms) {
    const account = connectedAccounts[platform];
    if (!account?.connected || !account.accessToken) {
      continue;
    }

    try {
      // In production, call actual APIs here
      // For now, return mock data structure
      metrics.push({
        platform,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversionValue: 0,
      });
    } catch (error) {
      console.error(`Error fetching metrics for ${platform}:`, error);
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
