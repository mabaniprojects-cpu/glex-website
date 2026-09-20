'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

/**
 * The finance desk's one write.
 *
 * Everything else finance touches is read-only on purpose: recording that an
 * order was invoiced must not come with the ability to change what was quoted.
 * Marking is reversible — an invoice raised against the wrong quotation has to
 * be undoable — and both directions are audited.
 */

export type FinanceActionResult =
  { ok: true } | { ok: false; error: 'validation' | 'not_found' | 'not_sent' | 'server' }

const schema = z.object({
  id: z.string().uuid(),
  invoiced: z.boolean(),
  invoiceReference: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().max(64).optional()
  ),
})

export async function markQuotationInvoiced(input: unknown): Promise<FinanceActionResult> {
  const actor = await requirePermission('quotation:settle')

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }
  const { id, invoiced, invoiceReference } = parsed.data

  const quotation = await db.quotation.findUnique({
    where: { id },
    select: { id: true, sentAt: true, invoicedAt: true, invoiceReference: true },
  })
  if (!quotation) return { ok: false, error: 'not_found' }

  // A quotation that was never sent is not something anyone can invoice.
  if (!quotation.sentAt) return { ok: false, error: 'not_sent' }

  try {
    await db.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id },
        data: {
          invoicedAt: invoiced ? (quotation.invoicedAt ?? new Date()) : null,
          invoiceReference: invoiced ? (invoiceReference ?? null) : null,
        },
      })

      await recordAudit(
        {
          actorId: actor.id,
          action: invoiced ? 'quotation.invoiced' : 'quotation.invoice_cleared',
          entityType: 'Quotation',
          entityId: id,
          before: {
            invoicedAt: quotation.invoicedAt,
            invoiceReference: quotation.invoiceReference,
          },
          after: { invoicedAt: invoiced ? new Date() : null, invoiceReference },
        },
        tx
      )
    })

    revalidatePath('/admin/finance')
    return { ok: true }
  } catch (error) {
    console.error('[finance] Failed to record invoicing:', error)
    return { ok: false, error: 'server' }
  }
}
