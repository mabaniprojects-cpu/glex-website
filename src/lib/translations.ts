import { Locale } from '@prisma/client'

/**
 * Per-entity translation editing.
 *
 * Four tables share one shape — `@@unique([<entity>Id, locale])` — so they share
 * one editor rather than four near-identical forms.
 *
 * **English is not a translation.** The base row on the entity itself holds the
 * English text, and `pickTranslation()` falls back to it. Storing an `en`
 * translation row would shadow the source rather than add to it, and the two
 * could then disagree with no indication of which is authoritative. So the
 * editor offers the four other locales and shows the base text as the source.
 */

export const TRANSLATABLE_KINDS = ['product', 'category', 'article', 'newsCategory'] as const

export type TranslatableKind = (typeof TRANSLATABLE_KINDS)[number]

export type TranslationField = {
  name: string
  /** Blank in a required field renders blank — it does not fall back. */
  required?: boolean
  multiline?: boolean
  maxLength: number
}

/**
 * Which fields each kind translates.
 *
 * Deliberately a subset: a slug is a URL and stays one per entity, and a price
 * does not exist anywhere in this application.
 */
export const TRANSLATION_FIELDS: Record<TranslatableKind, TranslationField[]> = {
  product: [
    { name: 'name', required: true, maxLength: 200 },
    { name: 'shortDescription', multiline: true, maxLength: 400 },
    { name: 'description', multiline: true, maxLength: 8000 },
  ],
  category: [
    { name: 'name', required: true, maxLength: 120 },
    { name: 'description', multiline: true, maxLength: 2000 },
  ],
  article: [
    { name: 'title', required: true, maxLength: 200 },
    { name: 'summary', required: true, multiline: true, maxLength: 500 },
    { name: 'body', required: true, multiline: true, maxLength: 40_000 },
    { name: 'seoTitle', maxLength: 200 },
    { name: 'seoDescription', multiline: true, maxLength: 300 },
  ],
  newsCategory: [{ name: 'name', required: true, maxLength: 120 }],
}

/**
 * Locales a translation may be written for.
 *
 * English is absent by design — see the note above.
 */
export const TRANSLATABLE_LOCALES: Locale[] = [
  Locale.ar,
  Locale.de,
  Locale.fr,
  Locale.zh_CN,
]

export const isTranslatableLocale = (locale: Locale): boolean =>
  TRANSLATABLE_LOCALES.includes(locale)
