import type messages from './messages/en.json'
import type { routing } from './src/i18n/routing'

/**
 * Types the whole next-intl surface from the English catalogue, so a typo in a
 * `t('...')` key is a compile error rather than a runtime placeholder.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
  }
}
