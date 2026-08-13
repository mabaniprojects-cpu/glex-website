import { ArrowRight, Boxes, Factory } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('registerTitle'), alternates: { canonical: `/${locale}/register` } }
}

export default async function RegisterChooserPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const auth = await getTranslations('auth')
  const client = await getTranslations('client')
  const supplier = await getTranslations('supplier')

  const options = [
    {
      href: '/register/client' as const,
      icon: Boxes,
      title: client('registerTitle'),
      body: client('registerDescription'),
      variant: 'primary' as const,
    },
    {
      href: '/register/supplier' as const,
      icon: Factory,
      title: supplier('registerTitle'),
      body: supplier('registerDescription'),
      variant: 'gold' as const,
    },
  ]

  return (
    <AuthShell title={auth('registerTitle')} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        {options.map((option) => (
          <div
            key={option.href}
            className="flex flex-col rounded-xl border border-border-subtle p-6"
          >
            <option.icon className="size-8 text-glex-green-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{option.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-glex-green-800/75">
              {option.body}
            </p>
            <div className="mt-6">
              <Button asChild variant={option.variant} className="w-full">
                <Link href={option.href}>
                  {auth('registerAction')}
                  <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-7 text-center text-sm text-glex-green-800/70">
        {auth('haveAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-glex-green-700 underline-offset-4 hover:underline"
        >
          {auth('loginAction')}
        </Link>
      </p>
    </AuthShell>
  )
}
