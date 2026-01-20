# Performance Analysis Report

This document identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms found in the codebase.

## Critical Issues

### 1. Sequential API Calls Instead of Parallel (N+1 Pattern)

**Severity: HIGH** | **Impact: Major latency increase**

#### Location: `functions/generateDailyReports.ts:87-104`
```typescript
// PROBLEM: Profiles processed sequentially
for (const profileDoc of profilesSnapshot.docs) {
  await generateReportForProfile(profile); // Each profile waits for the previous one
}
```
**Fix:** Use `Promise.allSettled()` for parallel processing:
```typescript
const results = await Promise.allSettled(
  profilesSnapshot.docs.map(async (profileDoc) => {
    const profile = { id: profileDoc.id, ...profileDoc.data() } as ReportProfile;
    if (!shouldGenerateNow(profile.schedule)) return null;
    return generateReportForProfile(profile);
  })
);
```

---

#### Location: `functions/generateDailyReports.ts:574-672`
```typescript
// PROBLEM: Platform metrics fetched sequentially
for (const platform of platforms) {
  // Each API call waits for the previous one to complete
  platformMetrics = await retryWithBackoff(fetchFn);
}
```
**Fix:** Fetch all platforms in parallel:
```typescript
const platformPromises = platforms.map(async (platform) => {
  const account = connectedAccounts[platform];
  if (!account?.connected) return null;
  // ... fetch logic
});
const results = await Promise.allSettled(platformPromises);
```

---

#### Location: `functions/generateDailyReports.ts:870-933`
```typescript
// PROBLEM: WhatsApp messages sent one at a time
for (const recipient of recipients) {
  await fetch(...); // Text message
  await fetch(...); // PDF document
}
```
**Fix:** Send messages in parallel with concurrency limit:
```typescript
import pLimit from 'p-limit';
const limit = pLimit(5); // Max 5 concurrent requests

const deliveryPromises = recipients
  .filter(r => r.isActive)
  .map(recipient => limit(() => sendToRecipient(recipient)));
await Promise.allSettled(deliveryPromises);
```

---

#### Location: `app/api/connectors/sync/route.ts:50-118`
```typescript
// PROBLEM: Platforms synced sequentially
for (const platform of platforms as Platform[]) {
  metrics = await client.getMetrics(...); // Sequential calls
}
```
**Fix:** Sync platforms in parallel:
```typescript
const syncPromises = platforms.map(async (platform) => {
  const account = connectedAccounts[platform];
  if (!account?.connected) return { platform, success: false, error: 'Not connected' };
  // ... sync logic
});
const results = await Promise.allSettled(syncPromises);
```

---

#### Location: `app/api/reports/generate/route.ts:163-200`
```typescript
// PROBLEM: WhatsApp deliveries are sequential
for (const recipient of profile.whatsappRecipients) {
  const results = await whatsapp.sendReportWithSummary(...);
}
```
**Same fix as above** - use `Promise.allSettled()` with concurrency limiting.

---

## Medium Priority Issues

### 2. Unnecessary Re-renders in React Components

#### Location: `app/(dashboard)/page.tsx:75-86`
```typescript
// PROBLEM: Computed on every render
const chartData = metrics.reduce((acc, item) => {
  // ... aggregation logic
}, {});
const chartDataArray = Object.values(chartData).sort(...);
```
**Fix:** Use `useMemo`:
```typescript
const chartDataArray = useMemo(() => {
  const chartData = metrics.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = { date: item.date };
    }
    acc[item.date][`${item.platform}_spend`] = (acc[item.date][`${item.platform}_spend`] || 0) + item.spend;
    acc[item.date]['total_spend'] = (acc[item.date]['total_spend'] || 0) + item.spend;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  return Object.values(chartData).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}, [metrics]);
```

---

#### Location: `app/(dashboard)/page.tsx:196-205`
```typescript
// PROBLEM: Data transformation inside JSX (runs on every render)
<BarChart
  data={Object.entries(
    metrics.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + item.spend;
      return acc;
    }, {})
  ).map(([platform, spend]) => ({...}))}
>
```
**Fix:** Move to `useMemo`:
```typescript
const platformSpendData = useMemo(() => {
  const aggregated = metrics.reduce((acc, item) => {
    acc[item.platform] = (acc[item.platform] || 0) + item.spend;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(aggregated).map(([platform, spend]) => ({
    platform: platformDisplayNames[platform] || platform,
    spend,
    fill: platformColors[platform] || '#6b7280',
  }));
}, [metrics]);
```

---

#### Location: `components/Dashboard/ProfileGrid.tsx:13-93`
```typescript
// PROBLEM: ProfileCard not memoized - all cards re-render when parent state changes
function ProfileCard({ profile, onGenerateReport }) {
  return <div>...</div>;
}
```
**Fix:** Wrap with `React.memo`:
```typescript
const ProfileCard = React.memo(function ProfileCard({
  profile,
  onGenerateReport,
}: {
  profile: ReportProfile;
  onGenerateReport?: (profileId: string) => void;
}) {
  return <div>...</div>;
});
```

---

#### Location: `components/Reports/ReportsList.tsx:26-71`
Same issue - `ReportRow` should be memoized with `React.memo`.

---

#### Location: `components/Dashboard/SummaryMetrics.tsx:17-76`
`MetricCard` should be memoized, and `baseMetrics`/`extendedMetrics` arrays should use `useMemo`.

---

### 3. Repeated Computation Inside Loops

#### Location: `app/api/reports/generate/route.ts:167-169`
```typescript
// PROBLEM: topPlatform calculated for EACH recipient (same value)
for (const recipient of profile.whatsappRecipients) {
  const topPlatform = byPlatform.reduce((a, b) =>
    a.spend > b.spend ? a : b
  )?.platform || 'N/A';
}
```
**Fix:** Calculate once before the loop:
```typescript
const topPlatform = byPlatform.length > 0
  ? byPlatform.reduce((a, b) => a.spend > b.spend ? a : b).platform
  : 'N/A';

for (const recipient of profile.whatsappRecipients) {
  // Use pre-calculated topPlatform
}
```

---

### 4. Dynamic Import Inside Loop

#### Location: `functions/generateDailyReports.ts:882`
```typescript
// PROBLEM: node-fetch imported inside the loop for each recipient
for (const recipient of recipients) {
  const fetch = (await import('node-fetch')).default; // Imported repeatedly
}
```
**Fix:** Import once at the top of the function:
```typescript
async function sendWhatsAppNotifications(...) {
  const fetch = (await import('node-fetch')).default;

  for (const recipient of recipients) {
    // Use pre-imported fetch
  }
}
```

---

## Low Priority / Recommendations

### 5. Missing Response Caching

The API routes don't implement any caching. Consider adding:

1. **In-memory caching** for frequently accessed data:
```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, unknown>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});
```

2. **HTTP Cache headers** for GET endpoints:
```typescript
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'private, max-age=60',
  },
});
```

---

### 6. Missing Pagination

#### Location: `app/api/reports/route.ts:54`
```typescript
// No pagination - fetches ALL reports
const snapshot = await adminDb
  .collection('generatedReports')
  .where('userId', '==', authResult.userId)
  .orderBy('generatedAt', 'desc')
  .get(); // No limit!
```
**Fix:** Add pagination:
```typescript
const pageSize = 20;
const page = parseInt(searchParams.get('page') || '1');

const snapshot = await adminDb
  .collection('generatedReports')
  .where('userId', '==', authResult.userId)
  .orderBy('generatedAt', 'desc')
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .get();
```

---

### 7. Missing `useCallback` for Event Handlers

#### Location: `app/(dashboard)/page.tsx:50-72`
```typescript
// PROBLEM: fetchData recreated on every render
const fetchData = async () => { ... };
```
**Fix:** Use `useCallback`:
```typescript
const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const [summaryRes, metricsRes] = await Promise.all([...]);
    // ...
  } finally {
    setLoading(false);
  }
}, [dateRange]);
```

---

### 8. BigQuery Optimization

Consider partitioning the `metrics` table by date for faster queries:
```sql
-- In scripts/setup-bigquery.sql
CREATE TABLE IF NOT EXISTS metrics (
  ...
)
PARTITION BY DATE(date)
CLUSTER BY user_id, profile_id;
```

---

## Summary Table

| Issue | Severity | Location | Estimated Impact |
|-------|----------|----------|------------------|
| Sequential profile processing | HIGH | `generateDailyReports.ts:87` | 5-10x slower for multiple profiles |
| Sequential platform API calls | HIGH | `generateDailyReports.ts:574` | 4x slower (4 platforms) |
| Sequential WhatsApp sends | HIGH | `generateDailyReports.ts:870` | N*2x slower (N recipients, 2 messages each) |
| Sequential sync calls | HIGH | `connectors/sync/route.ts:50` | 4x slower |
| Missing useMemo for charts | MEDIUM | `page.tsx:75, 196` | Re-renders on every state change |
| Unmemoized list items | MEDIUM | `ProfileGrid.tsx`, `ReportsList.tsx` | Full list re-renders |
| Repeated topPlatform calc | LOW | `reports/generate/route.ts:167` | Minor CPU overhead |
| Dynamic import in loop | LOW | `generateDailyReports.ts:882` | Minor overhead |
| Missing pagination | LOW | `reports/route.ts` | Memory issues at scale |

---

## Quick Wins (Implement First)

1. **Parallelize API calls in `fetchMetricsFromPlatforms()`** - Easy change, 4x speedup
2. **Add `useMemo` to dashboard chart data** - Easy change, prevents re-renders
3. **Move `topPlatform` calculation outside loop** - One line change
4. **Import `node-fetch` once outside loop** - One line change
5. **Wrap `ProfileCard` and `ReportRow` with `React.memo`** - Easy change
