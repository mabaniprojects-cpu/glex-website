import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Human-readable reference numbers: GLEX-RFQ-2026-000001.
 *
 * The counter is incremented inside the caller's transaction and the row is
 * locked by the upsert, so two concurrent submissions can never receive the
 * same reference.
 */

export const REFERENCE_SCOPES = {
  RFQ: 'RFQ',
  SHIPMENT: 'SHP',
  INQUIRY: 'INQ',
  TICKET: 'TKT',
  QUOTATION: 'QUO',
} as const

export type ReferenceScope = (typeof REFERENCE_SCOPES)[keyof typeof REFERENCE_SCOPES]

type Client = PrismaClient | Prisma.TransactionClient

export async function nextReference(
  tx: Client,
  scope: ReferenceScope,
  year = new Date().getFullYear()
): Promise<string> {
  const counter = await tx.referenceCounter.upsert({
    where: { scope_year: { scope, year } },
    create: { scope, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  })

  return formatReference(scope, year, counter.value)
}

export function formatReference(scope: ReferenceScope, year: number, value: number): string {
  return `GLEX-${scope}-${year}-${String(value).padStart(6, '0')}`
}

/** Loose shape check used to decide whether a tracking query looks like ours. */
export function isGlexReference(value: string): boolean {
  return /^GLEX-[A-Z]{3}-\d{4}-\d{6}$/i.test(value.trim())
}
