import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { query } from '@/lib/bigquery';
import { getDateRange, calculateROAS } from '@/lib/utils';
import {
  SummaryQuerySchema,
  parseQueryParams,
  formatValidationErrors,
} from '@/lib/validations';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryParams = parseQueryParams(searchParams);
    const validationResult = SummaryQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const { profileId = 'default', dateRange: dateRangeParam, compareWith } = validationResult.data;

    const { startDate, endDate } = getDateRange(dateRangeParam);

    // Current period summary
    const currentPeriodSql = `
      SELECT
        SUM(spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(conversion_value) as total_revenue,
        COUNT(DISTINCT platform) as platforms_count,
        COUNT(DISTINCT campaign_id) as campaigns_count
      FROM \`${process.env.GCP_PROJECT}.${process.env.BQ_DATASET}.metrics\`
      WHERE user_id = @userId
        AND profile_id = @profileId
        AND date BETWEEN @startDate AND @endDate
    `;

    const currentResults = await query(currentPeriodSql, {
      userId: authResult.userId,
      profileId,
      startDate,
      endDate,
    });

    const current = currentResults[0] || {};

    const summary = {
      totalSpend: Number(current.total_spend) || 0,
      totalImpressions: Number(current.total_impressions) || 0,
      totalClicks: Number(current.total_clicks) || 0,
      totalConversions: Number(current.total_conversions) || 0,
      totalRevenue: Number(current.total_revenue) || 0,
      platformsCount: Number(current.platforms_count) || 0,
      campaignsCount: Number(current.campaigns_count) || 0,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      roas: 0,
    };

    // Calculate derived metrics
    if (summary.totalImpressions > 0) {
      summary.ctr = (summary.totalClicks / summary.totalImpressions) * 100;
    }
    if (summary.totalClicks > 0) {
      summary.cpc = summary.totalSpend / summary.totalClicks;
    }
    if (summary.totalConversions > 0) {
      summary.cpa = summary.totalSpend / summary.totalConversions;
    }
    summary.roas = calculateROAS(summary.totalRevenue, summary.totalSpend);

    let comparison = null;

    // Calculate comparison if requested
    if (compareWith === 'previousPeriod') {
      const daysDiff = Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const prevEndDate = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const prevStartDate = new Date(
        new Date(prevEndDate).getTime() - daysDiff * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];

      const prevResults = await query(currentPeriodSql, {
        userId: authResult.userId,
        profileId,
        startDate: prevStartDate,
        endDate: prevEndDate,
      });

      const prev = prevResults[0] || {};

      const prevSummary = {
        totalSpend: Number(prev.total_spend) || 0,
        totalImpressions: Number(prev.total_impressions) || 0,
        totalClicks: Number(prev.total_clicks) || 0,
        totalConversions: Number(prev.total_conversions) || 0,
        totalRevenue: Number(prev.total_revenue) || 0,
      };

      comparison = {
        period: { startDate: prevStartDate, endDate: prevEndDate },
        spendChange: calculateChange(summary.totalSpend, prevSummary.totalSpend),
        impressionsChange: calculateChange(summary.totalImpressions, prevSummary.totalImpressions),
        clicksChange: calculateChange(summary.totalClicks, prevSummary.totalClicks),
        conversionsChange: calculateChange(summary.totalConversions, prevSummary.totalConversions),
        revenueChange: calculateChange(summary.totalRevenue, prevSummary.totalRevenue),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        dateRange: { startDate, endDate },
        comparison,
      },
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

function calculateChange(current: number, previous: number): {
  absolute: number;
  percentage: number;
  direction: 'up' | 'down' | 'flat';
} {
  const absolute = current - previous;
  const percentage = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const direction = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat';

  return { absolute, percentage, direction };
}
