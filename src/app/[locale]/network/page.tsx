import { MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section, SectionHeading } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { RouteMap } from '@/components/visuals/route-map'
import { Card, CardContent } from '@/components/ui/card'
import { routing } from '@/i18n/routing'
import { db } from '@/lib/db'
import { GLEX_COMPANY } from '@/lib/company'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'home.map' })
  return {
    title: t('heading'),
    description: t('description'),
    alternates: { canonical: `/${locale}/network` },
  }
}

export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const nav = await getTranslations('nav')
  const t = await getTranslations('home.map')

  const routes = await db.globalRoute
    .findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    .catch(() => [])

  return (
    <>
      <PageHero
        title={t('heading')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/network', label: nav('network') },
        ]}
      />

      <Section>
        {/* The map is decorative; the same data is listed below in text so the
            information is never conveyed by the graphic alone. */}
        <div className="overflow-hidden rounded-2xl bg-glex-green-900 p-4 sm:p-8">
          <RouteMap routes={routes} className="h-auto w-full" />
        </div>

        <div className="mt-12">
          <SectionHeading title={t('routesLabel')} align="start" />
          {routes.length === 0 ? (
            <p className="mt-6 text-glex-green-800/70">
              No trade routes have been configured yet.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <li key={route.id}>
                  <Card>
                    <CardContent className="flex items-start gap-3 p-5 pt-5">
                      <MapPin
                        className="mt-0.5 size-5 shrink-0 text-glex-gold-500"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-semibold text-glex-green-900">{route.destName}</p>
                        <p className="mt-1 text-sm text-glex-green-800/70">
                          {GLEX_COMPANY.office.city} → {route.destName}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 max-w-2xl text-sm text-glex-green-800/60">
            Routes shown are indicative trade lanes coordinated from the GLEX Jeddah office and are
            editable in the admin portal. They do not represent a guarantee of service coverage.
          </p>
        </div>
      </Section>
    </>
  )
}
