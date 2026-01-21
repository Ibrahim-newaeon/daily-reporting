import axios, { AxiosError } from 'axios';
import { MetricRow, Platform } from '../types';

export interface MetaAdAccount {
  id: string;
  name: string;
  accountStatus: number;
  currency: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

export class MetaAdsClient {
  private accessToken: string;
  private accountId: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken: string, accountId: string = '') {
    this.accessToken = accessToken;
    this.accountId = accountId.replace('act_', '');
  }

  async getAdAccounts(): Promise<MetaAdAccount[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/adaccounts`, {
        params: {
          access_token: this.accessToken,
          fields: 'id,name,account_status,currency',
          limit: 100,
        },
      });

      return response.data.data?.map((account: Record<string, unknown>) => ({
        id: String(account.id).replace('act_', ''),
        name: String(account.name),
        accountStatus: Number(account.account_status),
        currency: String(account.currency),
      })) || [];
    } catch (error) {
      console.error('Error fetching Meta ad accounts:', error);
      throw new Error('Failed to fetch Meta ad accounts');
    }
  }

  async getCampaigns(): Promise<MetaCampaign[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/act_${this.accountId}/campaigns`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,name,status,objective',
            limit: 500,
          },
        }
      );

      return response.data.data?.map((campaign: Record<string, unknown>) => ({
        id: String(campaign.id),
        name: String(campaign.name),
        status: String(campaign.status),
        objective: String(campaign.objective),
      })) || [];
    } catch (error) {
      console.error('Error fetching Meta campaigns:', error);
      throw new Error('Failed to fetch Meta campaigns');
    }
  }

  async getCampaignMetrics(startDate: string, endDate: string): Promise<MetricRow[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/act_${this.accountId}/insights`,
        {
          params: {
            access_token: this.accessToken,
            level: 'campaign',
            fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values',
            time_range: JSON.stringify({ since: startDate, until: endDate }),
            time_increment: 1, // Daily breakdown
            limit: 1000,
          },
        }
      );

      return this.parseInsightsResponse(response.data.data || []);
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Meta Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch Meta Ads metrics: ${axiosError.message}`);
    }
  }

  async getAccountInsights(startDate: string, endDate: string): Promise<{
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalConversionValue: number;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/act_${this.accountId}/insights`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'spend,impressions,clicks,actions,action_values',
            time_range: JSON.stringify({ since: startDate, until: endDate }),
          },
        }
      );

      const data = response.data.data?.[0] || {};
      const conversions = this.extractConversions(data.actions);
      const conversionValue = this.extractConversionValue(data.action_values);

      return {
        totalSpend: parseFloat(data.spend || '0'),
        totalImpressions: parseInt(data.impressions || '0', 10),
        totalClicks: parseInt(data.clicks || '0', 10),
        totalConversions: conversions,
        totalConversionValue: conversionValue,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Meta Ads API Error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Failed to fetch account insights: ${axiosError.message}`);
    }
  }

  private parseInsightsResponse(data: Record<string, unknown>[]): MetricRow[] {
    return data.map(insight => {
      const conversions = this.extractConversions(insight.actions as Record<string, unknown>[] | undefined);
      const conversionValue = this.extractConversionValue(insight.action_values as Record<string, unknown>[] | undefined);

      return {
        platform: 'meta' as Platform,
        campaignId: String(insight.campaign_id || ''),
        campaignName: String(insight.campaign_name || ''),
        spend: parseFloat(String(insight.spend) || '0'),
        impressions: parseInt(String(insight.impressions) || '0', 10),
        clicks: parseInt(String(insight.clicks) || '0', 10),
        conversions,
        conversionValue,
        date: String(insight.date_start || new Date().toISOString().split('T')[0]),
      };
    });
  }

  private extractConversions(actions?: Record<string, unknown>[]): number {
    if (!actions || !Array.isArray(actions)) return 0;

    const conversionTypes = [
      'purchase',
      'lead',
      'complete_registration',
      'add_to_cart',
      'initiate_checkout',
    ];

    let total = 0;
    for (const action of actions) {
      if (conversionTypes.includes(String(action.action_type))) {
        total += parseFloat(String(action.value) || '0');
      }
    }
    return total;
  }

  private extractConversionValue(actionValues?: Record<string, unknown>[]): number {
    if (!actionValues || !Array.isArray(actionValues)) return 0;

    const purchaseAction = actionValues.find(
      av => av.action_type === 'purchase' || av.action_type === 'omni_purchase'
    );

    return purchaseAction ? parseFloat(String(purchaseAction.value) || '0') : 0;
  }

  setAccountId(accountId: string): void {
    this.accountId = accountId.replace('act_', '');
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        params: { access_token: this.accessToken },
      });
      return !!response.data.id;
    } catch {
      return false;
    }
  }
}

export function createMetaAdsClient(accessToken: string, accountId?: string): MetaAdsClient {
  return new MetaAdsClient(accessToken, accountId);
}
