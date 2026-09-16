import { ArrowRight, Boxes, Factory } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return pageMetadata({ locale, path: '/register', title: t('registerTitle') })
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
            className="border-border-subtle flex flex-col rounded-xl border p-6"
          >
            <option.icon className="text-glex-green-600 size-8" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{option.title}</h2>
            <p className="text-glex-green-800/75 mt-2 flex-1 text-sm leading-relaxed">
              {option.body}
            </p>
            <div className="mt-6">
              <Button asChild variant={option.variant} className="w-full">
                <Link href={option.href}>
                  {auth('registerAction')}
                  <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-glex-green-800/70 mt-7 text-center text-sm">
        {auth('haveAccount')}{' '}
        <Link
          href="/login"
          className="text-glex-green-700 font-medium underline-offset-4 hover:underline"
        >
          {auth('loginAction')}
        </Link>
      </p>
    </AuthShell>
  )
}
