import { Download, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listMyDocuments } from '@/lib/dashboard'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Human-readable size. Files here are documents, so KB/MB is enough. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Documents belonging to the signed-in user's organization.
 *
 * The list is scoped by the session's own `organizationId`. The download itself
 * is authorised again by `/api/files/[id]`, which answers an unauthorised
 * caller with 404 rather than 403 so ids cannot be probed — this page never
 * becomes the only thing standing between a file and the wrong reader.
 */
export default async function DashboardDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  const dash = await getTranslations('dashboard')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listMyDocuments(user, { take, skip })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.documents')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{dash('documentsIntro')}</p>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle p-4"
            >
              <FileText className="size-5 shrink-0 text-glex-green-600" aria-hidden="true" />

              <div className="min-w-0">
                <p className="font-medium">{file.originalName}</p>
                <p className="mt-0.5 text-xs text-glex-green-800/60">
                  {formatSize(file.size)} ·{' '}
                  {formatDate(file.createdAt, locale, { dateStyle: 'medium' })}
                </p>
              </div>

              <Button asChild variant="outline" size="sm" className="ms-auto">
                <a href={`/api/files/${file.id}`}>
                  <Download className="size-4" aria-hidden="true" />
                  {common('save')}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/dashboard/documents', rawParams, target)}
      />
    </div>
  )
}
