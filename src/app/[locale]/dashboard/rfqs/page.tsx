import { FilePlus2, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RfqStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listMyRfqs } from '@/lib/dashboard'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function MyRfqsPage({
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
  const t = await getTranslations('rfq')
  const dash = await getTranslations('dashboard')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listMyRfqs(user, { take, skip })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.rfqs')}</h1>
        <Button asChild variant="gold">
          <Link href="/rfq">
            <FilePlus2 className="size-4" aria-hidden="true" />
            {dash('quickRfq')}
          </Link>
        </Button>
      </div>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <FileText className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">{t('cartEmpty')}</h2>
          <p className="mt-2 text-glex-green-800/70">{t('cartEmptyBody')}</p>
          <div className="mt-6">
            <Button asChild variant="primary">
              <Link href="/marketplace">{common('search')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{dash('nav.rfqs')}</caption>
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
                    {t('items')}
                  </th>
                  <th scope="col" className="py-3 text-start font-semibold">
                    {common('date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((rfq) => (
                  <tr key={rfq.id} className="border-b border-border-subtle">
                    <td className="py-3 pe-4">
                      <Link
                        href={
                          `/dashboard/rfqs/${rfq.reference}` as Parameters<typeof Link>[0]['href']
                        }
                        className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                        dir="ltr"
                      >
                        {rfq.reference}
                      </Link>
                    </td>
                    <td className="py-3 pe-4">
                      <RfqStatusBadge status={rfq.status} label={t(`status.${rfq.status}`)} />
                    </td>
                    <td className="py-3 pe-4">
                      {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
                    </td>
                    <td className="py-3 pe-4" dir="ltr">
                      {rfq._count.items}
                    </td>
                    <td className="py-3">
                      <time dateTime={(rfq.submittedAt ?? rfq.createdAt).toISOString()}>
                        {formatDate(rfq.submittedAt ?? rfq.createdAt, locale, {
                          dateStyle: 'medium',
                        })}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-4 md:hidden">
            {items.map((rfq) => (
              <li key={rfq.id} className="rounded-xl border border-border-subtle p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={
                      `/dashboard/rfqs/${rfq.reference}` as Parameters<typeof Link>[0]['href']
                    }
                    className="font-mono font-medium text-glex-green-700 underline-offset-4 hover:underline"
                    dir="ltr"
                  >
                    {rfq.reference}
                  </Link>
                  <RfqStatusBadge status={rfq.status} label={t(`status.${rfq.status}`)} />
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{t('destination')}:</dt>
                    <dd>
                      {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{t('items')}:</dt>
                    <dd dir="ltr">{rfq._count.items}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{common('date')}:</dt>
                    <dd>
                      {formatDate(rfq.submittedAt ?? rfq.createdAt, locale, {
                        dateStyle: 'medium',
                      })}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/dashboard/rfqs', rawParams, target)}
          />
        </>
      )}
    </div>
  )
}
