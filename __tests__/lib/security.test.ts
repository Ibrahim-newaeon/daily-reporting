import {
  checkRateLimit,
  RateLimits,
  encryptToken,
  decryptToken,
  isEncryptedToken,
  createSignedState,
  verifySignedState,
  validatePassword,
  validateEmail,
  sanitizeHtml,
  getClientIP,
} from '@/lib/security';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit store between tests by waiting for cleanup
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    const result = checkRateLimit('test-key-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests over the limit', () => {
    const key = 'test-key-2';
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60000);
    }
    const result = checkRateLimit(key, 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });

  it('should reset after the window expires', () => {
    const key = 'test-key-3';
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 1000);
    }

    // Advance time past the window
    jest.advanceTimersByTime(1001);

    const result = checkRateLimit(key, 5, 1000);
    expect(result.allowed).toBe(true);
  });

  it('should have correct preset limits', () => {
    expect(RateLimits.AUTH.limit).toBe(5);
    expect(RateLimits.AUTH.windowMs).toBe(60000);
    expect(RateLimits.AUTH_SIGNUP.limit).toBe(3);
  });
});

describe('Token Encryption', () => {
  const testToken = 'test-access-token-12345';

  it('should encrypt and decrypt a token correctly', () => {
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(testToken);
  });

  it('should produce different ciphertexts for the same input (due to random IV)', () => {
    const encrypted1 = encryptToken(testToken);
    const encrypted2 = encryptToken(testToken);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should correctly identify encrypted tokens', () => {
    const encrypted = encryptToken(testToken);
    expect(isEncryptedToken(encrypted)).toBe(true);
    expect(isEncryptedToken(testToken)).toBe(false);
  });

  it('should throw on invalid encrypted token format', () => {
    expect(() => decryptToken('invalid')).toThrow();
    expect(() => decryptToken('a:b')).toThrow('Invalid encrypted token format');
  });
});

describe('OAuth State Signing', () => {
  const testData = { platform: 'meta', returnUrl: '/connectors' };

  it('should create and verify a valid state', () => {
    const state = createSignedState(testData);
    const verified = verifySignedState(state);
    expect(verified).toMatchObject(testData);
  });

  it('should reject tampered state', () => {
    const state = createSignedState(testData);
    // Tamper with the state
    const tampered = state.slice(0, -5) + 'XXXXX';
    const verified = verifySignedState(tampered);
    expect(verified).toBeNull();
  });

  it('should reject expired state', () => {
    jest.useFakeTimers();
    const state = createSignedState(testData, 1000); // 1 second expiry

    jest.advanceTimersByTime(2000); // Advance 2 seconds

    const verified = verifySignedState(state);
    expect(verified).toBeNull();

    jest.useRealTimers();
  });
});

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1A');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('lowercase123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one uppercase letter'
    );
  });

  it('should reject passwords without lowercase', () => {
    const result = validatePassword('UPPERCASE123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one lowercase letter'
    );
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbers!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should accept valid passwords', () => {
    const result = validatePassword('ValidPass123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should calculate password strength', () => {
    expect(validatePassword('Weak1aaa').strength).toBe('weak');
    expect(validatePassword('Medium123Ab').strength).toBe('fair');
    expect(validatePassword('Strong123Ab!@').strength).toBe('strong');
    expect(validatePassword('VeryStrong123!@#$Ab').strength).toBe('very_strong');
  });
});

describe('Email Validation', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('test@example.com').valid).toBe(true);
    expect(validateEmail('user.name@domain.org').valid).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('notanemail').valid).toBe(false);
    expect(validateEmail('@nodomain.com').valid).toBe(false);
    expect(validateEmail('missing@.com').valid).toBe(false);
  });

  it('should sanitize email to lowercase', () => {
    const result = validateEmail('Test@Example.COM');
    expect(result.sanitized).toBe('test@example.com');
  });
});

describe('HTML Sanitization', () => {
  it('should escape HTML special characters', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(sanitizeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape quotes', () => {
    expect(sanitizeHtml("it's a \"test\"")).toBe('it&#039;s a &quot;test&quot;');
  });
});

describe('Client IP Extraction', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1');
    expect(getClientIP(headers)).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const headers = new Headers();
    headers.set('x-real-ip', '192.168.1.2');
    expect(getClientIP(headers)).toBe('192.168.1.2');
  });

  it('should return unknown when no IP headers present', () => {
    const headers = new Headers();
    expect(getClientIP(headers)).toBe('unknown');
  });
});
