'use client';

import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
  };
  format?: 'currency' | 'number' | 'percentage' | 'multiplier';
  icon?: React.ReactNode;
  loading?: boolean;
}

function MetricCard({ label, value, change, format, icon, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-start justify-between">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="w-8 h-8 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-28 mt-2"></div>
      </div>
    );
  }

  const formatValue = () => {
    if (typeof value === 'string') return value;

    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return formatPercentage(value);
      case 'multiplier':
        return `${value.toFixed(2)}x`;
      case 'number':
      default:
        return formatNumber(value);
    }
  };

  const changeColor = change?.direction === 'up'
    ? 'text-green-600'
    : change?.direction === 'down'
    ? 'text-red-600'
    : 'text-gray-600';

  const changeIcon = change?.direction === 'up'
    ? '↑'
    : change?.direction === 'down'
    ? '↓'
    : '→';

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && (
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{formatValue()}</p>
      {change && (
        <p className={`text-sm mt-1 ${changeColor}`}>
          {changeIcon} {Math.abs(change.value).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

interface SummaryMetricsProps {
  metrics: {
    totalSpend: number;
    totalConversions: number;
    totalRevenue: number;
    roas: number;
    ctr?: number;
    cpc?: number;
    cpa?: number;
  } | null;
  comparison?: {
    spendChange?: { percentage: number; direction: 'up' | 'down' | 'flat' };
    conversionsChange?: { percentage: number; direction: 'up' | 'down' | 'flat' };
    revenueChange?: { percentage: number; direction: 'up' | 'down' | 'flat' };
  };
  loading?: boolean;
  showExtended?: boolean;
}

export default function SummaryMetrics({
  metrics,
  comparison,
  loading = false,
  showExtended = false,
}: SummaryMetricsProps) {
  const baseMetrics = [
    {
      label: 'Total Spend',
      value: metrics?.totalSpend || 0,
      format: 'currency' as const,
      change: comparison?.spendChange ? {
        value: comparison.spendChange.percentage,
        direction: comparison.spendChange.direction,
      } : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Conversions',
      value: metrics?.totalConversions || 0,
      format: 'number' as const,
      change: comparison?.conversionsChange ? {
        value: comparison.conversionsChange.percentage,
        direction: comparison.conversionsChange.direction,
      } : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Revenue',
      value: metrics?.totalRevenue || 0,
      format: 'currency' as const,
      change: comparison?.revenueChange ? {
        value: comparison.revenueChange.percentage,
        direction: comparison.revenueChange.direction,
      } : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'ROAS',
      value: metrics?.roas || 0,
      format: 'multiplier' as const,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  const extendedMetrics = showExtended
    ? [
        {
          label: 'CTR',
          value: metrics?.ctr || 0,
          format: 'percentage' as const,
          change: undefined,
          icon: undefined,
        },
        {
          label: 'CPC',
          value: metrics?.cpc || 0,
          format: 'currency' as const,
          change: undefined,
          icon: undefined,
        },
        {
          label: 'CPA',
          value: metrics?.cpa || 0,
          format: 'currency' as const,
          change: undefined,
          icon: undefined,
        },
      ]
    : [];

  const allMetrics = [...baseMetrics, ...extendedMetrics];

  return (
    <div className={`grid grid-cols-2 ${showExtended ? 'lg:grid-cols-7' : 'lg:grid-cols-4'} gap-4`}>
      {allMetrics.map((metric, index) => (
        <MetricCard
          key={index}
          label={metric.label}
          value={metric.value}
          format={metric.format}
          change={metric.change}
          icon={metric.icon}
          loading={loading}
        />
      ))}
    </div>
  );
}
