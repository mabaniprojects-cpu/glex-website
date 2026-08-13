import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { ClientRegisterForm } from '@/components/auth/client-register-form'
import { routing } from '@/i18n/routing'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'client' })
  return {
    title: t('registerTitle'),
    description: t('registerDescription'),
    alternates: { canonical: `/${locale}/register/client` },
  }
}

export default async function ClientRegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('client')

  return (
    <AuthShell title={t('registerTitle')} subtitle={t('registerDescription')} wide>
      <ClientRegisterForm />
    </AuthShell>
  )
}
