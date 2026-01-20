'use client';

import { GeneratedReport, PlatformMetrics } from '@/lib/types';
import { formatDate, formatCurrency, platformDisplayNames } from '@/lib/utils';

interface ReportViewerProps {
  report: GeneratedReport;
}

export default function ReportViewer({ report }: ReportViewerProps) {
  const { metrics } = report;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Report Summary</h2>
            <p className="text-gray-600 mt-1">
              Generated on {formatDate(report.generatedAt, 'long')}
            </p>
          </div>
          <span
            className={`badge ${
              report.status === 'success'
                ? 'badge-success'
                : report.status === 'failed'
                ? 'badge-error'
                : 'badge-warning'
            }`}
          >
            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
          </span>
        </div>

        {report.pdfUrl && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-sm font-medium text-gray-500">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(metrics?.totalSpend || 0)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-medium text-gray-500">Conversions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(metrics?.totalConversions || 0).toLocaleString()}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-medium text-gray-500">Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(metrics?.totalRevenue || 0)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm font-medium text-gray-500">ROAS</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(metrics?.roas || 0).toFixed(2)}x
          </p>
        </div>
      </div>

      {/* Platform Breakdown */}
      {metrics?.byPlatform && metrics.byPlatform.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROAS</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.byPlatform.map((platform: PlatformMetrics) => (
                  <tr key={platform.platform} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {platformDisplayNames[platform.platform] || platform.platform}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(platform.spend)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {platform.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {platform.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {platform.ctr.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {platform.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {platform.roas.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delivery Status */}
      {report.deliveries && report.deliveries.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Status</h3>
          <div className="space-y-3">
            {report.deliveries.map((delivery, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{delivery.recipientNumber}</p>
                    <p className="text-sm text-gray-500">
                      {delivery.sentAt ? `Sent: ${formatDate(delivery.sentAt, 'short')}` : 'Pending'}
                    </p>
                  </div>
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
