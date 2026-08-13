import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { toDbLocale } from '@/i18n/locale'
import { routing } from '@/i18n/routing'
import { db } from '@/lib/db'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'nav' })
  return { title: t('faq'), alternates: { canonical: `/${locale}/faq` } }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const nav = await getTranslations('nav')
  const common = await getTranslations('common')

  // Prefer the active locale; fall back to English so the page is never empty.
  const dbLocale = toDbLocale(locale)
  let entries = await db.faqEntry
    .findMany({
      where: { isActive: true, locale: dbLocale },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    .catch(() => [])

  if (entries.length === 0) {
    entries = await db.faqEntry
      .findMany({
        where: { isActive: true, locale: 'en' },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      })
      .catch(() => [])
  }

  // Group by category, preserving first-seen order.
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = entry.category ?? 'General'
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }

  return (
    <>
      {entries.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <PageHero
        title={nav('faq')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/faq', label: nav('faq') },
        ]}
      />

      <Section>
        {entries.length === 0 ? (
          <p className="text-glex-green-800/70">{common('noResults')}</p>
        ) : (
          <div className="max-w-3xl space-y-12">
            {[...groups.entries()].map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-4 text-xl font-bold">{category}</h2>
                <Accordion>
                  {items.map((item) => (
                    <AccordionItem key={item.id} question={item.question} name={`faq-${category}`}>
                      {item.answer}
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}

            <div className="rounded-xl bg-glex-green-50 p-6">
              <p className="font-medium text-glex-green-900">
                {nav('contact')} — {nav('faq')}
              </p>
              <div className="mt-4">
                <Button asChild variant="primary">
                  <Link href="/contact">{nav('contact')}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Section>
    </>
  )
}
