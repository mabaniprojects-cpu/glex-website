import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { listSuppliersForAdmin } from '@/lib/admin'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { cn, formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Statuses that should stand out as needing a decision. */
const NEEDS_ACTION = new Set(['SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'])

export default async function AdminSuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('supplier:read:all')

  const supplier = await getTranslations('supplier')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listSuppliersForAdmin({ take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.suppliers')}</h1>
      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((row) => (
            <li
              key={row.id}
              className={cn(
                'rounded-xl border p-5',
                NEEDS_ACTION.has(row.status)
                  ? 'border-glex-gold-300 bg-glex-gold-50'
                  : 'border-border-subtle'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-semibold">
                  <Link
                    href={`/admin/suppliers/${row.id}` as Parameters<typeof Link>[0]['href']}
                    className="text-glex-green-700 underline-offset-4 hover:underline"
                  >
                    {row.legalName}
                  </Link>
                </h2>
                <span className="rounded-full border border-border-subtle bg-white px-2.5 py-1 text-xs font-semibold">
                  {supplier(`status.${row.status}`)}
                </span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{supplier('country')}:</dt>
                  <dd>{[row.city, row.country].filter(Boolean).join(', ')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{supplier('profileCompletion')}:</dt>
                  <dd dir="ltr">{row.completionPercent}%</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-glex-green-800/60">{common('date')}:</dt>
                  <dd>
                    {formatDate(row.submittedAt ?? row.createdAt, locale, { dateStyle: 'medium' })}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <Pagination
          page={page}
          pageCount={pageCount(total, take)}
          buildHref={(target) => buildPageHref('/admin/suppliers', rawParams, target)}
        />
      ) : null}
    </div>
  )
}
