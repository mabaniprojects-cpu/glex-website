import type { Instrumentation } from 'next'

/**
 * Server-side error monitoring.
 *
 * `register()` runs once per server instance before any request is handled.
 * With no `SENTRY_DSN` this initialises nothing and the application behaves
 * exactly as it did before — the same contract as every other optional
 * integration here.
 *
 * Server errors are reported without asking the visitor, and that is a
 * deliberate distinction from the client SDK in `instrumentation-client.ts`:
 * this reports faults in GLEX's own software from GLEX's own machines, the same
 * category as a server log, and carries no browser or session data
 * (`sendDefaultPii` is off). The browser SDK, which does see the visitor,
 * waits for consent.
 */
export async function register() {
  const { env } = await import('@/lib/env')
  const config = env()

  if (!config.SENTRY_DSN) return

  const Sentry = await import('@sentry/nextjs')
  const { monitoringOptions } = await import('@/lib/monitoring')

  Sentry.init(
    monitoringOptions(
      config.SENTRY_DSN,
      config.SENTRY_ENVIRONMENT ?? config.NODE_ENV,
      config.SENTRY_TRACES_SAMPLE_RATE
    )
  )
}

/**
 * Reports errors thrown while rendering a route.
 *
 * Sentry's helper is loaded lazily so an unconfigured deployment never pays for
 * the import. Reporting must not itself throw: this runs while Next is already
 * handling a failure, and a second error here would mask the first.
 */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/nextjs')
    await Sentry.captureRequestError(...args)
  } catch (error) {
    console.error('[monitoring] Failed to report a request error:', error)
  }
}
