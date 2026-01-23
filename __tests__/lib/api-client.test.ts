/**
 * Tests for API Client with timeout and circuit breaker
 */

import {
  fetchWithTimeout,
  fetchJson,
  postJson,
  ApiClientError,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from '@/lib/api-client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Reset all circuit breakers
    resetCircuitBreaker('test-service');
    resetCircuitBreaker('failing-service');
  });

  describe('fetchWithTimeout', () => {
    it('should make successful request', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const response = await fetchWithTimeout('https://api.test.com/data', {}, 'test-service');

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should timeout after specified duration', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(new Response('', { status: 200 })), 5000)
          )
      );

      await expect(
        fetchWithTimeout('https://api.test.com/slow', { timeout: 100 }, 'test-service')
      ).rejects.toThrow(ApiClientError);

      // The error should indicate timeout
      try {
        await fetchWithTimeout('https://api.test.com/slow', { timeout: 100 }, 'test-service');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).isTimeout).toBe(true);
      }
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const response = await fetchWithTimeout(
        'https://api.test.com/flaky',
        { retries: 2, retryDelay: 10 },
        'test-service'
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

      const response = await fetchWithTimeout(
        'https://api.test.com/missing',
        { retries: 2 },
        'test-service'
      );

      expect(response.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limiting with Retry-After header', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response('Rate limited', {
            status: 429,
            headers: { 'Retry-After': '1' },
          })
        )
        .mockResolvedValueOnce(new Response('OK', { status: 200 }));

      const response = await fetchWithTimeout(
        'https://api.test.com/data',
        { retries: 1, retryDelay: 10 },
        'test-service'
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      // Mock 5 failures
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Make requests until circuit opens
      for (let i = 0; i < 5; i++) {
        try {
          await fetchWithTimeout(
            'https://api.test.com/fail',
            { retries: 0, timeout: 100 },
            'failing-service'
          );
        } catch {
          // Expected to fail
        }
      }

      // Next request should be blocked by circuit breaker
      await expect(
        fetchWithTimeout('https://api.test.com/fail', { retries: 0 }, 'failing-service')
      ).rejects.toThrow(ApiClientError);

      try {
        await fetchWithTimeout('https://api.test.com/fail', { retries: 0 }, 'failing-service');
      } catch (error) {
        expect((error as ApiClientError).isCircuitBreakerOpen).toBe(true);
      }
    });

    it('should report circuit breaker status', async () => {
      // Make a successful request
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      await fetchWithTimeout('https://api.test.com/data', {}, 'test-service');

      const status = getCircuitBreakerStatus();
      expect(status['test-service']).toBeDefined();
      expect(status['test-service'].state).toBe('closed');
    });

    it('should reset circuit breaker', async () => {
      // Create a circuit breaker entry
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      await fetchWithTimeout('https://api.test.com/data', {}, 'test-service');

      // Reset
      resetCircuitBreaker('test-service');

      const status = getCircuitBreakerStatus();
      expect(status['test-service']).toBeUndefined();
    });
  });

  describe('fetchJson', () => {
    it('should parse JSON response', async () => {
      const data = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchJson<typeof data>('https://api.test.com/data', {}, 'test-service');

      expect(result).toEqual(data);
    });

    it('should throw ApiClientError on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 })
      );

      await expect(
        fetchJson('https://api.test.com/protected', {}, 'test-service')
      ).rejects.toThrow('Forbidden');
    });

    it('should set correct headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await fetchJson('https://api.test.com/data', {}, 'test-service');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
    });
  });

  describe('postJson', () => {
    it('should send JSON body', async () => {
      const requestBody = { name: 'Test', value: 123 };
      const responseData = { id: 1, ...requestBody };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseData), { status: 201 })
      );

      const result = await postJson<typeof responseData>(
        'https://api.test.com/items',
        requestBody,
        {},
        'test-service'
      );

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });
  });

  describe('ApiClientError', () => {
    it('should capture all error properties', () => {
      const error = new ApiClientError('Test error', 500, 'test-service', true, false);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.service).toBe('test-service');
      expect(error.isTimeout).toBe(true);
      expect(error.isCircuitBreakerOpen).toBe(false);
      expect(error.name).toBe('ApiClientError');
    });
  });
});
