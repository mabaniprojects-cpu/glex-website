import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { routing } from '@/i18n/routing'
import { deleteNewsCategory, saveNewsCategory } from '@/lib/actions/news-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminNewsCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('news:write')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const categories = await db.newsCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      _count: { select: { articles: true } },
    },
  })

  const fields: FieldSpec[] = [
    {
      name: 'name',
      label: admin('newsCategories.name'),
      kind: 'text',
      required: true,
      maxLength: 100,
      wide: true,
      description: admin('newsCategories.slugHint'),
    },
    { name: 'sortOrder', label: admin('sortOrder'), kind: 'number' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.newsCategories')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">
        {admin('newsCategories.intro')}
      </p>

      <RecordEditor
        records={categories.map((row) => ({
          id: row.id,
          title: row.name,
          // The article count is the reason a delete will be refused, so it is
          // shown rather than discovered on a rejected click.
          subtitle: `/${row.slug} · ${admin('newsCategories.articleCount', {
            count: row._count.articles,
          })}`,
          values: {
            name: row.name,
            sortOrder: String(row.sortOrder),
          },
        }))}
        fields={fields}
        blank={{ name: '', sortOrder: '0' }}
        labels={{
          add: admin('newsCategories.add'),
          edit: admin('newsCategories.edit'),
          empty: common('noResults'),
        }}
        save={saveNewsCategory}
        remove={deleteNewsCategory}
      />
    </div>
  )
}
