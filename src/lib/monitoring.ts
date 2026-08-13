/**
 * Error monitoring options shared by every runtime.
 *
 * Deliberately free of imports so it can be pulled into the browser bundle,
 * the Node server and the edge runtime alike — `src/lib/env.ts` must never
 * reach a Client Component, so the DSN is passed in rather than read here.
 *
 * Nothing is sent anywhere without a DSN. Like every other integration in this
 * project, absent configuration means the feature is simply off.
 */

/**
 * Next's navigation interrupts are thrown, but they are control flow, not
 * faults: `notFound()`, `redirect()`, `forbidden()` and `unauthorized()` are how
 * `src/lib/auth-guards.ts` denies access. Reporting them would bury real errors
 * under a steady stream of working access control.
 */
const NAVIGATION_INTERRUPTS = [
  'NEXT_NOT_FOUND',
  'NEXT_REDIRECT',
  'NEXT_HTTP_ERROR_FALLBACK;403',
  'NEXT_HTTP_ERROR_FALLBACK;401',
]

/**
 * A client that navigates away mid-stream aborts the response. Next reports it
 * as an error; it is a fact about the network, and it arrived 22 times in a
 * single end-to-end run.
 */
const CLIENT_DISCONNECTS = ['The destination stream closed early', 'aborted']

export const ignoreErrors = [...NAVIGATION_INTERRUPTS, ...CLIENT_DISCONNECTS]

export type MonitoringOptions = {
  dsn: string
  environment: string
  tracesSampleRate: number
  ignoreErrors: string[]
  /**
   * Off. It attaches IP addresses, cookies and headers to every event, which
   * would quietly turn an error reporter into a source of personal data — and
   * this project asks visitors before it collects anything optional.
   */
  sendDefaultPii: false
}

export function monitoringOptions(
  dsn: string,
  environment: string,
  tracesSampleRate: number
): MonitoringOptions {
  return {
    dsn,
    environment,
    tracesSampleRate,
    ignoreErrors,
    sendDefaultPii: false,
  }
}
