import { AlertTriangle, FileText, Package } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import {
  computeCompletion,
  countOpenOpportunities,
  getMySupplierProfile,
  listMyOpportunities,
} from '@/lib/supplier'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SupplierOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()
  const profile = await getMySupplierProfile(user)

  const supplier = await getTranslations('supplier')
  const common = await getTranslations('common')

  if (!profile) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-muted p-12 text-center">
        <AlertTriangle className="mx-auto size-10 text-glex-green-200" aria-hidden="true" />
        <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
      </div>
    )
  }

  // Opportunities are scoped to this supplier in SQL. The overview shows a
  // short preview; the count is queried separately so it reflects every row
  // rather than just the page.
  const [{ items: opportunities }, openCount] = await Promise.all([
    listMyOpportunities(profile.id, { take: 5 }),
    countOpenOpportunities(profile.id),
  ])

  const completion = computeCompletion({
    legalName: profile.legalName,
    country: profile.country,
    crNumber: profile.crNumber,
    description: profile.description,
    brands: profile.brands,
    marketsServed: profile.marketsServed,
    availableIncoterms: profile.availableIncoterms,
    contacts: profile.contacts,
    documents: profile.documents,
    categories: profile.categories,
  })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{profile.legalName}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-border-subtle px-2.5 py-1 text-xs font-semibold">
            {supplier(`status.${profile.status}`)}
          </span>
          <span className="text-sm text-glex-green-800/70">
            {[profile.organization.city, profile.organization.country].filter(Boolean).join(', ')}
          </span>
        </p>
      </div>

      {/* Clarification requests must be impossible to miss. */}
      {profile.status === 'CLARIFICATION_REQUIRED' && profile.clarificationNote ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-glex-green-900">
              {supplier('status.CLARIFICATION_REQUIRED')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-glex-green-900/85">
              {profile.clarificationNote}
            </p>
          </div>
        </div>
      ) : null}

      {/* Profile completion */}
      <section aria-labelledby="completion-heading">
        <h2 id="completion-heading" className="text-lg font-semibold">
          {supplier('profileCompletion')}
        </h2>
        <div className="mt-3 flex items-center gap-4">
          <div
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={supplier('profileCompletion')}
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-glex-green-100"
          >
            <div
              className="h-full rounded-full bg-glex-green-600"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="font-semibold" dir="ltr">
            {completion}%
          </span>
        </div>
      </section>

      {/* Summary */}
      <ul className="grid gap-4 sm:grid-cols-3">
        <li>
          <Card>
            <CardContent className="flex items-center gap-4 p-5 pt-5">
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-glex-green-600 text-white">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-bold">{openCount}</span>
                <span className="block text-sm text-glex-green-800/70">
                  {supplier('opportunities')}
                </span>
              </span>
            </CardContent>
          </Card>
        </li>
        <li>
          <Card>
            <CardContent className="flex items-center gap-4 p-5 pt-5">
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-glex-green-600 text-white">
                <Package className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-bold">{profile._count.products}</span>
                <span className="block text-sm text-glex-green-800/70">
                  {supplier('productCategories')}
                </span>
              </span>
            </CardContent>
          </Card>
        </li>
        <li>
          <Card>
            <CardContent className="flex items-center gap-4 p-5 pt-5">
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-glex-green-600 text-white">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-bold">{profile.documents.length}</span>
                <span className="block text-sm text-glex-green-800/70">
                  {supplier('stepDocuments')}
                </span>
              </span>
            </CardContent>
          </Card>
        </li>
      </ul>

      {/* Recent opportunities */}
      <section aria-labelledby="opportunities-heading">
        <div className="flex items-center justify-between">
          <h2 id="opportunities-heading" className="text-lg font-semibold">
            {supplier('opportunities')}
          </h2>
          <Link
            href="/supplier/opportunities"
            className="text-sm text-glex-green-700 underline-offset-4 hover:underline"
          >
            {common('viewAll')}
          </Link>
        </div>

        {opportunities.length === 0 ? (
          <p className="mt-4 text-glex-green-800/70">{supplier('noOpportunities')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {opportunities.slice(0, 5).map((opportunity) => (
              <li
                key={opportunity.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle p-4 text-sm"
              >
                <span className="font-mono font-medium" dir="ltr">
                  {opportunity.rfq.reference}
                </span>
                <span className="text-glex-green-800/70">
                  {opportunity.rfq.destinationCountry}
                </span>
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold">
                  {opportunity.status}
                </span>
                <time
                  dateTime={opportunity.createdAt.toISOString()}
                  className="ms-auto text-glex-green-800/60"
                >
                  {formatDate(opportunity.createdAt, locale, { dateStyle: 'medium' })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
