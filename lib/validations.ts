import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const PlatformSchema = z.enum(['ga4', 'google_ads', 'meta', 'linkedin']);
export type Platform = z.infer<typeof PlatformSchema>;

export const DateRangeSchema = z.enum([
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'thisMonth',
  'lastMonth',
]);

export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Date must be in YYYY-MM-DD format',
});

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export const SignupSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().min(1).max(100).optional(),
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

export const ProfileIdSchema = z.string().min(1).max(100);

export const CreateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
  platforms: z.array(PlatformSchema).min(1, 'At least one platform is required'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  platforms: z.array(PlatformSchema).optional(),
  metrics: z.array(z.string()).optional(),
  charts: z.array(z.string()).optional(),
  schedule: z
    .object({
      enabled: z.boolean(),
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
      timezone: z.string().max(50),
    })
    .optional(),
  whatsappRecipients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        phoneNumber: z.string().min(10).max(20),
        isActive: z.boolean().optional(),
      })
    )
    .optional(),
});

// ============================================================================
// DATA QUERY SCHEMAS
// ============================================================================

export const SummaryQuerySchema = z.object({
  profileId: z.string().max(100).optional(),
  dateRange: DateRangeSchema.optional().default('last30days'),
  compareWith: z.enum(['previousPeriod']).optional(),
});

export const MetricsQuerySchema = z.object({
  profileId: z.string().max(100).optional(),
  dateRange: DateRangeSchema.optional().default('last30days'),
  platform: PlatformSchema.optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
});

// ============================================================================
// CONNECTOR SCHEMAS
// ============================================================================

export const ConnectorSyncSchema = z.object({
  platforms: z.array(PlatformSchema).min(1).max(4),
  dateRange: DateRangeSchema.optional().default('last30days'),
});

export const OAuthAuthorizeQuerySchema = z.object({
  platform: PlatformSchema,
  returnUrl: z.string().max(200).optional(),
});

// ============================================================================
// REPORT SCHEMAS
// ============================================================================

export const GenerateReportSchema = z.object({
  profileId: z.string().min(1).max(100),
  dateRange: DateRangeSchema.optional().default('yesterday'),
  sendWhatsApp: z.boolean().optional().default(false),
});

export const ReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  profileId: z.string().max(100).optional(),
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Parse and validate request body with a Zod schema
 * Returns the validated data or throws an error
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely parse and validate request body
 * Returns { success: true, data } or { success: false, errors }
 */
export function safeValidateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Parse query parameters from URLSearchParams into an object
 */
export function parseQueryParams(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Format Zod errors for API response
 */
export function formatValidationErrors(error: z.ZodError): Array<{
  field: string;
  message: string;
}> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
