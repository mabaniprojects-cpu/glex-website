/**
 * Which analytics tag the site loads, if any.
 *
 * Deliberately dependency-free. `next.config.ts` imports this to put the
 * script's origin into the Content-Security-Policy, and a config file is
 * evaluated before module aliases, `server-only` or the validated environment
 * exist — so this module reads `process.env` directly and imports nothing.
 *
 * Only cookieless, privacy-conscious providers are supported. Google Analytics
 * is absent on purpose: it sets identifiers, ships visitor data to an ad
 * business, and would make the promise in the consent banner harder to keep.
 *
 * Nothing here decides WHETHER to load the tag — `isAnalyticsAllowed()` does
 * that, per visitor, from their consent cookie.
 */

export type AnalyticsProvider = 'none' | 'plausible' | 'umami'

export const ANALYTICS_PROVIDERS = ['none', 'plausible', 'umami'] as const

/**
 * Where each provider's script lives, and the attribute it expects its site
 * identifier in. The attribute name is not shared: Plausible reads the site's
 * domain from `data-domain`, Umami reads an opaque id from `data-website-id`.
 */
const PROVIDERS: Record<
  Exclude<AnalyticsProvider, 'none'>,
  { defaultSrc: string; idAttribute: string }
> = {
  plausible: { defaultSrc: 'https://plausible.io/js/script.js', idAttribute: 'data-domain' },
  umami: { defaultSrc: 'https://cloud.umami.is/script.js', idAttribute: 'data-website-id' },
}

export type AnalyticsScript = {
  src: string
  /** Spread onto the `<script>` tag. */
  attributes: Record<string, string>
}

function provider(): AnalyticsProvider {
  const value = process.env.ANALYTICS_PROVIDER?.trim()
  return value === 'plausible' || value === 'umami' ? value : 'none'
}

/**
 * The tag to render, or null when analytics is switched off or incomplete.
 *
 * A provider without a site id is treated as off rather than as an error: a
 * half-configured tag reports nothing useful, and taking the site down over an
 * optional integration would be the worse failure.
 */
export function analyticsScript(): AnalyticsScript | null {
  const name = provider()
  if (name === 'none') return null

  const siteId = process.env.ANALYTICS_SITE_ID?.trim()
  if (!siteId) return null

  const { defaultSrc, idAttribute } = PROVIDERS[name]
  const src = process.env.ANALYTICS_SCRIPT_URL?.trim() || defaultSrc

  return { src, attributes: { [idAttribute]: siteId } }
}

/**
 * The origin to allow in `script-src`, or null when there is nothing to allow.
 *
 * The site's CSP is `script-src 'self'`, so without this the tag is fetched,
 * refused by the browser and silently reports nothing — a failure that looks
 * exactly like "no visitors" in the dashboard.
 *
 * Read at BUILD time, because that is when the policy is baked into
 * `next.config.ts`. Setting `ANALYTICS_PROVIDER` only in the runtime
 * environment therefore yields a blocked script, which is why `.env.example`
 * says to set it for the build too.
 */
export function analyticsScriptOrigin(): string | null {
  const script = analyticsScript()
  if (!script) return null

  try {
    return new URL(script.src).origin
  } catch {
    // A malformed URL must not take the build down over an optional tag.
    return null
  }
}
