import { ContentStatus, type Prisma } from '@prisma/client'
import { pickTranslation, toDbLocale } from '@/i18n/locale'
import type { AppLocale } from '@/i18n/routing'
import { db } from '@/lib/db'

/**
 * News queries.
 *
 * Scheduled publishing is enforced here: an article is public only when its
 * status is PUBLISHED *and* its publication date has passed. A future-dated
 * article is therefore invisible until its moment arrives, with no cron needed.
 */

export const NEWS_PAGE_SIZE = 9

/** The single source of truth for "is this article public?". */
export function publishedWhere(): Prisma.NewsArticleWhereInput {
  return {
    status: ContentStatus.PUBLISHED,
    deletedAt: null,
    publishedAt: { not: null, lte: new Date() },
  }
}

export type NewsFilters = {
  q?: string
  category?: string
  page: number
}

export function parseNewsFilters(
  params: Record<string, string | string[] | undefined>
): NewsFilters {
  const single = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() || undefined

  const rawPage = Number(single(params.page) ?? '1')

  return {
    q: single(params.q)?.slice(0, 120),
    category: single(params.category),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(Math.floor(rawPage), 500) : 1,
  }
}

export type NewsListItem = {
  id: string
  slug: string
  title: string
  summary: string
  featuredImage: string | null
  publishedAt: Date
  readingMinutes: number
  isSample: boolean
  categoryName: string | null
  categorySlug: string | null
}

type ArticleWithRelations = Prisma.NewsArticleGetPayload<{
  include: {
    translations: true
    category: { include: { translations: true } }
  }
}>

function localize(article: ArticleWithRelations, locale: AppLocale): NewsListItem {
  const translation = pickTranslation(article.translations, locale)
  const categoryTranslation = article.category
    ? pickTranslation(article.category.translations, locale)
    : undefined

  return {
    id: article.id,
    slug: article.slug,
    title: translation?.title ?? article.title,
    summary: translation?.summary ?? article.summary,
    featuredImage: article.featuredImage,
    // Safe: `publishedWhere()` guarantees a non-null date.
    publishedAt: article.publishedAt!,
    readingMinutes: article.readingMinutes,
    isSample: article.isSample,
    categoryName: categoryTranslation?.name ?? article.category?.name ?? null,
    categorySlug: article.category?.slug ?? null,
  }
}

function localeInclude(locale: AppLocale) {
  const dbLocale = toDbLocale(locale)
  return {
    translations: { where: { locale: { in: [dbLocale, 'en' as const] } } },
    category: { include: { translations: { where: { locale: { in: [dbLocale, 'en' as const] } } } } },
  }
}

export async function listNews(filters: NewsFilters, locale: AppLocale) {
  const where: Prisma.NewsArticleWhereInput = { ...publishedWhere() }

  if (filters.category) where.category = { slug: filters.category }

  if (filters.q) {
    // Search the base record and its translations, so a query in Arabic or
    // Chinese matches a translated headline.
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { summary: { contains: filters.q, mode: 'insensitive' } },
      { translations: { some: { title: { contains: filters.q, mode: 'insensitive' } } } },
    ]
  }

  const skip = (filters.page - 1) * NEWS_PAGE_SIZE

  const [rows, total] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: NEWS_PAGE_SIZE,
      include: localeInclude(locale),
    }),
    db.newsArticle.count({ where }),
  ])

  return {
    items: rows.map((row) => localize(row, locale)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)),
  }
}

/** Articles for the homepage slider: featured first, newest otherwise. */
export async function listFeaturedNews(locale: AppLocale, take = 5): Promise<NewsListItem[]> {
  const rows = await db.newsArticle.findMany({
    where: publishedWhere(),
    orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    take,
    include: localeInclude(locale),
  })

  return rows.map((row) => localize(row, locale))
}

export async function getNewsArticle(slug: string, locale: AppLocale) {
  const article = await db.newsArticle.findFirst({
    where: { slug, ...publishedWhere() },
    include: {
      ...localeInclude(locale),
      author: { select: { name: true } },
      tags: { include: { tag: { select: { slug: true, name: true } } } },
    },
  })

  if (!article) return null

  const translation = pickTranslation(article.translations, locale)

  return {
    ...article,
    displayTitle: translation?.title ?? article.title,
    displaySummary: translation?.summary ?? article.summary,
    displayBody: translation?.body ?? article.body,
    displaySeoTitle: translation?.seoTitle ?? article.seoTitle,
    displaySeoDescription: translation?.seoDescription ?? article.seoDescription,
    categoryName: article.category
      ? (pickTranslation(article.category.translations, locale)?.name ?? article.category.name)
      : null,
  }
}

export async function listRelatedNews(
  articleId: string,
  categoryId: string | null,
  locale: AppLocale,
  take = 3
): Promise<NewsListItem[]> {
  const rows = await db.newsArticle.findMany({
    where: {
      ...publishedWhere(),
      id: { not: articleId },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take,
    include: localeInclude(locale),
  })

  return rows.map((row) => localize(row, locale))
}

/** Categories that actually have a published article, with counts. */
export async function listNewsCategories(locale: AppLocale) {
  const categories = await db.newsCategory.findMany({
    where: { articles: { some: publishedWhere() } },
    orderBy: { sortOrder: 'asc' },
    include: {
      translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } },
      _count: { select: { articles: { where: publishedWhere() } } },
    },
  })

  return categories.map((category) => ({
    slug: category.slug,
    name: pickTranslation(category.translations, locale)?.name ?? category.name,
    count: category._count.articles,
  }))
}

/** Increments the view counter without blocking the render. */
export async function recordNewsView(id: string): Promise<void> {
  try {
    await db.newsArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } })
  } catch {
    // A failed analytics increment must never break the page.
  }
}
