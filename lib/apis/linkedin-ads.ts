import axios, { AxiosError } from 'axios';
import { MetricRow, Platform } from '../types';

export interface LinkedInAdAccount {
  id: string;
  name: string;
  status: string;
  currency: string;
}

export interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
}

export class LinkedInAdsClient {
  private accessToken: string;
  private accountId: string;
  private baseUrl = 'https://api.linkedin.com/rest';

  constructor(accessToken: string, accountId: string = '') {
    this.accessToken = accessToken;
    this.accountId = accountId;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'LinkedIn-Version': '202401',
      'X-RestLi-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
  }

  async getAdAccounts(): Promise<LinkedInAdAccount[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/adAccounts`,
        {
          headers: this.getHeaders(),
          params: {
            q: 'search',
            count: 100,
          },
        }
      );

      return response.data.elements?.map((account: Record<string, unknown>) => ({
        id: String(account.id),
        name: String(account.name),
        status: String(account.status),
        currency: String(account.currency),
      })) || [];
    } catch (error) {
      console.error('Error fetching LinkedIn ad accounts:', error);
      throw new Error('Failed to fetch LinkedIn ad accounts');
    }
  }

  async getCampaigns(): Promise<LinkedInCampaign[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/adCampaigns`,
        {
          headers: this.getHeaders(),
          params: {
            q: 'search',
            search: JSON.stringify({
              account: {
                values: [`urn:li:sponsoredAccount:${this.accountId}`],
              },
            }),
            count: 500,
          },
        }
      );

      return response.data.elements?.map((campaign: Record<string, unknown>) => ({
        id: String(campaign.id),
        name: String(campaign.name),
        status: String(campaign.status),
        type: String(campaign.type),
      })) || [];
    } catch (error) {
      console.error('Error fetching LinkedIn campaigns:', error);
      throw new Error('Failed to fetch LinkedIn campaigns');
    }
  }

  async getCampaignMetrics(startDate: string, endDate: string): Promise<MetricRow[]> {
    try {
      // Convert dates to LinkedIn format (YYYYMMDD)
      const start = startDate.replace(/-/g, '');
      const end = endDate.replace(/-/g, '');

      const response = await axios.get(
        `${this.baseUrl}/adAnalytics`,
        {
          headers: this.getHeaders(),
          params: {
            q: 'analytics',
            pivot: 'CAMPAIGN',
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
            timeGranularity: 'DAILY',
            accounts: `urn:li:sponsoredAccount:${this.accountId}`,
            fields: 'impressions,clicks,costInUsd,externalWebsiteConversions,conversionValueInLocalCurrency',
            count: 1000,
          },
        }
      );

      return this.parseAnalyticsResponse(response.data.elements || []);
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('LinkedIn Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch LinkedIn metrics: ${axiosError.message}`);
    }
  }

  async getAccountMetrics(startDate: string, endDate: string): Promise<{
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalConversionValue: number;
  }> {
    try {
      const start = startDate.replace(/-/g, '');
      const end = endDate.replace(/-/g, '');

      const response = await axios.get(
        `${this.baseUrl}/adAnalytics`,
        {
          headers: this.getHeaders(),
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
            accounts: `urn:li:sponsoredAccount:${this.accountId}`,
            fields: 'impressions,clicks,costInUsd,externalWebsiteConversions,conversionValueInLocalCurrency',
          },
        }
      );

      const data = response.data.elements?.[0] || {};

      return {
        totalSpend: parseFloat(data.costInUsd || '0'),
        totalImpressions: parseInt(data.impressions || '0', 10),
        totalClicks: parseInt(data.clicks || '0', 10),
        totalConversions: parseInt(data.externalWebsiteConversions || '0', 10),
        totalConversionValue: parseFloat(data.conversionValueInLocalCurrency || '0'),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('LinkedIn Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch account metrics: ${axiosError.message}`);
    }
  }

  private parseAnalyticsResponse(elements: Record<string, unknown>[]): MetricRow[] {
    return elements.map(element => {
      // Extract campaign ID from URN
      const pivotValue = String(element.pivotValue || '');
      const campaignId = pivotValue.split(':').pop() || '';

      // Parse date from dateRange
      const dateRange = element.dateRange as Record<string, Record<string, number>> | undefined;
      const startDateObj = dateRange?.start;
      const date = startDateObj
        ? `${startDateObj.year}-${String(startDateObj.month).padStart(2, '0')}-${String(startDateObj.day).padStart(2, '0')}`
        : new Date().toISOString().split('T')[0];

      return {
        platform: 'linkedin' as Platform,
        campaignId,
        campaignName: '', // LinkedIn doesn't return campaign name in analytics
        impressions: parseInt(String(element.impressions) || '0', 10),
        clicks: parseInt(String(element.clicks) || '0', 10),
        spend: parseFloat(String(element.costInUsd) || '0'),
        conversions: parseInt(String(element.externalWebsiteConversions) || '0', 10),
        conversionValue: parseFloat(String(element.conversionValueInLocalCurrency) || '0'),
        date,
      };
    });
  }

  setAccountId(accountId: string): void {
    this.accountId = accountId;
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(
        'https://api.linkedin.com/v2/userinfo',
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );
      return !!response.data.sub;
    } catch {
      return false;
    }
  }
}

export function createLinkedInAdsClient(accessToken: string, accountId?: string): LinkedInAdsClient {
  return new LinkedInAdsClient(accessToken, accountId);
}
