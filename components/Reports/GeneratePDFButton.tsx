'use client';

import { useState } from 'react';

interface GeneratePDFButtonProps {
  profileId: string;
  profileName?: string;
  onSuccess?: (reportId: string, pdfUrl: string) => void;
  onError?: (error: string) => void;
  sendWhatsApp?: boolean;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export default function GeneratePDFButton({
  profileId,
  profileName,
  onSuccess,
  onError,
  sendWhatsApp = false,
  variant = 'primary',
  size = 'md',
}: GeneratePDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          sendWhatsApp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      if (onSuccess) {
        onSuccess(data.data.reportId, data.data.pdfUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      if (onError) {
        onError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className={`${variantClasses[variant]} ${sizeClasses[size]} inline-flex items-center gap-2`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Generating...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Generate Report{sendWhatsApp ? ' & Send' : ''}</span>
        </>
      )}
    </button>
  );
}
