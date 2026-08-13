import { Newspaper, Rss } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Pagination } from '@/components/ui/pagination'
import { NewsCard } from '@/components/news/news-card'
import { Link } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { listNews, listNewsCategories, parseNewsFilters } from '@/lib/news'
import { cn } from '@/lib/utils'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'news' })

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}/news`,
      types: { 'application/rss+xml': `/${locale}/news/rss.xml` },
    },
  }
}

export default async function NewsPage({
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
  const filters = parseNewsFilters(rawParams)

  const t = await getTranslations('news')
  const nav = await getTranslations('nav')
  const common = await getTranslations('common')

  const [{ items, total, page, pageCount }, categories] = await Promise.all([
    listNews(filters, locale as AppLocale),
    listNewsCategories(locale as AppLocale),
  ])

  function buildHref(target: number) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(rawParams)) {
      const single = Array.isArray(value) ? value[0] : value
      if (single && key !== 'page') query.set(key, single)
    }
    if (target > 1) query.set('page', String(target))
    const search = query.toString()
    return `/news${search ? `?${search}` : ''}`
  }

  /** Category chip href, preserving the search term. */
  function categoryHref(slug: string | null) {
    const query = new URLSearchParams()
    if (filters.q) query.set('q', filters.q)
    if (slug) query.set('category', slug)
    const search = query.toString()
    return `/news${search ? `?${search}` : ''}`
  }

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/news', label: nav('news') },
        ]}
      />

      <Section>
        {/* Category filter */}
        {categories.length > 0 ? (
          <nav aria-label={t('allCategories')}>
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={categoryHref(null) as Parameters<typeof Link>[0]['href']}
                  aria-current={!filters.category ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors',
                    !filters.category
                      ? 'bg-glex-green-600 text-white'
                      : 'border border-border-subtle text-glex-green-800 hover:bg-glex-green-50'
                  )}
                >
                  {t('allCategories')}
                </Link>
              </li>
              {categories.map((category) => {
                const active = filters.category === category.slug
                return (
                  <li key={category.slug}>
                    <Link
                      href={categoryHref(category.slug) as Parameters<typeof Link>[0]['href']}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors',
                        active
                          ? 'bg-glex-green-600 text-white'
                          : 'border border-border-subtle text-glex-green-800 hover:bg-glex-green-50'
                      )}
                    >
                      {category.name} ({category.count})
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        ) : null}

        <p aria-live="polite" className="mt-6 text-sm text-glex-green-800/70">
          {total}
        </p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
            <Newspaper className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{common('noResults')}</h2>
            <p className="mt-2 text-glex-green-800/70">{common('noResultsHint')}</p>
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((article) => (
                <li key={article.id}>
                  <NewsCard article={article} locale={locale} />
                </li>
              ))}
            </ul>

            <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
          </>
        )}

        <p className="mt-10">
          <a
            href={`/${locale}/news/rss.xml`}
            className="inline-flex items-center gap-2 text-sm text-glex-green-700 underline-offset-4 hover:underline"
          >
            <Rss className="size-4" aria-hidden="true" />
            RSS
          </a>
        </p>
      </Section>
    </>
  )
}
