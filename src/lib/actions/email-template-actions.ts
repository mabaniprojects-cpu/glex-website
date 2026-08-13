'use server'

import { Locale } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { TEMPLATE_KEYS } from '@/lib/mail/types'

/**
 * Email template copy.
 *
 * These rows are what customers actually receive, so two rules matter more than
 * the CRUD around them:
 *
 *   1. The key must be one the application actually sends (`TEMPLATE_KEYS`).
 *      A row keyed `welcome-v2` would look edited and be read by nothing.
 *   2. Deleting or deactivating a row is safe. `src/lib/mail/templates.ts`
 *      falls back to the requested locale, then English, then hard-coded copy —
 *      so a verification email still sends even with an empty table.
 */

export type EmailTemplateActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'duplicate' | 'server' }

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  // Restricted to the keys the code sends; anything else is unreachable copy.
  key: z.enum(TEMPLATE_KEYS),
  locale: z.nativeEnum(Locale),
  subject: z.string().trim().min(3).max(200),
  heading: z.string().trim().max(200).optional(),
  body: z.string().trim().min(10).max(4000),
  isActive: z.boolean().optional(),
})

export async function saveEmailTemplate(input: unknown): Promise<EmailTemplateActionResult> {
  const actor = await requirePermission('settings:write')

  const parsed = templateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, heading, ...rest } = parsed.data
  const data = { ...rest, heading: heading || null, isActive: rest.isActive ?? true }

  try {
    // `@@unique([key, locale])` — report the clash rather than surfacing a
    // Prisma constraint error as "something went wrong".
    const clash = await db.emailTemplate.findUnique({
      where: { key_locale: { key: data.key, locale: data.locale } },
      select: { id: true },
    })
    if (clash && clash.id !== id) return { ok: false, error: 'duplicate' }

    if (id) {
      const before = await db.emailTemplate.findUnique({
        where: { id },
        select: { id: true, key: true, locale: true, subject: true, isActive: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      await db.$transaction(async (tx) => {
        await tx.emailTemplate.update({ where: { id }, data })
        await recordAudit(
          {
            actorId: actor.id,
            action: 'email_template.updated',
            entityType: 'EmailTemplate',
            entityId: id,
            before,
            after: data,
          },
          tx
        )
      })

      revalidatePath('/admin/emails')
      return { ok: true, id }
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.emailTemplate.create({ data, select: { id: true } })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'email_template.created',
          entityType: 'EmailTemplate',
          entityId: row.id,
          after: data,
        },
        tx
      )
      return row
    })

    revalidatePath('/admin/emails')
    return { ok: true, id: created.id }
  } catch (error) {
    console.error('[emails] Save failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteEmailTemplate(input: unknown): Promise<EmailTemplateActionResult> {
  const actor = await requirePermission('settings:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    const template = await db.emailTemplate.findUnique({
      where: { id },
      select: { id: true, key: true, locale: true, subject: true },
    })
    if (!template) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      // A hard delete is safe here: the renderer falls back to English and then
      // to hard-coded copy, so removing a row degrades the wording rather than
      // silencing the email.
      await tx.emailTemplate.delete({ where: { id } })
      await recordAudit(
        {
          actorId: actor.id,
          action: 'email_template.deleted',
          entityType: 'EmailTemplate',
          entityId: id,
          before: { key: template.key, locale: template.locale, subject: template.subject },
        },
        tx
      )
    })

    revalidatePath('/admin/emails')
    return { ok: true }
  } catch (error) {
    console.error('[emails] Delete failed:', error)
    return { ok: false, error: 'server' }
  }
}
