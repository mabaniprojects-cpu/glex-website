import { MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listMyTickets } from '@/lib/dashboard'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function DashboardSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  const support = await getTranslations('support')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listMyTickets(user, { take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{support('title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{support('intro')}</p>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 flex items-center gap-2 text-glex-green-800/70">
          <MessageSquare className="size-4" aria-hidden="true" />
          {common('noResults')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-border-subtle p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link
                      href={`/dashboard/support/${ticket.reference}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </p>
                  <p className="mt-1 font-mono text-xs text-glex-green-800/60" dir="ltr">
                    {ticket.reference}
                  </p>
                </div>

                <div className="text-end text-xs text-glex-green-800/60">
                  <p className="font-medium text-glex-green-800">
                    {support(`status${ticket.status}`)}
                  </p>
                  <p className="mt-1">
                    {support('messageCount', { count: ticket._count.messages })}
                  </p>
                  <p className="mt-1">{formatDate(ticket.updatedAt, locale)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/dashboard/support', rawParams, target)}
      />
    </div>
  )
}
