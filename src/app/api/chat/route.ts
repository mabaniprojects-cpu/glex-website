import { headers } from 'next/headers'
import { z } from 'zod'
import { toDbLocale } from '@/i18n/locale'
import { locales, type AppLocale } from '@/i18n/routing'
import { askAssistant } from '@/lib/ai/provider'
import { MAX_HISTORY_TURNS, sanitizeUserMessage } from '@/lib/ai/guardrails'
import { getSessionUser } from '@/lib/auth-guards'
import { conversationOwnerWhere, ensureVisitorId } from '@/lib/chat'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  locale: z.enum(locales),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(50)
    .optional(),
  conversationId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'validation' }, { status: 400 })
  }

  const message = sanitizeUserMessage(parsed.data.message)
  if (!message) return Response.json({ error: 'validation' }, { status: 400 })

  const user = await getSessionUser()
  const visitorId = await ensureVisitorId()

  // Abuse protection. Keyed by account when signed in, otherwise by IP.
  const bucket = user ? `chat:user:${user.id}` : `chat:ip:${clientIp(await headers())}`
  const limit = await checkRateLimit(bucket, env().CHAT_RATE_LIMIT, 60 * 15)
  if (!limit.allowed) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  const locale = parsed.data.locale as AppLocale

  try {
    const reply = await askAssistant({
      message,
      history: parsed.data.history?.slice(-MAX_HISTORY_TURNS) ?? [],
      locale,
      user,
    })

    // Persist the transcript. Tool NAMES only — arguments and any records the
    // tools returned must never reach the transcript store.
    const conversationId = await persistTurn({
      conversationId: parsed.data.conversationId,
      userId: user?.id ?? null,
      visitorId: user ? null : visitorId,
      locale,
      message,
      reply: reply.answer,
      toolsUsed: reply.toolsUsed,
    })

    return Response.json({
      answer: reply.answer,
      usedFallback: reply.usedFallback,
      suggestions: reply.suggestions,
      sourceTitle: reply.sourceTitle,
      conversationId,
    })
  } catch (error) {
    console.error('[chat] Request failed:', error)
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

async function persistTurn({
  conversationId,
  userId,
  visitorId,
  locale,
  message,
  reply,
  toolsUsed,
}: {
  conversationId?: string
  userId: string | null
  visitorId: string | null
  locale: AppLocale
  message: string
  reply: string
  toolsUsed: string[]
}): Promise<string | null> {
  try {
    const dbLocale = toDbLocale(locale)

    // Only continue a conversation the caller actually owns; otherwise start a
    // new one. A guessed id must never append to someone else's transcript.
    const ownerWhere = conversationId
      ? conversationOwnerWhere({ conversationId, userId, visitorId })
      : null

    const existing = ownerWhere
      ? await db.chatConversation.findFirst({ where: ownerWhere, select: { id: true } })
      : null

    const conversation =
      existing ??
      (await db.chatConversation.create({
        data: { userId, visitorId, locale: dbLocale },
        select: { id: true },
      }))

    await db.chatMessage.createMany({
      data: [
        { conversationId: conversation.id, role: 'USER', content: message },
        {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: reply,
          toolsUsed,
        },
      ],
    })

    return conversation.id
  } catch (error) {
    // A transcript failure must not cost the visitor their answer.
    console.error('[chat] Failed to persist transcript:', error)
    return null
  }
}

export const runtime = 'nodejs'
