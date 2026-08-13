import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RfqAdminControls } from '@/components/admin/rfq-controls'
import {
  IssueQuotationForm,
  StaffReplyForm,
} from '@/components/admin/rfq-quotation-controls'
import { RfqStatusBadge } from '@/components/dashboard/status-badge'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { getRfqForAdmin, listAssignableStaff } from '@/lib/admin'
import { can } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminRfqDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('rfq:read:all')

  const rfq = await getRfqForAdmin(reference)
  if (!rfq) notFound()

  const t = await getTranslations('rfq')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')
  const units = await getTranslations('units')
  const contact = await getTranslations('contact')

  const canManage = can(user.role, 'rfq:manage')
  const canAssign = can(user.role, 'rfq:assign')
  const canQuote = can(user.role, 'rfq:quote')
  const staff = canAssign ? await listAssignableStaff() : []

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/rfqs"
          className="text-sm text-glex-green-700 underline-offset-4 hover:underline"
        >
          ← {admin('nav.rfqs')}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="font-mono text-2xl font-bold sm:text-3xl" dir="ltr">
            {rfq.reference}
          </h1>
          <RfqStatusBadge status={rfq.status} label={t(`status.${rfq.status}`)} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Requester */}
          <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-glex-green-800/60">{contact('company')}</dt>
              <dd className="mt-0.5 font-medium">
                {rfq.organization?.name ?? rfq.guestCompany ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{contact('fullName')}</dt>
              <dd className="mt-0.5 font-medium">
                {rfq.createdBy?.name ?? rfq.guestName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{contact('email')}</dt>
              <dd className="mt-0.5 font-medium" dir="ltr">
                {rfq.createdBy?.email ?? rfq.guestEmail ?? '—'}
              </dd>
              {rfq.isGuest && !rfq.emailVerified ? (
                <dd className="mt-1 text-sm text-glex-gold-800">{t('verifyRequired')}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{t('destination')}</dt>
              <dd className="mt-0.5 font-medium">
                {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
              </dd>
            </div>
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
            <div>
              <dt className="text-sm text-glex-green-800/60">{common('date')}</dt>
              <dd className="mt-0.5 font-medium">
                {formatDate(rfq.submittedAt ?? rfq.createdAt, locale, { dateStyle: 'medium' })}
              </dd>
            </div>
          </dl>

          {/* Items */}
          <section aria-labelledby="admin-items-heading">
            <h2 id="admin-items-heading" className="text-xl font-bold">
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

          {/* Messages, including internal notes */}
          <section aria-labelledby="admin-messages-heading">
            <h2 id="admin-messages-heading" className="text-xl font-bold">
              {t('messages')}
            </h2>

            {rfq.messages.length === 0 ? (
              <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {rfq.messages.map((message) => (
                  <li
                    key={message.id}
                    className={
                      message.isInternal
                        ? 'rounded-lg border border-glex-gold-300 bg-glex-gold-50 p-4'
                        : 'rounded-lg border border-border-subtle p-4'
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{message.author?.name ?? 'GLEX'}</span>
                      {message.isInternal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-glex-gold-200 px-2 py-0.5 text-xs font-semibold text-glex-gold-900">
                          <Lock className="size-3" aria-hidden="true" />
                          {admin('internalNotes')}
                        </span>
                      ) : null}
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
          </section>

          {/* Audit-friendly activity history */}
          <section aria-labelledby="admin-activity-heading">
            <h2 id="admin-activity-heading" className="text-xl font-bold">
              {t('activity')}
            </h2>
            <ol className="mt-4 space-y-2 text-sm">
              {rfq.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-2"
                >
                  <span className="font-medium">{activity.action}</span>
                  {activity.fromStatus && activity.toStatus ? (
                    <span className="text-glex-green-800/70">
                      {t(`status.${activity.fromStatus}`)} → {t(`status.${activity.toStatus}`)}
                    </span>
                  ) : null}
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

        {/* Controls */}
        <div className="space-y-6 lg:col-span-1">
          {canManage ? (
            <>
              <RfqAdminControls
                reference={rfq.reference}
                currentStatus={rfq.status}
                currentAssigneeId={rfq.assignee?.id ?? null}
                staff={staff.map((person) => ({ id: person.id, name: person.name }))}
                canAssign={canAssign}
              />

              <StaffReplyForm reference={rfq.reference} />

              {/* Issuing an offer is a narrower permission than managing the
                  request, so it is gated separately. */}
              {canQuote ? <IssueQuotationForm reference={rfq.reference} /> : null}
            </>
          ) : (
            <p className="rounded-xl border border-border-subtle p-6 text-sm text-glex-green-800/70">
              {common('noResults')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
