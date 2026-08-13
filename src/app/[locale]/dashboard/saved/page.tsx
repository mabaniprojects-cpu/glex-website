import { Bookmark, ImageOff } from 'lucide-react'
import Image from 'next/image'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AddToRfqButton } from '@/components/marketplace/add-to-rfq-button'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listSavedProducts } from '@/lib/dashboard'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SavedProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()
  const t = await getTranslations('dashboard')
  const marketplace = await getTranslations('marketplace')
  const nav = await getTranslations('nav')

  // A product may have been hidden or removed since it was saved.
  const saved = (await listSavedProducts(user)).filter(
    (entry) => entry.product.isVisible && !entry.product.deletedAt
  )

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t('nav.saved')}</h1>

      {saved.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <Bookmark className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <p className="mt-4 text-glex-green-800/70">{marketplace('emptyBody')}</p>
          <div className="mt-6">
            <Button asChild variant="primary">
              <Link href="/marketplace">{nav('marketplace')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((entry) => (
            <li
              key={entry.id}
              className="overflow-hidden rounded-xl border border-border-subtle"
            >
              <Link
                href={
                  `/products/${entry.product.slug}` as Parameters<typeof Link>[0]['href']
                }
                className="relative block aspect-4/3 bg-surface-muted"
              >
                {entry.product.images[0] ? (
                  <Image
                    src={entry.product.images[0].url}
                    alt={entry.product.name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-glex-green-200">
                    <ImageOff className="size-8" aria-hidden="true" />
                  </span>
                )}
              </Link>

              <div className="p-5">
                <h2 className="font-semibold">
                  <Link
                    href={
                      `/products/${entry.product.slug}` as Parameters<typeof Link>[0]['href']
                    }
                    className="hover:text-glex-green-600"
                  >
                    {entry.product.name}
                  </Link>
                </h2>
                {entry.product.brand ? (
                  <p className="mt-1 text-sm text-glex-green-800/70">{entry.product.brand}</p>
                ) : null}

                <p className="mt-3 text-sm font-semibold text-glex-gold-700">
                  {marketplace('priceOnRequest')}
                </p>

                <div className="mt-4">
                  <AddToRfqButton productId={entry.product.id} fullWidth className="w-full" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
