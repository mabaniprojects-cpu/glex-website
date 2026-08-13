// @vitest-environment node
import 'dotenv/config'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { checkRateLimit, clientIp, pruneRateLimits } from '../rate-limit'

/**
 * Exercises the real database-backed limiter.
 *
 * Each test uses a unique key, so runs are deterministic and never collide
 * with each other or with the E2E suite (which shares one client IP and
 * therefore cannot test this reliably).
 */

const keys: string[] = []
function uniqueKey(label: string) {
  const key = `test:${label}:${Date.now()}:${Math.random().toString(36).slice(2)}`
  keys.push(key)
  return key
}

afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { key: { in: keys } } })
  await db.$disconnect()
})

describe('checkRateLimit', () => {
  it('allows requests up to the limit, then refuses', async () => {
    const key = uniqueKey('burst')

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await checkRateLimit(key, 3, 60)
      expect(result.allowed, `attempt ${attempt}`).toBe(true)
      expect(result.remaining).toBe(3 - attempt)
    }

    const refused = await checkRateLimit(key, 3, 60)
    expect(refused.allowed).toBe(false)
    expect(refused.remaining).toBe(0)
    expect(refused.resetAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('keeps separate buckets per key', async () => {
    const a = uniqueKey('iso-a')
    const b = uniqueKey('iso-b')

    await checkRateLimit(a, 1, 60)
    expect((await checkRateLimit(a, 1, 60)).allowed).toBe(false)

    // A different key must be unaffected.
    expect((await checkRateLimit(b, 1, 60)).allowed).toBe(true)
  })

  it('starts a fresh window once the previous one expires', async () => {
    const key = uniqueKey('expiry')

    // A one-second window, immediately exhausted.
    expect((await checkRateLimit(key, 1, 1)).allowed).toBe(true)
    expect((await checkRateLimit(key, 1, 1)).allowed).toBe(false)

    // Force expiry rather than sleeping, so the test stays fast and stable.
    await db.rateLimit.update({
      where: { key },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const afterExpiry = await checkRateLimit(key, 1, 60)
    expect(afterExpiry.allowed).toBe(true)
  })

  it('persists the counter across calls', async () => {
    const key = uniqueKey('persist')
    await checkRateLimit(key, 10, 60)
    await checkRateLimit(key, 10, 60)

    const row = await db.rateLimit.findUnique({ where: { key } })
    expect(row?.count).toBe(2)
  })
})

describe('pruneRateLimits', () => {
  it('removes only expired buckets', async () => {
    const stale = uniqueKey('stale')
    const live = uniqueKey('live')

    await checkRateLimit(stale, 5, 60)
    await checkRateLimit(live, 5, 60)
    await db.rateLimit.update({
      where: { key: stale },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    })

    await pruneRateLimits()

    expect(await db.rateLimit.findUnique({ where: { key: stale } })).toBeNull()
    expect(await db.rateLimit.findUnique({ where: { key: live } })).not.toBeNull()
  })
})

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.4, 70.41.3.18' })
    expect(clientIp(headers)).toBe('203.0.113.4')
  })

  it('falls back to x-real-ip, then to a sentinel', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})
