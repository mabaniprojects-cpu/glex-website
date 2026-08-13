import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { localeHreflang, locales, routing } from '@/i18n/routing'

/** Public routes that exist for every locale. */
const STATIC_PATHS = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/services', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/network', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/marketplace', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/rfq', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/tracking', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/news', priority: 0.8, changeFrequency: 'daily' as const },
  { path: '/resources', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/register/supplier', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/register/client', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/accessibility', priority: 0.3, changeFrequency: 'yearly' as const },
]

const baseUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Every locale variant of a path, for the `alternates.languages` map. */
function alternates(path: string) {
  const languages = Object.fromEntries(
    locales.map((locale) => [localeHreflang[locale], `${baseUrl()}/${locale}${path}`])
  )
  return {
    languages: { ...languages, 'x-default': `${baseUrl()}/${routing.defaultLocale}${path}` },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  for (const { path, priority, changeFrequency } of STATIC_PATHS) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl()}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: alternates(path),
      })
    }
  }

  // Dynamic content. The sitemap must still build if the database is
  // unreachable, so both queries degrade to an empty list.
  const [products, articles] = await Promise.all([
    db.product
      .findMany({
        where: { isVisible: true, deletedAt: null },
        select: { slug: true, updatedAt: true },
        take: 5000,
      })
      .catch(() => []),
    db.newsArticle
      .findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { slug: true, updatedAt: true },
        take: 5000,
      })
      .catch(() => []),
  ])

  for (const product of products) {
    const path = `/products/${product.slug}`
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl()}/${locale}${path}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: alternates(path),
      })
    }
  }

  for (const article of articles) {
    const path = `/news/${article.slug}`
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl()}/${locale}${path}`,
        lastModified: article.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: alternates(path),
      })
    }
  }

  return entries
}
