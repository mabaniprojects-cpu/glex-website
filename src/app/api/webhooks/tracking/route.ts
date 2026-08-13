import { headers } from 'next/headers'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { ingestTrackingEvents } from '@/lib/tracking/ingest'
import { getTrackingProvider } from '@/lib/tracking/registry'

/**
 * Carrier tracking webhook.
 *
 * Deliberately thin: verify, parse, delegate. Everything worth testing lives in
 * `src/lib/tracking/ingest.ts`, which needs no HTTP.
 *
 * This is an unauthenticated endpoint in the sense that no session is involved —
 * the signature *is* the authentication. So it follows the rules that apply to
 * anything an outsider can call at will:
 *
 *   - A missing or invalid signature is rejected with a bare 401. No detail
 *     about which part failed, because that detail is an oracle.
 *   - The provider refuses everything when no secret is configured, so a
 *     deployment that forgot to set one is closed rather than open.
 *   - Rate-limited by IP, because signature verification itself costs work.
 *   - A valid signature over an unrecognised shipment returns 202, not 404 —
 *     otherwise the endpoint reports which references exist.
 */

export async function POST(request: Request) {
  const ip = clientIp(await headers())

  const limit = await checkRateLimit(`tracking-webhook:${ip}`, 120, 60 * 60)
  if (!limit.allowed) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  const provider = getTrackingProvider()

  // Reads the body itself (via `request.clone()`), so the parse below still
  // has an unconsumed stream.
  const valid = await provider.validateWebhook(request).catch(() => false)
  if (!valid) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const result = await ingestTrackingEvents(payload)

    // 202 throughout: the delivery is accepted, and whether it matched a
    // shipment is GLEX's business, not the caller's.
    return Response.json(
      { accepted: true, created: result.created, duplicates: result.duplicates },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_payload') {
      return Response.json({ error: 'invalid_payload' }, { status: 400 })
    }

    console.error('[tracking] Webhook ingestion failed:', error)
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

/** Anything other than POST, including GET probes. */
export async function GET() {
  return Response.json({ error: 'method_not_allowed' }, { status: 405 })
}
