import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ArticleForm } from '@/components/admin/article-form'
import { TranslationEditor } from '@/components/admin/translation-editor'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getNewsForAdmin, listNewsCategoriesForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { can } from '@/lib/rbac'
import { toDateTimeLocalInput } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('news:write')

  const admin = await getTranslations('admin')
  const [article, categories] = await Promise.all([
    getNewsForAdmin(id),
    listNewsCategoriesForAdmin(),
  ])

  // An unknown or soft-deleted id is a plain 404 — ids must not be probeable.
  if (!article) notFound()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{article.title}</h1>
        {article.status === 'PUBLISHED' ? (
          <Link
            href={`/news/${article.slug}` as Parameters<typeof Link>[0]['href']}
            className="text-sm font-medium text-glex-green-700 underline-offset-4 hover:underline"
          >
            {admin('viewPublicPage')}
          </Link>
        ) : null}
      </div>

      <ArticleForm
        initial={{
          id: article.id,
          title: article.title,
          summary: article.summary,
          body: article.body,
          categoryId: article.categoryId ?? '',
          status: article.status,
          publishedAt: toDateTimeLocalInput(article.publishedAt),
          isFeatured: article.isFeatured,
          featuredImage: article.featuredImage ?? '',
          seoTitle: article.seoTitle ?? '',
          seoDescription: article.seoDescription ?? '',
        }}
        categories={categories}
        canPublish={can(user.role, 'news:publish')}
        canDelete={can(user.role, 'news:write')}
      />

      {/* Translating is a narrower permission than authoring the article. */}
      {can(user.role, 'translation:write') ? (
        <div className="mt-10">
          <TranslationEditor
            kind="article"
            entityId={article.id}
            source={{
              title: article.title,
              summary: article.summary,
              body: article.body,
              seoTitle: article.seoTitle ?? '',
              seoDescription: article.seoDescription ?? '',
            }}
            existing={article.translations}
            labels={{
              title: admin('translations.fieldTitle'),
              summary: admin('translations.fieldSummary'),
              body: admin('translations.fieldBody'),
              seoTitle: admin('translations.fieldSeoTitle'),
              seoDescription: admin('translations.fieldSeoDescription'),
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
