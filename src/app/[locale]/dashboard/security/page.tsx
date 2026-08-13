import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SignOutButton } from '@/components/dashboard/sign-out-button'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { formatDate, mask } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()
  const t = await getTranslations('dashboard')
  const auth = await getTranslations('auth')
  const common = await getTranslations('common')
  const nav = await getTranslations('nav')

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, emailVerified: true, lastLoginAt: true, createdAt: true },
  })
  if (!account) notFound()

  const facts = [
    { label: auth('email'), value: account.email, ltr: true },
    { label: auth('fullName'), value: account.name },
    {
      label: auth('verifyTitle'),
      value: account.emailVerified
        ? formatDate(account.emailVerified, locale, { dateStyle: 'medium' })
        : common('no'),
    },
    {
      label: common('date'),
      value: account.lastLoginAt
        ? formatDate(account.lastLoginAt, locale, { dateStyle: 'medium', timeStyle: 'short' })
        : '—',
    },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('nav.security')}</h1>

      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm text-glex-green-800/60">{fact.label}</dt>
            <dd className="mt-0.5 font-medium" dir={fact.ltr ? 'ltr' : undefined}>
              {fact.value}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-glex-green-800/60">{common('reference')}</dt>
          {/* Never render a raw internal id. */}
          <dd className="mt-0.5 font-mono text-sm" dir="ltr">
            {mask(user.id)}
          </dd>
        </div>
      </dl>

      <section className="rounded-xl border border-border-subtle p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="size-5 text-glex-green-600" aria-hidden="true" />
          {auth('resetTitle')}
        </h2>
        <p className="mt-2 text-sm text-glex-green-800/75">{auth('resetSubtitle')}</p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/forgot-password">{auth('resetAction')}</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border-subtle p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-glex-green-600" aria-hidden="true" />
          {t('nav.security')}
        </h2>
        <p className="mt-2 text-sm text-glex-green-800/75">
          {auth('passwordHint')}
        </p>
      </section>

      <section className="rounded-xl border border-border-subtle p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LogOut className="size-5 text-glex-green-600" aria-hidden="true" />
          {nav('logout')}
        </h2>
        <div className="mt-4">
          <SignOutButton redirectTo={`/${locale}`} />
        </div>
      </section>
    </div>
  )
}
