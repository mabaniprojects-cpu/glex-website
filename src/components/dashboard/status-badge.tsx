import type { RfqStatus, ShipmentStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

/**
 * Status pills.
 *
 * Colour is never the only signal — the label always carries the meaning, so
 * the badge remains readable without colour perception (WCAG 1.4.1).
 */

type Tone = 'neutral' | 'progress' | 'attention' | 'success' | 'danger'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-glex-green-800 border-border-subtle',
  progress: 'bg-glex-green-50 text-glex-green-700 border-glex-green-200',
  attention: 'bg-glex-gold-50 text-glex-gold-800 border-glex-gold-300',
  success: 'bg-glex-green-600 text-white border-glex-green-600',
  danger: 'bg-red-50 text-red-800 border-red-300',
}

const RFQ_TONES: Record<RfqStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'progress',
  UNDER_REVIEW: 'progress',
  CLARIFICATION_REQUIRED: 'attention',
  SUPPLIER_SOURCING: 'progress',
  QUOTATION_PREPARED: 'progress',
  QUOTATION_SENT: 'attention',
  CLIENT_REVIEWING: 'attention',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
  CONVERTED_TO_ORDER: 'success',
  CANCELLED: 'neutral',
}

const SHIPMENT_TONES: Record<ShipmentStatus, Tone> = {
  BOOKING_CREATED: 'neutral',
  AWAITING_COLLECTION: 'neutral',
  COLLECTED: 'progress',
  AT_ORIGIN_WAREHOUSE: 'progress',
  EXPORT_DOCUMENTATION: 'progress',
  CUSTOMS_CLEARANCE: 'progress',
  AT_ORIGIN_PORT: 'progress',
  LOADED: 'progress',
  DEPARTED: 'progress',
  IN_TRANSIT: 'progress',
  TRANSSHIPMENT: 'progress',
  AT_DESTINATION_PORT: 'progress',
  IMPORT_CUSTOMS: 'progress',
  OUT_FOR_DELIVERY: 'attention',
  DELIVERED: 'success',
  DELAYED: 'attention',
  EXCEPTION: 'danger',
  CANCELLED: 'neutral',
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  )
}

export function RfqStatusBadge({ status, label }: { status: RfqStatus; label: string }) {
  return <Badge tone={RFQ_TONES[status]}>{label}</Badge>
}

export function ShipmentStatusBadge({
  status,
  label,
}: {
  status: ShipmentStatus
  label: string
}) {
  return <Badge tone={SHIPMENT_TONES[status]}>{label}</Badge>
}
