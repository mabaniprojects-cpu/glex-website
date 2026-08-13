import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, routing } from './routing'

/**
 * Resolves the request locale and loads its message catalogue.
 *
 * English messages are merged underneath the active locale so that a key which
 * has not been translated yet renders the English string rather than throwing
 * or printing the raw key path.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale

  const [messages, fallback] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default),
    locale === defaultLocale
      ? Promise.resolve(null)
      : import(`../../messages/${defaultLocale}.json`).then((m) => m.default),
  ])

  return {
    locale,
    messages: fallback ? deepMerge(fallback, messages) : messages,
    now: new Date(),
    timeZone: 'Asia/Riyadh',
  }
})

type MessageTree = { [key: string]: string | MessageTree }

/** Overlays `override` on top of `base`, recursing into nested namespaces. */
function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key]
    out[key] =
      typeof value === 'object' && typeof existing === 'object'
        ? deepMerge(existing, value)
        : value
  }
  return out
}
