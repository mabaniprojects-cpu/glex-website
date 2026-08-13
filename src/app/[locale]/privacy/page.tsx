import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { LegalPage } from '@/components/legal/legal-page'
import { routing } from '@/i18n/routing'

/** Stable date so the "last updated" line does not change on every render. */
const LAST_UPDATED = new Date('2026-01-01T00:00:00Z')

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'legal' })
  return {
    title: t('privacyTitle'),
    alternates: { canonical: `/${locale}/privacy` },
    robots: { index: true, follow: true },
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('legal')

  return (
    <LegalPage
      locale={locale}
      navKey="privacy"
      title={t('privacyTitle')}
      lastUpdated={LAST_UPDATED}
      intro="This policy explains what personal information GLEX collects when you use this website, why we collect it, how it is stored, and the choices available to you."
      sections={[
        {
          heading: 'Information we collect',
          paragraphs: [
            'We collect only the information needed to respond to your enquiry and to operate the platform.',
          ],
          bullets: [
            'Account details: name, business email address, telephone number and preferred language.',
            'Company details supplied during client, supplier or distributor registration.',
            'Requests for quotation, including products, quantities, destination and any files you attach.',
            'Contact enquiries and support messages.',
            'Technical data such as IP address and browser user agent, recorded for security, rate limiting and consent records.',
          ],
        },
        {
          heading: 'How we use it',
          paragraphs: [
            'Your information is used to create and secure your account, respond to requests for quotation, coordinate sourcing and logistics, provide shipment visibility, and meet record-keeping obligations.',
            'We do not sell personal information. We do not load analytics or marketing scripts before you consent.',
          ],
        },
        {
          heading: 'Sharing',
          paragraphs: [
            'Information is shared only where necessary to deliver the service you have asked for — for example with a supplier preparing a quotation, or a freight or customs partner handling your shipment — and with service providers who process data on our instructions.',
          ],
        },
        {
          heading: 'Retention',
          paragraphs: [
            'Records are kept for as long as needed to provide the service and to satisfy commercial and regulatory record-keeping requirements, after which they are deleted or anonymised.',
          ],
        },
        {
          heading: 'Security',
          paragraphs: [
            'Passwords are hashed. Access is restricted by role, and organisation data is isolated so that one client cannot see another client’s records. Sensitive values are masked in audit logs. Transport is encrypted in transit.',
          ],
        },
        {
          heading: 'Your choices',
          paragraphs: [
            'You may request a copy of your data or ask us to delete your account. Requests are recorded and actioned through the platform. You can change your cookie preferences at any time.',
          ],
        },
      ]}
    />
  )
}
