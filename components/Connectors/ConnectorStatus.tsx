'use client';

import { Platform } from '@/lib/types';
import { platformDisplayNames, platformColors } from '@/lib/utils';

interface ConnectorStatusProps {
  connectors: Array<{
    platform: Platform;
    connected: boolean;
    expired?: boolean;
    lastSyncAt?: string;
  }>;
  compact?: boolean;
}

export default function ConnectorStatus({ connectors, compact = false }: ConnectorStatusProps) {
  const connectedCount = connectors.filter(c => c.connected && !c.expired).length;
  const expiredCount = connectors.filter(c => c.expired).length;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {connectors.map((connector) => (
          <div
            key={connector.platform}
            className="relative"
            title={`${platformDisplayNames[connector.platform]}: ${
              connector.connected && !connector.expired
                ? 'Connected'
                : connector.expired
                ? 'Expired'
                : 'Not Connected'
            }`}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: connector.connected
                  ? `${platformColors[connector.platform]}20`
                  : '#f3f4f6',
              }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: connector.connected && !connector.expired
                    ? platformColors[connector.platform]
                    : connector.expired
                    ? '#f59e0b'
                    : '#d1d5db',
                }}
              />
            </div>
            {connector.expired && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-white" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Connected Platforms</h3>
        <span className="text-sm text-gray-500">
          {connectedCount} of {connectors.length} connected
        </span>
      </div>

      {expiredCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          {expiredCount} connection{expiredCount > 1 ? 's need' : ' needs'} to be refreshed
        </div>
      )}

      <div className="space-y-3">
        {connectors.map((connector) => (
          <div
            key={connector.platform}
            className="flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: connector.connected
                    ? `${platformColors[connector.platform]}15`
                    : '#f9fafb',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full"
                  style={{
                    backgroundColor: connector.connected && !connector.expired
                      ? platformColors[connector.platform]
                      : connector.expired
                      ? '#f59e0b'
                      : '#e5e7eb',
                  }}
                />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {platformDisplayNames[connector.platform]}
                </p>
                {connector.lastSyncAt && (
                  <p className="text-xs text-gray-500">
                    Last synced: {new Date(connector.lastSyncAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <span
              className={`badge ${
                connector.connected && !connector.expired
                  ? 'badge-success'
                  : connector.expired
                  ? 'badge-warning'
                  : 'badge-info'
              }`}
            >
              {connector.connected && !connector.expired
                ? 'Connected'
                : connector.expired
                ? 'Expired'
                : 'Not Connected'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
