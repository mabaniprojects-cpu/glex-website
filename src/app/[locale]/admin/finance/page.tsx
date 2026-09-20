import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { InvoiceControls } from '@/components/admin/invoice-controls'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { listQuotationsForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { can } from '@/lib/rbac'
import { cn, formatDate } from '@/lib/utils'

/**
 * The finance view: every quotation the company has sent, and its settlement.
 *
 * It exists because the accountant's question — "what did we commit to, and
 * has it been invoiced?" — could otherwise only be answered by opening each
 * request one at a time.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('finance:read')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)
  const outstandingOnly = rawParams.outstanding === '1'

  const { items, total } = await listQuotationsForAdmin({ take, skip, outstandingOnly })

  const canSettle = can(user.role, 'quotation:settle')
  const money = (amount: { toString(): string }, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount.toString()))

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('finance.title')}</h1>
      <p className="text-glex-green-800/70 mt-2">{admin('finance.intro')}</p>

      <nav aria-label={admin('finance.title')} className="mt-5 flex flex-wrap gap-2">
        {([false, true] as const).map((only) => (
          <Link
            key={String(only)}
            href={
              (only ? '/admin/finance?outstanding=1' : '/admin/finance') as Parameters<
                typeof Link
              >[0]['href']
            }
            aria-current={outstandingOnly === only ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors',
              outstandingOnly === only
                ? 'bg-glex-green-600 text-white'
                : 'border-border-subtle text-glex-green-800 hover:bg-glex-green-50 border'
            )}
          >
            {only ? admin('finance.outstandingOnly') : common('all')}
          </Link>
        ))}
      </nav>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="text-glex-green-800/70 mt-10">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((row) => {
            const goods = row.rfq.workflowEntries.find((entry) => entry.track === 'PROCUREMENT')
            const freight = row.rfq.workflowEntries.find((entry) => entry.track === 'SHIPPING')
            const client =
              row.rfq.organization?.name ?? row.rfq.createdBy?.name ?? row.rfq.guestCompany ?? '—'

            return (
              <li key={row.id} className="border-border-subtle rounded-xl border p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono font-semibold" dir="ltr">
                      {row.reference}
                      <span className="text-glex-green-800/60 ms-2 font-sans text-xs">
                        v{row.version}
                      </span>
                    </p>

                    <p className="mt-1 text-sm">
                      <Link
                        href={
                          `/admin/rfqs/${row.rfq.reference}` as Parameters<typeof Link>[0]['href']
                        }
                        className="text-glex-green-700 font-mono underline-offset-4 hover:underline"
                        dir="ltr"
                      >
                        {row.rfq.reference}
                      </Link>
                      <span className="text-glex-green-800/70"> · {client}</span>
                      <span className="text-glex-green-800/70">
                        {' '}
                        · {row.rfq.destinationCountry}
                      </span>
                    </p>

                    <dl className="text-glex-green-800/75 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <div className="flex gap-2">
                        <dt>{admin('finance.sent')}:</dt>
                        <dd>{row.sentAt ? formatDate(row.sentAt, locale) : '—'}</dd>
                      </div>
                      {row.validUntil ? (
                        <div className="flex gap-2">
                          <dt>{admin('finance.validUntil')}:</dt>
                          <dd>{formatDate(row.validUntil, locale)}</dd>
                        </div>
                      ) : null}
                      {goods?.amount ? (
                        <div className="flex gap-2">
                          <dt>{admin('finance.goods')}:</dt>
                          <dd dir="ltr">{money(goods.amount, goods.currency)}</dd>
                        </div>
                      ) : null}
                      {freight?.amount ? (
                        <div className="flex gap-2">
                          <dt>{admin('finance.freight')}:</dt>
                          <dd dir="ltr">{money(freight.amount, freight.currency)}</dd>
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <dt>{admin('finance.outcome')}:</dt>
                        <dd className="font-medium">
                          {row.acceptedAt
                            ? admin('finance.accepted')
                            : row.rejectedAt
                              ? admin('finance.rejected')
                              : admin('finance.awaiting')}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {canSettle ? (
                    <InvoiceControls
                      id={row.id}
                      invoicedAt={row.invoicedAt ? formatDate(row.invoicedAt, locale) : null}
                      invoiceReference={row.invoiceReference}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {row.invoicedAt ? admin('finance.invoiced') : admin('finance.notInvoiced')}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/admin/finance', rawParams, target)}
      />
    </div>
  )
}
