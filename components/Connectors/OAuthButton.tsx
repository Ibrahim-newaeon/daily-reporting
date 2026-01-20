'use client';

import { Platform } from '@/lib/types';
import { platformDisplayNames, platformColors } from '@/lib/utils';

interface OAuthButtonProps {
  platform: Platform;
  connected?: boolean;
  loading?: boolean;
  onClick: () => void;
  variant?: 'full' | 'compact';
}

export default function OAuthButton({
  platform,
  connected = false,
  loading = false,
  onClick,
  variant = 'full',
}: OAuthButtonProps) {
  const color = platformColors[platform];
  const name = platformDisplayNames[platform];

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
          connected
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'text-white hover:opacity-90'
        }`}
        style={!connected ? { backgroundColor: color } : undefined}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : connected ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
        {connected ? 'Connected' : `Connect ${name}`}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 ${
        connected
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
          : 'text-white hover:opacity-90 shadow-md hover:shadow-lg'
      }`}
      style={!connected ? { backgroundColor: color } : undefined}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Connecting...</span>
        </>
      ) : connected ? (
        <>
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{name} Connected</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>Connect {name}</span>
        </>
      )}
    </button>
  );
}
