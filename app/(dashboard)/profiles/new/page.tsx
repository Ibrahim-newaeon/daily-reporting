'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Platform } from '@/lib/types';
import { platformDisplayNames } from '@/lib/utils';

// All supported platforms including TikTok and Snapchat
const PLATFORMS: Platform[] = ['ga4', 'google_ads', 'meta', 'linkedin', 'tiktok', 'snapchat'];

// Validation constants
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export default function NewProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [isActive, setIsActive] = useState(true);

  const handlePlatformToggle = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
    // Clear platform error when user selects one
    if (validationErrors.platforms) {
      setValidationErrors(prev => ({ ...prev, platforms: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Profile name is required';
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.name = `Profile name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    // Validate description
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
    }

    // Validate platforms
    if (selectedPlatforms.length === 0) {
      errors.platforms = 'Please select at least one platform';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          platforms: selectedPlatforms,
          isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create profile');
      }

      const data = await response.json();
      router.push(`/profiles/${data.data.profile.id}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create profile';
      // Sanitize error message - don't display HTML content
      setError(errorMessage.replace(/<[^>]*>/g, ''));
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Create Report Profile</h1>
        <p className="text-gray-600">Set up a new report configuration</p>
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
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors(prev => ({ ...prev, name: '' }));
                }
              }}
              className={`input ${validationErrors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="e.g., Weekly Marketing Report"
              maxLength={MAX_NAME_LENGTH}
              required
              aria-invalid={!!validationErrors.name}
              aria-describedby={validationErrors.name ? 'name-error' : undefined}
            />
            {validationErrors.name && (
              <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.name}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {name.length}/{MAX_NAME_LENGTH} characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="label">Description (Optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (validationErrors.description) {
                  setValidationErrors(prev => ({ ...prev, description: '' }));
                }
              }}
              className={`input ${validationErrors.description ? 'border-red-500 focus:ring-red-500' : ''}`}
              rows={3}
              placeholder="Brief description of this report profile..."
              maxLength={MAX_DESCRIPTION_LENGTH}
              aria-invalid={!!validationErrors.description}
              aria-describedby={validationErrors.description ? 'description-error' : undefined}
            />
            {validationErrors.description && (
              <p id="description-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {description.length}/{MAX_DESCRIPTION_LENGTH} characters
            </p>
          </div>

          {/* Platforms */}
          <fieldset>
            <legend className="label">Data Sources</legend>
            <p className="text-sm text-gray-500 mb-3">Select the platforms to include in this report</p>
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-describedby={validationErrors.platforms ? 'platforms-error' : undefined}
            >
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handlePlatformToggle(platform)}
                  aria-pressed={selectedPlatforms.includes(platform)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedPlatforms.includes(platform)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : validationErrors.platforms
                      ? 'border-red-300 hover:border-red-400'
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
            {validationErrors.platforms && (
              <p id="platforms-error" className="mt-2 text-sm text-red-600" role="alert">
                {validationErrors.platforms}
              </p>
            )}
          </fieldset>

          {/* Active Status */}
          <div className="flex items-center gap-3">
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
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Profile'}
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
