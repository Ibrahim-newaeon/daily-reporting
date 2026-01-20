// Jest setup file
// Add any global test setup here

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret-for-jest-at-least-32-characters-long';
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.META_APP_SECRET = 'test-meta-app-secret';

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test timeout
jest.setTimeout(10000);
