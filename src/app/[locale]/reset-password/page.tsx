import { AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from '@/components/auth/password-forms'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { peekToken, TOKEN_PURPOSE } from '@/lib/tokens'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('resetTitle'), robots: { index: false, follow: false } }
}

export default async function ResetPasswordPage({
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

  // Checked but NOT consumed — the token is spent only on successful submit,
  // so a preview render cannot invalidate the user's link.
  const check = token
    ? await peekToken(token, TOKEN_PURPOSE.PASSWORD_RESET)
    : ({ valid: false, reason: 'invalid' } as const)

  if (!check.valid) {
    return (
      <AuthShell title={t('resetTitle')}>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-9 text-red-600" aria-hidden="true" />
          <p className="mt-4 font-medium text-red-900">{t('resetInvalid')}</p>
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="primary">
            <Link href="/forgot-password">{t('resetAction')}</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('resetTitle')}>
      <ResetPasswordForm token={token!} />
    </AuthShell>
  )
}
