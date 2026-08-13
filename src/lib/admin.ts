import {
  OrganizationType,
  Prisma,
  RfqStatus,
  SupplierStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Admin portal queries.
 *
 * Callers must already have passed a guard from `src/lib/auth-guards.ts` —
 * nothing here performs its own authorization.
 */

const OPEN_RFQ_STATUSES = [
  RfqStatus.SUBMITTED,
  RfqStatus.UNDER_REVIEW,
  RfqStatus.CLARIFICATION_REQUIRED,
  RfqStatus.SUPPLIER_SOURCING,
  RfqStatus.QUOTATION_PREPARED,
  RfqStatus.QUOTATION_SENT,
  RfqStatus.CLIENT_REVIEWING,
]

const CLOSED_SHIPMENT_STATUSES = ['DELIVERED', 'CANCELLED'] as const

/** Headline metrics for the admin overview. */
export async function getAdminMetrics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)

  const [
    newClients,
    newSuppliers,
    pendingApprovals,
    openRfqs,
    activeShipments,
    delayedShipments,
    openInquiries,
    rfqsByStatus,
  ] = await Promise.all([
    db.clientProfile.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.supplierProfile.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
    db.supplierProfile.count({
      where: {
        deletedAt: null,
        status: { in: [SupplierStatus.SUBMITTED, SupplierStatus.UNDER_REVIEW] },
      },
    }),
    db.rFQ.count({ where: { deletedAt: null, status: { in: OPEN_RFQ_STATUSES } } }),
    db.shipment.count({
      where: { deletedAt: null, status: { notIn: [...CLOSED_SHIPMENT_STATUSES] } },
    }),
    db.shipment.count({
      where: { deletedAt: null, status: { in: ['DELAYED', 'EXCEPTION'] } },
    }),
    db.contactInquiry.count({ where: { deletedAt: null, status: { in: ['NEW', 'IN_PROGRESS'] } } }),
    db.rFQ.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ])

  return {
    newClients,
    newSuppliers,
    pendingApprovals,
    openRfqs,
    activeShipments,
    delayedShipments,
    openInquiries,
    rfqsByStatus: rfqsByStatus
      .map((row) => ({ status: row.status, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * NOTE: paginated queries below order by a unique id as the final key.
 * LIMIT/OFFSET needs a total order — without a unique tiebreaker, rows sharing
 * a timestamp can appear on two pages, or on none at all.
 */
export async function listAllRfqs({
  status,
  take = 30,
  skip = 0,
}: { status?: RfqStatus; take?: number; skip?: number } = {}) {
  const where = { deletedAt: null, ...(status ? { status } : {}) }

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
        isGuest: true,
        emailVerified: true,
        organization: { select: { name: true } },
        createdBy: { select: { name: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.rFQ.count({ where }),
  ])

  return { items, total }
}

export async function getRfqForAdmin(reference: string) {
  return db.rFQ.findFirst({
    where: { reference, deletedAt: null },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      // Admins see internal notes as well as client-visible messages.
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true } } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true } } },
      },
      organization: { select: { name: true, country: true } },
      createdBy: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
    },
  })
}

/** Staff who can be assigned an RFQ. */
export async function listAssignableStaff() {
  return db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: {
        in: [
          'SUPER_ADMIN',
          'ADMIN',
          'SALES_MANAGER',
          'SALES_OFFICER',
          'PROCUREMENT_MANAGER',
          'LOGISTICS_MANAGER',
        ],
      },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
}

export async function listSuppliersForAdmin({
  status,
  take = 30,
  skip = 0,
}: { status?: SupplierStatus; take?: number; skip?: number } = {}) {
  const where = { deletedAt: null, ...(status ? { status } : {}) }

  const [items, total] = await Promise.all([
    db.supplierProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        legalName: true,
        status: true,
        kind: true,
        country: true,
        city: true,
        completionPercent: true,
        submittedAt: true,
        createdAt: true,
        organization: { select: { slug: true, name: true } },
        _count: { select: { products: true, documents: true } },
      },
    }),
    db.supplierProfile.count({ where }),
  ])

  return { items, total }
}

export async function getSupplierForAdmin(id: string) {
  return db.supplierProfile.findFirst({
    where: { id, deletedAt: null },
    include: {
      organization: true,
      contacts: true,
      categories: { include: { category: { select: { name: true } } } },
      documents: { include: { file: { select: { originalName: true } } } },
      certifications: true,
      _count: { select: { products: true } },
    },
  })
}

export async function listShipmentsForAdmin({ take = 30, skip = 0 } = {}) {
  const where = { deletedAt: null }

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
        isDemo: true,
        organization: { select: { name: true } },
      },
    }),
    db.shipment.count({ where }),
  ])

  return { items, total }
}

export async function listInquiriesForAdmin({ take = 30, skip = 0 } = {}) {
  const where = { deletedAt: null }

  const [items, total] = await Promise.all([
    db.contactInquiry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        fullName: true,
        company: true,
        country: true,
        subject: true,
        createdAt: true,
      },
    }),
    db.contactInquiry.count({ where }),
  ])

  return { items, total }
}

export async function listProductsForAdmin({ take = 30, skip = 0, q = '' } = {}) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { brand: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

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
        isSaudiMade: true,
        createdAt: true,
        category: { select: { name: true } },
        supplier: { select: { legalName: true } },
      },
    }),
    db.product.count({ where }),
  ])

  return { items, total }
}

export async function getProductForAdmin(id: string) {
  return db.product.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      brand: true,
      manufacturer: true,
      countryOfOrigin: true,
      hsCode: true,
      packaging: true,
      minimumOrderQty: true,
      leadTimeDays: true,
      isSaudiMade: true,
      allowEquivalents: true,
      isVisible: true,
      isFeatured: true,
      availableUnits: true,
      certifications: true,
      categoryId: true,
      // Every locale, not just the active one — the editor shows which are
      // translated and which still fall back to English.
      translations: true,
    },
  })
}

/** Every live category, flattened, for a picker or a management table. */
export async function listCategoriesForAdmin() {
  return db.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isActive: true,
      sortOrder: true,
      parentId: true,
      parent: { select: { name: true } },
      _count: { select: { products: true, children: true } },
    },
  })
}

export async function listNewsForAdmin({ take = 30, skip = 0, q = '' } = {}) {
  // Includes drafts, scheduled and archived articles — this is the authoring
  // view, not the public one. Soft-deleted rows stay hidden.
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        isFeatured: true,
        isSample: true,
        publishedAt: true,
        createdAt: true,
        category: { select: { name: true } },
        author: { select: { name: true } },
      },
    }),
    db.newsArticle.count({ where }),
  ])

  return { items, total }
}

export async function getNewsForAdmin(id: string) {
  return db.newsArticle.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      status: true,
      isFeatured: true,
      isSample: true,
      publishedAt: true,
      featuredImage: true,
      seoTitle: true,
      seoDescription: true,
      categoryId: true,
      translations: true,
    },
  })
}

export async function listNewsCategoriesForAdmin() {
  return db.newsCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
}

/**
 * Escapes a value for CSV.
 *
 * A leading =, +, - or @ is prefixed with a single quote so spreadsheet
 * software cannot interpret exported data as a formula.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text = value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`

  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(csvCell).join(',')
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))
  return [header, ...body].join('\r\n')
}

/**
 * Fields safe to send to the client.
 *
 * `passwordHash` is deliberately absent: this shape crosses the Server→Client
 * boundary, and a hash that is never selected cannot be leaked by a careless
 * spread further down.
 */
const USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  emailVerified: true,
  lockedUntil: true,
  failedLoginCount: true,
  lastLoginAt: true,
  createdAt: true,
  organization: { select: { id: true, name: true } },
} as const

/**
 * Users for the administration list.
 *
 * Search covers name and email; the role filter is validated by the caller
 * against the enum, so an arbitrary string can never reach the query. The
 * select deliberately omits `passwordHash` — see `USER_LIST_SELECT`.
 */
export async function listUsersForAdmin({
  take = 30,
  skip = 0,
  search,
  role,
}: {
  take?: number
  skip?: number
  search?: string
  role?: UserRole
} = {}) {
  const term = search?.trim()

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: USER_LIST_SELECT,
    }),
    db.user.count({ where }),
  ])

  // Resolved here rather than in the page: a lockout is a point-in-time
  // comparison, and reading the clock during render is neither pure nor
  // meaningful once the result is cached.
  const now = Date.now()
  const items = rows.map((row) => ({
    ...row,
    isLocked: Boolean(row.lockedUntil && row.lockedUntil.getTime() > now),
  }))

  return { items, total }
}

/**
 * Organizations for the administration list.
 *
 * The counts drive the delete guard in `deleteOrganization` — an organization
 * holding users, RFQs or shipments cannot be removed — so they are shown in the
 * list rather than discovered only on a refused click.
 */
export async function listOrganizationsForAdmin({
  take = 30,
  skip = 0,
  search,
  type,
}: {
  take?: number
  skip?: number
  search?: string
  type?: OrganizationType
} = {}) {
  const term = search?.trim()

  const where: Prisma.OrganizationWhereInput = {
    deletedAt: null,
    ...(type ? { type } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { slug: { contains: term, mode: 'insensitive' as const } },
            { country: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        country: true,
        city: true,
        address: true,
        website: true,
        phone: true,
        vatNumber: true,
        crNumber: true,
        description: true,
        isActive: true,
        createdAt: true,
        _count: { select: { users: true, rfqs: true, shipments: true } },
      },
    }),
    db.organization.count({ where }),
  ])

  return { items, total }
}

/**
 * Chat transcripts for the support view.
 *
 * Read-only by design: a transcript is a record of what a visitor was told, and
 * editing one would destroy its only value. The visitor id is an opaque cookie
 * value, never an IP, and is not selected here — staff need to read the
 * conversation, not to re-identify an anonymous visitor.
 */
export async function listChatConversationsForAdmin({
  take = 30,
  skip = 0,
  escalatedOnly = false,
}: { take?: number; skip?: number; escalatedOnly?: boolean } = {}) {
  const where: Prisma.ChatConversationWhereInput = escalatedOnly
    ? { handoffAt: { not: null } }
    : {}

  const [items, total] = await Promise.all([
    db.chatConversation.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      select: {
        id: true,
        locale: true,
        title: true,
        handoffAt: true,
        feedback: true,
        createdAt: true,
        updatedAt: true,
        // The signed-in account when there was one; anonymous stays anonymous.
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.chatConversation.count({ where }),
  ])

  return { items, total }
}

export async function getChatConversationForAdmin(id: string) {
  return db.chatConversation.findUnique({
    where: { id },
    select: {
      id: true,
      locale: true,
      title: true,
      handoffAt: true,
      feedback: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, toolsUsed: true, createdAt: true },
      },
    },
  })
}

/**
 * Support tickets for the admin queue.
 *
 * Unlike the client-side query this includes internal messages, so the count
 * reflects the full working thread.
 */
export async function listTicketsForAdmin({
  take = 30,
  skip = 0,
  status,
}: { take?: number; skip?: number; status?: TicketStatus } = {}) {
  const where: Prisma.SupportTicketWhereInput = status ? { status } : {}

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
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.supportTicket.count({ where }),
  ])

  return { items, total }
}

export async function getTicketForAdmin(reference: string) {
  return db.supportTicket.findFirst({
    where: { reference },
    select: {
      id: true,
      reference: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      requester: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
      // Staff see internal notes as well as what the requester was told.
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          isInternal: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  })
}
