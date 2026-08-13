import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupplierDecisionForm } from '@/components/admin/supplier-decision'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { getSupplierForAdmin } from '@/lib/admin'
import { can } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminSupplierDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requirePermission('supplier:read:all')

  const profile = await getSupplierForAdmin(id)
  if (!profile) notFound()

  const supplier = await getTranslations('supplier')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const facts: Array<{ label: string; value: string | null }> = [
    { label: supplier('legalName'), value: profile.legalName },
    { label: supplier('tradingName'), value: profile.tradingName },
    { label: supplier('country'), value: [profile.city, profile.country].filter(Boolean).join(', ') },
    { label: supplier('crNumber'), value: profile.crNumber },
    { label: supplier('vatNumber'), value: profile.vatNumber },
    { label: supplier('website'), value: profile.website },
    {
      label: supplier('yearEstablished'),
      value: profile.yearEstablished ? String(profile.yearEstablished) : null,
    },
    { label: supplier('employeeCount'), value: profile.employeeCount },
    { label: supplier('monthlyCapacity'), value: profile.monthlyCapacity },
    { label: supplier('exportExperience'), value: profile.exportExperience },
  ]

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/suppliers"
          className="text-sm text-glex-green-700 underline-offset-4 hover:underline"
        >
          ← {admin('nav.suppliers')}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold sm:text-3xl">{profile.legalName}</h1>
          <span className="rounded-full border border-border-subtle px-2.5 py-1 text-xs font-semibold">
            {supplier(`status.${profile.status}`)}
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
            {facts
              .filter((fact) => fact.value)
              .map((fact) => (
                <div key={fact.label}>
                  <dt className="text-sm text-glex-green-800/60">{fact.label}</dt>
                  <dd className="mt-0.5 font-medium">{fact.value}</dd>
                </div>
              ))}
            <div>
              <dt className="text-sm text-glex-green-800/60">{supplier('profileCompletion')}</dt>
              <dd className="mt-0.5 font-medium" dir="ltr">
                {profile.completionPercent}%
              </dd>
            </div>
            {profile.submittedAt ? (
              <div>
                <dt className="text-sm text-glex-green-800/60">{common('date')}</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(profile.submittedAt, locale, { dateStyle: 'medium' })}
                </dd>
              </div>
            ) : null}
          </dl>

          {profile.description ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('companyDescription')}</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-glex-green-800/85">
                {profile.description}
              </p>
            </section>
          ) : null}

          {profile.categories.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('productCategories')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.categories.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md bg-surface-muted px-2.5 py-1 text-sm"
                  >
                    {entry.category.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">{supplier('stepDocuments')}</h2>
            {profile.documents.length === 0 ? (
              <p className="mt-2 text-glex-green-800/70">{common('noResults')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle p-3 text-sm"
                  >
                    <span>{document.label ?? document.file.originalName}</span>
                    <a
                      href={`/api/files/${document.fileId}`}
                      className="text-glex-green-700 underline-offset-4 hover:underline"
                    >
                      {common('save')}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold">{supplier('stepContacts')}</h2>
            {profile.contacts.length === 0 ? (
              <p className="mt-2 text-glex-green-800/70">{common('noResults')}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {profile.contacts.map((person) => (
                  <li key={person.id} className="rounded-lg border border-border-subtle p-3">
                    <p className="font-medium">
                      {person.name} — {person.kind}
                    </p>
                    <p className="text-glex-green-800/70" dir="ltr">
                      {person.email}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="lg:col-span-1">
          {can(user.role, 'supplier:approve') ? (
            <SupplierDecisionForm supplierId={profile.id} currentStatus={profile.status} />
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
