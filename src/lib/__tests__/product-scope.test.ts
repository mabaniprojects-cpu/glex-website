import { UserRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@/lib/auth-guards'
import {
  canSetEditorialFlags,
  productWriteScope,
  supplierIdForNewProduct,
} from '@/lib/product-scope'
import { can, isStaff } from '@/lib/rbac'

/**
 * Product write scoping.
 *
 * This exists because `product:write` is held by GLEX staff **and** by approved
 * suppliers and distributors, so the permission alone never answered "which
 * products?". Before this scope, `saveProduct` and `deleteProduct` looked a
 * product up by id with no ownership check — an approved supplier could edit,
 * hide or delete any listing in the catalogue, including a competitor's, by
 * calling the Server Action directly.
 */

const asUser = (role: UserRole): SessionUser => ({
  id: 'user-1',
  email: 'someone@example.com',
  name: 'Someone',
  role,
  organizationId: 'org-1',
})

const SUPPLIER_ROLES = [UserRole.APPROVED_SUPPLIER, UserRole.DISTRIBUTOR]

describe('productWriteScope', () => {
  it('confirms the premise: suppliers really do hold product:write', () => {
    // If this ever stops being true the scope is redundant — but so is the
    // reasoning behind it, and someone should notice.
    for (const role of SUPPLIER_ROLES) {
      expect(can(role, 'product:write'), role).toBe(true)
      expect(isStaff(role), role).toBe(false)
    }
  })

  it('leaves staff unrestricted', () => {
    for (const role of [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]) {
      expect(productWriteScope(asUser(role), null), role).toEqual({})
    }
  })

  it('confines a supplier to their own products', () => {
    for (const role of SUPPLIER_ROLES) {
      expect(productWriteScope(asUser(role), 'supplier-profile-1')).toEqual({
        supplierId: 'supplier-profile-1',
      })
    }
  })

  it('matches nothing when a supplier has no profile', () => {
    // `{ supplierId: null }` would match every unattributed product in the
    // catalogue — the opposite of what is wanted.
    const scope = productWriteScope(asUser(UserRole.APPROVED_SUPPLIER), null)

    expect(scope).not.toEqual({})
    expect(scope).not.toEqual({ supplierId: null })
    expect(scope).toEqual({ supplierId: '__none__' })
  })
})

describe('canSetEditorialFlags', () => {
  it('lets staff feature a product', () => {
    expect(canSetEditorialFlags(asUser(UserRole.ADMIN))).toBe(true)
  })

  it('refuses a supplier', () => {
    // `isFeatured` promotes a product on the homepage. A supplier granting that
    // to themselves is not an editorial decision anyone made.
    for (const role of SUPPLIER_ROLES) {
      expect(canSetEditorialFlags(asUser(role)), role).toBe(false)
    }
  })
})

describe('supplierIdForNewProduct', () => {
  it('attributes a supplier’s new product to them', () => {
    expect(supplierIdForNewProduct(asUser(UserRole.APPROVED_SUPPLIER), 'profile-9')).toBe(
      'profile-9'
    )
  })

  it('leaves a staff-created product unattributed', () => {
    expect(supplierIdForNewProduct(asUser(UserRole.ADMIN), 'profile-9')).toBeNull()
  })

  it('cannot produce an unowned product for a supplier with a profile', () => {
    // An unattributed product would fall outside the scope on every later edit,
    // which is how a supplier would escape it.
    for (const role of SUPPLIER_ROLES) {
      expect(supplierIdForNewProduct(asUser(role), 'profile-9'), role).not.toBeNull()
    }
  })
})
