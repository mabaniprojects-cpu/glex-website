import { AlertTriangle, Container, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section, SectionHeading } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { routing } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const

/**
 * Nominal container types. Dimensions and capacities are deliberately NOT
 * asserted here — they vary by owner, build and tare weight. The admin portal
 * is the place to publish verified figures for a specific carrier.
 */
const CONTAINERS = [
  { key: '20ft-standard', name: "20' Standard (Dry)" },
  { key: '40ft-standard', name: "40' Standard (Dry)" },
  { key: '40ft-high-cube', name: "40' High Cube" },
  { key: 'open-top', name: 'Open Top' },
  { key: 'flat-rack', name: 'Flat Rack' },
  { key: 'reefer', name: 'Reefer (Refrigerated)' },
] as const

/** Commonly required commercial export documents. */
const DOCUMENTS = [
  'Commercial invoice',
  'Packing list',
  'Certificate of origin',
  'Bill of lading (ocean) or air waybill (air)',
  'Insurance certificate',
  'Inspection certificate',
  'Customs declaration',
  'Product certificates and test reports',
  'Delivery note',
] as const

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'home.resources' })
  return pageMetadata({
    locale,
    path: '/resources',
    title: t('heading'),
    description: t('description'),
  })
}

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const nav = await getTranslations('nav')
  const t = await getTranslations('home.resources')
  const incoterms = await getTranslations('incoterms')

  return (
    <>
      <PageHero
        title={t('heading')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/resources', label: nav('resources') },
        ]}
      />

      {/* --- Incoterms --- */}
      <Section>
        <SectionHeading title="Incoterms® 2020" align="start" />

        <div
          role="note"
          className="border-glex-gold-300 bg-glex-gold-50 mt-6 flex max-w-3xl gap-3 rounded-xl border p-5"
        >
          <AlertTriangle className="text-glex-gold-700 mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-glex-green-900 text-sm leading-relaxed">{incoterms('disclaimer')}</p>
        </div>

        <div className="mt-8 max-w-3xl">
          <Accordion>
            {INCOTERMS.map((code) => (
              <AccordionItem key={code} question={code} name="incoterms">
                {incoterms(code)}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* --- Container guide --- */}
      <Section muted>
        <SectionHeading title="Container guide" align="start" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTAINERS.map((item) => (
            <Card key={item.key}>
              <CardContent className="p-6 pt-6">
                <Container className="text-glex-green-600 size-6" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">{item.name}</h3>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-glex-green-800/70 mt-6 max-w-3xl text-sm leading-relaxed">
          Internal dimensions, payload and tare weight vary between owners and builds. GLEX
          publishes verified figures for the specific equipment allocated to your shipment;
          capacities are maintained in the admin portal and are not guaranteed from this page.
        </p>
      </Section>

      {/* --- Export document checklist --- */}
      <Section>
        <SectionHeading title="Export document checklist" align="start" />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ul className="space-y-3 lg:col-span-2">
            {DOCUMENTS.map((document) => (
              <li
                key={document}
                className="border-border-subtle flex items-start gap-3 rounded-lg border bg-white p-4"
              >
                <FileText
                  className="text-glex-green-500 mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-glex-green-900">{document}</span>
              </li>
            ))}
          </ul>

          <div
            role="note"
            className="border-glex-gold-300 bg-glex-gold-50 h-fit rounded-xl border p-5"
          >
            <AlertTriangle className="text-glex-gold-700 size-5" aria-hidden="true" />
            <p className="text-glex-green-900 mt-3 text-sm leading-relaxed">
              This checklist is general guidance only. The documents actually required depend on the
              shipment mode, origin, destination and product category, and change over time. Final
              customs and legal requirements must be confirmed with qualified professionals and the
              relevant authorities before shipment.
            </p>
          </div>
        </div>
      </Section>
    </>
  )
}
