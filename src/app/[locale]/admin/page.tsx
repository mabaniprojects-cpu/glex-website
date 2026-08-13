import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireStaff } from '@/lib/auth-guards'
import { getAdminMetrics } from '@/lib/admin'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireStaff()

  const t = await getTranslations('admin')
  const rfq = await getTranslations('rfq')
  const common = await getTranslations('common')

  const metrics = await getAdminMetrics()

  const cards = [
    { label: t('metrics.newClients'), value: metrics.newClients, href: '/admin' },
    { label: t('metrics.newSuppliers'), value: metrics.newSuppliers, href: '/admin/suppliers' },
    {
      label: t('metrics.pendingApprovals'),
      value: metrics.pendingApprovals,
      href: '/admin/suppliers',
      alert: metrics.pendingApprovals > 0,
    },
    { label: t('metrics.submittedRfqs'), value: metrics.openRfqs, href: '/admin/rfqs' },
    {
      label: t('metrics.activeShipments'),
      value: metrics.activeShipments,
      href: '/admin/shipments',
    },
    {
      label: t('metrics.delayedShipments'),
      value: metrics.delayedShipments,
      href: '/admin/shipments',
      alert: metrics.delayedShipments > 0,
    },
    {
      label: t('metrics.contactRequests'),
      value: metrics.openInquiries,
      href: '/admin/inquiries',
      alert: metrics.openInquiries > 0,
    },
  ]

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 text-glex-green-800/70">{user.name ?? user.email}</p>
      </div>

      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          {t('title')}
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.label}>
              <Link
                href={card.href as Parameters<typeof Link>[0]['href']}
                className="block rounded-xl transition-shadow hover:shadow-md"
              >
                <Card className={cn(card.alert && 'border-glex-gold-300 bg-glex-gold-50')}>
                  <CardContent className="p-5 pt-5">
                    <span className="block text-3xl font-bold text-glex-green-900">
                      {card.value}
                    </span>
                    <span className="mt-1 block text-sm text-glex-green-800/70">{card.label}</span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* RFQ distribution — a plain table rather than a chart, so the numbers
          are readable by screen readers and without colour perception. */}
      <section aria-labelledby="rfq-status-heading">
        <h2 id="rfq-status-heading" className="text-xl font-bold">
          {t('nav.rfqs')}
        </h2>

        {metrics.rfqsByStatus.length === 0 ? (
          <p className="mt-4 text-glex-green-800/70">—</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full max-w-xl border-collapse text-sm">
              <caption className="sr-only">{t('nav.rfqs')}</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="py-2 pe-4 text-start font-semibold">
                    {common('status')}
                  </th>
                  {/* Count column; "#" reads correctly in every locale. */}
                  <th scope="col" className="py-2 text-start font-semibold">
                    #
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.rfqsByStatus.map((row) => (
                  <tr key={row.status} className="border-b border-border-subtle">
                    <td className="py-2.5 pe-4">{rfq(`status.${row.status}`)}</td>
                    <td className="py-2.5 font-semibold" dir="ltr">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
