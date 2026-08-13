'use server'

import { UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { canAssignRole } from '@/lib/rbac'

/**
 * User administration.
 *
 * The dangerous surface of the admin portal: everything here can widen or
 * remove someone's access, so the rules below are enforced server-side and
 * repeated for every action rather than trusted to the UI.
 *
 *   1. Nobody may change their own role or deactivate themselves. Self-service
 *      escalation is the classic path from "compromised staff account" to
 *      "compromised platform", and self-deactivation locks the last admin out.
 *   2. Nobody may grant a role carrying permissions they do not hold
 *      (`canAssignRole`).
 *   3. Deactivation clears the account's sessions, and `src/lib/auth.ts`
 *      re-reads the account at most a minute later, so access really ends.
 *   4. Every change is audited in the same transaction that makes it.
 */

export type UserActionResult =
  | { ok: true }
  | {
      ok: false
      error: 'validation' | 'not_found' | 'self' | 'forbidden_role' | 'last_admin' | 'server'
    }

const idSchema = z.object({ id: z.string().uuid() })

const roleSchema = z.object({
  id: z.string().uuid(),
  role: z.nativeEnum(UserRole),
})

/**
 * Guards common to every mutation.
 *
 * Returns the target user, or the reason the action must not proceed.
 */
type TargetLookup =
  | { error: 'self' | 'not_found'; target?: undefined }
  | { error?: undefined; target: { id: string; role: UserRole; isActive: boolean } }

async function loadTarget(actorId: string, id: string): Promise<TargetLookup> {
  if (id === actorId) return { error: 'self' }

  const target = await db.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  })
  if (!target) return { error: 'not_found' }

  return { target }
}

// --- Role -------------------------------------------------------------------

export async function setUserRole(input: unknown): Promise<UserActionResult> {
  const actor = await requirePermission('user:write')

  const parsed = roleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, role } = parsed.data

  const loaded = await loadTarget(actor.id, id)
  if (loaded.error) return { ok: false, error: loaded.error }
  const target = loaded.target

  // You cannot hand out authority you do not hold yourself.
  if (!canAssignRole(actor.role, role)) return { ok: false, error: 'forbidden_role' }

  // Nor take away authority above your own — demoting a SUPER_ADMIN as an
  // ADMIN is an escalation in the other direction.
  if (!canAssignRole(actor.role, target.role)) return { ok: false, error: 'forbidden_role' }

  if (target.role === role) return { ok: true }

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { role } })

      // A role change alters what the account may do; make it re-authenticate
      // rather than carry a token minted under the old role.
      await tx.session.deleteMany({ where: { userId: id } })

      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.role_changed',
          entityType: 'User',
          entityId: id,
          before: { role: target.role },
          after: { role },
        },
        tx
      )
    })

    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    console.error('[users] Role change failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Activation -------------------------------------------------------------

const activationSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

export async function setUserActive(input: unknown): Promise<UserActionResult> {
  const actor = await requirePermission('user:write')

  const parsed = activationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, isActive } = parsed.data

  const loaded = await loadTarget(actor.id, id)
  if (loaded.error) return { ok: false, error: loaded.error }
  const target = loaded.target

  if (!canAssignRole(actor.role, target.role)) return { ok: false, error: 'forbidden_role' }

  if (target.isActive === isActive) return { ok: true }

  // Never let the last usable administrator be switched off; recovering from
  // that needs database access, which is exactly what the portal exists to
  // avoid.
  if (!isActive && (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.ADMIN)) {
    const remaining = await db.user.count({
      where: {
        id: { not: id },
        role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
        isActive: true,
        deletedAt: null,
      },
    })
    if (remaining === 0) return { ok: false, error: 'last_admin' }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive } })

      // Without this the account keeps its issued token. `src/lib/auth.ts`
      // re-reads within a minute, so this closes the gap either way.
      if (!isActive) await tx.session.deleteMany({ where: { userId: id } })

      await recordAudit(
        {
          actorId: actor.id,
          action: isActive ? 'user.activated' : 'user.deactivated',
          entityType: 'User',
          entityId: id,
          before: { isActive: target.isActive },
          after: { isActive },
        },
        tx
      )
    })

    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    console.error('[users] Activation change failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Lockout ----------------------------------------------------------------

/**
 * Clears a brute-force lockout.
 *
 * Self-service is allowed here, unlike the other actions: releasing your own
 * lockout grants no authority you did not already have, and needing a second
 * administrator to unlock a mistyped password is how people end up disabling
 * the lockout entirely.
 */
export async function unlockUser(input: unknown): Promise<UserActionResult> {
  const actor = await requirePermission('user:write')

  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  const target = await db.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, failedLoginCount: true, lockedUntil: true },
  })
  if (!target) return { ok: false, error: 'not_found' }

  if (!canAssignRole(actor.role, target.role)) return { ok: false, error: 'forbidden_role' }

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { failedLoginCount: 0, lockedUntil: null },
      })

      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.unlocked',
          entityType: 'User',
          entityId: id,
          before: { failedLoginCount: target.failedLoginCount, lockedUntil: target.lockedUntil },
          after: { failedLoginCount: 0, lockedUntil: null },
        },
        tx
      )
    })

    revalidatePath('/admin/users')
    return { ok: true }
  } catch (error) {
    console.error('[users] Unlock failed:', error)
    return { ok: false, error: 'server' }
  }
}
