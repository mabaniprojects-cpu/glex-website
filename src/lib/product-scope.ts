import type { Prisma } from '@prisma/client'
import type { SessionUser } from '@/lib/auth-guards'
import { isStaff } from '@/lib/rbac'

/**
 * Who may write which product.
 *
 * `product:write` is held by GLEX staff **and** by approved suppliers and
 * distributors, so the permission alone is not an answer to "which products?".
 * Without this scope an approved supplier could edit, hide or delete any
 * product in the catalogue — including a competitor's — because Server Actions
 * POST to the page's own URL and never need the admin UI to be reachable.
 *
 * Staff are unrestricted. Everyone else is confined to products carrying their
 * own `supplierId`.
 */
export function productWriteScope(
  user: SessionUser,
  supplierProfileId: string | null
): Prisma.ProductWhereInput {
  if (isStaff(user.role)) return {}

  // A supplier with no profile owns nothing, and `null` would match every
  // unattributed product — so an id that cannot exist is used instead.
  return { supplierId: supplierProfileId ?? '__none__' }
}

/**
 * Whether this actor may set editorial flags.
 *
 * `isFeatured` promotes a product on the homepage. That is an editorial
 * decision belonging to GLEX, not something a supplier grants themselves.
 */
export const canSetEditorialFlags = (user: SessionUser): boolean => isStaff(user.role)

/**
 * The `supplierId` a newly created product must carry.
 *
 * Staff may leave it unset (a GLEX-listed product) or attribute it later; a
 * supplier's own products are always attributed to them, so they cannot create
 * an unowned product that nobody can subsequently scope.
 */
export function supplierIdForNewProduct(
  user: SessionUser,
  supplierProfileId: string | null
): string | null {
  return isStaff(user.role) ? null : supplierProfileId
}
