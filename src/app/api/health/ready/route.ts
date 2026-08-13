import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Readiness probe.
 *
 * Whether this instance can serve requests that need the database. Use it to
 * gate traffic during a rolling deploy — an instance that has started but whose
 * connection pool is not up yet answers 503 here and should not receive
 * requests. Do **not** wire it to a restart policy: restarting the application
 * cannot fix a database that is unreachable, and doing so turns a recoverable
 * outage into a crash loop. That is what `/api/health` is for.
 *
 * Unauthenticated, so it reports only pass or fail. The reason a dependency is
 * down goes to the server log, never to the response — a connection string, a
 * host name or a driver error message would all be leaked otherwise.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TIMEOUT_MS = 5_000

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }

  try {
    // Bounded, so a hung connection fails the probe instead of holding it open
    // until the platform's own timeout — which reads as a much worse fault.
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`no response in ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      ),
    ])

    return NextResponse.json({ status: 'ready' }, { headers })
  } catch (error) {
    console.error('[health] Readiness check failed:', error)
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers })
  }
}
