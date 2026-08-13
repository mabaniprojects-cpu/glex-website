import { UserRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { can, homeRouteFor, isStaff, permissionsFor, PERMISSIONS } from '../rbac'

/**
 * The permission matrix is the authorization contract. These tests assert the
 * *negative* cases as hard as the positive ones — a role quietly gaining a
 * permission is the failure that matters.
 */
describe('rbac', () => {
  it('grants a super admin every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(can(UserRole.SUPER_ADMIN, permission), permission).toBe(true)
    }
  })

  it('withholds impersonation from a plain admin', () => {
    expect(can(UserRole.ADMIN, 'impersonate')).toBe(false)
    expect(can(UserRole.ADMIN, 'admin:access')).toBe(true)
  })

  it('confines a pending supplier to its own application', () => {
    expect(can(UserRole.PENDING_SUPPLIER, 'supplier:write:own')).toBe(true)

    // The dangerous ones.
    expect(can(UserRole.PENDING_SUPPLIER, 'supplier:approve')).toBe(false)
    expect(can(UserRole.PENDING_SUPPLIER, 'supplier:read:all')).toBe(false)
    expect(can(UserRole.PENDING_SUPPLIER, 'rfq:read:all')).toBe(false)
    expect(can(UserRole.PENDING_SUPPLIER, 'admin:access')).toBe(false)
    expect(can(UserRole.PENDING_SUPPLIER, 'product:write')).toBe(false)
  })

  it('lets an approved supplier manage products but not approve peers', () => {
    expect(can(UserRole.APPROVED_SUPPLIER, 'product:write')).toBe(true)
    expect(can(UserRole.APPROVED_SUPPLIER, 'supplier:approve')).toBe(false)
    expect(can(UserRole.APPROVED_SUPPLIER, 'rfq:read:all')).toBe(false)
  })

  it('never lets a client read another organisation’s data', () => {
    for (const role of [UserRole.CLIENT_ORG_ADMIN, UserRole.CLIENT_TEAM_MEMBER]) {
      expect(can(role, 'rfq:read:own'), role).toBe(true)
      expect(can(role, 'rfq:read:all'), role).toBe(false)
      expect(can(role, 'shipment:read:all'), role).toBe(false)
      expect(can(role, 'supplier:read:all'), role).toBe(false)
      expect(can(role, 'admin:access'), role).toBe(false)
      expect(can(role, 'audit:read'), role).toBe(false)
    }
  })

  it('does not let a client team member edit the organisation', () => {
    expect(can(UserRole.CLIENT_ORG_ADMIN, 'organization:write')).toBe(true)
    expect(can(UserRole.CLIENT_TEAM_MEMBER, 'organization:write')).toBe(false)
  })

  it('restricts a content editor to content', () => {
    expect(can(UserRole.CONTENT_EDITOR, 'news:publish')).toBe(true)
    expect(can(UserRole.CONTENT_EDITOR, 'rfq:manage')).toBe(false)
    expect(can(UserRole.CONTENT_EDITOR, 'user:write')).toBe(false)
    expect(can(UserRole.CONTENT_EDITOR, 'supplier:approve')).toBe(false)
  })

  it('treats no role and unknown input as unauthorised', () => {
    expect(can(null, 'product:read')).toBe(false)
    expect(can(undefined, 'admin:access')).toBe(false)
  })

  it('identifies staff correctly', () => {
    expect(isStaff(UserRole.SALES_OFFICER)).toBe(true)
    expect(isStaff(UserRole.SUPPORT_AGENT)).toBe(true)
    expect(isStaff(UserRole.APPROVED_SUPPLIER)).toBe(false)
    expect(isStaff(UserRole.CLIENT_ORG_ADMIN)).toBe(false)
    expect(isStaff(null)).toBe(false)
  })

  it('routes each role to its own landing area', () => {
    expect(homeRouteFor(UserRole.SUPER_ADMIN)).toBe('/admin')
    expect(homeRouteFor(UserRole.LOGISTICS_MANAGER)).toBe('/admin')
    expect(homeRouteFor(UserRole.APPROVED_SUPPLIER)).toBe('/supplier')
    expect(homeRouteFor(UserRole.PENDING_SUPPLIER)).toBe('/supplier')
    expect(homeRouteFor(UserRole.DISTRIBUTOR)).toBe('/supplier')
    expect(homeRouteFor(UserRole.CLIENT_ORG_ADMIN)).toBe('/dashboard')
    expect(homeRouteFor(UserRole.CLIENT_TEAM_MEMBER)).toBe('/dashboard')
  })

  it('defines a permission set for every role', () => {
    for (const role of Object.values(UserRole)) {
      expect(permissionsFor(role).length, role).toBeGreaterThan(0)
    }
  })
})
