'use server'

import { Locale } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import {
  isTranslatableLocale,
  TRANSLATABLE_KINDS,
  TRANSLATION_FIELDS,
  type TranslatableKind,
} from '@/lib/translations'

/**
 * Per-entity translations.
 *
 * One action for all four tables, because they share one shape. What differs is
 * only which columns exist, and that is declared once in `TRANSLATION_FIELDS`.
 *
 * Two rules matter:
 *
 *   1. **English is refused.** The base row is the English source and
 *      `pickTranslation()` falls back to it, so an `en` translation row would
 *      shadow the source and the two could silently disagree.
 *   2. **A required field may not be saved blank.** `pickTranslation(...)?.name
 *      ?? product.name` only falls back on null or undefined — an empty string
 *      is a value, and would render the product with no name at all.
 */

export type TranslationActionResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'not_found' | 'english' | 'server' }

/**
 * The audit `entityType` per kind. The table access itself is dispatched
 * explicitly below rather than by name, so a typo is a compile error instead of
 * a runtime one.
 */
const ENTITY_TYPE: Record<TranslatableKind, string> = {
  product: 'ProductTranslation',
  category: 'CategoryTranslation',
  article: 'NewsTranslation',
  newsCategory: 'NewsCategoryTranslation',
}

type Values = Record<string, string | null>

/**
 * Writes the row for one kind.
 *
 * Spelled out per kind on purpose: each table has its own composite unique key,
 * and naming them through a string index would let a typo compile and fail only
 * when someone tried to translate something.
 */
async function upsertFor(
  kind: TranslatableKind,
  entityId: string,
  locale: Locale,
  data: Values
): Promise<void> {
  switch (kind) {
    case 'product':
      await db.productTranslation.upsert({
        where: { productId_locale: { productId: entityId, locale } },
        create: { productId: entityId, locale, name: '', ...data },
        update: data,
      })
      return
    case 'category':
      await db.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: entityId, locale } },
        create: { categoryId: entityId, locale, name: '', ...data },
        update: data,
      })
      return
    case 'article':
      await db.newsTranslation.upsert({
        where: { articleId_locale: { articleId: entityId, locale } },
        create: { articleId: entityId, locale, title: '', summary: '', body: '', ...data },
        update: data,
      })
      return
    case 'newsCategory':
      await db.newsCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: entityId, locale } },
        create: { categoryId: entityId, locale, name: '', ...data },
        update: data,
      })
      return
  }
}

async function deleteFor(
  kind: TranslatableKind,
  entityId: string,
  locale: Locale
): Promise<number> {
  switch (kind) {
    case 'product':
      return (await db.productTranslation.deleteMany({ where: { productId: entityId, locale } }))
        .count
    case 'category':
      return (await db.categoryTranslation.deleteMany({ where: { categoryId: entityId, locale } }))
        .count
    case 'article':
      return (await db.newsTranslation.deleteMany({ where: { articleId: entityId, locale } })).count
    case 'newsCategory':
      return (
        await db.newsCategoryTranslation.deleteMany({ where: { categoryId: entityId, locale } })
      ).count
  }
}

const baseSchema = z.object({
  kind: z.enum(TRANSLATABLE_KINDS),
  entityId: z.string().uuid(),
  locale: z.nativeEnum(Locale),
  values: z.record(z.string(), z.string()),
})

export async function saveTranslation(input: unknown): Promise<TranslationActionResult> {
  const user = await requirePermission('translation:write')

  const parsed = baseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { kind, entityId, locale, values } = parsed.data

  // The base row is the English source; a translation of it is not a thing.
  if (!isTranslatableLocale(locale)) return { ok: false, error: 'english' }

  const fields = TRANSLATION_FIELDS[kind]

  // Only declared columns are written, so a crafted payload cannot set an
  // arbitrary field on the row.
  const data: Record<string, string | null> = {}

  for (const field of fields) {
    const raw = (values[field.name] ?? '').trim()

    if (field.required) {
      // Blank here renders blank on the public page rather than falling back.
      if (!raw) return { ok: false, error: 'validation' }
      if (raw.length > field.maxLength) return { ok: false, error: 'validation' }
      data[field.name] = raw
    } else {
      if (raw.length > field.maxLength) return { ok: false, error: 'validation' }
      data[field.name] = raw || null
    }
  }

  try {
    await upsertFor(kind, entityId, locale, data)

    await recordAudit({
      actorId: user.id,
      action: 'translation.saved',
      entityType: ENTITY_TYPE[kind],
      entityId,
      after: { locale, kind },
    })

    revalidateTranslated()
    return { ok: true }
  } catch (error) {
    // A missing parent surfaces here as a foreign-key violation rather than a
    // prior read — one round trip instead of two, and no race between them.
    console.error('[translations] Save failed:', error)
    return { ok: false, error: 'not_found' }
  }
}

const removeSchema = z.object({
  kind: z.enum(TRANSLATABLE_KINDS),
  entityId: z.string().uuid(),
  locale: z.nativeEnum(Locale),
})

/**
 * Removes a translation.
 *
 * Safe by construction: the page falls back to the English base row, so the
 * content degrades to the source language rather than disappearing.
 */
export async function deleteTranslation(input: unknown): Promise<TranslationActionResult> {
  const user = await requirePermission('translation:write')

  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { kind, entityId, locale } = parsed.data
  if (!isTranslatableLocale(locale)) return { ok: false, error: 'english' }

  try {
    const count = await deleteFor(kind, entityId, locale)
    if (count === 0) return { ok: false, error: 'not_found' }

    await recordAudit({
      actorId: user.id,
      action: 'translation.deleted',
      entityType: ENTITY_TYPE[kind],
      entityId,
      before: { locale, kind },
    })

    revalidateTranslated()
    return { ok: true }
  } catch (error) {
    console.error('[translations] Delete failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Every public surface that renders translated content.
 *
 * NOTE: by ROUTE PATTERN — an interpolated slug matches no route and silently
 * does nothing.
 */
function revalidateTranslated() {
  revalidatePath('/[locale]/marketplace', 'page')
  revalidatePath('/[locale]/marketplace/[category]', 'page')
  revalidatePath('/[locale]/products/[slug]', 'page')
  revalidatePath('/[locale]/news', 'page')
  revalidatePath('/[locale]/news/[slug]', 'page')
}
