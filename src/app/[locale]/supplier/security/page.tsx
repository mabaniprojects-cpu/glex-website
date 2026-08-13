import { KeyRound, LogOut } from 'lucide-react'
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

export default async function SupplierSecurityPage({
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
  const nav = await getTranslations('nav')
  const common = await getTranslations('common')

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, emailVerified: true, lastLoginAt: true },
  })
  if (!account) notFound()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('nav.security')}</h1>

      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-glex-green-800/60">{auth('email')}</dt>
          <dd className="mt-0.5 font-medium" dir="ltr">
            {account.email}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-glex-green-800/60">{auth('fullName')}</dt>
          <dd className="mt-0.5 font-medium">{account.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-glex-green-800/60">{auth('verifyTitle')}</dt>
          <dd className="mt-0.5 font-medium">
            {account.emailVerified
              ? formatDate(account.emailVerified, locale, { dateStyle: 'medium' })
              : common('no')}
          </dd>
        </div>
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
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/forgot-password">{auth('resetAction')}</Link>
          </Button>
        </div>
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
