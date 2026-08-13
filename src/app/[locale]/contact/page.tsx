import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { ContactForm } from '@/components/contact/contact-form'
import { OfficeCard } from '@/components/contact/office-card'
import { PageHero } from '@/components/layout/page-hero'
import { routing } from '@/i18n/routing'
import { listOffices } from '@/lib/offices'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'contact' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/contact` },
  }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('contact')
  const nav = await getTranslations('nav')

  // Never empty — falls back to the hard-coded head office.
  const offices = await listOffices()

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/contact', label: nav('contact') },
        ]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
          <div className="lg:col-span-2 space-y-6">
            {offices.map((office) => (
              <OfficeCard key={office.id} office={office} />
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
