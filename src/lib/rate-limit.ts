import { db } from '@/lib/db'

/**
 * Durable, database-backed rate limiting.
 *
 * A fixed window keyed by `<action>:<identifier>` (usually an IP). Backed by a
 * table rather than memory so the limit survives a restart and holds across
 * multiple server instances.
 */

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowSeconds * 1000)

  try {
    const existing = await db.rateLimit.findUnique({ where: { key } })

    // No bucket, or the previous window has expired — start a fresh one.
    if (!existing || existing.expiresAt <= now) {
      await db.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: resetAt },
        update: { count: 1, expiresAt: resetAt },
      })
      return { allowed: true, remaining: limit - 1, resetAt }
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: existing.expiresAt }
    }

    const updated = await db.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
      select: { count: true, expiresAt: true },
    })

    return {
      allowed: true,
      remaining: Math.max(0, limit - updated.count),
      resetAt: updated.expiresAt,
    }
  } catch {
    // Never let the limiter itself take the site down. Fail open, but say so.
    console.error(`[rate-limit] Backend unavailable for key "${key}"; allowing the request.`)
    return { allowed: true, remaining: 0, resetAt }
  }
}

/**
 * Best-effort client IP from the proxy headers. Only ever used as a rate-limit
 * bucket key and for consent/audit records — never for authorization.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? 'unknown'
}

/** Removes expired buckets. Safe to call from a scheduled job. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return count
}
