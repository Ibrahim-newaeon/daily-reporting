'use client';

import Link from 'next/link';
import { GeneratedReport } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';

interface ReportsListProps {
  reports: GeneratedReport[];
  loading?: boolean;
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'success':
      return 'badge-success';
    case 'generating':
    case 'pending':
      return 'badge-warning';
    case 'failed':
      return 'badge-error';
    default:
      return 'badge-info';
  }
}

function ReportRow({ report }: { report: GeneratedReport }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div>
          <p className="font-medium text-gray-900">Report #{report.id.slice(-8)}</p>
          <p className="text-sm text-gray-500">Profile: {report.profileId.slice(-8)}</p>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {formatDate(report.generatedAt, 'short')}
      </td>
      <td className="px-6 py-4">
        <span className={`badge ${getStatusStyle(report.status)}`}>
          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm">
          <p className="text-gray-900">{formatCurrency(report.metrics?.totalSpend || 0)}</p>
          <p className="text-gray-500">ROAS: {(report.metrics?.roas || 0).toFixed(2)}x</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex gap-2">
          {report.pdfUrl && (
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Download PDF
            </a>
          )}
          <Link
            href={`/reports/${report.id}`}
            className="text-gray-600 hover:text-gray-700 text-sm font-medium"
          >
            Details
          </Link>
        </div>
      </td>
    </tr>
  );
}

function ReportRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-5 bg-gray-200 rounded w-32 mb-1"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-28"></div>
      </td>
    </tr>
  );
}

export default function ReportsList({ reports, loading }: ReportsListProps) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metrics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <ReportRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="card text-center py-12">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
        <p className="text-gray-600 mb-4">Generate your first report from a profile</p>
        <Link href="/profiles" className="btn-primary">
          View Profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metrics</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
