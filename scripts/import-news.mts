import 'dotenv/config'
import { ContentStatus, Locale } from '@prisma/client'
import { toDbLocale } from '../src/i18n/locale'
import { db } from '../src/lib/db'
import { CATEGORY_LABELS, NEWS } from './news-data'

/**
 * Loads the GLEX news items into a database.
 *
 *   npx tsx scripts/import-news.mts            # dry run
 *   npx tsx scripts/import-news.mts --confirm  # apply
 *
 * Upserts by slug and never deletes: running it twice refreshes the wording
 * rather than creating a second copy, and an article edited afterwards in the
 * admin portal is overwritten only if this file is re-run.
 *
 * Each item keeps the link it was written from at the end of its body, in both
 * languages, so a reader — or whoever checks this later — can see the source.
 */

const confirmed = process.argv.includes('--confirm')

/** Roughly 200 words a minute, the figure the article list already assumes. */
function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200))
}

function withSource(body: string, source: string, label: string): string {
  return `${body}\n\n${label}: ${source}`
}

const categories = await db.newsCategory.findMany({ select: { id: true, slug: true } })
const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]))

const missingCategories = [...new Set(NEWS.map((item) => item.category))].filter(
  (slug) => !categoryBySlug.has(slug)
)

const existing = await db.newsArticle.findMany({
  where: { slug: { in: NEWS.map((item) => item.slug) } },
  select: { slug: true },
})
const existingSlugs = new Set(existing.map((row) => row.slug))

console.log(`Articles in this file: ${NEWS.length}`)
console.log(`Already present:       ${existingSlugs.size} (will be updated)`)
console.log(`New:                   ${NEWS.length - existingSlugs.size}\n`)

for (const item of NEWS) {
  const mark = existingSlugs.has(item.slug) ? 'update' : 'create'
  console.log(`  ${mark.padEnd(6)} ${item.publishedAt}  ${item.slug}`)
  console.log(`         ${item.en.title}`)
}

if (missingCategories.length > 0) {
  console.log(`\nMissing categories: ${missingCategories.join(', ')}`)
  console.log('Seed them first — the articles would otherwise be filed under none.')
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

// Category names in the other locales. The categories are seeded in English
// only, so an Arabic article carried an English category label above its
// Arabic headline.
for (const category of categories) {
  const labels = CATEGORY_LABELS[category.slug]
  if (!labels) continue

  for (const [locale, name] of Object.entries(labels)) {
    // The application locale and the database enum differ for Chinese:
    // "zh-CN" in the URL, "zh_CN" in the column.
    const dbLocale = toDbLocale(locale)

    await db.newsCategoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: category.id, locale: dbLocale } },
      create: { categoryId: category.id, locale: dbLocale, name },
      update: { name },
    })
  }
}

for (const item of NEWS) {
  const englishBody = withSource(item.en.body, item.source, 'Source')
  const arabicBody = withSource(item.ar.body, item.source, 'المصدر')

  // The photograph lives in the repository, not the database: the column holds
  // the path the page renders.
  const image = item.image ? `/news/${item.slug}.webp` : null

  const article = await db.newsArticle.upsert({
    where: { slug: item.slug },
    create: {
      slug: item.slug,
      title: item.en.title,
      summary: item.en.summary,
      body: englishBody,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(`${item.publishedAt}T09:00:00Z`),
      isFeatured: item.featured ?? false,
      // Not sample content: these are real announcements, and the demo banner
      // must not claim otherwise.
      isSample: false,
      readingMinutes: readingMinutes(englishBody),
      featuredImage: image,
      socialImage: image,
      seoTitle: item.en.title,
      seoDescription: item.en.summary,
      categoryId: categoryBySlug.get(item.category) ?? null,
    },
    update: {
      title: item.en.title,
      summary: item.en.summary,
      body: englishBody,
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(`${item.publishedAt}T09:00:00Z`),
      isFeatured: item.featured ?? false,
      isSample: false,
      readingMinutes: readingMinutes(englishBody),
      featuredImage: image,
      socialImage: image,
      categoryId: categoryBySlug.get(item.category) ?? null,
    },
    select: { id: true },
  })

  await db.newsTranslation.upsert({
    where: { articleId_locale: { articleId: article.id, locale: Locale.ar } },
    create: {
      articleId: article.id,
      locale: Locale.ar,
      title: item.ar.title,
      summary: item.ar.summary,
      body: arabicBody,
      seoTitle: item.ar.title,
      seoDescription: item.ar.summary,
    },
    update: {
      title: item.ar.title,
      summary: item.ar.summary,
      body: arabicBody,
      seoTitle: item.ar.title,
      seoDescription: item.ar.summary,
    },
  })
}

console.log(`\nImported ${NEWS.length} article(s), each with its Arabic translation.`)
console.log(
  `Translated the names of ${categories.filter((c) => CATEGORY_LABELS[c.slug]).length} news categories.`
)
await db.$disconnect()
