import { ImageOff, MapPin, Package } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Card } from '@/components/ui/card'
import type { ProductListItem } from '@/lib/catalogue'
import { AddToRfqButton } from './add-to-rfq-button'

export async function ProductCard({ product }: { product: ProductListItem }) {
  const t = await getTranslations('marketplace')

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* Media */}
      <Link
        href={`/products/${product.slug}` as Parameters<typeof Link>[0]['href']}
        className="relative block aspect-4/3 overflow-hidden bg-surface-muted"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-glex-green-200">
            <ImageOff className="size-10" aria-hidden="true" />
          </span>
        )}

        {product.isSaudiMade ? (
          <span className="absolute start-3 top-3 rounded-full bg-glex-green-600 px-2.5 py-1 text-xs font-semibold text-white">
            {t('saudiMade')}
          </span>
        ) : null}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium tracking-wide text-glex-green-500 uppercase">
          {product.categoryName}
        </p>

        <h3 className="mt-1.5 leading-snug font-semibold">
          <Link
            href={`/products/${product.slug}` as Parameters<typeof Link>[0]['href']}
            className="hover:text-glex-green-600"
          >
            {product.name}
          </Link>
        </h3>

        {product.shortDescription ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-glex-green-800/70">
            {product.shortDescription}
          </p>
        ) : null}

        <dl className="mt-4 space-y-1.5 text-sm">
          {product.brand ? (
            <div className="flex gap-2">
              <dt className="text-glex-green-800/60">{t('brand')}:</dt>
              <dd className="font-medium">{product.brand}</dd>
            </div>
          ) : null}

          {product.minimumOrderQty ? (
            <div className="flex items-center gap-2">
              <Package className="size-3.5 shrink-0 text-glex-green-400" aria-hidden="true" />
              <dt className="text-glex-green-800/60">{t('moq')}:</dt>
              <dd className="font-medium">{product.minimumOrderQty}</dd>
            </div>
          ) : null}

          {product.countryOfOrigin ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-glex-green-400" aria-hidden="true" />
              <dd className="font-medium">{product.countryOfOrigin}</dd>
            </div>
          ) : null}
        </dl>

        {/* Prices are never shown — this is an RFQ catalogue. */}
        <p className="mt-4 text-sm font-semibold text-glex-gold-700">{t('priceOnRequest')}</p>

        <div className="mt-4 pt-1">
          <AddToRfqButton productId={product.id} fullWidth className="w-full" />
        </div>
      </div>
    </Card>
  )
}
