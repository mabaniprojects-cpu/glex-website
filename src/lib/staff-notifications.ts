import { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { sendTemplate } from '@/lib/mail'
import { permissionsFor, type Permission } from '@/lib/rbac'
import type { TemplateContext, TemplateKey } from '@/lib/mail/types'

/**
 * Telling a desk that something has arrived for it.
 *
 * Notifications used to go to a shared mailbox and nowhere else, so whether a
 * colleague saw a new enquiry depended on whether they had been given access to
 * `info@`. Addressing the desk by permission instead means a new colleague is
 * covered the day their account is created, and someone who changes role stops
 * being emailed about work that is no longer theirs — with no setting to
 * remember either way.
 *
 * Delivery is best effort. The enquiry is already saved by the time this runs,
 * and a mail outage must not lose it.
 */

/** Which roles hold a permission, from the matrix rather than a hand-written list. */
export function rolesWithPermission(permission: Permission): UserRole[] {
  return Object.values(UserRole).filter((role) => permissionsFor(role).includes(permission))
}

/**
 * Administrators hold every permission, so they staff every desk. Left alone,
 * the owner would be emailed about every enquiry, every quotation request and
 * every freight quote the company receives — which is how people start
 * ignoring the notifications that matter.
 */
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

/**
 * Everyone who can act on this kind of work: active, not deleted, and with a
 * verified address — an invited colleague who has never signed in has not
 * confirmed their mailbox, and mail to it may not reach a person.
 *
 * Administrators are the fallback rather than the audience. When a desk has
 * nobody on it, they are told instead, because unstaffed work going unseen is
 * the worse failure; once somebody holds the role, the administrators drop out.
 */
export async function deskRecipients(
  permission: Permission
): Promise<Array<{ email: string; name: string }>> {
  const roles = rolesWithPermission(permission)
  if (roles.length === 0) return []

  const specialists = roles.filter((role) => !ADMIN_ROLES.includes(role))

  const query = (candidateRoles: UserRole[]) =>
    db.user.findMany({
      where: {
        role: { in: candidateRoles },
        isActive: true,
        deletedAt: null,
        emailVerified: { not: null },
      },
      select: { email: true, name: true },
      orderBy: { name: 'asc' },
    })

  if (specialists.length > 0) {
    const staffed = await query(specialists)
    if (staffed.length > 0) return staffed
  }

  return query(roles.filter((role) => ADMIN_ROLES.includes(role)))
}

/**
 * Sends one internal template to a desk.
 *
 * `alreadySent` is the shared mailbox the same message went to, so nobody whose
 * own address is that mailbox receives it twice.
 */
export async function notifyDesk({
  permission,
  template,
  context,
  replyTo,
  alreadySent,
}: {
  permission: Permission
  template: TemplateKey
  context: TemplateContext
  replyTo?: string | null
  alreadySent?: string | null
}): Promise<number> {
  const recipients = await deskRecipients(permission)
  const skip = alreadySent?.trim().toLowerCase()

  const addresses = recipients
    .map((person) => ({ ...person, email: person.email.trim().toLowerCase() }))
    .filter((person) => person.email !== skip)

  if (addresses.length === 0) return 0

  await Promise.all(
    addresses.map((person) =>
      sendTemplate(template, person.email, { ...context, recipientName: person.name }, { replyTo })
    )
  )

  return addresses.length
}
