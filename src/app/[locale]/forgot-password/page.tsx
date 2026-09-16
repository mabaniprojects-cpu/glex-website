import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/password-forms'
import { routing } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return {
    ...(await pageMetadata({ locale, path: '/forgot-password', title: t('resetTitle') })),
    robots: { index: false, follow: false },
  }
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('auth')

  return (
    <AuthShell title={t('resetTitle')} subtitle={t('resetSubtitle')}>
      <ForgotPasswordForm />
    </AuthShell>
  )
}
