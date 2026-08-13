import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { getMyOrganization } from '@/lib/dashboard'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The signed-in user's own organization profile.
 *
 * Read-only. Editing a company's legal details — its name, VAT number,
 * commercial registration — is an administrative act with commercial
 * consequences, so it stays with GLEX staff in `/admin/organizations` rather
 * than being self-service.
 */
export default async function DashboardOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  const dash = await getTranslations('dashboard')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  // Scoped by the session's own organization — there is no id in the URL to
  // tamper with.
  const organization = await getMyOrganization(user)

  if (!organization) {
    return (
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.organization')}</h1>
        <p className="mt-6 text-glex-green-800/70">{common('noResults')}</p>
      </div>
    )
  }

  const details: Array<{ label: string; value: string | null }> = [
    { label: admin('organizations.country'), value: organization.country },
    { label: admin('organizations.city'), value: organization.city },
    { label: admin('organizations.address'), value: organization.address },
    { label: admin('organizations.phone'), value: organization.phone },
    { label: admin('organizations.website'), value: organization.website },
    { label: admin('organizations.vatNumber'), value: organization.vatNumber },
    { label: admin('organizations.crNumber'), value: organization.crNumber },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.organization')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{dash('organizationIntro')}</p>

      <div className="mt-8 rounded-xl border border-border-subtle p-6">
        <h2 className="text-xl font-bold">{organization.name}</h2>
        <p className="mt-1 text-sm text-glex-green-800/60">
          {organization.type.toLowerCase()} ·{' '}
          {formatDate(organization.createdAt, locale, { dateStyle: 'medium' })}
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {details
            .filter((detail) => detail.value)
            .map((detail) => (
              <div key={detail.label}>
                <dt className="text-sm text-glex-green-800/60">{detail.label}</dt>
                <dd className="mt-0.5 font-medium">{detail.value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  )
}
