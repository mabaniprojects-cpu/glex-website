import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { Hero } from '@/components/home/hero'
import { HomeNewsSection } from '@/components/home/news-section'
import {
  CtaSections,
  HowItWorksSection,
  ServicesSection,
  ValuesSection,
} from '@/components/home/sections'
import { GLEX_COMPANY, organizationJsonLd } from '@/lib/company'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <>
      {/* Organization structured data (Section 27). */}
      <script
        type="application/ld+json"
        // Serialised server-side from a fixed object — no user input reaches this.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd(`${appUrl}/${locale}`)),
        }}
      />

      <Hero />
      <ValuesSection />
      <ServicesSection />
      <HowItWorksSection />
      <HomeNewsSection />
      <CtaSections />

      <span className="sr-only">{GLEX_COMPANY.tagline}</span>
    </>
  )
}
