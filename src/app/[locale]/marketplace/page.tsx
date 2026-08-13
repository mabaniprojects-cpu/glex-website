import { PackageSearch } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { CatalogueControls } from '@/components/marketplace/catalogue-controls'
import { Pagination } from '@/components/ui/pagination'
import { ProductCard } from '@/components/marketplace/product-card'
import { routing, type AppLocale } from '@/i18n/routing'
import { getFilterOptions, listProducts, parseFilters } from '@/lib/catalogue'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'marketplace' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/marketplace` },
  }
}

export default async function MarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const rawParams = await searchParams
  const filters = parseFilters(rawParams)

  const t = await getTranslations('marketplace')
  const nav = await getTranslations('nav')

  const [{ items, total, page, pageCount }, options] = await Promise.all([
    listProducts(filters, locale as AppLocale),
    getFilterOptions(locale as AppLocale),
  ])

  /** Preserves active filters when paging. */
  function buildHref(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(rawParams)) {
      const single = Array.isArray(value) ? value[0] : value
      if (single && key !== 'page') params.set(key, single)
    }
    if (target > 1) params.set('page', String(target))
    const search = params.toString()
    return `/marketplace${search ? `?${search}` : ''}`
  }

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/marketplace', label: nav('marketplace') },
        ]}
      />

      <Section>
        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
          <div className="lg:contents">
            <CatalogueControls options={options} />
          </div>

          <div className="mt-8 lg:col-start-2 lg:row-start-1 lg:mt-0">
            {/* Result count is announced so filter changes are perceivable. */}
            <p aria-live="polite" className="text-sm font-medium text-glex-green-800/75">
              {t('resultCount', { count: total })}
            </p>

            {items.length === 0 ? (
              <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
                <PackageSearch className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold">{t('emptyTitle')}</h2>
                <p className="mt-2 text-glex-green-800/70">{t('emptyBody')}</p>
              </div>
            ) : (
              <>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>

                <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
              </>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
