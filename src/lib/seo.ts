import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { localeHreflang, locales, routing, type AppLocale } from '@/i18n/routing'

/**
 * Per-page metadata that keeps the site-wide tags correct.
 *
 * Next merges metadata shallowly: a page that sets `alternates` replaces the
 * layout's whole `alternates` object, and a page that sets nothing for
 * `openGraph` inherits the layout's. Before this helper, every inner page set
 * only a canonical, which silently dropped its hreflang links — so search
 * engines could not pair /en/contact with /ar/contact — and inherited the home
 * page's og:url and og:title, so a shared link to any page previewed as the
 * home page.
 *
 * `path` is the locale-less path: '' for the home page, '/contact' otherwise.
 */

export const DEFAULT_OG_IMAGE = '/brand/og-default.png'

/** Canonical plus the hreflang map for every locale and x-default. */
export function localeAlternates(locale: AppLocale, path: string) {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries([
      ...locales.map((l) => [localeHreflang[l], `/${l}${path}`]),
      ['x-default', `/${routing.defaultLocale}${path}`],
    ]),
  }
}

type PageMetadataInput = {
  locale: AppLocale
  path: string
  /** Omit only for the home page, which uses the site title as-is. */
  title?: string
  /** Falls back to the site description, so no page ships without one. */
  description?: string
  image?: string | null
  type?: 'website' | 'article'
  publishedTime?: string
  /** Extra `<link rel="alternate" type=…>` entries, e.g. an RSS feed. */
  types?: Record<string, string>
}

export async function pageMetadata(input: PageMetadataInput): Promise<Metadata> {
  const { locale, path, image, type = 'website', publishedTime, types } = input
  const home = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const brand = common('brandFull')
  const description = input.description || home('metaDescription')
  // The <title> gets the brand from the layout's template; OpenGraph titles do
  // not go through that template, so the brand is added here to match.
  const socialTitle = input.title ? `${input.title} | ${brand}` : home('metaTitle')
  const images = [
    image
      ? { url: image, alt: input.title ?? brand }
      : { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: common('logoAlt') },
  ]

  return {
    ...(input.title ? { title: input.title } : {}),
    description,
    alternates: { ...localeAlternates(locale, path), ...(types ? { types } : {}) },
    openGraph: {
      type,
      siteName: brand,
      title: socialTitle,
      description,
      url: `/${locale}${path}`,
      locale: localeHreflang[locale],
      images,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: images.map((i) => i.url),
    },
  }
}
