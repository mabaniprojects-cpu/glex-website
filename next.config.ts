import { withSentryConfig } from '@sentry/nextjs'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const isDev = process.env.NODE_ENV === 'development'

/**
 * `NEXT_PUBLIC_APP_URL` must be correct at BUILD time, not just at runtime.
 *
 * Next inlines `NEXT_PUBLIC_*` into the bundle when it builds, and eight modules
 * fall back to `http://localhost:3000` when it is absent — sitemap.xml,
 * robots.txt, the canonical and hreflang tags, OpenGraph URLs and the RSS feed.
 * A deployment that sets this only in the running container therefore produces a
 * site that looks perfect to a visitor while telling search engines and every
 * social preview that it lives on localhost.
 *
 * That failure is invisible in the browser, so the build refuses instead.
 *
 * Unset is an error; localhost is only a warning. Building a production bundle
 * against localhost is a legitimate thing to do — CI does it, and so does anyone
 * verifying a build on their own machine — whereas a host that never sets the
 * variable at all is the failure that actually reaches production.
 *
 * Gated on the phase so `next start` is unaffected: the value is baked in at
 * build, so the running server has no say in it either way.
 */
function assertPublicOriginConfigured() {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!publicUrl) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be set to the public origin for a production build.\n\n` +
        `It is inlined at build time, so exporting it only in the runtime\n` +
        `environment will not work — sitemap.xml, robots.txt, canonical URLs and\n` +
        `OpenGraph tags would all be published pointing at localhost.\n\n` +
        `  NEXT_PUBLIC_APP_URL="https://www.exporthouse.com.sa" npm run build`
    )
  }

  if (/localhost|127\.0\.0\.1/.test(publicUrl)) {
    console.warn(
      `\n  NEXT_PUBLIC_APP_URL is ${publicUrl} — fine for a local or CI build,\n` +
        `  but this bundle must not be deployed: its sitemap, robots.txt and\n` +
        `  canonical URLs would all point at localhost.\n`
    )
  }
}

/**
 * Content Security Policy.
 *
 * `'unsafe-inline'` is required on style-src because Tailwind and Next inject
 * inline style attributes. Scripts use a strict policy in production; dev
 * additionally needs 'unsafe-eval' for React Refresh.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  // MapLibre fetches vector tiles and the AI endpoint streams over fetch.
  `connect-src 'self' https: ${isDev ? 'ws: wss:' : ''}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  // Production only. Over plain http://localhost this directive rewrites the
  // client's RSC payload fetches to https://, where nothing is listening, so
  // streamed Suspense boundaries never resolve and pages stay on their
  // loading.tsx fallback.
  ...(isDev ? [] : [`upgrade-insecure-requests`]),
]
  .join('; ')
  .trim()

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Emits `.next/standalone` — a self-contained server with only the traced
   * subset of `node_modules`, so a container does not need an install step or
   * the full dependency tree.
   *
   * This is additional output, not a replacement: `next start` still works, and
   * so does the production verification recipe in the README. But `server.js`
   * does NOT serve `public/` or `.next/static` unless they are copied in — see
   * `npm run start:standalone` and the Deployment section. Skipping that copy
   * yields a site that boots and answers, with every stylesheet, script and
   * image 404ing.
   */
  output: 'standalone',

  /**
   * What must never be traced into that output.
   *
   * File tracing follows `fs` usage as well as imports, and it is greedy: the
   * first standalone build here copied a byte-identical `.env` — AUTH_SECRET,
   * the database password, the SMTP password — and all 15 uploaded customer
   * documents from `storage/` into `.next/standalone`. Anyone holding the
   * resulting image or tarball would hold the secrets and the files.
   *
   * Configuration must come from the platform's own environment, never from a
   * baked-in `.env`, and uploads belong in `STORAGE_PROVIDER=s3` in production
   * rather than on the container filesystem at all.
   */
  outputFileTracingExcludes: {
    '**': [
      './.env*',
      './storage/**',
      './e2e/**',
      './test-results/**',
      './playwright-report/**',
      './preview/**',
    ],
  },

  // Generates typed `PageProps`/`LayoutProps`/`RouteContext` helpers and
  // type-checks every `<Link href>` against the real route tree.
  typedRoutes: true,

  images: {
    // Next 16 coerces any quality not listed here down to the default.
    qualities: [70, 75, 85, 90],
    formats: ['image/webp'],
    remotePatterns: [],
  },

  experimental: {
    // Enables the `unauthorized()` / `forbidden()` navigation interrupts used
    // by the server-side guards in src/lib/auth-guards.ts.
    authInterrupts: true,
  },

  // NOTE: Next 16 removed the `eslint` config key and the `next lint` command.
  // Linting is a standalone `npm run lint` step (see package.json / CI).

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

const config = withNextIntl(nextConfig)

/**
 * Source-map upload, so a production stack trace names real functions and lines
 * instead of minified ones.
 *
 * Applied only when all three credentials are present. The wrapper otherwise
 * adds a build step that can only fail or warn, and CI, local builds and any
 * deployment without Sentry should build exactly as they did before. Error
 * reporting itself does not depend on this — see src/instrumentation.ts.
 */
const canUploadSourceMaps = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN
)

const finalConfig = canUploadSourceMaps
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Build logs are read when something is wrong; a successful upload is noise.
      silent: true,
      telemetry: false,
      // The maps are uploaded to Sentry, not served to visitors — leaving them
      // on the CDN would publish the application's source.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : config

/**
 * Exported as a function so the origin check can key off the build phase.
 * `next typegen` and `next start` evaluate this file too, and neither of them
 * bakes anything in — only PHASE_PRODUCTION_BUILD does.
 */
export default function nextConfigForPhase(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) assertPublicOriginConfigured()
  return finalConfig
}
