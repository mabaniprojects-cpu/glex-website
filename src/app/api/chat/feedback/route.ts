import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-guards'
import { conversationOwnerWhere, readVisitorId } from '@/lib/chat'
import { db } from '@/lib/db'

/**
 * Records a thumbs up/down on a chat conversation.
 *
 * The update is scoped by ownership, so a guessed conversation id cannot rate —
 * or reveal the existence of — anyone else's transcript.
 */

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  feedback: z.union([z.literal(1), z.literal(-1)]),
})

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

  // No ownership can be established — deny rather than match broadly.
  if (!where) return Response.json({ error: 'not_found' }, { status: 404 })

  try {
    const { count } = await db.chatConversation.updateMany({
      where,
      data: { feedback: parsed.data.feedback },
    })

    // Same response either way, so this cannot be used to probe for valid ids.
    if (count === 0) return Response.json({ error: 'not_found' }, { status: 404 })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[chat] Failed to record feedback:', error)
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
