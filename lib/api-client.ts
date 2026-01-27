/**
 * API Client with timeout handling and circuit breaker pattern
 * Use this for all external API calls (Google Ads, Meta, TikTok, Snap, etc.)
 */

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Open circuit after 5 consecutive failures
  resetTimeout: 30000,        // Try again after 30 seconds
  halfOpenRequests: 3,        // Allow 3 requests in half-open state
};

// Per-service circuit breaker states
const circuitBreakers = new Map<string, CircuitBreakerState>();

// Default timeouts per service type
const DEFAULT_TIMEOUTS: Record<string, number> = {
  'google-ads': 30000,
  'meta-ads': 30000,
  'tiktok-ads': 30000,
  'snap-ads': 30000,
  'bigquery': 60000,
  'default': 30000,
};

function getCircuitBreaker(service: string): CircuitBreakerState {
  if (!circuitBreakers.has(service)) {
    circuitBreakers.set(service, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(service)!;
}

function updateCircuitBreaker(service: string, success: boolean): void {
  const breaker = getCircuitBreaker(service);
  const now = Date.now();

  if (success) {
    // Reset on success
    breaker.failures = 0;
    breaker.state = 'closed';
  } else {
    // Record failure
    breaker.failures++;
    breaker.lastFailure = now;

    if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      console.warn(`[CircuitBreaker] ${service} circuit opened after ${breaker.failures} failures`);
    }
  }
}

function canMakeRequest(service: string): { allowed: boolean; reason?: string } {
  const breaker = getCircuitBreaker(service);
  const now = Date.now();

  if (breaker.state === 'closed') {
    return { allowed: true };
  }

  if (breaker.state === 'open') {
    // Check if reset timeout has passed
    if (now - breaker.lastFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      breaker.state = 'half-open';
      console.log(`[CircuitBreaker] ${service} circuit half-open, allowing test requests`);
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Circuit breaker open for ${service}. Retry after ${Math.ceil((breaker.lastFailure + CIRCUIT_BREAKER_CONFIG.resetTimeout - now) / 1000)}s`,
    };
  }

  // half-open state - allow limited requests
  return { allowed: true };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly service?: string,
    public readonly isTimeout: boolean = false,
    public readonly isCircuitBreakerOpen: boolean = false
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Make an API request with timeout and circuit breaker protection
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestOptions = {},
  service: string = 'default'
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUTS[service] || DEFAULT_TIMEOUTS.default,
    retries = 2,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  // Check circuit breaker
  const circuitCheck = canMakeRequest(service);
  if (!circuitCheck.allowed) {
    throw new ApiClientError(
      circuitCheck.reason || 'Circuit breaker is open',
      503,
      service,
      false,
      true
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelay * (attempt + 1);

        if (attempt < retries) {
          console.warn(`[ApiClient] ${service} rate limited, retrying after ${waitTime}ms`);
          await sleep(waitTime);
          continue;
        }
      }

      // Check for server errors that should trigger retry
      if (response.status >= 500 && attempt < retries) {
        console.warn(`[ApiClient] ${service} returned ${response.status}, retrying...`);
        await sleep(retryDelay * (attempt + 1));
        continue;
      }

      // Success or client error - update circuit breaker and return
      updateCircuitBreaker(service, response.ok || response.status < 500);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[ApiClient] ${service} request timed out after ${timeout}ms`);
        updateCircuitBreaker(service, false);

        if (attempt < retries) {
          await sleep(retryDelay * (attempt + 1));
          continue;
        }

        throw new ApiClientError(
          `Request to ${service} timed out after ${timeout}ms`,
          408,
          service,
          true
        );
      }

      // Network error
      updateCircuitBreaker(service, false);

      if (attempt < retries) {
        console.warn(`[ApiClient] ${service} network error, retrying...`, error);
        await sleep(retryDelay * (attempt + 1));
        continue;
      }

      throw new ApiClientError(
        `Network error for ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        service
      );
    }
  }

  // Should not reach here, but just in case
  throw lastError || new ApiClientError(`Request to ${service} failed`, 0, service);
}

/**
 * Make a JSON API request with automatic parsing
 */
export async function fetchJson<T>(
  url: string,
  options: RequestOptions = {},
  service: string = 'default'
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  }, service);

  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
    } catch {
      // Ignore JSON parse error
    }
    throw new ApiClientError(errorMessage, response.status, service);
  }

  return response.json() as Promise<T>;
}

/**
 * Make a POST request with JSON body
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: RequestOptions = {},
  service: string = 'default'
): Promise<T> {
  return fetchJson<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  }, service);
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
  const status: Record<string, CircuitBreakerState> = {};
  circuitBreakers.forEach((state, service) => {
    status[service] = { ...state };
  });
  return status;
}

/**
 * Reset circuit breaker for a service (use with caution)
 */
export function resetCircuitBreaker(service: string): void {
  circuitBreakers.delete(service);
  console.log(`[CircuitBreaker] ${service} circuit reset`);
}

// Utility function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
