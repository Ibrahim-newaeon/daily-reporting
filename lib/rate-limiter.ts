/**
 * Rate Limiter with Redis support for production
 * Falls back to in-memory store for development
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

// Preset configurations for different use cases
export const RATE_LIMIT_PRESETS = {
  // General API rate limit: 100 requests per minute
  api: { limit: 100, windowMs: 60 * 1000 },
  // Authentication endpoints: 5 attempts per 15 minutes
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },
  // OAuth callback: 10 per minute
  oauth: { limit: 10, windowMs: 60 * 1000 },
  // Report generation: 10 per hour (expensive operation)
  reports: { limit: 10, windowMs: 60 * 60 * 1000 },
  // PDF generation: 20 per hour
  pdf: { limit: 20, windowMs: 60 * 60 * 1000 },
  // Strict limit for sensitive operations: 3 per hour
  strict: { limit: 3, windowMs: 60 * 60 * 1000 },
} as const;

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Redis client singleton
let redisClient: RedisClient | null = null;

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  quit(): Promise<void>;
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[RateLimiter] REDIS_URL not configured, using in-memory store');
    return null;
  }

  try {
    // Dynamic import to avoid bundling issues when Redis is not used
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });

    client.on('error', (err) => {
      console.error('[RateLimiter] Redis error:', err);
    });

    await client.connect();

    redisClient = {
      get: (key: string) => client.get(key),
      set: async (key: string, value: string, options?: { EX?: number }) => {
        if (options?.EX) {
          await client.set(key, value, { EX: options.EX });
        } else {
          await client.set(key, value);
        }
      },
      incr: (key: string) => client.incr(key),
      expire: (key: string, seconds: number) => client.expire(key, seconds).then(() => {}),
      quit: () => client.quit().then(() => {}),
    };

    console.log('[RateLimiter] Connected to Redis');
    return redisClient;
  } catch (error) {
    console.warn('[RateLimiter] Failed to connect to Redis, using in-memory store:', error);
    return null;
  }
}

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  if (!redis) {
    return checkRateLimitMemory(key, config);
  }

  const { limit, windowMs } = config;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `ratelimit:${key}`;
  const now = Date.now();

  try {
    const count = await redis.incr(redisKey);

    if (count === 1) {
      // First request in this window, set expiry
      await redis.expire(redisKey, windowSeconds);
    }

    const resetAt = now + windowMs;

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: limit - count,
      resetAt,
    };
  } catch (error) {
    console.error('[RateLimiter] Redis error, falling back to memory:', error);
    return checkRateLimitMemory(key, config);
  }
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const { limit, windowMs } = config;
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new entry or reset expired one
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// Clean up old memory entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  memoryStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => memoryStore.delete(key));
}, 60000); // Clean every minute

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'api'
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_PRESETS[preset];
  return checkRateLimitRedis(identifier, config);
}

/**
 * Check rate limit with custom configuration
 */
export async function checkRateLimitCustom(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  return checkRateLimitRedis(identifier, { limit, windowMs });
}

/**
 * Get rate limit identifier from request
 */
export function getRateLimitIdentifier(
  request: Request,
  prefix: string = 'api'
): string {
  // Try to get user ID from auth header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Use a hash of the token for privacy
    const token = authHeader.substring(7);
    const hash = simpleHash(token);
    return `${prefix}:user:${hash}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return `${prefix}:ip:${ip}`;
}

/**
 * Simple hash function for rate limit keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(RATE_LIMIT_PRESETS.api.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Middleware helper to apply rate limiting
 */
export async function withRateLimit(
  request: Request,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'api'
): Promise<{ allowed: boolean; headers: Record<string, string>; result: RateLimitResult }> {
  const identifier = getRateLimitIdentifier(request, preset);
  const result = await checkRateLimit(identifier, preset);
  const headers = rateLimitHeaders(result);

  return { allowed: result.allowed, headers, result };
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  if (redisClient) {
    await redisClient.quit();
  }
});
