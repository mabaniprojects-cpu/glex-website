'use server'

import { RfqStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { rfqScope } from '@/lib/dashboard'
import { isRfqClosed } from '@/lib/rfq-status'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { headers } from 'next/headers'

/**
 * The client side of an RFQ conversation.
 *
 * Two rules hold everything else up:
 *
 *   1. A client may only touch an RFQ that `rfqScope()` says is theirs. The
 *      lookup is scoped in SQL, so a reference belonging to someone else is
 *      indistinguishable from one that does not exist.
 *   2. `isInternal` is never accepted from the caller. A client message is
 *      always written as client-visible, so no client can author a note that
 *      appears to be a private staff remark — or read one.
 */

export type RfqConversationResult =
  | { ok: true }
  | {
      ok: false
      error: 'validation' | 'not_found' | 'rate_limited' | 'closed' | 'server'
    }

const replySchema = z.object({
  reference: z.string().trim().min(3).max(40),
  body: z.string().trim().min(2).max(4000),
})

export async function replyToRfq(input: unknown): Promise<RfqConversationResult> {
  const user = await requireUser()

  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, body } = parsed.data

  // A reply is cheap to send and expensive to moderate.
  const limit = await checkRateLimit(`rfq-reply:${user.id}`, 30, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  const rfq = await db.rFQ.findFirst({
    where: { reference, deletedAt: null, ...rfqScope(user) },
    select: { id: true, status: true },
  })
  // Scoped in SQL: someone else's reference reads exactly like a missing one.
  if (!rfq) return { ok: false, error: 'not_found' }

  if (isRfqClosed(rfq.status)) return { ok: false, error: 'closed' }

  try {
    await db.$transaction(async (tx) => {
      await tx.rFQMessage.create({
        data: {
          rfqId: rfq.id,
          authorId: user.id,
          body,
          // Hard-coded, never taken from the payload.
          isInternal: false,
        },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: 'CLIENT_REPLIED',
          metadata: { ip: clientIp(await headers()) },
        },
      })
    })

    revalidatePath('/[locale]/dashboard/rfqs/[reference]', 'page')
    revalidatePath('/[locale]/admin/rfqs/[reference]', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[rfq] Client reply failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Quotation decision -----------------------------------------------------

const decisionSchema = z.object({
  quotationId: z.string().uuid(),
  accept: z.boolean(),
  reason: z.string().trim().max(1000).optional(),
})

/**
 * Records the client's answer to a quotation.
 *
 * A decision is final in one direction: once accepted or rejected it is not
 * re-openable here, because both outcomes trigger commercial work downstream
 * and a silent flip would leave that work unexplained.
 */
export async function respondToQuotation(input: unknown): Promise<RfqConversationResult> {
  const user = await requireUser()

  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { quotationId, accept, reason } = parsed.data

  const quotation = await db.quotation.findFirst({
    where: {
      id: quotationId,
      // Only a quotation actually sent to an RFQ this user owns.
      sentAt: { not: null },
      rfq: { deletedAt: null, ...rfqScope(user) },
    },
    select: {
      id: true,
      reference: true,
      acceptedAt: true,
      rejectedAt: true,
      rfq: { select: { id: true, reference: true } },
    },
  })
  if (!quotation) return { ok: false, error: 'not_found' }

  // Already answered — treat as settled rather than overwriting the record.
  if (quotation.acceptedAt || quotation.rejectedAt) return { ok: false, error: 'closed' }

  const now = new Date()

  try {
    await db.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotation.id },
        data: accept
          ? { acceptedAt: now }
          : { rejectedAt: now, rejectionReason: reason || null },
      })

      await tx.rFQ.update({
        where: { id: quotation.rfq.id },
        data: { status: accept ? RfqStatus.ACCEPTED : RfqStatus.REJECTED },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: quotation.rfq.id,
          actorId: user.id,
          action: accept ? 'QUOTATION_ACCEPTED' : 'QUOTATION_REJECTED',
          toStatus: accept ? RfqStatus.ACCEPTED : RfqStatus.REJECTED,
          metadata: { quotation: quotation.reference },
        },
      })

      // A rejection reason is the client's own words; keep it in the thread
      // where staff will actually read it, not only in the activity metadata.
      if (!accept && reason) {
        await tx.rFQMessage.create({
          data: {
            rfqId: quotation.rfq.id,
            authorId: user.id,
            body: reason,
            isInternal: false,
          },
        })
      }
    })

    revalidatePath('/[locale]/dashboard/rfqs/[reference]', 'page')
    revalidatePath('/[locale]/admin/rfqs/[reference]', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[rfq] Quotation decision failed:', error)
    return { ok: false, error: 'server' }
  }
}
