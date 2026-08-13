import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { TicketReplyControls, TicketStatusControls } from '@/components/admin/ticket-controls'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getTicketForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('ticket:manage')

  const admin = await getTranslations('admin')
  const support = await getTranslations('support')
  const common = await getTranslations('common')

  const ticket = await getTicketForAdmin(reference)
  if (!ticket) notFound()

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/tickets" className="underline underline-offset-2">
          ← {admin('nav.tickets')}
        </Link>
      </p>

      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-glex-green-800/60">{support('reference')}</dt>
              <dd className="mt-0.5 font-mono font-medium" dir="ltr">
                {ticket.reference}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{support('requester')}</dt>
              <dd className="mt-0.5 font-medium">{ticket.requester.name}</dd>
              <dd className="text-xs text-glex-green-800/60" dir="ltr">
                {ticket.requester.email}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{support('assignee')}</dt>
              <dd className="mt-0.5 font-medium">
                {ticket.assignee?.name ?? support('unassigned')}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{common('date')}</dt>
              <dd className="mt-0.5 font-medium">
                {formatDate(ticket.createdAt, locale, { dateStyle: 'medium' })}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="ticket-thread-heading">
            <h2 id="ticket-thread-heading" className="text-xl font-bold">
              {support('replyLabel')}
            </h2>

            {ticket.messages.length === 0 ? (
              <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {ticket.messages.map((message) => (
                  <li
                    key={message.id}
                    className={
                      message.isInternal
                        ? 'rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-4'
                        : 'rounded-xl border border-border-subtle p-4'
                    }
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{message.author?.name ?? 'GLEX'}</span>
                      {/* Marked, because the whole point is that the requester
                          cannot see it. */}
                      {message.isInternal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-glex-gold-200 px-2 py-0.5 text-xs font-semibold text-glex-gold-900">
                          <Lock className="size-3" aria-hidden="true" />
                          {support('internalNote')}
                        </span>
                      ) : null}
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
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <TicketStatusControls
            reference={ticket.reference}
            currentStatus={ticket.status}
            currentPriority={ticket.priority}
          />
          <TicketReplyControls reference={ticket.reference} />
        </div>
      </div>
    </div>
  )
}
