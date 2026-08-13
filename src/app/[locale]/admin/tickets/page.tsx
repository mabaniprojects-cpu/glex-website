import { TicketStatus } from '@prisma/client'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { listTicketsForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

function isStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && Object.values(TicketStatus).includes(value as TicketStatus)
}

export default async function AdminTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('ticket:manage')

  const admin = await getTranslations('admin')
  const support = await getTranslations('support')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)
  // Anything outside the enum is ignored rather than passed to the query.
  const status = isStatus(rawParams.status) ? rawParams.status : undefined

  const { items, total } = await listTicketsForAdmin({ take, skip, status })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.tickets')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{support('adminIntro')}</p>

      {/* A plain GET form, so the filtered view stays linkable. */}
      <form action="" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{support('status')}</span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="h-11 rounded-lg border border-border-subtle bg-white px-3 pe-8 text-sm"
          >
            <option value="">{support('allStatuses')}</option>
            {Object.values(TicketStatus).map((value) => (
              <option key={value} value={value}>
                {support(`status${value}`)}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" variant="outline">
          {common('search')}
        </Button>
      </form>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-border-subtle p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link
                      href={`/admin/tickets/${ticket.reference}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs text-glex-green-800/60">
                    <span className="font-mono" dir="ltr">
                      {ticket.reference}
                    </span>{' '}
                    · {ticket.requester.name} ·{' '}
                    {ticket.assignee?.name ?? support('unassigned')}
                  </p>
                </div>

                <div className="text-end text-xs text-glex-green-800/60">
                  <p className="font-medium text-glex-green-800">
                    {support(`status${ticket.status}`)} · {support(`priority${ticket.priority}`)}
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
        buildHref={(target) => buildPageHref('/admin/tickets', rawParams, target)}
      />
    </div>
  )
}
