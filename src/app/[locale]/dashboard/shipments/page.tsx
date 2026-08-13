import { Ship } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ShipmentStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listMyShipments } from '@/lib/dashboard'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function MyShipmentsPage({
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
  const t = await getTranslations('tracking')
  const dash = await getTranslations('dashboard')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listMyShipments(user, { take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.shipments')}</h1>
      {items.length > 0 ? (
        <ListRange page={page} take={take} count={items.length} total={total} />
      ) : null}

      {items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <Ship className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/tracking">{t('searchAction')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((shipment) => (
            <li key={shipment.id} className="rounded-xl border border-border-subtle p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  href={
                    { pathname: '/tracking', query: { ref: shipment.reference } } as Parameters<
                      typeof Link
                    >[0]['href']
                  }
                  className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                  dir="ltr"
                >
                  {shipment.reference}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  {shipment.isDemo ? (
                    <span className="rounded-full bg-glex-gold-100 px-2.5 py-1 text-xs font-semibold text-glex-gold-800">
                      {common('demoBadge')}
                    </span>
                  ) : null}
                  <ShipmentStatusBadge
                    status={shipment.status}
                    label={t(`status.${shipment.status}`)}
                  />
                </div>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{t('origin')}:</dt>
                  <dd className="font-medium">{shipment.originCountry}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{t('destination')}:</dt>
                  <dd className="font-medium">{shipment.destinationCountry}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{t('mode')}:</dt>
                  <dd className="font-medium">{t(`mode_${shipment.mode}`)}</dd>
                </div>
                {shipment.estimatedArrival ? (
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{t('eta')}:</dt>
                    <dd className="font-medium">
                      {formatDate(shipment.estimatedArrival, locale, { dateStyle: 'medium' })}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-glex-green-800/60">{t('progress')}</span>
                  <span className="font-semibold">{shipment.progressPercent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={shipment.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${shipment.reference} ${t('progress')}`}
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-glex-green-100"
                >
                  <div
                    className="h-full rounded-full bg-glex-green-600"
                    style={{ width: `${Math.min(100, Math.max(0, shipment.progressPercent))}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <Pagination
          page={page}
          pageCount={pageCount(total, take)}
          buildHref={(target) => buildPageHref('/dashboard/shipments', rawParams, target)}
        />
      ) : null}
    </div>
  )
}
