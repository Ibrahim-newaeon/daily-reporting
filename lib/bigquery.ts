import { BigQuery, Dataset, Table } from '@google-cloud/bigquery';

let bigqueryClient: BigQuery | undefined;
let datasetRef: Dataset | undefined;

function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    const serviceAccount = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || '{}');

    bigqueryClient = new BigQuery({
      projectId: process.env.GCP_PROJECT,
      credentials: serviceAccount,
    });
  }
  return bigqueryClient;
}

export function getDataset(): Dataset {
  if (!datasetRef) {
    const client = getBigQueryClient();
    datasetRef = client.dataset(process.env.BQ_DATASET || 'marketing_data');
  }
  return datasetRef;
}

export interface QueryOptions {
  query: string;
  params?: Record<string, unknown>;
  location?: string;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const client = getBigQueryClient();

  const options: QueryOptions = {
    query: sql,
    location: 'US',
  };

  if (params) {
    options.params = params;
  }

  const [rows] = await client.query(options);
  return rows as T[];
}

export async function insertRows<T extends object>(
  tableName: string,
  rows: T[],
  options: { skipInvalidRows?: boolean; ignoreUnknownValues?: boolean } = {}
): Promise<void> {
  const dataset = getDataset();
  const table = dataset.table(tableName);

  await table.insert(rows, {
    skipInvalidRows: options.skipInvalidRows ?? true,
    ignoreUnknownValues: options.ignoreUnknownValues ?? true,
  });
}

export async function createTableIfNotExists(
  tableName: string,
  schema: { name: string; type: string; mode?: string }[]
): Promise<Table> {
  const dataset = getDataset();
  const table = dataset.table(tableName);

  const [exists] = await table.exists();

  if (!exists) {
    await table.create({ schema });
  }

  return table;
}

export async function getMetricsForDateRange(
  userId: string,
  profileId: string,
  startDate: string,
  endDate: string,
  platform?: string
): Promise<Record<string, unknown>[]> {
  let sql = `
    SELECT
      date,
      platform,
      campaign_id,
      campaign_name,
      impressions,
      clicks,
      spend,
      conversions,
      conversion_value,
      created_at
    FROM \`${process.env.GCP_PROJECT}.${process.env.BQ_DATASET}.metrics\`
    WHERE user_id = @userId
      AND profile_id = @profileId
      AND date BETWEEN @startDate AND @endDate
  `;

  const params: Record<string, string> = {
    userId,
    profileId,
    startDate,
    endDate,
  };

  if (platform) {
    sql += ` AND platform = @platform`;
    params.platform = platform;
  }

  sql += ` ORDER BY date DESC, platform`;

  return query(sql, params);
}

export async function aggregateMetricsByPlatform(
  userId: string,
  profileId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, unknown>[]> {
  const sql = `
    SELECT
      platform,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      SUM(conversion_value) as total_conversion_value,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
      SAFE_DIVIDE(SUM(spend), SUM(clicks)) as cpc,
      SAFE_DIVIDE(SUM(spend), SUM(conversions)) as cpa,
      SAFE_DIVIDE(SUM(conversion_value), SUM(spend)) as roas
    FROM \`${process.env.GCP_PROJECT}.${process.env.BQ_DATASET}.metrics\`
    WHERE user_id = @userId
      AND profile_id = @profileId
      AND date BETWEEN @startDate AND @endDate
    GROUP BY platform
    ORDER BY total_spend DESC
  `;

  return query(sql, { userId, profileId, startDate, endDate });
}

export { getBigQueryClient as bigquery, getDataset as dataset };
