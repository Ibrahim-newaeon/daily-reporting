import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAdminDb, getAdminStorage } from '@/lib/firebase';
import { aggregateMetricsByPlatform } from '@/lib/bigquery';
import { createWhatsAppClient } from '@/lib/apis/whatsapp';
import { ReportProfile, GeneratedReport, PlatformMetrics } from '@/lib/types';
import { generateId, formatCurrency, formatDate, platformDisplayNames } from '@/lib/utils';

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
    const { profileId, startDate, endDate, sendWhatsApp = false } = body;

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Get the profile
    const profileDoc = await adminDb
      .collection('users')
      .doc(authResult.userId!)
      .collection('reportProfiles')
      .doc(profileId)
      .get();

    if (!profileDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const profile = { id: profileDoc.id, ...profileDoc.data() } as ReportProfile;

    // Create report record
    const reportId = generateId('report');
    const now = new Date();

    const report: Omit<GeneratedReport, 'id'> = {
      profileId,
      userId: authResult.userId!,
      generatedAt: now,
      pdfUrl: '',
      status: 'generating',
      metrics: {
        totalSpend: 0,
        totalConversions: 0,
        totalRevenue: 0,
        roas: 0,
        byPlatform: [],
      },
      deliveries: [],
    };

    await adminDb.collection('generatedReports').doc(reportId).set(report);

    try {
      // Get metrics from BigQuery
      const dateStart = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dateEnd = endDate || new Date().toISOString().split('T')[0];

      const platformMetrics = await aggregateMetricsByPlatform(
        authResult.userId!,
        profileId,
        dateStart,
        dateEnd
      );

      // Calculate totals
      let totalSpend = 0;
      let totalConversions = 0;
      let totalRevenue = 0;

      const byPlatform: PlatformMetrics[] = platformMetrics.map((pm: Record<string, unknown>) => {
        const spend = Number(pm.total_spend) || 0;
        const conversions = Number(pm.total_conversions) || 0;
        const revenue = Number(pm.total_conversion_value) || 0;

        totalSpend += spend;
        totalConversions += conversions;
        totalRevenue += revenue;

        return {
          platform: pm.platform as PlatformMetrics['platform'],
          spend,
          impressions: Number(pm.total_impressions) || 0,
          clicks: Number(pm.total_clicks) || 0,
          conversions,
          conversionValue: revenue,
          ctr: Number(pm.ctr) || 0,
          cpc: Number(pm.cpc) || 0,
          cpa: Number(pm.cpa) || 0,
          roas: Number(pm.roas) || 0,
        };
      });

      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      // Generate HTML report
      const htmlContent = generateReportHTML(profile, {
        totalSpend,
        totalConversions,
        totalRevenue,
        roas,
        byPlatform,
      }, dateStart, dateEnd);

      // Generate PDF (simplified - in production use Puppeteer)
      const pdfBuffer = Buffer.from(htmlContent);

      // Upload to Cloud Storage
      const storage = getAdminStorage();
      const bucket = storage.bucket(process.env.GCS_BUCKET);
      const fileName = `reports/${authResult.userId}/${reportId}.pdf`;
      const file = bucket.file(fileName);

      await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
          cacheControl: 'private, max-age=31536000',
        },
      });

      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Update report with results
      await adminDb.collection('generatedReports').doc(reportId).update({
        status: 'success',
        pdfUrl: signedUrl,
        metrics: {
          totalSpend,
          totalConversions,
          totalRevenue,
          roas,
          byPlatform,
        },
        updatedAt: now,
      });

      // Send via WhatsApp if requested
      if (sendWhatsApp && profile.whatsappRecipients?.length > 0) {
        const whatsapp = createWhatsAppClient();
        const deliveries = [];

        for (const recipient of profile.whatsappRecipients) {
          if (!recipient.isActive) continue;

          try {
            const topPlatform = byPlatform.reduce((a, b) =>
              a.spend > b.spend ? a : b
            )?.platform || 'N/A';

            const results = await whatsapp.sendReportWithSummary(
              recipient.number,
              signedUrl,
              profile.name,
              {
                totalSpend,
                totalConversions,
                roas,
                topPlatform: platformDisplayNames[topPlatform] || topPlatform,
              }
            );

            deliveries.push({
              recipientId: recipient.id,
              recipientNumber: recipient.number,
              status: results.every(r => r.success) ? 'sent' : 'failed',
              sentAt: now,
              messageId: results.find(r => r.messageId)?.messageId,
              error: results.find(r => r.error)?.error,
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

        await adminDb.collection('generatedReports').doc(reportId).update({
          deliveries,
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          reportId,
          pdfUrl: signedUrl,
          metrics: {
            totalSpend,
            totalConversions,
            totalRevenue,
            roas,
          },
        },
      });
    } catch (error) {
      // Update report as failed
      await adminDb.collection('generatedReports').doc(reportId).update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      });

      throw error;
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

function generateReportHTML(
  profile: ReportProfile,
  metrics: {
    totalSpend: number;
    totalConversions: number;
    totalRevenue: number;
    roas: number;
    byPlatform: PlatformMetrics[];
  },
  startDate: string,
  endDate: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${profile.name} - Marketing Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 40px; }
    .header { border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #1e40af; margin-bottom: 8px; }
    .header .date-range { color: #6b7280; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: linear-gradient(135deg, #f8fafc, #e2e8f0); padding: 24px; border-radius: 12px; text-align: center; }
    .summary-card .label { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    .summary-card .value { font-size: 28px; font-weight: 700; color: #1e40af; }
    .platform-section { margin-top: 30px; }
    .platform-section h2 { font-size: 20px; margin-bottom: 16px; color: #334155; }
    .platform-table { width: 100%; border-collapse: collapse; }
    .platform-table th, .platform-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .platform-table th { background: #f8fafc; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b; }
    .platform-table td { font-size: 14px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${profile.name}</h1>
    <div class="date-range">Report Period: ${formatDate(startDate)} - ${formatDate(endDate)}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Spend</div>
      <div class="value">${formatCurrency(metrics.totalSpend)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Conversions</div>
      <div class="value">${metrics.totalConversions.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">Revenue</div>
      <div class="value">${formatCurrency(metrics.totalRevenue)}</div>
    </div>
    <div class="summary-card">
      <div class="label">ROAS</div>
      <div class="value">${metrics.roas.toFixed(2)}x</div>
    </div>
  </div>

  <div class="platform-section">
    <h2>Platform Breakdown</h2>
    <table class="platform-table">
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
        ${metrics.byPlatform.map(p => `
        <tr>
          <td>${platformDisplayNames[p.platform] || p.platform}</td>
          <td>${formatCurrency(p.spend)}</td>
          <td>${p.impressions.toLocaleString()}</td>
          <td>${p.clicks.toLocaleString()}</td>
          <td>${p.ctr.toFixed(2)}%</td>
          <td>${p.conversions.toLocaleString()}</td>
          <td>${p.roas.toFixed(2)}x</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generated on ${formatDate(new Date(), 'long')} | Marketing Dashboard SaaS
  </div>
</body>
</html>
  `;
}
