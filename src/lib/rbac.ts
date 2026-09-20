import { UserRole } from '@prisma/client'

/**
 * Role-based access control.
 *
 * Every permission check in the application resolves through this module.
 * Permissions are ALWAYS enforced on the server (page, server action, route
 * handler); hiding a control in the UI is a convenience, never a security
 * boundary.
 */

export const PERMISSIONS = [
  // Catalogue
  'product:read',
  'product:write',
  'product:publish',
  'category:write',
  // RFQ
  'rfq:read:own',
  'rfq:read:all',
  'rfq:write:own',
  'rfq:manage',
  'rfq:assign',
  'rfq:quote',
  // Desks in the internal quotation process. One permission per desk, so a
  // role can hold exactly the hand-offs it is responsible for and no others.
  'rfq:stage:cs',
  'rfq:stage:supply',
  'rfq:stage:procurement',
  'rfq:stage:technical',
  'rfq:stage:shipping',
  'rfq:approve',
  // Suppliers
  'supplier:read:own',
  'supplier:read:all',
  'supplier:write:own',
  'supplier:approve',
  // Shipments
  'shipment:read:own',
  'shipment:read:all',
  'shipment:write',
  // Content
  'news:read',
  'news:write',
  'news:publish',
  'page:write',
  'translation:write',
  // Support
  'inquiry:read',
  'inquiry:manage',
  'ticket:read:own',
  'ticket:manage',
  // Finance
  'finance:read',
  'quotation:settle',
  // Administration
  'user:read',
  'user:write',
  'organization:read',
  'organization:write',
  'audit:read',
  'settings:write',
  'knowledge:write',
  'impersonate',
  'admin:access',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const CLIENT_BASE: Permission[] = [
  'product:read',
  'news:read',
  'rfq:read:own',
  'rfq:write:own',
  'shipment:read:own',
  'ticket:read:own',
]

const SUPPLIER_BASE: Permission[] = [
  'product:read',
  'news:read',
  'supplier:read:own',
  'supplier:write:own',
  'ticket:read:own',
]

const STAFF_BASE: Permission[] = [
  'admin:access',
  'product:read',
  'news:read',
  'rfq:read:all',
  'supplier:read:all',
  'shipment:read:all',
  'user:read',
  'organization:read',
  'inquiry:read',
]

/** Every desk permission, for "may this person act on the workflow at all". */
export const STAGE_PERMISSIONS: Permission[] = [
  'rfq:stage:cs',
  'rfq:stage:supply',
  'rfq:stage:procurement',
  'rfq:stage:technical',
  'rfq:stage:shipping',
]

/**
 * The permission matrix. Roles are intentionally explicit rather than
 * hierarchical so that widening one role can never silently widen another.
 */
const MATRIX: Record<UserRole, readonly Permission[]> = {
  [UserRole.SUPER_ADMIN]: PERMISSIONS,

  [UserRole.ADMIN]: PERMISSIONS.filter((p) => p !== 'impersonate'),

  [UserRole.SALES_MANAGER]: [
    ...STAFF_BASE,
    'rfq:manage',
    'rfq:assign',
    'rfq:quote',
    'rfq:stage:cs',
    'rfq:stage:supply',
    'inquiry:manage',
    'ticket:manage',
    'organization:write',
  ],

  [UserRole.SALES_OFFICER]: [
    ...STAFF_BASE,
    'rfq:manage',
    'rfq:quote',
    'rfq:stage:cs',
    'inquiry:manage',
  ],

  [UserRole.PROCUREMENT_MANAGER]: [
    ...STAFF_BASE,
    'rfq:manage',
    'rfq:assign',
    'rfq:stage:procurement',
    // Mabani, the technical office, is a separate company in the group with no
    // account here. Procurement commissions the study and files the answer.
    'rfq:stage:technical',
    'product:write',
    'product:publish',
    'category:write',
    'supplier:approve',
  ],

  [UserRole.LOGISTICS_MANAGER]: [
    ...STAFF_BASE,
    'shipment:write',
    'rfq:manage',
    'rfq:stage:shipping',
  ],

  [UserRole.CONTENT_EDITOR]: [
    'admin:access',
    'product:read',
    'product:write',
    'category:write',
    'news:read',
    'news:write',
    'news:publish',
    'page:write',
    'translation:write',
    'knowledge:write',
  ],

  /**
   * Customer service, which in this company is also marketing: one person
   * answers the client and keeps the public site current. They own both ends
   * of the conversation — intake and sending the finished quotation — and
   * nothing in between.
   */
  [UserRole.CUSTOMER_SERVICE]: [
    'admin:access',
    'product:read',
    'product:write',
    'news:read',
    'news:write',
    'news:publish',
    'page:write',
    'translation:write',
    'knowledge:write',
    'rfq:read:all',
    'rfq:manage',
    'rfq:quote',
    'rfq:stage:cs',
    'inquiry:read',
    'inquiry:manage',
    'ticket:manage',
    'organization:read',
    'shipment:read:all',
  ],

  /** Supply chain orchestrates: it dispatches the pricing work and compiles the result. */
  [UserRole.SUPPLY_CHAIN_MANAGER]: [
    'admin:access',
    'product:read',
    'news:read',
    'rfq:read:all',
    'rfq:assign',
    'rfq:stage:supply',
    'supplier:read:all',
    'shipment:read:all',
    'organization:read',
  ],

  /** The technical office studies large orders and returns the material list. */
  [UserRole.PMO_TECHNICAL]: [
    'admin:access',
    'product:read',
    'news:read',
    'rfq:read:all',
    'rfq:stage:technical',
    'supplier:read:all',
  ],

  /** The shipping desk prices freight and maintains the shipments it creates. */
  [UserRole.LOGISTICS_SUPPORT]: [
    'admin:access',
    'product:read',
    'news:read',
    'rfq:read:all',
    'rfq:stage:shipping',
    'shipment:read:all',
    'shipment:write',
  ],

  /**
   * Finance reads the commercial record and settles it. It deliberately holds
   * no write permission over RFQs, products or people: recording that an order
   * was invoiced must not come with the ability to change what was quoted.
   */
  [UserRole.ACCOUNTANT]: [
    'admin:access',
    'product:read',
    'news:read',
    'rfq:read:all',
    'shipment:read:all',
    'supplier:read:all',
    'organization:read',
    'finance:read',
    'quotation:settle',
  ],

  [UserRole.SUPPORT_AGENT]: [
    'admin:access',
    'product:read',
    'news:read',
    'rfq:read:all',
    'shipment:read:all',
    'inquiry:read',
    'inquiry:manage',
    'ticket:manage',
  ],

  [UserRole.APPROVED_SUPPLIER]: [...SUPPLIER_BASE, 'product:write'],

  // A pending supplier may complete its own application and nothing else.
  [UserRole.PENDING_SUPPLIER]: SUPPLIER_BASE,

  [UserRole.DISTRIBUTOR]: [...SUPPLIER_BASE, 'product:write'],

  [UserRole.CLIENT_ORG_ADMIN]: [...CLIENT_BASE, 'organization:write', 'user:read'],

  [UserRole.CLIENT_TEAM_MEMBER]: CLIENT_BASE,
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return MATRIX[role] ?? []
}

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return permissionsFor(role).includes(permission)
}

export function canAny(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p))
}

export function canAll(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p))
}

/** Roles that may open the admin portal at all. */
export const isStaff = (role: UserRole | null | undefined) => can(role, 'admin:access')

export const isSupplierRole = (role: UserRole | null | undefined) =>
  role === UserRole.APPROVED_SUPPLIER ||
  role === UserRole.PENDING_SUPPLIER ||
  role === UserRole.DISTRIBUTOR

export const isClientRole = (role: UserRole | null | undefined) =>
  role === UserRole.CLIENT_ORG_ADMIN || role === UserRole.CLIENT_TEAM_MEMBER

/** Whether a role takes part in the internal quotation process at all. */
export const worksTheWorkflow = (role: UserRole | null | undefined) =>
  canAny(role, [...STAGE_PERMISSIONS, 'rfq:approve'])

/** Landing route for a role immediately after sign-in. */
export function homeRouteFor(role: UserRole): '/admin' | '/supplier' | '/dashboard' {
  if (isStaff(role)) return '/admin'
  if (isSupplierRole(role)) return '/supplier'
  return '/dashboard'
}

/**
 * Whether `actor` may assign `target` as a role.
 *
 * The rule is containment: you can only hand out authority you already hold.
 * Without it an ADMIN could mint a SUPER_ADMIN and inherit `impersonate` — the
 * one permission the matrix deliberately withholds from them — so every
 * privilege boundary in the matrix would be one click from being bypassed.
 */
export function canAssignRole(actor: UserRole, target: UserRole): boolean {
  const held = new Set(permissionsFor(actor))
  return permissionsFor(target).every((permission) => held.has(permission))
}
