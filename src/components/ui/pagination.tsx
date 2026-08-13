import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Page navigation as real links, so results are crawlable and work without JS.
 * Chevrons carry `rtl-flip`, which mirrors them in Arabic.
 */
export async function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number
  pageCount: number
  /** Returns the query string for a given page, preserving active filters. */
  buildHref: (page: number) => string
}) {
  const common = await getTranslations('common')
  if (pageCount <= 1) return null

  // A compact window around the current page.
  const windowSize = 2
  const pages: number[] = []
  for (let i = Math.max(1, page - windowSize); i <= Math.min(pageCount, page + windowSize); i += 1) {
    pages.push(i)
  }

  const linkClass = (active: boolean) =>
    cn(
      'inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium',
      active
        ? 'bg-glex-green-600 text-white'
        : 'border border-border-subtle text-glex-green-800 hover:bg-glex-green-50'
    )

  return (
    <nav aria-label={common('page')} className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1) as Parameters<typeof Link>[0]['href']}
          rel="prev"
          className={linkClass(false)}
          aria-label={common('previous')}
        >
          <ChevronLeft className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
      ) : null}

      {pages[0]! > 1 ? <span className="px-1 text-glex-green-800/50">…</span> : null}

      {pages.map((value) => (
        <Link
          key={value}
          href={buildHref(value) as Parameters<typeof Link>[0]['href']}
          aria-current={value === page ? 'page' : undefined}
          className={linkClass(value === page)}
        >
          {value}
        </Link>
      ))}

      {pages[pages.length - 1]! < pageCount ? (
        <span className="px-1 text-glex-green-800/50">…</span>
      ) : null}

      {page < pageCount ? (
        <Link
          href={buildHref(page + 1) as Parameters<typeof Link>[0]['href']}
          rel="next"
          className={linkClass(false)}
          aria-label={common('next')}
        >
          <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  )
}
