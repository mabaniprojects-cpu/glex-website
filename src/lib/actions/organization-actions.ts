'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

/**
 * Organization administration.
 *
 * An organization owns users, RFQs and shipments, so nothing here deletes one
 * outright. Switching one off is the real lever, and it is a heavy one:
 * `src/lib/auth.ts` refuses a session to every member of a disabled
 * organization, so this ends access for a whole company at once.
 *
 * The slug is never accepted from the client — it is derived once at creation
 * and left alone, because it is a URL others may already hold.
 */

export type OrganizationActionResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'not_found' | 'in_use' | 'server' }

/**
 * Only http(s) links are accepted.
 *
 * A `javascript:` URL stored here would become stored XSS the moment the
 * organization's website is rendered as an href.
 */
const webUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), 'must be http(s)')

const detailsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  website: z.union([z.literal(''), webUrl]).optional(),
  phone: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(50).optional(),
  crNumber: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
})

export async function updateOrganization(input: unknown): Promise<OrganizationActionResult> {
  const actor = await requirePermission('organization:write')

  const parsed = detailsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, ...fields } = parsed.data

  const before = await db.organization.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      country: true,
      city: true,
      address: true,
      website: true,
      phone: true,
      vatNumber: true,
      crNumber: true,
      description: true,
    },
  })
  if (!before) return { ok: false, error: 'not_found' }

  // Empty strings are stored as NULL so "not provided" has one representation.
  const data = {
    name: fields.name,
    country: fields.country || null,
    city: fields.city || null,
    address: fields.address || null,
    website: fields.website || null,
    phone: fields.phone || null,
    vatNumber: fields.vatNumber || null,
    crNumber: fields.crNumber || null,
    description: fields.description || null,
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'organization.updated',
          entityType: 'Organization',
          entityId: id,
          before,
          after: data,
        },
        tx
      )
    })

    revalidatePath('/admin/organizations')
    return { ok: true }
  } catch (error) {
    console.error('[organizations] Update failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Activation -------------------------------------------------------------

const activationSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

/**
 * Enables or disables an entire organization.
 *
 * Disabling denies a session to every member — see `src/lib/auth.ts` — so their
 * sessions are cleared here too rather than left to expire.
 */
export async function setOrganizationActive(
  input: unknown
): Promise<OrganizationActionResult> {
  const actor = await requirePermission('organization:write')

  const parsed = activationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, isActive } = parsed.data

  const before = await db.organization.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, isActive: true },
  })
  if (!before) return { ok: false, error: 'not_found' }

  // Locking the operator's own company out of the portal would take the portal
  // with it, so GLEX's own organization is not switchable from here.
  if (!isActive && actor.organizationId === id) return { ok: false, error: 'in_use' }

  if (before.isActive === isActive) return { ok: true }

  try {
    await db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data: { isActive } })

      if (!isActive) {
        await tx.session.deleteMany({ where: { user: { organizationId: id } } })
      }

      await recordAudit(
        {
          actorId: actor.id,
          action: isActive ? 'organization.activated' : 'organization.deactivated',
          entityType: 'Organization',
          entityId: id,
          before: { isActive: before.isActive },
          after: { isActive },
        },
        tx
      )
    })

    revalidatePath('/admin/organizations')
    return { ok: true }
  } catch (error) {
    console.error('[organizations] Activation change failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Deletion ---------------------------------------------------------------

const idSchema = z.object({ id: z.string().uuid() })

/**
 * Soft-deletes an organization that holds nothing.
 *
 * An organization with users, RFQs or shipments is refused rather than
 * cascaded: those records are commercial history, and losing the organization
 * they hang from would orphan them. Deactivation is the tool for a company that
 * has left.
 */
export async function deleteOrganization(input: unknown): Promise<OrganizationActionResult> {
  const actor = await requirePermission('organization:write')

  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  const organization = await db.organization.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: { select: { users: true, rfqs: true, shipments: true } },
    },
  })
  if (!organization) return { ok: false, error: 'not_found' }

  if (actor.organizationId === id) return { ok: false, error: 'in_use' }

  const { users, rfqs, shipments } = organization._count
  if (users > 0 || rfqs > 0 || shipments > 0) return { ok: false, error: 'in_use' }

  try {
    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'organization.deleted',
          entityType: 'Organization',
          entityId: id,
          before: { name: organization.name },
        },
        tx
      )
    })

    revalidatePath('/admin/organizations')
    return { ok: true }
  } catch (error) {
    console.error('[organizations] Delete failed:', error)
    return { ok: false, error: 'server' }
  }
}
