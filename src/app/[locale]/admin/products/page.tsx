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
import { listProductsForAdmin } from '@/lib/admin'
import { requireStaffPermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requireStaffPermission('product:write')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')
  const marketplace = await getTranslations('marketplace')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)
  const query = (Array.isArray(rawParams.q) ? rawParams.q[0] : rawParams.q)?.slice(0, 120) ?? ''

  const { items, total } = await listProductsForAdmin({ take, skip, q: query })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.products')}</h1>
        <Button asChild variant="gold">
          <Link href="/admin/products/new">
            <Plus className="size-4" aria-hidden="true" />
            {admin('newProduct')}
          </Link>
        </Button>
      </div>

      {/* A plain GET form, so results stay linkable and work without JS. */}
      <form action="" method="get" className="mt-6 flex max-w-md gap-2">
        <label htmlFor="admin-product-search" className="sr-only">
          {common('search')}
        </label>
        <input
          id="admin-product-search"
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
              <caption className="sr-only">{admin('nav.products')}</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {admin('productName')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {marketplace('category')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {marketplace('brand')}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-semibold">
                    {common('status')}
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
                        href={`/admin/products/${row.id}` as Parameters<typeof Link>[0]['href']}
                        className="font-medium text-glex-green-700 underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 pe-4">{row.category.name}</td>
                    <td className="py-3 pe-4">{row.brand ?? '—'}</td>
                    <td className="py-3 pe-4">
                      <span
                        className={
                          row.isVisible
                            ? 'rounded-full bg-glex-green-50 px-2.5 py-1 text-xs font-semibold text-glex-green-800'
                            : 'rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-glex-green-800/70'
                        }
                      >
                        {row.isVisible ? admin('published') : admin('unpublished')}
                      </span>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {formatDate(row.createdAt, locale, { dateStyle: 'medium' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/products', rawParams, target)}
          />
        </>
      )}
    </div>
  )
}
