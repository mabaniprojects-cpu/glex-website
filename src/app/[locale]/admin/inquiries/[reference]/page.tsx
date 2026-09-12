import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { InquiryAdminControls } from '@/components/admin/inquiry-controls'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { getInquiryForAdmin } from '@/lib/admin'
import { can } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * One contact enquiry, in full.
 *
 * This page is why it exists at all: the message a person wrote was captured
 * and then unreachable. It is absent from the list query, excluded from the
 * CSV export by design, and left out of the notification email on purpose —
 * so until now the only way to read an enquiry was a direct SQL query, while
 * the notification email told staff to look in the admin portal.
 */
export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('inquiry:read')

  const inquiry = await getInquiryForAdmin(reference)
  if (!inquiry) notFound()

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')
  const contact = await getTranslations('contact')

  // Reading and managing are separate permissions; a reader sees the enquiry
  // without the controls. The action re-checks server-side regardless.
  const canManage = can(user.role, 'inquiry:manage')

  const facts = [
    { label: contact('fullName'), value: inquiry.fullName, ltr: false },
    { label: contact('company'), value: inquiry.company, ltr: false },
    { label: contact('email'), value: inquiry.email, ltr: true, mailto: true },
    { label: contact('phone'), value: inquiry.phone, ltr: true },
    { label: contact('country'), value: inquiry.country, ltr: false },
    { label: common('date'), value: formatDate(inquiry.createdAt, locale), ltr: false },
  ]

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/inquiries"
          className="text-glex-green-700 text-sm underline-offset-4 hover:underline"
        >
          ← {admin('nav.inquiries')}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="font-mono text-2xl font-bold sm:text-3xl" dir="ltr">
            {inquiry.reference}
          </h1>
          <span className="border-border-subtle text-glex-green-800 rounded-full border px-3 py-1 text-sm">
            {contact(`status.${inquiry.status}`)}
          </span>
        </div>

        <p className="text-glex-green-800/70 mt-2 text-sm">{contact(`type.${inquiry.type}`)}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <dl className="border-border-subtle grid gap-x-8 gap-y-4 rounded-xl border p-6 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-glex-green-800/60 text-sm">{fact.label}</dt>
                <dd className="mt-0.5 font-medium" dir={fact.ltr ? 'ltr' : undefined}>
                  {fact.value ? (
                    fact.mailto ? (
                      <a
                        href={`mailto:${fact.value}`}
                        className="text-glex-green-700 underline-offset-4 hover:underline"
                      >
                        {fact.value}
                      </a>
                    ) : (
                      fact.value
                    )
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <section className="border-border-subtle rounded-xl border p-6">
            <h2 className="text-glex-green-800/60 text-sm">{contact('subject')}</h2>
            <p className="mt-1 text-lg font-semibold">{inquiry.subject}</p>

            <h2 className="text-glex-green-800/60 mt-6 text-sm">{contact('message')}</h2>
            {/*
              `whitespace-pre-wrap` because the message is plain text typed into
              a textarea: its paragraph breaks are newlines, and without this
              the whole enquiry collapses into one run-on block.
            */}
            <p className="mt-1 leading-relaxed whitespace-pre-wrap">{inquiry.message}</p>

            {inquiry.file ? (
              <p className="mt-6 text-sm">
                <span className="text-glex-green-800/60">{contact('attachment')}: </span>
                <a
                  href={`/api/files/${inquiry.file.id}`}
                  className="text-glex-green-700 underline-offset-4 hover:underline"
                >
                  {inquiry.file.originalName}
                </a>
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          {canManage ? (
            <div className="border-border-subtle rounded-xl border p-6">
              <InquiryAdminControls
                id={inquiry.id}
                currentStatus={inquiry.status}
                currentNotes={inquiry.internalNotes}
              />
            </div>
          ) : inquiry.internalNotes ? (
            <div className="border-border-subtle rounded-xl border p-6">
              <h2 className="text-glex-green-800/60 text-sm">{admin('internalNotes')}</h2>
              <p className="mt-1 text-sm whitespace-pre-wrap">{inquiry.internalNotes}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
