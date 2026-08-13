import { expect, test } from '@playwright/test'

/**
 * Health probes.
 *
 * These exist for load balancers and orchestrators, so the contract is the
 * status code, not the body. They are also unauthenticated, which makes what
 * they *do not* say as important as what they do.
 */

test.describe('Health probes', () => {
  test('liveness answers 200 without touching the database', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('liveness answers HEAD, which is what many probes send', async ({ request }) => {
    const response = await request.head('/api/health')

    expect(response.status()).toBe(200)
  })

  test('readiness answers 200 while the database is up', async ({ request }) => {
    const response = await request.get('/api/health/ready')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ready' })
  })

  test('neither probe is cached', async ({ request }) => {
    // A cached "ok" would outlive the process it describes.
    for (const path of ['/api/health', '/api/health/ready']) {
      const response = await request.get(path)
      expect(response.headers()['cache-control'], path).toContain('no-store')
    }
  })

  test('neither probe leaks anything about the deployment', async ({ request }) => {
    for (const path of ['/api/health', '/api/health/ready']) {
      const body = await (await request.get(path)).text()

      // No version, build id, uptime, host name, connection string or driver
      // detail — anything here is readable by anyone on the internet.
      expect(body.length, path).toBeLessThan(64)
      expect(body, path).not.toMatch(/postgres|prisma|localhost|127\.0\.0\.1|version|node|\d+\.\d+\.\d+/i)
    }
  })

  test('the probes are not locale-redirected', async ({ request }) => {
    // The proxy matcher excludes /api; if that ever changes, a probe would get
    // a 307 to /en/api/health and every instance would look unhealthy.
    const response = await request.get('/api/health', { maxRedirects: 0 })

    expect(response.status()).toBe(200)
  })
})
