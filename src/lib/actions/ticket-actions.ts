'use server'

import { TicketPriority, TicketStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission, requireUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Support tickets.
 *
 * Tickets already existed before this module: the GLEX Assistant's human
 * handoff creates them. They simply had nowhere to be read or answered, so a
 * visitor could be given a `GLEX-TKT-…` reference that nobody could act on.
 *
 * The same two rules as the RFQ thread hold here:
 *
 *   1. A requester may only touch their own ticket, scoped in SQL.
 *   2. `isInternal` is never accepted from a requester — their messages are
 *      always written client-visible, so nobody can author what looks like a
 *      private staff note, or read one.
 */

export type TicketActionResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'not_found' | 'rate_limited' | 'closed' | 'server' }

/** A closed ticket keeps its history but takes no new messages. */
const CLOSED: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED]

const replySchema = z.object({
  reference: z.string().trim().min(3).max(40),
  body: z.string().trim().min(2).max(4000),
})

export async function replyToTicket(input: unknown): Promise<TicketActionResult> {
  const user = await requireUser()

  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, body } = parsed.data

  const limit = await checkRateLimit(`ticket-reply:${user.id}`, 30, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  // Scoped in SQL: someone else's reference reads exactly like a missing one.
  const ticket = await db.supportTicket.findFirst({
    where: { reference, requesterId: user.id },
    select: { id: true, status: true },
  })
  if (!ticket) return { ok: false, error: 'not_found' }

  if (CLOSED.includes(ticket.status)) return { ok: false, error: 'closed' }

  try {
    await db.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          body,
          // Hard-coded, never taken from the payload.
          isInternal: false,
        },
      })

      // A reply from the client moves the ticket off "waiting on client",
      // otherwise it sits in a state that blames them for the delay.
      if (ticket.status === TicketStatus.WAITING_ON_CLIENT) {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: TicketStatus.IN_PROGRESS },
        })
      }
    })

    revalidateTickets()
    return { ok: true }
  } catch (error) {
    console.error('[tickets] Client reply failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Staff ------------------------------------------------------------------

const staffReplySchema = z.object({
  reference: z.string().trim().min(3).max(40),
  body: z.string().trim().min(2).max(4000),
  /**
   * Explicit, with no default that reaches the requester. The damaging mistake
   * here is an internal remark going out by accident.
   */
  isInternal: z.boolean(),
})

export async function replyToTicketAsStaff(input: unknown): Promise<TicketActionResult> {
  const user = await requirePermission('ticket:manage')

  const parsed = staffReplySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, body, isInternal } = parsed.data

  const ticket = await db.supportTicket.findFirst({
    where: { reference },
    select: { id: true },
  })
  if (!ticket) return { ok: false, error: 'not_found' }

  try {
    await db.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, body, isInternal },
      })

      // Only outbound communication is audited; an internal note is ordinary
      // working discussion.
      if (!isInternal) {
        await recordAudit(
          {
            actorId: user.id,
            action: 'ticket.client_message_sent',
            entityType: 'SupportTicket',
            entityId: ticket.id,
            after: { reference },
          },
          tx
        )
      }
    })

    revalidateTickets()
    return { ok: true }
  } catch (error) {
    console.error('[tickets] Staff reply failed:', error)
    return { ok: false, error: 'server' }
  }
}

const updateSchema = z.object({
  reference: z.string().trim().min(3).max(40),
  status: z.nativeEnum(TicketStatus),
  priority: z.nativeEnum(TicketPriority),
})

export async function updateTicket(input: unknown): Promise<TicketActionResult> {
  const user = await requirePermission('ticket:manage')

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, status, priority } = parsed.data

  const before = await db.supportTicket.findFirst({
    where: { reference },
    select: { id: true, status: true, priority: true },
  })
  if (!before) return { ok: false, error: 'not_found' }

  if (before.status === status && before.priority === priority) return { ok: true }

  try {
    await db.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id: before.id }, data: { status, priority } })

      await recordAudit(
        {
          actorId: user.id,
          action: 'ticket.updated',
          entityType: 'SupportTicket',
          entityId: before.id,
          before: { status: before.status, priority: before.priority },
          after: { status, priority, reference },
        },
        tx
      )
    })

    revalidateTickets()
    return { ok: true }
  } catch (error) {
    console.error('[tickets] Update failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Both sides of the conversation.
 *
 * NOTE: by ROUTE PATTERN — an interpolated reference matches no route.
 */
function revalidateTickets() {
  revalidatePath('/[locale]/dashboard/support', 'page')
  revalidatePath('/[locale]/dashboard/support/[reference]', 'page')
  revalidatePath('/[locale]/admin/tickets', 'page')
  revalidatePath('/[locale]/admin/tickets/[reference]', 'page')
}
