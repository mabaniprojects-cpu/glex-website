import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ShipmentStatusBadge } from '@/components/dashboard/status-badge'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { listShipmentsForAdmin } from '@/lib/admin'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminShipmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('shipment:read:all')

  const tracking = await getTranslations('tracking')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items: shipments, total } = await listShipmentsForAdmin({ take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.shipments')}</h1>
      <ListRange page={page} take={take} count={shipments.length} total={total} />

      {shipments.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{admin('nav.shipments')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('reference')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('status')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {tracking('origin')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {tracking('destination')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {admin('nav.clients')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {tracking('eta')}
                </th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle">
                  <td className="py-3 pe-4">
                    <Link
                      href={
                        {
                          pathname: '/tracking',
                          query: { ref: row.reference },
                        } as Parameters<typeof Link>[0]['href']
                      }
                      className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                      dir="ltr"
                    >
                      {row.reference}
                    </Link>
                    {row.isDemo ? (
                      <span className="ms-2 rounded-full bg-glex-gold-100 px-2 py-0.5 text-xs font-semibold text-glex-gold-800">
                        {common('demoBadge')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pe-4">
                    <ShipmentStatusBadge
                      status={row.status}
                      label={tracking(`status.${row.status}`)}
                    />
                  </td>
                  <td className="py-3 pe-4">{row.originCountry}</td>
                  <td className="py-3 pe-4">{row.destinationCountry}</td>
                  <td className="py-3 pe-4">{row.organization?.name ?? '—'}</td>
                  <td className="py-3 whitespace-nowrap">
                    {row.estimatedArrival
                      ? formatDate(row.estimatedArrival, locale, { dateStyle: 'medium' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/shipments', rawParams, target)}
          />
        </div>
      )}
    </div>
  )
}
