import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { TicketReplyForm } from '@/components/dashboard/ticket-reply'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getMyTicket } from '@/lib/dashboard'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** A ticket takes no further messages once it is settled. */
const CLOSED = ['RESOLVED', 'CLOSED']

export default async function DashboardTicketPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  const support = await getTranslations('support')
  const common = await getTranslations('common')

  // Scoped by requester in SQL — someone else's reference is a plain 404.
  const ticket = await getMyTicket(user, reference)
  if (!ticket) notFound()

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/support" className="underline underline-offset-2">
          ← {support('title')}
        </Link>
      </p>

      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="inline text-glex-green-800/60">{support('reference')}: </dt>
          <dd className="inline font-mono font-medium" dir="ltr">
            {ticket.reference}
          </dd>
        </div>
        <div>
          <dt className="inline text-glex-green-800/60">{support('status')}: </dt>
          <dd className="inline font-medium">{support(`status${ticket.status}`)}</dd>
        </div>
        <div>
          <dt className="inline text-glex-green-800/60">{common('date')}: </dt>
          <dd className="inline font-medium">
            {formatDate(ticket.createdAt, locale, { dateStyle: 'medium' })}
          </dd>
        </div>
      </dl>

      {/* Internal staff notes are excluded by the query, not hidden here. */}
      <ol className="mt-8 space-y-4">
        {ticket.messages.map((message) => (
          <li key={message.id} className="rounded-xl border border-border-subtle p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{message.author?.name ?? 'GLEX'}</span>
              <time
                dateTime={message.createdAt.toISOString()}
                className="text-glex-green-800/60"
              >
                {formatDate(message.createdAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </p>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ol>

      {CLOSED.includes(ticket.status) ? (
        <p className="mt-6 rounded-lg bg-surface-muted p-3 text-sm text-glex-green-800/70">
          {support('errorClosed')}
        </p>
      ) : (
        <TicketReplyForm reference={ticket.reference} />
      )}
    </div>
  )
}
