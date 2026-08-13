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
  return { title: t('accessibilityTitle'), alternates: { canonical: `/${locale}/accessibility` } }
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('legal')

  return (
    <LegalPage
      locale={locale}
      navKey="accessibility"
      title={t('accessibilityTitle')}
      lastUpdated={LAST_UPDATED}
      intro="GLEX aims to meet WCAG 2.2 Level AA so that the platform is usable by as many people as possible, including those using assistive technology."
      sections={[
        {
          heading: 'What we have implemented',
          paragraphs: ['The following measures are built into the platform today.'],
          bullets: [
            'A skip-to-content link so keyboard users can bypass the header.',
            'A single, consistent, high-contrast focus indicator on every interactive element.',
            'Semantic headings, landmarks and list structures.',
            'Form labels bound to their controls, with errors announced to screen readers.',
            'Dialogs and the mobile navigation drawer trap focus, close on Escape and restore focus to their trigger.',
            'Correct `lang` and `dir` attributes per language, with full right-to-left layout in Arabic.',
            'Colour combinations chosen to meet AA contrast; the logo is placed on a light plate on dark surfaces rather than being recoloured.',
            'All decorative animation is disabled when the operating system requests reduced motion.',
            'Information conveyed by the trade-route map is also available as text.',
          ],
        },
        {
          heading: 'Known limitations',
          paragraphs: [
            'This statement is maintained honestly rather than aspirationally. The platform is under active development and several areas have not yet been built or independently audited.',
            'No formal third-party accessibility audit has been carried out yet. Areas still in development have not been assessed.',
          ],
        },
        {
          heading: 'Feedback',
          paragraphs: [
            'If you encounter a barrier, please contact us using the details below and describe the page and the problem. We will respond and aim to provide the information in an accessible format.',
          ],
        },
      ]}
    />
  )
}
