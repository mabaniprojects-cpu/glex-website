import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupplierImport } from '@/components/admin/supplier-import'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Importing one supplier's data sheet.
 *
 * Scoped to a supplier rather than sitting under Products, so every product
 * and price it creates is attributed without anyone picking from a dropdown.
 * `Product.supplierId` is what later confines a supplier's own edits to their
 * own rows, and an import that guessed it would quietly break that.
 */
export default async function SupplierImportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // Writing products is the permission that matters here; reading suppliers
  // is not enough to add fifty of them to the catalogue.
  await requirePermission('product:write')

  const supplier = await db.supplierProfile.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, legalName: true },
  })
  if (!supplier) notFound()

  const t = await getTranslations('admin.import')
  const admin = await getTranslations('admin')

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-glex-green-800/70 mb-4 text-sm">
        <Link href="/admin/suppliers" className="hover:underline">
          {admin('nav.suppliers')}
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link
          href={`/admin/suppliers/${supplier.id}` as Parameters<typeof Link>[0]['href']}
          className="hover:underline"
        >
          {supplier.legalName}
        </Link>
      </nav>

      <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
      <p className="text-glex-green-800/70 mt-1 text-sm">{supplier.legalName}</p>

      <div className="mt-8">
        <SupplierImport supplierId={supplier.id} />
      </div>
    </div>
  )
}
