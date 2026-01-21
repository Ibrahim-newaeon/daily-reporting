'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ReportProfile, Platform, WhatsAppRecipient } from '@/lib/types';
import { platformDisplayNames, generateId, validatePhoneNumber } from '@/lib/utils';

const PLATFORMS: Platform[] = ['ga4', 'google_ads', 'meta', 'linkedin'];

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleTime, setScheduleTime] = useState('08:00');

  useEffect(() => {
    fetchProfile();
  }, [profileId]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profiles/${profileId}`);
      if (!response.ok) throw new Error('Profile not found');

      const data = await response.json();
      const profile: ReportProfile = data.data.profile;

      setName(profile.name);
      setDescription(profile.description || '');
      setSelectedPlatforms(profile.platforms);
      setIsActive(profile.isActive);
      setRecipients(profile.whatsappRecipients || []);
      setScheduleEnabled(profile.schedule?.enabled || false);
      setScheduleFrequency(profile.schedule?.frequency || 'daily');
      setScheduleTime(profile.schedule?.time || '08:00');
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformToggle = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleAddRecipient = () => {
    setRecipients([
      ...recipients,
      {
        id: generateId('recipient'),
        name: '',
        number: '',
        isActive: true,
      },
    ]);
  };

  const handleUpdateRecipient = (id: string, field: keyof WhatsAppRecipient, value: string | boolean) => {
    setRecipients(recipients.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      setSaving(false);
      return;
    }

    // Validate recipients
    for (const recipient of recipients) {
      if (recipient.name && !validatePhoneNumber(recipient.number)) {
        setError(`Invalid phone number for ${recipient.name}`);
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          platforms: selectedPlatforms,
          isActive,
          whatsappRecipients: recipients.filter(r => r.name && r.number),
          schedule: {
            enabled: scheduleEnabled,
            frequency: scheduleFrequency,
            time: scheduleTime,
            timezone: 'UTC',
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      router.push('/profiles');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <Link href="/profiles" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profiles
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
        <p className="text-gray-600">Update your report configuration</p>
      </div>

      {/* Form */}
      <div className="card">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Name */}
          <div>
            <label htmlFor="name" className="label">Profile Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="label">Data Sources</label>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handlePlatformToggle(platform)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedPlatforms.includes(platform)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedPlatforms.includes(platform)
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedPlatforms.includes(platform) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium">{platformDisplayNames[platform]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="label mb-0">Automated Reports</label>
                <p className="text-sm text-gray-500">Automatically generate and send reports</p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  scheduleEnabled ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    scheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Frequency</label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="input"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="label">Time (UTC)</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Recipients */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="label mb-0">WhatsApp Recipients</label>
                <p className="text-sm text-gray-500">People who will receive reports via WhatsApp</p>
              </div>
              <button
                type="button"
                onClick={handleAddRecipient}
                className="btn-secondary text-sm"
              >
                Add Recipient
              </button>
            </div>

            <div className="space-y-3">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="flex gap-3 items-start">
                  <input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => handleUpdateRecipient(recipient.id, 'name', e.target.value)}
                    className="input flex-1"
                    placeholder="Name"
                  />
                  <input
                    type="tel"
                    value={recipient.number}
                    onChange={(e) => handleUpdateRecipient(recipient.id, 'number', e.target.value)}
                    className="input flex-1"
                    placeholder="+1234567890"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(recipient.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {recipients.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No recipients added yet</p>
              )}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isActive ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-700">
              {isActive ? 'Profile is active' : 'Profile is inactive'}
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link href="/profiles" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
