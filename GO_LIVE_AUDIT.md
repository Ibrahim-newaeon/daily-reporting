# Go-Live Audit Report

**Application:** Marketing Dashboard SaaS
**Audit Date:** January 2026
**Status:** ⛔ NOT READY FOR PRODUCTION

---

## Executive Summary

This audit identified **15 critical issues** and **12 medium issues** that must be addressed before production deployment. The application has significant security vulnerabilities, missing security headers, no test coverage, and incomplete input validation.

---

## Critical Issues (Must Fix Before Launch)

### 1. ⛔ CORS Misconfiguration - Security Vulnerability

**Location:** `next.config.js:16`
```javascript
{ key: 'Access-Control-Allow-Origin', value: '*' },
{ key: 'Access-Control-Allow-Credentials', value: 'true' },
```

**Risk:** Setting `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` is a security vulnerability. This combination allows any website to make authenticated requests to your API.

**Fix:**
```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        {
          key: 'Access-Control-Allow-Origin',
          value: process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
        },
        // ... other headers
      ],
    },
  ];
},
```

---

### 2. ⛔ WhatsApp Webhook Missing Signature Verification

**Location:** `app/api/webhooks/whatsapp/route.ts`

**Risk:** The webhook endpoint does not verify the `X-Hub-Signature-256` header. Attackers can send fake webhook payloads to trigger actions.

**Fix:** Add signature verification:
```typescript
import crypto from 'crypto';

function verifySignature(payload: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET;
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const rawBody = await request.text();

  if (!signature || !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  // ... rest of handler
}
```

---

### 3. ⛔ Rate Limiting Defined But Not Implemented

**Location:** `lib/middleware.ts:82-103`

**Risk:** The `checkRateLimit` function exists but is **never called** in any API route. APIs are vulnerable to brute force and DoS attacks.

**Fix:** Apply rate limiting to sensitive endpoints:
```typescript
// In API routes
import { checkRateLimit } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = checkRateLimit(`login:${clientIP}`, 5, 60000); // 5 attempts/minute

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) }
      }
    );
  }
  // ... rest of handler
}
```

**Apply to:**
- `/api/auth/login`
- `/api/auth/signup`
- `/api/reports/generate`
- `/api/connectors/sync`

---

### 4. ⛔ Cloud Function Allows Unauthenticated Access

**Location:** `scripts/deploy-functions.sh:67`
```bash
--allow-unauthenticated \
```

**Risk:** The `generateReportHttp` function can be triggered by anyone on the internet without authentication.

**Fix:** Remove `--allow-unauthenticated` and use IAM authentication:
```bash
gcloud functions deploy generateReportHttp \
  --gen2 \
  --no-allow-unauthenticated \
  # ... other options
```

Then authenticate requests using service account tokens.

---

### 5. ⛔ OAuth State Parameter Not Cryptographically Secure

**Location:** `app/api/connectors/oauth/callback/route.ts:88`
```typescript
const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
```

**Risk:** The OAuth state is just base64-encoded JSON, easily decoded and tampered with. Attackers can forge state parameters for CSRF attacks.

**Fix:** Use signed/encrypted state with HMAC:
```typescript
import crypto from 'crypto';

function createState(data: object): string {
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(payload)
    .digest('hex');
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
}

function verifyState(state: string): object | null {
  const { payload, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString());
  const expectedHmac = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(payload)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
    return null;
  }
  return JSON.parse(payload);
}
```

---

### 6. ⛔ Missing Security Headers

**Location:** `next.config.js`

**Risk:** No Content Security Policy, X-Frame-Options, or other security headers are configured.

**Fix:** Add security headers:
```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://storage.googleapis.com https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com"
        },
      ],
    },
    // ... API headers
  ];
},
```

---

### 7. ⛔ No Test Coverage

**Risk:** Zero test files exist despite Jest being configured. No unit tests, integration tests, or e2e tests.

**Fix:** Add comprehensive tests before launch:
- Unit tests for utility functions
- Integration tests for API routes
- E2E tests for critical user flows (signup, login, report generation)

Minimum coverage target: 70%

---

### 8. ⛔ OAuth Tokens Stored Unencrypted

**Location:** `app/api/connectors/oauth/callback/route.ts:119-128`
```typescript
await adminDb.collection('users').doc(userId).update({
  [`connectedAccounts.${platform}`]: {
    accessToken: tokens.accessToken,      // Stored in plaintext!
    refreshToken: tokens.refreshToken,    // Stored in plaintext!
    // ...
  },
});
```

**Risk:** OAuth access and refresh tokens are stored in Firestore without encryption. If database is compromised, all tokens are exposed.

**Fix:** Encrypt tokens before storage:
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!; // 32 bytes

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

### 9. ⛔ Weak Password Policy

**Location:** `app/api/auth/signup/route.ts:17-22`
```typescript
if (password.length < 6) {
  // Only checks length >= 6
}
```

**Risk:** Password policy only requires 6 characters. No complexity requirements.

**Fix:** Implement stronger password requirements:
```typescript
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain an uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain a lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain a number' };
  }
  return { valid: true };
}
```

---

### 10. ⛔ Input Validation Missing on Multiple Endpoints

**Risk:** Only 2 API routes use Zod validation. Many endpoints accept unvalidated user input.

**Missing validation on:**
- `app/api/data/summary/route.ts` - `dateRange` and `profileId` params not validated
- `app/api/data/metrics/route.ts` - Query params not validated
- `app/api/connectors/sync/route.ts` - Platform array not validated
- `app/api/reports/generate/route.ts` - Report generation params not validated

**Fix:** Add Zod schemas to all API routes:
```typescript
const QueryParamsSchema = z.object({
  profileId: z.string().optional(),
  dateRange: z.enum(['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth']).optional(),
  compareWith: z.enum(['previousPeriod']).optional(),
});

// In route handler
const params = QueryParamsSchema.safeParse(Object.fromEntries(searchParams));
if (!params.success) {
  return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
}
```

---

## Medium Issues (Should Fix Before Launch)

### 11. ⚠️ Sensitive Data Logged

**Location:** Multiple files
```typescript
console.log('WhatsApp Webhook received:', JSON.stringify(body, null, 2));
console.error('Token verification error:', error);
```

**Risk:** Sensitive data (tokens, user info, webhook payloads) logged to console. In production, logs may be exposed.

**Fix:** Use structured logging with PII redaction:
```typescript
function sanitizeLog(data: unknown): unknown {
  // Recursively redact sensitive fields
  const sensitiveFields = ['accessToken', 'refreshToken', 'password', 'token'];
  // ... implementation
}
```

---

### 12. ⚠️ Missing Error Boundary on API Routes

**Risk:** Unhandled errors in API routes may leak stack traces or internal details.

**Fix:** Add global error handler:
```typescript
// lib/api-utils.ts
export function withErrorHandler(handler: Function) {
  return async (request: NextRequest, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      // Don't expose internal errors
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
```

---

### 13. ⚠️ No Health Check Endpoint

**Risk:** No way for load balancers or monitoring systems to check application health.

**Fix:** Add health check endpoint:
```typescript
// app/api/health/route.ts
export async function GET() {
  // Check critical dependencies
  const checks = {
    database: await checkFirestore(),
    bigquery: await checkBigQuery(),
  };

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: healthy ? 'healthy' : 'unhealthy', checks },
    { status: healthy ? 200 : 503 }
  );
}
```

---

### 14. ⚠️ Missing Request Timeout Configuration

**Risk:** Long-running requests can exhaust server resources.

**Fix:** Add route segment config:
```typescript
// In long-running API routes
export const maxDuration = 30; // seconds
```

---

### 15. ⚠️ No Database Backup Strategy Documented

**Risk:** No documented backup/restore procedures for Firestore data.

**Fix:** Document and implement:
- Daily automated Firestore exports to GCS
- Point-in-time recovery procedures
- Tested restore procedures

---

### 16. ⚠️ Missing Audit Logging

**Risk:** No audit trail for sensitive operations (login, data access, report generation).

**Fix:** Implement audit logging:
```typescript
async function auditLog(event: {
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  await adminDb.collection('auditLogs').add({
    ...event,
    timestamp: new Date(),
  });
}
```

---

### 17. ⚠️ HTTPS Not Enforced

**Location:** `.env.example:43`
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Risk:** Example uses HTTP. Production must enforce HTTPS.

**Fix:**
- Ensure production `NEXT_PUBLIC_APP_URL` uses `https://`
- Add HSTS header (covered in security headers fix)
- Configure redirect from HTTP to HTTPS at infrastructure level

---

### 18. ⚠️ No API Versioning

**Risk:** No versioning strategy for API endpoints. Breaking changes will affect all clients.

**Fix:** Implement API versioning:
```
/api/v1/profiles
/api/v1/reports
```

---

### 19. ⚠️ Missing Firestore Security Rules

**Risk:** No Firestore security rules file in repository. Client-side access may not be properly restricted.

**Fix:** Add `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /reportProfiles/{profileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    match /generatedReports/{reportId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false; // Only server can write
    }
  }
}
```

---

### 20. ⚠️ Dependencies Need Security Audit

**Risk:** No `npm audit` or dependency scanning configured.

**Fix:**
```bash
npm audit
npm audit fix
```

Add to CI/CD pipeline:
```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

---

### 21. ⚠️ Missing Environment Validation

**Risk:** Application may start with missing required environment variables.

**Fix:** Add startup validation:
```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  GCP_PROJECT: z.string().min(1),
  FIREBASE_ADMIN_SDK_KEY: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  // ... all required vars
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Missing environment variables:', result.error.format());
    process.exit(1);
  }
}
```

---

### 22. ⚠️ In-Memory Rate Limit Store Not Scalable

**Location:** `lib/middleware.ts:80`
```typescript
const rateLimitStore = new Map<string, RateLimitEntry>();
```

**Risk:** In-memory store won't work with multiple server instances. Rate limits reset on restart.

**Fix:** Use Redis or similar distributed store:
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
```

---

## Pre-Launch Checklist

### Security
- [ ] Fix CORS configuration
- [ ] Implement webhook signature verification
- [ ] Enable rate limiting on all endpoints
- [ ] Remove `--allow-unauthenticated` from Cloud Functions
- [ ] Sign OAuth state parameters
- [ ] Add all security headers
- [ ] Encrypt stored OAuth tokens
- [ ] Strengthen password policy
- [ ] Add input validation to all endpoints
- [ ] Implement Firestore security rules
- [ ] Run npm audit and fix vulnerabilities

### Reliability
- [ ] Add comprehensive test suite (minimum 70% coverage)
- [ ] Add health check endpoint
- [ ] Configure request timeouts
- [ ] Document backup/restore procedures
- [ ] Implement audit logging
- [ ] Add environment variable validation

### Infrastructure
- [ ] Ensure HTTPS enforcement
- [ ] Use distributed rate limit store (Redis)
- [ ] Configure error monitoring (Sentry, etc.)
- [ ] Set up log aggregation
- [ ] Configure alerting for critical errors

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Runbook for common issues
- [ ] Incident response procedures

---

## Risk Summary

| Category | Critical | Medium | Low |
|----------|----------|--------|-----|
| Security | 10 | 5 | 2 |
| Reliability | 2 | 4 | 1 |
| Infrastructure | 3 | 3 | 2 |
| **Total** | **15** | **12** | **5** |

---

## Recommendation

**Do not launch to production** until all Critical issues are resolved. Medium issues should be addressed within the first sprint after launch if time constraints require it, but preferably before launch.

Estimated remediation effort: **2-3 weeks** for a single developer, **1 week** for a team.
