import type { ShipmentMode, ShipmentStatus } from '@prisma/client'

/**
 * Tracking provider contract.
 *
 * Every source of shipment data — GLEX's own records, the development mock, and
 * any future carrier integration — implements this interface, so the UI never
 * needs to know where a milestone came from.
 */

export type TrackingInput = {
  /** GLEX reference, container number, bill of lading, or carrier tracking number. */
  query: string
}

export type NormalizedEvent = {
  status: ShipmentStatus
  title: string
  description?: string | null
  location?: string | null
  occurredAt: Date
  isException: boolean
  /** Stable hash of the source payload — the unique key that blocks duplicates. */
  dedupeKey?: string | null
}

export type NormalizedTrackingResult = {
  found: boolean
  reference?: string
  status?: ShipmentStatus
  mode?: ShipmentMode
  originCountry?: string
  originCity?: string | null
  originPort?: string | null
  destinationCountry?: string
  destinationCity?: string | null
  destinationPort?: string | null
  carrier?: string | null
  containerNumber?: string | null
  billOfLading?: string | null
  estimatedDeparture?: Date | null
  actualDeparture?: Date | null
  estimatedArrival?: Date | null
  actualArrival?: Date | null
  progressPercent?: number
  exceptionNote?: string | null
  lastSyncedAt?: Date | null
  events: NormalizedEvent[]
  /**
   * True when the data is seeded/demonstration rather than live carrier data.
   * The UI MUST surface this — mock data is never presented as live.
   */
  isDemo: boolean
  /** Which provider produced this result. */
  provider: string
}

export interface TrackingProvider {
  readonly name: string
  track(input: TrackingInput): Promise<NormalizedTrackingResult>
  validateWebhook(request: Request): Promise<boolean>
  processWebhook(payload: unknown): Promise<void>
}

export const NOT_FOUND: NormalizedTrackingResult = {
  found: false,
  events: [],
  isDemo: false,
  provider: 'none',
}

/**
 * Ordered milestone sequence used to derive a progress percentage when a
 * provider does not supply one. Terminal/abnormal states are excluded.
 */
export const PROGRESS_SEQUENCE: readonly ShipmentStatus[] = [
  'BOOKING_CREATED',
  'AWAITING_COLLECTION',
  'COLLECTED',
  'AT_ORIGIN_WAREHOUSE',
  'EXPORT_DOCUMENTATION',
  'CUSTOMS_CLEARANCE',
  'AT_ORIGIN_PORT',
  'LOADED',
  'DEPARTED',
  'IN_TRANSIT',
  'TRANSSHIPMENT',
  'AT_DESTINATION_PORT',
  'IMPORT_CUSTOMS',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export function progressFor(status: ShipmentStatus): number {
  const index = PROGRESS_SEQUENCE.indexOf(status)
  if (index < 0) return 0
  return Math.round((index / (PROGRESS_SEQUENCE.length - 1)) * 100)
}
