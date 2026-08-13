import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RfqStatusBadge } from '@/components/dashboard/status-badge'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { listAllRfqs } from '@/lib/admin'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminRfqsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('rfq:read:all')

  const t = await getTranslations('rfq')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listAllRfqs({ take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.rfqs')}</h1>
      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{admin('nav.rfqs')}</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {common('reference')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {common('status')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {t('destination')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {admin('nav.clients')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {admin('assignTo')}
                  </th>
                  <th scope="col" className="py-3 text-start font-semibold">
                    {common('date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border-subtle">
                    <td className="py-3 pe-4">
                      <Link
                        href={
                          `/admin/rfqs/${row.reference}` as Parameters<typeof Link>[0]['href']
                        }
                        className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                        dir="ltr"
                      >
                        {row.reference}
                      </Link>
                      {row.isGuest && !row.emailVerified ? (
                        <span className="ms-2 rounded-full bg-glex-gold-100 px-2 py-0.5 text-xs font-semibold text-glex-gold-800">
                          {t('verifyRequired')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pe-4">
                      <RfqStatusBadge status={row.status} label={t(`status.${row.status}`)} />
                    </td>
                    <td className="py-3 pe-4">{row.destinationCountry}</td>
                    <td className="py-3 pe-4">
                      {row.organization?.name ?? row.createdBy?.name ?? '—'}
                    </td>
                    <td className="py-3 pe-4">{row.assignee?.name ?? admin('unassigned')}</td>
                    <td className="py-3">
                      {formatDate(row.submittedAt ?? row.createdAt, locale, {
                        dateStyle: 'medium',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-4 lg:hidden">
            {items.map((row) => (
              <li key={row.id} className="rounded-xl border border-border-subtle p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    href={`/admin/rfqs/${row.reference}` as Parameters<typeof Link>[0]['href']}
                    className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                    dir="ltr"
                  >
                    {row.reference}
                  </Link>
                  <RfqStatusBadge status={row.status} label={t(`status.${row.status}`)} />
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{t('destination')}:</dt>
                    <dd>{row.destinationCountry}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{admin('assignTo')}:</dt>
                    <dd>{row.assignee?.name ?? admin('unassigned')}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/rfqs', rawParams, target)}
          />
        </>
      )}
    </div>
  )
}
