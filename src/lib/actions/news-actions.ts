'use server'

import { ContentStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { fromDateTimeLocalInput, readingMinutes, slugify } from '@/lib/utils'

/**
 * News authoring.
 *
 * Each action re-checks its own permission — Server Actions POST to the page's
 * own URL, so the admin layout guard is not a security boundary — and audits
 * the change in the same transaction that performs it.
 *
 * Publishing is date-driven: `src/lib/news.ts#publishedWhere()` treats an
 * article as public only when it is PUBLISHED *and* its publication date has
 * passed. A PUBLISHED article dated in the future is therefore scheduled, and
 * appears by itself with no cron job.
 */

export type NewsCategoryActionResult =
  | { ok: true; slug?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'in_use' | 'server' }

export type NewsActionResult =
  | { ok: true; id?: string; slug?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'server' }

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await db.newsArticle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
  }

  return `${base}-${Date.now().toString(36)}`
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

/**
 * `<input type="datetime-local">` submits a local-time string, or `""` when
 * cleared. Anything unparseable is treated as "not set" rather than failing the
 * whole form.
 */
const optionalDate = z
  .union([z.literal(''), z.string().max(40)])
  .optional()
  // Interpreted as a wall-clock time in the company's timezone, so "09:00"
  // means 09:00 in Jeddah regardless of where the server runs.
  .transform((value) => fromDateTimeLocalInput(value))

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(3).max(1000),
  body: z.string().trim().min(3).max(60_000),
  categoryId: z.union([z.string().uuid(), z.literal('')]).optional(),
  status: z.nativeEnum(ContentStatus),
  publishedAt: optionalDate,
  isFeatured: z.boolean().optional(),
  featuredImage: optionalText(500),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
})

export async function saveArticle(input: unknown): Promise<NewsActionResult> {
  const user = await requirePermission('news:write')

  const parsed = articleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, title, summary, body, categoryId, status, publishedAt, ...rest } = parsed.data

  // Moving an article to PUBLISHED or SCHEDULED is a publishing decision.
  const isPublishing = status === ContentStatus.PUBLISHED || status === ContentStatus.SCHEDULED
  if (isPublishing) await requirePermission('news:publish')

  try {
    if (categoryId) {
      const category = await db.newsCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      })
      if (!category) return { ok: false, error: 'validation' }
    }

    const data = {
      title,
      summary,
      body,
      categoryId: categoryId || null,
      status,
      isFeatured: rest.isFeatured ?? false,
      featuredImage: rest.featuredImage ?? null,
      seoTitle: rest.seoTitle ?? null,
      seoDescription: rest.seoDescription ?? null,
      // Derived from the body, never accepted from the client.
      readingMinutes: readingMinutes(body),
      // Publishing without a date means "now"; a future date schedules it.
      publishedAt: isPublishing ? (publishedAt ?? new Date()) : publishedAt,
    }

    if (id) {
      const before = await db.newsArticle.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, title: true, slug: true, status: true, publishedAt: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      const slug = await uniqueSlug(title, id)

      await db.$transaction(async (tx) => {
        await tx.newsArticle.update({ where: { id }, data: { ...data, slug } })
        await recordAudit(
          {
            actorId: user.id,
            action: 'news.updated',
            entityType: 'NewsArticle',
            entityId: id,
            before,
            after: { title, slug, status, publishedAt: data.publishedAt },
          },
          tx
        )
      })

      revalidateNews()
      return { ok: true, id, slug }
    }

    const slug = await uniqueSlug(title)

    const created = await db.$transaction(async (tx) => {
      const row = await tx.newsArticle.create({
        // `isSample` is deliberately not settable: it flags seeded demo content
        // so it can be filtered or removed, and defaults to false here.
        data: { ...data, slug, authorId: user.id },
        select: { id: true },
      })
      await recordAudit(
        {
          actorId: user.id,
          action: 'news.created',
          entityType: 'NewsArticle',
          entityId: row.id,
          after: { title, slug, status, publishedAt: data.publishedAt },
        },
        tx
      )
      return row
    })

    revalidateNews()
    return { ok: true, id: created.id, slug }
  } catch (error) {
    console.error('[news] saveArticle failed:', error)
    return { ok: false, error: 'server' }
  }
}

/** Publish / unpublish in one click, without opening the editor. */
export async function setArticleStatus(input: unknown): Promise<NewsActionResult> {
  const user = await requirePermission('news:publish')

  const parsed = z
    .object({ id: z.string().uuid(), status: z.nativeEnum(ContentStatus) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, status } = parsed.data

  try {
    const article = await db.newsArticle.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, status: true, publishedAt: true },
    })
    if (!article) return { ok: false, error: 'not_found' }
    if (article.status === status) return { ok: true, id, slug: article.slug }

    // First publication stamps a date; re-publishing keeps the original.
    const publishedAt =
      status === ContentStatus.PUBLISHED ? (article.publishedAt ?? new Date()) : article.publishedAt

    await db.$transaction(async (tx) => {
      await tx.newsArticle.update({ where: { id }, data: { status, publishedAt } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'news.status_changed',
          entityType: 'NewsArticle',
          entityId: id,
          before: { status: article.status },
          after: { status, publishedAt },
        },
        tx
      )
    })

    revalidateNews()
    return { ok: true, id, slug: article.slug }
  } catch (error) {
    console.error('[news] setArticleStatus failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Soft delete.
 *
 * The row stays so an audit trail and any inbound links keep resolving to a
 * clean 404 rather than a dangling reference; `publishedWhere()` already
 * filters on `deletedAt`.
 */
export async function deleteArticle(input: unknown): Promise<NewsActionResult> {
  const user = await requirePermission('news:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    const article = await db.newsArticle.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true, slug: true },
    })
    if (!article) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.newsArticle.update({
        where: { id },
        data: { deletedAt: new Date(), isFeatured: false },
      })
      await recordAudit(
        {
          actorId: user.id,
          action: 'news.deleted',
          entityType: 'NewsArticle',
          entityId: id,
          before: { title: article.title, slug: article.slug },
        },
        tx
      )
    })

    revalidateNews()
    return { ok: true, id }
  } catch (error) {
    console.error('[news] deleteArticle failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Refreshes every surface an article change can affect.
 *
 * A dynamic route is revalidated by its ROUTE PATTERN — an interpolated URL
 * matches nothing and fails silently.
 */
function revalidateNews() {
  revalidatePath('/[locale]', 'page')
  revalidatePath('/[locale]/news', 'page')
  revalidatePath('/[locale]/news/[slug]', 'page')
  revalidatePath('/[locale]/news/rss.xml', 'page')
  revalidatePath('/[locale]/admin/news', 'page')
  // Category counts are shown here, so a category change must refresh it too.
  revalidatePath('/[locale]/admin/news/categories', 'page')
}

// --- News categories --------------------------------------------------------

/**
 * A unique news-category slug.
 *
 * Separate from `uniqueSlug` above because `NewsCategory` has no `deletedAt` —
 * a category is either present or gone, so a freed slug becomes available
 * again rather than staying reserved by a soft-deleted row.
 */
async function uniqueNewsCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await db.newsCategory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
  }

  return `${base}-${Date.now().toString(36)}`
}

const newsCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
})

export async function saveNewsCategory(input: unknown): Promise<NewsCategoryActionResult> {
  const user = await requirePermission('news:write')

  const parsed = newsCategorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, name, sortOrder } = parsed.data

  try {
    // Derived server-side and never accepted from the client — the slug is a
    // public URL, so letting the form set it would let it be pointed anywhere.
    const slug = await uniqueNewsCategorySlug(name, id)
    const data = { name, slug, sortOrder: sortOrder ?? 0 }

    if (id) {
      const before = await db.newsCategory.findUnique({
        where: { id },
        select: { id: true, name: true, slug: true, sortOrder: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.newsCategory.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: user.id,
            action: 'news_category.updated',
            entityType: 'NewsCategory',
            entityId: id,
            before,
            after: data,
          },
          tx
        )
      })

      revalidateNews()
      return { ok: true, slug }
    }

    await db.$transaction(async (tx) => {
      const row = await tx.newsCategory.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'news_category.created',
          entityType: 'NewsCategory',
          entityId: row.id,
          after: data,
        },
        tx
      )
      return row
    })

    revalidateNews()
    return { ok: true, slug }
  } catch (error) {
    console.error('[news] saveNewsCategory failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteNewsCategory(input: unknown): Promise<NewsCategoryActionResult> {
  const user = await requirePermission('news:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    const category = await db.newsCategory.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, _count: { select: { articles: true } } },
    })
    if (!category) return { ok: false, error: 'not_found' }

    // The relation is `onDelete: SetNull`, so a delete would not destroy the
    // articles — it would silently strip their category, which is a content
    // change nobody asked for and one nothing records. Refuse instead.
    if (category._count.articles > 0) return { ok: false, error: 'in_use' }

    await db.$transaction(async (tx) => {
      // A hard delete: `NewsCategory` has no `deletedAt`, and an empty category
      // carries no history worth preserving.
      await tx.newsCategory.delete({ where: { id } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'news_category.deleted',
          entityType: 'NewsCategory',
          entityId: id,
          before: { name: category.name, slug: category.slug },
        },
        tx
      )
    })

    revalidateNews()
    return { ok: true }
  } catch (error) {
    console.error('[news] deleteNewsCategory failed:', error)
    return { ok: false, error: 'server' }
  }
}
