import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-guards'
import { conversationOwnerWhere, readVisitorId } from '@/lib/chat'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { nextReference, REFERENCE_SCOPES } from '@/lib/references'

/**
 * Escalates a chat conversation to the GLEX team.
 *
 * A signed-in person gets a real support ticket, because there is an account to
 * reply to. An anonymous visitor is directed to the contact form instead — we
 * have no way to reach them, and promising a follow-up we cannot deliver would
 * be a false commitment.
 */

const requestSchema = z.object({
  conversationId: z.string().uuid(),
})

/** How many transcript turns to attach to the ticket. */
const HANDOFF_TRANSCRIPT_TURNS = 20

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'validation' }, { status: 400 })
  }

  const user = await getSessionUser()
  const where = conversationOwnerWhere({
    conversationId: parsed.data.conversationId,
    userId: user?.id ?? null,
    visitorId: user ? null : await readVisitorId(),
  })

  if (!where) return Response.json({ error: 'not_found' }, { status: 404 })

  try {
    const conversation = await db.chatConversation.findFirst({
      where,
      select: { id: true, handoffAt: true },
    })
    if (!conversation) return Response.json({ error: 'not_found' }, { status: 404 })

    // Anonymous visitor: mark the conversation escalated so the team can see
    // it, and send them to the contact form to leave their details.
    if (!user) {
      await db.chatConversation.update({
        where: { id: conversation.id },
        data: { handoffAt: conversation.handoffAt ?? new Date() },
      })
      return Response.json({ ticketCreated: false, reference: null })
    }

    // One ticket per conversation — repeated clicks must not spam the queue.
    if (conversation.handoffAt) {
      return Response.json({ ticketCreated: true, reference: null, alreadyEscalated: true })
    }

    const limit = await checkRateLimit(`chat:handoff:${user.id}`, 5, 60 * 60)
    if (!limit.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 })

    const transcript = await db.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: HANDOFF_TRANSCRIPT_TURNS,
      select: { role: true, content: true },
    })

    const summary = transcript
      .reverse()
      .map((turn) => `${turn.role === 'USER' ? 'Visitor' : 'Assistant'}: ${turn.content}`)
      .join('\n\n')

    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, REFERENCE_SCOPES.TICKET)
      await tx.supportTicket.create({
        data: {
          reference: ref,
          subject: 'Assistant conversation escalated to the GLEX team',
          requesterId: user.id,
          messages: {
            create: [
              {
                authorId: user.id,
                body: summary || 'The visitor asked to speak with a person.',
              },
            ],
          },
        },
      })
      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: { handoffAt: new Date() },
      })
      return ref
    })

    return Response.json({ ticketCreated: true, reference })
  } catch (error) {
    console.error('[chat] Failed to escalate conversation:', error)
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
