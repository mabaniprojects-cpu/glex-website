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
    'inquiry:manage',
    'ticket:manage',
    'organization:write',
  ],

  [UserRole.SALES_OFFICER]: [...STAFF_BASE, 'rfq:manage', 'rfq:quote', 'inquiry:manage'],

  [UserRole.PROCUREMENT_MANAGER]: [
    ...STAFF_BASE,
    'rfq:manage',
    'rfq:assign',
    'product:write',
    'product:publish',
    'category:write',
    'supplier:approve',
  ],

  [UserRole.LOGISTICS_MANAGER]: [...STAFF_BASE, 'shipment:write', 'rfq:manage'],

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
