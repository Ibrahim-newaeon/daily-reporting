import axios, { AxiosError } from 'axios';
import { MetricRow, Platform } from '../types';

export interface TikTokAdAccount {
  id: string;
  name: string;
  status: string;
  currency: string;
  timezone: string;
}

export interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
}

export interface TikTokAdGroup {
  id: string;
  campaignId: string;
  name: string;
  status: string;
}

export class TikTokAdsClient {
  private accessToken: string;
  private advertiserId: string;
  private baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

  constructor(accessToken: string, advertiserId: string = '') {
    this.accessToken = accessToken;
    this.advertiserId = advertiserId;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  async getAdAccounts(): Promise<TikTokAdAccount[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth2/advertiser/get/`,
        {
          headers: this.getHeaders(),
          params: {
            app_id: process.env.TIKTOK_APP_ID,
            secret: process.env.TIKTOK_APP_SECRET,
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message || 'Failed to fetch TikTok ad accounts');
      }

      return response.data.data?.list?.map((account: Record<string, unknown>) => ({
        id: String(account.advertiser_id),
        name: String(account.advertiser_name),
        status: String(account.status),
        currency: String(account.currency),
        timezone: String(account.timezone),
      })) || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching TikTok ad accounts:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to fetch TikTok ad accounts');
    }
  }

  async getCampaigns(): Promise<TikTokCampaign[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/campaign/get/`,
        {
          headers: this.getHeaders(),
          params: {
            advertiser_id: this.advertiserId,
            page_size: 1000,
            filtering: JSON.stringify({
              primary_status: 'STATUS_ALL',
            }),
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message || 'Failed to fetch TikTok campaigns');
      }

      return response.data.data?.list?.map((campaign: Record<string, unknown>) => ({
        id: String(campaign.campaign_id),
        name: String(campaign.campaign_name),
        status: String(campaign.status),
        objective: String(campaign.objective_type),
        budget: parseFloat(String(campaign.budget) || '0'),
      })) || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching TikTok campaigns:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to fetch TikTok campaigns');
    }
  }

  async getCampaignMetrics(startDate: string, endDate: string): Promise<MetricRow[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/report/integrated/get/`,
        {
          headers: this.getHeaders(),
          params: {
            advertiser_id: this.advertiserId,
            report_type: 'BASIC',
            data_level: 'AUCTION_CAMPAIGN',
            dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
            metrics: JSON.stringify([
              'spend',
              'impressions',
              'clicks',
              'conversion',
              'total_complete_payment_rate',
              'complete_payment',
              'complete_payment_value',
              'cpc',
              'cpm',
              'ctr',
              'cost_per_conversion',
            ]),
            start_date: startDate,
            end_date: endDate,
            page_size: 1000,
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message || 'Failed to fetch TikTok campaign metrics');
      }

      return this.parseReportResponse(response.data.data?.list || []);
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('TikTok Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch TikTok campaign metrics: ${axiosError.message}`);
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
      const response = await axios.get(
        `${this.baseUrl}/report/integrated/get/`,
        {
          headers: this.getHeaders(),
          params: {
            advertiser_id: this.advertiserId,
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
        throw new Error(response.data.message || 'Failed to fetch TikTok account metrics');
      }

      const data = response.data.data?.list?.[0]?.metrics || {};

      return {
        totalSpend: parseFloat(data.spend || '0'),
        totalImpressions: parseInt(data.impressions || '0', 10),
        totalClicks: parseInt(data.clicks || '0', 10),
        totalConversions: parseInt(data.conversion || '0', 10) + parseInt(data.complete_payment || '0', 10),
        totalConversionValue: parseFloat(data.complete_payment_value || '0'),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('TikTok Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch TikTok account metrics: ${axiosError.message}`);
    }
  }

  private parseReportResponse(data: Record<string, unknown>[]): MetricRow[] {
    return data.map(row => {
      const dimensions = row.dimensions as Record<string, unknown> || {};
      const metrics = row.metrics as Record<string, unknown> || {};

      const conversions = parseInt(String(metrics.conversion) || '0', 10) +
                         parseInt(String(metrics.complete_payment) || '0', 10);

      return {
        platform: 'tiktok' as Platform,
        campaignId: String(dimensions.campaign_id || ''),
        campaignName: '', // TikTok doesn't return campaign name in report
        spend: parseFloat(String(metrics.spend) || '0'),
        impressions: parseInt(String(metrics.impressions) || '0', 10),
        clicks: parseInt(String(metrics.clicks) || '0', 10),
        conversions,
        conversionValue: parseFloat(String(metrics.complete_payment_value) || '0'),
        date: String(dimensions.stat_time_day || new Date().toISOString().split('T')[0]),
      };
    });
  }

  async getAdGroups(): Promise<TikTokAdGroup[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/adgroup/get/`,
        {
          headers: this.getHeaders(),
          params: {
            advertiser_id: this.advertiserId,
            page_size: 1000,
          },
        }
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message || 'Failed to fetch TikTok ad groups');
      }

      return response.data.data?.list?.map((adgroup: Record<string, unknown>) => ({
        id: String(adgroup.adgroup_id),
        campaignId: String(adgroup.campaign_id),
        name: String(adgroup.adgroup_name),
        status: String(adgroup.status),
      })) || [];
    } catch (error) {
      console.error('Error fetching TikTok ad groups:', error);
      throw new Error('Failed to fetch TikTok ad groups');
    }
  }

  setAdvertiserId(advertiserId: string): void {
    this.advertiserId = advertiserId;
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user/info/`,
        { headers: this.getHeaders() }
      );
      return response.data.code === 0;
    } catch {
      return false;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/refresh_token/`,
        {
          app_id: process.env.TIKTOK_APP_ID,
          secret: process.env.TIKTOK_APP_SECRET,
          refresh_token: refreshToken,
        }
      );

      if (response.data.code !== 0) {
        throw new Error(response.data.message || 'Failed to refresh TikTok access token');
      }

      return {
        accessToken: response.data.data.access_token,
        refreshToken: response.data.data.refresh_token,
        expiresIn: response.data.data.expires_in,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('TikTok token refresh error:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to refresh TikTok access token');
    }
  }
}

export function createTikTokAdsClient(accessToken: string, advertiserId?: string): TikTokAdsClient {
  return new TikTokAdsClient(accessToken, advertiserId);
}
