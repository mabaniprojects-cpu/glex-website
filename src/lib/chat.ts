import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'

/**
 * Chat conversation ownership.
 *
 * A conversation belongs either to a signed-in account or to an anonymous
 * visitor identified by an opaque httpOnly cookie. Every write that touches an
 * existing conversation must go through `conversationOwnerWhere` so a guessed
 * id can never reach — or modify — someone else's transcript.
 */

/** Opaque per-visitor id, so anonymous conversations are not keyed by IP alone. */
export const CHAT_VISITOR_COOKIE = 'GLEX_CHAT_VISITOR'

const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export async function readVisitorId(): Promise<string | null> {
  const store = await cookies()
  return store.get(CHAT_VISITOR_COOKIE)?.value ?? null
}

/** Reads the visitor cookie, issuing one if this is a first visit. */
export async function ensureVisitorId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(CHAT_VISITOR_COOKIE)?.value
  if (existing) return existing

  const visitorId = randomUUID()
  store.set(CHAT_VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE,
  })
  return visitorId
}

/**
 * A `where` clause matching a conversation the caller actually owns.
 *
 * Returns `null` when ownership cannot be established at all — an anonymous
 * caller with no visitor cookie. Callers MUST treat `null` as "deny": matching
 * on `visitorId: null` would otherwise select every signed-in conversation.
 */
export function conversationOwnerWhere({
  conversationId,
  userId,
  visitorId,
}: {
  conversationId: string
  userId: string | null
  visitorId: string | null
}): Prisma.ChatConversationWhereInput | null {
  if (userId) return { id: conversationId, userId }
  if (visitorId) return { id: conversationId, visitorId }
  return null
}
