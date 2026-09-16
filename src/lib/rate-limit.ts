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
 *
 * `do-connecting-ip` comes first because DigitalOcean App Platform sets it
 * itself. The FIRST `x-forwarded-for` entry must never be trusted: proxies
 * append to that header, so its first entry is whatever the client sent. Keying
 * on it let every form's limit be bypassed by sending a new fake address with
 * each request — verified against production on 2026-09-16, when 130 webhook
 * calls with random addresses drew no 429 while the same calls without the
 * header were refused after 120. The last entry is the one added by the
 * nearest proxy, so it is the only one a client cannot choose.
 */
export function clientIp(headers: Headers): string {
  const platform = headers.get('do-connecting-ip')?.trim()
  if (platform) return platform

  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (forwarded?.length) return forwarded[forwarded.length - 1]!

  return headers.get('x-real-ip') ?? 'unknown'
}

/** Removes expired buckets. Safe to call from a scheduled job. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return count
}
