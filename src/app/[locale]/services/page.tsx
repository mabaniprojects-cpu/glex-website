import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { CtaSections, HowItWorksSection, ServicesSection } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { routing } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'home.services' })
  return pageMetadata({
    locale,
    path: '/services',
    title: t('heading'),
    description: t('description'),
  })
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const nav = await getTranslations('nav')
  const t = await getTranslations('home.services')

  return (
    <>
      <PageHero
        title={t('heading')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/services', label: nav('services') },
        ]}
      />
      <ServicesSection />
      <HowItWorksSection />
      <CtaSections />
    </>
  )
}
