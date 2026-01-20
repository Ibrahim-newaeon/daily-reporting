'use client';

import Link from 'next/link';
import { ReportProfile, Platform } from '@/lib/types';
import { platformDisplayNames, platformColors } from '@/lib/utils';

interface ProfileGridProps {
  profiles: ReportProfile[];
  loading?: boolean;
  onGenerateReport?: (profileId: string) => void;
}

function ProfileCard({
  profile,
  onGenerateReport,
}: {
  profile: ReportProfile;
  onGenerateReport?: (profileId: string) => void;
}) {
  return (
    <div className="card card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{profile.name}</h3>
          {profile.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{profile.description}</p>
          )}
        </div>
        <span
          className={`badge ml-2 ${
            profile.isActive ? 'badge-success' : 'badge-warning'
          }`}
        >
          {profile.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Platforms */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.platforms.map((platform: Platform) => (
          <span
            key={platform}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${platformColors[platform]}15`,
              color: platformColors[platform],
            }}
          >
            {platformDisplayNames[platform]}
          </span>
        ))}
      </div>

      {/* Schedule Info */}
      {profile.schedule?.enabled && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {profile.schedule.frequency.charAt(0).toUpperCase() + profile.schedule.frequency.slice(1)} at {profile.schedule.time}
          </span>
        </div>
      )}

      {/* Recipients */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span>{profile.whatsappRecipients?.length || 0} recipients</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <Link
          href={`/profiles/${profile.id}`}
          className="btn-secondary text-sm flex-1 text-center"
        >
          Edit
        </Link>
        {onGenerateReport && (
          <button
            onClick={() => onGenerateReport(profile.id)}
            className="btn-primary text-sm flex-1"
          >
            Generate Report
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-5 bg-gray-200 rounded w-32"></div>
        <div className="h-5 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-gray-200 rounded w-20"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <div className="h-9 bg-gray-200 rounded flex-1"></div>
        <div className="h-9 bg-gray-200 rounded flex-1"></div>
      </div>
    </div>
  );
}

export default function ProfileGrid({ profiles, loading, onGenerateReport }: ProfileGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <ProfileCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles</h3>
        <p className="text-gray-600 mb-4">Create your first report profile to get started</p>
        <Link href="/profiles/new" className="btn-primary">
          Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          onGenerateReport={onGenerateReport}
        />
      ))}
    </div>
  );
}
