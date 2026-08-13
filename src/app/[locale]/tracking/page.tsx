import { PackageSearch } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { ShipmentView } from '@/components/tracking/shipment-view'
import { TrackingQuickSearch } from '@/components/tracking/tracking-quick-search'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getTrackingProvider } from '@/lib/tracking/registry'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'tracking' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/tracking` },
    // Result pages are per-shipment and must not be indexed.
    robots: { index: false, follow: true },
  }
}

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const { ref } = await searchParams
  const query = ref?.trim() ?? ''

  const t = await getTranslations('tracking')
  const nav = await getTranslations('nav')

  // Public lookup: a correct reference reveals milestones only. No client
  // names, no other organisations' data, and no private documents.
  const result = query ? await getTrackingProvider().track({ query }) : null

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/tracking', label: nav('tracking') },
        ]}
      >
        <div className="mt-8 max-w-2xl">
          <TrackingQuickSearch autoFocus={!query} />
        </div>
      </PageHero>

      <Section>
        {/* Announce async results to assistive technology. */}
        <div aria-live="polite" aria-atomic="true">
          {result === null ? null : result.found ? (
            <ShipmentView result={result} locale={locale} />
          ) : (
            <div className="mx-auto max-w-lg py-12 text-center">
              <PackageSearch
                className="mx-auto size-12 text-glex-green-200"
                aria-hidden="true"
              />
              <h2 className="mt-5 text-2xl font-bold">{t('notFoundTitle')}</h2>
              <p className="mt-3 text-glex-green-800/75">{t('notFoundBody')}</p>
              <p className="mt-2 font-mono text-sm text-glex-green-800/50" dir="ltr">
                {query}
              </p>
              <div className="mt-7">
                <Button asChild variant="outline">
                  <Link href="/contact">{t('contactSupport')}</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </>
  )
}
