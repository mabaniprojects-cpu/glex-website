import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth-guards'

/**
 * Supplier dashboard queries.
 *
 * CRITICAL: a supplier must only ever see sourcing opportunities assigned to
 * their own `SupplierProfile`. That constraint is enforced in the SQL `where`
 * of every query here, never by filtering afterwards.
 */

/** Resolves the profile owned by the signed-in supplier user. */
export async function getMySupplierProfile(user: SessionUser) {
  if (!user.organizationId) return null

  return db.supplierProfile.findFirst({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: {
      organization: { select: { name: true, country: true, city: true } },
      contacts: true,
      categories: { include: { category: { select: { name: true } } } },
      documents: { include: { file: { select: { originalName: true } } } },
      _count: { select: { products: true } },
    },
  })
}

/**
 * Opportunities assigned to this supplier.
 *
 * Scoped by `supplierId`, so another supplier's rows are unreachable even if
 * an id were guessed.
 */
/**
 * NOTE: paginated, and ordered by a unique id as the final key. LIMIT/OFFSET
 * needs a total order — without a unique tiebreaker, rows sharing a timestamp
 * can appear on two pages, or on none at all.
 */
export async function listMyOpportunities(
  supplierId: string,
  { take = 20, skip = 0 } = {}
) {
  const where = { supplierId }

  const [items, total] = await Promise.all([
    db.sourcingOpportunity.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    skip,
    select: {
      id: true,
      status: true,
      message: true,
      response: true,
      dueAt: true,
      respondedAt: true,
      createdAt: true,
      // Only the commercial essentials of the RFQ are exposed — never the
      // client's identity, contact details or internal notes.
      rfq: {
        select: {
          reference: true,
          destinationCountry: true,
          incoterm: true,
          requiredDeliveryDate: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, quantity: true, unit: true },
          },
        },
      },
    },
    }),
    db.sourcingOpportunity.count({ where }),
  ])

  return { items, total }
}

export async function listMyProducts(supplierId: string, { take = 20, skip = 0 } = {}) {
  const where = { supplierId, deletedAt: null }

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        slug: true,
        name: true,
        brand: true,
        isVisible: true,
        isFeatured: true,
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where }),
  ])

  return { items, total }
}

/**
 * Profile completeness, used for the progress indicator.
 *
 * Weighted by what actually matters to an approver rather than counting every
 * field equally.
 */
export function computeCompletion(profile: {
  legalName: string | null
  country: string | null
  crNumber: string | null
  description: string | null
  brands: string[]
  marketsServed: string[]
  availableIncoterms: unknown[]
  contacts: unknown[]
  documents: unknown[]
  categories: unknown[]
}): number {
  const checks: Array<[boolean, number]> = [
    [Boolean(profile.legalName), 15],
    [Boolean(profile.country), 10],
    [Boolean(profile.crNumber), 15],
    [Boolean(profile.description), 10],
    [profile.categories.length > 0, 15],
    [profile.contacts.length > 0, 15],
    [profile.documents.length > 0, 10],
    [profile.brands.length > 0, 5],
    [profile.marketsServed.length > 0, 5],
    [profile.availableIncoterms.length > 0, 5],
  ]

  const earned = checks.reduce((total, [done, weight]) => total + (done ? weight : 0), 0)
  return Math.min(100, earned)
}

/**
 * How many opportunities are still awaiting a response.
 *
 * A dedicated count rather than `listMyOpportunities(...).items.filter(...)`:
 * once the list is paginated, filtering the returned page would silently count
 * only the first 20 and report a smaller number than the truth.
 */
export async function countOpenOpportunities(supplierId: string): Promise<number> {
  return db.sourcingOpportunity.count({ where: { supplierId, status: 'ASSIGNED' } })
}
