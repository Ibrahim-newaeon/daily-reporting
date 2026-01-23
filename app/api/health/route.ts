import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase';

// Configure route segment
export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10 second timeout for health checks

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
    memory: HealthStatus;
    environment: HealthStatus;
  };
}

interface HealthStatus {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  latencyMs?: number;
}

const startTime = Date.now();

/**
 * Check Firestore connectivity
 */
async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const db = getAdminDb();
    // Simple read operation to verify connectivity
    await db.collection('_health').doc('check').get();
    return {
      status: 'pass',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Database connection failed',
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<HealthStatus> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      status: 'warn',
      message: 'Redis not configured (using in-memory rate limiting)',
    };
  }

  const start = Date.now();
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();
    await client.ping();
    await client.quit();
    return {
      status: 'pass',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Redis connection failed',
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthStatus {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usagePercent = (used.heapUsed / used.heapTotal) * 100;

  if (usagePercent > 90) {
    return {
      status: 'fail',
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    };
  }

  if (usagePercent > 75) {
    return {
      status: 'warn',
      message: `Elevated memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    };
  }

  return {
    status: 'pass',
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
  };
}

/**
 * Check critical environment variables
 */
function checkEnvironment(): HealthStatus {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'FIREBASE_ADMIN_SDK_KEY',
    'NEXTAUTH_SECRET',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing environment variables: ${missing.join(', ')}`,
    };
  }

  return {
    status: 'pass',
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  checks: HealthCheckResult['checks']
): HealthCheckResult['status'] {
  const statuses = Object.values(checks).map((c) => c.status);

  if (statuses.some((s) => s === 'fail')) {
    return 'unhealthy';
  }

  if (statuses.some((s) => s === 'warn')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Health check endpoint
 * GET /api/health
 *
 * Returns:
 * - 200: Healthy
 * - 503: Unhealthy or degraded
 */
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemory(),
    environment: checkEnvironment(),
  };

  const status = determineOverallStatus(checks);

  const result: HealthCheckResult = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  };

  const httpStatus = status === 'healthy' ? 200 : 503;

  return NextResponse.json(result, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * Liveness probe - simple check that the service is running
 * HEAD /api/health
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
