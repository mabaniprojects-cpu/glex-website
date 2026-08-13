import { Inbox } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getMySupplierProfile, listMyOpportunities } from '@/lib/supplier'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SupplierOpportunitiesPage({
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
  const profile = await getMySupplierProfile(user)

  const supplier = await getTranslations('supplier')
  const rfq = await getTranslations('rfq')
  const units = await getTranslations('units')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  // Scoped by supplierId in SQL — another supplier's rows are unreachable.
  const { items: opportunities, total } = profile
    ? await listMyOpportunities(profile.id, { take, skip })
    : { items: [], total: 0 }

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{supplier('opportunities')}</h1>

      <ListRange page={page} take={take} count={opportunities.length} total={total} />

      {opportunities.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <Inbox className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <p className="mt-4 text-glex-green-800/70">{supplier('noOpportunities')}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {opportunities.map((opportunity) => (
            <li key={opportunity.id} className="rounded-xl border border-border-subtle p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="font-mono font-semibold" dir="ltr">
                  {opportunity.rfq.reference}
                </span>
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold">
                  {opportunity.status}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{rfq('destination')}:</dt>
                  <dd className="font-medium">{opportunity.rfq.destinationCountry}</dd>
                </div>
                {opportunity.rfq.incoterm ? (
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{rfq('incoterm')}:</dt>
                    <dd className="font-medium">{opportunity.rfq.incoterm}</dd>
                  </div>
                ) : null}
                {opportunity.dueAt ? (
                  <div className="flex gap-2">
                    <dt className="text-glex-green-800/60">{rfq('deliveryDate')}:</dt>
                    <dd className="font-medium">
                      {formatDate(opportunity.dueAt, locale, { dateStyle: 'medium' })}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {opportunity.message ? (
                <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm leading-relaxed">
                  {opportunity.message}
                </p>
              ) : null}

              {/* Only the commercial line items are shown — never the client. */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{rfq('items')}</caption>
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th scope="col" className="py-2 pe-4 text-start font-semibold">
                        {rfq('itemName')}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-semibold">
                        {rfq('quantity')}
                      </th>
                      <th scope="col" className="py-2 text-start font-semibold">
                        {rfq('unit')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunity.rfq.items.map((item) => (
                      <tr key={item.id} className="border-b border-border-subtle">
                        <td className="py-2.5 pe-4">{item.name}</td>
                        <td className="py-2.5 pe-4" dir="ltr">
                          {String(item.quantity)}
                        </td>
                        <td className="py-2.5">{units(item.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {opportunity.response ? (
                <p className="mt-4 text-sm">
                  <span className="font-semibold">{common('status')}: </span>
                  {opportunity.response}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/supplier/opportunities', rawParams, target)}
      />
    </div>
  )
}
