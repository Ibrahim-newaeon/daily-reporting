'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatNumber, platformColors, platformDisplayNames } from '@/lib/utils';

interface SummaryData {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface MetricData {
  date: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [dateRange, setDateRange] = useState('last7days');

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, metricsRes] = await Promise.all([
        fetch(`/api/data/summary?dateRange=${dateRange}&compareWith=previousPeriod`),
        fetch(`/api/data/metrics?dateRange=${dateRange}`),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data?.summary || null);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.data?.metrics || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate metrics by date for chart
  type ChartDataItem = { date: string } & Record<string, number>;
  const chartData = metrics.reduce((acc: Record<string, ChartDataItem>, item) => {
    if (!acc[item.date]) {
      acc[item.date] = { date: item.date } as ChartDataItem;
    }
    acc[item.date][`${item.platform}_spend`] = (acc[item.date][`${item.platform}_spend`] || 0) + item.spend;
    acc[item.date]['total_spend'] = (acc[item.date]['total_spend'] || 0) + item.spend;
    return acc;
  }, {});

  const chartDataArray = Object.values(chartData).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your marketing performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input w-auto"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
          </select>
          <Link href="/reports" className="btn-primary">
            Generate Report
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-32"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Total Spend</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(summary?.totalSpend || 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Conversions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(summary?.totalConversions || 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(summary?.totalRevenue || 0)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">ROAS</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {(summary?.roas || 0).toFixed(2)}x
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend Over Time */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spend Over Time</h2>
          <div className="h-80">
            {chartDataArray.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartDataArray}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total_spend"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Total Spend"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Spend by Platform */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spend by Platform</h2>
          <div className="h-80">
            {metrics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(
                    metrics.reduce((acc: Record<string, number>, item) => {
                      acc[item.platform] = (acc[item.platform] || 0) + item.spend;
                      return acc;
                    }, {})
                  ).map(([platform, spend]) => ({
                    platform: platformDisplayNames[platform] || platform,
                    spend,
                    fill: platformColors[platform] || '#6b7280',
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis dataKey="platform" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="spend" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/connectors"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Connect Platforms</p>
              <p className="text-sm text-gray-500">Link your ad accounts</p>
            </div>
          </Link>

          <Link
            href="/profiles/new"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Create Profile</p>
              <p className="text-sm text-gray-500">Set up a new report</p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Settings</p>
              <p className="text-sm text-gray-500">Configure your account</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
