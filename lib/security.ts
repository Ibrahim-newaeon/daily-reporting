import crypto from 'crypto';

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (for single instance). Use Redis in production for scaling.
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 60000); // Clean up every minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a given key
 * @param key Unique identifier (e.g., `login:${ip}` or `api:${userId}`)
 * @param limit Maximum requests allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
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
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit presets for different endpoint types
 */
export const RateLimits = {
  // Strict limits for authentication endpoints
  AUTH: { limit: 5, windowMs: 60000 }, // 5 per minute
  AUTH_SIGNUP: { limit: 3, windowMs: 60000 }, // 3 per minute

  // Moderate limits for resource-intensive operations
  REPORT_GENERATE: { limit: 10, windowMs: 60000 }, // 10 per minute
  DATA_SYNC: { limit: 5, windowMs: 60000 }, // 5 per minute

  // Standard API limits
  API_READ: { limit: 100, windowMs: 60000 }, // 100 per minute
  API_WRITE: { limit: 30, windowMs: 60000 }, // 30 per minute
} as const;

// ============================================================================
// TOKEN ENCRYPTION
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a token for secure storage
 * @param token The plaintext token to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex)
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a stored token
 * @param encryptedToken Encrypted string from encryptToken()
 * @returns The original plaintext token
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedData] = encryptedToken.split(':');

  if (!ivHex || !authTagHex || !encryptedData) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a token appears to be encrypted (vs plaintext)
 */
export function isEncryptedToken(token: string): boolean {
  const parts = token.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}

// ============================================================================
// OAUTH STATE SIGNING
// ============================================================================

/**
 * Create a signed OAuth state parameter to prevent CSRF attacks
 * @param data State data to encode
 * @param expiresInMs Expiration time in milliseconds (default: 10 minutes)
 * @returns Base64URL-encoded signed state string
 */
export function createSignedState(
  data: Record<string, unknown>,
  expiresInMs: number = 600000
): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is not set');
  }

  const payload = {
    ...data,
    exp: Date.now() + expiresInMs,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadStr = JSON.stringify(payload);
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex');

  const combined = JSON.stringify({ payload: payloadStr, hmac });
  return Buffer.from(combined).toString('base64url');
}

/**
 * Verify and decode a signed OAuth state parameter
 * @param state The state parameter from the callback
 * @returns The decoded state data, or null if invalid/expired
 */
export function verifySignedState(state: string): Record<string, unknown> | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('NEXTAUTH_SECRET environment variable is not set');
    return null;
  }

  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const { payload: payloadStr, hmac } = JSON.parse(decoded);

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      console.error('Invalid state HMAC');
      return null;
    }

    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      console.error('State has expired');
      return null;
    }

    // Remove internal fields before returning
    const { exp: _exp, nonce: _nonce, ...data } = payload;
    return data;
  } catch (error) {
    console.error('Failed to verify state:', error);
    return null;
  }
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very_strong';
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (recommended)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Calculate strength
  let strength: PasswordValidationResult['strength'] = 'weak';
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const lengthScore = Math.min(password.length / 16, 1);
  const varietyScore =
    [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password))
      .length / 4;

  const totalScore = lengthScore * 0.4 + varietyScore * 0.6;

  if (totalScore >= 0.9 && hasSpecial && password.length >= 12) {
    strength = 'very_strong';
  } else if (totalScore >= 0.7 && password.length >= 10) {
    strength = 'strong';
  } else if (totalScore >= 0.5) {
    strength = 'fair';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize a string to prevent XSS attacks
 * Use for user-provided content that will be displayed
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize an email address
 */
export function validateEmail(email: string): { valid: boolean; sanitized: string } {
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    valid: emailRegex.test(sanitized) && sanitized.length <= 254,
    sanitized,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  success: boolean;
}

/**
 * Create an audit log entry (to be stored in database)
 */
export function createAuditLogEntry(
  userId: string,
  action: string,
  resource: string,
  options: {
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    success?: boolean;
  } = {}
): AuditLogEntry {
  return {
    timestamp: new Date(),
    userId,
    action,
    resource,
    resourceId: options.resourceId,
    details: options.details,
    ip: options.ip,
    userAgent: options.userAgent,
    success: options.success ?? true,
  };
}

// ============================================================================
// HELPER TO GET CLIENT IP
// ============================================================================

/**
 * Extract client IP from request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
