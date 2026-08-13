import {
  AlertTriangle,
  Bell,
  Bookmark,
  FilePlus2,
  FileText,
  Search,
  Ship,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ShipmentStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getDashboardSummary, listRecentShipmentEvents } from '@/lib/dashboard'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  const t = await getTranslations('dashboard')
  const tracking = await getTranslations('tracking')
  const nav = await getTranslations('nav')
  const common = await getTranslations('common')

  const [summary, events] = await Promise.all([
    getDashboardSummary(user),
    listRecentShipmentEvents(user),
  ])

  const cards: Array<{ label: string; value: number; icon: LucideIcon; href: string; alert?: boolean }> = [
    { label: t('activeRfqs'), value: summary.activeRfqs, icon: FileText, href: '/dashboard/rfqs' },
    {
      label: t('pendingClarifications'),
      value: summary.clarifications,
      icon: AlertTriangle,
      href: '/dashboard/rfqs',
      alert: summary.clarifications > 0,
    },
    {
      label: t('quotationsReceived'),
      value: summary.quotations,
      icon: FileText,
      href: '/dashboard/rfqs',
    },
    {
      label: t('activeShipments'),
      value: summary.activeShipments,
      icon: Ship,
      href: '/dashboard/shipments',
    },
    {
      label: t('savedProducts'),
      value: summary.savedProducts,
      icon: Bookmark,
      href: '/dashboard/saved',
    },
    {
      label: t('notifications'),
      value: summary.unreadNotifications,
      icon: Bell,
      href: '/dashboard/notifications',
      alert: summary.unreadNotifications > 0,
    },
  ]

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t('welcome', { name: user.name ?? user.email })}
        </h1>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="gold">
            <Link href="/rfq">
              <FilePlus2 className="size-4" aria-hidden="true" />
              {t('quickRfq')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tracking">
              <Search className="size-4" aria-hidden="true" />
              {t('quickTrack')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          {t('title')}
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.label}>
              <Link
                href={card.href as Parameters<typeof Link>[0]['href']}
                className="block rounded-xl transition-shadow hover:shadow-md"
              >
                <Card className={card.alert ? 'border-glex-gold-300 bg-glex-gold-50' : undefined}>
                  <CardContent className="flex items-center gap-4 p-5 pt-5">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-glex-green-600 text-white">
                      <card.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-2xl font-bold text-glex-green-900">
                        {card.value}
                      </span>
                      <span className="block text-sm text-glex-green-800/70">{card.label}</span>
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent shipment activity */}
      <section aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-xl font-bold">
          {t('recentEvents')}
        </h2>

        {events.length === 0 ? (
          <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
        ) : (
          <ol className="mt-5 space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle p-4"
              >
                <ShipmentStatusBadge
                  status={event.status}
                  label={tracking(`status.${event.status}`)}
                />
                <span className="font-medium">{event.title}</span>
                <span className="text-sm text-glex-green-800/60">
                  <Link
                    href={
                      `/dashboard/shipments/${event.shipment.reference}` as Parameters<
                        typeof Link
                      >[0]['href']
                    }
                    className="font-mono underline-offset-4 hover:underline"
                    dir="ltr"
                  >
                    {event.shipment.reference}
                  </Link>
                </span>
                <time
                  dateTime={event.occurredAt.toISOString()}
                  className="ms-auto text-sm text-glex-green-800/60"
                >
                  {formatDate(event.occurredAt, locale, { dateStyle: 'medium' })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-sm text-glex-green-800/60">
        {nav('contact')} —{' '}
        <Link href="/contact" className="text-glex-green-700 underline-offset-4 hover:underline">
          {nav('contact')}
        </Link>
      </p>
    </div>
  )
}
