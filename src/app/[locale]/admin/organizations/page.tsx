import { OrganizationType } from '@prisma/client'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { OrganizationControls } from '@/components/admin/organization-controls'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { listOrganizationsForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { robots: { index: false, follow: false } }

function isType(value: unknown): value is OrganizationType {
  return (
    typeof value === 'string' &&
    Object.values(OrganizationType).includes(value as OrganizationType)
  )
}

export default async function AdminOrganizationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const actor = await requirePermission('organization:read')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const search = typeof rawParams.q === 'string' ? rawParams.q : undefined
  // Anything outside the enum is ignored rather than passed to the query.
  const type = isType(rawParams.type) ? rawParams.type : undefined

  const { items, total } = await listOrganizationsForAdmin({ take, skip, search, type })

  const canWrite = can(actor.role, 'organization:write')

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.organizations')}</h1>

      {/* A plain GET form, so results stay linkable and work without JS. */}
      <form action="" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="admin-org-search" className="mb-1 block text-sm font-medium">
            {common('search')}
          </label>
          <input
            id="admin-org-search"
            name="q"
            defaultValue={search ?? ''}
            maxLength={120}
            className="h-11 w-64 rounded-lg border border-border-subtle px-3 text-sm"
          />
        </div>

        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('organizations.type')}</span>
          <select
            name="type"
            defaultValue={type ?? ''}
            className="h-11 rounded-lg border border-border-subtle bg-white px-3 pe-8 text-sm"
          >
            <option value="">{admin('organizations.allTypes')}</option>
            {Object.values(OrganizationType).map((option) => (
              <option key={option} value={option}>
                {option.toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" variant="outline">
          {common('search')}
        </Button>
      </form>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const holdings = item._count.users + item._count.rfqs + item._count.shipments

            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border-subtle p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {item.name}
                    {!item.isActive ? (
                      <span className="ms-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-glex-green-800/70">
                        {admin('organizations.disabled')}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-xs text-glex-green-800/60">
                    {item.type.toLowerCase()}
                    {item.country ? ` · ${item.country}` : ''}
                    {item.city ? `, ${item.city}` : ''}
                  </p>

                  <p className="mt-1 text-xs text-glex-green-800/60">
                    {admin('organizations.holdings', {
                      users: item._count.users,
                      rfqs: item._count.rfqs,
                      shipments: item._count.shipments,
                    })}
                  </p>
                </div>

                {canWrite ? (
                  <div className="w-full max-w-xl">
                    <OrganizationControls
                      record={{
                        id: item.id,
                        name: item.name,
                        country: item.country ?? '',
                        city: item.city ?? '',
                        address: item.address ?? '',
                        website: item.website ?? '',
                        phone: item.phone ?? '',
                        vatNumber: item.vatNumber ?? '',
                        crNumber: item.crNumber ?? '',
                        description: item.description ?? '',
                        isActive: item.isActive,
                        holdings,
                        isOwn: item.id === actor.organizationId,
                      }}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/admin/organizations', rawParams, target)}
      />
    </div>
  )
}
