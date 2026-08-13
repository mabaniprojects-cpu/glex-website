import { hasLocale } from 'next-intl'
import { pickTranslation, toDbLocale } from '@/i18n/locale'
import { routing, type AppLocale } from '@/i18n/routing'
import { db } from '@/lib/db'
import { GLEX_COMPANY } from '@/lib/company'
import { publishedWhere } from '@/lib/news'

/** Escapes text for XML character data. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Per-locale RSS 2.0 feed.
 *
 * Only genuinely published articles appear — `publishedWhere()` is the same
 * predicate the site uses, so a scheduled article cannot leak early via the feed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    return new Response('Not found', { status: 404 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const dbLocale = toDbLocale(locale)

  const articles = await db.newsArticle
    .findMany({
      where: publishedWhere(),
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: { translations: { where: { locale: { in: [dbLocale, 'en'] } } } },
    })
    .catch(() => [])

  const items = articles
    .map((article) => {
      const translation = pickTranslation(article.translations, locale as AppLocale)
      const title = translation?.title ?? article.title
      const summary = translation?.summary ?? article.summary
      const link = `${appUrl}/${locale}/news/${article.slug}`

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(summary)}</description>
      <pubDate>${article.publishedAt!.toUTCString()}</pubDate>
    </item>`
    })
    .join('\n')

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${GLEX_COMPANY.displayName} — News`)}</title>
    <link>${appUrl}/${locale}/news</link>
    <description>${escapeXml(GLEX_COMPANY.tagline)}</description>
    <language>${locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${appUrl}/${locale}/news/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  })
}
