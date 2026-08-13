import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { LegalPage } from '@/components/legal/legal-page'
import { routing } from '@/i18n/routing'

const LAST_UPDATED = new Date('2026-01-01T00:00:00Z')

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'legal' })
  return { title: t('termsTitle'), alternates: { canonical: `/${locale}/terms` } }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('legal')

  return (
    <LegalPage
      locale={locale}
      navKey="terms"
      title={t('termsTitle')}
      lastUpdated={LAST_UPDATED}
      intro="These terms govern your use of the GLEX website and platform. By creating an account or submitting a request you agree to them."
      sections={[
        {
          heading: 'The service',
          paragraphs: [
            'GLEX facilitates the sourcing and export of Saudi building materials. The catalogue is a request-for-quotation catalogue: it does not display prices and no listing constitutes an offer capable of acceptance.',
            'A binding commercial agreement arises only from a written quotation issued by GLEX and accepted in writing, subject to the terms of that quotation.',
          ],
        },
        {
          heading: 'Accounts',
          paragraphs: [
            'You are responsible for the accuracy of the information you provide and for keeping your credentials confidential. You must notify us promptly of any unauthorised use.',
            'Accounts may be suspended where information is materially inaccurate or where the platform is used unlawfully.',
          ],
        },
        {
          heading: 'Requests for quotation',
          paragraphs: [
            'Submitting a request does not oblige GLEX to supply, nor you to purchase. Quotations are valid only for the period stated on them and are subject to availability, specification confirmation and final freight costs at the time of booking.',
          ],
        },
        {
          heading: 'Supplier and distributor registration',
          paragraphs: [
            'Registration does not guarantee approval, listing or the award of any business. GLEX may request clarification, approve conditionally, decline or suspend an application at its discretion.',
            'You warrant that you are authorised to submit the registration and that all documents supplied are genuine and current.',
          ],
        },
        {
          heading: 'Shipment information',
          paragraphs: [
            'Tracking milestones and estimated dates are provided for information only. Estimated departure and arrival dates are indicative and may change. Where no external carrier integration is configured, tracking reflects records maintained by GLEX rather than a live carrier feed.',
          ],
        },
        {
          heading: 'Export, customs and Incoterms',
          paragraphs: [
            'Guidance published on this site — including Incoterm summaries, container information and document checklists — is general in nature. It is not legal, customs or contractual advice, and must be confirmed with qualified professionals and the relevant authorities before shipment.',
          ],
        },
        {
          heading: 'Intellectual property',
          paragraphs: [
            'The GLEX name, logo, brand assets and the content of this site are the property of Global Export House and may not be reproduced without written permission.',
          ],
        },
        {
          heading: 'Governing law',
          paragraphs: [
            'These terms are governed by the laws of the Kingdom of Saudi Arabia. The governing law and dispute-resolution clauses should be confirmed by qualified legal counsel before publication.',
          ],
        },
      ]}
    />
  )
}
