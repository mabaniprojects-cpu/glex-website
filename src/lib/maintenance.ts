import { pruneRateLimits } from '@/lib/rate-limit'
import { pruneTokens } from '@/lib/tokens'

/**
 * Housekeeping for the two tables that grow without bound. Server-side only —
 * this reaches the database; never import it into a Client Component.
 *
 * `pruneRateLimits` and `pruneTokens` were both written "safe to call from a
 * scheduled job" — and then nothing called them. Left that way, `RateLimit`
 * accumulates a row per unique IP per action forever, and consumed password
 * reset tokens are kept indefinitely. Neither is an authorization hole (an
 * expired bucket is reset on next use, and a used token is rejected on its
 * `usedAt`), but a table of stale security material is not something to keep.
 *
 * Rather than depend on an operator configuring a cron — which is how this ended
 * up wired to nothing in the first place — the sweep is driven by ordinary
 * traffic via `after()`, so it needs no configuration to happen. An in-process
 * timer keeps it to once an hour per instance; several instances sweeping in the
 * same hour is harmless, since both prunes are idempotent `deleteMany`s.
 */

const SWEEP_INTERVAL_MS = 60 * 60_000

/**
 * `-Infinity` rather than 0 so the first request after a cold start sweeps
 * immediately. On a platform that recycles instances often, waiting an hour
 * from boot could mean never sweeping at all.
 */
let lastSweptAt = -Infinity

export type SweepResult = { rateLimits: number; tokens: number }

/** Runs both prunes unconditionally. Exported for scripts and tests. */
export async function runMaintenance(): Promise<SweepResult> {
  const [rateLimits, tokens] = await Promise.all([pruneRateLimits(), pruneTokens()])
  return { rateLimits, tokens }
}

/**
 * Sweeps if an hour has passed since this instance last did, and never throws —
 * housekeeping must not turn a healthy response into an error. Returns the
 * counts when it ran, `null` when it was not yet due.
 *
 * Call from `after()`: the work happens once the response is sent, so it costs
 * the visitor nothing.
 */
export async function sweepIfDue(): Promise<SweepResult | null> {
  const now = Date.now()
  if (now - lastSweptAt < SWEEP_INTERVAL_MS) return null

  // Claimed before awaiting, so concurrent requests on the same instance do not
  // all start a sweep.
  lastSweptAt = now

  try {
    const result = await runMaintenance()
    if (result.rateLimits || result.tokens) {
      console.info(
        `[maintenance] pruned ${result.rateLimits} rate-limit bucket(s), ${result.tokens} token(s)`
      )
    }
    return result
  } catch (error) {
    console.error('[maintenance] Sweep failed; will retry after the interval:', error)
    return null
  }
}

/** Test seam: forgets that a sweep has happened. */
export function resetSweepTimerForTests(): void {
  lastSweptAt = -Infinity
}
