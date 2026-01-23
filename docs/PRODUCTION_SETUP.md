# Production Environment Setup Guide

This guide walks you through setting up the Daily Reporting application for production deployment.

## Prerequisites

- Node.js 18+ (required for native fetch API)
- Docker and Docker Compose (for containerized deployment)
- Firebase project (Firestore, Authentication, Storage)
- Redis instance (for rate limiting in production)
- SSL certificate for your domain

## 1. Environment Variables

Create a `.env.production` file with the following variables:

### Application Settings

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate-32-char-random-string>
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Token Encryption

```env
TOKEN_ENCRYPTION_KEY=<generate-64-hex-chars>
```

**Generate encryption key:**
```bash
openssl rand -hex 32
```

### Firebase Configuration

```env
# Client-side (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Server-side (private)
FIREBASE_ADMIN_SDK_KEY=<base64-encoded-service-account-json>
```

**Encode service account:**
```bash
cat service-account.json | base64 -w 0
```

### Google OAuth & APIs

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GA4_PROPERTY_ID=your-property-id
```

### Meta/Facebook APIs

```env
NEXT_PUBLIC_META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
```

### TikTok APIs

```env
TIKTOK_APP_ID=your-app-id
TIKTOK_APP_SECRET=your-app-secret
```

### Snapchat APIs

```env
SNAP_CLIENT_ID=your-client-id
SNAP_CLIENT_SECRET=your-client-secret
```

### Redis (Required for Production)

```env
REDIS_URL=redis://username:password@your-redis-host:6379
```

### Sentry Error Monitoring (Recommended)

```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=daily-reporting
SENTRY_AUTH_TOKEN=your-auth-token
```

### BigQuery (Optional)

```env
BIGQUERY_PROJECT_ID=your-project-id
BIGQUERY_DATASET_ID=your-dataset-id
```

### Cloud Storage (Optional)

```env
GCS_BUCKET=your-bucket-name
```

## 2. Firebase Setup

### 2.1 Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

Or manually copy `firestore.rules` content to Firebase Console.

### 2.2 Enable Authentication Providers

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable Email/Password
3. Enable Google (if using Google Sign-in)

### 2.3 Configure OAuth Redirect URIs

Add production redirect URIs:
- `https://yourdomain.com/api/auth/callback/google`
- `https://yourdomain.com/api/auth/callback/meta`
- `https://yourdomain.com/api/auth/callback/tiktok`
- `https://yourdomain.com/api/auth/callback/snap`

## 3. OAuth App Configuration

### Google Cloud Console

1. Go to APIs & Services → Credentials
2. Edit your OAuth 2.0 Client
3. Add authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
4. Enable required APIs:
   - Google Ads API
   - Google Analytics Data API

### Meta Developer Portal

1. Go to your app settings
2. Add Valid OAuth Redirect URIs: `https://yourdomain.com/api/auth/callback/meta`
3. Set App Mode to "Live"

### TikTok Developer Portal

1. Go to your app settings
2. Add Redirect URI: `https://yourdomain.com/api/auth/callback/tiktok`
3. Submit for review if required

### Snapchat Business Manager

1. Go to your app settings
2. Add Redirect URIs: `https://yourdomain.com/api/auth/callback/snap`

## 4. Deployment Options

### Option A: Docker Compose (Recommended)

1. Build and start:
```bash
docker-compose -f docker-compose.yml up -d --build
```

2. View logs:
```bash
docker-compose logs -f app
```

3. Stop:
```bash
docker-compose down
```

### Option B: Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Set environment variables in Vercel Dashboard.

### Option C: Google Cloud Run

1. Build and push image:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/daily-reporting
```

2. Deploy:
```bash
gcloud run deploy daily-reporting \
  --image gcr.io/PROJECT_ID/daily-reporting \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"
```

### Option D: AWS ECS/Fargate

1. Push to ECR:
```bash
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t daily-reporting .
docker tag daily-reporting:latest $ECR_REGISTRY/daily-reporting:latest
docker push $ECR_REGISTRY/daily-reporting:latest
```

2. Update ECS service:
```bash
aws ecs update-service --cluster prod --service daily-reporting --force-new-deployment
```

## 5. SSL/TLS Configuration

### Using Let's Encrypt (Docker)

Add to docker-compose.yml:

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt
    command: certonly --webroot -w /var/www/certbot -d yourdomain.com --email your@email.com --agree-tos
```

### Using Cloudflare

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Configure origin certificate

## 6. Health Checks

### Verify Deployment

```bash
# Check health endpoint
curl https://yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-23T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": { "status": "pass", "latencyMs": 45 },
    "redis": { "status": "pass", "latencyMs": 12 },
    "memory": { "status": "pass", "message": "..." },
    "environment": { "status": "pass" }
  }
}
```

### Set Up Monitoring

1. **UptimeRobot** or **Pingdom**: Monitor `https://yourdomain.com/api/health`
2. **Sentry**: Errors are automatically reported
3. **Cloud Monitoring**: Set up alerts for:
   - Response time > 2 seconds
   - Error rate > 1%
   - Memory usage > 80%

## 7. Backup Strategy

### Firestore Backups

Enable automated backups in Firebase Console or use:

```bash
gcloud firestore export gs://your-backup-bucket/$(date +%Y-%m-%d)
```

### Schedule with Cloud Scheduler:

```bash
gcloud scheduler jobs create http firestore-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default):exportDocuments" \
  --oauth-service-account-email=SERVICE_ACCOUNT_EMAIL
```

## 8. Security Checklist

- [ ] All environment variables set (no defaults in production)
- [ ] NEXTAUTH_SECRET is unique and secure
- [ ] TOKEN_ENCRYPTION_KEY is 64 hex characters
- [ ] Firestore security rules deployed
- [ ] OAuth redirect URIs match production domain
- [ ] HTTPS enforced (HSTS header configured)
- [ ] Rate limiting working (Redis connected)
- [ ] Error monitoring active (Sentry configured)
- [ ] No debug/development endpoints exposed

## 9. Troubleshooting

### Common Issues

**PDF generation fails:**
- Ensure Chromium is installed in Docker container
- Check `PUPPETEER_EXECUTABLE_PATH` environment variable

**Rate limiting not working:**
- Verify `REDIS_URL` is correct
- Check Redis connectivity in health endpoint

**OAuth callback fails:**
- Verify redirect URIs match exactly (including trailing slashes)
- Check OAuth app is in production mode

**Firebase connection issues:**
- Verify `FIREBASE_ADMIN_SDK_KEY` is properly base64 encoded
- Check Firebase project permissions

### View Logs

```bash
# Docker
docker-compose logs -f app

# Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=daily-reporting"

# Vercel
vercel logs your-deployment-url
```

## 10. Rollback Procedure

If critical issues occur after deployment:

```bash
# Docker: Tag and use previous image
docker tag daily-reporting:previous daily-reporting:latest
docker-compose up -d

# Vercel
vercel rollback

# Cloud Run
gcloud run services update-traffic daily-reporting --to-revisions=PREVIOUS_REVISION=100

# ECS
aws ecs update-service --cluster prod --service daily-reporting --task-definition PREVIOUS_TASK_DEF
```

---

## Support

For issues, check:
1. Health endpoint: `/api/health`
2. Sentry dashboard for errors
3. Application logs
4. Firebase Console for database issues
