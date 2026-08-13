import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { listNewsForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('news:write')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)
  const query = (Array.isArray(rawParams.q) ? rawParams.q[0] : rawParams.q)?.slice(0, 120) ?? ''

  const { items, total } = await listNewsForAdmin({ take, skip, q: query })
  const now = new Date()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.news')}</h1>
        <Button asChild variant="gold">
          <Link href="/admin/news/new">
            <Plus className="size-4" aria-hidden="true" />
            {admin('newArticle')}
          </Link>
        </Button>
      </div>

      {/* A plain GET form, so results stay linkable and work without JS. */}
      <form action="" method="get" className="mt-6 flex max-w-md gap-2">
        <label htmlFor="admin-news-search" className="sr-only">
          {common('search')}
        </label>
        <input
          id="admin-news-search"
          name="q"
          defaultValue={query}
          maxLength={120}
          className="h-11 w-full rounded-lg border border-border-subtle px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          {common('search')}
        </Button>
      </form>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{admin('nav.news')}</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {admin('articleTitle')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {common('status')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {admin('publishDate')}
                  </th>
                  <th scope="col" className="py-3 text-start font-semibold">
                    {admin('nav.users')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  // "Scheduled" is a date fact, not just a status: a PUBLISHED
                  // article dated in the future is not public yet.
                  const scheduled =
                    row.status === 'PUBLISHED' && row.publishedAt && row.publishedAt > now

                  return (
                    <tr key={row.id} className="border-b border-border-subtle">
                      <td className="py-3 pe-4">
                        <Link
                          href={`/admin/news/${row.id}` as Parameters<typeof Link>[0]['href']}
                          className="font-medium text-glex-green-700 underline-offset-4 hover:underline"
                        >
                          {row.title}
                        </Link>
                        {row.isSample ? (
                          <span className="ms-2 rounded-full bg-glex-gold-100 px-2 py-0.5 text-xs font-semibold text-glex-gold-800">
                            {common('sampleBadge')}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pe-4">
                        <span
                          className={
                            row.status === 'PUBLISHED' && !scheduled
                              ? 'rounded-full bg-glex-green-50 px-2.5 py-1 text-xs font-semibold text-glex-green-800'
                              : 'rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-glex-green-800/70'
                          }
                        >
                          {scheduled
                            ? admin('contentStatus.SCHEDULED')
                            : admin(`contentStatus.${row.status}`)}
                        </span>
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        {row.publishedAt
                          ? formatDate(row.publishedAt, locale, { dateStyle: 'medium' })
                          : '—'}
                      </td>
                      <td className="py-3">{row.author?.name ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/news', rawParams, target)}
          />
        </>
      )}
    </div>
  )
}
