'use server'

import { Locale, ShipmentMode } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { fromDateTimeLocalInput } from '@/lib/utils'

/**
 * Site settings: the announcement bar, social links, FAQ entries and the trade
 * routes drawn on the homepage map.
 *
 * Each action re-checks its own permission — Server Actions POST to the page's
 * own URL — and audits the change in the same transaction that performs it.
 */

export type SettingsActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'server' }

const optionalDate = z
  .union([z.literal(''), z.string().max(40)])
  .optional()
  .transform((value) => fromDateTimeLocalInput(value))

/**
 * Only http(s) links are accepted.
 *
 * A `javascript:` or `data:` URL in an admin-managed field would become stored
 * XSS the moment it is rendered as an href.
 */
const webUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), 'must be http(s)')

// --- Announcement bar -------------------------------------------------------

const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  message: z.string().trim().min(3).max(300),
  href: z.union([z.literal(''), webUrl]).optional(),
  variant: z.enum(['info', 'warning', 'success']),
  isActive: z.boolean().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
})

export async function saveAnnouncement(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = announcementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, href, startsAt, endsAt, ...rest } = parsed.data

  // An end before its start would silently hide the announcement forever.
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: 'validation' }

  const data = { ...rest, href: href || null, startsAt, endsAt, isActive: rest.isActive ?? false }

  try {
    if (id) {
      const before = await db.announcement.findUnique({
        where: { id },
        select: { id: true, message: true, isActive: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.announcement.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: user.id,
            action: 'announcement.updated',
            entityType: 'Announcement',
            entityId: id,
            before,
            after: data,
          },
          tx
        )
      })

      revalidateSite()
      return { ok: true, id }
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.announcement.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'announcement.created',
          entityType: 'Announcement',
          entityId: row.id,
          after: data,
        },
        tx
      )
      return row
    })

    revalidateSite()
    return { ok: true, id: created.id }
  } catch (error) {
    console.error('[settings] saveAnnouncement failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteAnnouncement(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const before = await db.announcement.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, message: true },
    })
    if (!before) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id: parsed.data.id } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'announcement.deleted',
          entityType: 'Announcement',
          entityId: parsed.data.id,
          before,
        },
        tx
      )
    })

    revalidateSite()
    return { ok: true }
  } catch (error) {
    console.error('[settings] deleteAnnouncement failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Social links -----------------------------------------------------------

const socialSchema = z.object({
  id: z.string().uuid().optional(),
  platform: z.string().trim().min(2).max(40),
  url: webUrl,
  sortOrder: z.union([z.literal(''), z.coerce.number().int().min(0).max(9999)]).optional(),
  isActive: z.boolean().optional(),
})

export async function saveSocialLink(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = socialSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, sortOrder, ...rest } = parsed.data
  const data = {
    ...rest,
    sortOrder: sortOrder === '' || sortOrder === undefined ? 0 : sortOrder,
    isActive: rest.isActive ?? true,
  }

  try {
    if (id) {
      const before = await db.socialLink.findUnique({
        where: { id },
        select: { id: true, platform: true, url: true, isActive: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.socialLink.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: user.id,
            action: 'social_link.updated',
            entityType: 'SocialLink',
            entityId: id,
            before,
            after: data,
          },
          tx
        )
      })

      revalidateSite()
      return { ok: true, id }
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.socialLink.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'social_link.created',
          entityType: 'SocialLink',
          entityId: row.id,
          after: data,
        },
        tx
      )
      return row
    })

    revalidateSite()
    return { ok: true, id: created.id }
  } catch (error) {
    console.error('[settings] saveSocialLink failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteSocialLink(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const before = await db.socialLink.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, platform: true, url: true },
    })
    if (!before) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.socialLink.delete({ where: { id: parsed.data.id } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'social_link.deleted',
          entityType: 'SocialLink',
          entityId: parsed.data.id,
          before,
        },
        tx
      )
    })

    revalidateSite()
    return { ok: true }
  } catch (error) {
    console.error('[settings] deleteSocialLink failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- FAQ --------------------------------------------------------------------

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(3).max(4000),
  locale: z.nativeEnum(Locale),
  category: z.string().trim().max(80).optional(),
  sortOrder: z.union([z.literal(''), z.coerce.number().int().min(0).max(9999)]).optional(),
  isActive: z.boolean().optional(),
})

export async function saveFaqEntry(input: unknown): Promise<SettingsActionResult> {
  // FAQ entries feed the public FAQ page and the assistant's deterministic
  // fallback, so they are gated as knowledge rather than as site settings.
  const user = await requirePermission('knowledge:write')

  const parsed = faqSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, sortOrder, category, ...rest } = parsed.data
  const data = {
    ...rest,
    category: category || null,
    sortOrder: sortOrder === '' || sortOrder === undefined ? 0 : sortOrder,
    isActive: rest.isActive ?? true,
  }

  try {
    if (id) {
      const before = await db.faqEntry.findUnique({
        where: { id },
        select: { id: true, question: true, locale: true, isActive: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.faqEntry.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: user.id,
            action: 'faq.updated',
            entityType: 'FaqEntry',
            entityId: id,
            before,
            after: { question: data.question, locale: data.locale, isActive: data.isActive },
          },
          tx
        )
      })

      revalidateSite()
      return { ok: true, id }
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.faqEntry.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'faq.created',
          entityType: 'FaqEntry',
          entityId: row.id,
          after: { question: data.question, locale: data.locale, isActive: data.isActive },
        },
        tx
      )
      return row
    })

    revalidateSite()
    return { ok: true, id: created.id }
  } catch (error) {
    console.error('[settings] saveFaqEntry failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteFaqEntry(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('knowledge:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const before = await db.faqEntry.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, question: true, locale: true },
    })
    if (!before) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.faqEntry.delete({ where: { id: parsed.data.id } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'faq.deleted',
          entityType: 'FaqEntry',
          entityId: parsed.data.id,
          before,
        },
        tx
      )
    })

    revalidateSite()
    return { ok: true }
  } catch (error) {
    console.error('[settings] deleteFaqEntry failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Global trade routes ----------------------------------------------------

const latitude = z.coerce.number().min(-90).max(90)
const longitude = z.coerce.number().min(-180).max(180)

const routeSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(120),
  originName: z.string().trim().min(2).max(120),
  originLat: latitude,
  originLng: longitude,
  destName: z.string().trim().min(2).max(120),
  destLat: latitude,
  destLng: longitude,
  mode: z.nativeEnum(ShipmentMode),
  sortOrder: z.union([z.literal(''), z.coerce.number().int().min(0).max(9999)]).optional(),
  isActive: z.boolean().optional(),
})

export async function saveGlobalRoute(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = routeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, sortOrder, ...rest } = parsed.data
  const data = {
    ...rest,
    sortOrder: sortOrder === '' || sortOrder === undefined ? 0 : sortOrder,
    isActive: rest.isActive ?? true,
  }

  try {
    if (id) {
      const before = await db.globalRoute.findUnique({
        where: { id },
        select: { id: true, label: true, isActive: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.globalRoute.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: user.id,
            action: 'route.updated',
            entityType: 'GlobalRoute',
            entityId: id,
            before,
            after: { label: data.label, isActive: data.isActive },
          },
          tx
        )
      })

      revalidateSite()
      return { ok: true, id }
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.globalRoute.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'route.created',
          entityType: 'GlobalRoute',
          entityId: row.id,
          after: { label: data.label, isActive: data.isActive },
        },
        tx
      )
      return row
    })

    revalidateSite()
    return { ok: true, id: created.id }
  } catch (error) {
    console.error('[settings] saveGlobalRoute failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteGlobalRoute(input: unknown): Promise<SettingsActionResult> {
  const user = await requirePermission('settings:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const before = await db.globalRoute.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, label: true },
    })
    if (!before) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.globalRoute.delete({ where: { id: parsed.data.id } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'route.deleted',
          entityType: 'GlobalRoute',
          entityId: parsed.data.id,
          before,
        },
        tx
      )
    })

    revalidateSite()
    return { ok: true }
  } catch (error) {
    console.error('[settings] deleteGlobalRoute failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * These settings appear in the shared layout, so every page can be affected.
 *
 * `revalidatePath('/', 'layout')` clears the whole tree, which is the honest
 * scope for a change to the announcement bar or the footer.
 */
function revalidateSite() {
  revalidatePath('/', 'layout')
}
