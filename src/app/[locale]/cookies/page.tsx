import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { CookiePreferences } from '@/components/layout/cookie-consent'
import { LegalPage } from '@/components/legal/legal-page'
import { routing } from '@/i18n/routing'
import { readConsent } from '@/lib/consent'

const LAST_UPDATED = new Date('2026-01-01T00:00:00Z')

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'legal' })
  return { title: t('cookiesTitle'), alternates: { canonical: `/${locale}/cookies` } }
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('legal')
  const consent = await readConsent()

  return (
    <LegalPage
      locale={locale}
      navKey="cookies"
      title={t('cookiesTitle')}
      lastUpdated={LAST_UPDATED}
      intro="This page explains the cookies this site sets and how to control them. No analytics or marketing cookie is set before you give consent."
      sections={[
        {
          heading: 'Strictly necessary cookies',
          paragraphs: [
            'These are required for the site to function and cannot be switched off.',
          ],
          bullets: [
            'Session cookie — keeps you signed in. HTTP-only and SameSite-restricted.',
            'GLEX_LOCALE — remembers your chosen language.',
            'Consent cookie — records your cookie choices so you are not asked repeatedly.',
            'Security tokens used to protect forms against cross-site request forgery.',
          ],
        },
        {
          heading: 'Analytics cookies',
          paragraphs: [
            'Optional, and set only if you accept them. They help us understand which pages are useful. No third-party analytics or marketing script is loaded until consent is given.',
          ],
        },
        {
          heading: 'Managing your choices',
          paragraphs: [
            'You can change your preferences at any time using the controls at the end of this page. Your decision is recorded, along with the time it was given, as evidence of consent — refusals as well as approvals.',
            'You can also block or delete cookies in your browser settings, though the site may not work correctly if strictly necessary cookies are blocked.',
          ],
        },
      ]}
    >
      {/* Withdrawing consent must be as easy as giving it. */}
      <CookiePreferences current={consent} />
    </LegalPage>
  )
}
