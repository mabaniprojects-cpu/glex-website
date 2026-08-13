import { UserRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { canAssignRole, permissionsFor } from '@/lib/rbac'

/**
 * Role assignment.
 *
 * `canAssignRole` is the rule that keeps the permission matrix meaningful: if
 * an administrator can mint a role holding permissions they lack, every
 * boundary in the matrix is one click from being bypassed. These cases are
 * derived from the matrix rather than hard-coded, so adding a permission to a
 * role cannot quietly open a path around it.
 */
describe('canAssignRole', () => {
  it('lets SUPER_ADMIN assign anything', () => {
    for (const role of Object.values(UserRole)) {
      expect(canAssignRole(UserRole.SUPER_ADMIN, role), role).toBe(true)
    }
  })

  it('stops ADMIN minting a SUPER_ADMIN', () => {
    // The matrix withholds exactly one permission from ADMIN. If they could
    // grant SUPER_ADMIN they would simply appoint themselves one.
    expect(permissionsFor(UserRole.SUPER_ADMIN)).toContain('impersonate')
    expect(permissionsFor(UserRole.ADMIN)).not.toContain('impersonate')

    expect(canAssignRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)).toBe(false)
  })

  it('is reflexive — every role may assign its own', () => {
    for (const role of Object.values(UserRole)) {
      expect(canAssignRole(role, role), role).toBe(true)
    }
  })

  it('never lets a role grant a permission it does not hold', () => {
    // The property the whole rule exists to guarantee, checked exhaustively
    // across every ordered pair in the matrix.
    for (const actor of Object.values(UserRole)) {
      const held = new Set(permissionsFor(actor))

      for (const target of Object.values(UserRole)) {
        if (!canAssignRole(actor, target)) continue

        for (const permission of permissionsFor(target)) {
          expect(held.has(permission), `${actor} → ${target} leaks ${permission}`).toBe(true)
        }
      }
    }
  })

  it('refuses a staff role to a client administrator', () => {
    // CLIENT_ORG_ADMIN holds `user:read` for its own organisation and must not
    // be able to convert that into portal access.
    expect(canAssignRole(UserRole.CLIENT_ORG_ADMIN, UserRole.SUPPORT_AGENT)).toBe(false)
    expect(canAssignRole(UserRole.CLIENT_ORG_ADMIN, UserRole.ADMIN)).toBe(false)
  })

  it('refuses a sideways grant between staff specialisms', () => {
    // A content editor cannot approve suppliers, so it cannot appoint someone
    // who can — even though neither role outranks the other.
    expect(permissionsFor(UserRole.PROCUREMENT_MANAGER)).toContain('supplier:approve')
    expect(permissionsFor(UserRole.CONTENT_EDITOR)).not.toContain('supplier:approve')

    expect(canAssignRole(UserRole.CONTENT_EDITOR, UserRole.PROCUREMENT_MANAGER)).toBe(false)
  })
})
