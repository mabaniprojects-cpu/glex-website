import { Bell } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { listMyNotifications } from '@/lib/dashboard'
import { cn, formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()
  const t = await getTranslations('dashboard')

  const notifications = await listMyNotifications(user)

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{t('nav.notifications')}</h1>

      {notifications.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
          <Bell className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
          <p className="mt-4 text-glex-green-800/70">{t('noNotifications')}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={cn(
                'rounded-lg border p-4',
                notification.readAt
                  ? 'border-border-subtle'
                  : 'border-glex-green-200 bg-glex-green-50'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold">{notification.title}</p>
                <time
                  dateTime={notification.createdAt.toISOString()}
                  className="text-sm text-glex-green-800/60"
                >
                  {formatDate(notification.createdAt, locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
              {notification.body ? (
                <p className="mt-1.5 text-sm leading-relaxed text-glex-green-800/80">
                  {notification.body}
                </p>
              ) : null}
              {!notification.readAt ? (
                <span className="sr-only">{t('markAllRead')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
