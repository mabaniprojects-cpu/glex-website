import { ArrowRight } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from '@/components/home/sections'
import { NewsSlider, type SlideItem } from '@/components/news/news-slider'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { listFeaturedNews } from '@/lib/news'

/**
 * Featured-news slider.
 *
 * Dates are serialised to ISO strings because the slider is a Client Component
 * and a `Date` does not survive the Server→Client boundary intact.
 */
export async function HomeNewsSection() {
  const locale = (await getLocale()) as AppLocale
  const t = await getTranslations('home.news')

  const articles = await listFeaturedNews(locale).catch(() => [])
  if (articles.length === 0) return null

  const slides: SlideItem[] = articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    featuredImage: article.featuredImage,
    publishedAt: article.publishedAt.toISOString(),
    readingMinutes: article.readingMinutes,
    isSample: article.isSample,
    categoryName: article.categoryName,
  }))

  return (
    <Section>
      <SectionHeading title={t('heading')} description={t('description')} />

      <div className="mt-12">
        <NewsSlider slides={slides} />
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="outline">
          <Link href="/news">
            {t('action')}
            <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Section>
  )
}
