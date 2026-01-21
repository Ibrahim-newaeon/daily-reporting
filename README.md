# Marketing Dashboard SaaS

A full-stack Marketing Dashboard that aggregates daily reports from **GA4, Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads, and Snapchat Ads**, generates PDF reports, and delivers them via WhatsApp.

## Features

- **Multi-Platform Integration**: Connect 6 advertising platforms via OAuth:
  - Google Analytics 4 (GA4)
  - Google Ads
  - Meta (Facebook/Instagram) Ads
  - LinkedIn Ads
  - TikTok Ads
  - Snapchat Ads
- **Automated Reports**: Schedule daily, weekly, or monthly PDF report generation
- **WhatsApp Delivery**: Receive reports directly on WhatsApp
- **Interactive Dashboard**: View real-time metrics with charts and analytics
- **Profile Management**: Create custom report profiles with selected metrics
- **Secure Authentication**: Firebase Auth with session management
- **Enterprise Security**: Token encryption at rest, CSRF protection, rate limiting

## Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Recharts
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Firebase Firestore (user data) + BigQuery (metrics history)
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud Functions, Cloud Storage, Cloud Scheduler)
- **APIs**: GA4 Reporting API, Google Ads API, Meta Graph API, LinkedIn Ads API, TikTok Business API, Snapchat Marketing API
- **PDF**: Puppeteer
- **Messaging**: WhatsApp Cloud API
- **Auth**: Firebase Auth + OAuth 2.0
- **Security**: AES-256-GCM encryption, HMAC-signed state, rate limiting

## Project Structure

```
daily-reporting/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages (login, signup)
│   ├── (dashboard)/       # Dashboard pages (profiles, reports, connectors, settings)
│   └── api/               # API routes
│       ├── auth/          # Authentication endpoints
│       ├── connectors/    # OAuth and platform sync
│       ├── data/          # Metrics and summary data
│       ├── profiles/      # Report profile management
│       ├── reports/       # Report generation
│       └── webhooks/      # WhatsApp webhooks
├── components/            # React components
│   ├── Common/           # Shared components (LoadingSpinner, ErrorBoundary, ConfirmModal)
│   ├── Connectors/       # Platform connector components
│   ├── Dashboard/        # Dashboard-specific components
│   └── Reports/          # Report-related components
├── lib/                   # Shared libraries
│   ├── apis/             # Platform API clients
│   │   ├── ga4.ts        # Google Analytics 4
│   │   ├── google-ads.ts # Google Ads
│   │   ├── meta-ads.ts   # Meta (Facebook) Ads
│   │   ├── linkedin-ads.ts # LinkedIn Ads
│   │   ├── tiktok-ads.ts # TikTok Ads
│   │   ├── snap-ads.ts   # Snapchat Ads
│   │   └── whatsapp.ts   # WhatsApp Business API
│   ├── firebase.ts       # Firebase configuration
│   ├── bigquery.ts       # BigQuery client
│   ├── auth.ts           # Authentication utilities
│   ├── security.ts       # Security utilities (encryption, rate limiting)
│   ├── types.ts          # TypeScript types and Zod schemas
│   └── utils.ts          # Helper functions
├── functions/            # Cloud Functions
│   └── generateDailyReports.ts
├── docs/                 # Documentation
│   └── ads-reporting-integration.html
├── scripts/              # Deployment and utility scripts
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose orchestration
├── .env.example          # Environment variables template
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ (or Docker)
- Google Cloud Platform account
- Firebase project
- Meta/Facebook Developer account
- LinkedIn Developer account
- TikTok for Business Developer account
- Snapchat Business account
- WhatsApp Business API access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd daily-reporting
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

### Docker Deployment

#### Using Docker Compose (Recommended)

1. Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

2. Build and run:
```bash
docker-compose up --build
```

3. Access the app at `http://localhost:3000`

#### Using Docker Directly

```bash
# Build the image
docker build -t daily-reporting .

# Run the container
docker run -p 3000:3000 --env-file .env daily-reporting
```

#### Docker Commands

```bash
# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild after changes
docker-compose up --build -d
```

### Environment Variables

See `.env.example` for all required variables:

| Category | Variables |
|----------|-----------|
| **Firebase** | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_KEY` |
| **Google OAuth** | `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Google Ads** | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` |
| **Meta** | `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET` |
| **LinkedIn** | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| **TikTok** | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` |
| **Snapchat** | `SNAP_CLIENT_ID`, `SNAP_CLIENT_SECRET` |
| **WhatsApp** | `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN` |
| **BigQuery** | `BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET_ID` |
| **Security** | `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` |

#### Generating Security Keys

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate TOKEN_ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
```

## Security Features

This application implements enterprise-grade security:

- **Token Encryption**: OAuth tokens encrypted at rest using AES-256-GCM
- **CSRF Protection**: Cryptographically signed OAuth state parameters
- **Rate Limiting**: Protection against brute force and abuse
- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection Prevention**: Parameterized queries and input validation
- **XSS Prevention**: Content sanitization and CSP headers
- **Open Redirect Protection**: URL validation for OAuth callbacks
- **Audit Logging**: Security events logged for compliance
- **Secure Headers**: HSTS, X-Frame-Options, CSP, and more

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/logout` | User logout |

### Connectors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connectors/oauth/authorize` | Start OAuth flow |
| GET | `/api/connectors/oauth/callback` | OAuth callback |
| GET | `/api/connectors/status` | Get connection status |
| POST | `/api/connectors/sync` | Sync platform data |

### Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | List profiles |
| POST | `/api/profiles` | Create profile |
| GET | `/api/profiles/[id]` | Get profile |
| PUT | `/api/profiles/[id]` | Update profile |
| DELETE | `/api/profiles/[id]` | Delete profile |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | List reports |
| POST | `/api/reports/generate` | Generate report |
| GET | `/api/reports/[id]` | Get report details |

### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/metrics` | Get metrics data |
| GET | `/api/data/summary` | Get summary with comparisons |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/webhooks/whatsapp` | WhatsApp webhook |

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

### Cloud Run (Docker)

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/daily-reporting

# Deploy to Cloud Run
gcloud run deploy daily-reporting \
  --image gcr.io/PROJECT_ID/daily-reporting \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Platform Setup Guides

### TikTok Ads

1. Create an app at [TikTok for Business Developers](https://business-api.tiktok.com/)
2. Request access to the Marketing API
3. Configure OAuth redirect URL: `{APP_URL}/api/connectors/oauth/callback`
4. Add credentials to environment variables

### Snapchat Ads

1. Create an app at [Snapchat Business](https://business.snapchat.com/)
2. Enable the Marketing API
3. Configure OAuth redirect URL: `{APP_URL}/api/connectors/oauth/callback`
4. Add credentials to environment variables

## Cost Estimate

| Component | Cost | Notes |
|-----------|------|-------|
| Google Cloud Platform | ~$15-20/user/mo | BigQuery, Cloud Run, Storage |
| Firebase | ~$5-10/user/mo | Firestore, Auth |
| WhatsApp API | ~$0.02/message | Pay-per-use |
| Vercel | FREE-$50 | Free tier includes 100k requests |
| **Total** | **~$20-30/user/month** | |

## Documentation

- [Integration Guide](docs/ads-reporting-integration.html) - Comprehensive technical documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
