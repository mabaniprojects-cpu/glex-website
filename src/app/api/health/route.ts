import { NextResponse } from 'next/server'

/**
 * Liveness probe.
 *
 * Answers one question: is this process able to serve HTTP? It deliberately
 * touches nothing else — no database, no object store, no mail.
 *
 * That restraint is the point. A load balancer pulls an instance out of
 * rotation when its liveness check fails, and an orchestrator restarts it. If
 * this checked the database, a single database blip would fail every instance
 * at once and take down the marketing site, the FAQ and the tracking page —
 * pages that do not need the database to be useful — and restarting the
 * application would not fix a database that is down. Dependency checks belong
 * to the readiness probe at `/api/health/ready`.
 *
 * Unauthenticated, so it must reveal nothing: no version, no configuration, no
 * uptime, no build id. Anything here is public.
 */

// Never prerendered or cached — a cached "ok" would outlive the process it
// describes.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Some probes use HEAD to avoid transferring a body. */
export function HEAD() {
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
