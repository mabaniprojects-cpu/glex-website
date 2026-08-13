import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth-guards'
import { can } from '@/lib/rbac'

/**
 * Client dashboard queries.
 *
 * Every query is scoped in SQL, never filtered after the fact. A client sees
 * only records belonging to their own organization, or created by them
 * personally when they have no organization.
 */

/**
 * The ownership predicate for RFQs.
 *
 * Staff with `rfq:read:all` are unrestricted. Everyone else matches on their
 * organization OR their own user id — the latter covers a client who submitted
 * before joining an organization.
 */
export function rfqScope(user: SessionUser): Prisma.RFQWhereInput {
  if (can(user.role, 'rfq:read:all')) return {}

  const clauses: Prisma.RFQWhereInput[] = [{ createdById: user.id }]
  if (user.organizationId) clauses.push({ organizationId: user.organizationId })

  return { OR: clauses }
}

export function shipmentScope(user: SessionUser): Prisma.ShipmentWhereInput {
  if (can(user.role, 'shipment:read:all')) return {}

  // A user with no organization can never match a scoped shipment.
  return { organizationId: user.organizationId ?? '__none__' }
}

/** Statuses that mean "still in flight" for the summary cards. */
const ACTIVE_RFQ_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUIRED',
  'SUPPLIER_SOURCING',
  'QUOTATION_PREPARED',
  'QUOTATION_SENT',
  'CLIENT_REVIEWING',
] as const

const CLOSED_SHIPMENT_STATUSES = ['DELIVERED', 'CANCELLED'] as const

export async function getDashboardSummary(user: SessionUser) {
  const rfqWhere = { ...rfqScope(user), deletedAt: null }
  const shipmentWhere = { ...shipmentScope(user), deletedAt: null }

  const [activeRfqs, clarifications, quotations, activeShipments, unreadNotifications, savedProducts] =
    await Promise.all([
      db.rFQ.count({ where: { ...rfqWhere, status: { in: [...ACTIVE_RFQ_STATUSES] } } }),
      db.rFQ.count({ where: { ...rfqWhere, status: 'CLARIFICATION_REQUIRED' } }),
      db.quotation.count({ where: { rfq: rfqWhere, sentAt: { not: null } } }),
      db.shipment.count({
        where: { ...shipmentWhere, status: { notIn: [...CLOSED_SHIPMENT_STATUSES] } },
      }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
      db.savedProduct.count({ where: { userId: user.id } }),
    ])

  return { activeRfqs, clarifications, quotations, activeShipments, unreadNotifications, savedProducts }
}

/**
 * NOTE: paginated queries below order by a unique id as the final key.
 * LIMIT/OFFSET needs a total order — without a unique tiebreaker, rows sharing
 * a timestamp can appear on two pages, or on none at all.
 */
export async function listMyRfqs(user: SessionUser, { take = 20, skip = 0 } = {}) {
  const where = { ...rfqScope(user), deletedAt: null }

  const [items, total] = await Promise.all([
    db.rFQ.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        reference: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        destinationCountry: true,
        destinationCity: true,
        projectName: true,
        _count: { select: { items: true, messages: true } },
      },
    }),
    db.rFQ.count({ where }),
  ])

  return { items, total }
}

/**
 * Fetches a single RFQ for its owner.
 *
 * Returns null rather than throwing when the RFQ exists but belongs to someone
 * else, so the caller renders a plain 404 and never confirms its existence.
 */
export async function getMyRfq(user: SessionUser, reference: string) {
  return db.rFQ.findFirst({
    where: { reference, deletedAt: null, ...rfqScope(user) },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      // Internal staff notes must never reach a client.
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true } } },
      },
      quotations: {
        where: { sentAt: { not: null } },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          reference: true,
          version: true,
          currency: true,
          validUntil: true,
          sentAt: true,
          acceptedAt: true,
          rejectedAt: true,
          fileId: true,
        },
      },
      assignee: { select: { name: true } },
    },
  })
}

export async function listMyShipments(user: SessionUser, { take = 20, skip = 0 } = {}) {
  const where = { ...shipmentScope(user), deletedAt: null }

  const [items, total] = await Promise.all([
    db.shipment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        reference: true,
        status: true,
        mode: true,
        originCountry: true,
        destinationCountry: true,
        estimatedArrival: true,
        progressPercent: true,
        isDemo: true,
      },
    }),
    db.shipment.count({ where }),
  ])

  return { items, total }
}

/** Recent milestone events across the user's shipments. */
export async function listRecentShipmentEvents(user: SessionUser, take = 6) {
  return db.shipmentEvent.findMany({
    where: { shipment: { ...shipmentScope(user), deletedAt: null } },
    orderBy: { occurredAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      location: true,
      occurredAt: true,
      isException: true,
      shipment: { select: { reference: true } },
    },
  })
}

export async function listMyNotifications(user: SessionUser, take = 30) {
  return db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

export async function listSavedProducts(user: SessionUser) {
  return db.savedProduct.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          brand: true,
          isVisible: true,
          deletedAt: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        },
      },
    },
  })
}

/**
 * The signed-in user's own organization, with its team.
 *
 * Scoped by `user.organizationId` rather than by an id from the URL — there is
 * no route parameter to tamper with, so a client cannot ask for another
 * company's roster at all.
 *
 * Emails are included: these are colleagues inside one organization, which is
 * the one context where seeing a teammate's address is expected rather than a
 * leak.
 */
export async function getMyOrganization(user: SessionUser) {
  if (!user.organizationId) return null

  return db.organization.findFirst({
    where: { id: user.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      country: true,
      city: true,
      address: true,
      website: true,
      phone: true,
      vatNumber: true,
      crNumber: true,
      createdAt: true,
      members: {
        orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          role: true,
          isOwner: true,
          acceptedAt: true,
          user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
        },
      },
    },
  })
}

/**
 * Documents belonging to the user's organization.
 *
 * Only files already attached to that organization are listed. The download
 * itself is authorised separately by `/api/files/[id]`, which returns 404 —
 * not 403 — to an unauthorised caller so ids cannot be probed.
 */
export async function listMyDocuments(user: SessionUser, { take = 30, skip = 0 } = {}) {
  if (!user.organizationId) return { items: [], total: 0 }

  const where = { organizationId: user.organizationId, deletedAt: null }

  const [items, total] = await Promise.all([
    db.storedFile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        // `StoredFile` records `uploadedById` but declares no `User` relation,
        // so the uploader's name is not reachable without a second query.
      },
    }),
    db.storedFile.count({ where }),
  ])

  return { items, total }
}

/**
 * The signed-in user's own support tickets.
 *
 * Scoped by `requesterId` in SQL, so another person's reference is
 * indistinguishable from one that does not exist.
 */
export async function listMyTickets(user: SessionUser, { take = 20, skip = 0 } = {}) {
  const where = { requesterId: user.id }

  const [items, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        // Only messages the requester may see, so the count cannot hint at
        // internal discussion.
        _count: { select: { messages: { where: { isInternal: false } } } },
      },
    }),
    db.supportTicket.count({ where }),
  ])

  return { items, total }
}

/**
 * One ticket, for its requester.
 *
 * Returns null rather than throwing when the ticket belongs to someone else, so
 * the caller renders a plain 404 and never confirms its existence.
 */
export async function getMyTicket(user: SessionUser, reference: string) {
  return db.supportTicket.findFirst({
    where: { reference, requesterId: user.id },
    select: {
      id: true,
      reference: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      assignee: { select: { name: true } },
      // Internal staff notes must never reach the requester.
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  })
}
