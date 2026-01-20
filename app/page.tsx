'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();

  // Check for existing auth and redirect
  useEffect(() => {
    // Check if user is already logged in via cookie
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/connectors/status');
        if (response.ok) {
          router.push('/dashboard');
        }
      } catch {
        // Not authenticated, stay on landing page
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100">
      {/* Header */}
      <header className="px-6 py-4">
        <nav className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Marketing Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium">
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            All Your Marketing Data
            <span className="text-primary-600"> In One Place</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Aggregate daily reports from GA4, Google Ads, Meta Ads, and LinkedIn Ads.
            Generate PDF reports automatically and receive them via WhatsApp.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/signup" className="btn-primary text-lg px-8 py-3">
              Start Free Trial
            </Link>
            <Link href="/login" className="btn-secondary text-lg px-8 py-3">
              View Demo
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          <div className="card card-hover">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Platform Integration</h3>
            <p className="text-gray-600">
              Connect GA4, Google Ads, Meta Ads, and LinkedIn Ads with a single click.
              All your data synchronized automatically.
            </p>
          </div>

          <div className="card card-hover">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Automated PDF Reports</h3>
            <p className="text-gray-600">
              Generate beautiful, customizable PDF reports daily.
              Share insights with your team effortlessly.
            </p>
          </div>

          <div className="card card-hover">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">WhatsApp Delivery</h3>
            <p className="text-gray-600">
              Receive your reports directly on WhatsApp.
              Stay updated on your marketing performance anywhere.
            </p>
          </div>
        </div>

        {/* Platform Logos */}
        <div className="mt-24 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-8">Integrates With</p>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              <span className="font-medium">Google Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.82 9.834c-.054.33-.054.66-.054.99 0 1.32-.33 2.706-.99 3.96-.66 1.254-1.65 2.376-2.97 3.3-1.32.924-2.97 1.452-4.95 1.452-1.98 0-3.762-.528-5.346-1.584.264.033.528.033.858.033 1.65 0 3.168-.528 4.356-1.452-1.518-.033-2.838-1.056-3.3-2.442.198.033.462.066.66.066.33 0 .66-.033.99-.132-1.584-.33-2.772-1.716-2.772-3.432v-.033c.462.264.99.396 1.584.429-.924-.627-1.518-1.65-1.518-2.838 0-.627.165-1.188.462-1.716 1.716 2.112 4.29 3.498 7.194 3.63-.066-.264-.066-.528-.066-.792 0-1.914 1.518-3.432 3.432-3.432.99 0 1.914.429 2.508 1.089.792-.165 1.518-.429 2.178-.825-.264.825-.825 1.518-1.518 1.947.66-.066 1.32-.264 1.914-.495-.462.66-.99 1.254-1.65 1.716z"/>
              </svg>
              <span className="font-medium">Google Ads</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="font-medium">Meta Ads</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="font-medium">LinkedIn Ads</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Marketing Dashboard SaaS. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Privacy</a>
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Terms</a>
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
