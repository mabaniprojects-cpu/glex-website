import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The housekeeping sweep.
 *
 * `pruneRateLimits` and `pruneTokens` both shipped documented as "safe to call
 * from a scheduled job", and nothing called either one. These tests pin the
 * thing that was actually missing: that ordinary traffic drives them, and that
 * it does so at most once an hour rather than on every request.
 */

const pruneRateLimits = vi.fn(async () => 3)
const pruneTokens = vi.fn(async () => 2)

vi.mock('@/lib/rate-limit', () => ({ pruneRateLimits: () => pruneRateLimits() }))
vi.mock('@/lib/tokens', () => ({ pruneTokens: () => pruneTokens() }))

const { runMaintenance, sweepIfDue, resetSweepTimerForTests } = await import('@/lib/maintenance')

describe('sweepIfDue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSweepTimerForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sweeps on the first request rather than an hour after boot', async () => {
    // An instance recycled every few minutes would otherwise never sweep.
    const result = await sweepIfDue()

    expect(result).toEqual({ rateLimits: 3, tokens: 2 })
    expect(pruneRateLimits).toHaveBeenCalledTimes(1)
    expect(pruneTokens).toHaveBeenCalledTimes(1)
  })

  it('does not sweep again on the next request', async () => {
    await sweepIfDue()
    vi.advanceTimersByTime(60_000)

    expect(await sweepIfDue()).toBeNull()
    expect(pruneRateLimits).toHaveBeenCalledTimes(1)
  })

  it('sweeps again once the interval has passed', async () => {
    await sweepIfDue()
    vi.advanceTimersByTime(60 * 60_000 + 1)

    expect(await sweepIfDue()).not.toBeNull()
    expect(pruneRateLimits).toHaveBeenCalledTimes(2)
  })

  it('claims the interval before awaiting, so concurrent requests sweep once', async () => {
    // Both callers start before either finishes — the guard has to be set
    // synchronously, not after the await.
    const [first, second] = await Promise.all([sweepIfDue(), sweepIfDue()])

    expect([first, second].filter(Boolean)).toHaveLength(1)
    expect(pruneRateLimits).toHaveBeenCalledTimes(1)
  })

  it('swallows a failure instead of breaking the response it runs after', async () => {
    pruneTokens.mockRejectedValueOnce(new Error('connection lost'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sweepIfDue()).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('retries after the interval when a sweep fails', async () => {
    pruneTokens.mockRejectedValueOnce(new Error('connection lost'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await sweepIfDue()
    vi.advanceTimersByTime(60 * 60_000 + 1)

    expect(await sweepIfDue()).toEqual({ rateLimits: 3, tokens: 2 })
  })
})

describe('runMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prunes both tables regardless of when the last sweep was', async () => {
    expect(await runMaintenance()).toEqual({ rateLimits: 3, tokens: 2 })
    expect(pruneRateLimits).toHaveBeenCalledTimes(1)
    expect(pruneTokens).toHaveBeenCalledTimes(1)
  })
})
