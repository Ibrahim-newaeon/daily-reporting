'use client';

import { useState } from 'react';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  actions?: React.ReactNode;
}

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
];

export default function DashboardHeader({
  title,
  subtitle,
  dateRange,
  onDateRangeChange,
  actions,
}: DashboardHeaderProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Date Range Selector */}
        <div className="relative">
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="input w-auto pr-8"
          >
            {DATE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range Button */}
        <button
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          className="btn-secondary p-2"
          title="Custom date range"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Refresh Button */}
        <button
          onClick={() => onDateRangeChange(dateRange)}
          className="btn-secondary p-2"
          title="Refresh data"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Additional Actions */}
        {actions}
      </div>
    </div>
  );
}
