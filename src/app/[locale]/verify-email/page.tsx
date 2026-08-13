import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { verifyEmail } from '@/lib/actions/auth-actions'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('verifyTitle'), robots: { index: false, follow: false } }
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const { token } = await searchParams
  const t = await getTranslations('auth')

  // The link is single-use: following it consumes the token immediately.
  const result = token ? await verifyEmail(token) : { ok: false as const, error: 'invalid' }

  return (
    <AuthShell title={t('verifyTitle')}>
      {result.ok ? (
        <div role="status" className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
          <p className="mt-4 font-medium text-glex-green-900">{t('verifySuccess')}</p>
          <div className="mt-6">
            <Button asChild variant="primary">
              <Link href="/login">{t('loginAction')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-9 text-red-600" aria-hidden="true" />
          <p className="mt-4 font-medium text-red-900">{t('verifyInvalid')}</p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/login">{t('loginAction')}</Link>
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
