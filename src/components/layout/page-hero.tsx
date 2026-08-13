import type { ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * `href` MUST be locale-less (e.g. `/about`, or `/` for home).
 * The i18n `Link` adds the active locale itself — passing `/en/about` here
 * would produce `/en/en/about`.
 */
export type Crumb = { href: string; label: string }

/**
 * Standard interior-page header: breadcrumb, title, lead paragraph.
 * Emits BreadcrumbList JSON-LD so interior pages carry structured data too.
 */
export function PageHero({
  title,
  description,
  breadcrumbs = [],
  locale,
  children,
  tone = 'light',
}: {
  title: string
  description?: string
  breadcrumbs?: Crumb[]
  /** Active locale — used only to build absolute JSON-LD URLs. */
  locale?: string
  children?: ReactNode
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const jsonLd =
    breadcrumbs.length > 0 && locale
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.label,
            // Absolute, locale-prefixed URL for search engines.
            item: `${appUrl}/${locale}${crumb.href === '/' ? '' : crumb.href}`,
          })),
        }
      : null

  return (
    <section className={cn(dark ? 'bg-glex-green-900 text-white' : 'bg-surface-muted')}>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      <div className="container-glex py-12 lg:py-16">
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <li key={crumb.href} className="flex items-center gap-2">
                    {isLast ? (
                      <span
                        aria-current="page"
                        className={dark ? 'text-glex-ivory/70' : 'text-glex-green-800/60'}
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <>
                        <Link
                          href={crumb.href as Parameters<typeof Link>[0]['href']}
                          className={cn(
                            'underline-offset-4 hover:underline',
                            dark ? 'text-glex-ivory/85' : 'text-glex-green-700'
                          )}
                        >
                          {crumb.label}
                        </Link>
                        <span
                          aria-hidden="true"
                          className={dark ? 'text-glex-ivory/40' : 'text-glex-green-800/35'}
                        >
                          /
                        </span>
                      </>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null}

        <h1 className={cn('max-w-4xl text-3xl font-bold sm:text-4xl lg:text-5xl', dark && 'text-white')}>
          {title}
        </h1>

        {description ? (
          <p
            className={cn(
              'mt-4 max-w-3xl text-lg leading-relaxed',
              dark ? 'text-glex-ivory/85' : 'text-glex-green-800/75'
            )}
          >
            {description}
          </p>
        ) : null}

        {children}
      </div>
    </section>
  )
}

/** Shared prose wrapper for legal and long-form content. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'max-w-3xl space-y-5 text-glex-green-800/85',
        '[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold',
        '[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold',
        '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:ps-6',
        '[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:ps-6',
        '[&_a]:text-glex-green-700 [&_a]:underline [&_a]:underline-offset-4',
        '[&_p]:leading-relaxed'
      )}
    >
      {children}
    </div>
  )
}
