import { ArrowLeft, Info } from 'lucide-react'
import Image from 'next/image'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { Section, SectionHeading } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { NewsCard } from '@/components/news/news-card'
import { ShareLinks } from '@/components/news/share-links'
import { Link } from '@/i18n/navigation'
import { localeHreflang, routing, type AppLocale } from '@/i18n/routing'
import { getNewsArticle, listRelatedNews, recordNewsView } from '@/lib/news'
import { formatDate, truncate } from '@/lib/utils'

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}

  const article = await getNewsArticle(slug, locale as AppLocale)
  if (!article) return {}

  const description = article.displaySeoDescription ?? truncate(article.displaySummary, 155)
  const image = article.socialImage ?? article.featuredImage

  return {
    title: article.displaySeoTitle ?? article.displayTitle,
    description,
    alternates: { canonical: `/${locale}/news/${slug}` },
    openGraph: {
      type: 'article',
      title: article.displayTitle,
      description,
      publishedTime: article.publishedAt?.toISOString(),
      locale: localeHreflang[locale as AppLocale],
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.displayTitle,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const article = await getNewsArticle(slug, locale as AppLocale)
  if (!article) notFound()

  const t = await getTranslations('news')
  const nav = await getTranslations('nav')

  const related = await listRelatedNews(article.id, article.categoryId, locale as AppLocale)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = `${appUrl}/${locale}/news/${slug}`

  // The view counter must not delay the response.
  after(() => recordNewsView(article.id))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.displayTitle,
    description: article.displaySummary,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: article.author?.name
      ? { '@type': 'Person', name: article.author.name }
      : { '@type': 'Organization', name: 'GLEX – Global Export House' },
    publisher: {
      '@type': 'Organization',
      name: 'GLEX – Global Export House',
      logo: { '@type': 'ImageObject', url: `${appUrl}/brand/glex-logo.png` },
    },
    mainEntityOfPage: url,
    ...(article.featuredImage ? { image: [`${appUrl}${article.featuredImage}`] } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        title={article.displayTitle}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/news', label: nav('news') },
        ]}
      >
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-glex-green-800/70">
          {article.categoryName ? (
            <span className="font-semibold tracking-wide text-glex-green-500 uppercase">
              {article.categoryName}
            </span>
          ) : null}
          {article.publishedAt ? (
            <time dateTime={article.publishedAt.toISOString()}>
              {t('publishedOn', { date: formatDate(article.publishedAt, locale) })}
            </time>
          ) : null}
          <span>{t('readingTime', { minutes: article.readingMinutes })}</span>
          {article.author?.name ? <span>{article.author.name}</span> : null}
        </p>
      </PageHero>

      <Section>
        <article className="mx-auto max-w-3xl">
          {/* Seeded demonstration content is always labelled. */}
          {article.isSample ? (
            <div
              role="note"
              className="mb-8 flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
            >
              <Info className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-glex-green-900">{t('sampleNotice')}</p>
            </div>
          ) : null}

          {article.featuredImage ? (
            <div className="relative mb-8 aspect-16/9 overflow-hidden rounded-xl bg-surface-muted">
              <Image
                src={article.featuredImage}
                alt=""
                fill
                sizes="(min-width: 1024px) 48rem, 100vw"
                className="object-cover"
                loading="eager"
              />
            </div>
          ) : null}

          <p className="text-lg leading-relaxed font-medium text-glex-green-800/90">
            {article.displaySummary}
          </p>

          <div className="mt-6 space-y-5 leading-relaxed whitespace-pre-line text-glex-green-800/85">
            {article.displayBody}
          </div>

          {article.tags.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-2">
              {article.tags.map((entry) => (
                <li
                  key={entry.tag.slug}
                  className="rounded-md bg-surface-muted px-2.5 py-1 text-sm text-glex-green-800"
                >
                  {entry.tag.name}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-sm text-glex-green-700 underline-offset-4 hover:underline"
            >
              <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
              {t('backToNews')}
            </Link>

            <ShareLinks url={url} title={article.displayTitle} />
          </div>
        </article>
      </Section>

      {related.length > 0 ? (
        <Section muted>
          <SectionHeading title={t('relatedArticles')} align="start" />
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <NewsCard article={item} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  )
}
