import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The readiness probe's failure branch.
 *
 * An E2E test cannot reach this without taking the database down mid-run, so
 * the one path that only ever executes during an incident would otherwise be
 * the one path never exercised.
 */

const queryRaw = vi.fn()

vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }))

const { GET } = await import('@/app/api/health/ready/route')

describe('GET /api/health/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('reports ready when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ready' })
  })

  it('answers 503 rather than throwing when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.4:5432'))

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unavailable' })
  })

  it('never puts the reason in the response', async () => {
    // The probe is unauthenticated. A driver error carries the host, port and
    // sometimes the user — none of which belongs on the public internet.
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.4:5432'))

    const body = await (await GET()).text()

    expect(body).not.toContain('10.0.0.4')
    expect(body).not.toMatch(/ECONNREFUSED|5432/)
  })

  it('logs the reason server-side, where an operator needs it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.4:5432'))

    await GET()

    expect(consoleError).toHaveBeenCalledWith('[health] Readiness check failed:', expect.any(Error))
  })

  it('is never cached', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }])

    expect((await GET()).headers.get('cache-control')).toContain('no-store')
  })

  it('fails the probe instead of hanging when the database never answers', async () => {
    vi.useFakeTimers()
    // A connection that neither resolves nor rejects: without the timeout the
    // probe would hold open until the platform's own, much longer, deadline.
    queryRaw.mockReturnValue(new Promise(() => {}))

    const pending = GET()
    await vi.advanceTimersByTimeAsync(5_000)
    const response = await pending

    expect(response.status).toBe(503)
    vi.useRealTimers()
  })
})
