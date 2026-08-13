import { Package } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getMySupplierProfile, listMyProducts } from '@/lib/supplier'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SupplierProductsPage({
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
  const marketplace = await getTranslations('marketplace')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items: products, total } = profile
    ? await listMyProducts(profile.id, { take, skip })
    : { items: [], total: 0 }

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{supplier('productCategories')}</h1>

      <ListRange page={page} take={take} count={products.length} total={total} />

      {products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <Package className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{supplier('productCategories')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {marketplace('category')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {marketplace('brand')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {common('status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border-subtle">
                  <td className="py-3 pe-4">
                    <Link
                      href={`/products/${product.slug}` as Parameters<typeof Link>[0]['href']}
                      className="font-medium text-glex-green-700 underline-offset-4 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span className="block text-xs text-glex-green-800/60">
                      {product.category.name}
                    </span>
                  </td>
                  <td className="py-3 pe-4">{product.brand ?? '—'}</td>
                  <td className="py-3">
                    <span
                      className={
                        product.isVisible
                          ? 'rounded-full bg-glex-green-50 px-2.5 py-1 text-xs font-semibold text-glex-green-700'
                          : 'rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-glex-green-800/70'
                      }
                    >
                      {product.isVisible ? common('yes') : common('no')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/supplier/products', rawParams, target)}
      />

      <p className="mt-6 max-w-2xl text-sm text-glex-green-800/60">
        {/* Set expectations honestly: editing is not built yet. */}
        Product creation and editing are managed by the GLEX team at present.
        Contact your account manager to add or amend a listing.
      </p>
    </div>
  )
}
