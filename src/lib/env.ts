import { z } from 'zod'

/**
 * Startup environment validation.
 *
 * The app refuses to boot on an invalid configuration rather than failing
 * later at runtime with a confusing error. Optional integrations (AI, S3,
 * external tracking, Turnstile, SMTP) degrade gracefully when unset — see the
 * `is*Configured` helpers at the bottom.
 */

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)
const optionalString = z.preprocess(emptyToUndefined, z.string().optional())
const boolish = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v === 'true' || v === '1'),
  z.boolean().optional()
)

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Generate one with: npx auth secret'),
  AUTH_URL: z.string().url().optional(),

  APP_URL: z.string().url().default('http://localhost:3000'),
  CONTACT_TO_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'console']).default('console'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().int().positive().optional()
  ),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: z.preprocess(emptyToUndefined, z.string().default('GLEX <noreply@example.com>')),
  RESEND_API_KEY: optionalString,

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: boolish,
  UPLOAD_MAX_MB: z.preprocess(
    (v) => (v === '' || v === undefined ? 15 : Number(v)),
    z.number().int().positive().max(200)
  ),

  // AI
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().default('claude-sonnet-5')),
  /**
   * Assistant messages allowed per 15 minutes, per account or per IP.
   * Tunable because the right ceiling depends on the deployment: a site behind
   * a corporate NAT shares one address across many genuine visitors.
   */
  CHAT_RATE_LIMIT: z.preprocess(
    (v) => (v === '' || v === undefined ? 30 : Number(v)),
    z.number().int().positive().max(10_000)
  ),

  // Tracking
  TRACKING_PROVIDER: z.preprocess(emptyToUndefined, z.string().default('internal')),
  TRACKING_API_KEY: optionalString,
  TRACKING_WEBHOOK_SECRET: optionalString,

  // Maps
  MAP_STYLE_URL: optionalString,

  // Bot protection
  TURNSTILE_SITE_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,

  ANALYTICS_PROVIDER: z.preprocess(emptyToUndefined, z.string().default('none')),

  // Error monitoring. Absent by default; nothing is sent anywhere without a DSN.
  SENTRY_DSN: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  SENTRY_ENVIRONMENT: optionalString,
  /**
   * Performance tracing, off by default. Tracing samples *every* request rather
   * than only failures, which is a different order of cost and data volume from
   * error reporting — turn it on deliberately.
   */
  SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    (v) => (v === '' || v === undefined ? 0 : Number(v)),
    z.number().min(0).max(1)
  ),
  // Source-map upload at build time. Without all three the build still succeeds;
  // stack traces just stay minified.
  SENTRY_ORG: optionalString,
  SENTRY_PROJECT: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,

  SEED_DEMO_DATA: boolish,
  SEED_DEMO_PASSWORD: optionalString,
})

export type ServerEnv = z.infer<typeof serverSchema>

function loadServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the required values.`
    )
  }

  const env = parsed.data

  // Cross-field rules that Zod cannot express field-by-field.
  if (env.EMAIL_PROVIDER === 'smtp' && !env.SMTP_HOST) {
    throw new Error('EMAIL_PROVIDER="smtp" requires SMTP_HOST to be set.')
  }
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    throw new Error('EMAIL_PROVIDER="resend" requires RESEND_API_KEY to be set.')
  }
  if (env.STORAGE_PROVIDER === 's3' && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
    throw new Error(
      'STORAGE_PROVIDER="s3" requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.'
    )
  }
  if (env.NODE_ENV === 'production') {
    if (env.SEED_DEMO_DATA) {
      throw new Error('SEED_DEMO_DATA must never be enabled in production.')
    }
    if (env.EMAIL_PROVIDER === 'console') {
      throw new Error(
        'EMAIL_PROVIDER="console" discards all mail and is not permitted in production. ' +
          'Configure "smtp" or "resend".'
      )
    }
  }

  return env
}

let cached: ServerEnv | undefined

/** Validated server environment. Never import this into a Client Component. */
export function env(): ServerEnv {
  cached ??= loadServerEnv()
  return cached
}

// --- Capability flags -------------------------------------------------------
// Optional integrations are absent by default; the app must work without them.

export const isAiConfigured = () => Boolean(env().ANTHROPIC_API_KEY)
export const isErrorMonitoringConfigured = () => Boolean(env().SENTRY_DSN)
/** Source maps are only uploaded when all three build-time values are present. */
export const isSentryUploadConfigured = () => {
  const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN } = env()
  return Boolean(SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN)
}
export const isS3Configured = () => env().STORAGE_PROVIDER === 's3'
export const isTurnstileConfigured = () =>
  Boolean(env().TURNSTILE_SITE_KEY && env().TURNSTILE_SECRET_KEY)
export const isRemoteMapConfigured = () => Boolean(env().MAP_STYLE_URL)

/**
 * External carrier tracking is only "live" when a non-internal provider is
 * named AND credentials exist. Otherwise the UI must not present data as live.
 */
export const isExternalTrackingConfigured = () => {
  const { TRACKING_PROVIDER, TRACKING_API_KEY } = env()
  return TRACKING_PROVIDER !== 'internal' && TRACKING_PROVIDER !== 'mock' && Boolean(TRACKING_API_KEY)
}

export const isDemoTrackingMode = () =>
  env().TRACKING_PROVIDER === 'mock' && env().NODE_ENV !== 'production'
