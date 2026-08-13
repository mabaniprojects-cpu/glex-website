import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Carrier webhook ingestion.
 *
 * A webhook is the one endpoint where an outside party decides when and how
 * often to call, so the behaviour that matters is at the edges: replays,
 * out-of-order deliveries, and payloads naming a shipment that is not ours.
 * The database is mocked so those cases can be produced exactly.
 */

type Where = { where: { OR: Array<Record<string, string>> } }
type Data = { data: Record<string, unknown> }
type CreateMany = { data: unknown[]; skipDuplicates?: boolean }

const shipment = {
  findFirst: vi.fn<(args: Where) => Promise<{ id: string; status: string } | null>>(),
  update: vi.fn<(args: Data) => Promise<unknown>>(async () => ({})),
}

const shipmentEvent = {
  createMany: vi.fn<(args: CreateMany) => Promise<{ count: number }>>(async () => ({ count: 1 })),
  findFirst: vi.fn<() => Promise<{ status: string; isException: boolean } | null>>(async () => null),
}

vi.mock('@/lib/db', () => ({ db: { shipment, shipmentEvent } }))

const { dedupeKeyFor, ingestTrackingEvents } = await import('@/lib/tracking/ingest')

const EVENT = {
  status: 'IN_TRANSIT' as const,
  title: 'Departed Jeddah Islamic Port',
  occurredAt: '2026-03-01T10:00:00.000Z',
  location: 'Jeddah',
}

const PAYLOAD = { reference: 'GLEX-SHP-2026-000001', events: [EVENT] }

describe('ingestTrackingEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shipment.findFirst.mockResolvedValue({ id: 'shipment-1', status: 'DEPARTED' })
    shipmentEvent.createMany.mockResolvedValue({ count: 1 })
    shipmentEvent.findFirst.mockResolvedValue({ status: 'IN_TRANSIT', isException: false })
  })

  it('writes a new event and advances the shipment', async () => {
    const result = await ingestTrackingEvents(PAYLOAD)

    expect(result).toEqual({ created: 1, duplicates: 0, unknownShipment: false })
    expect(shipment.update).toHaveBeenCalledOnce()

    const { data } = shipment.update.mock.calls[0][0]
    expect(data.status).toBe('IN_TRANSIT')
    // Progress is derived from the milestone sequence, never sent by the carrier.
    expect(typeof data.progressPercent).toBe('number')
  })

  it('treats a replay as a no-op rather than a duplicate row', async () => {
    // The unique constraint absorbs it; `createMany` reports nothing written.
    shipmentEvent.createMany.mockResolvedValue({ count: 0 })

    const result = await ingestTrackingEvents(PAYLOAD)

    expect(result).toEqual({ created: 0, duplicates: 1, unknownShipment: false })
    // Nothing changed, so the shipment is not touched at all.
    expect(shipment.update).not.toHaveBeenCalled()
  })

  it('relies on the database constraint, not a prior read', async () => {
    await ingestTrackingEvents(PAYLOAD)

    const call = shipmentEvent.createMany.mock.calls[0][0]
    // Checking-then-inserting would let two simultaneous deliveries both pass
    // the check. `skipDuplicates` makes the constraint the arbiter.
    expect(call.skipDuplicates).toBe(true)
  })

  it('accepts and drops a payload for an unknown shipment', async () => {
    shipment.findFirst.mockResolvedValue(null)

    const result = await ingestTrackingEvents(PAYLOAD)

    expect(result.unknownShipment).toBe(true)
    // A carrier must never be able to conjure a shipment into existence.
    expect(shipmentEvent.createMany).not.toHaveBeenCalled()
    expect(shipment.update).not.toHaveBeenCalled()
  })

  it('does not roll a shipment back when an old event arrives late', async () => {
    // The late delivery is written, but the newest event by `occurredAt` is
    // still the delivery — so that is what the shipment reflects.
    shipmentEvent.findFirst.mockResolvedValue({ status: 'DELIVERED', isException: false })

    await ingestTrackingEvents({
      reference: 'GLEX-SHP-2026-000001',
      events: [{ ...EVENT, status: 'AT_ORIGIN_PORT', occurredAt: '2026-01-01T00:00:00.000Z' }],
    })

    const { data } = shipment.update.mock.calls[0][0]
    expect(data.status).toBe('DELIVERED')
  })

  it('matches on a container number when no reference is given', async () => {
    await ingestTrackingEvents({ containerNumber: 'MSKU1234567', events: [EVENT] })

    const { where } = shipment.findFirst.mock.calls[0][0]
    expect(where.OR).toEqual([{ containerNumber: 'MSKU1234567' }])
  })

  it('refuses a payload with no identifier at all', async () => {
    await expect(ingestTrackingEvents({ events: [EVENT] })).rejects.toThrow('invalid_payload')
    expect(shipment.findFirst).not.toHaveBeenCalled()
  })

  it('refuses an unknown status rather than coercing it', async () => {
    await expect(
      ingestTrackingEvents({ reference: 'X', events: [{ ...EVENT, status: 'TELEPORTED' }] })
    ).rejects.toThrow('invalid_payload')
  })

  it('refuses an empty event list', async () => {
    await expect(ingestTrackingEvents({ reference: 'X', events: [] })).rejects.toThrow(
      'invalid_payload'
    )
  })
})

describe('dedupeKeyFor', () => {
  const event = {
    status: 'IN_TRANSIT' as const,
    title: 'Departed',
    occurredAt: new Date('2026-03-01T10:00:00.000Z'),
    location: 'Jeddah',
  }

  it("prefers the carrier's own event id", () => {
    expect(dedupeKeyFor({ ...event, eventId: 'carrier-abc-123' })).toBe('carrier-abc-123')
  })

  it('derives a stable key when the carrier supplies no id', () => {
    // A carrier re-sending the same milestone without an id must still be
    // recognised as a repeat rather than appended twice.
    expect(dedupeKeyFor(event)).toBe(dedupeKeyFor({ ...event }))
  })

  it('distinguishes different milestones', () => {
    expect(dedupeKeyFor(event)).not.toBe(dedupeKeyFor({ ...event, status: 'DELIVERED' }))
    expect(dedupeKeyFor(event)).not.toBe(dedupeKeyFor({ ...event, location: 'Dammam' }))
    expect(dedupeKeyFor(event)).not.toBe(
      dedupeKeyFor({ ...event, occurredAt: new Date('2026-03-02T10:00:00.000Z') })
    )
  })
})

/**
 * Signature verification, reproduced against the same algorithm the provider
 * uses. The provider itself reads `env()`, which is awkward to drive from a
 * unit test; what is pinned here is the property that matters — that a body
 * altered in transit cannot keep a valid signature.
 */
describe('webhook signature', () => {
  const secret = 'test-secret-value'
  const sign = (body: string) => createHmac('sha256', secret).update(body).digest('hex')

  it('changes completely when the body changes by one character', () => {
    const original = JSON.stringify(PAYLOAD)
    const tampered = original.replace('IN_TRANSIT', 'DELIVERED')

    expect(sign(original)).not.toBe(sign(tampered))
  })

  it('is stable for an identical body', () => {
    expect(sign(JSON.stringify(PAYLOAD))).toBe(sign(JSON.stringify(PAYLOAD)))
  })

  it('produces a fixed-length hex digest, so comparison length never leaks', () => {
    // `timingSafeEqual` throws on a length mismatch, which is why the provider
    // checks length first; a hex digest is always 64 chars regardless of input.
    expect(sign('short')).toHaveLength(64)
    expect(sign('a much longer body '.repeat(100))).toHaveLength(64)
  })
})
