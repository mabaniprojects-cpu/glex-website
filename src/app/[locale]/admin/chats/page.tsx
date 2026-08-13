import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { listChatConversationsForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminChatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // Transcripts belong to support, not to settings.
  await requirePermission('ticket:manage')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)
  const escalatedOnly = rawParams.escalated === '1'

  const { items, total } = await listChatConversationsForAdmin({ take, skip, escalatedOnly })

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.chats')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('chats.intro')}</p>

      {/* A plain GET link, so the filtered view stays linkable. */}
      <p className="mt-4 text-sm">
        <Link
          href={escalatedOnly ? '/admin/chats' : '/admin/chats?escalated=1'}
          className="font-medium underline underline-offset-2"
        >
          {escalatedOnly ? admin('chats.showAll') : admin('chats.showEscalated')}
        </Link>
      </p>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border-subtle p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link
                      href={`/admin/chats/${item.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.title ?? admin('chats.untitled')}
                    </Link>
                    {item.handoffAt ? (
                      <span className="ms-2 rounded-full bg-glex-gold-100 px-2 py-0.5 text-xs font-medium text-glex-green-900">
                        {admin('chats.escalated')}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-xs text-glex-green-800/60">
                    {/* Anonymous visitors stay anonymous — the opaque cookie id
                        is deliberately not shown or selected. */}
                    {item.user?.name ?? admin('chats.anonymous')} · {item.locale} ·{' '}
                    {admin('chats.messageCount', { count: item._count.messages })}
                  </p>
                </div>

                <div className="text-end text-xs text-glex-green-800/60">
                  <p>{formatDate(item.updatedAt, locale)}</p>
                  {item.feedback !== null ? (
                    <p className="mt-1 font-medium">
                      {item.feedback > 0 ? admin('chats.helpful') : admin('chats.notHelpful')}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/admin/chats', rawParams, target)}
      />
    </div>
  )
}
