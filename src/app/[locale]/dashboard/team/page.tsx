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
 * The colleagues inside the signed-in user's own organization.
 *
 * Read-only. Inviting and removing teammates changes who can see the
 * organization's RFQs and shipments, so it is not self-service — a client
 * administrator asks GLEX, and the change is audited in `/admin/users`.
 *
 * Email addresses are shown here deliberately: these are colleagues in one
 * company, the single context where a teammate's address is expected rather
 * than a disclosure.
 */
export default async function DashboardTeamPage({
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

  const organization = await getMyOrganization(user)
  const members = organization?.members ?? []

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{dash('nav.team')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{dash('teamIntro')}</p>

      {members.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{dash('nav.team')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {admin('users.person')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {admin('users.role')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {admin('users.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border-subtle/60 align-top">
                  <td className="py-3 pe-4">
                    <p className="font-medium">
                      {member.user.name}
                      {member.user.id === user.id ? (
                        <span className="ms-2 text-xs text-glex-green-800/60">
                          ({dash('teamYou')})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-glex-green-800/60" dir="ltr">
                      {member.user.email}
                    </p>
                  </td>

                  <td className="py-3 pe-4">
                    {member.role.replace(/_/g, ' ').toLowerCase()}
                    {member.isOwner ? (
                      <span className="ms-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium">
                        {dash('teamOwner')}
                      </span>
                    ) : null}
                  </td>

                  <td className="py-3">
                    {member.acceptedAt ? (
                      <span className="text-glex-green-800/70">
                        {member.user.lastLoginAt
                          ? admin('users.lastSignIn', {
                              date: formatDate(member.user.lastLoginAt, locale),
                            })
                          : admin('users.neverSignedIn')}
                      </span>
                    ) : (
                      <span className="font-medium text-glex-gold-800">
                        {dash('teamPending')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
