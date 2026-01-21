import axios, { AxiosError } from 'axios';
import { MetricRow, Platform } from '../types';

/**
 * Validate date format to prevent injection attacks in GAQL queries
 * @param date Date string to validate (expected format: YYYY-MM-DD)
 * @returns true if valid, throws error if invalid
 */
function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  // Additional validation to ensure it's a valid date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }
  return true;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
}

export interface GoogleAdsMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  date: string;
}

export class GoogleAdsClient {
  private accessToken: string;
  private customerId: string;
  private developerToken: string;
  private baseUrl = 'https://googleads.googleapis.com/v15';

  constructor(accessToken: string, customerId?: string) {
    this.accessToken = accessToken;
    this.customerId = (customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };
  }

  async getAccessibleCustomers(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/customers:listAccessibleCustomers`,
        { headers: this.getHeaders() }
      );

      const customerIds = response.data.resourceNames?.map((name: string) =>
        name.split('/')[1]
      ) || [];

      // Get customer names
      const customers: { id: string; name: string }[] = [];
      for (const id of customerIds) {
        try {
          const details = await this.getCustomerDetails(id);
          customers.push(details);
        } catch {
          customers.push({ id, name: `Account ${id}` });
        }
      }

      return customers;
    } catch (error) {
      console.error('Error fetching accessible customers:', error);
      throw new Error('Failed to fetch Google Ads accounts');
    }
  }

  private async getCustomerDetails(customerId: string): Promise<{ id: string; name: string }> {
    const query = `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`;

    const response = await axios.post(
      `${this.baseUrl}/customers/${customerId}/googleAds:search`,
      { query },
      { headers: this.getHeaders() }
    );

    const result = response.data.results?.[0];
    return {
      id: customerId,
      name: result?.customer?.descriptiveName || `Account ${customerId}`,
    };
  }

  async getCampaigns(): Promise<GoogleAdsCampaign[]> {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.name
      LIMIT 1000
    `;

    try {
      const response = await axios.post(
        `${this.baseUrl}/customers/${this.customerId}/googleAds:search`,
        { query },
        { headers: this.getHeaders() }
      );

      return response.data.results?.map((result: Record<string, unknown>) => {
        const campaign = result.campaign as Record<string, unknown>;
        return {
          id: String(campaign.id),
          name: String(campaign.name),
          status: String(campaign.status),
          type: String(campaign.advertisingChannelType),
        };
      }) || [];
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw new Error('Failed to fetch Google Ads campaigns');
    }
  }

  async getCampaignMetrics(startDate: string, endDate: string): Promise<MetricRow[]> {
    // Validate date formats to prevent GAQL injection
    validateDateFormat(startDate);
    validateDateFormat(endDate);

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC
      LIMIT 10000
    `;

    try {
      const response = await axios.post(
        `${this.baseUrl}/customers/${this.customerId}/googleAds:searchStream`,
        { query },
        { headers: this.getHeaders() }
      );

      const results: MetricRow[] = [];

      // Handle streaming response
      const batches = response.data || [];
      for (const batch of batches) {
        const batchResults = batch.results || [];
        for (const result of batchResults) {
          results.push({
            platform: 'google_ads' as Platform,
            campaignId: String(result.campaign?.id || ''),
            campaignName: String(result.campaign?.name || ''),
            impressions: parseInt(result.metrics?.impressions || '0', 10),
            clicks: parseInt(result.metrics?.clicks || '0', 10),
            spend: (parseInt(result.metrics?.costMicros || '0', 10)) / 1000000,
            conversions: parseFloat(result.metrics?.conversions || '0'),
            conversionValue: parseFloat(result.metrics?.conversionsValue || '0'),
            date: result.segments?.date || '',
          });
        }
      }

      return results;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Google Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch Google Ads metrics: ${axiosError.message}`);
    }
  }

  async getAccountMetrics(startDate: string, endDate: string): Promise<{
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalConversionValue: number;
  }> {
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

    try {
      const response = await axios.post(
        `${this.baseUrl}/customers/${this.customerId}/googleAds:search`,
        { query },
        { headers: this.getHeaders() }
      );

      const result = response.data.results?.[0]?.metrics || {};

      return {
        totalSpend: (parseInt(result.costMicros || '0', 10)) / 1000000,
        totalImpressions: parseInt(result.impressions || '0', 10),
        totalClicks: parseInt(result.clicks || '0', 10),
        totalConversions: parseFloat(result.conversions || '0'),
        totalConversionValue: parseFloat(result.conversionsValue || '0'),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Google Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch account metrics: ${axiosError.message}`);
    }
  }

  setCustomerId(customerId: string): void {
    this.customerId = customerId.replace(/-/g, '');
  }
}

export function createGoogleAdsClient(accessToken: string, customerId?: string): GoogleAdsClient {
  return new GoogleAdsClient(accessToken, customerId);
}
