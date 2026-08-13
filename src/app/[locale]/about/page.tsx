import { Building2, Globe2, Phone, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section, SectionHeading } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Card, CardContent } from '@/components/ui/card'
import { routing } from '@/i18n/routing'
import { GLEX_COMPANY } from '@/lib/company'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'nav' })
  return {
    title: t('about'),
    alternates: { canonical: `/${locale}/about` },
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const nav = await getTranslations('nav')
  const t = await getTranslations('home.values')
  const footer = await getTranslations('footer')

  // Only verifiable registration facts appear here — no invented statistics,
  // clients, partnerships or awards.
  const FACTS = [
    { icon: Building2, label: footer('crNumber'), value: GLEX_COMPANY.crNumber, ltr: true },
    { icon: ShieldCheck, label: footer('paidCapital'), value: footer('capitalValue'), ltr: false },
    { icon: Phone, label: nav('contact'), value: GLEX_COMPANY.phoneDisplay, ltr: true },
    {
      icon: Globe2,
      label: GLEX_COMPANY.office.city,
      value: GLEX_COMPANY.office.country,
      ltr: false,
    },
  ]

  return (
    <>
      <PageHero
        title={nav('about')}
        description={footer('summary')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/about', label: nav('about') },
        ]}
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((fact) => (
            <Card key={fact.label} className="bg-glex-green-50/50">
              <CardContent className="p-6 pt-6">
                <fact.icon className="size-6 text-glex-green-600" aria-hidden="true" />
                <p className="mt-4 text-sm font-medium text-glex-green-800/70">{fact.label}</p>
                <p
                  className="mt-1 text-lg font-semibold text-glex-green-900"
                  dir={fact.ltr ? 'ltr' : undefined}
                >
                  {fact.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section muted>
        <SectionHeading title={t('heading')} description={t('description')} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(['saudiAccess', 'globalReach', 'reliableLogistics', 'endToEnd'] as const).map((key) => (
            <Card key={key}>
              <CardContent className="p-6 pt-6">
                <h3 className="font-semibold">{t(`${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-glex-green-800/75">
                  {t(`${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold sm:text-3xl">{GLEX_COMPANY.office.name}</h2>
          <address className="mt-5 space-y-1 text-lg not-italic text-glex-green-800/80">
            {GLEX_COMPANY.office.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <p className="mt-5">
            <a
              href={`tel:${GLEX_COMPANY.phoneE164}`}
              dir="ltr"
              className="text-lg font-semibold text-glex-green-700 underline-offset-4 hover:underline"
            >
              {GLEX_COMPANY.phoneDisplay}
            </a>
          </p>
        </div>
      </Section>
    </>
  )
}
