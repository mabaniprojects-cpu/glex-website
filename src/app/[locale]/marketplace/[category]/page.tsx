import { PackageSearch } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Pagination } from '@/components/ui/pagination'
import { ProductCard } from '@/components/marketplace/product-card'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { getCategoryBySlug, listProducts, parseFilters } from '@/lib/catalogue'

export async function generateMetadata(props: {
  params: Promise<{ locale: string; category: string }>
}): Promise<Metadata> {
  const { locale, category: slug } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}

  const category = await getCategoryBySlug(slug, locale as AppLocale)
  if (!category) return {}

  return {
    title: category.displayName,
    description: category.displayDescription ?? undefined,
    alternates: { canonical: `/${locale}/marketplace/${slug}` },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, category: slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const category = await getCategoryBySlug(slug, locale as AppLocale)
  if (!category) notFound()

  const rawParams = await searchParams
  // The category is fixed by the route, so it cannot be overridden by a param.
  const filters = { ...parseFilters(rawParams), category: slug }

  const t = await getTranslations('marketplace')
  const nav = await getTranslations('nav')

  const { items, total, page, pageCount } = await listProducts(filters, locale as AppLocale)

  function buildHref(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(rawParams)) {
      const single = Array.isArray(value) ? value[0] : value
      if (single && key !== 'page' && key !== 'category') params.set(key, single)
    }
    if (target > 1) params.set('page', String(target))
    const search = params.toString()
    return `/marketplace/${slug}${search ? `?${search}` : ''}`
  }

  return (
    <>
      <PageHero
        title={category.displayName}
        description={category.displayDescription ?? undefined}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/marketplace', label: nav('marketplace') },
          { href: `/marketplace/${slug}`, label: category.displayName },
        ]}
      />

      <Section>
        <p aria-live="polite" className="text-sm font-medium text-glex-green-800/75">
          {t('resultCount', { count: total })}
        </p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
            <PackageSearch className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{t('emptyTitle')}</h2>
            <p className="mt-2 text-glex-green-800/70">{t('emptyBody')}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href="/marketplace">{nav('marketplace')}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>

            <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
          </>
        )}
      </Section>
    </>
  )
}
