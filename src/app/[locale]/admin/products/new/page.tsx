import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { EMPTY_PRODUCT, ProductForm } from '@/components/admin/product-form'
import { routing } from '@/i18n/routing'
import { listCategoriesForAdmin } from '@/lib/admin'
import { requireStaffPermission } from '@/lib/auth-guards'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requireStaffPermission('product:write')

  const admin = await getTranslations('admin')
  const categories = await listCategoriesForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('newProduct')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('noPriceNotice')}</p>

      <ProductForm
        initial={EMPTY_PRODUCT}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        canDelete={false}
      />
    </div>
  )
}
