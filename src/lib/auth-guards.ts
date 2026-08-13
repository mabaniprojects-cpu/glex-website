import type { UserRole } from '@prisma/client'
import { forbidden, unauthorized } from 'next/navigation'
import { auth } from './auth'
import { can, isStaff, type Permission } from './rbac'

/**
 * Server-side authorization guards.
 *
 * These are the ONLY real security boundary — `src/proxy.ts` performs an
 * optimistic cookie check for redirect UX, but Server Actions POST to the
 * page's own URL and route handlers can be called directly, so every
 * privileged entry point must call a guard from this module.
 */

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
  organizationId: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id || !user.role) return null

  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? null,
    role: user.role,
    organizationId: user.organizationId ?? null,
  }
}

/** Requires any authenticated session. Throws the Next.js `unauthorized()` interrupt. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) unauthorized()
  return user
}

/** Requires a specific permission. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.role, permission)) forbidden()
  return user
}

/** Requires membership of the GLEX staff (admin portal). */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isStaff(user.role)) forbidden()
  return user
}

/**
 * Organization-level data isolation.
 *
 * Staff with a global read permission may access any organization's records;
 * everyone else is confined to their own. Returns a Prisma `where` fragment so
 * the restriction is applied in SQL rather than filtered after the fact.
 */
export function organizationScope(
  user: SessionUser,
  globalPermission: Permission
): { organizationId?: string } {
  if (can(user.role, globalPermission)) return {}
  // A user with no organization can never match a scoped row.
  return { organizationId: user.organizationId ?? '__none__' }
}

/** Throws unless the user may read the given organization's data. */
export function assertOrganizationAccess(
  user: SessionUser,
  organizationId: string | null,
  globalPermission: Permission
): void {
  if (can(user.role, globalPermission)) return
  if (!organizationId || user.organizationId !== organizationId) forbidden()
}

/**
 * Requires GLEX staff membership **and** a specific permission.
 *
 * The admin layout calls `requireStaff()`, but a layout is not a boundary for
 * the page beneath it: in the App Router they render concurrently, so a page
 * that guards only on a permission still executes its queries and puts the
 * result in the RSC payload even when the layout interrupts.
 *
 * That matters wherever an admin page is guarded by a permission non-staff also
 * hold — `product:write` belongs to approved suppliers as well as staff, so
 * `/admin/products/[id]` leaked a product's name to any signed-in supplier who
 * guessed an id, behind a rendered "forbidden" screen.
 */
export async function requireStaffPermission(permission: Permission): Promise<SessionUser> {
  const user = await requireStaff()
  if (!can(user.role, permission)) forbidden()
  return user
}
