import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { SupplierRegistrationForm } from '@/components/supplier/registration-form'
import { routing } from '@/i18n/routing'
import { listCategoryOptions } from '@/lib/actions/supplier-registration-actions'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'supplier' })
  return {
    title: t('registerTitle'),
    description: t('registerDescription'),
    alternates: { canonical: `/${locale}/register/supplier` },
  }
}

export default async function SupplierRegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('supplier')
  const categories = await listCategoryOptions().catch(() => [])

  return (
    <AuthShell title={t('registerTitle')} subtitle={t('registerDescription')} wide>
      <SupplierRegistrationForm categories={categories} />
    </AuthShell>
  )
}
