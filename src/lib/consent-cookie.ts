/**
 * The consent cookie, in a module with no server imports.
 *
 * `src/lib/consent.ts` reads it through `next/headers` and cannot be imported
 * from the browser. The client instrumentation needs the same name and the same
 * rule about what counts as consent, and two copies of a cookie name is exactly
 * the kind of thing that drifts silently — so both sides import this.
 */

export const CONSENT_COOKIE = 'GLEX_CONSENT'

export type ConsentChoice = 'all' | 'essential'

export function isConsentChoice(value: string | undefined): value is ConsentChoice {
  return value === 'all' || value === 'essential'
}

/**
 * Whether optional, non-essential code may run, given a raw `document.cookie`.
 *
 * Defaults to NO. An unset or malformed cookie must never read as consent —
 * the same rule `isAnalyticsAllowed()` applies on the server.
 */
export function analyticsAllowedFromCookieString(cookieString: string): boolean {
  return cookieString
    .split(';')
    .map((entry) => entry.trim())
    .some((entry) => entry === `${CONSENT_COOKIE}=all`)
}
