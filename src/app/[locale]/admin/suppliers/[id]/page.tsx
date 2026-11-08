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
  const importStrings = await getTranslations('admin.import')
  const common = await getTranslations('common')

  const facts: Array<{ label: string; value: string | null }> = [
    { label: supplier('legalName'), value: profile.legalName },
    { label: supplier('tradingName'), value: profile.tradingName },
    {
      label: supplier('country'),
      value: [profile.city, profile.country].filter(Boolean).join(', '),
    },
    { label: supplier('crNumber'), value: profile.crNumber },
    { label: supplier('vatNumber'), value: profile.vatNumber },
    { label: supplier('website'), value: profile.website },
    {
      label: supplier('yearEstablished'),
      value: profile.yearEstablished ? String(profile.yearEstablished) : null,
    },
    { label: supplier('employeeCount'), value: profile.employeeCount },
    /**
     * What the applicant said they do, and who sells it on their behalf.
     * The registration form asks both; a reviewer deciding whether to
     * approve a supplier needs to see the answers.
     */
    {
      label: supplier('manufacturingOrDistribution'),
      value:
        [
          profile.isManufacturer ? supplier('isManufacturer') : null,
          profile.isDistributor ? supplier('isDistributor') : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    { label: supplier('distributorName'), value: profile.distributorName },
    { label: supplier('monthlyCapacity'), value: profile.monthlyCapacity },
    { label: supplier('minimumOrderQuantities'), value: profile.minimumOrderNotes },
    { label: supplier('leadTimes'), value: profile.leadTimeNotes },
    { label: supplier('exportExperience'), value: profile.exportExperience },
    { label: supplier('brands'), value: profile.brands.join(', ') || null },
    { label: supplier('marketsServed'), value: profile.marketsServed.join(', ') || null },
    {
      label: supplier('availableIncoterms'),
      value: profile.availableIncoterms.join(', ') || null,
    },
  ]

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/suppliers"
          className="text-glex-green-700 text-sm underline-offset-4 hover:underline"
        >
          ← {admin('nav.suppliers')}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {/*
            Served through /api/files, which re-checks the caller on every
            request — so a plain <img>, not next/image, whose optimiser would
            fetch it without the session cookie and get a 404.
          */}
          {profile.organization?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.organization.logoUrl}
              alt=""
              className="border-border-subtle h-12 w-12 rounded-lg border bg-white object-contain p-1"
            />
          ) : null}

          <h1 className="text-2xl font-bold sm:text-3xl">{profile.legalName}</h1>
          <span className="border-border-subtle rounded-full border px-2.5 py-1 text-xs font-semibold">
            {supplier(`status.${profile.status}`)}
          </span>

          {/* Offered only to someone who could act on it; the page enforces
              the same permission rather than trusting this to hide it. */}
          {can(user.role, 'product:write') ? (
            <Link
              href={`/admin/suppliers/${profile.id}/import` as Parameters<typeof Link>[0]['href']}
              className="text-glex-green-700 text-sm font-medium underline-offset-4 hover:underline"
            >
              {importStrings('title')}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <dl className="border-border-subtle grid gap-x-8 gap-y-4 rounded-xl border p-6 sm:grid-cols-2">
            {facts
              .filter((fact) => fact.value)
              .map((fact) => (
                <div key={fact.label}>
                  <dt className="text-glex-green-800/60 text-sm">{fact.label}</dt>
                  <dd className="mt-0.5 font-medium">{fact.value}</dd>
                </div>
              ))}
            <div>
              <dt className="text-glex-green-800/60 text-sm">{supplier('profileCompletion')}</dt>
              <dd className="mt-0.5 font-medium" dir="ltr">
                {profile.completionPercent}%
              </dd>
            </div>
            {profile.submittedAt ? (
              <div>
                <dt className="text-glex-green-800/60 text-sm">{common('date')}</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(profile.submittedAt, locale, { dateStyle: 'medium' })}
                </dd>
              </div>
            ) : null}
          </dl>

          {profile.description ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('companyDescription')}</h2>
              <p className="text-glex-green-800/85 mt-2 leading-relaxed whitespace-pre-line">
                {profile.description}
              </p>
            </section>
          ) : null}

          {profile.categories.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('productCategories')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.categories.map((entry) => (
                  <li key={entry.id} className="bg-surface-muted rounded-md px-2.5 py-1 text-sm">
                    {entry.category.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/*
            Certificates were already fetched here and never rendered, so an
            applicant could tick SASO and four ISO standards and the reviewer
            deciding on them would see none of it.
          */}
          {profile.certifications.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('certifications')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.certifications.map((certification) => (
                  <li
                    key={certification.id}
                    className="bg-surface-muted rounded-md px-2.5 py-1 text-sm"
                    dir="ltr"
                  >
                    {certification.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.qualityControlNotes ? (
            <section>
              <h2 className="text-lg font-semibold">{supplier('qualityControl')}</h2>
              <p className="text-glex-green-800/85 mt-2 leading-relaxed whitespace-pre-line">
                {profile.qualityControlNotes}
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold">{supplier('stepDocuments')}</h2>
            {profile.documents.length === 0 ? (
              <p className="text-glex-green-800/70 mt-2">{common('noResults')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.documents.map((document) => (
                  <li
                    key={document.id}
                    className="border-border-subtle flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
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
              <p className="text-glex-green-800/70 mt-2">{common('noResults')}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {profile.contacts.map((person) => (
                  <li key={person.id} className="border-border-subtle rounded-lg border p-3">
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
            <p className="border-border-subtle text-glex-green-800/70 rounded-xl border p-6 text-sm">
              {common('noResults')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
