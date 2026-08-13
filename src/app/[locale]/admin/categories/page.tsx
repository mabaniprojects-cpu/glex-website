import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { CategoryManager } from '@/components/admin/category-manager'
import { routing } from '@/i18n/routing'
import { listCategoriesForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('category:write')

  const admin = await getTranslations('admin')
  const rows = await listCategoriesForAdmin()

  // Flatten the relation counts: the client component takes plain data only.
  const categories = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    parentId: row.parentId,
    parent: row.parent,
    productCount: row._count.products,
    childCount: row._count.children,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.categories')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('categoriesIntro')}</p>

      <CategoryManager categories={categories} />
    </div>
  )
}
