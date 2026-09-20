import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RfqAdminControls } from '@/components/admin/rfq-controls'
import { IssueQuotationForm, StaffReplyForm } from '@/components/admin/rfq-quotation-controls'
import { RfqWorkflowPanel } from '@/components/admin/rfq-workflow-panel'
import { RfqStatusBadge } from '@/components/dashboard/status-badge'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { getRfqForAdmin, listAssignableStaff } from '@/lib/admin'
import { can, worksTheWorkflow } from '@/lib/rbac'
import { availableActions, isWaitingOn, TECHNICAL_ORDER_THRESHOLD_USD } from '@/lib/rfq-workflow'
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
  // Every desk in the internal process sees the panel; what it offers depends
  // on the role and on where the file has reached.
  const onTheWorkflow = worksTheWorkflow(user.role)
  const workflowState = {
    workflowStage: rfq.workflowStage,
    procurementStatus: rfq.procurementStatus,
    shippingStatus: rfq.shippingStatus,
    orderClass: rfq.orderClass,
  }
  const formatMoney = (amount: { toString(): string }, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      Number(amount.toString())
    )
  const canAssign = can(user.role, 'rfq:assign')
  const canQuote = can(user.role, 'rfq:quote')
  const staff = canAssign ? await listAssignableStaff() : []

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/rfqs"
          className="text-glex-green-700 text-sm underline-offset-4 hover:underline"
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
          <dl className="border-border-subtle grid gap-x-8 gap-y-4 rounded-xl border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-glex-green-800/60 text-sm">{contact('company')}</dt>
              <dd className="mt-0.5 font-medium">
                {rfq.organization?.name ?? rfq.guestCompany ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-glex-green-800/60 text-sm">{contact('fullName')}</dt>
              <dd className="mt-0.5 font-medium">{rfq.createdBy?.name ?? rfq.guestName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-glex-green-800/60 text-sm">{contact('email')}</dt>
              <dd className="mt-0.5 font-medium" dir="ltr">
                {rfq.createdBy?.email ?? rfq.guestEmail ?? '—'}
              </dd>
              {rfq.isGuest && !rfq.emailVerified ? (
                <dd className="text-glex-gold-800 mt-1 text-sm">{t('verifyRequired')}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-glex-green-800/60 text-sm">{t('destination')}</dt>
              <dd className="mt-0.5 font-medium">
                {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
              </dd>
            </div>
            {rfq.incoterm ? (
              <div>
                <dt className="text-glex-green-800/60 text-sm">{t('incoterm')}</dt>
                <dd className="mt-0.5 font-medium">{rfq.incoterm}</dd>
              </div>
            ) : null}
            {rfq.projectName ? (
              <div>
                <dt className="text-glex-green-800/60 text-sm">{t('projectName')}</dt>
                <dd className="mt-0.5 font-medium">{rfq.projectName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-glex-green-800/60 text-sm">{common('date')}</dt>
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
                  <tr className="border-border-subtle border-b">
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
                    <tr key={item.id} className="border-border-subtle border-b">
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
              <p className="text-glex-green-800/70 mt-4">{common('noResults')}</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {rfq.messages.map((message) => (
                  <li
                    key={message.id}
                    className={
                      message.isInternal
                        ? 'border-glex-gold-300 bg-glex-gold-50 rounded-lg border p-4'
                        : 'border-border-subtle rounded-lg border p-4'
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{message.author?.name ?? 'GLEX'}</span>
                      {message.isInternal ? (
                        <span className="bg-glex-gold-200 text-glex-gold-900 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
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

          {/* What each desk contributed */}
          {onTheWorkflow ? (
            <section aria-labelledby="admin-workflow-history-heading">
              <h2 id="admin-workflow-history-heading" className="text-xl font-bold">
                {admin('workflow.history')}
              </h2>

              {rfq.workflowEntries.length === 0 ? (
                <p className="text-glex-green-800/70 mt-3 text-sm">{admin('workflow.noEntries')}</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {rfq.workflowEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="border-border-subtle rounded-xl border p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-semibold">
                          {admin(`workflow.tracks.${entry.track}` as 'workflow.tracks.INTAKE')}
                        </span>
                        {entry.amount ? (
                          <span className="text-glex-green-900 font-semibold" dir="ltr">
                            {formatMoney(entry.amount, entry.currency)}
                          </span>
                        ) : null}
                        <span className="text-glex-green-800/60">
                          {entry.author?.name ?? common('unknown')}
                        </span>
                        <time
                          dateTime={entry.createdAt.toISOString()}
                          className="text-glex-green-800/60 ms-auto"
                        >
                          {formatDate(entry.createdAt, locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </time>
                      </div>

                      {entry.note ? (
                        <p className="text-glex-green-800/85 mt-2 whitespace-pre-line">
                          {entry.note}
                        </p>
                      ) : null}

                      {entry.file ? (
                        <a
                          href={`/api/files/${entry.file.id}`}
                          className="text-glex-green-700 mt-2 inline-block underline-offset-4 hover:underline"
                        >
                          {entry.file.originalName}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          {/* Audit-friendly activity history */}
          <section aria-labelledby="admin-activity-heading">
            <h2 id="admin-activity-heading" className="text-xl font-bold">
              {t('activity')}
            </h2>
            <ol className="mt-4 space-y-2 text-sm">
              {rfq.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="border-border-subtle flex flex-wrap items-center gap-3 border-b pb-2"
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
                    className="text-glex-green-800/60 ms-auto"
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
          {onTheWorkflow ? (
            <RfqWorkflowPanel
              reference={rfq.reference}
              stage={rfq.workflowStage}
              procurementStatus={rfq.procurementStatus}
              shippingStatus={rfq.shippingStatus}
              orderClass={rfq.orderClass}
              technicalDueDate={rfq.technicalDueAt ? formatDate(rfq.technicalDueAt, locale) : null}
              estimatedValueUsd={
                rfq.estimatedValueUsd ? formatMoney(rfq.estimatedValueUsd, 'USD') : null
              }
              actions={availableActions(user.role, workflowState)}
              waitingOnYou={isWaitingOn(user.role, workflowState)}
              technicalThreshold={new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(TECHNICAL_ORDER_THRESHOLD_USD)}
            />
          ) : null}

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
          ) : null}
        </div>
      </div>
    </div>
  )
}
