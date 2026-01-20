'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GeneratedReport } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.data?.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (profileId: string) => {
    setGenerating(true);
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          sendWhatsApp: true,
        }),
      });

      if (response.ok) {
        await fetchReports();
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: 'badge-success',
      generating: 'badge-warning',
      pending: 'badge-info',
      failed: 'badge-error',
    };
    return styles[status] || 'badge-info';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">View and generate marketing reports</p>
        </div>
        <Link href="/profiles" className="btn-primary">
          Manage Profiles
        </Link>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-gray-100">
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-48"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      ) : reports.length === 0 ? (
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
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Generated</th>
                <th>Status</th>
                <th>Metrics</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div>
                      <p className="font-medium text-gray-900">Report #{report.id.slice(-8)}</p>
                      <p className="text-sm text-gray-500">Profile: {report.profileId.slice(-8)}</p>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm text-gray-900">
                      {formatDate(report.generatedAt, 'short')}
                    </p>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(report.status)}`}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm">
                      <p className="text-gray-900">
                        Spend: {formatCurrency(report.metrics?.totalSpend || 0)}
                      </p>
                      <p className="text-gray-500">
                        ROAS: {(report.metrics?.roas || 0).toFixed(2)}x
                      </p>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {report.pdfUrl && (
                        <a
                          href={report.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-sm py-1"
                        >
                          View PDF
                        </a>
                      )}
                      <Link
                        href={`/reports/${report.id}`}
                        className="btn-secondary text-sm py-1"
                      >
                        Details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
