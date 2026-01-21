import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { MetricRow, Platform } from '../types';

export interface GA4Metric {
  name: string;
  displayName: string;
  description: string;
}

// GA4 Data API v1beta metric names
// See: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
export const AVAILABLE_GA4_METRICS: GA4Metric[] = [
  { name: 'sessions', displayName: 'Sessions', description: 'Total number of sessions' },
  { name: 'totalUsers', displayName: 'Users', description: 'Total number of users' },
  { name: 'newUsers', displayName: 'New Users', description: 'Number of new users' },
  { name: 'screenPageViews', displayName: 'Page Views', description: 'Total page views' },
  { name: 'bounceRate', displayName: 'Bounce Rate', description: 'Percentage of single-page sessions' },
  { name: 'averageSessionDuration', displayName: 'Avg Session Duration', description: 'Average session duration in seconds' },
  { name: 'conversions', displayName: 'Conversions', description: 'Total number of conversions' },
  { name: 'totalRevenue', displayName: 'Revenue', description: 'Total revenue' },
];

export class GA4Client {
  private analyticsData: ReturnType<typeof google.analyticsdata>;
  private oAuth2Client: OAuth2Client;

  constructor(accessToken: string, refreshToken?: string) {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/oauth/callback`
    );

    this.oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: this.oAuth2Client,
    });
  }

  async getProperties(): Promise<{ id: string; name: string }[]> {
    try {
      const admin = google.analyticsadmin({
        version: 'v1beta',
        auth: this.oAuth2Client,
      });

      const response = await admin.properties.list({
        filter: 'parent:accounts/-',
        pageSize: 100,
      });

      return (
        response.data.properties?.map(prop => ({
          id: prop.name?.split('/')[1] || '',
          name: prop.displayName || 'Unnamed Property',
        })) || []
      );
    } catch (error) {
      console.error('Error fetching GA4 properties:', error);
      throw new Error('Failed to fetch GA4 properties');
    }
  }

  async getMetrics(
    propertyId: string,
    startDate: string,
    endDate: string,
    metrics: string[] = ['sessions', 'totalUsers', 'screenPageViews'],
    dimensions: string[] = ['date']
  ): Promise<MetricRow[]> {
    try {
      const response = await this.analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: metrics.map(m => ({ name: m })),
          dimensions: dimensions.map(d => ({ name: d })),
          limit: 10000,
        },
      });

      return this.parseResponse(response.data, metrics, dimensions);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('GA4 API Error:', error);
      throw new Error(`Failed to fetch GA4 metrics: ${errorMessage}`);
    }
  }

  async getRealtimeData(propertyId: string): Promise<Record<string, number>> {
    try {
      const response = await this.analyticsData.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: {
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
          ],
        },
      });

      const row = response.data.rows?.[0];
      return {
        activeUsers: parseInt(row?.metricValues?.[0]?.value || '0', 10),
        screenPageViews: parseInt(row?.metricValues?.[1]?.value || '0', 10),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('GA4 Realtime API Error:', error);
      throw new Error(`Failed to fetch realtime data: ${errorMessage}`);
    }
  }

  private parseResponse(
    data: unknown,
    metrics: string[],
    dimensions: string[]
  ): MetricRow[] {
    const rows: MetricRow[] = [];
    const responseData = data as {
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    };

    responseData.rows?.forEach(row => {
      const entry: Partial<MetricRow> = {
        platform: 'ga4' as Platform,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversionValue: 0,
      };

      // Parse dimensions
      row.dimensionValues?.forEach((dimValue, idx) => {
        const dimName = dimensions[idx];
        if (dimName === 'date') {
          // GA4 returns date as YYYYMMDD
          const dateStr = dimValue.value || '';
          entry.date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
      });

      // Parse metrics - using GA4 Data API v1beta metric names
      row.metricValues?.forEach((metricValue, idx) => {
        const metricName = metrics[idx];
        const value = parseFloat(metricValue.value || '0');

        switch (metricName) {
          case 'sessions':
          case 'screenPageViews':
            entry.impressions = (entry.impressions || 0) + value;
            break;
          case 'totalUsers':
            entry.clicks = value; // Map users to clicks for consistency
            break;
          case 'conversions':
            entry.conversions = value;
            break;
          case 'totalRevenue':
            entry.conversionValue = value;
            break;
        }
      });

      if (entry.date) {
        rows.push(entry as MetricRow);
      }
    });

    return rows;
  }

  async refreshAccessToken(): Promise<string> {
    const { credentials } = await this.oAuth2Client.refreshAccessToken();
    return credentials.access_token || '';
  }
}

export function createGA4Client(accessToken: string, refreshToken?: string): GA4Client {
  return new GA4Client(accessToken, refreshToken);
}
