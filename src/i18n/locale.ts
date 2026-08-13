import { Locale as DbLocale } from '@prisma/client'
import { defaultLocale, locales, type AppLocale } from './routing'

/**
 * Bridge between the URL locale (`zh-CN`, BCP-47) and the Prisma enum
 * (`zh_CN` — enum members cannot contain a hyphen).
 */

export function toDbLocale(locale: string): DbLocale {
  switch (locale) {
    case 'ar':
      return DbLocale.ar
    case 'de':
      return DbLocale.de
    case 'fr':
      return DbLocale.fr
    case 'zh-CN':
      return DbLocale.zh_CN
    default:
      return DbLocale.en
  }
}

export function fromDbLocale(locale: DbLocale): AppLocale {
  return locale === DbLocale.zh_CN ? 'zh-CN' : (locale as AppLocale)
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

export function coerceAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : defaultLocale
}

/**
 * Picks the best translation for `locale` from a list of translation rows,
 * falling back to the base record's own fields when no translation exists.
 * Prevents untranslated content from rendering as an empty string.
 */
export function pickTranslation<T extends { locale: DbLocale }>(
  translations: readonly T[],
  locale: AppLocale
): T | undefined {
  const target = toDbLocale(locale)
  return (
    translations.find((t) => t.locale === target) ??
    translations.find((t) => t.locale === DbLocale.en)
  )
}
