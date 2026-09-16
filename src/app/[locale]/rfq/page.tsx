import { ClipboardList, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { RfqForm } from '@/components/rfq/rfq-form'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getSessionUser } from '@/lib/auth-guards'
import { hydrateCart, readCart } from '@/lib/rfq-cart'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'rfq' })
  return pageMetadata({ locale, path: '/rfq', title: t('title'), description: t('description') })
}

export default async function RfqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('rfq')
  const nav = await getTranslations('nav')

  const [user, cartLines] = await Promise.all([getSessionUser(), readCart()])
  const cart = await hydrateCart(cartLines)

  return (
    <>
      <PageHero
        title={t('title')}
        description={t('description')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/rfq', label: nav('rfq') },
        ]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RfqForm cartLines={cart} signedIn={Boolean(user)} userName={user?.name ?? null} />
          </div>

          {/* Cart summary */}
          <aside aria-labelledby="rfq-cart-heading" className="lg:col-span-1">
            <div className="border-border-subtle bg-surface-muted sticky top-24 rounded-xl border p-6">
              <h2 id="rfq-cart-heading" className="flex items-center gap-2 text-lg font-bold">
                <ShoppingBag className="text-glex-green-600 size-5" aria-hidden="true" />
                {t('cart')}
              </h2>

              {cart.length === 0 ? (
                <div className="mt-5 text-center">
                  <ClipboardList
                    className="text-glex-green-200 mx-auto size-9"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-medium">{t('cartEmpty')}</p>
                  <p className="text-glex-green-800/70 mt-1 text-sm">{t('cartEmptyBody')}</p>
                  <div className="mt-5">
                    <Button asChild variant="primary" size="sm">
                      <Link href="/marketplace">{nav('marketplace')}</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="mt-5 space-y-3">
                    {cart.map((line) => (
                      <li key={line.productId} className="rounded-lg bg-white p-3 text-sm">
                        <p className="font-medium">{line.name}</p>
                        <p className="text-glex-green-800/65 mt-0.5">
                          {line.quantity} · {line.unit}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <p className="text-glex-green-800/70 mt-5 text-sm">
                    {t('cart')}: {cart.length}
                  </p>

                  <div className="mt-4">
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/marketplace">{nav('marketplace')}</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}
