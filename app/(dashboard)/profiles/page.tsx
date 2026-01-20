'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ReportProfile, Platform } from '@/lib/types';
import { platformDisplayNames } from '@/lib/utils';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ReportProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.data?.profiles || []);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      const response = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProfiles(profiles.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Profiles</h1>
          <p className="text-gray-600">Manage your report configurations</p>
        </div>
        <Link href="/profiles/new" className="btn-primary">
          Create Profile
        </Link>
      </div>

      {/* Profiles List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles yet</h3>
          <p className="text-gray-600 mb-4">Create your first report profile to get started</p>
          <Link href="/profiles/new" className="btn-primary">
            Create Profile
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <div key={profile.id} className="card card-hover">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  {profile.description && (
                    <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
                  )}
                </div>
                <span
                  className={`badge ${
                    profile.isActive ? 'badge-success' : 'badge-warning'
                  }`}
                >
                  {profile.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Platforms */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {profile.platforms.map((platform: Platform) => (
                    <span key={platform} className="badge badge-info">
                      {platformDisplayNames[platform] || platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              {profile.schedule?.enabled && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Schedule</p>
                  <p className="text-sm text-gray-700">
                    {profile.schedule.frequency.charAt(0).toUpperCase() + profile.schedule.frequency.slice(1)} at {profile.schedule.time}
                  </p>
                </div>
              )}

              {/* Recipients */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Recipients</p>
                <p className="text-sm text-gray-700">
                  {profile.whatsappRecipients?.length || 0} WhatsApp recipients
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <Link
                  href={`/profiles/${profile.id}`}
                  className="btn-secondary text-sm flex-1 text-center"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="btn-danger text-sm px-4"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
