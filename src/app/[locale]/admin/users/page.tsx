import { UserRole } from '@prisma/client'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { UserControls } from '@/components/admin/user-controls'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { listUsersForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { canAssignRole } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.values(UserRole).includes(value as UserRole)
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  // Reading the list is a lower bar than changing it; the controls are only
  // rendered for an actor who may actually write.
  const actor = await requirePermission('user:read')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const search = typeof rawParams.q === 'string' ? rawParams.q : undefined
  // Anything not in the enum is ignored rather than passed to the query.
  const role = isRole(rawParams.role) ? rawParams.role : undefined

  const { items, total } = await listUsersForAdmin({ take, skip, search, role })

  const canWrite = canAssignRole(actor.role, UserRole.CLIENT_TEAM_MEMBER)
  const assignableRoles = Object.values(UserRole).filter((candidate) =>
    canAssignRole(actor.role, candidate)
  )

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.users')}</h1>

      {/* A plain GET form, so results stay linkable and work without JS. */}
      <form action="" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="admin-user-search" className="mb-1 block text-sm font-medium">
            {common('search')}
          </label>
          <input
            id="admin-user-search"
            name="q"
            defaultValue={search ?? ''}
            maxLength={120}
            className="h-11 w-64 rounded-lg border border-border-subtle px-3 text-sm"
          />
        </div>

        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('users.role')}</span>
          <select
            name="role"
            defaultValue={role ?? ''}
            className="h-11 rounded-lg border border-border-subtle bg-white px-3 pe-8 text-sm"
          >
            <option value="">{admin('users.allRoles')}</option>
            {Object.values(UserRole).map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').toLowerCase()}
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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{admin('nav.users')}</caption>
            <thead>
              <tr className="border-b border-border-subtle text-start">
                <th scope="col" className="py-2 pe-4 text-start font-semibold">
                  {admin('users.person')}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-semibold">
                  {admin('users.organization')}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-semibold">
                  {admin('users.status')}
                </th>
                <th scope="col" className="py-2 text-end font-semibold">
                  {common('actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelf = item.id === actor.id

                return (
                  <tr key={item.id} className="border-b border-border-subtle/60 align-top">
                    <td className="py-3 pe-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-glex-green-800/60" dir="ltr">
                        {item.email}
                      </p>
                    </td>

                    <td className="py-3 pe-4">{item.organization?.name ?? '—'}</td>

                    <td className="py-3 pe-4">
                      <p>{item.isActive ? admin('users.active') : admin('users.inactive')}</p>
                      {!item.emailVerified ? (
                        <p className="text-xs text-glex-green-800/60">
                          {admin('users.unverified')}
                        </p>
                      ) : null}
                      {item.isLocked ? (
                        <p className="text-xs font-medium text-red-800">{admin('users.locked')}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-glex-green-800/60">
                        {item.lastLoginAt
                          ? admin('users.lastSignIn', {
                              date: formatDate(item.lastLoginAt, locale),
                            })
                          : admin('users.neverSignedIn')}
                      </p>
                    </td>

                    <td className="py-3 text-end">
                      {canWrite ? (
                        <UserControls
                          id={item.id}
                          role={item.role}
                          isActive={item.isActive}
                          isLocked={item.isLocked}
                          isSelf={isSelf}
                          assignableRoles={assignableRoles}
                        />
                      ) : (
                        <span className="text-xs text-glex-green-800/60">
                          {item.role.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount(total, take)}
        buildHref={(target) => buildPageHref('/admin/users', rawParams, target)}
      />
    </div>
  )
}
