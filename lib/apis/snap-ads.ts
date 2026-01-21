import axios, { AxiosError } from 'axios';
import { MetricRow, Platform } from '../types';

export interface SnapAdAccount {
  id: string;
  name: string;
  status: string;
  currency: string;
  timezone: string;
  organizationId: string;
}

export interface SnapCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  startTime: string;
  endTime?: string;
}

export interface SnapAdSquad {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  type: string;
}

export class SnapAdsClient {
  private accessToken: string;
  private adAccountId: string;
  private organizationId: string;
  private baseUrl = 'https://adsapi.snapchat.com/v1';

  constructor(accessToken: string, adAccountId: string = '', organizationId: string = '') {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
    this.organizationId = organizationId;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getOrganizations(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/me/organizations`,
        { headers: this.getHeaders() }
      );

      return response.data.organizations?.map((org: Record<string, unknown>) => ({
        id: String((org.organization as Record<string, unknown>)?.id || ''),
        name: String((org.organization as Record<string, unknown>)?.name || ''),
      })) || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching Snap organizations:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to fetch Snap organizations');
    }
  }

  async getAdAccounts(): Promise<SnapAdAccount[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/organizations/${this.organizationId}/adaccounts`,
        { headers: this.getHeaders() }
      );

      return response.data.adaccounts?.map((account: Record<string, unknown>) => {
        const adAccount = account.adaccount as Record<string, unknown> || {};
        return {
          id: String(adAccount.id),
          name: String(adAccount.name),
          status: String(adAccount.status),
          currency: String(adAccount.currency),
          timezone: String(adAccount.timezone),
          organizationId: String(adAccount.organization_id),
        };
      }) || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching Snap ad accounts:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to fetch Snap ad accounts');
    }
  }

  async getCampaigns(): Promise<SnapCampaign[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/adaccounts/${this.adAccountId}/campaigns`,
        { headers: this.getHeaders() }
      );

      return response.data.campaigns?.map((campaign: Record<string, unknown>) => {
        const c = campaign.campaign as Record<string, unknown> || {};
        return {
          id: String(c.id),
          name: String(c.name),
          status: String(c.status),
          objective: String(c.objective),
          startTime: String(c.start_time),
          endTime: c.end_time ? String(c.end_time) : undefined,
        };
      }) || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching Snap campaigns:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to fetch Snap campaigns');
    }
  }

  async getCampaignMetrics(startDate: string, endDate: string): Promise<MetricRow[]> {
    try {
      // First get all campaigns
      const campaigns = await this.getCampaigns();

      // Fetch stats for each campaign
      const allMetrics: MetricRow[] = [];

      for (const campaign of campaigns) {
        try {
          const stats = await this.getCampaignStats(campaign.id, startDate, endDate);
          const rows = this.parseStatsResponse(stats, campaign);
          allMetrics.push(...rows);
        } catch (error) {
          console.warn(`Failed to fetch stats for campaign ${campaign.id}:`, error);
        }
      }

      return allMetrics;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Snap Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch Snap campaign metrics: ${axiosError.message}`);
    }
  }

  private async getCampaignStats(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, unknown>[]> {
    const response = await axios.get(
      `${this.baseUrl}/campaigns/${campaignId}/stats`,
      {
        headers: this.getHeaders(),
        params: {
          granularity: 'DAY',
          start_time: `${startDate}T00:00:00.000Z`,
          end_time: `${endDate}T23:59:59.999Z`,
          fields: 'impressions,swipes,spend,conversion_purchases,conversion_purchases_value,conversion_add_cart,conversion_sign_ups',
        },
      }
    );

    return response.data.timeseries_stats?.[0]?.timeseries || [];
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
        `${this.baseUrl}/adaccounts/${this.adAccountId}/stats`,
        {
          headers: this.getHeaders(),
          params: {
            granularity: 'TOTAL',
            start_time: `${startDate}T00:00:00.000Z`,
            end_time: `${endDate}T23:59:59.999Z`,
            fields: 'impressions,swipes,spend,conversion_purchases,conversion_purchases_value,conversion_add_cart,conversion_sign_ups',
          },
        }
      );

      const stats = response.data.total_stats?.[0]?.stats || {};

      // Snap uses "swipes" as their equivalent of clicks
      const conversions = parseInt(stats.conversion_purchases || '0', 10) +
                         parseInt(stats.conversion_add_cart || '0', 10) +
                         parseInt(stats.conversion_sign_ups || '0', 10);

      return {
        totalSpend: this.microToDecimal(stats.spend),
        totalImpressions: parseInt(stats.impressions || '0', 10),
        totalClicks: parseInt(stats.swipes || '0', 10),
        totalConversions: conversions,
        totalConversionValue: this.microToDecimal(stats.conversion_purchases_value),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Snap Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch Snap account metrics: ${axiosError.message}`);
    }
  }

  private parseStatsResponse(
    timeseries: Record<string, unknown>[],
    campaign: SnapCampaign
  ): MetricRow[] {
    return timeseries.map(entry => {
      const stats = entry.stats as Record<string, unknown> || {};

      const conversions = parseInt(String(stats.conversion_purchases) || '0', 10) +
                         parseInt(String(stats.conversion_add_cart) || '0', 10) +
                         parseInt(String(stats.conversion_sign_ups) || '0', 10);

      // Parse date from start_time
      const startTime = String(entry.start_time || '');
      const date = startTime.split('T')[0] || new Date().toISOString().split('T')[0];

      return {
        platform: 'snapchat' as Platform,
        campaignId: campaign.id,
        campaignName: campaign.name,
        spend: this.microToDecimal(stats.spend),
        impressions: parseInt(String(stats.impressions) || '0', 10),
        clicks: parseInt(String(stats.swipes) || '0', 10), // Snap uses "swipes"
        conversions,
        conversionValue: this.microToDecimal(stats.conversion_purchases_value),
        date,
      };
    });
  }

  // Snap API returns monetary values in micro-currency (divide by 1,000,000)
  private microToDecimal(microValue: unknown): number {
    if (microValue === undefined || microValue === null) return 0;
    return parseFloat(String(microValue)) / 1000000;
  }

  async getAdSquads(): Promise<SnapAdSquad[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/adaccounts/${this.adAccountId}/adsquads`,
        { headers: this.getHeaders() }
      );

      return response.data.adsquads?.map((squad: Record<string, unknown>) => {
        const s = squad.adsquad as Record<string, unknown> || {};
        return {
          id: String(s.id),
          campaignId: String(s.campaign_id),
          name: String(s.name),
          status: String(s.status),
          type: String(s.type),
        };
      }) || [];
    } catch (error) {
      console.error('Error fetching Snap ad squads:', error);
      throw new Error('Failed to fetch Snap ad squads');
    }
  }

  setAdAccountId(adAccountId: string): void {
    this.adAccountId = adAccountId;
  }

  setOrganizationId(organizationId: string): void {
    this.organizationId = organizationId;
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/me`,
        { headers: this.getHeaders() }
      );
      return !!response.data.me?.id;
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
        'https://accounts.snapchat.com/login/oauth2/access_token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.SNAP_CLIENT_ID || '',
          client_secret: process.env.SNAP_CLIENT_SECRET || '',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Snap token refresh error:', axiosError.response?.data || axiosError.message);
      throw new Error('Failed to refresh Snap access token');
    }
  }
}

export function createSnapAdsClient(
  accessToken: string,
  adAccountId?: string,
  organizationId?: string
): SnapAdsClient {
  return new SnapAdsClient(accessToken, adAccountId, organizationId);
}
