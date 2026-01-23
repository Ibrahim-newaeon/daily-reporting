/**
 * Tests for Redis-based rate limiter
 */

import {
  checkRateLimit,
  checkRateLimitCustom,
  getRateLimitIdentifier,
  rateLimitHeaders,
  RATE_LIMIT_PRESETS,
} from '@/lib/rate-limiter';

// Mock Redis module - not available in test environment
jest.mock('redis', () => ({
  createClient: jest.fn(() => {
    throw new Error('Redis not available in test');
  }),
}));

describe('Rate Limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('RATE_LIMIT_PRESETS', () => {
    it('should have correct preset configurations', () => {
      expect(RATE_LIMIT_PRESETS.api).toEqual({ limit: 100, windowMs: 60000 });
      expect(RATE_LIMIT_PRESETS.auth).toEqual({ limit: 5, windowMs: 900000 });
      expect(RATE_LIMIT_PRESETS.oauth).toEqual({ limit: 10, windowMs: 60000 });
      expect(RATE_LIMIT_PRESETS.reports).toEqual({ limit: 10, windowMs: 3600000 });
      expect(RATE_LIMIT_PRESETS.pdf).toEqual({ limit: 20, windowMs: 3600000 });
      expect(RATE_LIMIT_PRESETS.strict).toEqual({ limit: 3, windowMs: 3600000 });
    });
  });

  describe('checkRateLimit (memory fallback)', () => {
    it('should allow requests under the limit', async () => {
      const result = await checkRateLimit('test-rate-1', 'api');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should track requests correctly', async () => {
      const key = 'test-rate-2';

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(key, 'api');
      }

      const result = await checkRateLimit(key, 'api');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(94);
    });

    it('should block when limit is exceeded', async () => {
      const key = 'test-rate-3';

      // Exhaust the strict limit (3 requests)
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(key, 'strict');
      }

      const result = await checkRateLimit(key, 'strict');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reset after window expires', async () => {
      const key = 'test-rate-4';

      // Exhaust auth limit (5 requests in 15 minutes)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(key, 'auth');
      }

      // Should be blocked
      let result = await checkRateLimit(key, 'auth');
      expect(result.allowed).toBe(false);

      // Advance time past window (15 minutes + 1ms)
      jest.advanceTimersByTime(900001);

      // Should be allowed again
      result = await checkRateLimit(key, 'auth');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkRateLimitCustom', () => {
    it('should respect custom limits', async () => {
      const key = 'test-custom-1';

      // Custom limit: 2 requests per 10 seconds
      await checkRateLimitCustom(key, 2, 10000);
      await checkRateLimitCustom(key, 2, 10000);

      const result = await checkRateLimitCustom(key, 2, 10000);
      expect(result.allowed).toBe(false);
    });
  });

  describe('getRateLimitIdentifier', () => {
    it('should extract identifier from Bearer token', () => {
      const request = new Request('https://example.com', {
        headers: { Authorization: 'Bearer test-token-123' },
      });

      const identifier = getRateLimitIdentifier(request, 'api');
      expect(identifier).toMatch(/^api:user:/);
    });

    it('should extract identifier from x-forwarded-for header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });

      const identifier = getRateLimitIdentifier(request, 'api');
      expect(identifier).toBe('api:ip:192.168.1.1');
    });

    it('should extract identifier from x-real-ip header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '10.0.0.2' },
      });

      const identifier = getRateLimitIdentifier(request, 'auth');
      expect(identifier).toBe('auth:ip:10.0.0.2');
    });

    it('should return unknown when no identifying headers', () => {
      const request = new Request('https://example.com');

      const identifier = getRateLimitIdentifier(request, 'api');
      expect(identifier).toBe('api:ip:unknown');
    });

    it('should use custom prefix', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '1.2.3.4' },
      });

      const identifier = getRateLimitIdentifier(request, 'custom');
      expect(identifier).toBe('custom:ip:1.2.3.4');
    });
  });

  describe('rateLimitHeaders', () => {
    it('should generate correct headers for allowed request', () => {
      const result = {
        allowed: true,
        remaining: 95,
        resetAt: Date.now() + 60000,
      };

      const headers = rateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('95');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('should include Retry-After for blocked request', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfter: 60,
      };

      const headers = rateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
      expect(headers['Retry-After']).toBe('60');
    });
  });
});
