import { defineRouting } from 'next-intl/routing'

/**
 * The five supported website languages.
 *
 * NOTE: the URL/BCP-47 form is `zh-CN`, but Prisma enum members cannot contain
 * a hyphen, so the database stores `zh_CN`. Use `toDbLocale` / `fromDbLocale`
 * in `src/i18n/locale.ts` whenever crossing that boundary.
 */
export const locales = ['en', 'ar', 'de', 'fr', 'zh-CN'] as const
export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'en'

/** Scripts that require a right-to-left document direction. */
export const rtlLocales: readonly AppLocale[] = ['ar']

export const localeDirection = (locale: AppLocale): 'rtl' | 'ltr' =>
  rtlLocales.includes(locale) ? 'rtl' : 'ltr'

/** Native-name labels for the language selector — always shown in their own script. */
export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  ar: 'العربية',
  de: 'Deutsch',
  fr: 'Français',
  'zh-CN': '简体中文',
}

/** BCP-47 tags used for `hreflang` and `<html lang>`. */
export const localeHreflang: Record<AppLocale, string> = {
  en: 'en',
  ar: 'ar',
  de: 'de',
  fr: 'fr',
  'zh-CN': 'zh-Hans',
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Every locale is prefixed (/en, /ar, …) so each language has one canonical
  // URL and hreflang stays unambiguous.
  localePrefix: 'always',
  localeDetection: true,
  // hreflang is emitted in `generateMetadata` as <link> tags in <head>. Left on
  // by default next-intl would ALSO send them as Link response headers, which
  // duplicates every alternate.
  alternateLinks: false,
  localeCookie: {
    name: 'GLEX_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
})
