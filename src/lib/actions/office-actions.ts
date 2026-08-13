'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

/**
 * Office administration.
 *
 * These rows drive the addresses on the public contact page (`src/lib/offices.ts`),
 * so an edit here is immediately visible to the world — hence the audit trail
 * and the refusal to delete the last remaining office.
 *
 * Company *identity* — legal name, commercial registration, paid-up capital —
 * is not editable here. It lives in `src/lib/company.ts` because it is legally
 * fixed rather than content.
 */

export type OfficeActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'last_office' | 'server' }

/**
 * Latitude and longitude in decimal degrees.
 *
 * Empty means "not located" rather than the equator — `''` must not coerce to
 * 0, which would drop a pin in the Gulf of Guinea.
 */
const coordinate = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))

const officeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  // One address line per row, so the card can render them as written.
  addressLines: z.string().trim().max(600).optional(),
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  poBox: z.string().trim().max(40).optional(),
  postalCode: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  isPrimary: z.boolean().optional(),
})

export async function saveOffice(input: unknown): Promise<OfficeActionResult> {
  const actor = await requirePermission('settings:write')

  const parsed = officeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, addressLines, isPrimary, ...rest } = parsed.data

  const data = {
    ...rest,
    poBox: rest.poBox || null,
    postalCode: rest.postalCode || null,
    phone: rest.phone || null,
    addressLines: (addressLines ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    isPrimary: isPrimary ?? false,
  }

  try {
    const saved = await db.$transaction(async (tx) => {
      // Exactly one head office. Demoting the others here means the contact
      // page can order by `isPrimary` and trust the answer.
      if (data.isPrimary) {
        await tx.office.updateMany({
          where: id ? { id: { not: id } } : {},
          data: { isPrimary: false },
        })
      }

      if (id) {
        const before = await tx.office.findUnique({ where: { id } })
        if (!before) return null

        await tx.office.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: actor.id,
            action: 'office.updated',
            entityType: 'Office',
            entityId: id,
            before: { name: before.name, city: before.city, isPrimary: before.isPrimary },
            after: data,
          },
          tx
        )
        return { id }
      }

      const row = await tx.office.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'office.created',
          entityType: 'Office',
          entityId: row.id,
          after: data,
        },
        tx
      )
      return row
    })

    if (!saved) return { ok: false, error: 'not_found' }

    revalidateOffices()
    return { ok: true, id: saved.id }
  } catch (error) {
    console.error('[offices] Save failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteOffice(input: unknown): Promise<OfficeActionResult> {
  const actor = await requirePermission('settings:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    const office = await db.office.findUnique({
      where: { id },
      select: { id: true, name: true, city: true },
    })
    if (!office) return { ok: false, error: 'not_found' }

    // Removing the last office would leave the contact page with nothing but
    // the hard-coded fallback — which looks like it worked and quietly stops
    // reflecting anything an administrator does.
    const remaining = await db.office.count({ where: { id: { not: id } } })
    if (remaining === 0) return { ok: false, error: 'last_office' }

    await db.$transaction(async (tx) => {
      await tx.office.delete({ where: { id } })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'office.deleted',
          entityType: 'Office',
          entityId: id,
          before: { name: office.name, city: office.city },
        },
        tx
      )
    })

    revalidateOffices()
    return { ok: true }
  } catch (error) {
    console.error('[offices] Delete failed:', error)
    return { ok: false, error: 'server' }
  }
}

/** Every public surface that renders an address. */
function revalidateOffices() {
  revalidatePath('/[locale]/contact', 'page')
  revalidatePath('/[locale]/admin/offices', 'page')
}
