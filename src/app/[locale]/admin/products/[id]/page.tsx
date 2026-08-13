import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/product-form'
import { TranslationEditor } from '@/components/admin/translation-editor'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getProductForAdmin, listCategoriesForAdmin } from '@/lib/admin'
import { requireStaffPermission } from '@/lib/auth-guards'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireStaffPermission('product:write')

  const admin = await getTranslations('admin')
  const [product, categories] = await Promise.all([
    getProductForAdmin(id),
    listCategoriesForAdmin(),
  ])

  // A soft-deleted or unknown id is a plain 404 — ids must not be probeable.
  if (!product) notFound()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{product.name}</h1>
        <Link
          href={`/products/${product.slug}` as Parameters<typeof Link>[0]['href']}
          className="text-sm font-medium text-glex-green-700 underline-offset-4 hover:underline"
        >
          {admin('viewPublicPage')}
        </Link>
      </div>

      <ProductForm
        initial={{
          id: product.id,
          name: product.name,
          categoryId: product.categoryId,
          shortDescription: product.shortDescription ?? '',
          description: product.description ?? '',
          brand: product.brand ?? '',
          manufacturer: product.manufacturer ?? '',
          countryOfOrigin: product.countryOfOrigin ?? '',
          hsCode: product.hsCode ?? '',
          packaging: product.packaging ?? '',
          minimumOrderQty: product.minimumOrderQty?.toString() ?? '',
          leadTimeDays: product.leadTimeDays?.toString() ?? '',
          isSaudiMade: product.isSaudiMade,
          allowEquivalents: product.allowEquivalents,
          isVisible: product.isVisible,
          isFeatured: product.isFeatured,
          availableUnits: product.availableUnits,
          certifications: product.certifications.join('\n'),
        }}
        categories={categories.map(({ id: categoryId, name }) => ({ id: categoryId, name }))}
        canDelete={can(user.role, 'product:write')}
      />

      {/* Translating is a narrower permission than editing the product. */}
      {can(user.role, 'translation:write') ? (
        <div className="mt-10">
          <TranslationEditor
            kind="product"
            entityId={product.id}
            source={{
              name: product.name,
              shortDescription: product.shortDescription ?? '',
              description: product.description ?? '',
            }}
            existing={product.translations}
            labels={{
              name: admin('translations.fieldName'),
              shortDescription: admin('translations.fieldShortDescription'),
              description: admin('translations.fieldDescription'),
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
