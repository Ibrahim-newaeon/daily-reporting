'use client';

import { Platform } from '@/lib/types';
import { platformDisplayNames, platformColors } from '@/lib/utils';

interface ConnectorCardProps {
  platform: Platform;
  connected: boolean;
  expired?: boolean;
  accountName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync?: () => void;
  syncing?: boolean;
}

const PLATFORM_ICONS: Record<Platform, JSX.Element> = {
  ga4: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  ),
  google_ads: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M3.654 1.328a.678.678 0 00-.895.256L.082 6.5a.678.678 0 00.248.895l18.412 10.627a.678.678 0 00.895-.248l2.676-4.918a.678.678 0 00-.248-.895L3.654 1.328z"/>
      <circle cx="19.5" cy="18.5" r="4"/>
    </svg>
  ),
  meta: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
};

export default function ConnectorCard({
  platform,
  connected,
  expired,
  accountName,
  onConnect,
  onDisconnect,
  onSync,
  syncing,
}: ConnectorCardProps) {
  const needsReauth = connected && expired;

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${platformColors[platform]}20` }}
        >
          <div style={{ color: platformColors[platform] }}>
            {PLATFORM_ICONS[platform]}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {platformDisplayNames[platform]}
            </h3>
            <span
              className={`badge shrink-0 ${
                connected && !needsReauth
                  ? 'badge-success'
                  : needsReauth
                  ? 'badge-warning'
                  : 'badge-info'
              }`}
            >
              {connected && !needsReauth
                ? 'Connected'
                : needsReauth
                ? 'Expired'
                : 'Not Connected'}
            </span>
          </div>

          {connected && accountName && (
            <p className="text-sm text-gray-600 mb-3 truncate">
              Account: {accountName}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                {onSync && (
                  <button
                    onClick={onSync}
                    disabled={syncing}
                    className="btn-primary text-sm py-1.5"
                  >
                    {syncing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      'Sync Data'
                    )}
                  </button>
                )}
                {needsReauth && (
                  <button
                    onClick={onConnect}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  onClick={onDisconnect}
                  className="btn-secondary text-sm py-1.5 text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={onConnect}
                className="btn-primary text-sm py-1.5"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
