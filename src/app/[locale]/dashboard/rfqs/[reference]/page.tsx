import { Download, FileText, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RfqStatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getMyRfq } from '@/lib/dashboard'
import { QuotationDecision, RfqReplyForm } from '@/components/dashboard/rfq-conversation'
import { isRfqClosed } from '@/lib/rfq-status'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  // Scoped in SQL. An RFQ belonging to another organization returns null and
  // renders a plain 404 — never a "forbidden" that would confirm it exists.
  const rfq = await getMyRfq(user, reference)
  if (!rfq) notFound()

  const t = await getTranslations('rfq')
  const dash = await getTranslations('dashboard')
  const common = await getTranslations('common')
  const units = await getTranslations('units')

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/dashboard/rfqs"
          className="text-sm text-glex-green-700 underline-offset-4 hover:underline"
        >
          ← {dash('nav.rfqs')}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="font-mono text-2xl font-bold sm:text-3xl" dir="ltr">
            {rfq.reference}
          </h1>
          <RfqStatusBadge status={rfq.status} label={t(`status.${rfq.status}`)} />
        </div>
      </div>

      {/* Summary */}
      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-glex-green-800/60">{t('destination')}</dt>
          <dd className="mt-0.5 font-medium">
            {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
          </dd>
        </div>
        {rfq.destinationPort ? (
          <div>
            <dt className="text-sm text-glex-green-800/60">{t('destinationPort')}</dt>
            <dd className="mt-0.5 font-medium">{rfq.destinationPort}</dd>
          </div>
        ) : null}
        {rfq.incoterm ? (
          <div>
            <dt className="text-sm text-glex-green-800/60">{t('incoterm')}</dt>
            <dd className="mt-0.5 font-medium">{rfq.incoterm}</dd>
          </div>
        ) : null}
        {rfq.projectName ? (
          <div>
            <dt className="text-sm text-glex-green-800/60">{t('projectName')}</dt>
            <dd className="mt-0.5 font-medium">{rfq.projectName}</dd>
          </div>
        ) : null}
        {rfq.requiredDeliveryDate ? (
          <div>
            <dt className="text-sm text-glex-green-800/60">{t('deliveryDate')}</dt>
            <dd className="mt-0.5 font-medium">
              {formatDate(rfq.requiredDeliveryDate, locale, { dateStyle: 'medium' })}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-glex-green-800/60">{common('date')}</dt>
          <dd className="mt-0.5 font-medium">
            {formatDate(rfq.submittedAt ?? rfq.createdAt, locale, { dateStyle: 'medium' })}
          </dd>
        </div>
      </dl>

      {/* Line items */}
      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="text-xl font-bold">
          {t('items')}
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('items')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {t('itemName')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {t('quantity')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {t('unit')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {t('preferredBrands')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item) => (
                <tr key={item.id} className="border-b border-border-subtle">
                  <td className="py-3 pe-4 font-medium">{item.name}</td>
                  <td className="py-3 pe-4" dir="ltr">
                    {String(item.quantity)}
                  </td>
                  <td className="py-3 pe-4">{units(item.unit)}</td>
                  <td className="py-3">{item.brand ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quotations */}
      {rfq.quotations.length > 0 ? (
        <section aria-labelledby="quotations-heading">
          <h2 id="quotations-heading" className="text-xl font-bold">
            {t('quotations')}
          </h2>
          <ul className="mt-4 space-y-3">
            {rfq.quotations.map((quotation) => (
              <li
                key={quotation.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle p-4"
              >
                <FileText className="size-5 shrink-0 text-glex-green-600" aria-hidden="true" />
                <span className="font-mono text-sm font-medium" dir="ltr">
                  {quotation.reference}
                </span>
                {quotation.validUntil ? (
                  <span className="text-sm text-glex-green-800/70">
                    {t('validUntil')}: {formatDate(quotation.validUntil, locale, { dateStyle: 'medium' })}
                  </span>
                ) : null}
                {quotation.fileId ? (
                  <Button asChild variant="outline" size="sm" className="ms-auto">
                    <a href={`/api/files/${quotation.fileId}`}>
                      <Download className="size-4" aria-hidden="true" />
                      {common('save')}
                    </a>
                  </Button>
                ) : null}

                {/* Answered once and once only — the outcome is shown instead
                    of controls that would silently overwrite it. */}
                {quotation.acceptedAt ? (
                  <span className="w-full text-sm font-medium text-glex-green-700">
                    {t('quotationAccepted')}
                  </span>
                ) : quotation.rejectedAt ? (
                  <span className="w-full text-sm font-medium text-glex-green-800/70">
                    {t('quotationDeclined')}
                  </span>
                ) : (
                  <QuotationDecision quotationId={quotation.id} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Messages — internal staff notes are excluded by the query. */}
      <section aria-labelledby="messages-heading">
        <h2 id="messages-heading" className="text-xl font-bold">
          {t('messages')}
        </h2>

        {rfq.messages.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-glex-green-800/70">
            <MessageSquare className="size-4" aria-hidden="true" />
            {common('noResults')}
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {rfq.messages.map((message) => (
              <li key={message.id} className="rounded-lg border border-border-subtle p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{message.author?.name ?? 'GLEX'}</span>
                  <time
                    dateTime={message.createdAt.toISOString()}
                    className="text-glex-green-800/60"
                  >
                    {formatDate(message.createdAt, locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <p className="mt-2 leading-relaxed whitespace-pre-line">{message.body}</p>
              </li>
            ))}
          </ol>
        )}

        {/* A closed request keeps its history but takes no new messages. */}
        {isRfqClosed(rfq.status) ? (
          <p className="mt-6 rounded-lg bg-surface-muted p-3 text-sm text-glex-green-800/70">
            {t('errorClosed')}
          </p>
        ) : (
          <RfqReplyForm reference={rfq.reference} />
        )}
      </section>

      {/* Activity history */}
      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-xl font-bold">
          {t('activity')}
        </h2>
        <ol className="mt-4 space-y-2 text-sm">
          {rfq.activities.map((activity) => (
            <li
              key={activity.id}
              className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-2"
            >
              <span className="font-medium">
                {activity.toStatus ? t(`status.${activity.toStatus}`) : activity.action}
              </span>
              {activity.actor?.name ? (
                <span className="text-glex-green-800/60">{activity.actor.name}</span>
              ) : null}
              <time
                dateTime={activity.createdAt.toISOString()}
                className="ms-auto text-glex-green-800/60"
              >
                {formatDate(activity.createdAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
