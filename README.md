# Marketing Dashboard SaaS

A full-stack Marketing Dashboard that aggregates daily reports from GA4, Google Ads, Meta Ads, and LinkedIn Ads, generates PDF reports, and delivers them via WhatsApp.

## Features

- **Multi-Platform Integration**: Connect GA4, Google Ads, Meta Ads, and LinkedIn Ads via OAuth
- **Automated Reports**: Schedule daily, weekly, or monthly PDF report generation
- **WhatsApp Delivery**: Receive reports directly on WhatsApp
- **Interactive Dashboard**: View real-time metrics with charts and analytics
- **Profile Management**: Create custom report profiles with selected metrics
- **Secure Authentication**: Firebase Auth with session management

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Recharts
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Firebase Firestore (user data) + BigQuery (metrics history)
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud Functions, Cloud Storage, Cloud Scheduler)
- **APIs**: GA4 Reporting API, Google Ads API, Meta Graph API, LinkedIn Ads API
- **PDF**: Puppeteer
- **Messaging**: WhatsApp Cloud API
- **Auth**: Firebase Auth + OAuth 2.0

## Project Structure

```
marketing-dashboard-saas/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages (login, signup)
│   ├── (dashboard)/       # Dashboard pages (profiles, reports, connectors, settings)
│   └── api/               # API routes
├── lib/                    # Shared libraries
│   ├── apis/              # Platform API clients (GA4, Google Ads, Meta, LinkedIn, WhatsApp)
│   ├── firebase.ts        # Firebase configuration
│   ├── bigquery.ts        # BigQuery client
│   ├── auth.ts            # Authentication utilities
│   ├── types.ts           # TypeScript types and Zod schemas
│   └── utils.ts           # Helper functions
├── components/            # React components
│   ├── Common/           # Shared components (LoadingSpinner, ErrorBoundary, etc.)
│   ├── Dashboard/        # Dashboard-specific components
│   ├── Connectors/       # Platform connector components
│   └── Reports/          # Report-related components
├── functions/            # Cloud Functions
│   └── generateDailyReports.ts
├── scripts/              # Deployment and utility scripts
├── .env.example          # Environment variables template
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud Platform account
- Firebase project
- Meta/Facebook Developer account
- LinkedIn Developer account
- WhatsApp Business API access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd marketing-dashboard-saas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

See `.env.example` for all required variables:

- **GCP**: Project ID, service account key, BigQuery dataset
- **Firebase**: API keys and admin SDK
- **OAuth**: Google, Meta, LinkedIn client credentials
- **WhatsApp**: Phone ID and access token
- **App**: URLs and secrets

## Deployment

### Vercel (Frontend)

```bash
vercel
vercel --prod
```

### Google Cloud Functions

```bash
chmod +x scripts/deploy-functions.sh
./scripts/deploy-functions.sh
```

### BigQuery Setup

```bash
bq query --use_legacy_sql=false < scripts/setup-bigquery.sql
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `GET/POST /api/auth/callback` - OAuth callback

### Connectors
- `GET /api/connectors/oauth/authorize` - Start OAuth flow
- `GET /api/connectors/oauth/callback` - OAuth callback
- `GET /api/connectors/status` - Get connection status
- `POST /api/connectors/sync` - Sync platform data

### Profiles
- `GET /api/profiles` - List profiles
- `POST /api/profiles` - Create profile
- `GET /api/profiles/[id]` - Get profile
- `PUT /api/profiles/[id]` - Update profile
- `DELETE /api/profiles/[id]` - Delete profile

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/[id]` - Get report details

### Data
- `GET /api/data/metrics` - Get metrics data
- `GET /api/data/summary` - Get summary with comparisons

### Webhooks
- `GET/POST /api/webhooks/whatsapp` - WhatsApp webhook

## Cost Estimate

| Component | Cost | Notes |
|-----------|------|-------|
| Google Cloud Platform | ~$15-20/user/mo | BigQuery, Cloud Run, Storage |
| Firebase | ~$5-10/user/mo | Firestore, Auth |
| WhatsApp API | ~$0.02/message | Pay-per-use |
| Vercel | FREE-$50 | Free tier includes 100k requests |
| **Total** | **~$20-30/user/month** | |

## License

MIT
