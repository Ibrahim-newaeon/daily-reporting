import { z } from 'zod';

// Platform types
export type Platform = 'ga4' | 'google_ads' | 'meta' | 'linkedin' | 'tiktok' | 'snapchat';

export const PlatformSchema = z.enum(['ga4', 'google_ads', 'meta', 'linkedin', 'tiktok', 'snapchat']);

// User types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  connectedAccounts: ConnectedAccounts;
  settings: UserSettings;
}

export interface ConnectedAccounts {
  ga4?: PlatformConnection;
  google_ads?: PlatformConnection;
  meta?: PlatformConnection;
  linkedin?: PlatformConnection;
  tiktok?: PlatformConnection;
  snapchat?: PlatformConnection;
}

export interface PlatformConnection {
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string;
  accountName?: string;
  propertyId?: string; // For GA4
  tokenEncrypted?: boolean; // Whether tokens are encrypted at rest
  expired?: boolean; // Whether token has expired
  needsReauth?: boolean; // Whether user needs to re-authenticate
}

export interface UserSettings {
  timezone: string;
  currency: string;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
}

// Profile types
export interface ReportProfile {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isActive: boolean;
  platforms: Platform[];
  metrics: MetricConfig[];
  charts: ChartConfig[];
  schedule: ScheduleConfig;
  whatsappRecipients: WhatsAppRecipient[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricConfig {
  id: string;
  platform: Platform;
  metricName: string;
  displayName: string;
  format: 'number' | 'currency' | 'percentage';
  aggregation: 'sum' | 'avg' | 'max' | 'min';
}

export interface ChartConfig {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  metrics: string[];
  dimensions: string[];
  colors: string[];
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  timezone: string;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
}

export interface WhatsAppRecipient {
  id: string;
  name: string;
  number: string; // E.164 format
  isActive: boolean;
}

// Report types
export interface GeneratedReport {
  id: string;
  profileId: string;
  userId: string;
  generatedAt: Date;
  pdfUrl: string;
  status: 'pending' | 'generating' | 'success' | 'failed';
  error?: string;
  metrics: ReportMetrics;
  deliveries: ReportDelivery[];
}

export interface ReportMetrics {
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  roas: number;
  byPlatform: PlatformMetrics[];
}

export interface PlatformMetrics {
  platform: Platform;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface ReportDelivery {
  recipientId: string;
  recipientNumber: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  messageId?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Metrics data types
export interface MetricRow {
  date: string;
  platform: Platform;
  campaignId?: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

// Validation schemas
export const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  platforms: z.array(PlatformSchema).min(1),
  isActive: z.boolean().default(true),
});

export const UpdateProfileSchema = CreateProfileSchema.partial();

export const WhatsAppRecipientSchema = z.object({
  name: z.string().min(1).max(100),
  number: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  isActive: z.boolean().default(true),
});

export const ScheduleConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
});

// OAuth types
export interface OAuthState {
  platform: Platform;
  userId: string;
  returnUrl: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}
