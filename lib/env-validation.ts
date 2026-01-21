import { z } from 'zod';

/**
 * Environment variable validation schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // GCP Configuration
  GCP_PROJECT: z.string().min(1, 'GCP_PROJECT is required'),
  BQ_DATASET: z.string().optional().default('marketing_data'),
  GCS_BUCKET: z.string().optional(),

  // Firebase Configuration
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase auth domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_ADMIN_SDK_KEY: z.string().min(1, 'Firebase Admin SDK key is required'),

  // OAuth Credentials
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // WhatsApp Configuration
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // App Configuration
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL must be a valid URL')
    .refine(
      (url) => process.env.NODE_ENV === 'development' || url.startsWith('https://'),
      'NEXT_PUBLIC_APP_URL must use HTTPS in production'
    ),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Security Configuration
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, 'TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters')
    .regex(/^[a-fA-F0-9]+$/, 'TOKEN_ENCRYPTION_KEY must be a valid hex string'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

let validatedEnv: ValidatedEnv | null = null;

/**
 * Validate environment variables
 * Call this at application startup
 * @throws Error if validation fails
 */
export function validateEnv(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const path = err.path.join('.');
      return `  - ${path}: ${err.message}`;
    });

    const errorMessage = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║           ENVIRONMENT VALIDATION FAILED                      ║',
      '╠══════════════════════════════════════════════════════════════╣',
      '║ The following environment variables are missing or invalid:  ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      ...errors,
      '',
      'Please check your .env file and ensure all required variables are set.',
      'See .env.example for reference.',
      '',
    ].join('\n');

    console.error(errorMessage);

    // In production, exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development, throw an error but don't exit
    throw new Error('Environment validation failed');
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Get a validated environment variable
 * Must call validateEnv() first
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
