import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getChatConversationForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * A single chat transcript.
 *
 * Read-only: the record of what a visitor was told has value precisely because
 * nobody can revise it afterwards. There is deliberately no edit or delete
 * control here.
 */
export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('ticket:manage')

  const admin = await getTranslations('admin')

  const conversation = await getChatConversationForAdmin(id)
  // A plain 404 rather than a distinct "no such transcript" — an id that does
  // not exist and one that does should look the same from outside.
  if (!conversation) notFound()

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/chats" className="underline underline-offset-2">
          ← {admin('nav.chats')}
        </Link>
      </p>

      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
        {conversation.title ?? admin('chats.untitled')}
      </h1>

      <p className="mt-2 text-sm text-glex-green-800/70">
        {conversation.user?.name ?? admin('chats.anonymous')} · {conversation.locale} ·{' '}
        {formatDate(conversation.createdAt, locale)}
        {conversation.handoffAt
          ? ` · ${admin('chats.escalatedOn', {
              date: formatDate(conversation.handoffAt, locale),
            })}`
          : ''}
      </p>

      <ol className="mt-8 space-y-4">
        {conversation.messages.map((message) => {
          const isVisitor = message.role === 'USER'

          return (
            <li
              key={message.id}
              className={
                isVisitor
                  ? 'rounded-xl border border-border-subtle p-4'
                  : 'rounded-xl bg-surface-muted p-4'
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-glex-green-800/60">
                {isVisitor ? admin('chats.visitor') : admin('chats.assistant')}
                <span className="ms-2 font-normal normal-case tracking-normal">
                  {formatDate(message.createdAt, locale)}
                </span>
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

              {message.toolsUsed.length > 0 ? (
                <p className="mt-2 text-xs text-glex-green-800/60">
                  {/* Names only — arguments are never persisted, so a private
                      lookup cannot leak into the transcript store. */}
                  {admin('chats.toolsUsed', { tools: message.toolsUsed.join(', ') })}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
