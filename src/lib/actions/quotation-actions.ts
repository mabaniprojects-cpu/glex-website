'use server'

import { RfqStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { nextReference, REFERENCE_SCOPES } from '@/lib/references'
import { fromDateTimeLocalInput } from '@/lib/utils'

/**
 * The staff side of an RFQ conversation: issuing quotations and replying to
 * the client.
 *
 * A quotation is a commercial offer, so it is issued in one transaction with
 * its reference, its activity record and its audit entry — a reference must
 * never exist without the offer it names, and vice versa.
 *
 * Note there is still **no price field** on the RFQ or the catalogue. The
 * commercial figures live in the uploaded document; this records that an offer
 * was made, when, and until when it stands.
 */

export type QuotationActionResult =
  | { ok: true; reference?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'closed' | 'server' }

const issueSchema = z.object({
  reference: z.string().trim().min(3).max(40),
  /** The uploaded offer document. Optional so a figure can be sent by hand. */
  fileId: z.union([z.literal(''), z.string().uuid()]).optional(),
  currency: z.string().trim().length(3).default('SAR'),
  notes: z.string().trim().max(2000).optional(),
  validUntil: z
    .union([z.literal(''), z.string().max(40)])
    .optional()
    .transform((value) => fromDateTimeLocalInput(value)),
})

export async function issueQuotation(input: unknown): Promise<QuotationActionResult> {
  const user = await requirePermission('rfq:quote')

  const parsed = issueSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, fileId, currency, notes, validUntil } = parsed.data

  // An offer that has already lapsed cannot be sent as a live one.
  if (validUntil && validUntil.getTime() <= Date.now()) {
    return { ok: false, error: 'validation' }
  }

  const rfq = await db.rFQ.findFirst({
    where: { reference, deletedAt: null },
    select: { id: true, status: true, _count: { select: { quotations: true } } },
  })
  if (!rfq) return { ok: false, error: 'not_found' }

  if (
    rfq.status === RfqStatus.CANCELLED ||
    rfq.status === RfqStatus.REJECTED ||
    rfq.status === RfqStatus.EXPIRED
  ) {
    return { ok: false, error: 'closed' }
  }

  // A referenced file must exist, or the client gets a download that 404s.
  if (fileId) {
    const file = await db.storedFile.findUnique({ where: { id: fileId }, select: { id: true } })
    if (!file) return { ok: false, error: 'validation' }
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const quotationRef = await nextReference(tx, REFERENCE_SCOPES.QUOTATION)

      const row = await tx.quotation.create({
        data: {
          rfqId: rfq.id,
          reference: quotationRef,
          // Revisions are numbered rather than overwritten, so a superseded
          // offer stays on the record.
          version: rfq._count.quotations + 1,
          fileId: fileId || null,
          currency: currency.toUpperCase(),
          notes: notes || null,
          validUntil,
          // Issued and sent are the same act here; there is no draft state.
          sentAt: new Date(),
        },
        select: { id: true, reference: true, version: true },
      })

      await tx.rFQ.update({
        where: { id: rfq.id },
        data: { status: RfqStatus.QUOTATION_SENT },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: 'QUOTATION_SENT',
          fromStatus: rfq.status,
          toStatus: RfqStatus.QUOTATION_SENT,
          metadata: { quotation: row.reference, version: row.version },
        },
      })

      await recordAudit(
        {
          actorId: user.id,
          action: 'rfq.quotation_issued',
          entityType: 'Quotation',
          entityId: row.id,
          after: { rfq: reference, quotation: row.reference, version: row.version },
        },
        tx
      )

      return row
    })

    revalidateRfq()
    return { ok: true, reference: created.reference }
  } catch (error) {
    console.error('[quotations] Issue failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Staff reply ------------------------------------------------------------

const replySchema = z.object({
  reference: z.string().trim().min(3).max(40),
  body: z.string().trim().min(2).max(4000),
  /**
   * Whether the message stays inside GLEX.
   *
   * Explicit rather than defaulted, so writing to the client is always a
   * deliberate act and an internal note can never become one by omission.
   */
  isInternal: z.boolean(),
})

export async function replyOnRfqAsStaff(input: unknown): Promise<QuotationActionResult> {
  const user = await requirePermission('rfq:manage')

  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, body, isInternal } = parsed.data

  const rfq = await db.rFQ.findFirst({
    where: { reference, deletedAt: null },
    select: { id: true },
  })
  if (!rfq) return { ok: false, error: 'not_found' }

  try {
    await db.$transaction(async (tx) => {
      await tx.rFQMessage.create({
        data: { rfqId: rfq.id, authorId: user.id, body, isInternal },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: isInternal ? 'INTERNAL_NOTE_ADDED' : 'STAFF_REPLIED',
        },
      })

      // Only a client-visible reply is audited as outbound communication; an
      // internal note is already captured by the activity record.
      if (!isInternal) {
        await recordAudit(
          {
            actorId: user.id,
            action: 'rfq.client_message_sent',
            entityType: 'RFQ',
            entityId: rfq.id,
            after: { reference },
          },
          tx
        )
      }
    })

    revalidateRfq()
    return { ok: true }
  } catch (error) {
    console.error('[quotations] Staff reply failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Both sides of the conversation.
 *
 * NOTE: revalidated by ROUTE PATTERN. An interpolated reference matches no
 * route and silently does nothing.
 */
function revalidateRfq() {
  revalidatePath('/[locale]/admin/rfqs/[reference]', 'page')
  revalidatePath('/[locale]/admin/rfqs', 'page')
  revalidatePath('/[locale]/dashboard/rfqs/[reference]', 'page')
  revalidatePath('/[locale]/dashboard/rfqs', 'page')
}
