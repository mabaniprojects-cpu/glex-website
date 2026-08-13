import type { Metadata } from 'next'
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import type { ReactNode } from 'react'
import { GlexAssistant } from '@/components/chat/glex-assistant'
import { CookieConsent } from '@/components/layout/cookie-consent'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SkipToContent } from '@/components/layout/skip-to-content'
import {
  localeDirection,
  localeHreflang,
  locales,
  routing,
  type AppLocale,
} from '@/i18n/routing'
import { readConsent } from '@/lib/consent'
import { sweepIfDue } from '@/lib/maintenance'
import '../globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

// Arabic needs its own face; Inter has no Arabic coverage.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-plex-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

/** Pre-renders all five locales at build time. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}

  const t = await getTranslations({ locale, namespace: 'home' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // hreflang map — every locale plus x-default pointing at English.
  const languages = Object.fromEntries([
    ...locales.map((l) => [localeHreflang[l], `/${l}`]),
    ['x-default', `/${routing.defaultLocale}`],
  ])

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: t('metaTitle'),
      template: `%s | ${common('brandFull')}`,
    },
    description: t('metaDescription'),
    applicationName: common('brandFull'),
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    openGraph: {
      type: 'website',
      siteName: common('brandFull'),
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale: localeHreflang[locale as AppLocale],
      url: `/${locale}`,
      images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: common('logoAlt') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: ['/brand/og-default.png'],
    },
    icons: {
      icon: [
        { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
      ],
      apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
    },
    robots: { index: true, follow: true },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  // Required for static rendering of a [locale] segment.
  setRequestLocale(locale)

  const dir = localeDirection(locale)

  // Housekeeping for the tables that grow without bound, run after the response
  // so it costs the visitor nothing and at most once an hour per instance. This
  // layout is a sound host because reading the consent cookie below makes it
  // dynamic on every request; `after` in a *static* segment would fire at build
  // time instead, which would be no sweep at all.
  after(sweepIfDue)

  // Read on the server, so the banner never flashes for someone who has
  // already chosen — and so nothing optional is sent before they do.
  const consent = await readConsent()

  return (
    <html
      lang={localeHreflang[locale]}
      dir={dir}
      // Next 16 no longer overrides `scroll-behavior: smooth` during
      // navigation unless this attribute is present.
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${plexArabic.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-white antialiased">
        <NextIntlClientProvider>
          <SkipToContent />
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          {/* Mounted once, site-wide. */}
          <GlexAssistant />
          {consent === null ? <CookieConsent /> : null}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
