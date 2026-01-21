import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getMetricsForDateRange, aggregateMetricsByPlatform } from '@/lib/bigquery';
import { Platform } from '@/lib/types';
import { getDateRange } from '@/lib/utils';

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
    const profileId = searchParams.get('profileId') || 'default';
    const platform = searchParams.get('platform') as Platform | null;
    const dateRangeParam = searchParams.get('dateRange') || 'last7days';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const aggregated = searchParams.get('aggregated') === 'true';

    // Determine date range
    let startDate: string;
    let endDate: string;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      const range = getDateRange(dateRangeParam as Parameters<typeof getDateRange>[0]);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    if (aggregated) {
      // Return aggregated metrics by platform
      const metrics = await aggregateMetricsByPlatform(
        authResult.userId!,
        profileId,
        startDate,
        endDate
      );

      return NextResponse.json({
        success: true,
        data: {
          metrics,
          dateRange: { startDate, endDate },
        },
      });
    } else {
      // Return detailed metrics
      const metrics = await getMetricsForDateRange(
        authResult.userId!,
        profileId,
        startDate,
        endDate,
        platform || undefined
      );

      return NextResponse.json({
        success: true,
        data: {
          metrics,
          dateRange: { startDate, endDate },
          count: metrics.length,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
