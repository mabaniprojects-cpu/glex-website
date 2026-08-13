import { Info } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

const VARIANT_STYLES = {
  info: 'bg-glex-green-700 text-white',
  warning: 'bg-glex-gold-400 text-glex-green-900',
  success: 'bg-glex-green-600 text-white',
} as const

/**
 * Editable announcement bar (admin-managed). Renders nothing when no
 * announcement is active or within its scheduled window.
 */
export async function AnnouncementBar() {
  const locale = await getLocale()

  const announcement = await db.announcement
    .findFirst({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: { translations: { where: { locale: toDbLocale(locale) } } },
    })
    // The header must still render if the database is unreachable.
    .catch(() => null)

  if (!announcement) return null

  const message = announcement.translations[0]?.message ?? announcement.message
  const variant =
    announcement.variant in VARIANT_STYLES
      ? (announcement.variant as keyof typeof VARIANT_STYLES)
      : 'info'

  return (
    <div className={cn('text-sm', VARIANT_STYLES[variant])}>
      <div className="container-glex flex min-h-11 items-center justify-center gap-2 py-2 text-center">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {announcement.href ? (
          <Link
            // Admin-authored destination, so it cannot be checked against the
            // static route table.
            href={announcement.href as Parameters<typeof Link>[0]['href']}
            className="font-medium underline-offset-4 hover:underline"
          >
            {message}
          </Link>
        ) : (
          <span className="font-medium">{message}</span>
        )}
      </div>
    </div>
  )
}
