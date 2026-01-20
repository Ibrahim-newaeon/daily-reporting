-- BigQuery Schema Setup for Marketing Dashboard SaaS
-- Run this script in BigQuery Console or via bq CLI

-- Create dataset if not exists
-- bq mk --dataset ${PROJECT_ID}:marketing_data

-- Metrics table for storing aggregated platform data
CREATE TABLE IF NOT EXISTS `${PROJECT_ID}.${DATASET}.metrics` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  profile_id STRING NOT NULL,
  date DATE NOT NULL,
  platform STRING NOT NULL,
  campaign_id STRING,
  campaign_name STRING,
  ad_group_id STRING,
  ad_group_name STRING,
  impressions INT64 DEFAULT 0,
  clicks INT64 DEFAULT 0,
  spend FLOAT64 DEFAULT 0,
  conversions FLOAT64 DEFAULT 0,
  conversion_value FLOAT64 DEFAULT 0,
  video_views INT64 DEFAULT 0,
  engagement INT64 DEFAULT 0,
  reach INT64 DEFAULT 0,
  frequency FLOAT64 DEFAULT 0,
  ctr FLOAT64,
  cpc FLOAT64,
  cpa FLOAT64,
  roas FLOAT64,
  synced_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY user_id, profile_id, platform
OPTIONS(
  description = 'Marketing metrics from all platforms',
  labels = [('environment', 'production'), ('app', 'marketing-dashboard')]
);

-- Daily aggregated metrics view
CREATE OR REPLACE VIEW `${PROJECT_ID}.${DATASET}.daily_metrics_summary` AS
SELECT
  user_id,
  profile_id,
  date,
  platform,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(spend) as total_spend,
  SUM(conversions) as total_conversions,
  SUM(conversion_value) as total_conversion_value,
  SAFE_DIVIDE(SUM(clicks), NULLIF(SUM(impressions), 0)) * 100 as avg_ctr,
  SAFE_DIVIDE(SUM(spend), NULLIF(SUM(clicks), 0)) as avg_cpc,
  SAFE_DIVIDE(SUM(spend), NULLIF(SUM(conversions), 0)) as avg_cpa,
  SAFE_DIVIDE(SUM(conversion_value), NULLIF(SUM(spend), 0)) as roas
FROM `${PROJECT_ID}.${DATASET}.metrics`
GROUP BY user_id, profile_id, date, platform;

-- Platform comparison view
CREATE OR REPLACE VIEW `${PROJECT_ID}.${DATASET}.platform_comparison` AS
SELECT
  user_id,
  profile_id,
  platform,
  DATE_TRUNC(date, WEEK) as week,
  SUM(spend) as weekly_spend,
  SUM(conversions) as weekly_conversions,
  SUM(conversion_value) as weekly_revenue,
  SAFE_DIVIDE(SUM(conversion_value), NULLIF(SUM(spend), 0)) as weekly_roas
FROM `${PROJECT_ID}.${DATASET}.metrics`
GROUP BY user_id, profile_id, platform, week;

-- Report generation logs table
CREATE TABLE IF NOT EXISTS `${PROJECT_ID}.${DATASET}.report_logs` (
  id STRING NOT NULL,
  report_id STRING NOT NULL,
  user_id STRING NOT NULL,
  profile_id STRING NOT NULL,
  status STRING NOT NULL,
  pdf_url STRING,
  total_spend FLOAT64,
  total_conversions FLOAT64,
  total_revenue FLOAT64,
  roas FLOAT64,
  platforms_included ARRAY<STRING>,
  recipients_count INT64,
  successful_deliveries INT64,
  failed_deliveries INT64,
  generation_time_ms INT64,
  error_message STRING,
  generated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(generated_at)
CLUSTER BY user_id
OPTIONS(
  description = 'Report generation logs and metrics'
);

-- Sync history table
CREATE TABLE IF NOT EXISTS `${PROJECT_ID}.${DATASET}.sync_history` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  platform STRING NOT NULL,
  status STRING NOT NULL,
  records_synced INT64 DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  error_message STRING,
  sync_duration_ms INT64,
  synced_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(synced_at)
CLUSTER BY user_id, platform
OPTIONS(
  description = 'Platform data sync history'
);

-- User analytics view
CREATE OR REPLACE VIEW `${PROJECT_ID}.${DATASET}.user_analytics` AS
SELECT
  m.user_id,
  COUNT(DISTINCT m.profile_id) as profiles_count,
  COUNT(DISTINCT m.platform) as platforms_connected,
  SUM(m.spend) as total_spend_all_time,
  SUM(m.conversions) as total_conversions_all_time,
  SUM(m.conversion_value) as total_revenue_all_time,
  MIN(m.date) as first_data_date,
  MAX(m.date) as last_data_date,
  COUNT(DISTINCT r.id) as reports_generated
FROM `${PROJECT_ID}.${DATASET}.metrics` m
LEFT JOIN `${PROJECT_ID}.${DATASET}.report_logs` r ON m.user_id = r.user_id
GROUP BY m.user_id;

-- Create indexes for common queries (via clustering, as BigQuery doesn't have traditional indexes)
-- The tables above are already clustered on frequently queried columns

-- Grant permissions (adjust as needed)
-- GRANT SELECT ON DATASET `${PROJECT_ID}.${DATASET}` TO 'serviceAccount:${SERVICE_ACCOUNT_EMAIL}';
