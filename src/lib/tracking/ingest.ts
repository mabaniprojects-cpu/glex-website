import { createHash } from 'node:crypto'
import { ShipmentStatus } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { progressFor } from '@/lib/tracking/types'

/**
 * Carrier webhook ingestion.
 *
 * Kept out of the route handler so the rules can be tested directly: a webhook
 * endpoint is the one place where an outside party chooses when and how often
 * to call, so the interesting behaviour is all in the edges — replays,
 * out-of-order deliveries, and payloads naming a shipment that is not ours.
 *
 * Three properties matter:
 *
 *   1. **Idempotent.** `@@unique([shipmentId, dedupeKey])` makes a replay a
 *      no-op at the database level, not merely at the application level.
 *   2. **Never creates shipments.** A payload for an unknown reference is
 *      accepted and dropped. Letting a carrier invent shipments would make the
 *      endpoint a write primitive for anyone who obtained the secret.
 *   3. **Out-of-order safe.** The shipment's own status only moves forward to
 *      the newest event by `occurredAt`, so a late-delivered old milestone
 *      cannot roll a delivered shipment back to "in transit".
 */

export type IngestResult = {
  /** Events written. Zero is a normal outcome for a replay. */
  created: number
  /** Events already present, by dedupe key. */
  duplicates: number
  /** True when no shipment matched — accepted, deliberately not an error. */
  unknownShipment: boolean
}

const eventSchema = z.object({
  status: z.nativeEnum(ShipmentStatus),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  occurredAt: z.coerce.date(),
  isException: z.boolean().optional(),
  /** Provider's own id for the event, when it has one. */
  eventId: z.string().trim().max(200).optional(),
})

export const webhookPayloadSchema = z.object({
  /** Any identifier the carrier knows the shipment by. */
  reference: z.string().trim().max(100).optional(),
  containerNumber: z.string().trim().max(100).optional(),
  billOfLading: z.string().trim().max(100).optional(),
  events: z.array(eventSchema).min(1).max(100),
})

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>

/**
 * A stable key for an event.
 *
 * Prefers the carrier's own id. Without one, hashes the fields that identify
 * the milestone — so a carrier that re-sends the same event without an id is
 * still recognised as a repeat rather than appended twice.
 */
export function dedupeKeyFor(event: z.infer<typeof eventSchema>): string {
  if (event.eventId) return event.eventId

  return createHash('sha256')
    .update(
      [event.status, event.title, event.occurredAt.toISOString(), event.location ?? ''].join('|')
    )
    .digest('hex')
    .slice(0, 48)
}

export async function ingestTrackingEvents(rawPayload: unknown): Promise<IngestResult> {
  const parsed = webhookPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) throw new Error('invalid_payload')

  const { reference, containerNumber, billOfLading, events } = parsed.data

  // At least one identifier, or there is nothing to match on.
  if (!reference && !containerNumber && !billOfLading) throw new Error('invalid_payload')

  const shipment = await db.shipment.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(reference ? [{ reference }] : []),
        ...(containerNumber ? [{ containerNumber }] : []),
        ...(billOfLading ? [{ billOfLading }] : []),
      ],
    },
    select: { id: true, status: true },
  })

  // Accepted and dropped: a carrier must not be able to conjure a shipment.
  if (!shipment) return { created: 0, duplicates: 0, unknownShipment: true }

  let created = 0
  let duplicates = 0

  for (const event of events) {
    const dedupeKey = dedupeKeyFor(event)

    // `createMany` with `skipDuplicates` leans on the unique constraint, so two
    // simultaneous deliveries of the same event cannot both win.
    const result = await db.shipmentEvent.createMany({
      data: [
        {
          shipmentId: shipment.id,
          status: event.status,
          title: event.title,
          description: event.description ?? null,
          location: event.location ?? null,
          occurredAt: event.occurredAt,
          isException: event.isException ?? false,
          source: 'webhook',
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    })

    if (result.count > 0) created += 1
    else duplicates += 1
  }

  if (created > 0) {
    // Only the newest milestone decides the shipment's own status. A carrier
    // re-sending an old event must not reverse a later one.
    const newest = await db.shipmentEvent.findFirst({
      where: { shipmentId: shipment.id },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { status: true, isException: true },
    })

    if (newest) {
      await db.shipment.update({
        where: { id: shipment.id },
        data: {
          status: newest.status,
          progressPercent: progressFor(newest.status),
          lastSyncedAt: new Date(),
        },
      })
    }
  }

  return { created, duplicates, unknownShipment: false }
}
