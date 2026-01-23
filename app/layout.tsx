import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Marketing Dashboard SaaS',
  description: 'Aggregate daily reports from GA4, Google Ads, Meta Ads, and LinkedIn Ads',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
