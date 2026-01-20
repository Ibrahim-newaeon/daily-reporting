# Operations Guide

This document covers operational aspects of the Marketing Dashboard SaaS application.

## Table of Contents

1. [API Versioning Strategy](#api-versioning-strategy)
2. [Backup and Recovery](#backup-and-recovery)
3. [Scaling Guide](#scaling-guide)
4. [Monitoring](#monitoring)

---

## API Versioning Strategy

### Current Version

The current API version is **v1** (implicit). All endpoints are accessible at `/api/*`.

### Future Versioning Plan

When breaking changes are needed, implement URL-based versioning:

```
/api/v1/profiles    (current behavior)
/api/v2/profiles    (new version with breaking changes)
```

### Versioning Guidelines

1. **Minor changes** (non-breaking):
   - Adding new optional fields to responses
   - Adding new endpoints
   - Adding new optional query parameters
   - No version bump required

2. **Major changes** (breaking):
   - Removing fields from responses
   - Changing field types
   - Renaming endpoints
   - Changing required parameters
   - Requires new version (v2, v3, etc.)

### Implementation Pattern

```typescript
// app/api/v2/profiles/route.ts
export async function GET(request: NextRequest) {
  // New v2 implementation
}

// Deprecation header for v1
response.headers.set('Deprecation', 'true');
response.headers.set('Sunset', '2025-06-01');
response.headers.set('Link', '</api/v2/profiles>; rel="successor-version"');
```

### Deprecation Policy

- Announce deprecation at least 6 months before sunset
- Add `Deprecation` and `Sunset` headers to old versions
- Maintain old versions for minimum 12 months after deprecation
- Document migration guides for each version upgrade

---

## Backup and Recovery

### Firestore Backup

#### Automated Daily Backups

Set up automated exports to Cloud Storage:

```bash
# Create a Cloud Scheduler job for daily backups
gcloud scheduler jobs create http firestore-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --message-body='{
    "outputUriPrefix": "gs://${BACKUP_BUCKET}/firestore-backups",
    "collectionIds": ["users", "generatedReports", "auditLogs"]
  }' \
  --time-zone="UTC"
```

#### Manual Backup

```bash
# Export all collections
gcloud firestore export gs://${BACKUP_BUCKET}/manual-backup-$(date +%Y%m%d)

# Export specific collections
gcloud firestore export gs://${BACKUP_BUCKET}/users-backup \
  --collection-ids=users,generatedReports
```

#### Restore from Backup

```bash
# Restore to the same database (destructive - existing data will be overwritten)
gcloud firestore import gs://${BACKUP_BUCKET}/firestore-backups/2024-01-15

# Restore to a different project (for testing)
gcloud firestore import gs://${BACKUP_BUCKET}/firestore-backups/2024-01-15 \
  --project=${TEST_PROJECT_ID}
```

### BigQuery Backup

BigQuery tables are automatically backed up by Google. For additional protection:

```bash
# Create a snapshot of the metrics table
bq cp \
  ${PROJECT_ID}:${DATASET}.metrics \
  ${PROJECT_ID}:${DATASET}_backups.metrics_$(date +%Y%m%d)

# Export to Cloud Storage
bq extract \
  --destination_format=NEWLINE_DELIMITED_JSON \
  ${PROJECT_ID}:${DATASET}.metrics \
  gs://${BACKUP_BUCKET}/bigquery/metrics_$(date +%Y%m%d).json
```

### Backup Retention Policy

| Data Type | Retention | Storage Location |
|-----------|-----------|------------------|
| Firestore (daily) | 30 days | gs://backups/firestore/ |
| Firestore (weekly) | 90 days | gs://backups/firestore-weekly/ |
| BigQuery snapshots | 7 days | Same dataset |
| Audit logs | 90 days | Firestore |

### Disaster Recovery Procedure

1. **Assess the situation**: Determine scope of data loss
2. **Stop incoming traffic**: Enable maintenance mode
3. **Identify backup point**: Find the most recent clean backup
4. **Restore data**: Use appropriate restore commands
5. **Verify integrity**: Run data validation checks
6. **Resume service**: Disable maintenance mode
7. **Post-mortem**: Document incident and improve procedures

---

## Scaling Guide

### Rate Limiting - Redis Migration

The current in-memory rate limiter works for single instances but doesn't scale horizontally. For production with multiple instances, migrate to Redis.

#### Step 1: Add Redis Dependency

```bash
npm install @upstash/redis
# or for self-hosted Redis:
npm install ioredis
```

#### Step 2: Update Rate Limiter

Create `lib/rate-limit-redis.ts`:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

  const [current] = await redis
    .multi()
    .incr(windowKey)
    .pexpire(windowKey, windowMs)
    .exec();

  const count = current as number;

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: (Math.floor(now / windowMs) + 1) * windowMs,
  };
}
```

#### Step 3: Environment Variables

```bash
# Upstash Redis (recommended for serverless)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Or self-hosted Redis
REDIS_URL=redis://localhost:6379
```

### Database Scaling

#### Firestore

- Enable automatic scaling in GCP Console
- Use composite indexes for complex queries
- Implement pagination for large collections
- Consider sharding for high-write scenarios

#### BigQuery

- Partition tables by date for efficient queries
- Use clustering on frequently filtered columns
- Set up slot reservations for predictable performance

### Horizontal Scaling Checklist

- [ ] Migrate rate limiting to Redis
- [ ] Use external session storage (Redis/Firestore)
- [ ] Ensure stateless API routes
- [ ] Configure load balancer health checks
- [ ] Set up auto-scaling policies
- [ ] Implement circuit breakers for external APIs

---

## Monitoring

### Health Check Endpoint

```
GET /api/health
```

Returns:
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is degraded or unhealthy

Use this endpoint for:
- Load balancer health checks
- Kubernetes liveness/readiness probes
- External monitoring services

### Recommended Monitoring Stack

1. **Application Performance**: Vercel Analytics or Datadog
2. **Error Tracking**: Sentry
3. **Log Aggregation**: Google Cloud Logging or Datadog
4. **Uptime Monitoring**: Pingdom or UptimeRobot
5. **Alerting**: PagerDuty or Opsgenie

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 1% | Alert |
| Response time (p95) | > 2s | Investigate |
| Memory usage | > 80% | Scale up |
| Rate limit hits | > 100/min | Review limits |
| Failed OAuth refreshes | > 5/hour | Alert |

### Setting Up Alerts

```bash
# Example: Create a Cloud Monitoring alert
gcloud alpha monitoring policies create \
  --notification-channels=${CHANNEL_ID} \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 1%" \
  --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"' \
  --condition-threshold-value=0.01 \
  --condition-threshold-comparison=COMPARISON_GT
```
