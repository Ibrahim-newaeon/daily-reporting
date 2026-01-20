'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Platform } from '@/lib/types';
import { platformDisplayNames, platformColors } from '@/lib/utils';

interface ConnectorStatus {
  platform: Platform;
  connected: boolean;
  expired: boolean;
  accountId: string | null;
  accountName: string | null;
  needsReauth: boolean;
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

export default function ConnectorsPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Platform | null>(null);

  useEffect(() => {
    fetchConnectorStatus();
  }, []);

  const fetchConnectorStatus = async () => {
    try {
      const response = await fetch('/api/connectors/status');
      if (response.ok) {
        const data = await response.json();
        setConnectors(data.data?.connectors || []);
      }
    } catch (error) {
      console.error('Error fetching connector status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (platform: Platform) => {
    window.location.href = `/api/connectors/oauth/authorize?platform=${platform}&returnUrl=/connectors`;
  };

  const handleDisconnect = async (platform: Platform) => {
    if (!confirm(`Are you sure you want to disconnect ${platformDisplayNames[platform]}?`)) return;

    try {
      const response = await fetch(`/api/connectors/status?platform=${platform}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchConnectorStatus();
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleSync = async (platform: Platform) => {
    setSyncing(platform);
    try {
      const response = await fetch('/api/connectors/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: [platform],
          dateRange: 'last7days',
        }),
      });

      if (response.ok) {
        alert('Data synced successfully!');
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync data');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
        <p className="text-gray-600">Connect your marketing platforms to sync data</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          Successfully connected {platformDisplayNames[success as Platform] || success}!
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Failed to connect: {error}
        </div>
      )}

      {/* Connectors Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connectors.map((connector) => (
            <div key={connector.platform} className="card">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${platformColors[connector.platform]}20` }}
                >
                  <div style={{ color: platformColors[connector.platform] }}>
                    {PLATFORM_ICONS[connector.platform]}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {platformDisplayNames[connector.platform]}
                    </h3>
                    <span
                      className={`badge ${
                        connector.connected && !connector.needsReauth
                          ? 'badge-success'
                          : connector.needsReauth
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}
                    >
                      {connector.connected && !connector.needsReauth
                        ? 'Connected'
                        : connector.needsReauth
                        ? 'Needs Reauth'
                        : 'Not Connected'}
                    </span>
                  </div>

                  {connector.connected && connector.accountName && (
                    <p className="text-sm text-gray-600 mb-3">
                      Account: {connector.accountName}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {connector.connected ? (
                      <>
                        <button
                          onClick={() => handleSync(connector.platform)}
                          disabled={syncing === connector.platform}
                          className="btn-primary text-sm py-1.5"
                        >
                          {syncing === connector.platform ? 'Syncing...' : 'Sync Data'}
                        </button>
                        {connector.needsReauth && (
                          <button
                            onClick={() => handleConnect(connector.platform)}
                            className="btn-secondary text-sm py-1.5"
                          >
                            Reconnect
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(connector.platform)}
                          className="btn-secondary text-sm py-1.5 text-red-600 hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(connector.platform)}
                        className="btn-primary text-sm py-1.5"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary-600">1</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Connect</h3>
            <p className="text-sm text-gray-600">
              Click Connect to authorize access to your marketing accounts
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary-600">2</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Sync</h3>
            <p className="text-sm text-gray-600">
              Data is automatically synced daily, or sync manually anytime
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary-600">3</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Report</h3>
            <p className="text-sm text-gray-600">
              Create profiles and generate automated reports
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
