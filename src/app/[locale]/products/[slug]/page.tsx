import { Download, FileText, ImageOff } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section, SectionHeading } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { AddToRfqButton } from '@/components/marketplace/add-to-rfq-button'
import { ProductCard } from '@/components/marketplace/product-card'
import { routing, type AppLocale } from '@/i18n/routing'
import { getProductBySlug, getRelatedProducts, parseSpecifications } from '@/lib/catalogue'
import { truncate } from '@/lib/utils'

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}

  const product = await getProductBySlug(slug, locale as AppLocale)
  if (!product) return {}

  const description = product.displayShortDescription
    ? truncate(product.displayShortDescription, 155)
    : undefined

  return {
    title: product.displayName,
    description,
    alternates: { canonical: `/${locale}/products/${slug}` },
    openGraph: {
      title: product.displayName,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const product = await getProductBySlug(slug, locale as AppLocale)
  if (!product) notFound()

  const t = await getTranslations('marketplace')
  const nav = await getTranslations('nav')
  const units = await getTranslations('units')
  const rfq = await getTranslations('rfq')

  const specifications = parseSpecifications(product.specifications)
  const related = await getRelatedProducts(product.id, product.categoryId, locale as AppLocale)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  /**
   * Product structured data.
   *
   * `offers` is deliberately omitted — there is no price, and asserting one
   * would be false. Search engines treat a Product without offers as valid.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.displayName,
    description: product.displayShortDescription ?? undefined,
    sku: product.slug,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    manufacturer: product.manufacturer
      ? { '@type': 'Organization', name: product.manufacturer }
      : undefined,
    countryOfOrigin: product.countryOfOrigin ?? undefined,
    category: product.categoryName,
    image: product.images.map((image) => `${appUrl}${image.url}`),
  }

  const facts: Array<{ label: string; value: string | null }> = [
    { label: t('brand'), value: product.brand },
    { label: t('manufacturer'), value: product.manufacturer },
    { label: t('origin'), value: product.countryOfOrigin },
    { label: t('hsCode'), value: product.hsCode },
    { label: t('moq'), value: product.minimumOrderQty ? String(product.minimumOrderQty) : null },
    {
      label: t('leadTime'),
      value: product.leadTimeDays ? t('leadTimeDays', { days: product.leadTimeDays }) : null,
    },
    { label: t('packaging'), value: product.packaging },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        title={product.displayName}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/marketplace', label: nav('marketplace') },
          { href: `/marketplace/${product.category.slug}`, label: product.categoryName },
        ]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Media */}
          <div>
            <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-surface-muted">
              {product.images[0] ? (
                <Image
                  src={product.images[0].url}
                  alt={product.images[0].alt ?? product.displayName}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  priority={false}
                  loading="eager"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-glex-green-200">
                  <ImageOff className="size-16" aria-hidden="true" />
                </span>
              )}
            </div>

            {product.images.length > 1 ? (
              <ul className="mt-3 grid grid-cols-4 gap-3">
                {product.images.slice(1, 5).map((image) => (
                  <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-muted">
                    <Image
                      src={image.url}
                      alt={image.alt ?? product.displayName}
                      fill
                      sizes="12vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Commercial summary */}
          <div>
            <p className="text-sm font-medium tracking-wide text-glex-green-500 uppercase">
              {product.categoryName}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {product.isSaudiMade ? (
                <span className="rounded-full bg-glex-green-600 px-3 py-1 text-xs font-semibold text-white">
                  {t('saudiMade')}
                </span>
              ) : null}
              {product.allowEquivalents ? (
                <span className="rounded-full bg-glex-green-50 px-3 py-1 text-xs font-semibold text-glex-green-700">
                  {t('equivalentsAccepted')}
                </span>
              ) : null}
            </div>

            {product.displayShortDescription ? (
              <p className="mt-5 text-lg leading-relaxed text-glex-green-800/80">
                {product.displayShortDescription}
              </p>
            ) : null}

            {/* No price is ever shown. */}
            <p className="mt-6 text-lg font-bold text-glex-gold-700">{t('priceOnRequest')}</p>

            <div className="mt-5">
              <AddToRfqButton productId={product.id} variant="gold" size="lg" />
            </div>

            <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-border-subtle pt-6 sm:grid-cols-2">
              {facts
                .filter((fact) => fact.value)
                .map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-sm text-glex-green-800/60">{fact.label}</dt>
                    <dd className="mt-0.5 font-medium">{fact.value}</dd>
                  </div>
                ))}
            </dl>

            {product.availableUnits.length > 0 ? (
              <div className="mt-6">
                <p className="text-sm font-semibold">{rfq('unit')}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.availableUnits.map((unit) => (
                    <li
                      key={unit}
                      className="rounded-md bg-surface-muted px-2.5 py-1 text-sm text-glex-green-800"
                    >
                      {units(unit)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.certifications.length > 0 ? (
              <div className="mt-6">
                <p className="text-sm font-semibold">{t('certifications')}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.certifications.map((certification) => (
                    <li
                      key={certification}
                      className="rounded-md border border-border-subtle px-2.5 py-1 text-sm"
                    >
                      {certification}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Detail + specifications */}
      {product.displayDescription || specifications.length > 0 ? (
        <Section muted>
          <div className="grid gap-10 lg:grid-cols-2">
            {product.displayDescription ? (
              <div>
                <h2 className="text-xl font-bold">{nav('products')}</h2>
                <div className="mt-4 space-y-4 leading-relaxed whitespace-pre-line text-glex-green-800/85">
                  {product.displayDescription}
                </div>
              </div>
            ) : null}

            {specifications.length > 0 ? (
              <div>
                <h2 className="text-xl font-bold">{t('specifications')}</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">{t('specifications')}</caption>
                    <tbody>
                      {specifications.map((specification) => (
                        <tr key={specification.key} className="border-b border-border-subtle">
                          <th scope="row" className="py-3 pe-4 text-start font-medium text-glex-green-800/70">
                            {specification.key}
                          </th>
                          <td className="py-3 font-medium">
                            {specification.value}
                            {specification.unit ? ` ${specification.unit}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Downloads */}
      {product.documents.length > 0 ? (
        <Section>
          <SectionHeading title={t('downloads')} align="start" />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.documents.map((document) => (
              <li key={document.id}>
                <a
                  href={`/api/files/${document.fileId}`}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle p-4 transition-colors hover:bg-glex-green-50"
                >
                  <FileText className="size-5 shrink-0 text-glex-green-600" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium">
                    {document.label ?? document.file.originalName}
                  </span>
                  <Download className="size-4 shrink-0 text-glex-green-400" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Related */}
      {related.length > 0 ? (
        <Section muted>
          <SectionHeading title={t('relatedProducts')} align="start" />
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  )
}
