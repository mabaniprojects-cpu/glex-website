import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { FreightForm } from '@/components/freight/freight-form'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { routing } from '@/i18n/routing'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'freight' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/freight` },
  }
}

export default async function FreightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('freight')
  const nav = await getTranslations('nav')

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/freight', label: t('title') },
        ]}
      />

      <Section>
        <div className="mx-auto max-w-3xl">
          <FreightForm />
        </div>
      </Section>
    </>
  )
}
