import { analyticsAllowedFromCookieString } from '@/lib/consent-cookie'
import { monitoringOptions } from '@/lib/monitoring'

/**
 * Browser-side error monitoring — consent-gated, and loaded lazily.
 *
 * Unlike the server SDK, this one sees the visitor: their URL, their browser,
 * their actions leading up to a fault, and it ships that to a third party. This
 * project's rule is that nothing optional loads before the visitor has actively
 * chosen (spec §31), and an error reporter is not exempt from it just because
 * it is useful to us.
 *
 * So: no DSN, or no consent, and Sentry is never initialised — not initialised
 * and then suppressed. The import is dynamic for the same reason, so the SDK is
 * a separate chunk that is never fetched rather than dead weight in the bundle
 * of every visitor to a deployment that does not use it.
 *
 * Server-side reporting is unaffected and still catches every fault in
 * rendering, Server Actions and route handlers — the majority of what breaks.
 *
 * The cost is honest: a visitor who has not chosen, or who chose essential
 * only, contributes no browser error reports at all. Accepting takes effect
 * from their next page load, because this file runs once per load and the
 * consent banner does not force one.
 */

type TransitionCapture = (href: string, navigationType: string) => void

let captureTransition: TransitionCapture | undefined

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn && analyticsAllowedFromCookieString(document.cookie)) {
  void import('@sentry/nextjs')
    .then((Sentry) => {
      // No integrations are added on purpose. Session Replay in particular is
      // opt-in and stays that way: it records what the visitor sees and types,
      // a far larger collection than "an error happened", and not what this is
      // for. (Passing `integrations: []` would not remove anything — it is not
      // a default — so the honest way to keep replay off is to never add it.)
      Sentry.init(
        monitoringOptions(
          dsn,
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
          Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0)
        )
      )

      captureTransition = Sentry.captureRouterTransitionStart
    })
    .catch((error) => {
      // Monitoring failing to load must never break the page it monitors.
      console.error('[monitoring] Browser error reporting failed to start:', error)
    })
}

/**
 * Lets Sentry tie an error to the navigation that caused it.
 *
 * Next expects this symbol to exist, so it is exported unconditionally and
 * forwards only once the SDK has loaded — inert when monitoring is off, and
 * during the brief window before the chunk arrives.
 */
export const onRouterTransitionStart: TransitionCapture = (href, navigationType) => {
  captureTransition?.(href, navigationType)
}
