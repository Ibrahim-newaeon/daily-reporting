'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { GeneratedReport, PlatformMetrics } from '@/lib/types';
import { formatDate, formatCurrency, platformDisplayNames } from '@/lib/utils';

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}`);
      if (!response.ok) throw new Error('Report not found');

      const data = await response.json();
      setReport(data.data.report);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <p className="text-red-600">{error || 'Report not found'}</p>
          <Link href="/reports" className="btn-primary mt-4">
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Report Details</h1>
          <p className="text-gray-600">Generated {formatDate(report.generatedAt, 'long')}</p>
        </div>
        {report.pdfUrl && (
          <a
            href={report.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </a>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-500">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(report.metrics?.totalSpend || 0)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">Conversions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {report.metrics?.totalConversions || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(report.metrics?.totalRevenue || 0)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">ROAS</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(report.metrics?.roas || 0).toFixed(2)}x
          </p>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Conversions</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {(report.metrics?.byPlatform || []).map((platform: PlatformMetrics) => (
                <tr key={platform.platform}>
                  <td className="font-medium">
                    {platformDisplayNames[platform.platform] || platform.platform}
                  </td>
                  <td>{formatCurrency(platform.spend)}</td>
                  <td>{platform.impressions.toLocaleString()}</td>
                  <td>{platform.clicks.toLocaleString()}</td>
                  <td>{platform.ctr.toFixed(2)}%</td>
                  <td>{platform.conversions.toLocaleString()}</td>
                  <td>{platform.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Status */}
      {report.deliveries && report.deliveries.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Status</h2>
          <div className="space-y-3">
            {report.deliveries.map((delivery, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{delivery.recipientNumber}</p>
                  <p className="text-sm text-gray-500">
                    {delivery.sentAt ? `Sent: ${formatDate(delivery.sentAt, 'short')}` : 'Pending'}
                  </p>
                </div>
                <span
                  className={`badge ${
                    delivery.status === 'delivered'
                      ? 'badge-success'
                      : delivery.status === 'sent'
                      ? 'badge-info'
                      : delivery.status === 'failed'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}
                >
                  {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
