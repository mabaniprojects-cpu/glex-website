import { UserRole } from '@prisma/client'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { InviteStaffForm } from '@/components/admin/invite-staff-form'
import { UserControls } from '@/components/admin/user-controls'
import { Button } from '@/components/ui/button'
import { ListRange } from '@/components/ui/list-range'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { listUsersForAdmin } from '@/lib/admin'
import { requirePermission } from '@/lib/auth-guards'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { canAssignRole, isStaff } from '@/lib/rbac'
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
  // Only colleagues are invited from here. Clients and suppliers register
  // themselves, which is what builds their organization and profile records.
  const invitableRoles = assignableRoles.filter(isStaff)

  // Roles read as their job title rather than as the enum name: "Supply chain
  // manager", not "supply_chain_manager".
  const roleLabel = (role: UserRole) => admin(`roles.${role}` as 'roles.ADMIN')

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.users')}</h1>

      {canWrite && invitableRoles.length > 0 ? <InviteStaffForm roles={invitableRoles} /> : null}

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
            className="border-border-subtle h-11 w-64 rounded-lg border px-3 text-sm"
          />
        </div>

        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('users.role')}</span>
          <select
            name="role"
            defaultValue={role ?? ''}
            className="border-border-subtle h-11 rounded-lg border bg-white px-3 pe-8 text-sm"
          >
            <option value="">{admin('users.allRoles')}</option>
            {Object.values(UserRole).map((option) => (
              <option key={option} value={option}>
                {roleLabel(option)}
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
        <p className="text-glex-green-800/70 mt-10">{common('noResults')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{admin('nav.users')}</caption>
            <thead>
              <tr className="border-border-subtle border-b text-start">
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
                  <tr key={item.id} className="border-border-subtle/60 border-b align-top">
                    <td className="py-3 pe-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-glex-green-800/60 text-xs" dir="ltr">
                        {item.email}
                      </p>
                    </td>

                    <td className="py-3 pe-4">{item.organization?.name ?? '—'}</td>

                    <td className="py-3 pe-4">
                      <p>{item.isActive ? admin('users.active') : admin('users.inactive')}</p>
                      {!item.emailVerified ? (
                        <p className="text-glex-green-800/60 text-xs">
                          {admin('users.unverified')}
                        </p>
                      ) : null}
                      {item.awaitingInvite ? (
                        <p className="text-glex-gold-700 text-xs font-medium">
                          {admin('users.invitePending')}
                        </p>
                      ) : null}
                      {item.isLocked ? (
                        <p className="text-xs font-medium text-red-800">{admin('users.locked')}</p>
                      ) : null}
                      <p className="text-glex-green-800/60 mt-1 text-xs">
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
                          awaitingInvite={item.awaitingInvite}
                          assignableRoles={assignableRoles}
                        />
                      ) : (
                        <span className="text-glex-green-800/60 text-xs">
                          {roleLabel(item.role)}
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
