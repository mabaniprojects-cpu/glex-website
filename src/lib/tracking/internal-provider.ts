import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import {
  NOT_FOUND,
  progressFor,
  type NormalizedTrackingResult,
  type TrackingInput,
  type TrackingProvider,
} from './types'

/**
 * The GLEX-managed provider.
 *
 * Shipments and events are maintained by GLEX logistics staff in the admin
 * portal. This is the production-safe default: everything it returns is a real
 * record entered by a person, never a fabricated carrier feed.
 */
export const internalProvider: TrackingProvider = {
  name: 'internal',

  async track({ query }: TrackingInput): Promise<NormalizedTrackingResult> {
    const value = query.trim()
    if (!value) return NOT_FOUND

    // A shipment is findable by any of its four public identifiers.
    const shipment = await db.shipment.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { reference: { equals: value, mode: 'insensitive' } },
          { containerNumber: { equals: value, mode: 'insensitive' } },
          { billOfLading: { equals: value, mode: 'insensitive' } },
          { carrierTrackingNumber: { equals: value, mode: 'insensitive' } },
        ],
      },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
    })

    if (!shipment) return NOT_FOUND

    return {
      found: true,
      reference: shipment.reference,
      status: shipment.status,
      mode: shipment.mode,
      originCountry: shipment.originCountry,
      originCity: shipment.originCity,
      originPort: shipment.originPort,
      destinationCountry: shipment.destinationCountry,
      destinationCity: shipment.destinationCity,
      destinationPort: shipment.destinationPort,
      carrier: shipment.carrier,
      containerNumber: shipment.containerNumber,
      billOfLading: shipment.billOfLading,
      estimatedDeparture: shipment.estimatedDeparture,
      actualDeparture: shipment.actualDeparture,
      estimatedArrival: shipment.estimatedArrival,
      actualArrival: shipment.actualArrival,
      progressPercent: shipment.progressPercent || progressFor(shipment.status),
      exceptionNote: shipment.exceptionNote,
      lastSyncedAt: shipment.lastSyncedAt,
      isDemo: shipment.isDemo,
      provider: shipment.provider,
      events: shipment.events.map((event) => ({
        status: event.status,
        title: event.title,
        description: event.description,
        location: event.location,
        occurredAt: event.occurredAt,
        isException: event.isException,
        dedupeKey: event.dedupeKey,
      })),
    }
  },

  /**
   * HMAC-SHA256 over the raw body, compared in constant time.
   * Returns false whenever no secret is configured — an unverifiable webhook is
   * never trusted.
   */
  async validateWebhook(request: Request): Promise<boolean> {
    const secret = env().TRACKING_WEBHOOK_SECRET
    if (!secret) return false

    const signature = request.headers.get('x-glex-signature')
    if (!signature) return false

    const body = await request.clone().text()
    const expected = createHmac('sha256', secret).update(body).digest('hex')

    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  },

  /**
   * The internal provider has no external feed to ingest; events are created by
   * staff through the admin portal. Kept explicit so the interface is honoured.
   */
  async processWebhook(): Promise<void> {
    return
  },
}
