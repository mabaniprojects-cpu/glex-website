import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { listAuditLogs } from '@/lib/audit'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('audit:read')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listAuditLogs({ take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.audit')}</h1>
      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{admin('nav.audit')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('date')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {admin('nav.users')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('actions')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {common('reference')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b border-border-subtle">
                  <td className="py-3 pe-4 whitespace-nowrap">
                    <time dateTime={entry.createdAt.toISOString()}>
                      {formatDate(entry.createdAt, locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </td>
                  <td className="py-3 pe-4">{entry.actor?.name ?? '—'}</td>
                  <td className="py-3 pe-4 font-mono text-xs" dir="ltr">
                    {entry.action}
                  </td>
                  <td className="py-3 text-xs text-glex-green-800/70">
                    {entry.entityType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/audit', rawParams, target)}
          />
        </div>
      )}

      {/* Explains why entries look redacted. */}
      <p className="mt-6 max-w-2xl text-sm text-glex-green-800/60">
        {admin('auditMaskNotice')}
      </p>
    </div>
  )
}
