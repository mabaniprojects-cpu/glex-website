import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ArticleForm, EMPTY_ARTICLE } from '@/components/admin/article-form'
import { routing } from '@/i18n/routing'
import { listNewsCategoriesForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('news:write')

  const admin = await getTranslations('admin')
  const categories = await listNewsCategoriesForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('newArticle')}</h1>

      <ArticleForm
        initial={EMPTY_ARTICLE}
        categories={categories}
        canPublish={can(user.role, 'news:publish')}
        canDelete={false}
      />
    </div>
  )
}
