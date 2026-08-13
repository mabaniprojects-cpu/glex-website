import { ImageOff } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { NewsListItem } from '@/lib/news'
import { cn, formatDate } from '@/lib/utils'

export async function NewsCard({
  article,
  locale,
  className,
}: {
  article: NewsListItem
  locale: string
  className?: string
}) {
  const t = await getTranslations('news')
  const common = await getTranslations('common')

  const href = `/news/${article.slug}` as Parameters<typeof Link>[0]['href']

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-white',
        'transition-shadow hover:shadow-md',
        className
      )}
    >
      <Link href={href} className="relative block aspect-16/9 bg-surface-muted" tabIndex={-1}>
        {article.featuredImage ? (
          <Image
            src={article.featuredImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-glex-green-200">
            <ImageOff className="size-10" aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {article.categoryName ? (
            <span className="font-semibold tracking-wide text-glex-green-500 uppercase">
              {article.categoryName}
            </span>
          ) : null}
          {/* Seeded demonstration articles are always labelled as such. */}
          {article.isSample ? (
            <span className="rounded-full bg-glex-gold-100 px-2 py-0.5 font-semibold text-glex-gold-800">
              {common('sampleBadge')}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 leading-snug font-semibold">
          <Link href={href} className="hover:text-glex-green-600">
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-glex-green-800/75">
          {article.summary}
        </p>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-glex-green-800/60">
          <time dateTime={article.publishedAt.toISOString()}>
            {formatDate(article.publishedAt, locale, { dateStyle: 'medium' })}
          </time>
          <span aria-hidden="true">·</span>
          <span>{t('readingTime', { minutes: article.readingMinutes })}</span>
        </p>
      </div>
    </article>
  )
}
